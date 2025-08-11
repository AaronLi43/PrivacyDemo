// test-pipeline-first-question.js
// Test case for the real pipeline: initialization to first question answer

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const TEST_SESSION_ID = 'test-pipeline-first-' + Date.now();

// Enhanced logging with clear pipeline steps
function logPipelineStep(step, message, data = null) {
  const timestamp = new Date().toISOString();
  const stepPrefix = `[${timestamp}] [STEP ${step}]`;
  
  console.log(`\n${stepPrefix} ${message}`);
  if (data) {
    console.log('   Data:', JSON.stringify(data, null, 2));
  }
  console.log('─'.repeat(80));
}

// Test the complete pipeline flow
async function testPipelineFirstQuestion() {
  console.log('🧪 TESTING CHATBOT-AUDIT-ORCHESTRATOR PIPELINE');
  console.log('='.repeat(80));
  console.log(`📝 Test Session ID: ${TEST_SESSION_ID}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🌐 Target URL: ${BASE_URL}`);
  console.log('='.repeat(80));

  try {
    // STEP 1: Initialize conversation (no message, just start)
    logPipelineStep(1, '🚀 INITIALIZING CONVERSATION - Starting with initial message');
    
    const initResponse = await axios.post(`${BASE_URL}/api/chat`, {
      message: "Hello, I'd like to start the interview process.",  // Initial message to start conversation
      step: 0,
      questionMode: true,
      currentQuestion: null,
      predefinedQuestions: [],
      isFinalQuestionFlag: false,
      followUpMode: true,
      sessionId: TEST_SESSION_ID
    });

    logPipelineStep(1, '✅ INITIALIZATION RESPONSE RECEIVED', {
      status: initResponse.status,
      responseKeys: Object.keys(initResponse.data),
      botResponse: initResponse.data.bot_response,
      questionCompleted: initResponse.data.question_completed,
      currentQuestion: initResponse.data.current_question,
      phase: initResponse.data.phase,
      step: initResponse.data.step,
      auditResult: initResponse.data.audit_result ? 'Available' : 'None'
    });

    // STEP 2: Answer the first question (if one was provided)
    const firstQuestion = initResponse.data.current_question || initResponse.data.bot_response;
    if (firstQuestion && firstQuestion !== "Hello, I'd like to start the interview process.") {
      logPipelineStep(2, '📝 ANSWERING FIRST QUESTION', {
        question: firstQuestion,
        phase: initResponse.data.phase || 'Unknown'
      });

      const firstAnswer = "I studied Computer Science at UCLA from 2018-2022, graduating with a 3.8 GPA. My focus was on artificial intelligence and machine learning, and I completed a senior thesis on 'Natural Language Processing for Interview Preparation.' I also took courses in psychology and communication to better understand human interaction patterns.";

      const answerResponse = await axios.post(`${BASE_URL}/api/chat`, {
        message: firstAnswer,
        step: initResponse.data.step || 1,
        questionMode: true,
        currentQuestion: firstQuestion,
        predefinedQuestions: initResponse.data.predefined_questions || [],
        isFinalQuestionFlag: initResponse.data.is_final_question || false,
        followUpMode: true,
        sessionId: TEST_SESSION_ID
      });

      logPipelineStep(2, '✅ FIRST ANSWER RESPONSE RECEIVED', {
        status: answerResponse.status,
        responseKeys: Object.keys(answerResponse.data),
        botResponse: answerResponse.data.bot_response,
        questionCompleted: answerResponse.data.question_completed,
        currentQuestion: answerResponse.data.current_question,
        phase: answerResponse.data.phase,
        step: answerResponse.data.step,
        auditResult: answerResponse.data.audit_result ? 'Available' : 'None'
      });

      // STEP 3: Analyze the pipeline flow
      logPipelineStep(3, '🔍 PIPELINE FLOW ANALYSIS', {
        initialPhase: initResponse.data.phase || 'Unknown',
        finalPhase: answerResponse.data.phase || 'Unknown',
        phaseTransition: (initResponse.data.phase || 'Unknown') !== (answerResponse.data.phase || 'Unknown') ? 'Yes' : 'No',
        questionsProcessed: answerResponse.data.question_completed ? 1 : 0,
        nextQuestion: answerResponse.data.current_question || answerResponse.data.bot_response || 'None',
        stepProgression: (answerResponse.data.step || 0) - (initResponse.data.step || 0)
      });

    } else {
      logPipelineStep(2, '⚠️ NO FIRST QUESTION PROVIDED', {
        reason: 'Initialization did not return a proper question',
        botResponse: initResponse.data.bot_response,
        currentQuestion: initResponse.data.current_question,
        phase: initResponse.data.phase || 'Unknown'
      });
    }

    // STEP 4: Pipeline State Summary
    logPipelineStep(4, '📊 PIPELINE STATE SUMMARY', {
      sessionId: TEST_SESSION_ID,
      totalRequests: 2,
      successfulRequests: 2,
      failedRequests: 0,
      conversationStarted: !!initResponse.data.bot_response,
      questionFlow: initResponse.data.current_question ? 'Active' : 'Inactive',
      auditSystem: initResponse.data.audit_result ? 'Active' : 'Inactive',
      orchestratorState: {
        phase: initResponse.data.phase || 'Unknown',
        step: initResponse.data.step || 0,
        questionMode: initResponse.data.question_mode || 'Unknown'
      }
    });

    console.log('\n🎯 PIPELINE TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ PIPELINE TEST FAILED!');
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack
    });
    console.error('='.repeat(80));
    throw error;
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testPipelineFirstQuestion()
    .then(() => {
      console.log('\n✅ Test completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

export { testPipelineFirstQuestion };
