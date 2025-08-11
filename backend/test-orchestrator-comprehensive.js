// test-orchestrator-comprehensive.js
// Comprehensive test of the chatbot-audit-orchestrator pipeline

import {
  initState, getCurrentQuestion, isBackgroundPhase, isFinalQuestion,
  atFollowupCap, registerFollowup, recordScores, resetAllowedForQuestion,
  buildAllowedActionsForPrompt, allowNextIfAuditPass, finalizeIfLastAndPassed,
  shouldAdvance, gotoNextQuestion, storeAudits, parseExecutorOutput, enforceAllowedAction
} from './orchestrator.js';

console.log('🧪 Comprehensive Chatbot-Audit-Orchestrator Pipeline Test\n');

// Test data
const backgroundQuestions = [
  "Tell me about your educational background - what did you study in college or university?",
  "I'd love to hear about your current work and how you got into it by job interviews?",
  "What first got you interested in using GenAI tools like ChatGPT or Gemini for job interviews?"
];

const mainQuestions = [
  "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
  "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
  "Have you ever considered or actually used GenAI during a live interview? What happened?",
  "Tell me about a time when you felt AI gave you a real competitive edge in an interview process.",
  "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
  "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job applications?",
  "Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues?"
];

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function runTest(testName, testFunction) {
  testResults.total++;
  try {
    const result = testFunction();
    if (result === true) {
      console.log(`✅ ${testName}: PASSED`);
      testResults.passed++;
    } else {
      console.log(`❌ ${testName}: FAILED - ${result}`);
      testResults.failed++;
    }
  } catch (error) {
    console.log(`❌ ${testName}: ERROR - ${error.message}`);
    testResults.failed++;
  }
}

// Test Suite 1: State Management
console.log('📋 Test Suite 1: State Management\n');

runTest('State Initialization', () => {
  const session = {};
  const state = initState(session, { maxFollowups: { background: 2, main: 4 } });
  
  return state.phase === 'background' &&
         state.bgIdx === 0 &&
         state.mainIdx === 0 &&
         state.allowedActions.has('ASK_FOLLOWUP') &&
         state.maxFollowups.background === 2 &&
         state.maxFollowups.main === 4;
});

runTest('Current Question Detection - Background', () => {
  const state = initState({});
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  return question === backgroundQuestions[0] &&
         isBackgroundPhase(state) === true &&
         isFinalQuestion(state, mainQuestions) === false;
});

runTest('Current Question Detection - Main', () => {
  const state = initState({});
  state.phase = 'main';
  state.mainIdx = 2;
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  return question === mainQuestions[2] &&
         isBackgroundPhase(state) === false &&
         isFinalQuestion(state, mainQuestions) === false;
});

runTest('Final Question Detection', () => {
  const state = initState({});
  state.phase = 'main';
  state.mainIdx = mainQuestions.length - 1;
  
  return isFinalQuestion(state, mainQuestions) === true;
});

// Test Suite 2: Follow-up Management
console.log('\n📋 Test Suite 2: Follow-up Management\n');

runTest('Follow-up Registration', () => {
  const state = initState({});
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  const beforeCap = atFollowupCap(state, question);
  registerFollowup(state, question);
  const afterCap = atFollowupCap(state, question);
  
  return beforeCap === false && afterCap === true;
});

runTest('Follow-up Limits - Background', () => {
  const state = initState({}, { maxFollowups: { background: 1, main: 3 } });
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  registerFollowup(state, question);
  const atCap = atFollowupCap(state, question);
  
  return atCap === true;
});

runTest('Follow-up Limits - Main', () => {
  const state = initState({}, { maxFollowups: { background: 1, main: 3 } });
  state.phase = 'main';
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  // Register 3 follow-ups
  registerFollowup(state, question);
  registerFollowup(state, question);
  registerFollowup(state, question);
  
  return atFollowupCap(state, question) === true;
});

// Test Suite 3: Audit Integration
console.log('\n📋 Test Suite 3: Audit Integration\n');

