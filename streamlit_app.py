import os
import json
import requests
import streamlit as st
from typing import List, Dict, Any
import time

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Page configuration
st.set_page_config(
    page_title="Privacy Demo Chatbot",
    page_icon="🔒",
    layout="wide"
)

# Initialize session state
if 'conversation_log' not in st.session_state:
    st.session_state.conversation_log = []
if 'current_step' not in st.session_state:
    st.session_state.current_step = 0
if 'mode' not in st.session_state:
    st.session_state.mode = "naive"
if 'questions' not in st.session_state:
    st.session_state.questions = []
if 'analyzed_log' not in st.session_state:
    st.session_state.analyzed_log = []
if 'privacy_choices' not in st.session_state:
    st.session_state.privacy_choices = {}
if 'show_privacy_analysis' not in st.session_state:
    st.session_state.show_privacy_analysis = False
if 'edit_mode' not in st.session_state:
    st.session_state.edit_mode = False
if 'editable_log' not in st.session_state:
    st.session_state.editable_log = []
if 'original_log' not in st.session_state:
    st.session_state.original_log = []
if 'conversation_height' not in st.session_state:
    st.session_state.conversation_height = 400

# Gemini API Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY') or st.secrets.get('GEMINI_API_KEY', '')
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

def get_gemini_api_key():
    """Get Gemini API key from environment or Streamlit secrets"""
    if GEMINI_API_KEY:
        return GEMINI_API_KEY
    else:
        st.error("❌ Gemini API Key not configured")
        st.info("Please set the GEMINI_API_KEY environment variable or add it to your Streamlit secrets.")
        return None

def gemini_chatbot_reply(history: List[Dict[str, str]], user_message: str) -> str:
    """Generate chatbot reply using Gemini API"""
    api_key = get_gemini_api_key()
    if not api_key:
        return "I'm sorry, but I cannot respond right now due to API configuration issues."
    
    # Prepare conversation history
    contents = []
    
    # Add conversation history
    for turn in history:
        contents.append({
            "role": "user",
            "parts": [{"text": turn["user"]}]
        })
        contents.append({
            "role": "model",
            "parts": [{"text": turn["bot"]}]
        })
    
    # Add current user message
    contents.append({
        "role": "user",
        "parts": [{"text": user_message}]
    })
    
    # Prepare request payload
    payload = {
        "contents": contents,
        "generationConfig": {
            "temperature": 0.7,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 1024,
        }
    }
    
    try:
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            f"{GEMINI_API_URL}?key={api_key}",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                return result['candidates'][0]['content']['parts'][0]['text']
            else:
                return "I'm sorry, I couldn't generate a response at this time."
        else:
            st.error(f"API Error: {response.status_code}")
            return f"I'm sorry, there was an error processing your request (Status: {response.status_code})."
            
    except requests.exceptions.Timeout:
        return "I'm sorry, the request timed out. Please try again."
    except requests.exceptions.RequestException as e:
        st.error(f"Request Error: {str(e)}")
        return "I'm sorry, there was an error connecting to the service."
    except Exception as e:
        st.error(f"Unexpected Error: {str(e)}")
        return "I'm sorry, an unexpected error occurred."

