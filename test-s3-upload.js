// Test script for S3 upload functionality
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
require('dotenv').config();

async function testS3Upload() {
    console.log('🧪 Testing S3 Upload Functionality...\n');

    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set');
    console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set');
    console.log('');

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        console.log('❌ AWS credentials not found. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file');
        return;
    }

    try {
        // Initialize S3 client
        console.log('🔧 Initializing S3 client...');
        const s3Client = new S3Client({
            region: 'us-east-2',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        console.log('✅ S3 client initialized successfully\n');

        // Test data
        const testData = {
            test: true,
            timestamp: new Date().toISOString(),
            prolificId: 'test123',
            message: 'This is a test upload from the Privacy Demo application'
        };

        // Generate test filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `test_${testData.prolificId}_conversation_${timestamp}.json`;

        console.log('📤 Uploading test file to S3...');
        console.log('Bucket: prolificjson');
        console.log('Filename:', filename);

        // Upload to S3
        const uploadParams = {
            Bucket: 'prolificjson',
            Key: filename,
            Body: JSON.stringify(testData, null, 2),
            ContentType: 'application/json',
            Metadata: {
                'prolific-id': testData.prolificId,
                'upload-timestamp': new Date().toISOString(),
                'test-upload': 'true'
            }
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        console.log('✅ Test upload successful!');
        console.log('📁 File uploaded to: s3://prolificjson/' + filename);
        console.log('');
        console.log('🎉 S3 upload functionality is working correctly!');

    } catch (error) {
        console.error('❌ S3 upload test failed:', error.message);
        
        if (error.name === 'NoSuchBucket') {
            console.log('💡 Make sure the "prolificjson" bucket exists in us-east-2 region');
        } else if (error.name === 'AccessDenied') {
            console.log('💡 Check your AWS credentials and IAM permissions');
        } else if (error.name === 'InvalidAccessKeyId') {
            console.log('💡 Verify your AWS_ACCESS_KEY_ID is correct');
        } else if (error.name === 'SignatureDoesNotMatch') {
            console.log('💡 Verify your AWS_SECRET_ACCESS_KEY is correct');
        }
    }
}

// Run the test
testS3Upload(); 