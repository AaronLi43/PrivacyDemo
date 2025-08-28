/**
 * 测试简化orchestrator的基础功能
 * 
 * 运行方式: node test_orchestratorSimple.js
 */

import { 
    initSession, 
    getCurrentQuestion, 
    processAnswer, 
    shouldAdvanceToNext,
    saveStateSnapshot,
    restoreStateFromSnapshot,
    validateState,
    buildApiResponse
} from './orchestratorSimple.js';

// 颜色输出函数
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// 测试计数器
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, testFn) {
    testCount++;
    console.log(`\n${colors.blue(`Test ${testCount}: ${name}`)}`);
    
    try {
        const result = testFn();
        if (result) {
            console.log(colors.green('✅ PASSED'));
            passCount++;
        } else {
            console.log(colors.red('❌ FAILED'));
            failCount++;
        }
    } catch (error) {
        console.log(colors.red(`❌ FAILED - ${error.message}`));
        failCount++;
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual === expected) {
        return true;
    }
    console.log(`Expected: ${expected}, Got: ${actual}. ${message}`);
    return false;
}

function assertTrue(condition, message = '') {
    if (condition) {
        return true;
    }
    console.log(`Expected true, got false. ${message}`);
    return false;
}

function assertFalse(condition, message = '') {
    return assertTrue(!condition, message);
}

// 开始测试
console.log(colors.blue('=== 简化Orchestrator测试套件 ===\n'));

// 测试1: 会话初始化
test('会话初始化', () => {
    const state = initSession('test-123', 'neutral');
    
    return assertEqual(state.sessionId, 'test-123') &&
           assertEqual(state.mode, 'neutral') &&
           assertEqual(state.currentMainIdx, 0) &&
           assertEqual(state.completedQuestions, 0) &&
           assertTrue(state.completedMainQuestions instanceof Set) &&
           assertTrue(state.completedFollowups instanceof Set) &&
           assertEqual(state.completedMainQuestions.size, 0);
});

// 测试2: 获取第一个问题
test('获取第一个问题', () => {
    const state = initSession('test-123', 'neutral');
    const question = getCurrentQuestion(state);
    
    return assertEqual(question.type, 'main') &&
           assertEqual(question.index, 0) &&
           assertTrue(question.question.length > 0) &&
           assertTrue(question.isFirstTime);
});

// 测试3: 处理主问题答案
test('处理主问题答案', () => {
    const state = initSession('test-123', 'neutral');
    const question = getCurrentQuestion(state);
    const result = processAnswer(state, 'I studied Computer Science', question);
    
    return assertEqual(result.status, 'pending_check') &&
           assertTrue(result.needsLLMCheck) &&
           assertEqual(result.checkType, 'relevance') &&
           assertEqual(state.currentQuestionAnswers.length, 1) &&
           assertEqual(state.conversationLog.length, 1);
});

// 测试4: 防回退机制
test('防回退机制 - 主问题不重复', () => {
    const state = initSession('test-123', 'neutral');
    
    // 完成第一个主问题
    state.completedMainQuestions.add('main_0');
    state.currentMainIdx = 0;
    
    const question = getCurrentQuestion(state);
    
    // 应该跳过已完成的主问题，或者检查followup
    return assertTrue(question.type !== 'main' || question.index !== 0);
});

// 测试5: 状态持久化
test('状态持久化和恢复', () => {
    const state = initSession('test-123', 'neutral');
    state.completedMainQuestions.add('main_0');
    state.completedFollowups.add('main_0_followup_1');
    state.currentMainIdx = 1;
    state.completedQuestions = 1;
    
    // 保存快照
    const snapshot = saveStateSnapshot(state);
    
    // 恢复状态
    const restoredState = restoreStateFromSnapshot(snapshot);
    
    return assertEqual(restoredState.currentMainIdx, 1) &&
           assertEqual(restoredState.completedQuestions, 1) &&
           assertTrue(restoredState.completedMainQuestions.has('main_0')) &&
           assertTrue(restoredState.completedFollowups.has('main_0_followup_1'));
});

// 测试6: 状态验证
test('状态验证功能', () => {
    const state = initSession('test-123', 'neutral');
    
    // 故意破坏状态
    state.currentMainIdx = -1;
    state.completedMainQuestions = null;
    
    const wasValid = validateState(state);
    
    // 验证状态已被修复（validateState返回false表示发现并修复了问题）
    return assertFalse(wasValid, 'Should return false when state was invalid') &&
           assertTrue(state.currentMainIdx >= 0, 'currentMainIdx should be fixed') &&
           assertTrue(state.completedMainQuestions instanceof Set, 'completedMainQuestions should be restored');
});

