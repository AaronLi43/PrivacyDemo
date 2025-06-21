import os
import json
import requests
import streamlit as st
from typing import List, Dict, Any

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # Fallback if python-dotenv is not installed
    pass

# Page configuration
st.set_page_config(
    page_title="Privacy Demo Chatbot",
    page_icon="🔒",
    layout="wide"
)

# Initialize session state
if 'questions' not in st.session_state:
    st.session_state.questions = []
if 'conversation_log' not in st.session_state:
    st.session_state.conversation_log = []
if 'mode' not in st.session_state:
    st.session_state.mode = "naive"
if 'current_step' not in st.session_state:
    st.session_state.current_step = 0

# Gemini API configuration
def get_gemini_api_key():
    """Get Gemini API key from multiple sources with fallback"""
    # Try environment variable (includes .env file loaded by python-dotenv)
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key and api_key != "your_gemini_api_key_here":
        return api_key
    
    # Try Streamlit secrets (for deployment)
    try:
        if hasattr(st, 'secrets') and st.secrets.get("GEMINI_API_KEY"):
            return st.secrets["GEMINI_API_KEY"]
    except:
        pass
    
    # Try .streamlit/secrets.toml file
    try:
        secrets_path = os.path.join(".streamlit", "secrets.toml")
        if os.path.exists(secrets_path):
            import toml
            with open(secrets_path, "r") as f:
                secrets = toml.load(f)
                if secrets.get("GEMINI_API_KEY"):
                    return secrets["GEMINI_API_KEY"]
    except:
        pass
    
    return None

GEMINI_API_KEY = get_gemini_api_key()

# Debug information (only in console, not UI)
if GEMINI_API_KEY:
    print("✅ Gemini API key found and configured")
    GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + GEMINI_API_KEY
else:
    print("Warning: Gemini API key not found. Please configure it using one of these methods:")
    print("1. .env file: GEMINI_API_KEY=your_api_key")
    print("2. Environment variable: GEMINI_API_KEY")
    print("3. Streamlit secrets: .streamlit/secrets.toml")
    print("4. Streamlit Cloud secrets management")
    GEMINI_API_URL = None




## Gemini LLM call for chatbot reply
def gemini_chatbot_reply(history: List[Dict[str, str]], user_message: str) -> str:
    if not GEMINI_API_URL:
        return "[Error: Gemini API key not configured. Please set the GEMINI_API_KEY environment variable.]"
    
    # Build conversation context
    conversation_text = ""
    for turn in history:
        conversation_text += f"User: {turn['user']}\nAssistant: {turn['bot']}\n"
    conversation_text += f"User: {user_message}\nAssistant:"
    
    # Corrected payload structure according to Gemini API docs
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"You are a helpful chatbot. Continue the conversation based on the following context:\n\n{conversation_text}. Reply in a brief and concise manner."
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "maxOutputTokens": 1000
        }
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(payload), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            try:
                # Corrected response parsing according to Gemini API response structure
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
            except (KeyError, IndexError) as e:
                print(f"Error parsing Gemini response: {e}")
                print(f"Response data: {data}")
                return "[Error: Could not parse Gemini response structure]"
        else:
            print(f"Gemini API error: {resp.status_code} - {resp.text}")
            return f"[Error: Gemini API call failed with status {resp.status_code}]"
    except requests.exceptions.Timeout:
        return "[Error: Gemini API request timed out]"
    except Exception as e:
        print(f"Unexpected error: {e}")
        return f"[Error: Unexpected error occurred: {str(e)}]"
    
    