runTest('Completion Audit Pass', () => {
  const state = initState({});
  
  allowNextIfAuditPass(state, 'ALLOW_NEXT_QUESTION');
  const shouldAdv = shouldAdvance('ALLOW_NEXT_QUESTION');
  
  return state.allowedActions.has('NEXT_QUESTION') && shouldAdv === true;
});

runTest('Completion Audit Fail', () => {
  const state = initState({});
  
  allowNextIfAuditPass(state, 'REQUIRE_MORE');
  const shouldAdv = shouldAdvance('REQUIRE_MORE');
  
  return !state.allowedActions.has('NEXT_QUESTION') && shouldAdv === false;
});

runTest('Final Question Completion', () => {
  const state = initState({});
  state.phase = 'main';
  state.mainIdx = mainQuestions.length - 1;
  
  finalizeIfLastAndPassed(state, mainQuestions, 'ALLOW_NEXT_QUESTION');
  
  return state.allowedActions.has('SUMMARIZE_QUESTION') &&
         state.allowedActions.has('END') &&
         !state.allowedActions.has('NEXT_QUESTION');
});

// Test Suite 4: Question Progression
console.log('\n📋 Test Suite 4: Question Progression\n');

runTest('Background to Background Progression', () => {
  const state = initState({});
  const initialPhase = state.phase;
  const initialIdx = state.bgIdx;
  
  gotoNextQuestion(state, backgroundQuestions, mainQuestions);
  
  return state.phase === 'background' &&
         state.bgIdx === 1 &&
         state.mainIdx === 0;
});

runTest('Background to Main Progression', () => {
  const state = initState({});
  state.bgIdx = backgroundQuestions.length - 1;
  
  gotoNextQuestion(state, backgroundQuestions, mainQuestions);
  
  return state.phase === 'main' &&
         state.bgIdx === backgroundQuestions.length &&
         state.mainIdx === 0;
});

runTest('Main to Done Progression', () => {
  const state = initState({});
  state.phase = 'main';
  state.mainIdx = mainQuestions.length - 1;
  
  gotoNextQuestion(state, backgroundQuestions, mainQuestions);
  
  return state.phase === 'done';
});

// Test Suite 5: Action Management
console.log('\n📋 Test Suite 5: Action Management\n');

runTest('Allowed Actions Building', () => {
  const state = initState({});
  const actions = buildAllowedActionsForPrompt(state);
  
  return Array.isArray(actions) &&
         actions.includes('ASK_FOLLOWUP') &&
         actions.includes('REQUEST_CLARIFY') &&
         actions.includes('SUMMARIZE_QUESTION');
});

runTest('Action Enforcement - Valid', () => {
  const state = initState({});
  const validAction = { action: 'ASK_FOLLOWUP', utterance: 'test' };
  
  const enforced = enforceAllowedAction(state, validAction);
  
  return enforced.action === 'ASK_FOLLOWUP';
});

runTest('Action Enforcement - Invalid', () => {
  const state = initState({});
  const invalidAction = { action: 'INVALID_ACTION', utterance: 'test' };
  
  const enforced = enforceAllowedAction(state, invalidAction);
  
  return enforced.action === 'ASK_FOLLOWUP'; // Should fallback to allowed action
});

// Test Suite 6: Data Management
console.log('\n📋 Test Suite 6: Data Management\n');

runTest('Score Recording', () => {
  const state = initState({});
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  const scores = { completeness: 0.9, relevance: 0.8 };
  
  recordScores(state, question, scores);
  
  return state.perQuestion[question].lastScores === scores;
});

runTest('Audit Storage', () => {
  const state = initState({});
  const completionAudit = { verdict: 'PASS', scores: {} };
  const presenceAudit = { hasQuestion: true };
  
  storeAudits(state, { completionAudit, presenceAudit });
  
  return state.lastAudit === completionAudit &&
         state.lastPresence === presenceAudit;
});

// Test Suite 7: Executor Output Parsing
console.log('\n📋 Test Suite 7: Executor Output Parsing\n');

runTest('Valid JSON Parsing', () => {
  const validJson = '{"action": "ASK_FOLLOWUP", "utterance": "test"}';
  const parsed = parseExecutorOutput(validJson);
  
  return parsed.action === 'ASK_FOLLOWUP' &&
         parsed.utterance === 'test';
});

