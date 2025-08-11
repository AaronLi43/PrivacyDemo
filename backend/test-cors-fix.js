import fetch from 'node-fetch';

const TEST_URLS = [
    'https://privacydemo.onrender.com/api/test-cors',
    'https://privacydemo.onrender.com/api/cors-debug'
];

const TEST_ORIGINS = [
    'https://privacy-demo-flame.vercel.app',
    'https://privacy-demo-git-main-privacy-demo-flame.vercel.app',
    'https://privacy-demo-flame-git-main-privacy-demo-flame.vercel.app',
    'https://privacy-demo-flame-git-feature-privacy-demo-flame.vercel.app',
    'https://privacy-demo-flame-git-develop-privacy-demo-flame.vercel.app'
];

async function testCORS() {
    console.log('🧪 Testing CORS configuration...\n');
    
    for (const url of TEST_URLS) {
        console.log(`📍 Testing URL: ${url}`);
        
        for (const origin of TEST_ORIGINS) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Origin': origin,
                        'User-Agent': 'CORS-Test-Script/1.0'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`✅ ${origin} -> ${response.status} ${response.statusText}`);
                    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
                } else {
                    console.log(`❌ ${origin} -> ${response.status} ${response.statusText}`);
                }
                
                // Check CORS headers
                const corsHeaders = {
                    'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
                    'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
                    'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
                    'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
                };
                console.log(`   CORS Headers:`, corsHeaders);
                
            } catch (error) {
                console.log(`❌ ${origin} -> Error: ${error.message}`);
            }
            console.log('');
        }
    }
}

// Test OPTIONS preflight request
async function testPreflight() {
    console.log('🧪 Testing OPTIONS preflight request...\n');
    
    const url = 'https://privacydemo.onrender.com/api/chat';
    const origin = 'https://privacy-demo-flame.vercel.app';
    
    try {
        const response = await fetch(url, {
            method: 'OPTIONS',
            headers: {
                'Origin': origin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });
        
        console.log(`📍 Preflight test for: ${url}`);
        console.log(`   Origin: ${origin}`);
        console.log(`   Status: ${response.status} ${response.statusText}`);
        
        const corsHeaders = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Credentials': response.headers.get('Access-Control-Allow-Credentials'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        };
        console.log(`   CORS Headers:`, corsHeaders);
        
    } catch (error) {
        console.log(`❌ Preflight test failed: ${error.message}`);
    }
}

// Run tests
async function runTests() {
    await testCORS();
    await testPreflight();
    console.log('🧪 CORS testing complete!');
}

runTests().catch(console.error);
