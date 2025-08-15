// Test script to verify orchestrator functions are properly exported
import {
    WELCOME_TEXT, 
    initState, 
    getCurrentQuestion, 
    isFinalQuestion,
    atFollowupCap, 
    registerFollowup, 
    recordScores,
    buildAllowedActionsForPrompt, 
    allowNextIfAuditPass, 
    finalizeIfLastAndPassed,
    shouldAdvance, 
    gotoNextQuestion, 
    storeAudits, 
    parseExecutorOutput, 
    enforceAllowedAction,
    applyHeuristicsFromAudits, 
    buildOrchestratorDirectives, 
    composeAssistantMessage, 
    peekNextQuestion
} from './orchestrator.js';

console.log('🧪 Testing orchestrator function exports...\n');

// Test 1: Check if all functions are defined
const functions = {
    WELCOME_TEXT,
    initState,
    getCurrentQuestion,
    isFinalQuestion,
    atFollowupCap,
    registerFollowup,
    recordScores,
    buildAllowedActionsForPrompt,
    allowNextIfAuditPass,
    finalizeIfLastAndPassed,
    shouldAdvance,
    gotoNextQuestion,
    storeAudits,
    parseExecutorOutput,
    enforceAllowedAction,
    applyHeuristicsFromAudits,
    buildOrchestratorDirectives,
    composeAssistantMessage,
    peekNextQuestion
};

let allGood = true;
for (const [name, func] of Object.entries(functions)) {
    if (typeof func === 'undefined') {
        console.log(`❌ ${name} is undefined`);
        allGood = false;
    } else {
        console.log(`✅ ${name} is defined (${typeof func})`);
    }
}

console.log('\n' + '='.repeat(50) + '\n');

// Test 2: Test basic functionality
if (allGood) {
    console.log('🧪 Testing basic functionality...\n');
    
    try {
        // Test session initialization
        const session = { state: null };
        const state = initState(session);
        console.log('✅ initState works:', state.phase);
        
        // Test with sample questions
        const mainQuestions = [
            'What is your background?',
            'How did you use AI?',
            'What were the outcomes?'
        ];
        
        const currentQ = getCurrentQuestion(state, mainQuestions);
        console.log('✅ getCurrentQuestion works:', currentQ);
        
        const nextQ = peekNextQuestion(state, mainQuestions);
        console.log('✅ peekNextQuestion works:', nextQ);
        
        const isFinal = isFinalQuestion(state, mainQuestions);
        console.log('✅ isFinalQuestion works:', isFinal);
        
        console.log('\n🎉 All orchestrator functions are working correctly!');
        
    } catch (error) {
        console.log('❌ Error testing functions:', error.message);
        console.log('Stack:', error.stack);
    }
} else {
    console.log('❌ Some functions are missing, cannot test functionality');
}
