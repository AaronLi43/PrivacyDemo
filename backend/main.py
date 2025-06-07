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
model = genai.GenerativeModel("models/gemini-2.0-flash")

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
        
        detection_response = model.generate_content(
            detection_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0,
                max_output_tokens=1000
            )
        )
        
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

        # Generate synthetic alternatives for each sensitive part
        for part in sensitive_parts:
            synthesis_prompt = f"""
            Replace the following sensitive information with a synthetic alternative while maintaining the same context and meaning:
            Original: {part['text']}
            Type: {part['type']}
            
            Return only the synthetic replacement text.
            """
            
            synthesis_response = model.generate_content(
                synthesis_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0,
                    max_output_tokens=1000
                )
            )
            part['synthesized_text'] = synthesis_response.text.strip()

        # Generate the complete synthesized text
        synthesized_text = data.content
        for part in sensitive_parts:
            synthesized_text = synthesized_text.replace(part['text'], part['synthesized_text'])
        
        return PrivacyCheckResponse(
            original_text=data.content,
            sensitive_parts=sensitive_parts,
            synthesized_text=synthesized_text
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 