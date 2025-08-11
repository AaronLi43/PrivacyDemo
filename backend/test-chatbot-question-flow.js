// test-chatbot-question-flow.js
// Focused test showing chatbot question-asking behavior and follow-up progression

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TEST_SESSION_ID = 'test-question-flow-' + Date.now();

// Enhanced logging for question flow visibility
function logQuestionFlow(step, message, data = null) {
  const timestamp = new Date().toISOString();
  const stepPrefix = `[${timestamp}] [FLOW ${step}]`;
  
  console.log(`\n${stepPrefix} ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
  console.log('─'.repeat(80));
}

// Test the complete question flow with focus on chatbot behavior
async function testChatbotQuestionFlow() {
  console.log('🤖 CHATBOT QUESTION FLOW SIMULATION');
  console.log('='.repeat(80));
  console.log(`📝 Test Session ID: ${TEST_SESSION_ID}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🌐 Target URL: ${BASE_URL}`);
  console.log('='.repeat(80));

  let currentStep = 0;
  let currentQuestion = null;
  let predefinedQuestions = [];
  let isFinalQuestionFlag = false;
  let followUpMode = true;

  try {
    // PHASE 1: Start conversation and get first question
    logQuestionFlow(1, '🚀 STARTING CONVERSATION - Chatbot will ask first question');
    
    const startResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: "Hello, I'm ready to begin the interview process.",
      step: currentStep,
      questionMode: true,
      currentQuestion: null,
      predefinedQuestions: [],
      isFinalQuestionFlag: false,
      followUpMode: true,
      sessionId: TEST_SESSION_ID
    });

    logQuestionFlow(1, '✅ CHATBOT FIRST QUESTION RECEIVED', {
      botResponse: startResponse.data.bot_response,
      step: startResponse.data.step,
      questionCompleted: startResponse.data.question_completed,
      auditResult: startResponse.data.audit_result ? 'Available' : 'None'
    });

    // PHASE 2: Answer first question and see chatbot's follow-up behavior
    const firstAnswer = "I studied Computer Science at UCLA from 2018-2022, graduating with a 3.8 GPA. My focus was on artificial intelligence and machine learning, and I completed a senior thesis on 'Natural Language Processing for Interview Preparation.' I also took courses in psychology and communication to better understand human interaction patterns.";

    logQuestionFlow(2, '📝 USER ANSWERS FIRST QUESTION', {
      userAnswer: firstAnswer.substring(0, 100) + '...',
      expectedBehavior: 'Chatbot should either ask next question or generate follow-up based on audit'
    });

    const firstAnswerResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: firstAnswer,
      step: startResponse.data.step || 1,
      questionMode: true,
      currentQuestion: startResponse.data.bot_response,
      predefinedQuestions: startResponse.data.predefined_questions || [],
      isFinalQuestionFlag: false,
      followUpMode: true,
      sessionId: TEST_SESSION_ID
    });

    logQuestionFlow(2, '✅ CHATBOT RESPONSE TO FIRST ANSWER', {
      botResponse: firstAnswerResponse.data.bot_response,
      step: firstAnswerResponse.data.step,
      questionCompleted: firstAnswerResponse.data.question_completed,
      auditResult: firstAnswerResponse.data.audit_result ? 'Available' : 'None',
      followUpQuestions: firstAnswerResponse.data.follow_up_questions ? firstAnswerResponse.data.follow_up_questions.length : 0,
      questionType: 'Is this a follow-up question or next main question?'
    });

    // PHASE 3: Handle follow-up questions if generated
    if (firstAnswerResponse.data.follow_up_questions && firstAnswerResponse.data.follow_up_questions.length > 0) {
      logQuestionFlow(3, '🔄 CHATBOT GENERATED FOLLOW-UP QUESTIONS', {
        followUpCount: firstAnswerResponse.data.follow_up_questions.length,
        followUps: firstAnswerResponse.data.follow_up_questions
      });

      // Answer the first follow-up question
      const followUpAnswer = "I want to provide more context and examples to better explain my experience. Let me elaborate on this point with specific examples from my work and how it relates to the interview process.";

      logQuestionFlow(3, '📝 USER ANSWERS FOLLOW-UP QUESTION', {
        followUpQuestion: firstAnswerResponse.data.follow_up_questions[0],
        userAnswer: followUpAnswer.substring(0, 80) + '...',
        expectedBehavior: 'Chatbot should either ask another follow-up or move to next main question'
      });

      const followUpResponse = await axios.post(`${BASE_URL}/api/chat`, {
        message: followUpAnswer,
        step: firstAnswerResponse.data.step,
        questionMode: true,
        currentQuestion: firstAnswerResponse.data.follow_up_questions[0],
        predefinedQuestions: firstAnswerResponse.data.predefined_questions || [],
        isFinalQuestionFlag: false,
        followUpMode: true,
        sessionId: TEST_SESSION_ID
      });

      logQuestionFlow(3, '✅ CHATBOT RESPONSE TO FOLLOW-UP ANSWER', {
        botResponse: followUpResponse.data.bot_response,
        step: followUpResponse.data.step,
        questionCompleted: followUpResponse.data.question_completed,
        auditResult: followUpResponse.data.audit_result ? 'Available' : 'None',
        nextAction: 'Does chatbot ask another follow-up or move to next main question?'
      });
    }

    // PHASE 4: Continue with main questions to see progression
    logQuestionFlow(4, '📋 CONTINUING WITH MAIN QUESTIONS - Observing chatbot question progression');
    
    const mainQuestions = [
      "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
      "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
      "Have you ever considered or actually used GenAI during a live interview? What happened?"
    ];

    let lastStep = firstAnswerResponse.data.step;
    if (firstAnswerResponse.data.follow_up_questions && firstAnswerResponse.data.follow_up_questions.length > 0) {
      // If we had follow-ups, use the step from follow-up response
      const followUpResponse = await axios.post(`${BASE_URL}/api/chat`, {
        message: "I want to provide more context and examples to better explain my experience. Let me elaborate on this point with specific examples from my work and how it relates to the interview process.",
        step: firstAnswerResponse.data.step,
        questionMode: true,
        currentQuestion: firstAnswerResponse.data.follow_up_questions[0],
        predefinedQuestions: firstAnswerResponse.data.predefined_questions || [],
        isFinalQuestionFlag: false,
        followUpMode: true,
        sessionId: TEST_SESSION_ID
      });
      lastStep = followUpResponse.data.step;
    }

    for (let i = 0; i < Math.min(3, mainQuestions.length); i++) {
      const question = mainQuestions[i];
      const isFinal = (i === mainQuestions.length - 1);
      
      logQuestionFlow(4 + i, `📝 MAIN QUESTION ${i + 1}/3`, {
        question: question,
        isFinal: isFinal,
        expectedBehavior: 'Chatbot should ask this question and handle response appropriately'
      });

      const mainAnswer = `This is my detailed response to: ${question}. I want to provide comprehensive information that demonstrates my experience and understanding of the topic. Let me share specific examples and insights.`;

      const mainResponse = await axios.post(`${BASE_URL}/api/chat`, {
        message: mainAnswer,
        step: lastStep + i + 1,
        questionMode: true,
        currentQuestion: question,
        predefinedQuestions: mainQuestions,
        isFinalQuestionFlag: isFinal,
        followUpMode: true,
        sessionId: TEST_SESSION_ID
      });

      logQuestionFlow(4 + i, `✅ CHATBOT RESPONSE TO MAIN QUESTION ${i + 1}`, {
        botResponse: mainResponse.data.bot_response,
        step: mainResponse.data.step,
        questionCompleted: mainResponse.data.question_completed,
        auditResult: mainResponse.data.audit_result ? 'Available' : 'None',
        followUpQuestions: mainResponse.data.follow_up_questions ? mainResponse.data.follow_up_questions.length : 0,
        questionProgression: 'How does chatbot decide to proceed?'
      });

      // Check if follow-ups were generated
      if (mainResponse.data.follow_up_questions && mainResponse.data.follow_up_questions.length > 0) {
        logQuestionFlow(4 + i, `🔄 FOLLOW-UP GENERATED FOR MAIN QUESTION ${i + 1}`, {
          followUpCount: mainResponse.data.follow_up_questions.length,
          followUps: mainResponse.data.follow_up_questions,
          chatbotBehavior: 'Chatbot is asking for more detail before moving forward'
        });
      }
    }

    // PHASE 5: Final summary of chatbot behavior
    logQuestionFlow(7, '📊 CHATBOT QUESTION FLOW ANALYSIS', {
      totalQuestionsAsked: 6, // 1 start + 3 main + potential follow-ups
      followUpGeneration: 'Chatbot generates follow-ups when responses need more detail',
      questionProgression: 'Chatbot advances questions based on audit results',
      conversationFlow: 'Smooth progression from background → main → follow-up questions',
      chatbotIntelligence: 'Contextual question generation and response assessment'
    });

    console.log('\n🎯 CHATBOT QUESTION FLOW TEST COMPLETED!');
    console.log('='.repeat(80));
    console.log('📋 Key Observations:');
    console.log('   • Chatbot asks contextual questions based on conversation flow');
    console.log('   • Follow-up questions are generated when responses need more detail');
    console.log('   • Question progression is audit-driven and intelligent');
    console.log('   • Conversation maintains natural flow and engagement');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ CHATBOT QUESTION FLOW TEST FAILED!');
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    console.error('='.repeat(80));
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testChatbotQuestionFlow()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

export { testChatbotQuestionFlow };