runTest('Markdown JSON Parsing', () => {
  const markdownJson = '```json\n{"action": "NEXT_QUESTION"}\n```';
  const parsed = parseExecutorOutput(markdownJson);
  
  return parsed.action === 'NEXT_QUESTION';
});

runTest('Invalid Input Handling', () => {
  const invalidInput = 'This is not JSON';
  const parsed = parseExecutorOutput(invalidInput);
  
  return parsed === null;
});

// Test Suite 8: Full Pipeline Simulation
console.log('\n📋 Test Suite 8: Full Pipeline Simulation\n');

runTest('Complete Conversation Flow', () => {
  const session = {};
  const state = initState(session, { maxFollowups: { background: 1, main: 2 } });
  
  // Simulate background question flow
  let currentQ = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  console.log(`  - Starting with: ${currentQ?.slice(0, 50)}...`);
  
  // Simulate completion audit pass
  allowNextIfAuditPass(state, 'ALLOW_NEXT_QUESTION');
  if (shouldAdvance('ALLOW_NEXT_QUESTION')) {
    gotoNextQuestion(state, backgroundQuestions, mainQuestions);
    currentQ = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
    console.log(`  - Advanced to: ${currentQ?.slice(0, 50)}...`);
  }
  
  // Simulate main question flow
  state.phase = 'main';
  currentQ = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  console.log(`  - Main question: ${currentQ?.slice(0, 50)}...`);
  
  // Simulate follow-up
  registerFollowup(state, currentQ);
  console.log(`  - Follow-up count: ${state.perQuestion[currentQ]?.followups}`);
  
  // Simulate completion audit fail
  allowNextIfAuditPass(state, 'REQUIRE_MORE');
  console.log(`  - Should advance: ${shouldAdvance('REQUIRE_MORE')}`);
  
  return state.phase === 'main' &&
         state.mainIdx === 0 &&
         state.perQuestion[currentQ]?.followups === 1;
});

// Test Suite 9: Edge Cases
console.log('\n📋 Test Suite 9: Edge Cases\n');

runTest('Empty Questions Arrays', () => {
  const state = initState({});
  const currentQ = getCurrentQuestion(state, [], []);
  
  return currentQ === null &&
         isFinalQuestion(state, []) === false;
});

runTest('Zero Follow-up Limits', () => {
  const state = initState({}, { maxFollowups: { background: 0, main: 0 } });
  const question = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  return atFollowupCap(state, question) === true;
});

runTest('State Reset After Question Change', () => {
  const state = initState({});
  const question1 = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  // Register follow-up and scores
  registerFollowup(state, question1);
  recordScores(state, question1, { completeness: 0.8 });
  
  // Move to next question
  gotoNextQuestion(state, backgroundQuestions, mainQuestions);
  const question2 = getCurrentQuestion(state, backgroundQuestions, mainQuestions);
  
  // Check if actions were reset
  return state.allowedActions.has('ASK_FOLLOWUP') &&
         !state.allowedActions.has('NEXT_QUESTION');
});

// Results Summary
console.log('\n🎉 All tests completed!');
console.log('\n📊 Test Results Summary:');
console.log(`- Total Tests: ${testResults.total}`);
console.log(`- Passed: ${testResults.passed} ✅`);
console.log(`- Failed: ${testResults.failed} ❌`);
console.log(`- Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

if (testResults.failed === 0) {
  console.log('\n🚀 All tests passed! The chatbot-audit-orchestrator pipeline is fully functional!');
  console.log('\n📋 Pipeline Components Verified:');
  console.log('  ✅ State management and initialization');
  console.log('  ✅ Question progression (background → main → done)');
  console.log('  ✅ Follow-up management and limits');
  console.log('  ✅ Audit integration and verdict handling');
  console.log('  ✅ Action enforcement and validation');
  console.log('  ✅ Data persistence and retrieval');
  console.log('  ✅ Executor output parsing');
  console.log('  ✅ Edge case handling');
} else {
  console.log('\n⚠️  Some tests failed. Please review the failed tests above.');
}