def gemini_privacy_detection(user_message: str) -> Dict[str, Any]:
    """Detect privacy issues in user message using Gemini API"""
    api_key = get_gemini_api_key()
    if not api_key:
        return {"privacy_issue": False}
    
    prompt = f"""
    Analyze the following user message for potential privacy issues. Look for:
    1. Personal identifiable information (names, addresses, phone numbers, emails)
    2. Sensitive personal data (health information, financial data, passwords)
    3. Location data
    4. Biometric data
    5. Any other information that could compromise privacy
    
    User message: "{user_message}"
    
    Respond with a JSON object containing:
    {{
        "privacy_issue": true/false,
        "type": "issue_type_description",
        "explanation": "detailed explanation of the privacy concern",
        "suggestion": "safer alternative text (if possible)"
    }}
    
    If no privacy issues are found, return:
    {{
        "privacy_issue": false,
        "type": "none",
        "explanation": "No privacy issues detected",
        "suggestion": ""
    }}
    """
    
    try:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 500,
            }
        }
        
        headers = {"Content-Type": "application/json"}
        response = requests.post(
            f"{GEMINI_API_URL}?key={api_key}",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if 'candidates' in result and len(result['candidates']) > 0:
                response_text = result['candidates'][0]['content']['parts'][0]['text']
                try:
                    # Try to parse JSON response
                    privacy_result = json.loads(response_text)
                    return privacy_result
                except json.JSONDecodeError:
                    # If JSON parsing fails, return a basic privacy check
                    return {
                        "privacy_issue": False,
                        "type": "parsing_error",
                        "explanation": "Could not parse privacy analysis response",
                        "suggestion": ""
                    }
            else:
                return {"privacy_issue": False}
        else:
            return {"privacy_issue": False}
            
    except Exception as e:
        st.error(f"Privacy detection error: {str(e)}")
        return {"privacy_issue": False}

def chat(user_message: str):
    """Process chat message and generate response"""
    # Add user message to conversation
    st.session_state.conversation_log.append({
        "user": user_message,
        "bot": "",
        "timestamp": time.time()
    })
    
    # Generate bot response
    history = st.session_state.conversation_log[:-1]  # Exclude current message
    bot_response = gemini_chatbot_reply(history, user_message)
    
    # Update bot response
    st.session_state.conversation_log[-1]["bot"] = bot_response
    
    # Privacy detection for featured mode
    if st.session_state.mode == "featured":
        privacy_result = gemini_privacy_detection(user_message)
        if privacy_result.get("privacy_issue", False):
            st.session_state.conversation_log[-1]["privacy"] = {
                "type": privacy_result.get("type", "unknown"),
                "explanation": privacy_result.get("explanation", ""),
                "suggestion": privacy_result.get("suggestion", "")
            }
    
    st.session_state.current_step += 1

def run_privacy_analysis_on_log(conversation_log: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Run privacy analysis on entire conversation log"""
    analyzed_log = []
    
    for turn in conversation_log:
        analyzed_turn = turn.copy()
        if st.session_state.mode == "featured":
            privacy_result = gemini_privacy_detection(turn["user"])
            if privacy_result.get("privacy_issue", False):
                analyzed_turn["privacy"] = {
                    "type": privacy_result.get("type", "unknown"),
                    "explanation": privacy_result.get("explanation", ""),
                    "suggestion": privacy_result.get("suggestion", "")
                }
        analyzed_log.append(analyzed_turn)
    
    return analyzed_log

def generate_export_data(mode: str, conversation_log: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Generate export data based on mode"""
    if mode == "naive":
        return {
            "metadata": {
                "mode": "naive",
                "export_timestamp": st.session_state.current_step,
                "total_messages": len(conversation_log)
            },
            "conversation": conversation_log
        }
    elif mode == "neutral":
        return {
            "metadata": {
                "mode": "neutral",
                "export_timestamp": st.session_state.current_step,
                "total_messages": len(conversation_log)
            },
            "conversation": conversation_log
        }
    else:  # featured
        return {
            "metadata": {
                "mode": "featured",
                "export_timestamp": st.session_state.current_step,
                "total_messages": len(conversation_log)
            },
            "conversation": conversation_log
        }

def main():
    st.title("🔒 Privacy Demo Chatbot")
    st.write("A chatbot with privacy detection capabilities for data collection")
    
    # Sidebar for configuration
    with st.sidebar:
        st.header("Configuration")
        
        # Mode selection
        mode = st.selectbox(
            "Select Mode",
            ["naive", "neutral", "featured"],
            index=0 if st.session_state.mode == "naive" else (1 if st.session_state.mode == "neutral" else 2)
        )
        
        if st.session_state.mode != mode:
            st.session_state.edit_mode = False
            st.session_state.editable_log = []
            st.session_state.analyzed_log = []
            st.session_state.show_privacy_analysis = False
            st.session_state.privacy_choices = {}
        
        st.session_state.mode = mode
        
        # Show mode info
        if mode == "naive":
            st.info("💡 **Naive Mode**: You can edit your conversation log before exporting!")
        elif mode == "neutral":
            st.info("⚖️ **Neutral Mode**: Export conversation log without any modifications!")
        else:
            st.info("🔒 **Featured Mode**: Privacy analysis runs when you export the conversation log!")
        
        # Conversation display settings
        st.subheader("⚙️ Display Settings")
        conversation_height = st.slider(
            "Conversation Height (px)",
            min_value=200,
            max_value=800,
            value=st.session_state.conversation_height,
            step=50
        )
        st.session_state.conversation_height = conversation_height
        
        # File upload for questions
        st.subheader("Upload Questions")
        uploaded_file = st.file_uploader(
            "Choose a JSON file with questions",
            type=['json']
        )
        if uploaded_file is not None:
            try:
                content = uploaded_file.read()
                st.session_state.questions = json.loads(content)
                st.success(f"✅ Loaded {len(st.session_state.questions)} questions")
            except Exception as e:
                st.error(f"❌ Error loading file: {e}")
        
        # File upload for returning conversation logs
        st.subheader("Return Your Conversation Log")
        uploaded_return = st.file_uploader(
            "Upload your exported JSON log here to send it back to us",
            type=["json"],
            key="return_upload"
        )
        if uploaded_return is not None:
            import os
            save_path = os.path.join("uploaded_logs", uploaded_return.name)
            os.makedirs("uploaded_logs", exist_ok=True)
            with open(save_path, "wb") as f:
                f.write(uploaded_return.getbuffer())
            st.success(f"Thank you! Your file has been received.")
        
        # Reset conversation
        if st.button("🔄 Reset Conversation"):
            st.session_state.conversation_log = []
            st.session_state.current_step = 0
            st.session_state.edit_mode = False
            st.session_state.editable_log = []
            st.session_state.analyzed_log = []
            st.session_state.show_privacy_analysis = False
            st.session_state.privacy_choices = {}
            st.session_state.original_log = []
            st.rerun()
        
        # Export conversation
        if st.session_state.conversation_log:
            if st.session_state.mode == "naive":
                if st.button("📥 Export Direct"):
                    export_data = generate_export_data("naive", st.session_state.conversation_log)
                    st.download_button(
                        label="Download JSON",
                        data=json.dumps(export_data, indent=2),
                        file_name=f"conversation_log_{st.session_state.current_step}.json",
                        mime="application/json"
                    )
            elif st.session_state.mode == "neutral":
                if st.button("📥 Export Log"):
                    export_data = generate_export_data("neutral", st.session_state.conversation_log)
                    st.download_button(
                        label="Download JSON",
                        data=json.dumps(export_data, indent=2),
                        file_name=f"conversation_log_{st.session_state.current_step}.json",
                        mime="application/json"
                    )
            else:
                if st.button("🔍 Analyze & Export"):
                    with st.spinner("Running privacy analysis on all messages..."):
                        analyzed_log = run_privacy_analysis_on_log(st.session_state.conversation_log)
                        st.session_state.analyzed_log = analyzed_log
                        st.session_state.show_privacy_analysis = True
                    st.rerun()
                
                if st.button("📥 Export Direct"):
                    export_data = generate_export_data("featured", st.session_state.conversation_log)
                    st.download_button(
                        label="Download JSON",
                        data=json.dumps(export_data, indent=2),
                        file_name=f"conversation_log_{st.session_state.current_step}.json",
                        mime="application/json"
                    )
    
    # Main chat interface
    with st.expander("📊 Statistics", expanded=False):
        # Current mode
        if st.session_state.mode == "featured":
            mode_icon = "🔒"
        elif st.session_state.mode == "neutral":
            mode_icon = "⚖️"
        else:
            mode_icon = "😊"
        st.metric("Mode", f"{mode_icon} {st.session_state.mode.title()}")
        st.metric("Messages", len(st.session_state.conversation_log))
        st.metric("Step", st.session_state.current_step)
        
        if st.session_state.mode == "featured":
            if st.session_state.analyzed_log:
                privacy_warnings = sum(1 for turn in st.session_state.analyzed_log if turn.get('privacy'))
                st.metric("Privacy Issues Found", privacy_warnings)
            else:
                st.metric("Privacy Analysis", "Not Run")
        else:
            privacy_warnings = sum(1 for turn in st.session_state.conversation_log if turn.get('privacy'))
            st.metric("Privacy Warnings", privacy_warnings)
        
        if GEMINI_API_KEY:
            st.success(f"✅ Gemini API Key: Configured")
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
                    except Exception as e:
                        st.error(f"❌ API connection error: {str(e)}")
        else:
            st.error("❌ Gemini API Key: Not configured")
            with st.expander("🔧 How to configure API key", expanded=False):
                st.write("""
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
                """)

    st.subheader("💬 Chat Interface")
    
    # Display conversation
    if st.session_state.conversation_log:
        st.subheader("📝 Conversation History")
        
        # Create a container with custom height for conversation
        conversation_container = st.container()
        
        with conversation_container:
            for i, turn in enumerate(st.session_state.conversation_log):
                with st.container():
                    st.write(f"**Turn {i+1}:**")
                    
                    col1, col2 = st.columns([1, 1])
                    
                    with col1:
                        st.write("**👤 User:**")
                        st.write(turn['user'])
                    
                    with col2:
                        st.write("**🤖 Bot:**")
                        st.write(turn['bot'])
                    
                    # Show privacy warning if present
                    if turn.get('privacy'):
                        privacy_info = turn['privacy']
                        st.warning(f"""
                        **🔍 Privacy Issue Detected:**
                        - **Type:** {privacy_info["type"]}
                        - **Explanation:** {privacy_info["explanation"]}
                        - **Suggestion:** {privacy_info.get("suggestion", "No suggestion available")}
                        """)
                    
                    st.divider()
    else:
        st.info("💡 Start a conversation by typing a message below!")
    
    # Chat input
    st.subheader("💭 Type Your Message")
    user_input = st.chat_input("Type your message here...")
    
    if user_input:
        with st.spinner("Processing..."):
            chat(user_input)
        st.rerun()
    
    # Privacy Analysis Results Display (for featured mode export)
    if st.session_state.show_privacy_analysis and st.session_state.analyzed_log:
        st.subheader("🔍 Privacy Analysis Results")
        st.info("Privacy analysis has been completed on all messages.")
        
        # Show summary statistics
        privacy_issues = [turn for turn in st.session_state.analyzed_log if turn.get('privacy')]
        st.metric("Total Messages", len(st.session_state.analyzed_log))
        st.metric("Privacy Issues Found", len(privacy_issues))
        
        if privacy_issues:
            st.warning(f"⚠️ **{len(privacy_issues)} privacy issues detected**")
            
            # Show individual privacy issues
            for i, turn in enumerate(st.session_state.analyzed_log):
                if turn.get('privacy'):
                    with st.expander(f"Message {i+1}: Privacy Issue", expanded=False):
                        privacy_info = turn['privacy']
                        st.write(f"**Type:** {privacy_info['type']}")
                        st.write(f"**Explanation:** {privacy_info['explanation']}")
                        if privacy_info.get('suggestion'):
                            st.write(f"**Suggestion:** {privacy_info['suggestion']}")
                        
                        # Privacy choice buttons
                        col1, col2, col3 = st.columns([1, 1, 1])
                        
                        current_choice = st.session_state.privacy_choices.get(i, "none")
                        
                        with col1:
                            if st.button(f"✅ Accept Suggestion", key=f"accept_{i}", 
                                       type="primary" if current_choice == "accept" else "secondary",
                                       disabled=not privacy_info.get('suggestion')):
                                st.session_state.privacy_choices[i] = "accept"
                                st.rerun()
                        
                        with col2:
                            if st.button(f"⚠️ Keep Original", key=f"keep_{i}",
                                       type="primary" if current_choice == "keep" else "secondary"):
                                st.session_state.privacy_choices[i] = "keep"
                                st.rerun()
                        
                        with col3:
                            if st.button(f"❓ Undecided", key=f"none_{i}",
                                       type="primary" if current_choice == "none" else "secondary"):
                                if i in st.session_state.privacy_choices:
                                    del st.session_state.privacy_choices[i]
                                st.rerun()
                        
                        # Show current choice status
                        if current_choice == "accept":
                            st.success("✅ **Choice: Accept Suggestion** - Will use safer text in export")
                        elif current_choice == "keep":
                            st.warning("⚠️ **Choice: Keep Original** - Will use original text in export")
                        else:
                            st.info("❓ **Choice: Undecided** - Please make a choice before exporting")
        else:
            st.success("✅ **No privacy issues detected** - All messages appear to be safe for export.")
        
        # Export buttons for analyzed log
        col_export_analyzed, col_export_original, col_close = st.columns([1, 1, 1])
        
        with col_export_analyzed:
            if privacy_issues and len(st.session_state.privacy_choices) == len(privacy_issues):
                # Generate final log with user choices
                final_log = []
                for i, turn in enumerate(st.session_state.analyzed_log):
                    choice = st.session_state.privacy_choices[i]
                    if turn.get('privacy') and choice == "accept" and turn['privacy'].get('suggestion'):
                        final_log.append({
                            "user": turn['privacy']['suggestion'],
                            "bot": turn['bot'],
                            "privacy": turn['privacy'],
                            "choice": choice
                        })
                    else:
                        final_log.append({
                            "user": turn['user'],
                            "bot": turn['bot'],
                            "privacy": turn.get('privacy'),
                            "choice": choice
                        })
                
                st.download_button(
                    label="📥 Export with Your Choices",
                    data=json.dumps(final_log, indent=2),
                    file_name=f"conversation_log_with_choices_{st.session_state.current_step}.json",
                    mime="application/json"
                )
            else:
                st.download_button(
                    label="📥 Export with Privacy Analysis",
                    data=json.dumps(st.session_state.analyzed_log, indent=2),
                    file_name=f"conversation_log_with_privacy_analysis_{st.session_state.current_step}.json",
                    mime="application/json",
                    disabled=privacy_issues and len(st.session_state.privacy_choices) != len(privacy_issues)
                )
        
        with col_export_original:
            st.download_button(
                label="📥 Export Original Log",
                data=json.dumps(st.session_state.conversation_log, indent=2),
                file_name=f"conversation_log_original_{st.session_state.current_step}.json",
                mime="application/json"
            )
        
        with col_close:
            if st.button("❌ Close Analysis"):
                st.session_state.show_privacy_analysis = False
                st.session_state.analyzed_log = []
                st.session_state.privacy_choices = {}
                st.rerun()

if __name__ == "__main__":
    main() 