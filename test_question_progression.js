// Test script to verify question progression works correctly
const fetch = require('node-fetch');

async function testQuestionProgression() {
    const baseUrl = 'http://localhost:3000';
    
    console.log('🧪 Testing Question Progression...\n');
    
    // Test question progression with realistic conversation
    const testConversation = [
        { message: "Hello, I'm ready to answer your questions.", expectedQuestion: "What is your name?" },
        { message: "My name is Alice Johnson", expectedQuestion: "What is your name?" },
        { message: "It's a family name from my mother's side", expectedQuestion: "What is your name?" },
        { message: "I'm 28 years old", expectedQuestion: "How old are you?" },
        { message: "I live in Seattle, Washington", expectedQuestion: "Where do you live?" },
        { message: "I work as a data scientist", expectedQuestion: "What is your occupation?" },
        { message: "I enjoy hiking and reading", expectedQuestion: "Do you have any hobbies?" }
    ];
    
    let step = 0;
    let conversationTurns = 0;
    let currentQuestionIndex = 0;
    
    const predefinedQuestions = [
        "What is your name?",
        "How old are you?", 
        "Where do you live?",
        "What is your occupation?",
        "Do you have any hobbies?"
    ];
    
    for (let i = 0; i < testConversation.length; i++) {
        const turn = testConversation[i];
        step++;
        conversationTurns++;
        
        console.log(`\n--- Turn ${conversationTurns} (Step ${step}) ---`);
        console.log(`User: ${turn.message}`);
        console.log(`Expected Question: ${turn.expectedQuestion}`);
        
        try {
            const response = await fetch(`${baseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: turn.message,
                    step: step,
                    questionMode: true,
                    currentQuestion: predefinedQuestions[currentQuestionIndex],
                    predefinedQuestions: predefinedQuestions,
                    conversationTurns: conversationTurns
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`Bot: ${data.bot_response}`);
                console.log(`Question Completed: ${data.question_completed}`);
                console.log(`Current Question Index: ${currentQuestionIndex}`);
                
                if (data.question_completed) {
                    currentQuestionIndex++;
                    conversationTurns = 0; // Reset for next question
                    console.log(`🔄 Moving to next question (index: ${currentQuestionIndex})`);
                }
            } else {
                console.log('❌ Error:', data.error);
            }
            
        } catch (error) {
            console.log('❌ Request failed:', error.message);
        }
        
        // Small delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Check final state
    console.log('\n🔍 Final State Check...');
    try {
        const response = await fetch(`${baseUrl}/api/debug_context`);
        const data = await response.json();
        console.log('Final Context:', {
            active_session: data.active_chat_session,
            message_count: data.conversation_history.length,
            mode: data.current_mode
        });
    } catch (error) {
        console.log('❌ Debug context failed:', error.message);
    }
}

testQuestionProgression().catch(console.error); 