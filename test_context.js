// Test script to debug chatbot context
const fetch = require('node-fetch');

async function testChatbotContext() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🧪 Testing Chatbot Context...\n');
    
    // Test 1: Check API connection
    try {
        const response = await fetch(`${baseUrl}/api/test_connection`);
        const data = await response.json();
        console.log('✅ API Connection:', data.status);
    } catch (error) {
        console.log('❌ API Connection failed:', error.message);
        return;
    }
    
    // Test 2: Start a question conversation
    console.log('\n📝 Testing Question Mode...');
    
    const testMessages = [
        "Hello, I'm ready to answer your questions.",
        "My name is John Smith",
        "It's a family name, passed down from my grandfather",
        "I'm 25 years old",
        "I live in Los Angeles, California",
        "I work as a software engineer",
        "I enjoy playing guitar and hiking"
    ];
    
    let step = 0;
    let conversationTurns = 0;
    
    for (const message of testMessages) {
        step++;
        conversationTurns++;
        
        console.log(`\n--- Turn ${conversationTurns} ---`);
        console.log(`User: ${message}`);
        
        try {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    step: step,
                    questionMode: true,
                    currentQuestion: "What is your name?",
                    predefinedQuestions: [
                        "What is your name?",
                        "How old are you?",
                        "Where do you live?",
                        "What is your occupation?",
                        "Do you have any hobbies?"
                    ],
                    conversationTurns: conversationTurns
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`Bot: ${data.bot_response}`);
                console.log(`Question Completed: ${data.question_completed}`);
                
                if (data.question_completed) {
                    console.log('🔄 Moving to next question...');
                    conversationTurns = 0; // Reset for next question
                }
            } else {
                console.log('❌ Error:', data.error);
            }
            
            // Add a small delay to avoid overwhelming the API
            await new Promise(resolve => setTimeout(resolve, 2000));
            
        } catch (error) {
            console.log('❌ Request failed:', error.message);
        }
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Test 3: Check debug context
    console.log('\n🔍 Checking Debug Context...');
    try {
        const response = await fetch(`${baseUrl}/api/debug_context`);
        const data = await response.json();
        console.log('Active Chat Session:', data.active_chat_session);
        console.log('Message Count:', data.conversation_history.length);
        console.log('Current Mode:', data.current_mode);
    } catch (error) {
        console.log('❌ Debug context failed:', error.message);
    }
}

// Run the test
testChatbotContext().catch(console.error); 