// 测试7: API响应格式
test('API响应格式兼容性', () => {
    const state = initSession('test-123', 'neutral');
    const response = buildApiResponse(state, 'Test response', {
        questionCompleted: false,
        followUpQuestions: ['Follow up 1'],
        auditResult: { verdict: 'CONTINUE' }
    });
    
    // 检查必需的字段
    return assertTrue(response.hasOwnProperty('bot_response')) &&
           assertTrue(response.hasOwnProperty('question_completed')) &&
           assertTrue(response.hasOwnProperty('follow_up_questions')) &&
           assertTrue(response.hasOwnProperty('audit_result')) &&
           assertTrue(response.hasOwnProperty('orchestrator_state')) &&
           assertEqual(response.bot_response, 'Test response') &&
           assertEqual(response.question_completed, false) &&
           assertEqual(response.follow_up_questions.length, 1);
});

// 测试8: 进度计算
test('进度计算准确性', () => {
    const state = initSession('test-123', 'neutral');
    
    // 模拟完成一些问题
    state.completedQuestions = 3;
    state.totalQuestions = 6;
    state.progressPercentage = Math.round((3 / 6) * 100);
    
    const isValid = validateState(state);
    
    return assertTrue(isValid) &&
           assertEqual(state.progressPercentage, 50);
});

// 测试9: 模拟完整问答流程
test('模拟完整问答流程', () => {
    const state = initSession('test-123', 'neutral');
    let successful = true;
    
    // 获取第一个问题
    let question = getCurrentQuestion(state);
    if (question.type !== 'main' || question.index !== 0) {
        console.log(`Expected main question 0, got ${question.type} ${question.index}`);
        successful = false;
    }
    
    // 回答第一个问题
    processAnswer(state, 'I studied Engineering', question);
    
    // 在没有标记完成前，应该检查是否有followup
    // 因为主问题未标记完成，可能会返回followup
    question = getCurrentQuestion(state);
    // 现在应该是followup或者仍然是同一个主问题（取决于实现逻辑）
    
    // 标记第一个主问题完成
    state.completedMainQuestions.add('main_0');
    state.completedQuestions = 1;
    state.currentMainIdx = 1; // 手动推进到下一个问题
    
    // 现在应该进入第二个主问题
    question = getCurrentQuestion(state);
    if (question.type !== 'main' || question.index !== 1) {
        console.log(`Expected main question 1, got ${question.type} ${question.index}`);
        successful = false;
    }
    
    return assertTrue(successful);
});

// 测试10: 边界条件 - 所有问题完成
test('边界条件 - 所有问题完成', () => {
    const state = initSession('test-123', 'neutral');
    
    // 模拟完成所有问题
    state.currentMainIdx = state.mainQuestions.length;
    
    const question = getCurrentQuestion(state);
    
    return assertEqual(question.type, 'completed') &&
           assertTrue(question.isComplete) &&
           assertTrue(question.message.includes('Thanks'));
});

// 运行测试总结
console.log('\n' + colors.blue('=== 测试结果 ==='));
console.log(`总测试数: ${testCount}`);
console.log(`通过: ${colors.green(passCount)}`);
console.log(`失败: ${colors.red(failCount)}`);

if (failCount === 0) {
    console.log(colors.green('\n🎉 所有测试通过! Orchestrator Simple 基础功能正常'));
} else {
    console.log(colors.red(`\n⚠️  有 ${failCount} 个测试失败，需要修复`));
}

// 额外的实际使用示例
console.log('\n' + colors.blue('=== 实际使用示例 ==='));

const demoState = initSession('demo-session', 'neutral');
console.log('1. 初始化会话:');
console.log(`   - 会话ID: ${demoState.sessionId}`);
console.log(`   - 当前问题索引: ${demoState.currentMainIdx}`);
console.log(`   - 总问题数: ${demoState.totalQuestions}`);

const firstQuestion = getCurrentQuestion(demoState);
console.log('\n2. 获取第一个问题:');
console.log(`   - 类型: ${firstQuestion.type}`);
console.log(`   - 问题: ${firstQuestion.question.substring(0, 50)}...`);

console.log('\n3. 模拟回答问题:');
processAnswer(demoState, 'I have a degree in Computer Science', firstQuestion);
console.log(`   - 累积回答数: ${demoState.currentQuestionAnswers.length}`);
console.log(`   - 对话记录数: ${demoState.conversationLog.length}`);

const apiResponse = buildApiResponse(demoState, 'Thanks for sharing that information.');
console.log('\n4. API响应格式:');
console.log(`   - bot_response: ${apiResponse.bot_response}`);
console.log(`   - question_completed: ${apiResponse.question_completed}`);
console.log(`   - 内部状态索引: ${apiResponse.orchestrator_state.currentMainIdx}`);

console.log(colors.green('\n✅ 基础功能演示完成'));