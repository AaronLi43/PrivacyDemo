// test-user-agent-detailed.js
// Enhanced test script with detailed logging and comprehensive flow simulation

import axios from 'axios';

// Test configuration
const BASE_URL = 'http://localhost:3000';
const TEST_SESSION_ID = 'test-detailed-flow-' + Date.now();

// Enhanced user responses with more realistic scenarios
const userResponses = {
  background: [
    {
      question: "Tell me about your educational background - what did you study in college or university?",
      response: "I studied Computer Science at UCLA from 2018-2022, graduating with a 3.8 GPA. My focus was on artificial intelligence and machine learning, and I completed a senior thesis on 'Natural Language Processing for Interview Preparation.' I also took courses in psychology and communication to better understand human interaction patterns."
    },
    {
      question: "I'd love to hear about your current work and how you got into it by job interviews?",
      response: "I currently work as a Senior Software Engineer at TechCorp, a mid-size startup in San Francisco. I got this role through a rigorous interview process where I used various preparation techniques, including AI tools like ChatGPT to practice behavioral questions and technical explanations. The interview process involved 5 rounds including coding challenges, system design, and behavioral questions."
    },
    {
      question: "What first got you interested in using GenAI tools like ChatGPT or Gemini for job interviews?",
      response: "My interest in GenAI for interviews started when I was struggling with interview anxiety during my job search in 2022. A mentor suggested using AI to practice common questions, and I found it incredibly helpful for building confidence. I started with simple question-answer practice but quickly realized AI could help me structure my thoughts better and anticipate follow-up questions."
    }
  ],
  
  main: [
    {
      question: "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
      response: "Yes, I used GenAI extensively when preparing for my current role at TechCorp. I practiced behavioral questions like 'Tell me about a time you led a team through a difficult project' by having ChatGPT generate follow-up questions and helping me structure my responses more clearly. I would input my initial answer, then ask the AI to suggest improvements and potential follow-up questions. This helped me think through my experiences more systematically and prepare for the actual interview flow."
    },
    {
      question: "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
      response: "I relied on GenAI most for three main areas: 1) Practicing behavioral questions by having AI generate follow-up questions to my initial answers, 2) Helping me explain technical concepts in simpler terms for non-technical stakeholders, and 3) Structuring my responses to be more STAR-method compliant. I found it particularly helpful for anticipating what interviewers might ask next, which made me feel more prepared and confident during actual interviews."
    },
    {
      question: "Have you ever considered or actually used GenAI during a live interview? What happened?",
      response: "I actually did use GenAI during a live interview once, though it was unintentional. I had practiced so extensively with ChatGPT that during a phone interview, I found myself using some of the language patterns and structures I had practiced. The interviewer seemed impressed with how well I communicated and how thoroughly I had prepared my examples. I got the job, and I believe the AI practice contributed to my success, though I was careful not to sound rehearsed."
    },
    {
      question: "Tell me about a time when you felt AI gave you a real competitive edge in an interview process.",
      response: "AI gave me a significant competitive edge during my interview for a Product Manager role at a fintech company. I used ChatGPT to practice explaining complex blockchain concepts to non-technical stakeholders, which was a key requirement. During the interview, I was able to clearly articulate these concepts in a way that impressed the hiring manager. I got the job, and the hiring manager specifically mentioned how well I communicated technical concepts. I credit part of that success to the AI practice sessions."
    },
    {
      question: "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
      response: "Yes, I had a close call when interviewing at a company that was very strict about AI usage policies. I had practiced extensively with ChatGPT, and during the interview, I accidentally used some phrasing that was very similar to what the AI had suggested. The interviewer asked if I had used any AI tools in my preparation, and I had to quickly think on my feet to explain my preparation process honestly without sounding like I was overly dependent on AI. I was honest about using it for practice but emphasized that all the content and experiences were my own."
    },
    {
      question: "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job applications?",
      response: "Yes, looking back, I think I crossed a line when I used AI to help me write a cover letter that was almost entirely generated by ChatGPT. I only made minor edits to personalize it, and I felt like I wasn't being authentic. I ended up not getting that job, and I think it's because the cover letter didn't really reflect who I am. It taught me that while AI can be helpful for structure and ideas, the content needs to be genuinely mine. I've since changed my approach to use AI only for brainstorming and structure, not for generating content."
    },
    {
      question: "Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues?",
      response: "Yes, I have used AI in ways I'm not proud of and don't share openly. I've used it to help me exaggerate some of my achievements and responsibilities in previous roles, making my experience sound more impressive than it actually was. For example, I used AI to help me describe a project I contributed to as if I had led it entirely. I know this isn't ethical, but I felt like I needed to compete with other candidates who were doing the same thing. I've since realized this approach is wrong and have committed to being completely honest in my applications."
    }
  ]
};