# Gemini privacy detection call
def gemini_privacy_detection(user_message: str) -> Dict[str, Any]:
    if not GEMINI_API_URL:
        return {"leakage": False, "type": None, "suggestion": None, "explanation": "Gemini API key not configured."}
    
    prompt = f'''Analyze this message for privacy issues. Respond with ONLY valid JSON:
{{"leakage": true/false, "type": "issue_type_or_null", "suggestion": "safer_text_or_null", "explanation": "brief_explanation_or_null"}}

Message: "{user_message}"'''
    
    # Corrected payload structure
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 3000
        }
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        resp = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(payload), timeout=30)
        if resp.status_code == 200:
            data = resp.json()
            try:
                # Simplified response parsing
                candidate = data["candidates"][0]
                
                # Check if response was truncated
                if candidate.get("finishReason") == "MAX_TOKENS":
                    print(f"Response truncated due to MAX_TOKENS")
                    return {"leakage": False, "type": None, "suggestion": None, "explanation": "Response truncated - please try a shorter message."}
                
                # Get the text content
                content = candidate.get("content", {})
                parts = content.get("parts", [])
                
                if not parts:
                    print(f"No parts in response: {content}")
                    return {"leakage": False, "type": None, "suggestion": None, "explanation": "No content in API response."}
                
                text = parts[0].get("text", "").strip()
                
                if not text:
                    return {"leakage": False, "type": None, "suggestion": None, "explanation": "Empty response from API."}
                
                # Extract JSON from the response
                json_start = text.find('{')
                json_end = text.rfind('}') + 1
                if json_start != -1 and json_end != -1:
                    json_text = text[json_start:json_end]
                    try:
                        return json.loads(json_text)
                    except json.JSONDecodeError as e:
                        print(f"JSON decode error: {e}")
                        print(f"Attempted to parse: {json_text}")
                        return {"leakage": False, "type": None, "suggestion": None, "explanation": "Invalid JSON in response."}
                else:
                    print(f"No JSON found in response: {text}")
                    return {"leakage": False, "type": None, "suggestion": None, "explanation": "Could not parse JSON from response."}
            except (KeyError, IndexError) as e:
                print(f"Error parsing privacy detection response: {e}")
                print(f"Response data: {data}")
                return {"leakage": False, "type": None, "suggestion": None, "explanation": "Could not parse Gemini response."}
        else:
            print(f"Privacy detection API error: {resp.status_code} - {resp.text}")
            return {"leakage": False, "type": None, "suggestion": None, "explanation": "Gemini API call failed."}
    except requests.exceptions.Timeout:
        return {"leakage": False, "type": None, "suggestion": None, "explanation": "API request timed out."}
    except Exception as e:
        print(f"Unexpected error in privacy detection: {e}")
        return {"leakage": False, "type": None, "suggestion": None, "explanation": f"Unexpected error: {str(e)}"}

# Chat function
def chat(user_message: str, use_suggestion: bool = False):
    history = st.session_state.conversation_log[-5:]  # last 5 turns for context
    
    # Privacy detection before sending to chatbot
    privacy_result = None
    if st.session_state.mode == "featured" and not use_suggestion:
        privacy_result = gemini_privacy_detection(user_message)
    
    # If privacy issue detected and we haven't processed it yet, show warning modal
    if privacy_result and privacy_result.get("leakage") and not use_suggestion:
        # Store privacy result in session state for modal
        st.session_state.privacy_warning = {
            "original": user_message,
            "type": privacy_result.get("type"),
            "suggestion": privacy_result.get("suggestion"),
            "explanation": privacy_result.get("explanation"),
        }
        return  # Exit early, let the modal handle the rest
    
    # Get the message to send to chatbot (either original or suggested)
    message_to_send = user_message
    privacy_info = None
    
    if use_suggestion and hasattr(st.session_state, 'privacy_warning') and st.session_state.privacy_warning:
        # Use suggested text if user accepted it
        message_to_send = st.session_state.privacy_warning.get('suggestion', user_message)
        privacy_info = {
            "original": user_message,
            "type": st.session_state.privacy_warning.get("type"),
            "suggestion": st.session_state.privacy_warning.get("suggestion"),
            "explanation": st.session_state.privacy_warning.get("explanation"),
            "used_suggestion": True
        }
        # Clear the privacy warning after processing
        del st.session_state.privacy_warning
    elif privacy_result and privacy_result.get("leakage"):
        # User proceeded with original text
        privacy_info = {
            "original": user_message,
            "type": privacy_result.get("type"),
            "suggestion": privacy_result.get("suggestion"),
            "explanation": privacy_result.get("explanation"),
            "used_suggestion": False
        }
    
    # Send to chatbot
    bot_message = gemini_chatbot_reply(history, message_to_send)
    
    # Store in conversation log
    st.session_state.conversation_log.append({
        "user": user_message, 
        "bot": bot_message, 
        "privacy": privacy_info
    })
    st.session_state.current_step += 1

