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

# Add global CSS for better styling
st.markdown("""
<style>
/* Global styling improvements */
.main .block-container {
    padding-top: 2rem;
    padding-bottom: 2rem;
}

/* Light mode (default) - Using new color palette */
:root {
    --bg-color: #C0F5FA;
    --text-color: #2C1810;
    --border-color: #BD8B9C;
    --sidebar-bg: #87F1FF;
    --container-bg: #ffffff;
    --user-msg-bg: #87F1FF;
    --bot-msg-bg: #C0F5FA;
    --privacy-warning-bg: #BD8B9C;
    --privacy-warning-text: #ffffff;
    --primary-button: #AF125A;
    --primary-button-hover: #8a0e47;
    --secondary-button: #BD8B9C;
    --secondary-button-hover: #a67a8a;
    --danger-button: #AF125A;
    --danger-button-hover: #8a0e47;
    --focus-color: #87F1FF;
    --caption-color: #2C1810;
}

/* Improve text contrast and readability */
.stMarkdown, .stText {
    color: var(--text-color);
}

/* Better sidebar styling */
.sidebar .sidebar-content {
    background-color: var(--sidebar-bg);
}

/* Improve button styling */
.stButton > button {
    background-color: var(--primary-button);
    color: white;
    border: none;
    border-radius: 5px;
    padding: 8px 16px;
    font-weight: 500;
}

.stButton > button:hover {
    background-color: var(--primary-button-hover);
    color: white;
}

/* Better metric styling */
.stMetric {
    background-color: #000000;
    color: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 10px;
    margin: 5px 0;
}

/* Improve expander styling */
.streamlit-expanderHeader {
    background-color: var(--border-color);
    border: 1px solid var(--border-color);
    border-radius: 5px;
    color: var(--text-color);
}

/* Better input styling */
.stTextInput > div > div > input {
    border: 2px solid var(--border-color);
    border-radius: 5px;
    color: var(--text-color);
    background-color: var(--container-bg);
}

.stTextInput > div > div > input:focus {
    border-color: var(--focus-color);
    box-shadow: 0 0 0 0.2rem rgba(135, 241, 255, 0.25);
}

/* Improve selectbox styling */
.stSelectbox > div > div > div {
    border: 2px solid var(--border-color);
    border-radius: 5px;
    color: var(--text-color);
    background-color: var(--container-bg);
}
/* Make selectbox arrow visible */
.stSelectbox svg {
    color: #AF125A !important;
    fill: #AF125A !important;
}

/* Better slider styling */
.stSlider > div > div > div > div {
    background-color: var(--primary-button);
}

/* Improve caption styling */
.stCaption {
    color: var(--caption-color);
    font-size: 0.875rem;
}

/* Better info box styling */
.stAlert {
    border-radius: 8px;
    border: 1px solid;
}

/* Improve divider styling */
hr {
    border: 1px solid var(--border-color);
    margin: 20px 0;
}

/* Better container styling */
.stContainer {
    background-color: var(--container-bg);
    border-radius: 8px;
    padding: 15px;
    margin: 10px 0;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Edit mode text area styling */
.stTextArea > div > div > textarea {
    background-color: var(--container-bg);
    border: 2px solid var(--border-color);
    border-radius: 5px;
    color: var(--text-color);
    font-size: 14px;
    line-height: 1.5;
}

.stTextArea > div > div > textarea:focus {
    border-color: var(--focus-color);
    box-shadow: 0 0 0 0.2rem rgba(135, 241, 255, 0.25);
    background-color: var(--container-bg);
}

/* Force black text and full opacity for disabled text areas in privacy modal */
.stTextArea > div > div > textarea:disabled,
[aria-label="Original Message"] textarea:disabled,
[aria-label="Suggested Safer Text"] textarea:disabled {
    color: #000 !important;
    background-color: #f8f9fa !important;
    border: 2px solid #BD8B9C !important;
    opacity: 1 !important;
    -webkit-text-fill-color: #000 !important; /* For Safari */
}

/* Privacy warning modal markdown text styling */
.stMarkdown p {
    color: var(--text-color);
}

/* Specific styling for privacy warning modal text */
.privacy-warning-modal .stMarkdown p,
.privacy-warning-modal .stMarkdown strong {
    color: #ffffff !important;
}

/* More specific styling for privacy warning modal */
div[data-testid="stMarkdown"] p {
    color: var(--text-color);
}

/* Override for privacy warning modal specifically */
div[data-testid="stMarkdown"] p:has(strong:contains("Issue Type")),
div[data-testid="stMarkdown"] p:has(strong:contains("Explanation")) {
    color: #ffffff !important;
}

/* Alternative approach - target by proximity to warning */
.stAlert + div[data-testid="stMarkdown"] p,
.stAlert + div[data-testid="stMarkdown"] strong {
    color: #ffffff !important;
}

/* Edit mode label styling */
.stTextArea > label {
    color: var(--text-color);
    font-weight: 600;
    margin-bottom: 5px;
}

/* Edit mode container styling */
.edit-mode-container {
    background-color: var(--sidebar-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: 15px;
    margin: 10px 0;
}

/* Better button styling for edit mode */
.edit-button {
    background-color: var(--primary-button);
    color: white;
    border: none;
    border-radius: 5px;
    padding: 8px 16px;
    font-weight: 500;
    margin: 5px;
}

.edit-button:hover {
    background-color: var(--primary-button-hover);
    color: white;
}

.delete-button {
    background-color: var(--danger-button);
    color: white;
    border: none;
    border-radius: 5px;
    padding: 8px 16px;
    font-weight: 500;
}

.delete-button:hover {
    background-color: var(--danger-button-hover);
    color: white;
}

.conversation-container p {{
    color: var(--text-color);
    margin: 8px 0;
    line-height: 1.5;
}}
.conversation-container strong {{
    color: var(--text-color);
}}
.user-message p {{
    color: var(--text-color);
    margin: 0;
}}
.bot-message p {{
    color: var(--text-color);
    margin: 0;
}}
.privacy-warning {{
    background-color: var(--privacy-warning-bg);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    padding: 12px;
    margin: 10px 0;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}}
.privacy-warning p {{
    color: var(--privacy-warning-text);
    margin: 5px 0;
}}
.privacy-warning strong {{
    color: var(--privacy-warning-text);
}}
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'questions' not in st.session_state:
    st.session_state.questions = []
if 'conversation_log' not in st.session_state:
    st.session_state.conversation_log = []
if 'mode' not in st.session_state:
    st.session_state.mode = "naive"
if 'current_step' not in st.session_state:
    st.session_state.current_step = 0
if 'edit_mode' not in st.session_state:
    st.session_state.edit_mode = False
if 'editable_log' not in st.session_state:
    st.session_state.editable_log = []
if 'conversation_height' not in st.session_state:
    st.session_state.conversation_height = 400

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
def chat(user_message: str, use_suggestion: bool = False, skip_privacy_check: bool = False):
    history = st.session_state.conversation_log[-5:]  # last 5 turns for context
    
    # Privacy detection before sending to chatbot
    privacy_result = None
    if st.session_state.mode == "featured" and not use_suggestion and not skip_privacy_check:
        privacy_result = gemini_privacy_detection(user_message)
    
    # If privacy issue detected and we haven't processed it yet, show warning modal
    if privacy_result and privacy_result.get("leakage") and not use_suggestion and not skip_privacy_check:
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
    elif (privacy_result and privacy_result.get("leakage")) or skip_privacy_check:
        # User proceeded with original text (either from new detection or explicit choice)
        if skip_privacy_check and hasattr(st.session_state, 'privacy_warning') and st.session_state.privacy_warning:
            # Use stored privacy info from the warning
            privacy_info = {
                "original": user_message,
                "type": st.session_state.privacy_warning.get("type"),
                "suggestion": st.session_state.privacy_warning.get("suggestion"),
                "explanation": st.session_state.privacy_warning.get("explanation"),
                "used_suggestion": False
            }
            # Clear the privacy warning after processing
            del st.session_state.privacy_warning
        elif privacy_result and privacy_result.get("leakage"):
            # User proceeded with original text from new detection
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
    st.markdown(f'<p style="color: #ffffff;">A chatbot with privacy detection capabilities for data collection</p>', unsafe_allow_html=True)
    
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
        
        # Clear edit mode if switching from naive to featured
        if st.session_state.mode != mode and st.session_state.mode == "naive" and mode == "featured":
            st.session_state.edit_mode = False
            st.session_state.editable_log = []
        
        st.session_state.mode = mode
        
        # Show edit mode info for naive mode
        if mode == "naive":
            st.info("💡 **Naive Mode**: You can edit your conversation log before exporting!")
        
        # Conversation display settings
        st.subheader("⚙️ Display Settings")
        conversation_height = st.slider(
            "Conversation Height (px)",
            min_value=200,
            max_value=800,
            value=st.session_state.conversation_height,
            step=50,
            help="Adjust the height of the scrollable conversation area"
        )
        st.session_state.conversation_height = conversation_height
        
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
        if st.session_state.questions:
            st.info(f"📋 {len(st.session_state.questions)} questions loaded")

        # File upload for returning conversation logs
        st.subheader("Return Your Conversation Log")
        uploaded_return = st.file_uploader(
            "Upload your exported JSON log here to send it back to us",
            type=["json"],
            key="return_upload",
            help="Upload the conversation log you exported from the chat interface."
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
            st.rerun()
        
        # Export conversation
        if st.session_state.conversation_log:
            if st.session_state.mode == "naive":
                # In naive mode, allow editing before export
                if st.button("✏️ Edit & Export"):
                    st.session_state.edit_mode = True
                    st.session_state.editable_log = st.session_state.conversation_log.copy()
                    st.rerun()
                
                # Direct export option
                if st.button("📥 Export Direct"):
                    log_data = st.session_state.conversation_log.copy()
                    st.download_button(
                        label="Download JSON",
                        data=json.dumps(log_data, indent=2),
                        file_name=f"conversation_log_{st.session_state.current_step}.json",
                        mime="application/json"
                    )
            else:
                # In featured mode, direct export only
                if st.button("📥 Export Conversation"):
                    log_data = st.session_state.conversation_log.copy()
                    st.download_button(
                        label="Download JSON",
                        data=json.dumps(log_data, indent=2),
                        file_name=f"conversation_log_{st.session_state.current_step}.json",
                        mime="application/json"
                    )
    
    # Main chat interface
    with st.expander("📊 Statistics", expanded=False):
        # Current mode
        mode_icon = "🔒" if st.session_state.mode == "featured" else "😊"
        st.metric("Mode", f"{mode_icon} {st.session_state.mode.title()}")
        # Edit mode status (naive mode only)
        if st.session_state.mode == "naive":
            edit_status = "✏️ Active" if st.session_state.edit_mode else "📝 Inactive"
            st.metric("Edit Mode", edit_status)
        st.metric("Messages", len(st.session_state.conversation_log))
        st.metric("Step", st.session_state.current_step)
        privacy_warnings = sum(1 for turn in st.session_state.conversation_log if turn.get('privacy'))
        accepted_suggestions = sum(1 for turn in st.session_state.conversation_log if turn.get('privacy') and turn['privacy'].get('used_suggestion'))
        st.metric("Privacy Warnings", privacy_warnings)
        if privacy_warnings > 0:
            st.metric("Accepted Suggestions", accepted_suggestions)
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
        if st.session_state.questions:
            st.subheader("📋 Available Questions")
            for i, question in enumerate(st.session_state.questions[:5]):  # Show first 5
                st.write(f"{i+1}. {question}")
            if len(st.session_state.questions) > 5:
                st.write(f"... and {len(st.session_state.questions) - 5} more")

    st.subheader("💬 Chat Interface")
    
    # Display conversation first (above the input)
    if st.session_state.conversation_log:
        st.subheader("📝 Conversation History")
        
        # Check if we're in edit mode (naive mode only)
        if st.session_state.edit_mode and st.session_state.mode == "naive":
            st.info("✏️ **Edit Mode Active** - You can modify the conversation before exporting")
            
            # Editable conversation interface
            edited_log = []
            
            for i, turn in enumerate(st.session_state.editable_log):
                with st.container():
                    st.markdown(f"**Turn {i+1}:**")
                    
                    col1_edit, col2_edit = st.columns([1, 1])
                    
                    with col1_edit:
                        # Editable user message
                        user_msg = st.text_area(
                            "User Message",
                            value=turn['user'],
                            key=f"user_edit_{i}",
                            height=100
                        )
                    
                    with col2_edit:
                        # Editable bot message
                        bot_msg = st.text_area(
                            "Bot Message", 
                            value=turn['bot'],
                            key=f"bot_edit_{i}",
                            height=100
                        )
                    
                    # Delete button for this turn
                    if st.button(f"🗑️ Delete Turn {i+1}", key=f"delete_{i}"):
                        st.session_state.editable_log.pop(i)
                        st.rerun()
                    
                    edited_log.append({
                        "user": user_msg,
                        "bot": bot_msg,
                        "privacy": turn.get('privacy')  # Preserve privacy info if any
                    })
                    
                    st.divider()
            
            # Action buttons for edit mode
            col_save, col_cancel, col_export = st.columns([1, 1, 1])
            
            with col_save:
                if st.button("💾 Save Changes"):
                    st.session_state.conversation_log = edited_log.copy()
                    st.session_state.edit_mode = False
                    st.success("✅ Changes saved!")
                    st.rerun()
            
            with col_cancel:
                if st.button("❌ Cancel Editing"):
                    st.session_state.edit_mode = False
                    st.rerun()
            
            with col_export:
                if st.button("📥 Export Edited"):
                    st.download_button(
                        label="Download JSON",
                        data=json.dumps(edited_log, indent=2),
                        file_name=f"edited_conversation_log_{st.session_state.current_step}.json",
                        mime="application/json"
                    )
        
        else:
            # Regular conversation display (non-editable) with scrollable container
            # Add custom CSS for scrollable container
            st.markdown(f"""
            <style>
            .conversation-container {{
                max-height: {st.session_state.conversation_height}px;
                overflow-y: auto;
                border: 2px solid var(--border-color);
                border-radius: 8px;
                padding: 15px;
                background-color: var(--container-bg);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }}
            .conversation-container::-webkit-scrollbar {{
                width: 10px;
            }}
            .conversation-container::-webkit-scrollbar-track {{
                background: var(--sidebar-bg);
                border-radius: 5px;
            }}
            .conversation-container::-webkit-scrollbar-thumb {{
                background: var(--border-color);
                border-radius: 5px;
            }}
            .conversation-container::-webkit-scrollbar-thumb:hover {{
                background: var(--primary-button);
            }}
            .conversation-container p {{
                color: var(--text-color);
                margin: 8px 0;
                line-height: 1.5;
            }}
            .conversation-container strong {{
                color: var(--text-color);
            }}
            .user-message p {{
                color: var(--text-color);
                margin: 0;
            }}
            .bot-message p {{
                color: var(--text-color);
                margin: 0;
            }}
            .privacy-warning {{
                background-color: var(--privacy-warning-bg);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 12px;
                margin: 10px 0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }}
            .privacy-warning p {{
                color: var(--privacy-warning-text);
                margin: 5px 0;
            }}
            .privacy-warning strong {{
                color: var(--privacy-warning-text);
            }}
            .user-message {{
                background-color: var(--user-msg-bg);
                border-left: 4px solid var(--primary-button);
                padding: 10px;
                margin: 8px 0;
                border-radius: 4px;
            }}
            .bot-message {{
                background-color: var(--bot-msg-bg);
                border-left: 4px solid var(--secondary-button);
                padding: 10px;
                margin: 8px 0;
                border-radius: 4px;
            }}
            .scroll-to-bottom {{
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: var(--primary-button);
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                display: none;
                z-index: 1000;
            }}
            .scroll-to-bottom:hover {{
                background-color: var(--primary-button-hover);
            }}
            </style>
            <script>
            function scrollToBottom() {{
                const container = document.querySelector('.conversation-container');
                if (container) {{
                    container.scrollTop = container.scrollHeight;
                }}
            }}
            
            // Auto-scroll to bottom when new content is added
            const observer = new MutationObserver(function(mutations) {{
                mutations.forEach(function(mutation) {{
                    if (mutation.type === 'childList') {{
                        scrollToBottom();
                    }}
                }});
            }});
            
            // Start observing when the page loads
            window.addEventListener('load', function() {{
                const container = document.querySelector('.conversation-container');
                if (container) {{
                    observer.observe(container, {{ childList: true, subtree: true }});
                    scrollToBottom();
                }}
            }});
            </script>
            """, unsafe_allow_html=True)
            
            # Create scrollable container for conversation
            conversation_html = '<div class="conversation-container">'
            
            for i, turn in enumerate(st.session_state.conversation_log):
                conversation_html += f'<div style="margin-bottom: 20px;">'
                
                # User message with styling
                conversation_html += f'<div class="user-message">'
                conversation_html += f'<p><strong>👤 User:</strong> {turn["user"]}</p>'
                conversation_html += '</div>'
                
                # Bot message with styling
                conversation_html += f'<div class="bot-message">'
                conversation_html += f'<p><strong>🤖 Bot:</strong> {turn["bot"]}</p>'
                conversation_html += '</div>'
                
                # Add privacy warning if present
                if turn.get('privacy'):
                    privacy_info = turn['privacy']
                    conversation_html += f'<div class="privacy-warning">'
                    conversation_html += f'<p><strong>⚠️ Privacy Warning:</strong></p>'
                    conversation_html += f'<p><strong>Type:</strong> {privacy_info["type"]}</p>'
                    conversation_html += f'<p><strong>Explanation:</strong> {privacy_info["explanation"]}</p>'
                    
                    if privacy_info.get('suggestion'):
                        conversation_html += f'<p><strong>Suggestion:</strong> {privacy_info["suggestion"]}</p>'
                        if privacy_info.get('used_suggestion'):
                            conversation_html += '<p style="color: var(--primary-button);"><strong>✅ User accepted the suggestion</strong></p>'
                        else:
                            conversation_html += '<p style="color: var(--secondary-button);"><strong>⚠️ User proceeded with original text</strong></p>'
                    else:
                        conversation_html += '<p style="color: var(--danger-button);"><strong>⚠️ User proceeded despite privacy warning</strong></p>'
                    conversation_html += '</div>'
                
                conversation_html += '</div>'
                
                # Add separator between turns (except for the last one)
                if i < len(st.session_state.conversation_log) - 1:
                    conversation_html += '<hr style="border: 1px solid var(--border-color); margin: 20px 0;">'
            
            conversation_html += '</div>'
            
            # Display the conversation in the scrollable container
            st.markdown(conversation_html, unsafe_allow_html=True)
            
            # Add scroll to bottom button
            col1_stats, col2_stats, col3_stats = st.columns([2, 1, 1])
            
            with col1_stats:
                st.caption(f'<p style="color: #ffffff;"><strong>📊 Showing {len(st.session_state.conversation_log)} messages • Scroll to see more</strong></p>', unsafe_allow_html=True)
            
            with col2_stats:
                if st.button("⬇️ Scroll to Bottom", help="Scroll to the latest message"):
                    st.markdown("""
                    <script>
                    scrollToBottom();
                    </script>
                    """, unsafe_allow_html=True)
            
            with col3_stats:
                if st.button("🔄 Auto-scroll", help="Toggle auto-scroll to latest messages"):
                    st.markdown("""
                    <script>
                    // Toggle auto-scroll functionality
                    if (window.autoScrollEnabled === undefined) {
                        window.autoScrollEnabled = true;
                    } else {
                        window.autoScrollEnabled = !window.autoScrollEnabled;
                    }
                    </script>
                    """, unsafe_allow_html=True)
    else:
        st.info("💡 Start a conversation by typing a message below!")
    
    # Chat input (now below the conversation)
    st.subheader("💭 Type Your Message")
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
            st.markdown(f'<p style="color: #ffffff;"><strong>**Original Message:**</strong></p>', unsafe_allow_html=True)
            st.text_area("Original Message", value=warning['original'], height=100, disabled=True, key="original_msg", label_visibility="collapsed")
            
            st.markdown(f'<p style="color: #ffffff;"><strong>Issue Type:</strong> {warning["type"]}</p>', unsafe_allow_html=True)
            st.markdown(f'<p style="color: #ffffff;"><strong>Explanation:</strong> {warning["explanation"]}</p>', unsafe_allow_html=True)
        
        with col2_warning:
            if warning['suggestion']:
                st.markdown(f'<p style="color: #ffffff;"><strong>**Suggested Safer Text:**</strong></p>', unsafe_allow_html=True)
                st.text_area("Suggested Safer Text", value=warning['suggestion'], height=100, disabled=True, key="suggested_msg", label_visibility="collapsed")
                
                st.markdown(f'<p style="color: #ffffff;"><strong>**Choose your action:**</strong></p>', unsafe_allow_html=True)
                
                if st.button("✅ Accept Suggestion", type="primary"):
                    st.session_state.privacy_accepted = True
                    # Re-process the message with the suggestion
                    with st.spinner("Processing with suggested text..."):
                        chat(warning['original'], True)
                    st.rerun()
                
                if st.button("⚠️ Proceed with Original"):
                    st.session_state.privacy_accepted = False
                    # Re-process the message with original text, skipping privacy check
                    with st.spinner("Processing with original text..."):
                        chat(warning['original'], False, True)
                    st.rerun()
            else:
                st.warning("No suggestion available")
                if st.button("⚠️ Proceed Anyway"):
                    st.session_state.privacy_accepted = False
                    # Re-process the message with original text, skipping privacy check
                    with st.spinner("Processing with original text..."):
                        chat(warning['original'], False, True)
                    st.rerun()

if __name__ == "__main__":
    main() 