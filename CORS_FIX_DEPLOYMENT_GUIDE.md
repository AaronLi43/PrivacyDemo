# CORS Fix Deployment Guide

## Problem Summary
The frontend at `https://privacy-demo-flame.vercel.app` is experiencing CORS errors when trying to access the backend at `https://privacydemo.onrender.com`.

## Changes Made

### 1. Enhanced CORS Configuration (`backend/server.js`)
- **Dynamic Origin Handling**: Added function-based CORS origin checking
- **Vercel Preview Support**: Automatically allows Vercel preview deployments
- **Better Logging**: Enhanced CORS debugging and logging
- **Preflight Support**: Explicit OPTIONS request handling

### 2. Additional CORS Origins
Added support for various Vercel deployment patterns:
- `https://privacy-demo-flame.vercel.app`
- `https://privacy-demo-git-main-privacy-demo-flame.vercel.app`
- `https://privacy-demo-flame-git-main-privacy-demo-flame.vercel.app`
- `https://privacy-demo-flame-git-feature-privacy-demo-flame.vercel.app`
- `https://privacy-demo-flame-git-develop-privacy-demo-flame.vercel.app`

### 3. Debug Endpoints
- `/api/test-cors` - Basic CORS test
- `/api/cors-debug` - Detailed CORS debugging information

## Deployment Steps

### Option 1: Deploy to Render (Recommended)
1. **Push changes to your Git repository**
   ```bash
   git add .
   git commit -m "Fix CORS configuration for Vercel frontend"
   git push
   ```

2. **Render will automatically redeploy** from your Git repository

3. **Verify deployment** by checking the Render dashboard

### Option 2: Manual Deploy
1. **Upload the updated `server.js`** to your Render deployment
2. **Restart the service** in Render dashboard

## Testing the Fix

### 1. Test CORS Endpoints
```bash
# Test basic CORS
curl -H "Origin: https://privacy-demo-flame.vercel.app" \
     https://privacydemo.onrender.com/api/test-cors

# Test CORS debug
curl -H "Origin: https://privacy-demo-flame.vercel.app" \
     https://privacydemo.onrender.com/api/cors-debug
```

### 2. Test Preflight Request
```bash
curl -X OPTIONS \
     -H "Origin: https://privacy-demo-flame.vercel.app" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     https://privacydemo.onrender.com/api/chat
```

### 3. Run Automated Tests
```bash
cd backend
npm run test-cors-fix
```

## Environment Variables

If you need to override CORS origins, set the `CORS_ORIGINS` environment variable in Render:

```
CORS_ORIGINS=https://privacy-demo-flame.vercel.app,https://example.com
```

## Verification

After deployment, verify the fix works by:

1. **Checking Render logs** for CORS-related messages
2. **Testing from the Vercel frontend** - the chat should work without CORS errors
3. **Monitoring browser console** for any remaining CORS issues

## Rollback Plan

If issues occur, you can rollback by:
1. **Reverting the Git commit** and pushing
2. **Restoring the previous `server.js`** from Git history
3. **Redeploying** the previous version

## Expected Results

After deployment, you should see:
- ✅ CORS requests from Vercel frontend succeed
- ✅ Chat API works without CORS errors
- ✅ Enhanced logging shows CORS decisions
- ✅ Preflight requests are handled correctly

## Troubleshooting

### Common Issues
1. **Render not redeploying**: Check if auto-deploy is enabled
2. **CORS still failing**: Verify the frontend origin matches exactly
3. **Logs not showing**: Check if the service restarted properly

### Debug Commands
```bash
# Check Render logs
# Use Render dashboard or CLI

# Test local CORS
cd backend
npm run test-cors-fix

# Check server status
curl https://privacydemo.onrender.com/
```
