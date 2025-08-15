# CORS Configuration and Debug Guide

## Overview
This backend server has been configured with comprehensive CORS (Cross-Origin Resource Sharing) support to allow requests from the Vercel frontend.

## Allowed Origins
The following origins are automatically allowed:
- `https://privacy-demo-flame.vercel.app` (main Vercel domain)
- `https://privacy-demo-git-main-privacy-demo-flame.vercel.app` (Vercel git deployments)
- `https://privacy-demo-flame-git-*-privacy-demo-flame.vercel.app` (Vercel preview deployments)
- Local development domains (`localhost:8000`, `localhost:3000`, etc.)

## CORS Debug Mode
To enable CORS debug mode (allows all origins), set the environment variable:

```bash
export CORS_DEBUG=true
```

Or add to your `.env` file:
```
CORS_DEBUG=true
```

## Testing CORS
Use the provided test script to verify CORS configuration:

```bash
node test-cors-fix.js
```

This will test:
1. `/api/test-cors` - Basic CORS test endpoint
2. `/api/config` - Configuration endpoint
3. `/api/predefined_questions/naive` - Questions endpoint
4. OPTIONS preflight requests

## Manual CORS Headers
All API endpoints now have explicit CORS headers set as a fallback to ensure proper CORS support.

## Troubleshooting
If you're still experiencing CORS issues:

1. Check the server logs for CORS-related messages
2. Verify the origin is in the allowed list
3. Enable CORS debug mode temporarily
4. Test with the provided test script
5. Check browser developer tools for specific CORS errors

## Environment Variables
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `CORS_DEBUG` - Enable debug mode (allows all origins)
- `NODE_ENV` - Environment mode
