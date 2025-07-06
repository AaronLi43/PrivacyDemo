# 🔒 Privacy Demo Chatbot - Reconstructed

This project has been reconstructed into two versions to address the `st.markdown` code display issues:

1. **JavaScript Frontend + Flask Backend** - Modern web interface
2. **Streamlit App** - Simplified version without problematic markdown

## 📁 Project Structure

```
PrivacyDemo/
├── frontend/                    # JavaScript Frontend
│   ├── index.html              # Main interface
│   ├── styles.css              # Styling
│   ├── script.js               # Core functionality
│   └── api.js                  # API communication
├── backend_server.py           # Flask backend server
├── streamlit_app.py            # Streamlit version
├── backend_requirements.txt    # Backend dependencies
├── streamlit_requirements.txt  # Streamlit dependencies
├── app.py                      # Original app (for reference)
└── requirements.txt            # Original requirements
```

## 🚀 Quick Start

### Option 1: JavaScript Frontend + Flask Backend

1. **Install backend dependencies:**
   ```bash
   pip install -r backend_requirements.txt
   ```

2. **Set up Gemini API key:**
   ```bash
   # Windows
   set GEMINI_API_KEY=your_api_key_here
   
   # Linux/Mac
   export GEMINI_API_KEY=your_api_key_here
   ```

3. **Start the backend server:**
   ```bash
   python backend_server.py
   ```

4. **Access the application:**
   - Open your browser and go to `http://localhost:5000`
   - The Flask server serves both the API and the frontend

### Option 2: Streamlit App

1. **Install Streamlit dependencies:**
   ```bash
   pip install -r streamlit_requirements.txt
   ```

2. **Set up Gemini API key:**
   ```bash
   # Windows
   set GEMINI_API_KEY=your_api_key_here
   
   # Linux/Mac
   export GEMINI_API_KEY=your_api_key_here
   ```

3. **Run the Streamlit app:**
   ```bash
   streamlit run streamlit_app.py
   ```

4. **Access the application:**
   - Open your browser and go to the URL shown in the terminal (usually `http://localhost:8501`)

## 🔧 Features

Both versions maintain the core functionality of the original app:

### 🤖 Chat Interface
- Real-time conversation with Gemini AI
- Message history display
- Responsive design

### 🔒 Privacy Detection
- **Naive Mode**: Basic chatbot with editing capabilities
- **Neutral Mode**: Export without modifications
- **Featured Mode**: Privacy analysis and suggestions

### 📊 Privacy Analysis
- Automatic detection of privacy issues
- Interactive suggestions for safer alternatives
- User choice management for privacy decisions

### 📁 File Management
- Upload questions from JSON files
- Export conversation logs
- Return conversation logs for analysis

### 📈 Statistics & Monitoring
- Real-time conversation statistics
- API connection status
- Privacy issue tracking

## 🎨 Key Improvements

### JavaScript Frontend
- **Modern UI**: Clean, responsive design with CSS Grid and Flexbox
- **Interactive Elements**: Real-time updates, animations, and smooth transitions
- **Better UX**: Intuitive navigation, loading states, and error handling
- **Modular Architecture**: Separated concerns with dedicated API layer
- **Local Storage**: Persistent state management
- **Privacy Popups**: Interactive privacy issue resolution

### Streamlit App
- **Simplified Display**: Avoids problematic `st.markdown` for code
- **Clean Interface**: Uses native Streamlit components
- **Better Error Handling**: Graceful API error management
- **Responsive Layout**: Optimized for different screen sizes

## 🔌 API Endpoints

The Flask backend provides these REST API endpoints:

- `POST /api/chat` - Send chat messages
- `POST /api/privacy_detection` - Detect privacy issues
- `POST /api/analyze_log` - Analyze conversation log
- `POST /api/apply_privacy_correction` - Apply privacy corrections
- `POST /api/upload_questions` - Upload questions file
- `POST /api/upload_return` - Upload return log
- `GET /api/test_connection` - Test API connection
- `POST /api/set_mode` - Set application mode
- `POST /api/reset` - Reset conversation
- `POST /api/export` - Export data
- `GET /api/status` - Get application status

## 🛠️ Configuration

### Environment Variables
- `GEMINI_API_KEY`: Your Google Gemini API key

### API Key Setup
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Get API key"
3. Create a new API key
4. Set it as an environment variable

## 📱 Browser Compatibility

The JavaScript frontend supports:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔒 Privacy Features

### Privacy Detection Types
- Personal Identifiable Information (PII)
- Sensitive personal data
- Location data
- Biometric data
- Financial information
- Health information

### Privacy Choices
- **Accept Suggestion**: Use safer alternative text
- **Keep Original**: Maintain original message
- **Undecided**: Defer decision

## 🚨 Troubleshooting

### Common Issues

1. **API Key Not Configured**
   - Ensure `GEMINI_API_KEY` environment variable is set
   - Check API key validity in Google AI Studio

2. **Connection Errors**
   - Verify internet connection
   - Check if Gemini API is accessible
   - Review API quotas and limits

3. **File Upload Issues**
   - Ensure files are valid JSON format
   - Check file size limits (10MB max)
   - Verify file permissions

4. **Streamlit Display Issues**
   - Use the JavaScript frontend for better display
   - Check Streamlit version compatibility
   - Clear browser cache if needed

### Debug Mode

For development, both versions include debug information:
- Console logging in JavaScript frontend
- Detailed error messages in Streamlit
- API response logging in Flask backend

## 📊 Performance

### JavaScript Frontend
- **Fast Loading**: Optimized CSS and JavaScript
- **Efficient Updates**: Minimal DOM manipulation
- **Caching**: Local storage for state persistence
- **Batch Processing**: Efficient API calls

### Streamlit App
- **Streamlined**: Simplified components for better performance
- **Efficient State**: Optimized session state management
- **Fast Rendering**: Minimal markdown usage

## 🔄 Migration from Original

The reconstructed versions maintain full compatibility with the original app:
- Same API endpoints and data formats
- Identical privacy detection logic
- Compatible export formats
- Preserved conversation structure

## 📝 Development

### Adding New Features
1. **JavaScript Frontend**: Modify `script.js` and `api.js`
2. **Streamlit App**: Update `streamlit_app.py`
3. **Backend**: Extend `backend_server.py` with new endpoints

### Styling Changes
- **JavaScript Frontend**: Edit `styles.css`
- **Streamlit App**: Use Streamlit's native styling options

### API Extensions
- Add new endpoints to `backend_server.py`
- Update `api.js` with corresponding methods
- Modify frontend to use new functionality

## 📄 License

This project maintains the same license as the original application.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test both versions
5. Submit a pull request

## 📞 Support

For issues or questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Test with both versions
4. Create an issue with detailed information

---

**Note**: This reconstruction addresses the `st.markdown` code display issues while maintaining all original functionality and improving the user experience. 