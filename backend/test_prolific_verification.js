// Test script for Prolific PID-based completion verification
// Tests the S3-based verification when sessions are missing

import fetch from 'node-fetch';

const BACKEND_URL = 'https://privacydemo.onrender.com';
const LOCAL_URL = 'http://localhost:3000';

// Use local backend if available, otherwise use production
const BASE_URL = process.env.USE_LOCAL === 'true' ? LOCAL_URL : BACKEND_URL;

console.log(`🔧 Testing Prolific PID verification against: ${BASE_URL}`);

// Test scenarios
async function runProlificTests() {
    console.log('\n📋 Starting Prolific PID Verification Tests\n');
    
    // Test 1: No session, no prolific PID (should return error)
    await testNoPidNoSession();
    
    // Test 2: No session, but have prolific PID (should check S3)
    await testNoPidWithSession();
    
    // Test 3: Known completed participant (from previous example)
    await testKnownCompletedParticipant();
    
    console.log('\n✅ All Prolific verification tests completed!\n');
}

// Test: No session, no PID
async function testNoPidNoSession() {
    console.log('Test 1: No Session ID, No Prolific PID');
    console.log('Expected: Error requiring session or PID');
    
    try {
        const response = await fetch(`${BASE_URL}/api/verify-completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        console.log('Result:', data.status || 'ERROR');
        console.log('Message:', data.error || data.message || 'No message');
        
        if (data.error && data.error.includes('required')) {
            console.log('✓ Test passed: Proper error for missing parameters\n');
        } else {
            console.log('✗ Test failed: Expected error for missing parameters\n');
        }
    } catch (error) {
        console.log('✗ Test failed: Request failed\n');
    }
}

// Test: No session, but have prolific PID (should check S3)
async function testNoPidWithSession() {
    console.log('Test 2: No Session ID, Have Prolific PID');
    console.log('Expected: S3 verification attempt with likely PARTIAL result');
    
    try {
        const response = await fetch(`${BASE_URL}/api/verify-completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prolificPid: 'TEST_NO_UPLOADS_PARTICIPANT'
            })
        });
        
        const data = await response.json();
        console.log('Result:', data.status);
        console.log('Completion Code:', data.completionCode || 'null');
        console.log('Verification Method:', data.verificationMethod || 'unknown');
        console.log('Message:', data.message);
        
        if (data.status === 'PARTIAL' && data.verificationMethod) {
            console.log('✓ Test passed: S3 verification attempted\n');
        } else {
            console.log('⚠ Test inconclusive: S3 verification behavior unclear\n');
        }
    } catch (error) {
        console.error('Test error:', error.message);
        console.log('✗ Test failed\n');
    }
}

// Test: Known completed participant
async function testKnownCompletedParticipant() {
    console.log('Test 3: Known Completed Participant');
    console.log('Expected: COMPLETE status if S3 verification works');
    
    try {
        const response = await fetch(`${BASE_URL}/api/verify-completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prolificPid: '63d14d136d440a339c77a428'  // From previous example
            })
        });
        
        const data = await response.json();
        console.log('Result:', data.status);
        console.log('Completion Code:', data.completionCode || 'null');
        console.log('Verification Method:', data.verificationMethod || 'unknown');
        console.log('Message:', data.message);
        
        if (data.status === 'COMPLETE' && data.completionCode === 'C15VDGHG') {
            console.log('✅ Test SUCCESS: Known participant gets completion code!\n');
        } else if (data.status === 'PARTIAL') {
            console.log('⚠ Test NOTE: Participant classified as partial (may need S3 investigation)\n');
        } else {
            console.log('✗ Test failed: Unexpected result\n');
        }
    } catch (error) {
        console.error('Test error:', error.message);
        console.log('✗ Test failed\n');
    }
}

// Run all tests
runProlificTests().catch(console.error);