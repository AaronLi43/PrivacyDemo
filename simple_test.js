// Simple test to verify chatbot context fixes
const fetch = require('node-fetch');

async function simpleTest() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🧪 Simple Chatbot Context Test...\n');
    
    // Test basic conversation
    try {
        console.log('1. Testing basic message...');
        const response1 = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Hello, how are you?",
                step: 1
            })
        });
        
        const data1 = await response1.json();
        console.log('✅ Basic message response:', data1.success ? 'Success' : 'Failed');
        
        // Test question mode
        console.log('\n2. Testing question mode...');
        const response2 = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "My name is Alice",
                step: 2,
                questionMode: true,
                currentQuestion: "What is your name?",
                predefinedQuestions: ["What is your name?", "How old are you?"],
                conversationTurns: 1
            })
        });
        
        const data2 = await response2.json();
        console.log('✅ Question mode response:', data2.success ? 'Success' : 'Failed');
        console.log('Bot response:', data2.bot_response);
        
        // Check debug context
        console.log('\n3. Checking debug context...');
        const response3 = await fetch(`${baseUrl}/api/debug_context`);
        const data3 = await response3.json();
        console.log('✅ Debug context:', {
            active_session: data3.active_chat_session,
            message_count: data3.conversation_history.length,
            mode: data3.current_mode
        });
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
    }
}

simpleTest().catch(console.error); 