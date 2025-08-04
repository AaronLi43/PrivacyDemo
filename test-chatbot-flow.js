const axios = require('axios');
const fs = require('fs');

class ChatbotFlowTester {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.testResults = {
            startTime: new Date().toISOString(),
            tests: [],
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                errors: []
            }
        };
        
        // Test user responses that simulate realistic user behavior
        this.userResponses = {
            background: [
                "I work in software engineering, specifically in web development.",
                "I have about 3 years of professional experience.",
                "I have a Bachelor's degree in Computer Science.",
                "Yes, I've had several job interviews in the past 2 years.",
                "I'm quite familiar with AI tools - I use ChatGPT regularly for work.",
                "I've experienced phone interviews, video calls, and technical interviews.",
                "Yes, I use ChatGPT for coding help and documentation.",
                "My main concern is that my personal information might be stored or shared without my consent."
            ],
            mainQuestions: [
                "I studied Computer Science with a focus on software engineering and web development.",
                "I'm currently working as a Senior Software Engineer at a tech startup, where I lead the frontend development team and work on building scalable web applications.",
                "I've been using AI tools like ChatGPT for about 2 years now, starting when it first became publicly available. I use it regularly for both work and personal projects.",
                "I first heard about using AI for interviews from a colleague who mentioned using ChatGPT to prepare for behavioral questions. It seemed like a smart way to get better at articulating my experiences.",
                "I used ChatGPT to help me prepare for a technical interview at a startup. I asked it to generate practice coding questions and then used it to review my solutions and suggest improvements.",
                "AI played a major role when I was preparing for a senior developer position. I used it to help me structure my responses to leadership questions and to practice explaining complex technical concepts.",
                "I relied most heavily on AI for brainstorming answers to behavioral questions and for practicing technical explanations. It was really helpful for organizing my thoughts.",
                "Yes, I saved some AI-generated phrases that I thought were particularly good at explaining my experience with agile development. I reused these across multiple interviews.",
                "I was especially proud of using an AI-generated response about how I handled a difficult team conflict. It helped me present the situation professionally and show my problem-solving skills.",
                "I definitely felt more confident going into interviews knowing I had AI-generated talking points ready. It felt like having a backup plan.",
                "I've never used AI during a live interview, but I've considered it for remote interviews where I could have notes open."
            ]
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Chatbot Flow Tests...\n');
        
        try {
            // Test 1: API Connection
            await this.testAPIConnection();
            
            // Test 2: Background Questions Flow
            await this.testBackgroundQuestionsFlow();
            
            // Test 3: Main Questions Flow (First 8 questions)
            await this.testMainQuestionsFlow();
            
            // Test 4: Privacy Analysis
            await this.testPrivacyAnalysis();
            
            // Test 5: Complete Conversation Flow
            await this.testCompleteConversationFlow();
            
            // Generate test report
            this.generateTestReport();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error.message);
            this.testResults.summary.errors.push(error.message);
            this.generateTestReport();
        }
    }

    async testAPIConnection() {
        const testName = 'API Connection Test';
        console.log(`📡 Running ${testName}...`);
        
        try {
            const response = await axios.get(`${this.baseURL}/api/test_connection`);
            
            if (response.data.status === 'success') {
                this.addTestResult(testName, true, 'API connection successful');
                console.log('✅ API connection successful');
            } else {
                this.addTestResult(testName, false, 'API returned error status');
                console.log('❌ API returned error status');
            }
        } catch (error) {
            this.addTestResult(testName, false, `API connection failed: ${error.message}`);
            console.log(`❌ API connection failed: ${error.message}`);
        }
    }

    async testBackgroundQuestionsFlow() {
        const testName = 'Background Questions Flow Test';
        console.log(`\n🔍 Running ${testName}...`);
        
        try {
            // Get predefined questions (now include background questions)
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const backgroundQuestions = questionsResponse.data.questions.slice(0, 8); // First 8 questions are background
            
            if (!backgroundQuestions || backgroundQuestions.length === 0) {
                this.addTestResult(testName, false, 'No background questions received');
                return;
            }
            
            console.log(`📝 Testing ${backgroundQuestions.length} background questions...`);
            
            let conversationHistory = [];
            let currentQuestionIndex = 0;
            
            // Test each background question
            for (let i = 0; i < Math.min(backgroundQuestions.length, this.userResponses.background.length); i++) {
                const question = backgroundQuestions[i];
                const userResponse = this.userResponses.background[i];
                
                console.log(`  Question ${i + 1}: ${question.substring(0, 50)}...`);
                
                const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                    message: userResponse,
                    step: i,
                    questionMode: true,
                    currentQuestion: backgroundQuestions[i],
                    predefinedQuestions: backgroundQuestions,
                    isFinalQuestion: (i === backgroundQuestions.length - 1)
                });
                
                const botResponse = chatResponse.data.bot_response;
                const backgroundCompleted = chatResponse.data.background_completed;
                
                conversationHistory.push({
                    question: question,
                    userResponse: userResponse,
                    botResponse: botResponse,
                    backgroundCompleted: backgroundCompleted
                });
                
                // Check if background is completed
                if (backgroundCompleted) {
                    console.log(`  ✅ Background questions completed after question ${i + 1}`);
                    break;
                }
                
                // Add delay to avoid rate limiting
                await this.delay(1000);
            }
            
            // Verify that background questions were handled properly
            const hasResponses = conversationHistory.length > 0;
            const hasBotResponses = conversationHistory.every(conv => conv.botResponse && conv.botResponse.length > 0);
            
            if (hasResponses && hasBotResponses) {
                this.addTestResult(testName, true, `Successfully processed ${conversationHistory.length} background questions`);
                console.log(`✅ Background questions flow completed successfully`);
            } else {
                this.addTestResult(testName, false, 'Background questions flow failed - missing responses');
                console.log('❌ Background questions flow failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Background questions test failed: ${error.message}`);
            console.log(`❌ Background questions test failed: ${error.message}`);
        }
    }

    async testMainQuestionsFlow() {
        const testName = 'Main Questions Flow Test (First 8 Questions)';
        console.log(`\n🎯 Running ${testName}...`);
        
        try {
            // Test with featured mode (has privacy detection)
            await this.setMode('featured');
            
            // Get predefined questions
            const questionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const predefinedQuestions = questionsResponse.data.questions;
            
            if (!predefinedQuestions || predefinedQuestions.length < 11) {
                this.addTestResult(testName, false, 'Not enough predefined questions available');
                return;
            }
            
            console.log(`📝 Testing first 11 of ${predefinedQuestions.length} main questions...`);
            
            let conversationHistory = [];
            let questionsCompleted = 0;
            
            // Test first 11 questions
            for (let i = 0; i < 11; i++) {
                const question = predefinedQuestions[i];
                const userResponse = this.userResponses.mainQuestions[i] || `This is my response to question ${i + 1} about ${question.substring(0, 30)}...`;
                
                console.log(`  Question ${i + 1}: ${question.substring(0, 50)}...`);
                
                const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                    message: userResponse,
                    step: i,
                    questionMode: true,
                    currentQuestion: question,
                    predefinedQuestions: predefinedQuestions,
                    isFinalQuestion: (i === 10) // 11th question is final
                });
                
                const botResponse = chatResponse.data.bot_response;
                const questionCompleted = chatResponse.data.question_completed;
                const privacyDetection = chatResponse.data.privacy_detection;
                
                conversationHistory.push({
                    question: question,
                    userResponse: userResponse,
                    botResponse: botResponse,
                    questionCompleted: questionCompleted,
                    privacyDetection: privacyDetection
                });
                
                if (questionCompleted) {
                    questionsCompleted++;
                    console.log(`  ✅ Question ${i + 1} completed`);
                }
                
                // Add delay to avoid rate limiting
                await this.delay(1000);
            }
            
            // Verify that questions were handled properly
            const hasResponses = conversationHistory.length === 11;
            const hasBotResponses = conversationHistory.every(conv => conv.botResponse && conv.botResponse.length > 0);
            const hasPrivacyDetection = conversationHistory.some(conv => conv.privacyDetection);
            
            if (hasResponses && hasBotResponses) {
                this.addTestResult(testName, true, `Successfully processed ${questionsCompleted}/11 questions with privacy detection`);
                console.log(`✅ Main questions flow completed successfully (${questionsCompleted}/11 questions completed)`);
                
                if (hasPrivacyDetection) {
                    console.log(`🔒 Privacy detection was active during conversation`);
                }
            } else {
                this.addTestResult(testName, false, 'Main questions flow failed - missing responses');
                console.log('❌ Main questions flow failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Main questions test failed: ${error.message}`);
            console.log(`❌ Main questions test failed: ${error.message}`);
        }
    }

    async testPrivacyAnalysis() {
        const testName = 'Privacy Analysis Test';
        console.log(`\n🔒 Running ${testName}...`);
        
        try {
            // Create a test conversation with potential privacy issues
            const testConversation = [
                { role: 'user', content: 'My name is John Smith and my email is john.smith@example.com' },
                { role: 'assistant', content: 'Thank you for sharing that information.' },
                { role: 'user', content: 'I live at 123 Main Street, New York, NY 10001' },
                { role: 'assistant', content: 'I understand your location.' },
                { role: 'user', content: 'My phone number is 555-123-4567' },
                { role: 'assistant', content: 'Got it.' }
            ];
            
            // Test privacy detection on individual messages
            console.log('  Testing individual message privacy detection...');
            let privacyIssuesFound = 0;
            
            for (const message of testConversation.filter(msg => msg.role === 'user')) {
                const privacyResponse = await axios.post(`${this.baseURL}/api/privacy_detection`, {
                    user_message: message.content
                });
                
                if (privacyResponse.data.privacy_issue) {
                    privacyIssuesFound++;
                    console.log(`    🔍 Privacy issue detected: ${privacyResponse.data.type}`);
                }
            }
            
            // Test conversation-wide privacy analysis
            console.log('  Testing conversation-wide privacy analysis...');
            const analysisResponse = await axios.post(`${this.baseURL}/api/conversation_privacy_analysis`, {
                conversation_history: testConversation
            });
            
            const analysis = analysisResponse.data.analysis;
            
            if (analysis && analysis.success) {
                console.log(`    📊 Analysis completed: ${analysis.summary.messages_with_privacy_issues} messages with privacy issues`);
                console.log(`    🎯 Risk level: ${analysis.summary.privacy_risk_level}`);
            }
            
            // Verify privacy analysis results
            const hasIndividualDetection = privacyIssuesFound > 0;
            const hasConversationAnalysis = analysis && analysis.success;
            
            if (hasIndividualDetection && hasConversationAnalysis) {
                this.addTestResult(testName, true, `Privacy analysis successful - ${privacyIssuesFound} issues detected`);
                console.log(`✅ Privacy analysis completed successfully`);
            } else {
                this.addTestResult(testName, false, 'Privacy analysis failed or no issues detected');
                console.log('❌ Privacy analysis failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Privacy analysis test failed: ${error.message}`);
            console.log(`❌ Privacy analysis test failed: ${error.message}`);
        }
    }

    async testCompleteConversationFlow() {
        const testName = 'Complete Conversation Flow Test';
        console.log(`\n🔄 Running ${testName}...`);
        
        try {
            // Reset conversation
            await axios.post(`${this.baseURL}/api/reset`);
            
            // Set mode to featured
            await this.setMode('featured');
            
            // Simulate complete conversation flow
            console.log('  Starting complete conversation simulation...');
            
            let conversationHistory = [];
            let currentStep = 0;
            
            // Background questions phase (first 8 questions from predefined questions)
            const backgroundQuestionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const backgroundQuestions = backgroundQuestionsResponse.data.questions.slice(0, 8);
            
            for (let i = 0; i < Math.min(3, backgroundQuestions.length); i++) {
                const userResponse = this.userResponses.background[i];
                
                const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                    message: userResponse,
                    step: currentStep++,
                    questionMode: true,
                    currentQuestion: backgroundQuestions[i],
                    predefinedQuestions: backgroundQuestions,
                    isFinalQuestion: (i === backgroundQuestions.length - 1)
                });
                
                conversationHistory.push({
                    role: 'user',
                    content: userResponse,
                    timestamp: new Date().toISOString(),
                    step: currentStep
                });
                conversationHistory.push({
                    role: 'assistant',
                    content: chatResponse.data.bot_response,
                    timestamp: new Date().toISOString(),
                    step: currentStep
                });
                
                if (chatResponse.data.background_completed) break;
                await this.delay(1000);
            }
            
            // Main questions phase (first 7 questions - including the 3 new ones)
            const mainQuestionsResponse = await axios.get(`${this.baseURL}/api/predefined_questions/featured`);
            const mainQuestions = mainQuestionsResponse.data.questions;
            
            for (let i = 0; i < 7; i++) {
                const userResponse = this.userResponses.mainQuestions[i];
                
                const chatResponse = await axios.post(`${this.baseURL}/api/chat`, {
                    message: userResponse,
                    step: currentStep++,
                    questionMode: true,
                    currentQuestion: mainQuestions[i],
                    predefinedQuestions: mainQuestions,
                    isFinalQuestion: (i === 6)
                });
                
                conversationHistory.push({
                    role: 'user',
                    content: userResponse,
                    timestamp: new Date().toISOString(),
                    step: currentStep
                });
                conversationHistory.push({
                    role: 'assistant',
                    content: chatResponse.data.bot_response,
                    timestamp: new Date().toISOString(),
                    step: currentStep
                });
                
                if (chatResponse.data.question_completed) {
                    console.log(`    ✅ Main question ${i + 1} completed`);
                }
                
                await this.delay(1000);
            }
            
            // Test conversation analysis
            console.log('  Testing conversation analysis...');
            const analysisResponse = await axios.post(`${this.baseURL}/api/conversation_privacy_analysis`, {
                conversation_history: conversationHistory
            });
            
            const analysis = analysisResponse.data.analysis;
            
            // Verify complete flow
            const userMessages = conversationHistory.filter(conv => conv.role === 'user');
            const assistantMessages = conversationHistory.filter(conv => conv.role === 'assistant');
            const hasAnalysis = analysis && analysis.success;
            
            if (userMessages.length > 0 && assistantMessages.length > 0 && hasAnalysis) {
                this.addTestResult(testName, true, 'Complete conversation flow successful');
                console.log(`✅ Complete conversation flow test passed`);
                console.log(`   📊 User messages: ${userMessages.length}`);
                console.log(`   📊 Assistant messages: ${assistantMessages.length}`);
                console.log(`   🔒 Privacy analysis: ${analysis.summary.privacy_risk_level} risk level`);
            } else {
                this.addTestResult(testName, false, 'Complete conversation flow failed');
                console.log('❌ Complete conversation flow test failed');
            }
            
        } catch (error) {
            this.addTestResult(testName, false, `Complete conversation test failed: ${error.message}`);
            console.log(`❌ Complete conversation test failed: ${error.message}`);
        }
    }

    async setMode(mode) {
        try {
            await axios.post(`${this.baseURL}/api/set_mode`, { mode });
        } catch (error) {
            console.error(`Failed to set mode to ${mode}:`, error.message);
        }
    }

    addTestResult(testName, passed, message) {
        const result = {
            testName,
            passed,
            message,
            timestamp: new Date().toISOString()
        };
        
        this.testResults.tests.push(result);
        this.testResults.summary.totalTests++;
        
        if (passed) {
            this.testResults.summary.passed++;
        } else {
            this.testResults.summary.failed++;
        }
    }

    generateTestReport() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${this.testResults.summary.totalTests}`);
        console.log(`Passed: ${this.testResults.summary.passed}`);
        console.log(`Failed: ${this.testResults.summary.failed}`);
        console.log(`Success Rate: ${((this.testResults.summary.passed / this.testResults.summary.totalTests) * 100).toFixed(1)}%`);
        
        if (this.testResults.summary.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.testResults.summary.errors.forEach(error => console.log(`  - ${error}`));
        }
        
        console.log('\n📋 Detailed Results:');
        this.testResults.tests.forEach(test => {
            const status = test.passed ? '✅' : '❌';
            console.log(`${status} ${test.testName}: ${test.message}`);
        });
        
        // Save detailed report to file
        const reportFilename = `test-report-${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(reportFilename, JSON.stringify(this.testResults, null, 2));
        console.log(`\n📄 Detailed report saved to: ${reportFilename}`);
        
        // Generate summary
        const summary = {
            timestamp: this.testResults.startTime,
            totalTests: this.testResults.summary.totalTests,
            passed: this.testResults.summary.passed,
            failed: this.testResults.summary.failed,
            successRate: ((this.testResults.summary.passed / this.testResults.summary.totalTests) * 100).toFixed(1) + '%',
            errors: this.testResults.summary.errors
        };
        
        console.log('\n🎯 Final Summary:');
        console.log(JSON.stringify(summary, null, 2));
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run the tests
async function main() {
    const tester = new ChatbotFlowTester();
    await tester.runAllTests();
}

// Check if this file is being run directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = ChatbotFlowTester; 