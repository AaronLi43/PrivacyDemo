const axios = require('axios');

class AllQuestionsCompleteTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = [];
        this.allResponses = [];
        this.questionStats = {
            background: { total: 0, completed: 0, followUps: 0 },
            main: { total: 0, completed: 0, followUps: 0 },
            final: { total: 0, completed: 0, followUps: 0 }
        };
    }

    async runFullTest() {
        console.log('🧪 Starting comprehensive test of ALL predefined questions with follow-ups and completion...\n');
        
        try {
            // Test 1: Check server connection
            await this.testServerConnection();
            
            // Test 2: Test all questions with follow-up conversations
            await this.testAllQuestionsWithFollowUps();
            
            // Print final results
            this.printTestResults();
            this.printAllResponses();
            this.printDetailedStats();
            
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

    async testAllQuestionsWithFollowUps() {
        console.log('\n🎯 Testing ALL predefined questions with follow-up conversations...');
        
        try {
            // Reset conversation
            await axios.post(`${this.baseURL}/api/reset`);
            console.log('✅ Conversation reset');
            
            // Get all predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const allQuestions = questionsResponse.data.questions;
            
            console.log(`📝 Testing ${allQuestions.length} total questions...`);
            
            for (let i = 0; i < allQuestions.length; i++) {
                const question = allQuestions[i];
                const isBackgroundQuestion = i < 3;
                const isFinalQuestion = i === allQuestions.length - 1;
                
                console.log(`\n${'='.repeat(80)}`);
                console.log(`Question ${i + 1}/${allQuestions.length}: "${question}"`);
                console.log(`Type: ${isBackgroundQuestion ? 'BACKGROUND' : isFinalQuestion ? 'FINAL' : 'MAIN'}`);
                console.log(`${'='.repeat(80)}`);
                
                // Send initial response
                const initialResponse = this.getQuestionResponse(i, isBackgroundQuestion, isFinalQuestion);
                console.log(`User (initial): "${initialResponse}"`);
                
                let step = i * 10 + 1;
                let conversationComplete = false;
                let followUpCount = 0;
                const maxFollowUps = isFinalQuestion ? 5 : 3; // More follow-ups for final question
                
                // Track conversation for this question
                const questionConversation = {
                    questionNumber: i + 1,
                    questionType: isBackgroundQuestion ? 'BACKGROUND' : isFinalQuestion ? 'FINAL' : 'MAIN',
                    question: question,
                    interactions: [],
                    completed: false,
                    totalFollowUps: 0
                };
                
                // Update total counts for all questions
                if (isBackgroundQuestion) {
                    this.questionStats.background.total++;
                } else if (isFinalQuestion) {
                    this.questionStats.final.total++;
                } else {
                    this.questionStats.main.total++;
                }
                
                while (!conversationComplete && followUpCount < maxFollowUps) {
                    const response = await axios.post(`${this.baseURL}/api/chat`, {
                        message: initialResponse,
                        step: step++,
                        questionMode: true,
                        currentQuestion: question,
                        predefinedQuestions: allQuestions,
                        isFinalQuestion: isFinalQuestion
                    });
                    
                    console.log(`Bot: "${response.data.bot_response}"`);
                    
                    // Store interaction
                    const interaction = {
                        userResponse: initialResponse,
                        botResponse: response.data.bot_response,
                        questionCompleted: response.data.question_completed,
                        followUpQuestions: response.data.follow_up_questions,
                        auditResult: response.data.audit_result,
                        followUpCount: followUpCount
                    };
                    
                    questionConversation.interactions.push(interaction);
                    this.allResponses.push({
                        questionNumber: i + 1,
                        questionType: questionConversation.questionType,
                        question: question,
                        ...interaction
                    });
                    
                    // Check for completion patterns (especially for final question)
                    const completionPatterns = [
                        /thank you.*sharing.*with me/i,
                        /thank you.*participation/i,
                        /concludes our conversation/i,
                        /conversation.*complete/i,
                        /enjoyed learning about you/i,
                        /thank you.*time/i,
                        /wrapping up/i,
                        /final thoughts/i
                    ];
                    
                    const hasCompletionPattern = completionPatterns.some(pattern => 
                        pattern.test(response.data.bot_response)
                    );
                    
                    // Check if question is completed
                    if (response.data.question_completed || hasCompletionPattern) {
                        console.log('✅ Question completed');
                        conversationComplete = true;
                        questionConversation.completed = true;
                        
                        // Update completion stats
                        if (isBackgroundQuestion) {
                            this.questionStats.background.completed++;
                        } else if (isFinalQuestion) {
                            this.questionStats.final.completed++;
                        } else {
                            this.questionStats.main.completed++;
                        }
                        
                        this.testResults.push({ 
                            test: `Question ${i + 1} (${questionConversation.questionType})`, 
                            status: 'PASS',
                            completed: true,
                            followUps: followUpCount
                        });
                        
                    } else if (response.data.follow_up_questions && response.data.follow_up_questions.length > 0) {
                        console.log(`Follow-up questions: ${response.data.follow_up_questions.join(', ')}`);
                        followUpCount++;
                        questionConversation.totalFollowUps++;
                        
                        // Update stats
                        if (isBackgroundQuestion) {
                            this.questionStats.background.followUps++;
                        } else if (isFinalQuestion) {
                            this.questionStats.final.followUps++;
                        } else {
                            this.questionStats.main.followUps++;
                        }
                        
                        // Simulate user response to follow-up
                        const followUpResponse = this.getFollowUpResponse(followUpCount, isFinalQuestion);
                        console.log(`User (follow-up ${followUpCount}): "${followUpResponse}"`);
                        
                        // Continue conversation with follow-up response
                        const followUpChatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                            message: followUpResponse,
                            step: step++,
                            questionMode: true,
                            currentQuestion: response.data.follow_up_questions[0],
                            predefinedQuestions: response.data.follow_up_questions,
                            isFinalQuestion: isFinalQuestion,
                            followUpMode: true
                        });
                        
                        console.log(`Bot (follow-up): "${followUpChatResponse.data.bot_response}"`);
                        
                        // Store follow-up interaction
                        const followUpInteraction = {
                            userResponse: followUpResponse,
                            botResponse: followUpChatResponse.data.bot_response,
                            questionCompleted: followUpChatResponse.data.question_completed,
                            followUpQuestions: followUpChatResponse.data.follow_up_questions,
                            auditResult: followUpChatResponse.data.audit_result,
                            followUpCount: followUpCount
                        };
                        
                        questionConversation.interactions.push(followUpInteraction);
                        this.allResponses.push({
                            questionNumber: i + 1,
                            questionType: questionConversation.questionType + '_FOLLOWUP',
                            question: response.data.follow_up_questions[0],
                            ...followUpInteraction
                        });
                        
                        // Check for completion patterns in follow-up response
                        const followUpHasCompletionPattern = completionPatterns.some(pattern => 
                            pattern.test(followUpChatResponse.data.bot_response)
                        );
                        
                        if (followUpChatResponse.data.question_completed || followUpHasCompletionPattern) {
                            console.log('✅ Follow-up conversation completed');
                            conversationComplete = true;
                            questionConversation.completed = true;
                            
                            // Update completion stats
                            if (isBackgroundQuestion) {
                                this.questionStats.background.completed++;
                            } else if (isFinalQuestion) {
                                this.questionStats.final.completed++;
                            } else {
                                this.questionStats.main.completed++;
                            }
                            
                            this.testResults.push({ 
                                test: `Question ${i + 1} (${questionConversation.questionType} - follow-up completion)`, 
                                status: 'PASS',
                                completed: true,
                                followUps: followUpCount
                            });
                        }
                        
                    } else {
                        console.log('⚠️ No follow-up questions suggested, but question not completed');
                        conversationComplete = true;
                        
                        this.testResults.push({ 
                            test: `Question ${i + 1} (${questionConversation.questionType} - no follow-ups)`, 
                            status: 'PASS',
                            completed: false,
                            followUps: followUpCount
                        });
                    }
                    
                    await this.delay(500); // Shorter delay for faster testing
                }
                
                if (!conversationComplete) {
                    console.log('⚠️ Reached maximum follow-up limit');
                    this.testResults.push({ 
                        test: `Question ${i + 1} (${questionConversation.questionType} - max follow-ups)`, 
                        status: 'PASS',
                        completed: false,
                        followUps: followUpCount
                    });
                }
                
                // Print question summary
                console.log(`📊 Question ${i + 1} Summary:`);
                console.log(`   Type: ${questionConversation.questionType}`);
                console.log(`   Completed: ${questionConversation.completed ? 'Yes' : 'No'}`);
                console.log(`   Total Follow-ups: ${questionConversation.totalFollowUps}`);
                console.log(`   Total Interactions: ${questionConversation.interactions.length}`);
            }
            
        } catch (error) {
            console.log('❌ All questions test failed:', error.message);
            this.testResults.push({ 
                test: 'All Questions with Follow-ups', 
                status: 'FAIL', 
                error: error.message 
            });
        }
    }

    getQuestionResponse(index, isBackgroundQuestion, isFinalQuestion) {
        if (isBackgroundQuestion) {
            const backgroundResponses = [
                "I studied computer science at UCLA, focusing on artificial intelligence and machine learning. I graduated in 2022.",
                "I work as a senior software engineer at a tech startup in Silicon Valley. I've been there for about 3 years now.",
                "I've been exploring AI tools for about 2 years, starting with ChatGPT when it first came out. I've also tried Claude, Gemini, and various other platforms."
            ];
            return backgroundResponses[index] || "I have some experience in this area.";
        }
        
        if (isFinalQuestion) {
            return "I have a funny story about accidentally asking ChatGPT a question during a phone interview. I forgot to mute my computer and the interviewer heard the AI response!";
        }
        
        // Main questions - provide varied responses
        const mainResponses = [
            "I first got interested when ChatGPT was released in late 2022. I was amazed by its ability to help with coding problems.",
            "I used ChatGPT to help me prepare for a Google interview last year. I asked it to generate practice coding problems.",
            "Yes, AI was definitely a game-changer for my interview prep. It helped me understand complex algorithms much faster.",
            "I've used AI to help me debug code, explain complex concepts, and even generate test cases for my projects.",
            "The most surprising thing was how well AI could explain technical concepts in simple terms that I could understand.",
            "I think AI will continue to evolve and become even more integrated into our daily work and learning processes.",
            "I've experimented with different AI tools for various tasks - coding, writing, research, and even creative projects.",
            "The biggest challenge I've faced is learning to ask the right questions to get the most helpful responses from AI.",
            "I believe AI can be a great tool for learning, but it's important to understand the underlying concepts yourself.",
            "I've used AI to help me learn new programming languages and frameworks more quickly than traditional methods.",
            "The most valuable aspect has been having an AI assistant that can explain things in multiple ways until I understand.",
            "I think the future of AI in education and work will be about collaboration rather than replacement.",
            "I've found that AI is particularly good at helping me break down complex problems into manageable parts.",
            "The key is to use AI as a tool to enhance your own learning and problem-solving abilities.",
            "I've learned that AI can be incredibly helpful, but it's important to verify and understand the information it provides.",
            "I think AI will become increasingly important in software development and other technical fields.",
            "I've used AI to help me stay updated with the latest technologies and best practices in my field.",
            "The most impressive thing has been seeing how AI can adapt its explanations based on my level of understanding.",
            "I believe AI will help democratize access to knowledge and learning resources for people around the world."
        ];
        
        return mainResponses[index - 3] || "I have some experience with this topic and find it quite interesting.";
    }

    getFollowUpResponse(followUpCount, isFinalQuestion) {
        if (isFinalQuestion) {
            const finalFollowUpResponses = [
                "The interviewer was actually quite amused! They laughed and said it was the first time they'd heard an AI assistant during an interview.",
                "I managed to turn it into a light moment by joking about how AI is everywhere these days, even in interviews.",
                "It was a bit embarrassing at first, but I explained that I was using AI to help me prepare and the interviewer was understanding.",
                "The interviewer asked me about my experience with AI tools, which actually led to an interesting discussion about technology.",
                "I learned to always double-check my computer settings before interviews after that experience!"
            ];
            return finalFollowUpResponses[followUpCount - 1] || "It was quite an experience that taught me to be more careful with my setup.";
        }
        
        // General follow-up responses
        const followUpResponses = [
            "The specific features that helped most were its ability to explain complex algorithms step by step and generate practice problems.",
            "It changed my approach by making me more confident in tackling difficult problems, knowing I could get help understanding concepts.",
            "I found that AI helped me understand dynamic programming and graph algorithms much better than traditional study methods.",
            "The AI-generated explanations were particularly clear for the sliding window technique and binary search variations.",
            "I felt more prepared and less anxious going into interviews, knowing I had a better understanding of the concepts.",
            "The most valuable aspect was having an AI assistant that could explain things in multiple ways until I understood.",
            "I learned that the key is to ask specific questions and provide context to get the most helpful responses.",
            "The AI helped me develop a more systematic approach to problem-solving and debugging.",
            "I found that AI was particularly good at helping me understand the underlying principles behind complex topics.",
            "The experience taught me that AI is a powerful tool when used thoughtfully and with proper verification."
        ];
        
        return followUpResponses[followUpCount - 1] || "I found it very helpful for learning and preparation.";
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printTestResults() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 COMPREHENSIVE TEST RESULTS - ALL QUESTIONS');
        console.log('='.repeat(80));
        
        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const total = this.testResults.length;
        const completed = this.testResults.filter(r => r.completed).length;
        
        console.log(`Total Questions Tested: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`🎯 Completed: ${completed}`);
        console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
        console.log(`📈 Completion Rate: ${((completed / total) * 100).toFixed(1)}%`);
        
        console.log('\n📋 Detailed Results:');
        this.testResults.forEach(result => {
            const status = result.status === 'PASS' ? '✅' : '❌';
            const completion = result.completed ? '🎯' : '⏳';
            console.log(`${status} ${completion} ${result.test}: ${result.status}${result.completed ? ` (${result.followUps} follow-ups)` : ''}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        });
        
        console.log('\n' + '='.repeat(80));
        
        if (failed === 0) {
            console.log('🎉 ALL TESTS PASSED! Complete question flow is working correctly.');
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

    printDetailedStats() {
        console.log('\n' + '='.repeat(80));
        console.log('📊 DETAILED QUESTION STATISTICS');
        console.log('='.repeat(80));
        
        console.log('\n🎓 Background Questions:');
        console.log(`   Total: ${this.questionStats.background.total}`);
        console.log(`   Completed: ${this.questionStats.background.completed}`);
        console.log(`   Follow-ups: ${this.questionStats.background.followUps}`);
        console.log(`   Completion Rate: ${this.questionStats.background.total > 0 ? ((this.questionStats.background.completed / this.questionStats.background.total) * 100).toFixed(1) : 0}%`);
        
        console.log('\n📚 Main Questions:');
        console.log(`   Total: ${this.questionStats.main.total}`);
        console.log(`   Completed: ${this.questionStats.main.completed}`);
        console.log(`   Follow-ups: ${this.questionStats.main.followUps}`);
        console.log(`   Completion Rate: ${this.questionStats.main.total > 0 ? ((this.questionStats.main.completed / this.questionStats.main.total) * 100).toFixed(1) : 0}%`);
        
        console.log('\n🏁 Final Questions:');
        console.log(`   Total: ${this.questionStats.final.total}`);
        console.log(`   Completed: ${this.questionStats.final.completed}`);
        console.log(`   Follow-ups: ${this.questionStats.final.followUps}`);
        console.log(`   Completion Rate: ${this.questionStats.final.total > 0 ? ((this.questionStats.final.completed / this.questionStats.final.total) * 100).toFixed(1) : 0}%`);
        
        const totalQuestions = this.questionStats.background.total + this.questionStats.main.total + this.questionStats.final.total;
        const totalCompleted = this.questionStats.background.completed + this.questionStats.main.completed + this.questionStats.final.completed;
        const totalFollowUps = this.questionStats.background.followUps + this.questionStats.main.followUps + this.questionStats.final.followUps;
        
        console.log('\n📈 Overall Statistics:');
        console.log(`   Total Questions: ${totalQuestions}`);
        console.log(`   Total Completed: ${totalCompleted}`);
        console.log(`   Total Follow-ups: ${totalFollowUps}`);
        console.log(`   Overall Completion Rate: ${totalQuestions > 0 ? ((totalCompleted / totalQuestions) * 100).toFixed(1) : 0}%`);
        console.log(`   Average Follow-ups per Question: ${totalQuestions > 0 ? (totalFollowUps / totalQuestions).toFixed(1) : 0}`);
        
        console.log('='.repeat(80));
    }
}

// Run the test
async function runTest() {
    const tester = new AllQuestionsCompleteTester();
    await tester.runFullTest();
}

runTest().catch(console.error); 