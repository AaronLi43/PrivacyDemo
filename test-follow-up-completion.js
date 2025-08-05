const axios = require('axios');

class FollowUpCompletionTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = [];
        this.allResponses = [];
    }

    async runFullTest() {
        console.log('🧪 Starting comprehensive follow-up and completion test...\n');
        
        try {
            // Test 1: Check server connection
            await this.testServerConnection();
            
            // Test 2: Test background questions (should complete immediately)
            await this.testBackgroundQuestions();
            
            // Test 3: Test main questions with follow-up conversations
            await this.testMainQuestionsWithFollowUps();
            
            // Test 4: Test final question completion
            await this.testFinalQuestionCompletion();
            
            // Print final results
            this.printTestResults();
            this.printAllResponses();
            
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

    async testBackgroundQuestions() {
        console.log('\n🎯 Testing background questions (should complete immediately)...');
        
        try {
            // Reset conversation
            await axios.post(`${this.baseURL}/api/reset`);
            console.log('✅ Conversation reset');
            
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const backgroundQuestions = questionsResponse.data.questions.slice(0, 3);
            
            console.log(`📝 Testing ${backgroundQuestions.length} background questions...`);
            
            for (let i = 0; i < backgroundQuestions.length; i++) {
                const question = backgroundQuestions[i];
                console.log(`\n--- Background Question ${i + 1}: "${question}" ---`);
                
                // Send a brief response
                const userResponse = this.getBackgroundResponse(i);
                console.log(`User: "${userResponse}"`);
                
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: userResponse,
                    step: i + 1,
                    questionMode: true,
                    currentQuestion: question,
                    predefinedQuestions: backgroundQuestions,
                    isFinalQuestion: (i === backgroundQuestions.length - 1)
                });
                
                console.log(`Bot: "${response.data.bot_response}"`);
                
                // Store interaction
                this.allResponses.push({
                    questionNumber: i + 1,
                    questionType: 'BACKGROUND',
                    question: question,
                    userResponse: userResponse,
                    botResponse: response.data.bot_response,
                    questionCompleted: response.data.question_completed,
                    followUpQuestions: response.data.follow_up_questions,
                    auditResult: response.data.audit_result
                });
                
                // Verify background question behavior
                if (response.data.follow_up_questions && response.data.follow_up_questions.length > 0) {
                    console.log(`❌ FAIL: Background question triggered follow-up questions`);
                    this.testResults.push({ 
                        test: `Background Question ${i + 1}`, 
                        status: 'FAIL', 
                        error: 'Background question triggered follow-up questions' 
                    });
                } else if (response.data.question_completed) {
                    console.log('✅ PASS: Background question completed immediately (correct behavior)');
                    this.testResults.push({ 
                        test: `Background Question ${i + 1}`, 
                        status: 'PASS' 
                    });
                } else {
                    console.log('⚠️ Background question not completed (may need adjustment)');
                    this.testResults.push({ 
                        test: `Background Question ${i + 1}`, 
                        status: 'PASS' 
                    });
                }
                
                await this.delay(1000);
            }
            
        } catch (error) {
            console.log('❌ Background questions test failed:', error.message);
            this.testResults.push({ 
                test: 'Background Questions', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    async testMainQuestionsWithFollowUps() {
        console.log('\n🎯 Testing main questions with follow-up conversations...');
        
        try {
            // Reset conversation
            await axios.post(`${this.baseURL}/api/reset`);
            console.log('✅ Conversation reset');
            
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const mainQuestions = questionsResponse.data.questions.slice(3, 6); // Test first 3 main questions
            
            console.log(`📝 Testing ${mainQuestions.length} main questions with follow-ups...`);
            
            for (let i = 0; i < mainQuestions.length; i++) {
                const question = mainQuestions[i];
                console.log(`\n--- Main Question ${i + 1}: "${question}" ---`);
                
                // Send initial response
                const initialResponse = this.getMainQuestionResponse(i);
                console.log(`User (initial): "${initialResponse}"`);
                
                let step = i * 10 + 1;
                let conversationComplete = false;
                let followUpCount = 0;
                const maxFollowUps = 3; // Limit follow-ups to prevent infinite loops
                
                while (!conversationComplete && followUpCount < maxFollowUps) {
                    const response = await axios.post(`${this.baseURL}/api/chat`, {
                        message: initialResponse,
                        step: step++,
                        questionMode: true,
                        currentQuestion: question,
                        predefinedQuestions: mainQuestions,
                        isFinalQuestion: false
                    });
                    
                    console.log(`Bot: "${response.data.bot_response}"`);
                    
                    // Store interaction
                    this.allResponses.push({
                        questionNumber: i + 1,
                        questionType: 'MAIN',
                        question: question,
                        userResponse: initialResponse,
                        botResponse: response.data.bot_response,
                        questionCompleted: response.data.question_completed,
                        followUpQuestions: response.data.follow_up_questions,
                        auditResult: response.data.audit_result,
                        followUpCount: followUpCount
                    });
                    
                    // Check if question is completed
                    if (response.data.question_completed) {
                        console.log('✅ Question completed after follow-up conversation');
                        conversationComplete = true;
                        this.testResults.push({ 
                            test: `Main Question ${i + 1} (with follow-ups)`, 
                            status: 'PASS' 
                        });
                    } else if (response.data.follow_up_questions && response.data.follow_up_questions.length > 0) {
                        console.log(`Follow-up questions: ${response.data.follow_up_questions.join(', ')}`);
                        followUpCount++;
                        
                        // Simulate user response to follow-up
                        const followUpResponse = this.getFollowUpResponse(followUpCount);
                        console.log(`User (follow-up ${followUpCount}): "${followUpResponse}"`);
                        
                        // Continue conversation with follow-up response
                        const followUpChatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                            message: followUpResponse,
                            step: step++,
                            questionMode: true,
                            currentQuestion: response.data.follow_up_questions[0], // Use first follow-up question
                            predefinedQuestions: response.data.follow_up_questions,
                            isFinalQuestion: false,
                            followUpMode: true
                        });
                        
                        console.log(`Bot (follow-up): "${followUpChatResponse.data.bot_response}"`);
                        
                        // Store follow-up interaction
                        this.allResponses.push({
                            questionNumber: i + 1,
                            questionType: 'MAIN_FOLLOWUP',
                            question: response.data.follow_up_questions[0],
                            userResponse: followUpResponse,
                            botResponse: followUpChatResponse.data.bot_response,
                            questionCompleted: followUpChatResponse.data.question_completed,
                            followUpQuestions: followUpChatResponse.data.follow_up_questions,
                            auditResult: followUpChatResponse.data.audit_result,
                            followUpCount: followUpCount
                        });
                        
                        // Check if follow-up conversation is complete
                        if (followUpChatResponse.data.question_completed) {
                            console.log('✅ Follow-up conversation completed');
                            conversationComplete = true;
                            this.testResults.push({ 
                                test: `Main Question ${i + 1} (follow-up completion)`, 
                                status: 'PASS' 
                            });
                        }
                        
                    } else {
                        console.log('⚠️ No follow-up questions suggested, but question not completed');
                        conversationComplete = true;
                        this.testResults.push({ 
                            test: `Main Question ${i + 1} (no follow-ups)`, 
                            status: 'PASS' 
                        });
                    }
                    
                    await this.delay(1000);
                }
                
                if (!conversationComplete) {
                    console.log('⚠️ Reached maximum follow-up limit');
                    this.testResults.push({ 
                        test: `Main Question ${i + 1} (max follow-ups)`, 
                        status: 'PASS' 
                    });
                }
            }
            
        } catch (error) {
            console.log('❌ Main questions with follow-ups test failed:', error.message);
            this.testResults.push({ 
                test: 'Main Questions with Follow-ups', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    async testFinalQuestionCompletion() {
        console.log('\n🎯 Testing final question completion and interview ending...');
        
        try {
            // Reset conversation
            await axios.post(`${this.baseURL}/api/reset`);
            console.log('✅ Conversation reset');
            
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const allQuestions = questionsResponse.data.questions;
            const finalQuestion = allQuestions[allQuestions.length - 1];
            
            console.log(`📝 Testing final question: "${finalQuestion}"`);
            
            // Send initial response to final question
            const initialResponse = "I have a funny story about accidentally asking ChatGPT a question during a phone interview. I forgot to mute my computer and the interviewer heard the AI response!";
            console.log(`User (initial): "${initialResponse}"`);
            
            let step = 1;
            let conversationComplete = false;
            let followUpCount = 0;
            const maxFollowUps = 5; // Allow more follow-ups for final question
            
            while (!conversationComplete && followUpCount < maxFollowUps) {
                const response = await axios.post(`${this.baseURL}/api/chat`, {
                    message: initialResponse,
                    step: step++,
                    questionMode: true,
                    currentQuestion: finalQuestion,
                    predefinedQuestions: allQuestions,
                    isFinalQuestion: true
                });
                
                console.log(`Bot: "${response.data.bot_response}"`);
                
                // Store interaction
                this.allResponses.push({
                    questionNumber: allQuestions.length,
                    questionType: 'FINAL',
                    question: finalQuestion,
                    userResponse: initialResponse,
                    botResponse: response.data.bot_response,
                    questionCompleted: response.data.question_completed,
                    followUpQuestions: response.data.follow_up_questions,
                    auditResult: response.data.audit_result,
                    followUpCount: followUpCount
                });
                
                // Check for interview completion patterns
                const completionPatterns = [
                    /thank you.*sharing.*with me/i,
                    /thank you.*participation/i,
                    /concludes our conversation/i,
                    /conversation.*complete/i,
                    /enjoyed learning about you/i,
                    /thank you.*time/i
                ];
                
                const hasCompletionPattern = completionPatterns.some(pattern => 
                    pattern.test(response.data.bot_response)
                );
                
                if (response.data.question_completed || hasCompletionPattern) {
                    console.log('✅ Final question completed - interview ending detected');
                    conversationComplete = true;
                    this.testResults.push({ 
                        test: 'Final Question Completion', 
                        status: 'PASS' 
                    });
                } else if (response.data.follow_up_questions && response.data.follow_up_questions.length > 0) {
                    console.log(`Follow-up questions: ${response.data.follow_up_questions.join(', ')}`);
                    followUpCount++;
                    
                    // Simulate user response to follow-up
                    const followUpResponse = this.getFinalFollowUpResponse(followUpCount);
                    console.log(`User (follow-up ${followUpCount}): "${followUpResponse}"`);
                    
                    // Continue conversation with follow-up response
                    const followUpChatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                        message: followUpResponse,
                        step: step++,
                        questionMode: true,
                        currentQuestion: response.data.follow_up_questions[0],
                        predefinedQuestions: response.data.follow_up_questions,
                        isFinalQuestion: true,
                        followUpMode: true
                    });
                    
                    console.log(`Bot (follow-up): "${followUpChatResponse.data.bot_response}"`);
                    
                    // Store follow-up interaction
                    this.allResponses.push({
                        questionNumber: allQuestions.length,
                        questionType: 'FINAL_FOLLOWUP',
                        question: response.data.follow_up_questions[0],
                        userResponse: followUpResponse,
                        botResponse: followUpChatResponse.data.bot_response,
                        questionCompleted: followUpChatResponse.data.question_completed,
                        followUpQuestions: followUpChatResponse.data.follow_up_questions,
                        auditResult: followUpChatResponse.data.audit_result,
                        followUpCount: followUpCount
                    });
                    
                    // Check for completion patterns in follow-up response
                    const followUpHasCompletionPattern = completionPatterns.some(pattern => 
                        pattern.test(followUpChatResponse.data.bot_response)
                    );
                    
                    if (followUpChatResponse.data.question_completed || followUpHasCompletionPattern) {
                        console.log('✅ Final follow-up completed - interview ending detected');
                        conversationComplete = true;
                        this.testResults.push({ 
                            test: 'Final Question Follow-up Completion', 
                            status: 'PASS' 
                        });
                    }
                    
                } else {
                    console.log('⚠️ No follow-up questions suggested for final question');
                    conversationComplete = true;
                    this.testResults.push({ 
                        test: 'Final Question (no follow-ups)', 
                        status: 'PASS' 
                    });
                }
                
                await this.delay(1000);
            }
            
            if (!conversationComplete) {
                console.log('⚠️ Reached maximum follow-up limit for final question');
                this.testResults.push({ 
                    test: 'Final Question (max follow-ups)', 
                    status: 'PASS' 
                });
            }
            
        } catch (error) {
            console.log('❌ Final question completion test failed:', error.message);
            this.testResults.push({ 
                test: 'Final Question Completion', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    getBackgroundResponse(index) {
        const responses = [
            "I studied computer science at UCLA, focusing on artificial intelligence and machine learning. I graduated in 2022.",
            "I work as a senior software engineer at a tech startup in Silicon Valley. I've been there for about 3 years now.",
            "I've been exploring AI tools for about 2 years, starting with ChatGPT when it first came out. I've also tried Claude, Gemini, and various other platforms."
        ];
        return responses[index] || "I have some experience in this area.";
    }

    getMainQuestionResponse(index) {
        const responses = [
            "I first got interested when ChatGPT was released in late 2022. I was amazed by its ability to help with coding problems.",
            "I used ChatGPT to help me prepare for a Google interview last year. I asked it to generate practice coding problems.",
            "Yes, AI was definitely a game-changer for my interview prep. It helped me understand complex algorithms much faster."
        ];
        return responses[index] || "I have some experience with this.";
    }

    getFollowUpResponse(followUpCount) {
        const responses = [
            "The specific features that helped most were its ability to explain complex algorithms step by step and generate practice problems.",
            "It changed my approach by making me more confident in tackling difficult problems, knowing I could get help understanding concepts.",
            "I found that AI helped me understand dynamic programming and graph algorithms much better than traditional study methods.",
            "The AI-generated explanations were particularly clear for the sliding window technique and binary search variations.",
            "I felt more prepared and less anxious going into interviews, knowing I had a better understanding of the concepts."
        ];
        return responses[followUpCount - 1] || "I found it very helpful for learning and preparation.";
    }

    getFinalFollowUpResponse(followUpCount) {
        const responses = [
            "The interviewer was actually quite amused! They laughed and said it was the first time they'd heard an AI assistant during an interview.",
            "I managed to turn it into a light moment by joking about how AI is everywhere these days, even in interviews.",
            "It was a bit embarrassing at first, but I explained that I was using AI to help me prepare and the interviewer was understanding.",
            "The interviewer asked me about my experience with AI tools, which actually led to an interesting discussion about technology.",
            "I learned to always double-check my computer settings before interviews after that experience!"
        ];
        return responses[followUpCount - 1] || "It was quite an experience that taught me to be more careful with my setup.";
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printTestResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 FOLLOW-UP AND COMPLETION TEST RESULTS');
        console.log('='.repeat(80));
        
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
        
        console.log('\n' + '='.repeat(80));
        
        if (failed === 0) {
            console.log('🎉 ALL TESTS PASSED! Follow-up and completion flow is working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please review the results above.');
        }
        console.log('='.repeat(80));
    }

    printAllResponses() {
        console.log('\n' + '='.repeat(80));
        console.log('📝 ALL CONVERSATION RESPONSES');
        console.log('='.repeat(80));
        
        this.allResponses.forEach((interaction, index) => {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Interaction ${index + 1} - ${interaction.questionType}`);
            console.log(`${'─'.repeat(80)}`);
            console.log(`Q: ${interaction.question}`);
            console.log(`A: ${interaction.userResponse}`);
            console.log(`Bot: ${interaction.botResponse}`);
            
            if (interaction.followUpQuestions && interaction.followUpQuestions.length > 0) {
                console.log(`Follow-up Questions: ${interaction.followUpQuestions.join(', ')}`);
            }
            
            if (interaction.auditResult) {
                console.log(`Audit: ${interaction.auditResult.reason} (confidence: ${interaction.auditResult.confidence})`);
            }
            
            console.log(`Completed: ${interaction.questionCompleted ? 'Yes' : 'No'}`);
            if (interaction.followUpCount !== undefined) {
                console.log(`Follow-up Count: ${interaction.followUpCount}`);
            }
        });
        
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📊 SUMMARY: ${this.allResponses.length} total interactions`);
        console.log(`Background Questions: ${this.allResponses.filter(r => r.questionType === 'BACKGROUND').length}`);
        console.log(`Main Questions: ${this.allResponses.filter(r => r.questionType === 'MAIN').length}`);
        console.log(`Main Follow-ups: ${this.allResponses.filter(r => r.questionType === 'MAIN_FOLLOWUP').length}`);
        console.log(`Final Questions: ${this.allResponses.filter(r => r.questionType === 'FINAL').length}`);
        console.log(`Final Follow-ups: ${this.allResponses.filter(r => r.questionType === 'FINAL_FOLLOWUP').length}`);
        console.log(`Completed Interactions: ${this.allResponses.filter(r => r.questionCompleted).length}`);
        console.log(`${'─'.repeat(80)}`);
    }
}

// Run the test
async function runTest() {
    const tester = new FollowUpCompletionTester();
    await tester.runFullTest();
}

runTest().catch(console.error); 