/**
 * 集成测试 - 验证orchestratorSimple与LLM检查的集成
 * 
 * 运行方式: node test_integration.js
 */

import { 
    initSession, 
    getCurrentQuestion, 
    processAnswer,
    makeIntelligentDecision,
    getNextIntelligentFollowup 
} from './orchestratorSimple.js';

// 颜色输出函数
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

console.log(colors.blue('=== Orchestrator + LLM 集成测试 ===\n'));

// 模拟完整的问答流程
async function simulateFullConversation() {
    console.log(colors.yellow('📋 开始模拟完整对话流程...'));
    
    // 1. 初始化会话
    const session = initSession('integration-test', 'neutral');
    console.log(`\n${colors.blue('1. 会话初始化')}`);
    console.log(`   会话ID: ${session.sessionId}`);
    console.log(`   模式: ${session.mode}`);
    console.log(`   总问题数: ${session.totalQuestions}`);
    
    // 2. 获取第一个问题
    let currentQuestion = getCurrentQuestion(session);
    console.log(`\n${colors.blue('2. 第一个问题')}`);
    console.log(`   类型: ${currentQuestion.type}`);
    console.log(`   问题: ${currentQuestion.question.substring(0, 60)}...`);
    
    // 3. 模拟用户回答
    console.log(`\n${colors.blue('3. 用户回答第一个问题')}`);
    const userAnswer1 = "I studied Computer Science at MIT from 2018 to 2022. I graduated with honors and focused on artificial intelligence and machine learning.";
    console.log(`   回答: ${userAnswer1}`);
    
    processAnswer(session, userAnswer1, currentQuestion);
    console.log(`   ✅ 回答已记录，当前答案数: ${session.currentQuestionAnswers.length}`);
    
    // 4. 智能决策
    console.log(`\n${colors.blue('4. LLM智能决策')}`);
    const decision1 = await makeIntelligentDecision(session);
    console.log(`   决策: ${decision1.decision}`);
    console.log(`   推理: ${decision1.reasoning}`);
    
    if (decision1.decision === 'ASK_FOLLOWUPS') {
        console.log(`\n${colors.blue('5. 获取智能followup问题')}`);
        const followupQuestion = await getNextIntelligentFollowup(session);
        
        if (followupQuestion) {
            console.log(`   类型: ${followupQuestion.type}`);
            console.log(`   问题: ${followupQuestion.question}`);
            console.log(`   智能生成: ${followupQuestion.intelligentlyGenerated}`);
            
            // 回答followup
            const followupAnswer = "My professor Dr. Johnson was my mentor and taught me the most about machine learning algorithms.";
            console.log(`\n${colors.blue('6. 回答followup问题')}`);
            console.log(`   回答: ${followupAnswer}`);
            
            processAnswer(session, followupAnswer, followupQuestion);
            console.log(`   ✅ Followup回答已记录，当前答案数: ${session.currentQuestionAnswers.length}`);
            
            // 再次智能决策
            console.log(`\n${colors.blue('7. 再次进行智能决策')}`);
            const decision2 = await makeIntelligentDecision(session);
            console.log(`   决策: ${decision2.decision}`);
            console.log(`   推理: ${decision2.reasoning}`);
        }
    }
    
    // 8. 检查进度
    console.log(`\n${colors.blue('8. 当前进度状态')}`);
    console.log(`   当前问题索引: ${session.currentMainIdx}`);
    console.log(`   已完成问题数: ${session.completedQuestions}`);
    console.log(`   进度百分比: ${session.progressPercentage}%`);
    console.log(`   已完成主问题: ${Array.from(session.completedMainQuestions)}`);
    console.log(`   已完成followup: ${Array.from(session.completedFollowups)}`);
    
    // 9. 测试防回退机制
    console.log(`\n${colors.blue('9. 测试防回退机制')}`);
    const questionAfterCompletion = getCurrentQuestion(session);
    console.log(`   下一个问题类型: ${questionAfterCompletion.type}`);
    console.log(`   下一个问题索引: ${questionAfterCompletion.index || 'N/A'}`);
    
    if (questionAfterCompletion.type === 'main' && 
        session.completedMainQuestions.has(`main_${questionAfterCompletion.index}`)) {
        console.log(colors.red('   ❌ 防回退机制失败！重复询问已完成的问题'));
        return false;
    } else {
        console.log(colors.green('   ✅ 防回退机制正常工作'));
    }
    
    return true;
}

