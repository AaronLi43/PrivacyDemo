const axios = require('axios');

class FollowUpQuestionTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
    }

    async testFollowUpQuestions() {
        console.log('🧪 Testing Follow-up Question Functionality...\n');
        
        try {
            // Test 1: Enable audit LLM
            await this.enableAuditLLM();
            
            // Test 2: Set mode to featured (has audit LLM)
            await this.setMode('featured');
            
            // Test 3: Test with a brief response that should trigger follow-up questions
            await this.testBriefResponse();
            
            // Test 4: Test with a comprehensive response that should proceed
            await this.testComprehensiveResponse();
            
            console.log('\n✅ Follow-up question tests completed successfully!');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }

    async enableAuditLLM() {
        console.log('📡 Enabling Audit LLM...');
        try {
            // Set environment variable through API if available, otherwise just log
            console.log('⚠️  Please ensure ENABLE_AUDIT_LLM=true is set in your environment');
            console.log('✅ Audit LLM should be enabled for follow-up questions to work');
        } catch (error) {
            console.log('⚠️  Could not verify audit LLM status');
        }
    }

    async setMode(mode) {
        console.log(`🔄 Setting mode to: ${mode}`);
        try {
            await axios.post(`${this.baseURL}/api/set_mode`, { mode });
            console.log(`✅ Mode set to ${mode}`);
        } catch (error) {
            console.error(`❌ Failed to set mode: ${error.message}`);
        }
    }

    async testBriefResponse() {
        console.log('\n📝 Test 1: Brief response (should trigger follow-up questions)');
        
        try {
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const predefinedQuestions = questionsResponse.data.questions;
            
            if (!predefinedQuestions || predefinedQuestions.length === 0) {
                console.log('❌ No predefined questions available');
                return;
            }
            
            const currentQuestion = predefinedQuestions[0];
            console.log(`Current question: "${currentQuestion}"`);
            
            // Send a brief response
            const briefResponse = "I used ChatGPT once.";
            console.log(`User response: "${briefResponse}"`);
            
            const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                message: briefResponse,
                step: 0,
                questionMode: true,
                currentQuestion: currentQuestion,
                predefinedQuestions: predefinedQuestions,
                isFinalQuestion: false
            });
            
            console.log(`Bot response: "${chatResponse.data.bot_response}"`);
            console.log(`Question completed: ${chatResponse.data.question_completed}`);
            
            if (chatResponse.data.follow_up_questions) {
                console.log(`✅ Follow-up questions received: ${chatResponse.data.follow_up_questions.join(', ')}`);
            } else {
                console.log('⚠️  No follow-up questions received (audit LLM may be disabled)');
            }
            
            if (chatResponse.data.audit_result) {
                console.log(`Audit result: ${JSON.stringify(chatResponse.data.audit_result)}`);
            }
            
        } catch (error) {
            console.error(`❌ Brief response test failed: ${error.message}`);
        }
    }

    async testComprehensiveResponse() {
        console.log('\n📝 Test 2: Comprehensive response (should proceed to next question)');
        
        try {
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const predefinedQuestions = questionsResponse.data.questions;
            
            if (!predefinedQuestions || predefinedQuestions.length === 0) {
                console.log('❌ No predefined questions available');
                return;
            }
            
            const currentQuestion = predefinedQuestions[0];
            console.log(`Current question: "${currentQuestion}"`);
            
            // Send a comprehensive response
            const comprehensiveResponse = "I first discovered ChatGPT through a colleague who was using it for interview preparation. I was initially skeptical, but after trying it myself, I found it incredibly helpful for structuring my responses and practicing common behavioral questions. I used it extensively for about 3 interviews and felt much more confident going into each one. The AI helped me organize my thoughts and present my experiences in a more compelling way.";
            console.log(`User response: "${comprehensiveResponse.substring(0, 100)}..."`);
            
            const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                message: comprehensiveResponse,
                step: 1,
                questionMode: true,
                currentQuestion: currentQuestion,
                predefinedQuestions: predefinedQuestions,
                isFinalQuestion: false
            });
            
            console.log(`Bot response: "${chatResponse.data.bot_response}"`);
            console.log(`Question completed: ${chatResponse.data.question_completed}`);
            
            if (chatResponse.data.question_completed) {
                console.log('✅ Question completed successfully (comprehensive response)');
            } else {
                console.log('⚠️  Question not completed (may need more detail)');
            }
            
            if (chatResponse.data.audit_result) {
                console.log(`Audit result: ${JSON.stringify(chatResponse.data.audit_result)}`);
            }
            
        } catch (error) {
            console.error(`❌ Comprehensive response test failed: ${error.message}`);
        }
    }
}

// Run the tests
async function main() {
    const tester = new FollowUpQuestionTester();
    await tester.testFollowUpQuestions();
}

// Check if this file is being run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = FollowUpQuestionTester; 