const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testConversationFlow() {
    try {
        console.log('🧪 Testing conversation flow...\n');

        // Step 1: Get predefined questions
        console.log('1. Getting predefined questions...');
        const questionsResponse = await axios.get(`${BASE_URL}/api/predefined_questions/naive`);
        const predefinedQuestions = questionsResponse.data.questions;
        console.log(`   Found ${predefinedQuestions.length} questions`);
        console.log(`   First question: "${predefinedQuestions[0]}"\n`);

        // Step 2: Send initial greeting
        console.log('2. Sending initial greeting...');
        const greetingResponse = await axios.post(`${BASE_URL}/api/chat`, {
            message: "Hello, I'm ready to answer your questions.",
            step: 0,
            questionMode: true,
            currentQuestion: predefinedQuestions[0],
            predefinedQuestions: predefinedQuestions
        });

        console.log('   Bot response:');
        console.log(`   "${greetingResponse.data.bot_response}"\n`);

        // Step 3: Check if the response asks about educational background immediately
        const botResponse = greetingResponse.data.bot_response.toLowerCase();
        const hasEducationalQuestion = botResponse.includes('major') || 
                                     botResponse.includes('field of study') || 
                                     botResponse.includes('college') || 
                                     botResponse.includes('university');

        if (hasEducationalQuestion) {
            console.log('❌ ISSUE FOUND: Bot immediately asked about educational background without proper introduction');
            console.log('   The bot should provide a warm welcome and introduction first');
        } else {
            console.log('✅ SUCCESS: Bot provided proper introduction without immediately asking about educational background');
        }

        // Step 4: Send a response to see if it then asks the educational question
        console.log('\n3. Sending user response...');
        const userResponse = await axios.post(`${BASE_URL}/api/chat`, {
            message: "Thank you for the introduction. I'm ready to start.",
            step: 1,
            questionMode: true,
            currentQuestion: predefinedQuestions[0],
            predefinedQuestions: predefinedQuestions
        });

        console.log('   Bot response:');
        console.log(`   "${userResponse.data.bot_response}"\n`);

        const secondResponse = userResponse.data.bot_response.toLowerCase();
        const nowHasEducationalQuestion = secondResponse.includes('major') || 
                                        secondResponse.includes('field of study') || 
                                        secondResponse.includes('college') || 
                                        secondResponse.includes('university');

        if (nowHasEducationalQuestion) {
            console.log('✅ SUCCESS: Bot now appropriately asks about educational background after introduction');
        } else {
            console.log('⚠️  WARNING: Bot still hasn\'t asked about educational background');
        }

        console.log('\n🎯 Test completed!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('   Response data:', error.response.data);
        }
    }
}

// Run the test
testConversationFlow(); 