# Deployment Guide

This guide explains how to deploy the Privacy Demo application with the backend and frontend hosted separately.

## Current Setup

- **Backend**: Deployed on Render at `https://privacydemo.onrender.com`
- **Frontend**: Needs to be hosted separately (GitHub Pages, Netlify, Vercel, etc.)

## Backend Deployment (Render)

The backend is already deployed and configured to:
- Accept CORS requests from any origin
- Provide API endpoints only (no static file serving)
- Handle all chatbot functionality

### Backend API Endpoints

- `GET /` - Health check
- `POST /api/chat` - Chat functionality
- `POST /api/privacy_detection` - Privacy detection
- `POST /api/test_connection` - Test API connection
- `POST /api/set_mode` - Set conversation mode
- `POST /api/reset` - Reset conversation
- `POST /api/export` - Export conversation data
- `POST /api/upload-to-s3` - Upload data to S3

## Frontend Deployment Options

### Option 1: GitHub Pages (Recommended)

1. **Create a new repository** for the frontend
2. **Upload frontend files** to the repository
3. **Enable GitHub Pages**:
   - Go to repository Settings
   - Scroll to "Pages" section
   - Select "Deploy from a branch"
   - Choose "main" branch and "/ (root)" folder
   - Save

4. **Your frontend will be available at**: `https://yourusername.github.io/repository-name`

### Option 2: Netlify

1. **Drag and drop** the `frontend` folder to [Netlify](https://netlify.com)
2. **Or connect your GitHub repository**
3. **Your site will be available at**: `https://your-site-name.netlify.app`

### Option 3: Vercel

1. **Connect your GitHub repository** to [Vercel](https://vercel.com)
2. **Set the root directory** to `frontend`
3. **Deploy**

## Testing the Connection

Use the provided test file to verify your backend connection:

1. **Open** `frontend/test-backend-connection.html` in your browser
2. **Click** "Test Basic Connection" to verify backend is accessible
3. **Click** "Test API Endpoints" to verify API functionality
4. **Click** "Test Chat API" to verify chat functionality

## Troubleshooting

### CORS Issues
- The backend is configured to accept requests from any origin
- If you encounter CORS errors, check that the backend is running

### API Connection Issues
- Verify the backend URL in `frontend/api.js` is correct
- Test the backend health check: `https://privacydemo.onrender.com/`
- Check browser console for error messages

### File Upload Issues
- Ensure your backend has the required environment variables
- Check that the `uploads/` directory exists on the server

## Environment Variables (Backend)

Make sure your Render deployment has these environment variables:

```env
OPENAI_API_KEY=your_openai_api_key
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
ENABLE_AUDIT_LLM=true
```

## Next Steps

1. **Deploy your frontend** using one of the options above
2. **Test the connection** using the test file
3. **Update any hardcoded URLs** in your frontend if needed
4. **Share your frontend URL** for users to access the study

## Local Development

For local development, you can still run both frontend and backend locally:

```bash
# Terminal 1: Start backend
cd backend
npm start

# Terminal 2: Serve frontend (using any static server)
cd frontend
npx http-server -p 8080
```

Then access your frontend at `http://localhost:8080` 