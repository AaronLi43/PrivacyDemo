// Test script to verify CORS configuration
import fetch from 'node-fetch';

const BASE_URL = 'https://privacydemo.onrender.com';

async function testCORS() {
    console.log('🧪 Testing CORS configuration...\n');
    
    // Test 1: Test CORS endpoint
    try {
        console.log('1️⃣ Testing /api/test-cors...');
        const response = await fetch(`${BASE_URL}/api/test-cors`, {
            method: 'GET',
            headers: {
                'Origin': 'https://privacy-demo-flame.vercel.app'
            }
        });
        
        console.log('✅ Status:', response.status);
        console.log('✅ CORS Headers:');
        console.log('   Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
        console.log('   Access-Control-Allow-Credentials:', response.headers.get('access-control-allow-credentials'));
        console.log('   Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));
        
        const data = await response.json();
        console.log('✅ Response:', data);
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Test config endpoint
    try {
        console.log('2️⃣ Testing /api/config...');
        const response = await fetch(`${BASE_URL}/api/config`, {
            method: 'GET',
            headers: {
                'Origin': 'https://privacy-demo-flame.vercel.app'
            }
        });
        
        console.log('✅ Status:', response.status);
        console.log('✅ CORS Headers:');
        console.log('   Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
        console.log('   Access-Control-Allow-Credentials:', response.headers.get('access-control-allow-credentials'));
        console.log('   Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));
        
        const data = await response.json();
        console.log('✅ Response:', data);
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Test predefined questions endpoint
    try {
        console.log('3️⃣ Testing /api/predefined_questions/naive...');
        const response = await fetch(`${BASE_URL}/api/predefined_questions/naive`, {
            method: 'GET',
            headers: {
                'Origin': 'https://privacy-demo-flame.vercel.app'
            }
        });
        
        console.log('✅ Status:', response.status);
        console.log('✅ CORS Headers:');
        console.log('   Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
        console.log('   Access-Control-Allow-Credentials:', response.headers.get('access-control-allow-credentials'));
        console.log('   Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));
        
        const data = await response.json();
        console.log('✅ Response:', data);
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 4: Test OPTIONS preflight
    try {
        console.log('4️⃣ Testing OPTIONS preflight...');
        const response = await fetch(`${BASE_URL}/api/config`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://privacy-demo-flame.vercel.app',
                'Access-Control-Request-Method': 'GET',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        
        console.log('✅ Status:', response.status);
        console.log('✅ CORS Headers:');
        console.log('   Access-Control-Allow-Origin:', response.headers.get('access-control-allow-origin'));
        console.log('   Access-Control-Allow-Credentials:', response.headers.get('access-control-allow-credentials'));
        console.log('   Access-Control-Allow-Methods:', response.headers.get('access-control-allow-methods'));
        console.log('   Access-Control-Allow-Headers:', response.headers.get('access-control-allow-headers'));
    } catch (error) {
        console.log('❌ Error:', error.message);
    }
}

testCORS().catch(console.error);