# Main app
def main():
    st.title("🔒 Privacy Demo Chatbot")
    st.markdown("A chatbot with privacy detection capabilities for data collection")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("Configuration")
        
        # Mode selection
        mode = st.selectbox(
            "Select Mode",
            ["naive", "featured"],
            index=0 if st.session_state.mode == "naive" else 1,
            help="Naive mode: Regular chatbot. Featured mode: Privacy detection enabled."
        )
        st.session_state.mode = mode
        
        # File upload for questions
        st.subheader("Upload Questions")
        uploaded_file = st.file_uploader(
            "Choose a JSON file with questions",
            type=['json'],
            help="Upload a JSON file containing questions for the chatbot"
        )
        
        if uploaded_file is not None:
            try:
                content = uploaded_file.read()
                st.session_state.questions = json.loads(content)
                st.success(f"✅ Loaded {len(st.session_state.questions)} questions")
            except Exception as e:
                st.error(f"❌ Error loading file: {e}")
        
        # Display current questions count
        if st.session_state.questions:
            st.info(f"📋 {len(st.session_state.questions)} questions loaded")
        
        # Reset conversation
        if st.button("🔄 Reset Conversation"):
            st.session_state.conversation_log = []
            st.session_state.current_step = 0
            st.rerun()
        
        # Export conversation
        if st.session_state.conversation_log:
            if st.button("📥 Export Conversation"):
                log_data = st.session_state.conversation_log.copy()
                st.download_button(
                    label="Download JSON",
                    data=json.dumps(log_data, indent=2),
                    file_name=f"conversation_log_{st.session_state.current_step}.json",
                    mime="application/json"
                )
    
    # Main chat interface
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("💬 Chat Interface")
        
        # Chat input
        user_input = st.chat_input("Type your message here...")
        
        if user_input:
            with st.spinner("Processing..."):
                chat(user_input)
            st.rerun()
        
        # Privacy warning modal - moved back to left column for direct user notification
        if hasattr(st.session_state, 'privacy_warning') and st.session_state.privacy_warning:
            warning = st.session_state.privacy_warning
            
            st.warning("⚠️ **Privacy Warning Detected!**")
            
            col1_warning, col2_warning = st.columns([1, 1])
            
            with col1_warning:
                st.markdown("**Original Message:**")
                st.text_area("Original Message", value=warning['original'], height=100, disabled=True, key="original_msg", label_visibility="collapsed")
                
                st.markdown(f"**Issue Type:** {warning['type']}")
                st.markdown(f"**Explanation:** {warning['explanation']}")
            
            with col2_warning:
                if warning['suggestion']:
                    st.markdown("**Suggested Safer Text:**")
                    st.text_area("Suggested Safer Text", value=warning['suggestion'], height=100, disabled=True, key="suggested_msg", label_visibility="collapsed")
                    
                    st.markdown("**Choose your action:**")
                    
                    if st.button("✅ Accept Suggestion", type="primary"):
                        st.session_state.privacy_accepted = True
                        # Re-process the message with the suggestion
                        with st.spinner("Processing with suggested text..."):
                            chat(warning['original'], True)
                        st.rerun()
                    
                    if st.button("⚠️ Proceed with Original"):
                        st.session_state.privacy_accepted = False
                        # Re-process the message with original text
                        with st.spinner("Processing with original text..."):
                            chat(warning['original'], False)
                        st.rerun()
                else:
                    st.warning("No suggestion available")
                    if st.button("⚠️ Proceed Anyway"):
                        st.session_state.privacy_accepted = False
                        # Re-process the message with original text
                        with st.spinner("Processing with original text..."):
                            chat(warning['original'], False)
                        st.rerun()
        
        # Display conversation
        if st.session_state.conversation_log:
            st.subheader("Conversation History")
            
            for i, turn in enumerate(st.session_state.conversation_log):
                with st.container():
                    # User message
                    st.markdown(f"**👤 User:** {turn['user']}")
                    
                    # Bot message
                    st.markdown(f"**🤖 Bot:** {turn['bot']}")
                    
                    # Privacy warning (if any)
                    if turn.get('privacy'):
                        with st.expander("⚠️ Privacy Warning", expanded=True):
                            st.warning(f"**Type:** {turn['privacy']['type']}")
                            st.info(f"**Explanation:** {turn['privacy']['explanation']}")
                            if turn['privacy']['suggestion']:
                                st.success(f"**Suggestion:** {turn['privacy']['suggestion']}")
                                if turn['privacy'].get('used_suggestion'):
                                    st.success("✅ **User accepted the suggestion**")
                                else:
                                    st.warning("⚠️ **User proceeded with original text**")
                            else:
                                st.warning("⚠️ **User proceeded despite privacy warning**")
                    
                    st.divider()
        else:
            st.info("💡 Start a conversation by typing a message above!")
    
    with col2:
        st.subheader("📊 Statistics")
        
        # Current mode
        mode_icon = "🔒" if st.session_state.mode == "featured" else "😊"
        st.metric("Mode", f"{mode_icon} {st.session_state.mode.title()}")
        
        # Conversation stats
        st.metric("Messages", len(st.session_state.conversation_log))
        st.metric("Step", st.session_state.current_step)
        
        # Privacy warnings count
        privacy_warnings = sum(1 for turn in st.session_state.conversation_log if turn.get('privacy'))
        accepted_suggestions = sum(1 for turn in st.session_state.conversation_log if turn.get('privacy') and turn['privacy'].get('used_suggestion'))
        st.metric("Privacy Warnings", privacy_warnings)
        if privacy_warnings > 0:
            st.metric("Accepted Suggestions", accepted_suggestions)
        
        # API key status
        if GEMINI_API_KEY:
            st.success(f"✅ Gemini API Key: Configured")
            
            # Test API connection
            if st.button("🧪 Test API Connection"):
                with st.spinner("Testing API connection..."):
                    test_payload = {
                        "contents": [{"parts": [{"text": "Hello, this is a test message."}]}]
                    }
                    headers = {"Content-Type": "application/json"}
                    try:
                        resp = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(test_payload), timeout=10)
                        if resp.ok:
                            st.success("✅ API connection successful!")
                        else:
                            st.error(f"❌ API connection failed: {resp.status_code}")
                            st.code(resp.text[:200] + "..." if len(resp.text) > 200 else resp.text)
                    except Exception as e:
                        st.error(f"❌ API connection error: {str(e)}")
        else:
            st.error("❌ Gemini API Key: Not configured")
            
            with st.expander("🔧 How to configure API key", expanded=False):
                st.markdown("""
                **Method 1: Environment Variable**
                ```bash
                # Windows
                set GEMINI_API_KEY=your_api_key_here
                
                # Linux/Mac
                export GEMINI_API_KEY=your_api_key_here
                ```
                
                **Method 2: Local Secrets File**
                Create `.streamlit/secrets.toml`:
                ```toml
                GEMINI_API_KEY = "your_api_key_here"
                ```
                
                **Method 3: Streamlit Cloud**
                Add the secret in your Streamlit Cloud deployment settings.
                
                **Get API Key:**
                1. Go to [Google AI Studio](https://aistudio.google.com)
                2. Click "Get API key"
                3. Create a new API key
                4. Copy and paste it using one of the methods above
                
                **Note:** The corrected API endpoint uses:
                - Base URL: `generativelanguage.googleapis.com`
                - Version: `v1beta`
                - Model: `gemini-2.5-flash`
                """)
        
        # Display current questions if available
        if st.session_state.questions:
            st.subheader("📋 Available Questions")
            for i, question in enumerate(st.session_state.questions[:5]):  # Show first 5
                st.write(f"{i+1}. {question}")
            if len(st.session_state.questions) > 5:
                st.write(f"... and {len(st.session_state.questions) - 5} more")

if __name__ == "__main__":
    main() 