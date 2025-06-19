import os
import json
import requests
from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Dict, Any

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state
questions = []
conversation_log = []
mode = "naive"  # or "featured"

@app.post("/api/upload_questions")
async def upload_questions(file: UploadFile = File(...)):
    global questions
    content = await file.read()
    questions = json.loads(content)
    return {"status": "ok", "count": len(questions)}

@app.post("/api/set_mode")
async def set_mode(data: Dict[str, str]):
    global mode
    mode = data.get("mode", "naive")
    return {"status": "ok", "mode": mode}

# Gemini LLM call for chatbot reply
def gemini_chatbot_reply(history: List[Dict[str, str]], user_message: str) -> str:
    prompt = """
You are a helpful chatbot. Continue the conversation based on the following history and the user's latest message.

Conversation history:
"""
    for turn in history:
        prompt += f"User: {turn['user']}\nBot: {turn['bot']}\n"
    prompt += f"User: {user_message}\nBot:"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    headers = {"Content-Type": "application/json"}
    resp = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(payload))
    if resp.ok:
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            return "[Error: Could not parse Gemini response]"
    else:
        return "[Error: Gemini API call failed]"

# Gemini privacy detection call
def gemini_privacy_detection(user_message: str) -> Dict[str, Any]:
    prompt = f'''
You are a privacy expert. Analyze the following user message for any potential privacy leakage. If there is a privacy issue, identify the type (e.g., PII, sensitive data, etc.) and suggest a safer alternative phrasing. Respond in JSON with the following fields:\n- "leakage": true/false\n- "type": (type of privacy issue, or null)\n- "suggestion": (suggested safer text, or null)\n- "explanation": (brief explanation, or null)\n\nUser message: "{user_message}"
'''
    payload = {
        "contents": [{"parts": [{"text": prompt}]}]
    }
    headers = {"Content-Type": "application/json"}
    resp = requests.post(GEMINI_API_URL, headers=headers, data=json.dumps(payload))
    if resp.ok:
        data = resp.json()
        try:
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            # Try to extract JSON from the response
            json_start = text.find('{')
            json_end = text.rfind('}') + 1
            if json_start != -1 and json_end != -1:
                return json.loads(text[json_start:json_end])
            else:
                return {"leakage": False, "type": None, "suggestion": None, "explanation": "Could not parse Gemini response."}
        except Exception:
            return {"leakage": False, "type": None, "suggestion": None, "explanation": "Could not parse Gemini response."}
    else:
        return {"leakage": False, "type": None, "suggestion": None, "explanation": "Gemini API call failed."}

@app.post("/api/chat")
async def chat(data: Dict[str, Any]):
    global conversation_log, questions, mode
    user_message = data.get("message", "")
    step = data.get("step", 0)
    # Build conversation history for LLM
    history = conversation_log[-5:]  # last 5 turns for context
    # Get bot reply from Gemini
    bot_message = gemini_chatbot_reply(history, user_message)
    privacy = None
    if mode == "featured":
        privacy_result = gemini_privacy_detection(user_message)
        if privacy_result.get("leakage"):
            privacy = {
                "original": user_message,
                "type": privacy_result.get("type"),
                "suggestion": privacy_result.get("suggestion"),
                "explanation": privacy_result.get("explanation"),
            }
    conversation_log.append({"user": user_message, "bot": bot_message, "privacy": privacy})
    return {"bot": bot_message, "privacy": privacy, "step": step + 1}

@app.post("/api/finish")
async def finish():
    global conversation_log
    log = conversation_log.copy()
    conversation_log = []
    return {"log": log} 