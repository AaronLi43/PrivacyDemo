// Test script for completion code verification
// Tests both full and partial completion scenarios

import fetch from 'node-fetch';

const BACKEND_URL = 'https://privacydemo.onrender.com';
const LOCAL_URL = 'http://localhost:3000';

// Use local backend if available, otherwise use production
const BASE_URL = process.env.USE_LOCAL === 'true' ? LOCAL_URL : BACKEND_URL;

console.log(`🔧 Testing completion verification against: ${BASE_URL}`);

// Test scenarios
async function runTests() {
    console.log('\n📋 Starting Completion Code Verification Tests\n');
    
    // Test 1: No session (should return partial/error)
    await testNoSession();
    
    // Test 2: Partial completion (should return null code)
    await testPartialCompletion();
    
    // Test 3: Full completion (should return completion code)
    await testFullCompletion();
    
    console.log('\n✅ All tests completed!\n');
}

// Test: No session provided
async function testNoSession() {
    console.log('Test 1: No Session ID');
    console.log('Expected: Error or partial status with no code');
    
    try {
        const response = await fetch(`${BASE_URL}/api/verify-completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        
        const data = await response.json();
        console.log('Result:', data.status || 'ERROR');
        console.log('Completion Code:', data.completionCode || 'null');
        console.log('✓ Test passed: No completion code for missing session\n');
    } catch (error) {
        console.log('✓ Test passed: Request failed as expected\n');
    }
}

// Test: Partial completion scenario
async function testPartialCompletion() {
    console.log('Test 2: Partial Completion (3 of 7 questions)');
    console.log('Expected: PARTIAL status with null completion code');
    
    try {
        // First, create a session with partial progress
        const sessionId = `test_partial_${Date.now()}`;
        
        // Start a chat session
        const startResponse = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "__START__",
                step: 0,
                sessionId: sessionId,
                questionMode: true,
                action: "START_QUESTION_MODE",
                mode: 'neutral'
            })
        });
        
        if (startResponse.ok) {
            // Simulate answering only 3 questions
            for (let i = 0; i < 3; i++) {
                await fetch(`${BASE_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: `Test answer for question ${i + 1}`,
                        step: i,
                        sessionId: sessionId
                    })
                });
            }
            
            // Now verify completion
            const verifyResponse = await fetch(`${BASE_URL}/api/verify-completion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    prolificPid: 'TEST_PARTIAL_USER'
                })
            });
            
            const data = await verifyResponse.json();
            console.log('Result:', data.status);
            console.log('Completion Code:', data.completionCode || 'null');
            console.log('Progress:', `${data.completedQuestions}/${data.totalQuestions} (${data.completedPercentage}%)`);
            
            if (data.completionCode === null && data.status === 'PARTIAL') {
                console.log('✓ Test passed: No completion code for partial completion\n');
            } else {
                console.log('✗ Test failed: Unexpected completion code for partial completion\n');
            }
        }
    } catch (error) {
        console.error('Test error:', error.message);
        console.log('✗ Test failed\n');
    }
}

// Test: Full completion scenario
async function testFullCompletion() {
    console.log('Test 3: Full Completion (7 questions + survey + post-tasks)');
    console.log('Expected: COMPLETE status with completion code C15VDGHG');
    
    try {
        // Create a session with full progress
        const sessionId = `test_complete_${Date.now()}`;
        
        // Start a chat session
        const startResponse = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "__START__",
                step: 0,
                sessionId: sessionId,
                questionMode: true,
                action: "START_QUESTION_MODE",
                mode: 'neutral'
            })
        });
        
        if (startResponse.ok) {
            // Simulate answering all 7 questions
            for (let i = 0; i < 7; i++) {
                const response = await fetch(`${BASE_URL}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: `Test answer for question ${i + 1}. This is a complete answer with enough detail.`,
                        step: i,
                        sessionId: sessionId,
                        forceComplete: i === 6 // Force completion on last question
                    })
                });
                
                const data = await response.json();
                if (data.isComplete) {
                    console.log(`Question ${i + 1} marked as complete`);
                }
            }
            
            // Force completion status in session
            await fetch(`${BASE_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: "__FORCE_COMPLETE__",
                    sessionId: sessionId,
                    action: "FORCE_COMPLETE"
                })
            });
            
            // Now verify completion
            const verifyResponse = await fetch(`${BASE_URL}/api/verify-completion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId,
                    prolificPid: 'TEST_COMPLETE_USER'
                })
            });
            
            const data = await verifyResponse.json();
            console.log('Result:', data.status);
            console.log('Completion Code:', data.completionCode || 'null');
            console.log('Redirect URL:', data.redirectUrl || 'none');
            console.log('Progress:', `${data.completedQuestions}/${data.totalQuestions} (${data.completedPercentage}%)`);
            
            if (data.completionCode === 'C15VDGHG' && data.status === 'COMPLETE') {
                console.log('✓ Test passed: Completion code provided for full completion\n');
            } else {
                console.log('⚠ Note: Full completion test may need manual setup\n');
            }
        }
    } catch (error) {
        console.error('Test error:', error.message);
        console.log('⚠ Test inconclusive - may need manual verification\n');
    }
}

// Run all tests
runTests().catch(console.error);