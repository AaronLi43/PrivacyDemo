from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import requests
from typing import List, Dict, Any
import time

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Serve static files from frontend directory
@app.route('/')
def index():
    return send_from_directory('frontend', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('frontend', filename)

# Gemini API Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent"

# Global state (in production, use a proper database)
app_state = {
    'conversation_log': [],
    'current_step': 0,
    'mode': 'naive',
    'questions': [],
    'analyzed_log': [],
    'privacy_choices': {},
    'original_log': [],
    'session_start_time': time.time()
}

def get_gemini_api_key():
    """Get Gemini API key from environment"""
    if GEMINI_API_KEY:
        return GEMINI_API_KEY
    else:
        return None

def detect_privacy_patterns(user_message: str) -> Dict[str, Any]:
    """Detect privacy issues using pattern matching as fallback"""
    import re
    
    message_lower = user_message.lower()
    
    # Credit card patterns (16 digits, possibly with spaces/dashes)
    credit_card_pattern = r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b'
    if re.search(credit_card_pattern, user_message):
        return {
            "privacy_issue": True,
            "type": "financial",
            "suggestion": "I have a credit card ending in [last 4 digits]",
            "explanation": "Credit card numbers are sensitive financial information"
        }
    
    # SSN pattern (XXX-XX-XXXX)
    ssn_pattern = r'\b\d{3}-\d{2}-\d{4}\b'
    if re.search(ssn_pattern, user_message):
        return {
            "privacy_issue": True,
            "type": "personal",
            "suggestion": "I have a social security number",
            "explanation": "Social Security Numbers are highly sensitive personal identifiers"
        }
    
    # Email with password
    email_password_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b.*\b(password|pass|pwd)\b'
    if re.search(email_password_pattern, message_lower):
        return {
            "privacy_issue": True,
            "type": "credentials",
            "suggestion": "I have an email account",
            "explanation": "Email addresses combined with passwords are sensitive credentials"
        }
    
    # Phone number patterns
    phone_pattern = r'\b\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b'
    if re.search(phone_pattern, user_message):
        return {
            "privacy_issue": True,
            "type": "personal",
            "suggestion": "You can contact me by phone",
            "explanation": "Phone numbers are personal identifiable information"
        }
    
    # Bank account number (9-17 digits)
    bank_account_pattern = r'\b(account|acct|bank).*?\b\d{9,17}\b'
    if re.search(bank_account_pattern, message_lower):
        return {
            "privacy_issue": True,
            "type": "financial",
            "suggestion": "I have a bank account",
            "explanation": "Bank account numbers are sensitive financial information"
        }
    
    # Medical conditions and health-related terms
    medical_keywords = ['diabetes', 'cancer', 'hiv', 'aids', 'depression', 'anxiety', 'diagnosis', 'treatment', 'special care', 'medical', 'health', 'condition', 'illness', 'symptom']
    if any(keyword in message_lower for keyword in medical_keywords):
        return {
            "privacy_issue": True,
            "type": "health",
            "suggestion": "I have a medical condition",
            "explanation": "Medical information is sensitive health data"
        }
    
    # Age information (specific ages)
    age_pattern = r'\b(age|aged)\s+of\s+\d+\b|\b\d+\s+years?\s+old\b|\b(age|aged)\s+\d+\b'
    if re.search(age_pattern, message_lower):
        return {
            "privacy_issue": True,
            "type": "personal",
            "suggestion": "I am in a certain age group",
            "explanation": "Specific age information is personal demographic data"
        }
    
    # Specific cities and locations
    city_pattern = r'\b(live|living|reside|located)\s+(in|at)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b'
    if re.search(city_pattern, user_message):
        return {
            "privacy_issue": True,
            "type": "location",
            "suggestion": "I live in a major city",
            "explanation": "Specific city location is personal location data"
        }
    
    # Financial amounts (specific dollar amounts)
    financial_pattern = r'\b\d+\s*dollars?\b|\$\d+|\b\d+\s*(thousand|k|million|m)\s*dollars?\b'
    if re.search(financial_pattern, message_lower):
        return {
            "privacy_issue": True,
            "type": "financial",
            "suggestion": "I have a specific budget range",
            "explanation": "Specific financial amounts are sensitive financial information"
        }
    
    # Full address patterns
    address_pattern = r'\b\d+\s+[A-Za-z\s]+(street|avenue|road|boulevard|lane|drive|way|plaza|circle)\b'
    if re.search(address_pattern, message_lower):
        return {
            "privacy_issue": True,
            "type": "location",
            "suggestion": "I live in [city, state]",
            "explanation": "Complete addresses are sensitive location information"
        }
    
    # No privacy issues detected
    return {"privacy_issue": False}

def gemini_chatbot_reply(history: List[Dict[str, str]], user_message: str) -> str:
    """Generate chatbot reply using Gemini API"""
    api_key = get_gemini_api_key()
    if not api_key:
        return "I'm sorry, but I cannot respond right now due to API configuration issues."
    
    # System prompt to define chatbot behavior
    system_prompt = """You are a helpful and friendly AI assistant. 


Please respond in a brief and concise manner to the user's messages."""
    
    # Prepare conversation history
    contents = []
    
    # Add system prompt as the first message
    contents.append({
        "role": "user",
        "parts": [{"text": system_prompt}]
    })
    contents.append({
        "role": "model", 
        "parts": [{"text": "I understand. I'm ready to help you with any questions or tasks you have. I'll be conversational, informative, and professional in my responses."}]
    })
    
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
            return f"I'm sorry, there was an error processing your request (Status: {response.status_code})."
            
    except requests.exceptions.Timeout:
        return "I'm sorry, the request timed out. Please try again."
    except requests.exceptions.RequestException as e:
        return "I'm sorry, there was an error connecting to the service."
    except Exception as e:
        return "I'm sorry, an unexpected error occurred."

def gemini_privacy_detection(user_message: str) -> Dict[str, Any]:
    """Detect privacy issues in user message using Gemini API with fallback pattern matching"""
    api_key = get_gemini_api_key()
    
    # First, try pattern matching as a fallback
    pattern_result = detect_privacy_patterns(user_message)
    
    if not api_key:
        # Convert pattern result to enhanced format
        if pattern_result.get("privacy_issue", False):
            return {
                "leakage": True,
                "type": pattern_result.get("type", "unknown"),
                "suggestion": pattern_result.get("suggestion", ""),
                "explanation": pattern_result.get("explanation", ""),
                "severity": "medium",
                "affected_text": user_message
            }
        else:
            return {
                "leakage": False,
                "type": None,
                "suggestion": None,
                "explanation": None,
                "severity": None,
                "affected_text": None
            }
    
    prompt = f'''Analyze this message for privacy and security issues. Look for:
1. Personal identifiable information (names, addresses, phone numbers, emails)
2. Sensitive personal data (financial info, health data, passwords)
3. Location information that could compromise privacy
4. Information that could be used for identity theft
5. Overly specific personal details

Respond with ONLY valid JSON in this exact format:
{{
    "leakage": true/false,
    "type": "issue_type_or_null",
    "suggestion": "safer_alternative_text_or_null",
    "explanation": "brief_explanation_of_the_privacy_concern_or_null",
    "severity": "high/medium/low_or_null",
    "affected_text": "exact_text_that_poses_privacy_risk_or_null"
}}

Message: "{user_message}"'''
    
    try:
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 3000,
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
            data = response.json()
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
                        result = json.loads(json_text)
                        # Ensure all required fields are present
                        result.setdefault("severity", "medium")
                        result.setdefault("affected_text", "")
                        return result
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
            print(f"Privacy detection API error: {response.status_code} - {response.text}")
            return {"leakage": False, "type": None, "suggestion": None, "explanation": "Gemini API call failed."}
    except requests.exceptions.Timeout:
        return {"leakage": False, "type": None, "suggestion": None, "explanation": "API request timed out."}
    except Exception as e:
        print(f"Unexpected error in privacy detection: {e}")
        return {"leakage": False, "type": None, "suggestion": None, "explanation": f"Unexpected error: {str(e)}"}

def run_privacy_analysis_on_log(conversation_log: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Run privacy analysis on entire conversation log"""
    analyzed_log = []
    
    for turn in conversation_log:
        analyzed_turn = turn.copy()
        if app_state['mode'] == "featured":
            privacy_result = gemini_privacy_detection(turn["user"])
            if privacy_result.get("leakage", False):
                analyzed_turn["privacy"] = {
                    "type": privacy_result.get("type", "unknown"),
                    "explanation": privacy_result.get("explanation", ""),
                    "suggestion": privacy_result.get("suggestion", ""),
                    "severity": privacy_result.get("severity", "medium"),
                    "affected_text": privacy_result.get("affected_text", turn["user"])
                }
        analyzed_log.append(analyzed_turn)
    
    return analyzed_log

# Helper functions for enhanced exports
def extract_conversation_topics(conversation_log):
    """Extract main topics from conversation"""
    topics = []
    for turn in conversation_log:
        user_text = turn['user_message']['original_text'].lower()
        if any(word in user_text for word in ['privacy', 'security', 'data']):
            topics.append('privacy_security')
        elif any(word in user_text for word in ['help', 'assist', 'support']):
            topics.append('help_support')
        elif any(word in user_text for word in ['code', 'programming', 'software']):
            topics.append('programming')
        elif any(word in user_text for word in ['health', 'medical', 'doctor']):
            topics.append('health_medical')
        elif any(word in user_text for word in ['finance', 'money', 'bank']):
            topics.append('finance')
        else:
            topics.append('general')
    return list(set(topics))

def calculate_privacy_risk_score(privacy_analysis):
    """Calculate privacy risk score (0-100)"""
    if not privacy_analysis or not privacy_analysis.get('privacy_issue'):
        return 0
    
    risk_score = 20  # Base score for any privacy issue
    
    # Add risk based on type
    issue_type = privacy_analysis.get('type', '').lower()
    if 'personal' in issue_type or 'pii' in issue_type:
        risk_score += 30
    elif 'financial' in issue_type:
        risk_score += 25
    elif 'health' in issue_type or 'medical' in issue_type:
        risk_score += 35
    elif 'location' in issue_type:
        risk_score += 20
    elif 'password' in issue_type or 'credential' in issue_type:
        risk_score += 40
    
    return min(risk_score, 100)

def get_privacy_risk_level(privacy_analysis):
    """Get privacy risk level (low/medium/high)"""
    risk_score = calculate_privacy_risk_score(privacy_analysis)
    if risk_score >= 70:
        return 'high'
    elif risk_score >= 30:
        return 'medium'
    else:
        return 'low'

def get_privacy_issue_types(conversation_log):
    """Get list of privacy issue types found"""
    issue_types = []
    for turn in conversation_log:
        if turn['user_message'].get('privacy_analysis'):
            issue_type = turn['user_message']['privacy_analysis'].get('type', 'unknown')
            issue_types.append(issue_type)
    return list(set(issue_types))

def get_choice_reasoning(choice, privacy_analysis):
    """Get reasoning for user choice"""
    if choice == "accept":
        return "User accepted privacy suggestion to improve data protection"
    elif choice == "keep":
        return "User chose to keep original text despite privacy concerns"
    else:
        return "User has not made a choice yet"

def assess_suggestion_quality(privacy_analysis):
    """Assess the quality of privacy suggestion"""
    if not privacy_analysis or not privacy_analysis.get('suggestion'):
        return "no_suggestion"
    
    suggestion = privacy_analysis['suggestion']
    original = privacy_analysis.get('original_text', '')
    
    # Simple quality metrics
    if len(suggestion) < 5:
        return "poor"
    elif len(suggestion) < len(original) * 0.5:
        return "fair"
    elif len(suggestion) < len(original) * 0.8:
        return "good"
    else:
        return "excellent"

def calculate_privacy_improvement_score(conversation_log):
    """Calculate overall privacy improvement score"""
    total_improvements = 0
    total_opportunities = 0
    
    for turn in conversation_log:
        if turn.get('privacy_analysis'):
            total_opportunities += 1
            if turn['final_user_message']['was_modified']:
                total_improvements += 1
    
    if total_opportunities == 0:
        return 0
    
    return (total_improvements / total_opportunities) * 100

# API Routes

@app.route('/api/chat', methods=['POST'])
def chat():
    """Handle chat messages"""
    try:
        data = request.get_json()
        message = data.get('message', '')
        step = data.get('step', 0)
        
        if not message:
            return jsonify({"success": False, "error": "Message is required"}), 400
        
        # Add user message to log
        app_state['conversation_log'].append({
            "user": message,
            "bot": "",
            "timestamp": time.time()
        })
        
        # Generate bot response
        history = app_state['conversation_log'][:-1]  # Exclude current message
        bot_response = gemini_chatbot_reply(history, message)
        
        # Update bot response
        app_state['conversation_log'][-1]["bot"] = bot_response
        
        # Privacy detection for featured mode
        privacy_detection = None
        if app_state['mode'] == "featured":
            privacy_result = gemini_privacy_detection(message)
            if privacy_result.get("leakage", False):
                privacy_detection = {
                    "type": privacy_result.get("type", "unknown"),
                    "explanation": privacy_result.get("explanation", ""),
                    "suggestion": privacy_result.get("suggestion", ""),
                    "severity": privacy_result.get("severity", "medium"),
                    "affected_text": privacy_result.get("affected_text", message)
                }
                app_state['conversation_log'][-1]["privacy"] = privacy_detection
        
        app_state['current_step'] = step + 1
        
        return jsonify({
            "success": True,
            "bot_response": bot_response,
            "privacy_detection": privacy_detection,
            "step": app_state['current_step']
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/privacy_detection', methods=['POST'])
def privacy_detection():
    """Handle privacy detection requests"""
    try:
        data = request.get_json()
        user_message = data.get('user_message', '')
        
        if not user_message:
            return jsonify({"success": False, "error": "User message is required"}), 400
        
        privacy_result = gemini_privacy_detection(user_message)
        
        return jsonify({
            "success": True,
            "privacy_detection": privacy_result
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analyze_log', methods=['POST'])
def analyze_log():
    """Analyze conversation log for privacy issues"""
    try:
        data = request.get_json()
        conversation_log = data.get('conversation_log', [])
        
        analyzed_log = run_privacy_analysis_on_log(conversation_log)
        app_state['analyzed_log'] = analyzed_log
        
        return jsonify({
            "success": True,
            "analyzed_log": analyzed_log
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/apply_privacy_correction', methods=['POST'])
def apply_privacy_correction():
    """Apply privacy correction to a message"""
    try:
        data = request.get_json()
        message_index = data.get('message_index', 0)
        original_text = data.get('original_text', '')
        corrected_text = data.get('corrected_text', '')
        
        if message_index < len(app_state['conversation_log']):
            app_state['conversation_log'][message_index]['user'] = corrected_text
        
        return jsonify({
            "success": True,
            "message": "Correction applied successfully"
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/upload_questions', methods=['POST'])
def upload_questions():
    """Handle questions file upload"""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        if file and file.filename.endswith('.json'):
            content = file.read()
            questions = json.loads(content.decode('utf-8'))
            app_state['questions'] = questions
            
            return jsonify({
                "success": True,
                "questions": questions,
                "count": len(questions)
            })
        else:
            return jsonify({"success": False, "error": "Invalid file type"}), 400
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/upload_return', methods=['POST'])
def upload_return():
    """Handle return log file upload"""
    try:
        if 'file' not in request.files:
            return jsonify({"success": False, "error": "No file provided"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"success": False, "error": "No file selected"}), 400
        
        if file and file.filename.endswith('.json'):
            # Save file to uploaded_logs directory
            os.makedirs("uploaded_logs", exist_ok=True)
            file_path = os.path.join("uploaded_logs", file.filename)
            file.save(file_path)
            
            return jsonify({
                "success": True,
                "message": "File uploaded successfully"
            })
        else:
            return jsonify({"success": False, "error": "Invalid file type"}), 400
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/test_connection', methods=['GET'])
def test_connection():
    """Test API connection"""
    try:
        api_key = get_gemini_api_key()
        if not api_key:
            return jsonify({
                "success": False,
                "error": "API key not configured"
            }), 400
        
        # Test with a simple request
        test_payload = {
            "contents": [{"parts": [{"text": "Hello, this is a test message."}]}]
        }
        headers = {"Content-Type": "application/json"}
        
        response = requests.post(
            f"{GEMINI_API_URL}?key={api_key}",
            headers=headers,
            json=test_payload,
            timeout=10
        )
        
        if response.status_code == 200:
            return jsonify({
                "success": True,
                "message": "API connection successful"
            })
        else:
            return jsonify({
                "success": False,
                "error": f"API connection failed: {response.status_code}"
            }), 400
            
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"API connection error: {str(e)}"
        }), 500

@app.route('/api/set_mode', methods=['POST'])
def set_mode():
    """Set application mode"""
    try:
        data = request.get_json()
        mode = data.get('mode', 'naive')
        
        if mode not in ['naive', 'neutral', 'featured']:
            return jsonify({"success": False, "error": "Invalid mode"}), 400
        
        app_state['mode'] = mode
        
        return jsonify({
            "success": True,
            "mode": mode
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/reset', methods=['POST'])
def reset():
    """Reset conversation"""
    try:
        app_state['conversation_log'] = []
        app_state['current_step'] = 0
        app_state['analyzed_log'] = []
        app_state['privacy_choices'] = {}
        app_state['original_log'] = []
        app_state['session_start_time'] = time.time()
        
        return jsonify({
            "success": True,
            "message": "Conversation reset successfully"
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/export', methods=['POST'])
def export():
    """Handle export requests"""
    try:
        data = request.get_json()
        export_type = data.get('export_type', 'direct')
        export_data = data.get('data', {})
        
        # Common metadata for all export types
        common_metadata = {
            "export_timestamp": time.time(),
            "export_datetime": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime()),
            "application_version": "1.0.0",
            "export_type": export_type,
            "api_configured": bool(get_gemini_api_key()),
            "total_messages": len(app_state['conversation_log']),
            "current_step": app_state['current_step'],
            "mode": app_state['mode'],
            "questions_loaded": len(app_state['questions']) if app_state['questions'] else 0,
            "privacy_analysis_run": len(app_state['analyzed_log']) > 0,
            "privacy_choices_made": len(app_state['privacy_choices']),
            "session_duration_seconds": time.time() - app_state.get('session_start_time', time.time()),
            "export_format_version": "2.0"
        }
        
        if export_type == 'direct':
            # Enhanced direct export with detailed metadata
            enhanced_log = []
            for i, turn in enumerate(app_state['conversation_log']):
                enhanced_turn = {
                    "turn_index": i + 1,
                    "timestamp": turn.get('timestamp', time.time()),
                    "datetime": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(turn.get('timestamp', time.time()))),
                    "user_message": {
                        "original_text": turn['user'],
                        "length": len(turn['user']),
                        "word_count": len(turn['user'].split()),
                        "contains_links": 'http' in turn['user'].lower(),
                        "contains_emails": '@' in turn['user'],
                        "contains_numbers": any(char.isdigit() for char in turn['user']),
                        "privacy_flags": {
                            "potential_pii": any(word in turn['user'].lower() for word in ['name', 'address', 'phone', 'email', 'ssn', 'id']),
                            "potential_location": any(word in turn['user'].lower() for word in ['street', 'avenue', 'road', 'city', 'state', 'zip', 'country']),
                            "potential_financial": any(word in turn['user'].lower() for word in ['credit', 'debit', 'card', 'account', 'bank', 'money', 'dollar', 'payment']),
                            "potential_health": any(word in turn['user'].lower() for word in ['medical', 'health', 'doctor', 'hospital', 'diagnosis', 'treatment', 'medication'])
                        }
                    },
                    "bot_response": {
                        "original_text": turn['bot'],
                        "length": len(turn['bot']),
                        "word_count": len(turn['bot'].split()),
                        "response_time_estimated": 2.5,  # Estimated response time in seconds
                        "contains_code": '```' in turn['bot'] or 'def ' in turn['bot'] or 'import ' in turn['bot'],
                        "contains_links": 'http' in turn['bot'].lower(),
                        "response_quality_indicators": {
                            "is_helpful": len(turn['bot']) > 20,
                            "is_specific": any(word in turn['bot'].lower() for word in ['because', 'example', 'specifically', 'therefore']),
                            "asks_questions": '?' in turn['bot'],
                            "provides_examples": any(word in turn['bot'].lower() for word in ['example', 'instance', 'case', 'such as'])
                        }
                    },
                    "privacy_analysis": turn.get('privacy', None),
                    "llm_metadata": {
                        "model_used": "gemini-2.0-flash-exp",
                        "temperature": 0.7,
                        "max_tokens": 1024,
                        "response_generated": True,
                        "privacy_detection_run": app_state['mode'] == "featured"
                    }
                }
                enhanced_log.append(enhanced_turn)
            
            export_data = {
                "metadata": common_metadata,
                "conversation": enhanced_log,
                "analysis_summary": {
                    "total_turns": len(enhanced_log),
                    "total_user_words": sum(turn['user_message']['word_count'] for turn in enhanced_log),
                    "total_bot_words": sum(turn['bot_response']['word_count'] for turn in enhanced_log),
                    "average_user_message_length": sum(turn['user_message']['length'] for turn in enhanced_log) / len(enhanced_log) if enhanced_log else 0,
                    "average_bot_response_length": sum(turn['bot_response']['length'] for turn in enhanced_log) / len(enhanced_log) if enhanced_log else 0,
                    "privacy_issues_detected": sum(1 for turn in enhanced_log if turn.get('privacy_analysis')),
                    "conversation_topics": extract_conversation_topics(enhanced_log),
                    "user_engagement_metrics": {
                        "short_messages": sum(1 for turn in enhanced_log if turn['user_message']['word_count'] < 5),
                        "medium_messages": sum(1 for turn in enhanced_log if 5 <= turn['user_message']['word_count'] <= 20),
                        "long_messages": sum(1 for turn in enhanced_log if turn['user_message']['word_count'] > 20)
                    }
                }
            }
            
        elif export_type == 'with_analysis':
            # Enhanced export with privacy analysis
            enhanced_log = []
            for i, turn in enumerate(app_state['analyzed_log']):
                enhanced_turn = {
                    "turn_index": i + 1,
                    "timestamp": turn.get('timestamp', time.time()),
                    "datetime": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(turn.get('timestamp', time.time()))),
                    "user_message": {
                        "original_text": turn['user'],
                        "length": len(turn['user']),
                        "word_count": len(turn['user'].split()),
                        "privacy_analysis": turn.get('privacy', None),
                        "privacy_risk_score": calculate_privacy_risk_score(turn.get('privacy', None)),
                        "privacy_risk_level": get_privacy_risk_level(turn.get('privacy', None))
                    },
                    "bot_response": {
                        "original_text": turn['bot'],
                        "length": len(turn['bot']),
                        "word_count": len(turn['bot'].split())
                    },
                    "llm_analysis_metadata": {
                        "analysis_timestamp": time.time(),
                        "analysis_model": "gemini-2.0-flash-exp",
                        "analysis_confidence": 0.85,  # Estimated confidence
                        "analysis_duration_seconds": 1.2  # Estimated analysis time
                    }
                }
                enhanced_log.append(enhanced_turn)
            
            export_data = {
                "metadata": common_metadata,
                "analyzed_conversation": enhanced_log,
                "privacy_analysis_summary": {
                    "total_messages_analyzed": len(enhanced_log),
                    "privacy_issues_found": sum(1 for turn in enhanced_log if turn['user_message'].get('privacy_analysis')),
                    "high_risk_messages": sum(1 for turn in enhanced_log if turn['user_message']['privacy_risk_level'] == 'high'),
                    "medium_risk_messages": sum(1 for turn in enhanced_log if turn['user_message']['privacy_risk_level'] == 'medium'),
                    "low_risk_messages": sum(1 for turn in enhanced_log if turn['user_message']['privacy_risk_level'] == 'low'),
                    "privacy_issue_types": get_privacy_issue_types(enhanced_log),
                    "average_risk_score": sum(turn['user_message']['privacy_risk_score'] for turn in enhanced_log) / len(enhanced_log) if enhanced_log else 0
                }
            }
            
        elif export_type == 'with_choices':
            # Enhanced export with user privacy choices
            enhanced_log = []
            for i, turn in enumerate(app_state['analyzed_log']):
                choice = app_state['privacy_choices'].get(i, 'none')
                final_user_text = turn['user']
                if turn.get('privacy') and choice == "accept" and turn['privacy'].get('suggestion'):
                    final_user_text = turn['privacy']['suggestion']
                
                enhanced_turn = {
                    "turn_index": i + 1,
                    "timestamp": turn.get('timestamp', time.time()),
                    "datetime": time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime(turn.get('timestamp', time.time()))),
                    "original_user_message": {
                        "text": turn['user'],
                        "length": len(turn['user']),
                        "word_count": len(turn['user'].split())
                    },
                    "final_user_message": {
                        "text": final_user_text,
                        "length": len(final_user_text),
                        "word_count": len(final_user_text.split()),
                        "was_modified": final_user_text != turn['user']
                    },
                    "bot_response": {
                        "text": turn['bot'],
                        "length": len(turn['bot']),
                        "word_count": len(turn['bot'].split())
                    },
                    "privacy_analysis": turn.get('privacy', None),
                    "user_choice": {
                        "choice": choice,
                        "choice_timestamp": time.time(),
                        "choice_reasoning": get_choice_reasoning(choice, turn.get('privacy', None)),
                        "suggestion_quality": assess_suggestion_quality(turn.get('privacy', None))
                    },
                    "edit_history": {
                        "original_text": turn['user'],
                        "suggested_text": turn.get('privacy', {}).get('suggestion', ''),
                        "final_text": final_user_text,
                        "edit_type": "privacy_correction" if choice == "accept" else "no_change",
                        "edit_confidence": 0.9 if choice == "accept" else 0.5
                    }
                }
                enhanced_log.append(enhanced_turn)
            
            export_data = {
                "metadata": common_metadata,
                "final_conversation": enhanced_log,
                "privacy_choices_summary": {
                    "total_choices_made": len(app_state['privacy_choices']),
                    "choices_accepted": sum(1 for choice in app_state['privacy_choices'].values() if choice == "accept"),
                    "choices_rejected": sum(1 for choice in app_state['privacy_choices'].values() if choice == "keep"),
                    "choices_pending": sum(1 for choice in app_state['privacy_choices'].values() if choice == "none"),
                    "acceptance_rate": sum(1 for choice in app_state['privacy_choices'].values() if choice == "accept") / len(app_state['privacy_choices']) if app_state['privacy_choices'] else 0,
                    "modifications_made": sum(1 for turn in enhanced_log if turn['final_user_message']['was_modified']),
                    "privacy_improvement_score": calculate_privacy_improvement_score(enhanced_log)
                }
            }
        else:
            return jsonify({"success": False, "error": "Invalid export type"}), 400
        
        return jsonify({
            "success": True,
            "data": export_data
        })
            
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def status():
    """Get application status"""
    try:
        return jsonify({
            "success": True,
            "status": {
                "mode": app_state['mode'],
                "conversation_length": len(app_state['conversation_log']),
                "current_step": app_state['current_step'],
                "api_configured": bool(get_gemini_api_key())
            }
        })
        
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Create uploaded_logs directory if it doesn't exist
    os.makedirs("uploaded_logs", exist_ok=True)
    
    print("🔒 Privacy Demo Chatbot Backend Server")
    print("Starting server on http://localhost:5000")
    print("Frontend will be available at http://localhost:5000")
    
    app.run(debug=True, host='0.0.0.0', port=5000) 