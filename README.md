# Privacy Demo Chatbot

A Node.js-based chatbot application with privacy detection capabilities for data collection and research purposes.

## Features

- 🤖 **AI Chatbot**: Powered by OpenAI GPT-4
- 🔒 **Privacy Detection**: Real-time privacy leakage detection in user messages
- 📊 **Data Collection**: Built-in conversation logging and export functionality
- 🎯 **Dual Modes**: 
  - **Naive Mode**: Regular chatbot without privacy warnings but with free editing
  - **Neutral Mode**: Regular chatbot withour privacy warnings or free editing
  - **Featured Mode**: Privacy detection enabled with warnings and suggestions
- 📁 **Question Upload**: Support for uploading JSON files with predefined questions
- 📈 **Statistics**: Real-time conversation metrics and privacy warning counts
- 🌐 **Web Interface**: Modern, responsive web UI

## Setup

### Prerequisites

- Node.js 16+
- OpenAI API key
- AWS credentials (if using S3 uploads)

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd PrivacyDemo
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables by creating a `.env` file:
```env
# OpenAI API Configuration
OPENAI_API_KEY=your_api_key_here

# AWS Configuration (optional, for S3 uploads)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key

# Feature Flags
ENABLE_AUDIT_LLM=true
```

4. Start the development server:
```bash
# Start the server
node server.js
```

Or for development with auto-restart:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Deployment

This application is designed to be deployed with:
- **Backend**: Deployed on Render
- **Frontend**: Deployed on Vercel

See [DEPLOYMENT_README.md](./DEPLOYMENT_README.md) for detailed deployment instructions.

Quick deployment:
```bash
# Run the deployment script
chmod +x deploy.sh
./deploy.sh
```

## Usage

1. **Select Mode**: Choose between "naive" (regular chatbot), "neutral" (balanced), or "featured" (privacy detection enabled)
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
  - Priority order: `.env` file → Environment variable
- **Port**: Default port is 3000 (configurable via PORT environment variable)
- **Session State**: All conversation data is stored in server memory
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
├── server.js              # Main Express server application
├── package.json           # Node.js dependencies
├── .env                   # Environment variables (create this file)
├── frontend/              # Static web files
│   ├── index.html         # Main HTML page
│   ├── script.js          # Frontend JavaScript
│   ├── styles.css         # CSS styles
│   └── api.js            # API communication
├── uploads/               # File upload directory
├── uploaded_logs/         # Returned conversation logs
├── README.md             # This file
└── Dockerfile            # Docker configuration (optional)
```

**Note**: The `.env` file is automatically ignored by git for security. You need to create this file yourself.

## Privacy and Ethics

This application is designed for research and educational purposes. Please ensure:
- Users are informed about data collection
- Appropriate consent is obtained
- Data is handled according to relevant privacy regulations
- API keys and sensitive data are properly secured

## Support

For issues or questions, please refer to the Node.js documentation or create an issue in the repository.

## 📤 Exporting and Returning Conversation Logs

- After chatting, use the export button to download your conversation log as a JSON file.
- To send your log back to the server/owner:
  1. Go to the sidebar section "Return Your Conversation Log".
  2. Upload your exported JSON file using the uploader.
  3. You will see a success message when your file is received.

Uploaded logs are saved to the `uploaded_logs/` directory on the server.

## 🔑 API Key Setup

See the in-app sidebar for instructions on configuring your OpenAI API key.

## 🛡️ Security Notes
- Use HTTPS in production.
- Never expose your API key in public.
- Regularly clean up the `uploaded_logs/` directory as needed. 