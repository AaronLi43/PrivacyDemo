const axios = require('axios');

class AllQuestionsTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = [];
        this.allResponses = [];
    }

    async runFullTest() {
        console.log('🧪 Starting comprehensive test of ALL predefined questions...\n');
        
        try {
            // Test 1: Check server connection
            await this.testServerConnection();
            
            // Test 2: Test all predefined questions
            await this.testAllQuestions();
            
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

    async testAllQuestions() {
        console.log('\n🎯 Testing ALL predefined questions...');
        
        try {
            // Reset conversation first
            await axios.post(`${this.baseURL}/api/reset`);
            console.log('✅ Conversation reset');
            
            // Get all predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const allQuestions = questionsResponse.data.questions;
            
            console.log(`📝 Testing ${allQuestions.length} total questions...\n`);
            
            let step = 1;
            for (let i = 0; i < allQuestions.length; i++) {
                const question = allQuestions[i];
                const isBackground = i < 3;
                const questionType = isBackground ? 'BACKGROUND' : 'MAIN';
                
                console.log(`\n${'='.repeat(80)}`);
                console.log(`📋 QUESTION ${i + 1}/${allQuestions.length} (${questionType})`);
                console.log(`${'='.repeat(80)}`);
                console.log(`Question: "${question}"`);
                
                // Send a response
                const userResponse = this.getResponseForQuestion(i, question);
                console.log(`\n👤 User Response: "${userResponse}"`);
                
                const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                    message: userResponse,
                    step: step++,
                    questionMode: true,
                    currentQuestion: question,
                    predefinedQuestions: allQuestions,
                    isFinalQuestion: (i === allQuestions.length - 1)
                });
                
                console.log(`\n🤖 Bot Response: "${chatResponse.data.bot_response}"`);
                
                // Store the complete interaction
                const interaction = {
                    questionNumber: i + 1,
                    questionType: questionType,
                    question: question,
                    userResponse: userResponse,
                    botResponse: chatResponse.data.bot_response,
                    questionCompleted: chatResponse.data.question_completed,
                    followUpQuestions: chatResponse.data.follow_up_questions,
                    auditResult: chatResponse.data.audit_result
                };
                
                this.allResponses.push(interaction);
                
                // Check behavior based on question type
                if (isBackground) {
                    if (chatResponse.data.follow_up_questions && chatResponse.data.follow_up_questions.length > 0) {
                        console.log(`❌ FAIL: Background question triggered follow-up questions`);
                        console.log(`   Follow-up questions: ${chatResponse.data.follow_up_questions.join(', ')}`);
                        this.testResults.push({ 
                            test: `Question ${i + 1} (Background)`, 
                            status: 'FAIL', 
                            error: 'Background question triggered follow-up questions' 
                        });
                    } else {
                        console.log('✅ PASS: Background question handled correctly (no follow-up)');
                        this.testResults.push({ 
                            test: `Question ${i + 1} (Background)`, 
                            status: 'PASS' 
                        });
                    }
                } else {
                    if (chatResponse.data.follow_up_questions && chatResponse.data.follow_up_questions.length > 0) {
                        console.log(`✅ PASS: Main question triggered follow-up questions (expected behavior)`);
                        console.log(`   Follow-up questions: ${chatResponse.data.follow_up_questions.join(', ')}`);
                    } else {
                        console.log('✅ PASS: Main question handled (no follow-up needed)');
                    }
                    this.testResults.push({ 
                        test: `Question ${i + 1} (Main)`, 
                        status: 'PASS' 
                    });
                }
                
                // Show completion status
                if (chatResponse.data.question_completed) {
                    console.log('✅ Question marked as completed');
                } else {
                    console.log('⚠️ Question not marked as completed');
                }
                
                // Show audit result if available
                if (chatResponse.data.audit_result) {
                    console.log(`🔍 Audit Result: ${chatResponse.data.audit_result.reason} (confidence: ${chatResponse.data.audit_result.confidence})`);
                }
                
                // Add delay between questions
                await this.delay(2000);
            }
            
        } catch (error) {
            console.log('❌ All questions test failed:', error.message);
            this.testResults.push({ 
                test: 'All Questions Flow', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    getResponseForQuestion(questionIndex, question) {
        // Create more varied and realistic responses based on the question
        const responses = {
            // Background questions
            0: "I studied computer science at UCLA, focusing on artificial intelligence and machine learning. I graduated in 2022.",
            1: "I work as a senior software engineer at a tech startup in Silicon Valley. I've been there for about 3 years now.",
            2: "I've been exploring AI tools for about 2 years, starting with ChatGPT when it first came out. I've also tried Claude, Gemini, and various other platforms.",
            
            // Main questions - more detailed responses
            3: "I first got interested when ChatGPT was released in late 2022. I was amazed by its ability to help with coding problems and thought it could be useful for interview preparation.",
            4: "I used ChatGPT to help me prepare for a Google interview last year. I asked it to generate practice coding problems and explain solutions step by step.",
            5: "Yes, AI was definitely a game-changer for my interview prep. It helped me understand complex algorithms much faster than studying alone.",
            6: "I relied on AI mostly for coding practice, algorithm explanations, and mock interview questions. It was especially helpful for system design questions.",
            7: "I saved some particularly good AI-generated explanations for common algorithms like dynamic programming and graph traversal.",
            8: "I was proud of using AI to help me understand the sliding window technique for array problems. The explanation was so clear.",
            9: "Yes, I felt much more confident going into interviews knowing I had AI as a backup for understanding concepts.",
            10: "I considered using AI during a live coding interview once, but decided against it. I wanted to demonstrate my actual skills.",
            11: "I prepared AI-generated notes on common interview topics and had them ready on a separate screen during phone interviews.",
            12: "I ran ChatGPT in the background during a take-home coding challenge. It helped me debug some tricky edge cases.",
            13: "AI gave me a real edge when I was asked about machine learning concepts. I had practiced explaining them with AI's help.",
            14: "I presented an AI-generated solution to a system design problem as my own. I had modified it significantly, but the core idea came from AI.",
            15: "I had a close call when an interviewer asked me to explain a solution I got from AI. I had to quickly understand it on the spot.",
            16: "Looking back, I think using AI to generate entire solutions crossed a line. I should have used it more for learning than for answers.",
            17: "AI backfired when I used a solution I didn't fully understand. The interviewer asked follow-up questions I couldn't answer.",
            18: "I draw the line at using AI to understand concepts versus using it to generate complete solutions. Learning is okay, copying is not.",
            19: "My friends and I have had long discussions about this. Most think using AI for learning is fine, but using it during interviews is cheating.",
            20: "If I could do it over, I would use AI more for learning and less for generating answers. It's a great tool for understanding, not for shortcuts.",
            21: "I have a funny story about accidentally asking ChatGPT a question during a phone interview. I forgot to mute my computer and the interviewer heard the AI response!"
        };
        
        // Return specific response if available, otherwise use a generic one
        if (responses[questionIndex] !== undefined) {
            return responses[questionIndex];
        }
        
        // Generic responses for any remaining questions
        const genericResponses = [
            "That's an interesting question. I think it depends on the specific situation and how you use the tools.",
            "I've had mixed experiences with this. Sometimes it works well, other times it doesn't.",
            "It's a complex topic that requires careful consideration of the ethical implications.",
            "I believe in using technology responsibly and being transparent about how you use it.",
            "This is something I'm still learning about and trying to figure out the best approach."
        ];
        
        return genericResponses[questionIndex % genericResponses.length];
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printTestResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 TEST RESULTS SUMMARY');
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
            console.log('🎉 ALL TESTS PASSED! All questions are working correctly.');
        } else {
            console.log('⚠️ Some tests failed. Please review the results above.');
        }
        console.log('='.repeat(80));
    }

    printAllResponses() {
        console.log('\n' + '='.repeat(80));
        console.log('📝 ALL QUESTION RESPONSES');
        console.log('='.repeat(80));
        
        this.allResponses.forEach((interaction, index) => {
            console.log(`\n${'─'.repeat(80)}`);
            console.log(`Question ${interaction.questionNumber} (${interaction.questionType})`);
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
        });
        
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📊 SUMMARY: Tested ${this.allResponses.length} questions total`);
        console.log(`Background Questions: ${this.allResponses.filter(r => r.questionType === 'BACKGROUND').length}`);
        console.log(`Main Questions: ${this.allResponses.filter(r => r.questionType === 'MAIN').length}`);
        console.log(`Questions with Follow-ups: ${this.allResponses.filter(r => r.followUpQuestions && r.followUpQuestions.length > 0).length}`);
        console.log(`Completed Questions: ${this.allResponses.filter(r => r.questionCompleted).length}`);
        console.log(`${'─'.repeat(80)}`);
    }
}

// Run the test
async function runTest() {
    const tester = new AllQuestionsTester();
    await tester.runFullTest();
}

runTest().catch(console.error); 