// Enhanced logging function
function logWithTimestamp(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

// Enhanced API call function with detailed logging
async function makeChatRequest(message, step = 0, questionMode = true, currentQuestion = null, predefinedQuestions = [], isFinalQuestionFlag = false, followUpMode = true) {
  const requestData = {
    message,
    step,
    questionMode,
    currentQuestion,
    predefinedQuestions,
    isFinalQuestionFlag,
    followUpMode,
    sessionId: TEST_SESSION_ID
  };
  
  logWithTimestamp('INFO', `📤 Making API request to ${BASE_URL}/api/chat`);
  logWithTimestamp('DEBUG', 'Request data:', requestData);
  
  try {
    const startTime = Date.now();
    const response = await axios.post(`${BASE_URL}/api/chat`, requestData);
    const duration = Date.now() - startTime;
    
    logWithTimestamp('INFO', `📥 API response received in ${duration}ms`);
    logWithTimestamp('DEBUG', 'Response status:', response.status);
    logWithTimestamp('DEBUG', 'Response data keys:', Object.keys(response.data));
    
    return response.data;
  } catch (error) {
    logWithTimestamp('ERROR', 'API call failed:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    throw error;
  }
}

// Helper function to wait between requests
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Main test function with enhanced logging
async function runDetailedUserAgentFlow() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 DETAILED USER AGENT FLOW TEST');
  console.log('='.repeat(80));
  console.log(`📝 Test Session ID: ${TEST_SESSION_ID}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}`);
  console.log(`🌐 Target URL: ${BASE_URL}`);
  console.log('='.repeat(80) + '\n');
  
  let currentStep = 0;
  let currentQuestion = null;
  let predefinedQuestions = userResponses.main.map(q => q.question);
  let isFinalQuestionFlag = false;
  let followUpMode = true;
  
  const testResults = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    backgroundQuestions: 0,
    mainQuestions: 0,
    followUps: 0,
    auditResults: [],
    startTime: Date.now()
  };
  
  try {
    // Phase 1: Background Questions
    console.log('\n🔄 PHASE 1: Background Questions');
    console.log('─'.repeat(50));
    
    for (let i = 0; i < userResponses.background.length; i++) {
      const questionData = userResponses.background[i];
      
      logWithTimestamp('INFO', `\n📋 Processing Background Question ${i + 1}/${userResponses.background.length}`);
      logWithTimestamp('INFO', `Question: ${questionData.question}`);
      logWithTimestamp('INFO', `User Response: ${questionData.response.substring(0, 80)}...`);
      
      testResults.totalRequests++;
      
      const response = await makeChatRequest(
        questionData.response,
        currentStep,
        true,
        currentQuestion,
        predefinedQuestions,
        isFinalQuestionFlag,
        followUpMode
      );
      
      testResults.successfulRequests++;
      testResults.backgroundQuestions++;
      
      logWithTimestamp('INFO', `🤖 Bot Response: ${response.bot_response.substring(0, 120)}...`);
      logWithTimestamp('INFO', `📊 Question Completed: ${response.question_completed}`);
      logWithTimestamp('INFO', `🔍 Audit Result: ${response.audit_result ? 'Available' : 'None'}`);
      
      if (response.audit_result) {
        testResults.auditResults.push({
          step: currentStep,
          type: 'background',
          questionIndex: i,
          audit: response.audit_result
        });
        
        logWithTimestamp('INFO', `📈 Audit Scores:`, response.audit_result.scores);
        logWithTimestamp('INFO', `✅ Audit Verdict: ${response.audit_result.verdict}`);
      }
      
      if (response.follow_up_questions) {
        logWithTimestamp('INFO', `❓ Follow-up Questions: ${response.follow_up_questions.length} available`);
      }
      
      currentStep++;
      await delay(1000);
    }
    
    // Phase 2: Main Questions
    console.log('\n🔄 PHASE 2: Main Questions');
    console.log('─'.repeat(50));
    
    for (let i = 0; i < userResponses.main.length; i++) {
      const questionData = userResponses.main[i];
      isFinalQuestionFlag = (i === userResponses.main.length - 1);
      
      logWithTimestamp('INFO', `\n📋 Processing Main Question ${i + 1}/${userResponses.main.length}`);
      logWithTimestamp('INFO', `Question: ${questionData.question}`);
      logWithTimestamp('INFO', `User Response: ${questionData.response.substring(0, 80)}...`);
      logWithTimestamp('INFO', `🎯 Is Final Question: ${isFinalQuestionFlag}`);
      
      testResults.totalRequests++;
      
      const response = await makeChatRequest(
        questionData.response,
        currentStep,
        true,
        currentQuestion,
        predefinedQuestions,
        isFinalQuestionFlag,
        followUpMode
      );
      
      testResults.successfulRequests++;
      testResults.mainQuestions++;
      
      logWithTimestamp('INFO', `🤖 Bot Response: ${response.bot_response.substring(0, 120)}...`);
      logWithTimestamp('INFO', `📊 Question Completed: ${response.question_completed}`);
      logWithTimestamp('INFO', `🔍 Audit Result: ${response.audit_result ? 'Available' : 'None'}`);
      
      if (response.audit_result) {
        testResults.auditResults.push({
          step: currentStep,
          type: 'main',
          questionIndex: i,
          audit: response.audit_result
        });
        
        logWithTimestamp('INFO', `📈 Audit Scores:`, response.audit_result.scores);
        logWithTimestamp('INFO', `✅ Audit Verdict: ${response.audit_result.verdict}`);
      }
      
      if (response.follow_up_questions) {
        logWithTimestamp('INFO', `❓ Follow-up Questions: ${response.follow_up_questions.length} available`);
        
        // Handle follow-up questions if available
        if (response.follow_up_questions.length > 0) {
          logWithTimestamp('INFO', `🔄 Processing follow-up questions...`);
          
          for (let j = 0; j < Math.min(response.follow_up_questions.length, 2); j++) {
            const followUpQuestion = response.follow_up_questions[j];
            const followUpResponse = `This is my detailed response to the follow-up question: ${followUpQuestion}. I want to provide more context and examples to better explain my experience. Let me elaborate on this point with specific examples from my work.`;
            
            logWithTimestamp('INFO', `\n  📋 Follow-up ${j + 1}: ${followUpQuestion}`);
            logWithTimestamp('INFO', `  👤 Follow-up Response: ${followUpResponse.substring(0, 80)}...`);
            
            testResults.totalRequests++;
            
            const followUpResult = await makeChatRequest(
              followUpResponse,
              currentStep,
              true,
              followUpQuestion,
              predefinedQuestions,
              isFinalQuestionFlag,
              true
            );
            
            testResults.successfulRequests++;
            testResults.followUps++;
            
            logWithTimestamp('INFO', `  🤖 Follow-up Bot Response: ${followUpResult.bot_response.substring(0, 100)}...`);
            currentStep++;
            await delay(500);
          }
        }
      }
      
      currentStep++;
      await delay(1000);
    }
    
    // Phase 3: Final Summary
    console.log('\n🔄 PHASE 3: Final Summary');
    console.log('─'.repeat(50));
    
    const finalMessage = "Thank you for this comprehensive interview. I've enjoyed sharing my experiences with GenAI tools and how they've helped me in my career development. I believe I've been honest about both the benefits and the ethical considerations, and I appreciate the opportunity to reflect on these important topics. This conversation has helped me think more critically about how I use AI in professional contexts.";
    
    logWithTimestamp('INFO', `\n📝 Final Message: ${finalMessage.substring(0, 100)}...`);
    
    testResults.totalRequests++;
    
    const finalResponse = await makeChatRequest(
      finalMessage,
      currentStep,
      true,
      currentQuestion,
      predefinedQuestions,
      true,
      false
    );
    
    testResults.successfulRequests++;
    
    logWithTimestamp('INFO', `🤖 Final Bot Response: ${finalResponse.bot_response.substring(0, 120)}...`);
    
    // Test Results Summary
    const endTime = Date.now();
    const totalDuration = endTime - testResults.startTime;
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(80));
    
    logWithTimestamp('INFO', `📊 Test Summary:`, {
      totalSteps: currentStep + 1,
      totalRequests: testResults.totalRequests,
      successfulRequests: testResults.successfulRequests,
      failedRequests: testResults.failedRequests,
      backgroundQuestions: testResults.backgroundQuestions,
      mainQuestions: testResults.mainQuestions,
      followUps: testResults.followUps,
      totalDuration: `${totalDuration}ms`,
      averageRequestTime: `${Math.round(totalDuration / testResults.totalRequests)}ms`
    });
    
    logWithTimestamp('INFO', `📈 Audit Results Summary:`, {
      totalAudits: testResults.auditResults.length,
      auditTypes: testResults.auditResults.map(a => a.type),
      verdicts: testResults.auditResults.map(a => a.audit.verdict)
    });
    
    console.log(`🆔 Session ID: ${TEST_SESSION_ID}`);
    console.log(`⏱️  Test completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(80));
    
    return testResults;
    
  } catch (error) {
    testResults.failedRequests++;
    logWithTimestamp('ERROR', '\n❌ TEST FAILED:', error.message);
    if (error.response) {
      logWithTimestamp('ERROR', 'Response status:', error.response.status);
      logWithTimestamp('ERROR', 'Response data:', error.response.data);
    }
    throw error;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  runDetailedUserAgentFlow()
    .then((results) => {
      console.log('\n✅ Test completed successfully!');
      console.log(`📊 Final Results: ${results.successfulRequests}/${results.totalRequests} requests successful`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}

export { runDetailedUserAgentFlow };