// 测试边界情况
async function testEdgeCases() {
    console.log(colors.yellow('\n🧪 测试边界情况...'));
    
    const session = initSession('edge-test', 'featured');
    
    // 测试空答案的智能决策
    console.log(`\n${colors.blue('1. 测试空答案的智能决策')}`);
    try {
        const emptyDecision = await makeIntelligentDecision(session);
        console.log(`   决策: ${emptyDecision.decision}`);
        console.log(`   推理: ${emptyDecision.reasoning}`);
        console.log(colors.green('   ✅ 空答案处理正常'));
    } catch (error) {
        console.log(colors.red(`   ❌ 空答案处理失败: ${error.message}`));
        return false;
    }
    
    // 测试获取不存在的followup
    console.log(`\n${colors.blue('2. 测试获取不存在的followup')}`);
    try {
        // 手动标记所有followup为完成状态
        session.completedFollowups.add('main_0_followup_0');
        session.completedFollowups.add('main_0_followup_1');
        session.completedFollowups.add('main_0_followup_2');
        
        const noFollowup = await getNextIntelligentFollowup(session);
        if (noFollowup === null) {
            console.log(colors.green('   ✅ 正确返回null当没有更多followup'));
        } else {
            console.log(colors.red('   ❌ 应该返回null但返回了followup'));
            return false;
        }
    } catch (error) {
        console.log(colors.red(`   ❌ Followup检查失败: ${error.message}`));
        return false;
    }
    
    return true;
}

// 测试性能
async function testPerformance() {
    console.log(colors.yellow('\n⚡ 性能测试...'));
    
    const startTime = Date.now();
    
    // 创建多个并发会话
    const sessions = [];
    for (let i = 0; i < 5; i++) {
        sessions.push(initSession(`perf-test-${i}`, 'neutral'));
    }
    
    // 并发处理多个决策
    const decisions = await Promise.all(
        sessions.map(async (session, index) => {
            // 添加一个模拟答案
            const question = getCurrentQuestion(session);
            processAnswer(session, `This is test answer ${index}`, question);
            
            // 进行智能决策
            return await makeIntelligentDecision(session);
        })
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`   处理了 ${sessions.length} 个并发会话`);
    console.log(`   总耗时: ${duration}ms`);
    console.log(`   平均每个会话: ${Math.round(duration / sessions.length)}ms`);
    
    if (duration < 10000) { // 10秒内完成
        console.log(colors.green('   ✅ 性能测试通过'));
        return true;
    } else {
        console.log(colors.red('   ❌ 性能测试失败，耗时过长'));
        return false;
    }
}

// 运行所有测试
async function runIntegrationTests() {
    console.log(colors.blue('开始运行集成测试...\n'));
    
    let allPassed = true;
    
    try {
        // 1. 完整对话流程测试
        console.log(colors.yellow('=== 测试 1: 完整对话流程 ==='));
        const conversationTest = await simulateFullConversation();
        if (!conversationTest) allPassed = false;
        
        // 2. 边界情况测试
        console.log(colors.yellow('\n=== 测试 2: 边界情况 ==='));
        const edgeTest = await testEdgeCases();
        if (!edgeTest) allPassed = false;
        
        // 3. 性能测试
        console.log(colors.yellow('\n=== 测试 3: 性能测试 ==='));
        const perfTest = await testPerformance();
        if (!perfTest) allPassed = false;
        
    } catch (error) {
        console.error(colors.red('集成测试出现异常:'), error);
        allPassed = false;
    }
    
    // 输出最终结果
    console.log('\n' + colors.blue('=== 集成测试结果 ==='));
    if (allPassed) {
        console.log(colors.green('🎉 所有集成测试通过！'));
        console.log(colors.green('✅ Orchestrator Simple + LLM 检查集成成功'));
        console.log(colors.green('✅ 防回退机制正常工作'));
        console.log(colors.green('✅ 智能决策功能正常'));
        console.log(colors.green('✅ 错误处理和边界情况处理正常'));
        console.log(colors.green('✅ 性能满足要求'));
    } else {
        console.log(colors.red('❌ 部分集成测试失败，需要进一步检查'));
    }
    
    return allPassed;
}

// 运行测试
runIntegrationTests()
    .then(success => {
        if (!success) {
            process.exit(1);
        }
    })
    .catch(error => {
        console.error(colors.red('测试运行失败:'), error);
        process.exit(1);
    });