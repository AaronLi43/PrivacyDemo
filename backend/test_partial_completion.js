// test_partial_completion.js
// Comprehensive test case for partial completion detection system
// Tests multiple scenarios: consent states, modes, AI replacement, editing, and survey completion

import fetch from 'node-fetch';

// Configuration
const BACKEND_URL = 'https://privacydemo.onrender.com';
const TEST_PROLIFIC_ID = 'test_partial_completion_123';
const TEST_STUDY_ID = 'test_study_456';
const TEST_SESSION_ID = 'test_session_789';

// Test conversation flow that will get stuck in the middle
const TEST_CONVERSATION = [
    {
        user: "Hello, I'm ready to participate in the study.",
        expected_bot: "Welcome to the study! We're excited to learn about how you've used AI for job interviews."
    },
    {
        user: "I studied Computer Science at MIT. It was really challenging but I loved the problem-solving aspects.",
        expected_bot: "That sounds fascinating! MIT is known for its rigorous computer science program."
    },
    {
        user: "I work as a software engineer at Google. I've been there for about 3 years now.",
        expected_bot: "Working at Google must be exciting! How has your experience been there?"
    },
    {
        user: "I've been using AI tools for about 2 years now. Started with ChatGPT when it first came out.",
        expected_bot: "That's great experience! How have you found AI tools helpful in your work?"
    },
    {
        user: "I used ChatGPT to help me prepare for my last job interview. It was surprisingly helpful.",
        expected_bot: "That's interesting! Can you tell me about how you used it for interview preparation?"
    },
    {
        user: "I do worry about privacy when using AI tools. I try to be careful about what I share.",
        expected_bot: "That's a valid concern. What specific privacy measures do you take?"
    }
];

// Post-task survey questions
const POST_TASK_SURVEY = [
    "How satisfied were you with the AI assistance during the interview?",
    "Did you feel the AI responses were helpful and relevant?",
    "How confident do you feel about your interview performance?",
    "Would you use AI tools for interview preparation in the future?",
    "Any additional comments about your experience?"
];

