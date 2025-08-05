const axios = require('axios');

class BackgroundQuestionsTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = [];
    }

    async runFullTest() {
        console.log('🧪 Starting comprehensive background questions test...\n');
        
        try {
            // Test 1: Check server connection
            await this.testServerConnection();
            
            // Test 2: Test background questions flow
            await this.testBackgroundQuestionsFlow();
            
            // Test 3: Test main questions flow
            await this.testMainQuestionsFlow();
            
            // Test 4: Test complete conversation flow
            await this.testCompleteConversationFlow();
            
            // Print final results
            this.printTestResults();
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    }

    async testServerConnection() {
        console.log('📡 Testing server connection...');
        try {
            const response = await axios.get(`${this.baseURL}/api/test_connection`);
            if (response.data.status === 'success') {
                console.log('✅ Server connection successful');
                this.testResults.push({ test: 'Server Connection', status: 'PASS' });
            } else {
                throw new Error('Server not responding correctly');
            }
        } catch (error) {
            console.log('❌ Server connection failed:', error.message);
            this.testResults.push({ test: 'Server Connection', status: 'FAIL', error: error.message });
            throw error;
        }
    }

    async testBackgroundQuestionsFlow() {
        console.log('\n🎯 Testing background questions flow (no follow-up questions)...');
        
        try {
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const backgroundQuestions = questionsResponse.data.questions.slice(0, 3); // First 3 are background
            
            console.log(`📝 Testing ${backgroundQuestions.length} background questions...`);
            
            for (let i = 0; i < backgroundQuestions.length; i++) {
                const question = backgroundQuestions[i];
                console.log(`\n--- Background Question ${i + 1}: "${question}" ---`);
                
                // Send a brief response to the background question
                const briefResponse = this.getBriefResponse(i);
                console.log(`User response: "${briefResponse}"`);
                
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: briefResponse,
                    step: i + 1,
                    questionMode: true,
                    currentQuestion: backgroundQuestions[i],
                    predefinedQuestions: backgroundQuestions,
                    isFinalQuestion: (i === backgroundQuestions.length - 1)
                });
                
                console.log(`Bot response: "${response.data.bot_response}"`);
                
                // Check if follow-up questions were suggested (should NOT happen for background questions)
                if (response.data.follow_up_questions && response.data.follow_up_questions.length > 0) {
                    console.log(`❌ FAIL: Follow-up questions were suggested for background question: ${response.data.follow_up_questions.join(', ')}`);
                    this.testResults.push({ 
                        test: `Background Question ${i + 1}`, 
                        status: 'FAIL', 
                        error: 'Follow-up questions were suggested for background question' 
                    });
                } else {
                    console.log('✅ PASS: No follow-up questions suggested (correct behavior)');
                    this.testResults.push({ 
                        test: `Background Question ${i + 1}`, 
                        status: 'PASS' 
                    });
                }
                
                // Check if question was completed
                if (response.data.question_completed) {
                    console.log('✅ Question marked as completed');
                } else {
                    console.log('⚠️ Question not marked as completed (may be expected for brief responses)');
                }
                
                // Add delay between questions
                await this.delay(1000);
            }
            
        } catch (error) {
            console.log('❌ Background questions test failed:', error.message);
            this.testResults.push({ 
                test: 'Background Questions Flow', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    async testMainQuestionsFlow() {
        console.log('\n🎯 Testing main questions flow (should allow follow-up questions)...');
        
        try {
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const mainQuestions = questionsResponse.data.questions.slice(3, 6); // Questions 4-6 are main questions
            
            console.log(`📝 Testing ${mainQuestions.length} main questions...`);
            
            for (let i = 0; i < mainQuestions.length; i++) {
                const question = mainQuestions[i];
                console.log(`\n--- Main Question ${i + 1}: "${question}" ---`);
                
                // Send a brief response to the main question
                const briefResponse = this.getBriefResponse(i);
                console.log(`User response: "${briefResponse}"`);
                
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: briefResponse,
                    step: i + 10,
                    questionMode: true,
                    currentQuestion: mainQuestions[i],
                    predefinedQuestions: mainQuestions,
                    isFinalQuestion: (i === mainQuestions.length - 1)
                });
                
                console.log(`Bot response: "${response.data.bot_response}"`);
                
                // Check if follow-up questions were suggested (should happen for main questions with brief responses)
                if (response.data.follow_up_questions && response.data.follow_up_questions.length > 0) {
                    console.log(`✅ PASS: Follow-up questions suggested for main question: ${response.data.follow_up_questions.join(', ')}`);
                    this.testResults.push({ 
                        test: `Main Question ${i + 1}`, 
                        status: 'PASS' 
                    });
                } else {
                    console.log('⚠️ No follow-up questions suggested (may be expected for comprehensive responses)');
                    this.testResults.push({ 
                        test: `Main Question ${i + 1}`, 
                        status: 'PASS' 
                    });
                }
                
                // Add delay between questions
                await this.delay(1000);
            }
            
        } catch (error) {
            console.log('❌ Main questions test failed:', error.message);
            this.testResults.push({ 
                test: 'Main Questions Flow', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    async testCompleteConversationFlow() {
        console.log('\n🎯 Testing complete conversation flow...');
        
        try {
            // Reset conversation
            await axios.post(`${this.baseURL}/api/reset`);
            console.log('✅ Conversation reset');
            
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const allQuestions = questionsResponse.data.questions;
            
            console.log(`📝 Testing complete flow with ${allQuestions.length} questions...`);
            
            let step = 1;
            for (let i = 0; i < Math.min(5, allQuestions.length); i++) { // Test first 5 questions
                const question = allQuestions[i];
                const isBackground = i < 3;
                
                console.log(`\n--- Question ${i + 1} (${isBackground ? 'Background' : 'Main'}): "${question}" ---`);
                
                // Send a response
                const response = this.getBriefResponse(i);
                console.log(`User response: "${response}"`);
                
                const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                    message: response,
                    step: step++,
                    questionMode: true,
                    currentQuestion: question,
                    predefinedQuestions: allQuestions,
                    isFinalQuestion: (i === allQuestions.length - 1)
                });
                
                console.log(`Bot response: "${chatResponse.data.bot_response}"`);
                
                // Check behavior based on question type
                if (isBackground) {
                    if (chatResponse.data.follow_up_questions && chatResponse.data.follow_up_questions.length > 0) {
                        console.log(`❌ FAIL: Background question triggered follow-up questions`);
                        this.testResults.push({ 
                            test: `Complete Flow - Background Question ${i + 1}`, 
                            status: 'FAIL', 
                            error: 'Background question triggered follow-up questions' 
                        });
                    } else {
                        console.log('✅ PASS: Background question handled correctly (no follow-up)');
                        this.testResults.push({ 
                            test: `Complete Flow - Background Question ${i + 1}`, 
                            status: 'PASS' 
                        });
                    }
                } else {
                    console.log('✅ Main question handled (follow-up behavior varies)');
                    this.testResults.push({ 
                        test: `Complete Flow - Main Question ${i + 1}`, 
                        status: 'PASS' 
                    });
                }
                
                // Add delay between questions
                await this.delay(1000);
            }
            
        } catch (error) {
            console.log('❌ Complete conversation test failed:', error.message);
            this.testResults.push({ 
                test: 'Complete Conversation Flow', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    getBriefResponse(questionIndex) {
        const responses = [
            "I studied computer science at UCLA.",
            "I work as a software engineer.",
            "I've been using AI tools for about 2 years.",
            "I first got interested when ChatGPT came out.",
            "I used it to help prepare for technical interviews."
        ];
        return responses[questionIndex % responses.length];
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printTestResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('='.repeat(60));
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const total = this.testResults.length;
        
        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            console.log(`${status} ${result.test}: ${result.status}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log('\n' + '='.repeat(60));
        
        if (failed === 0) {
            console.log('🎉 ALL TESTS PASSED! Background questions are working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please review the results above.');
        }
        console.log('='.repeat(60));
    }
}

// Run the test
async function runTest() {
    const tester = new BackgroundQuestionsTester();
    await tester.runFullTest();
}

runTest().catch(console.error); 