# Privacy-Aware Data Collection System

This system provides a user-friendly interface for collecting data while protecting privacy through real-time detection and synthesis of sensitive information.

## Features

- Interactive data collection forms
- Real-time privacy detection using LLM
- Automatic data synthesis for sensitive information
- Modern, responsive UI
- Secure data handling

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
Create a `.env` file with:
```
OPENAI_API_KEY=your_api_key_here
```

3. Start the backend server:
```bash
uvicorn backend.main:app --reload
```

4. Start the frontend development server:
```bash
cd frontend
npm install
npm start
```

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. Fill out the data collection form
3. The system will automatically detect and highlight potentially sensitive information
4. View the synthesized version of your data in real-time

## Security

- All sensitive data is processed locally
- No data is stored permanently
- Real-time privacy detection and synthesis 