// Simulate the conversation and then trigger partial completion
async function testPartialCompletion() {
    console.log('🧪 Starting comprehensive partial completion test...');
    console.log(`📡 Using backend: ${BACKEND_URL}`);
    console.log(`🆔 Test Prolific ID: ${TEST_PROLIFIC_ID}`);
    
    try {
        // Test Scenario 1: Before consent (all placeholders)
        console.log('\n🔒 SCENARIO 1: Testing partial completion BEFORE consent...');
        await testBeforeConsentScenario();
        
        // Test Scenario 2: After consent (actual conversation)
        console.log('\n✅ SCENARIO 2: Testing partial completion AFTER consent...');
        await testAfterConsentScenario();
        
        // Test Scenario 3: Featured mode with AI replacement and editing
        console.log('\n🎯 SCENARIO 3: Testing featured mode with AI replacement and editing...');
        await testFeaturedModeScenario();
        
        // Test Scenario 4: Naive mode with AI replacement
        console.log('\n🤖 SCENARIO 4: Testing naive mode with AI replacement...');
        await testNaiveModeScenario();
        
        // Test Scenario 5: Post-task survey partial completion
        console.log('\n📋 SCENARIO 5: Testing post-task survey partial completion...');
        await testPostTaskSurveyScenario();
        
        // Test Scenario 6: Backend automatic placeholder replacement
        console.log('\n🔒 SCENARIO 6: Testing backend automatic placeholder replacement...');
        await testBackendPlaceholderReplacement();
        
        console.log('\n🎉 All test scenarios completed!');
        console.log('📋 Check your S3 bucket for the test files.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Scenario 1: Before consent - all conversation should be placeholders
async function testBeforeConsentScenario() {
    console.log('📝 Starting conversation without consent...');
    
    try {
        // Start conversation
        const startResponse = await startConversation();
        console.log('✅ Conversation started');
        
        // Simulate a few messages (these will be placeholders since no consent)
        let currentStep = 0;
        for (let i = 0; i < 3; i++) {
            const message = TEST_CONVERSATION[i];
            console.log(`\n💬 User message ${i + 1}: "${message.user.substring(0, 50)}..."`);
            
            const response = await sendMessage(message.user, currentStep);
            if (response && response.bot_response) {
                console.log(`🤖 Bot response: "${response.bot_response.substring(0, 100)}..."`);
                currentStep++;
            }
            await delay(1000);
        }
        
        // Trigger partial completion (no consent = all placeholders)
        console.log('🔧 Triggering partial completion without consent...');
        const completionData = createCompletionDataWithoutConsent();
        
        const uploadResponse = await uploadToS3(completionData, 'neutral', false);
        if (uploadResponse.success) {
            console.log('✅ Before-consent scenario uploaded:', uploadResponse.filename);
        }
        
    } catch (error) {
        console.error('❌ Before-consent scenario failed:', error);
    }
}

// Scenario 2: After consent - use actual conversation
async function testAfterConsentScenario() {
    console.log('📝 Starting conversation with consent...');
    
    try {
        // Start conversation
        const startResponse = await startConversation();
        console.log('✅ Conversation started');
        
        // Simulate a few messages (these will be actual conversation since consent given)
        let currentStep = 0;
        for (let i = 0; i < 4; i++) {
            const message = TEST_CONVERSATION[i];
            console.log(`\n💬 User message ${i + 1}: "${message.user.substring(0, 50)}..."`);
            
            const response = await sendMessage(message.user, currentStep);
            if (response && response.bot_response) {
                console.log(`🤖 Bot response: "${response.bot_response.substring(0, 100)}..."`);
                currentStep++;
            }
            await delay(1000);
        }
        
        // Trigger partial completion (with consent = actual conversation)
        console.log('🔧 Triggering partial completion with consent...');
        const completionData = createCompletionDataWithConsent();
        
        const uploadResponse = await uploadToS3(completionData, 'neutral', true);
        if (uploadResponse.success) {
            console.log('✅ After-consent scenario uploaded:', uploadResponse.filename);
        }
        
    } catch (error) {
        console.error('❌ After-consent scenario failed:', error);
    }
}

// Scenario 3: Featured mode with AI replacement and editing
async function testFeaturedModeScenario() {
    console.log('📝 Testing featured mode with AI replacement and editing...');
    
    try {
        // Start conversation in featured mode
        const startResponse = await startConversation('featured');
        console.log('✅ Featured mode conversation started');
        
        // Simulate conversation with AI replacement
        let currentStep = 0;
        for (let i = 0; i < 3; i++) {
            const message = TEST_CONVERSATION[i];
            console.log(`\n💬 User message ${i + 1}: "${message.user.substring(0, 50)}..."`);
            
            const response = await sendMessage(message.user, currentStep);
            if (response && response.bot_response) {
                console.log(`🤖 Bot response: "${response.bot_response.substring(0, 100)}..."`);
                currentStep++;
            }
            await delay(1000);
        }
        
        // Simulate AI replacement results
        const aiReplacementResults = [
            {
                original: "I work as a software engineer at Google. I've been there for about 3 years now.",
                replaced: "I work as a software engineer at a major tech company. I've been there for about 3 years now.",
                privacy_issue: "Company name disclosure",
                replacement_reason: "Protect company identity"
            },
            {
                original: "I studied Computer Science at MIT. It was really challenging but I loved the problem-solving aspects.",
                replaced: "I studied Computer Science at a prestigious university. It was really challenging but I loved the problem-solving aspects.",
                privacy_issue: "University name disclosure",
                replacement_reason: "Protect educational background"
            }
        ];
        
        // Simulate free editing by user
        const userEdits = [
            {
                message_index: 1,
                original_text: "I studied Computer Science at MIT. It was really challenging but I loved the problem-solving aspects.",
                edited_text: "I studied Computer Science at a top-tier university. It was really challenging but I loved the problem-solving aspects.",
                edit_reason: "User chose to be more private about university"
            }
        ];
        
        // Trigger partial completion with AI replacement and editing
        console.log('🔧 Triggering featured mode partial completion...');
        const completionData = createFeaturedModeCompletionData(aiReplacementResults, userEdits);
        
        const uploadResponse = await uploadToS3(completionData, 'featured', true);
        if (uploadResponse.success) {
            console.log('✅ Featured mode scenario uploaded:', uploadResponse.filename);
        }
        
    } catch (error) {
        console.error('❌ Featured mode scenario failed:', error);
    }
}

// Scenario 4: Naive mode with AI replacement
async function testNaiveModeScenario() {
    console.log('📝 Testing naive mode with AI replacement...');
    
    try {
        // Start conversation in naive mode
        const startResponse = await startConversation('naive');
        console.log('✅ Naive mode conversation started');
        
        // Simulate conversation
        let currentStep = 0;
        for (let i = 0; i < 3; i++) {
            const message = TEST_CONVERSATION[i];
            console.log(`\n💬 User message ${i + 1}: "${message.user.substring(0, 50)}..."`);
            
            const response = await sendMessage(message.user, currentStep);
            if (response && response.bot_response) {
                console.log(`🤖 Bot response: "${response.bot_response.substring(0, 100)}..."`);
                currentStep++;
            }
            await delay(1000);
        }
        
        // Simulate AI replacement results (naive mode shows suggestions)
        const aiSuggestions = [
            {
                original: "I work as a software engineer at Google. I've been there for about 3 years now.",
                suggestion: "I work as a software engineer at a tech company. I've been there for about 3 years now.",
                privacy_issue: "Company name disclosure",
                suggestion_reason: "Consider being more general about employer"
            }
        ];
        
        // Trigger partial completion with AI suggestions
        console.log('🔧 Triggering naive mode partial completion...');
        const completionData = createNaiveModeCompletionData(aiSuggestions);
        
        const uploadResponse = await uploadToS3(completionData, 'naive', false); // false = no consent, should replace with placeholders
        if (uploadResponse.success) {
            console.log('✅ Naive mode scenario uploaded:', uploadResponse.filename);
        }
        
    } catch (error) {
        console.error('❌ Naive mode scenario failed:', error);
    }
}

// Scenario 5: Post-task survey partial completion
async function testPostTaskSurveyScenario() {
    console.log('📝 Testing post-task survey partial completion...');
    
    try {
        // Simulate partially completed post-task survey
        const completedSurveyQuestions = [
            {
                question: "How satisfied were you with the AI assistance during the interview?",
                answer: "Very satisfied - the AI was very helpful",
                completed: true
            },
            {
                question: "Did you feel the AI responses were helpful and relevant?",
                answer: "Yes, they were quite relevant to my situation",
                completed: true
            },
            {
                question: "How confident do you feel about your interview performance?",
                answer: "Somewhat confident - the AI helped a lot",
                completed: true
            }
        ];
        
        // Uncompleted questions (these will be placeholders)
        const uncompletedQuestions = [
            "Would you use AI tools for interview preparation in the future?",
            "Any additional comments about your experience?"
        ];
        
        // Create completion data for post-task survey
        const completionData = createPostTaskSurveyCompletionData(completedSurveyQuestions, uncompletedQuestions);
        
        const uploadResponse = await uploadToS3(completionData, 'neutral', true);
        if (uploadResponse.success) {
            console.log('✅ Post-task survey scenario uploaded:', uploadResponse.filename);
        }
        
    } catch (error) {
        console.error('❌ Post-task survey scenario failed:', error);
    }
}

// Helper function to start conversation
async function startConversation(mode = 'neutral') {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: "__START__",
                step: 0,
                sessionId: TEST_SESSION_ID,
                questionMode: true,
                action: "START_QUESTION_MODE",
                mode: mode
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error starting conversation:', error);
        throw error;
    }
}

// Helper function to send message
async function sendMessage(message, step, additionalParams = {}) {
    try {
        const requestBody = {
            message: message,
            step: step,
            sessionId: TEST_SESSION_ID,
            ...additionalParams
        };
        
        const response = await fetch(`${BACKEND_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
}

// Helper function to upload to S3
async function uploadToS3(data, mode, consentGiven) {
    try {
        const uploadResponse = await fetch(`${BACKEND_URL}/api/upload-to-s3`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                exportData: data,
                pid: TEST_PROLIFIC_ID,
                study: TEST_STUDY_ID,
                session: TEST_SESSION_ID,
                mode: mode,
                sharedOriginal: consentGiven ? 'Shared' : 'Ignored'
            })
        });
        
        if (uploadResponse.ok) {
            const result = await uploadResponse.json();
            return { success: true, filename: result.filename };
        } else {
            console.log('⚠️ Could not upload to S3 (this is expected if S3 is not configured)');
            return { success: false, error: 'Upload failed' };
        }
        
    } catch (error) {
        console.error('Error uploading to S3:', error);
        return { success: false, error: error.message };
    }
}

// Create completion data without consent (actual conversation that should be replaced with placeholders)
function createCompletionDataWithoutConsent() {
    const totalQuestions = 7;
    const completedQuestions = 3;
    
    // Create conversation with ACTUAL conversation data (this should be replaced with placeholders by backend)
    const conversationWithActual = [];
    for (let i = 0; i < totalQuestions; i++) {
        const message = TEST_CONVERSATION[i];
        if (message) {
            // Add actual conversation data
            conversationWithActual.push({
                user: message.user,
                bot: message.expected_bot,
                timestamp: new Date().toISOString(),
                is_placeholder: false,
                question_index: i,
                question_text: `Question ${i + 1}`
            });
        } else {
            // Add placeholder for missing questions
            const questionNumber = i + 1;
            conversationWithActual.push({
                user: `The user have complete Q${questionNumber}_m`,
                bot: `Q${questionNumber}_m`,
                timestamp: new Date().toISOString(),
                is_placeholder: true,
                question_index: i,
                question_text: `Question ${questionNumber}`
            });
        }
    }
    
    return {
        metadata: {
            mode: 'neutral',
            export_timestamp: new Date().toISOString(),
            export_type: 'test_before_consent',
            completion_status: 'COMPLETE',
            completion_code: null,
            total_questions: totalQuestions,
            completed_questions: completedQuestions,
            progress_percentage: Math.round((completedQuestions / totalQuestions) * 100),
            partial_completion_reason: 'test_before_consent',
            consent_given: false,
            consent_tag: 'ignored',
            survey_completed: false,
            prolific_id: TEST_PROLIFIC_ID,
            prolific_study_id: TEST_STUDY_ID,
            prolific_session_id: TEST_SESSION_ID
        },
        conversation: conversationWithActual, // This will be replaced with placeholders by backend
        survey_data: {
            questions: POST_TASK_SURVEY
        },
        partial_completion_details: {
            last_activity_time: new Date().toISOString(),
            stuck_detection_timestamp: new Date().toISOString(),
            test_scenario: 'before_consent_actual_conversation_replaced'
        }
    };
}

// Create completion data with consent (actual conversation)
function createCompletionDataWithConsent() {
    const totalQuestions = 7;
    const completedQuestions = 4;
    
    // Create conversation with actual responses for completed questions
    const conversationWithActual = [];
    
    // Add actual conversation for completed questions
    for (let i = 0; i < completedQuestions; i++) {
        const message = TEST_CONVERSATION[i];
        conversationWithActual.push({
            user: message.user,
            bot: message.expected_bot,
            timestamp: new Date().toISOString(),
            is_placeholder: false,
            question_index: i
        });
    }
    
    // Add placeholders for incomplete questions
    for (let i = completedQuestions; i < totalQuestions; i++) {
        const questionNumber = i + 1;
        const questionText = TEST_CONVERSATION[i]?.expected_bot || `Question ${questionNumber}`;
        
        conversationWithActual.push({
            user: `The user have complete Q${questionNumber}_m`,
            bot: `Q${questionNumber}_m`,
            timestamp: new Date().toISOString(),
            is_placeholder: true,
            question_index: i,
            question_text: questionText
        });
    }
    
    return {
        metadata: {
            mode: 'neutral',
            export_timestamp: new Date().toISOString(),
            export_type: 'test_after_consent',
            completion_status: 'COMPLETE',
            completion_code: null,
            total_questions: totalQuestions,
            completed_questions: completedQuestions,
            progress_percentage: Math.round((completedQuestions / totalQuestions) * 100),
            partial_completion_reason: 'test_after_consent',
            consent_given: true,
            consent_tag: 'accept',
            survey_completed: false,
            prolific_id: TEST_PROLIFIC_ID,
            prolific_study_id: TEST_STUDY_ID,
            prolific_session_id: TEST_SESSION_ID
        },
        conversation: conversationWithActual,
        survey_data: {
            questions: POST_TASK_SURVEY
        },
        partial_completion_details: {
            last_activity_time: new Date().toISOString(),
            stuck_detection_timestamp: new Date().toISOString(),
            test_scenario: 'after_consent_actual_conversation'
        }
    };
}

// Create featured mode completion data with AI replacement and editing
function createFeaturedModeCompletionData(aiReplacementResults, userEdits) {
    const totalQuestions = 7;
    const completedQuestions = 3;
    
    // Create conversation with AI replacement results
    const conversationWithAI = [];
    
    // Add actual conversation for completed questions
    for (let i = 0; i < completedQuestions; i++) {
        const message = TEST_CONVERSATION[i];
        conversationWithAI.push({
            user: message.user,
            bot: message.expected_bot,
            timestamp: new Date().toISOString(),
            is_placeholder: false,
            question_index: i
        });
    }
    
    // Add placeholders for incomplete questions
    for (let i = completedQuestions; i < totalQuestions; i++) {
        const questionNumber = i + 1;
        const questionText = TEST_CONVERSATION[i]?.expected_bot || `Question ${questionNumber}`;
        
        conversationWithAI.push({
            user: `The user have complete Q${questionNumber}_m`,
            bot: `Q${questionNumber}_m`,
            timestamp: new Date().toISOString(),
            is_placeholder: true,
            question_index: i,
            question_text: questionText
        });
    }
    
    return {
        metadata: {
            mode: 'featured',
            export_timestamp: new Date().toISOString(),
            export_type: 'test_featured_mode',
            completion_status: 'COMPLETE',
            completion_code: null,
            total_questions: totalQuestions,
            completed_questions: completedQuestions,
            progress_percentage: Math.round((completedQuestions / totalQuestions) * 100),
            partial_completion_reason: 'test_featured_mode',
            consent_given: true,
            consent_tag: 'accept',
            survey_completed: false,
            prolific_id: TEST_PROLIFIC_ID,
            prolific_study_id: TEST_STUDY_ID,
            prolific_session_id: TEST_SESSION_ID
        },
        conversation: conversationWithAI,
        survey_data: {
            questions: POST_TASK_SURVEY
        },
        ai_replacement_results: aiReplacementResults,
        user_edits: userEdits,
        partial_completion_details: {
            last_activity_time: new Date().toISOString(),
            stuck_detection_timestamp: new Date().toISOString(),
            test_scenario: 'featured_mode_ai_replacement_editing'
        }
    };
}

// Create naive mode completion data with AI suggestions
function createNaiveModeCompletionData(aiSuggestions) {
    const totalQuestions = 7;
    const completedQuestions = 3;
    
    // Create conversation with AI suggestions
    const conversationWithSuggestions = [];
    
    // Add actual conversation for completed questions
    for (let i = 0; i < completedQuestions; i++) {
        const message = TEST_CONVERSATION[i];
        conversationWithSuggestions.push({
            user: message.user,
            bot: message.expected_bot,
            timestamp: new Date().toISOString(),
            is_placeholder: false,
            question_index: i
        });
    }
    
    // Add placeholders for incomplete questions
    for (let i = completedQuestions; i < totalQuestions; i++) {
        const questionNumber = i + 1;
        const questionText = TEST_CONVERSATION[i]?.expected_bot || `Question ${questionNumber}`;
        
        conversationWithSuggestions.push({
            user: `The user have complete Q${questionNumber}_m`,
            bot: `Q${questionNumber}_m`,
            timestamp: new Date().toISOString(),
            is_placeholder: true,
            question_index: i,
            question_text: questionText
        });
    }
    
    return {
        metadata: {
            mode: 'naive',
            export_timestamp: new Date().toISOString(),
            export_type: 'test_naive_mode',
            completion_status: 'COMPLETE',
            completion_code: null,
            total_questions: totalQuestions,
            completed_questions: completedQuestions,
            progress_percentage: Math.round((completedQuestions / totalQuestions) * 100),
            partial_completion_reason: 'test_naive_mode',
            consent_given: false,
            consent_tag: 'ignored',
            survey_completed: false,
            prolific_id: TEST_PROLIFIC_ID,
            prolific_study_id: TEST_STUDY_ID,
            prolific_session_id: TEST_SESSION_ID
        },
        conversation: conversationWithSuggestions,
        survey_data: {
            questions: POST_TASK_SURVEY
        },
        ai_suggestions: aiSuggestions,
        partial_completion_details: {
            last_activity_time: new Date().toISOString(),
            stuck_detection_timestamp: new Date().toISOString(),
            test_scenario: 'naive_mode_ai_suggestions'
        }
    };
}

// Create post-task survey completion data
function createPostTaskSurveyCompletionData(completedQuestions, uncompletedQuestions) {
    const totalSurveyQuestions = completedQuestions.length + uncompletedQuestions.length;
    const completedSurveyCount = completedQuestions.length;
    
    // Create survey data with completed and uncompleted questions
    const surveyData = [];
    
    // Add completed survey questions
    completedQuestions.forEach((q, index) => {
        surveyData.push({
            question: q.question,
            answer: q.answer,
            completed: true,
            question_index: index,
            timestamp: new Date().toISOString()
        });
    });
    
    // Add placeholders for uncompleted survey questions
    uncompletedQuestions.forEach((question, index) => {
        surveyData.push({
            question: question,
            answer: `The user have complete Q${completedSurveyCount + index + 1}_m`,
            completed: false,
            question_index: completedSurveyCount + index,
            is_placeholder: true,
            timestamp: new Date().toISOString()
        });
    });
    
    return {
        metadata: {
            mode: 'neutral',
            export_timestamp: new Date().toISOString(),
            export_type: 'test_post_task_survey',
            completion_status: 'COMPLETE',
            completion_code: null,
            total_survey_questions: totalSurveyQuestions,
            completed_survey_questions: completedSurveyCount,
            progress_percentage: Math.round((completedSurveyCount / totalSurveyQuestions) * 100),
            partial_completion_reason: 'test_post_task_survey',
            consent_given: true,
            consent_tag: 'accept',
            survey_completed: false,
            prolific_id: TEST_PROLIFIC_ID,
            prolific_study_id: TEST_STUDY_ID,
            prolific_session_id: TEST_SESSION_ID
        },
        conversation: [], // No conversation for survey-only test
        survey_data: {
            questions: POST_TASK_SURVEY,
            responses: surveyData
        },
        partial_completion_details: {
            last_activity_time: new Date().toISOString(),
            timestamp: new Date().toISOString(),
            test_scenario: 'post_task_survey_partial_completion'
        }
    };
}

// Test Scenario 6: Backend automatic placeholder replacement
async function testBackendPlaceholderReplacement() {
    console.log('📝 Testing backend automatic placeholder replacement...');
    
    try {
        // Create data with actual conversation but no consent
        const testData = {
            metadata: {
                mode: 'neutral',
                export_timestamp: new Date().toISOString(),
                export_type: 'test_backend_placeholder_replacement',
                completion_status: 'COMPLETE',
                completion_code: null,
                consent_given: false,
                consent_tag: 'ignored',
                prolific_id: TEST_PROLIFIC_ID,
                prolific_study_id: TEST_STUDY_ID,
                prolific_session_id: TEST_SESSION_ID
            },
            conversation: [
                {
                    user: "Hello, I'm ready to participate in the study.",
                    bot: "Welcome to the study! We're excited to learn about how you've used AI for job interviews.",
                    timestamp: new Date().toISOString(),
                    is_placeholder: false,
                    question_index: 0
                },
                {
                    user: "I studied Computer Science at MIT. It was really challenging but I loved the problem-solving aspects.",
                    bot: "That sounds fascinating! MIT is known for its rigorous computer science program.",
                    timestamp: new Date().toISOString(),
                    is_placeholder: false,
                    question_index: 1
                },
                {
                    user: "I work as a software engineer at Google. I've been there for about 3 years now.",
                    bot: "Working at Google must be exciting! How has your experience been there?",
                    timestamp: new Date().toISOString(),
                    is_placeholder: false,
                    question_index: 2
                }
            ],
            test_details: {
                purpose: 'Test backend automatic placeholder replacement',
                expected_result: 'All conversation should be replaced with placeholders',
                timestamp: new Date().toISOString()
            }
        };
        
        // Upload with no consent - backend should automatically replace conversation with placeholders
        console.log('🔧 Uploading with no consent - backend should replace conversation with placeholders...');
        const uploadResponse = await uploadToS3(testData, 'neutral', false);
        
        if (uploadResponse.success) {
            console.log('✅ Backend placeholder replacement test uploaded:', uploadResponse.filename);
            console.log('🔍 Check S3 file - conversation should be replaced with placeholders');
        }
        
    } catch (error) {
        console.error('❌ Backend placeholder replacement test failed:', error);
    }
}

// Utility function to add delays
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
    testPartialCompletion().catch(console.error);
}

export { testPartialCompletion };
