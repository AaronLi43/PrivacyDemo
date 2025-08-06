# Deployment Guide: Backend on Render, Frontend on Vercel

This guide explains how to deploy your Privacy Demo application with the backend on Render and frontend on Vercel.

## Prerequisites

- GitHub repository with your code
- Render account (free tier available)
- Vercel account (free tier available)
- OpenAI API key
- AWS credentials (if using S3 uploads)

## Step 1: Deploy Backend on Render

### 1.1 Connect to GitHub
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository

### 1.2 Configure the Web Service
- **Name**: `privacy-demo-backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Plan**: Free

### 1.3 Set Environment Variables
In the Render dashboard, add these environment variables:

```
NODE_ENV=production
PORT=10000
OPENAI_API_KEY=your_actual_openai_api_key
AWS_ACCESS_KEY_ID=your_actual_aws_access_key
AWS_SECRET_ACCESS_KEY=your_actual_aws_secret_key
ENABLE_AUDIT_LLM=true
```

### 1.4 Deploy
Click "Create Web Service" and wait for deployment to complete.

### 1.5 Get Backend URL
After deployment, note your backend URL (e.g., `https://privacy-demo-backend.onrender.com`)

## Step 2: Deploy Frontend on Vercel

### 2.1 Connect to GitHub
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository

### 2.2 Configure the Project
- **Framework Preset**: Other
- **Root Directory**: `./` (root of repository)
- **Build Command**: Leave empty (static files)
- **Output Directory**: `frontend`

### 2.3 Set Environment Variables
In the Vercel dashboard, add this environment variable:

```
REACT_APP_API_URL=https://your-render-backend-url.onrender.com
```

Replace `your-render-backend-url.onrender.com` with your actual Render backend URL.

### 2.4 Deploy
Click "Deploy" and wait for deployment to complete.

## Step 3: Verify Deployment

### 3.1 Test Backend
Visit your Render backend URL + `/api/test_connection` to verify the backend is working:
```
https://your-backend-url.onrender.com/api/test_connection
```

### 3.2 Test Frontend
Visit your Vercel frontend URL to verify the frontend is working and can connect to the backend.

## Step 4: Update CORS (if needed)

If you encounter CORS issues, you may need to update the CORS configuration in `server.js`:

```javascript
app.use(cors({
    origin: ['https://your-vercel-frontend-url.vercel.app', 'http://localhost:3000'],
    credentials: true
}));
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure your frontend URL is allowed in the backend CORS configuration
2. **Environment Variables**: Double-check that all environment variables are set correctly
3. **API Connection**: Verify the `REACT_APP_API_URL` points to your correct Render backend URL
4. **Build Failures**: Check that all dependencies are listed in `package.json`

### Debugging

1. Check Render logs for backend issues
2. Check Vercel logs for frontend issues
3. Use browser developer tools to check API requests
4. Verify environment variables are accessible

## File Structure After Deployment

```
PrivacyDemo/
├── frontend/           # Deployed on Vercel
│   ├── index.html
│   ├── api.js         # Updated to use Render backend
│   └── ...
├── server.js          # Deployed on Render
├── package.json
├── render.yaml        # Render deployment config
├── vercel.json        # Vercel deployment config (updated)
└── env.example        # Environment variables template
```

## Environment Variables Reference

### Backend (Render)
- `NODE_ENV`: Set to "production"
- `PORT`: Set to 10000 (Render requirement)
- `OPENAI_API_KEY`: Your OpenAI API key
- `AWS_ACCESS_KEY_ID`: Your AWS access key (if using S3)
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key (if using S3)
- `ENABLE_AUDIT_LLM`: Set to "true" to enable audit features

### Frontend (Vercel)
- `REACT_APP_API_URL`: Your Render backend URL

## Security Notes

1. Never commit API keys or secrets to your repository
2. Use environment variables for all sensitive configuration
3. Consider using Render's secret management for sensitive data
4. Regularly rotate your API keys and credentials 