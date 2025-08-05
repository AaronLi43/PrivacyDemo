# Privacy Demo Deployment Guide

This guide covers deploying the Privacy Demo application with AWS S3 integration and Vercel hosting.

## Prerequisites

1. **AWS Account** with S3 access
2. **Vercel Account** for hosting
3. **Node.js** (for local development)

## AWS S3 Setup

### 1. Create S3 Bucket

1. Log into AWS Console
2. Navigate to S3 service
3. Create a new bucket named `prolificjson`
4. Select region: **US East (Ohio) us-east-2**
5. Configure bucket settings:
   - Block all public access: **Enabled** (for security)
   - Versioning: **Disabled** (for simplicity)
   - Encryption: **Default** (AES-256)

### 2. Create IAM User for S3 Access

1. Navigate to IAM service
2. Create a new user with programmatic access
3. Attach the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::prolificjson",
                "arn:aws:s3:::prolificjson/*"
            ]
        }
    ]
}
```

4. Save the Access Key ID and Secret Access Key

## Environment Variables

Set the following environment variables in your deployment environment:

### Required Variables
- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `OPENAI_API_KEY`: Your OpenAI API key (if using AI features)

### Optional Variables
- `ENABLE_AUDIT_LLM`: Set to 'true' to enable audit LLM features
- `PORT`: Server port (default: 3000)

## Vercel Deployment

### 1. Install Vercel CLI
```bash
npm install -g vercel
```

### 2. Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 3. Set Environment Variables in Vercel
1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add the required environment variables listed above

### 4. Configure Custom Domain (Optional)
1. In Vercel dashboard, go to Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create a `.env` file in the root directory:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
OPENAI_API_KEY=your_openai_key
ENABLE_AUDIT_LLM=true
```

### 3. Start Development Server
```bash
npm run dev
```

## Usage

### Prolific Integration
When users access the web app through Prolific, the URL will contain a `PROLIFIC_PID` parameter:
```
https://your-app.vercel.app?PROLIFIC_PID=abc123def456
```

The application automatically:
1. Extracts the PROLIFIC_PID from the URL
2. Includes it in the filename when uploading to S3
3. Stores it in the metadata for tracking

### File Naming Convention
Files uploaded to S3 follow this pattern:
```
{PROLIFIC_PID}_conversation_{timestamp}.json
```

Example: `abc123def456_conversation_2024-01-15T10-30-45-123Z.json`

## Monitoring

### S3 Monitoring
- Check the `prolificjson` bucket for uploaded files
- Monitor CloudWatch logs for upload errors
- Set up S3 event notifications if needed

### Vercel Monitoring
- Check Vercel dashboard for deployment status
- Monitor function logs for API errors
- Set up alerts for failed deployments

## Troubleshooting

### Common Issues

1. **S3 Upload Fails**
   - Verify AWS credentials are correct
   - Check bucket permissions
   - Ensure bucket exists in us-east-2 region

2. **Vercel Deployment Fails**
   - Check environment variables are set
   - Verify Node.js version compatibility
   - Check build logs for errors

3. **PROLIFIC_PID Not Found**
   - Verify URL contains the parameter
   - Check browser console for extraction errors
   - Test with a sample URL

### Debug Commands
```bash
# Test S3 connection
node -e "const { S3Client } = require('@aws-sdk/client-s3'); console.log('S3 client created successfully')"

# Test environment variables
node -e "console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Set' : 'Not set')"
```

## Security Considerations

1. **AWS Credentials**: Never commit credentials to version control
2. **S3 Bucket**: Keep bucket private, only allow specific IAM users access
3. **Environment Variables**: Use Vercel's secure environment variable storage
4. **HTTPS**: Vercel automatically provides HTTPS for all deployments

## Cost Optimization

1. **S3 Storage**: Monitor bucket size and implement lifecycle policies if needed
2. **Vercel Functions**: Monitor function execution time and memory usage
3. **API Calls**: Monitor OpenAI API usage and costs

## Support

For issues related to:
- **AWS S3**: Check AWS documentation and support
- **Vercel**: Check Vercel documentation and community
- **Application**: Check the main README.md file 