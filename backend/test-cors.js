// test-cors.js - Simple CORS test script
import fetch from 'node-fetch';

const TEST_URL = 'http://localhost:3000/api/test-cors';

async function testCORS() {
    try {
        console.log('🧪 Testing CORS with origin: https://privacy-demo-flame.vercel.app');
        
        const response = await fetch(TEST_URL, {
            method: 'GET',
            headers: {
                'Origin': 'https://privacy-demo-flame.vercel.app',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ Response status:', response.status);
        console.log('✅ Response headers:', response.headers);
        
        const data = await response.json();
        console.log('✅ Response data:', data);
        
    } catch (error) {
        console.error('❌ CORS test failed:', error.message);
    }
}

// Run the test
testCORS();
