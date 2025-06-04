from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import json
from dotenv import load_dotenv
import google.generativeai as genai


load_dotenv()

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
model = genai.GenerativeModel('models/gemini-2.0-flash')

class FormData(BaseModel):
    content: str
    type: str  # "text" or "multiple_choice"

class PrivacyCheckResponse(BaseModel):
    original_text: str
    sensitive_parts: List[dict]
    synthesized_text: str

@app.post("/api/check-privacy", response_model=PrivacyCheckResponse)
async def check_privacy(data: FormData):
    try:
        # Detect sensitive information
        detection_prompt = f"""
        Analyze the following text and identify any potentially sensitive information:
        {data.content}
        
        Return a JSON array of objects with the following structure:
        {{
            "text": "sensitive text found",
            "type": "type of sensitive information (e.g., 'personal', 'financial', 'location')",
            "start_index": start_index,
            "end_index": end_index
        }}
        """
        
        detection_response = model.generate_content(detection_prompt)
        
        # Parse the response using json.loads
        try:
            sensitive_parts = json.loads(detection_response.text)
        except json.JSONDecodeError:
            # If the response isn't valid JSON, try to extract JSON from the text
            content = detection_response.text
            # Find the first [ and last ] in the content
            start = content.find('[')
            end = content.rfind(']') + 1
            if start >= 0 and end > start:
                sensitive_parts = json.loads(content[start:end])
            else:
                sensitive_parts = []
        
        # Synthesize alternative text
        synthesis_prompt = f"""
        Replace the sensitive information in the following text with synthetic alternatives while maintaining the same context and meaning:
        {data.content}
        
        Return only the synthesized text.
        """
        
        synthesis_response = model.generate_content(synthesis_prompt)
        
        return PrivacyCheckResponse(
            original_text=data.content,
            sensitive_parts=sensitive_parts,
            synthesized_text=synthesis_response.text
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 