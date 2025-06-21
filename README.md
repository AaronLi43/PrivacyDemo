# Privacy Demo Chatbot

A Streamlit-based chatbot application with privacy detection capabilities for data collection and research purposes.

## Features

- 🤖 **AI Chatbot**: Powered by Google Gemini API
- 🔒 **Privacy Detection**: Real-time privacy leakage detection in user messages
- 📊 **Data Collection**: Built-in conversation logging and export functionality
- 🎯 **Dual Modes**: 
  - **Naive Mode**: Regular chatbot without privacy warnings
  - **Featured Mode**: Privacy detection enabled with warnings and suggestions
- 📁 **Question Upload**: Support for uploading JSON files with predefined questions
- 📈 **Statistics**: Real-time conversation metrics and privacy warning counts

## Setup

### Prerequisites

- Python 3.7+
- Google Gemini API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd PrivacyDemo
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure your Gemini API key using **one of these methods**:

#### Method 1: .env File (Recommended for Development)
Create a `.env` file in the project root:

**Option A: Use the helper script**
```bash
python setup_env.py
```

**Option B: Manual creation**
```bash
# Create .env file
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

Or manually create `.env` file with this content:
```env
# Gemini API Configuration
# Get your API key from: https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_api_key_here
```

**Security Note**: The `.env` file is automatically ignored by git, and no part of your API key will be displayed on screen.

#### Method 2: Environment Variable
```bash
# Windows
set GEMINI_API_KEY=your_api_key_here

# Linux/Mac
export GEMINI_API_KEY=your_api_key_here
```

#### Method 3: Local Secrets File
Edit `.streamlit/secrets.toml`:
```toml
GEMINI_API_KEY = "your_api_key_here"
```

#### Method 4: Streamlit Cloud (For Deployment)
Add the secret in your Streamlit Cloud deployment settings.

#### Get Your API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy and paste it using one of the methods above

### Running Locally

```bash
streamlit run app.py
```

The application will be available at `http://localhost:8501`

## Deployment

### Streamlit Cloud

1. Push your code to GitHub
2. Go to [share.streamlit.io](https://share.streamlit.io)
3. Connect your GitHub repository
4. Set the `GEMINI_API_KEY` secret in the deployment settings
5. Deploy!

### Other Platforms

The app can be deployed on any platform that supports Streamlit:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS/GCP/Azure with containerization

## Usage

1. **Select Mode**: Choose between "naive" (regular chatbot) or "featured" (privacy detection enabled)
2. **Upload Questions** (optional): Upload a JSON file with predefined questions
3. **Start Chatting**: Type messages in the chat interface
4. **View Privacy Warnings**: In featured mode, privacy issues will be highlighted with suggestions
5. **Export Data**: Download conversation logs as JSON files for analysis
6. **Test API Connection**: Use the test button in the sidebar to verify your API key works

## Data Collection

The application logs all conversations including:
- User messages
- Bot responses
- Privacy warnings (if any)
- Timestamps and conversation flow

Data can be exported as JSON files for research and analysis purposes.

## Configuration

- **API Key**: Supports multiple configuration methods (see Setup section)
  - Priority order: `.env` file → Environment variable → Streamlit secrets → `.streamlit/secrets.toml`
- **Port**: Default port is 8501 (configurable in `.streamlit/config.toml`)
- **Session State**: All conversation data is stored in Streamlit session state
- **Security**: API keys are never displayed on screen, only configuration status is shown

## Troubleshooting

### API Key Issues
- **"API key not configured"**: Follow the setup instructions above
- **"API connection failed"**: Check your internet connection and API key validity
- **"Could not parse response"**: Usually indicates an invalid API key or quota exceeded

### Common Solutions
1. Verify your API key is correct and active
2. Check your internet connection
3. Ensure you have sufficient API quota
4. Try the "Test API Connection" button in the app

## File Structure

```
PrivacyDemo/
├── app.py                 # Main Streamlit application
├── requirements.txt       # Python dependencies
├── .env                   # Environment variables (git-ignored)
├── .streamlit/
│   ├── config.toml       # Streamlit configuration
│   └── secrets.toml      # Local secrets (create this file)
├── README.md             # This file
└── frontend/             # Legacy frontend (not used)
```

**Note**: The `.env` file is automatically ignored by git for security.

## Privacy and Ethics

This application is designed for research and educational purposes. Please ensure:
- Users are informed about data collection
- Appropriate consent is obtained
- Data is handled according to relevant privacy regulations
- API keys and sensitive data are properly secured

## Support

For issues or questions, please refer to the Streamlit documentation or create an issue in the repository. 