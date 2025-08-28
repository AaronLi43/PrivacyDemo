/**
 * 测试跳过场景下的进度条计数
 */

import { handleChatSimple } from './chatHandlerSimple.js';

class MockRequest {
    constructor(body) {
        this.body = body;
    }
}

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.responseData = null;
    }
    
    status(code) {
        this.statusCode = code;
        return this;
    }
    
    json(data) {
        this.responseData = data;
        return this;
    }
}

async function testProgressSkipCounting() {
    console.log('🧪 测试跳过场景下的进度条计数\n');
    
    const sessionId = 'progress-skip-test-' + Date.now();
    
    console.log('📋 测试场景: 混合跳过和完整回答');
    console.log('预期: 每次完成主问题（跳过或完整回答）后进度都应该更新\n');
    
    // 步骤1: 跳过第一个主问题
    console.log('--- 步骤 1: 跳过第一个主问题 ---');
    const req1 = new MockRequest({
        message: "No, I never used AI for interviews",
        sessionId: sessionId,
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    
    console.log(`进度: ${res1.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res1.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res1.responseData.question_completed}`);
    console.log(`机器人回复: "${res1.responseData.bot_response.substring(0, 50)}..."\n`);
    
    // 步骤2: 跳过第二个主问题  
    console.log('--- 步骤 2: 跳过第二个主问题 ---');
    const req2 = new MockRequest({
        message: "I haven't done job interviews recently",
        sessionId: sessionId,
        step: 2
    });
    const res2 = new MockResponse();
    
    await handleChatSimple(req2, res2);
    
    console.log(`进度: ${res2.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res2.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res2.responseData.question_completed}`);
    console.log(`机器人回复: "${res2.responseData.bot_response.substring(0, 50)}..."\n`);
    
    // 步骤3: 完整回答第三个主问题 - 第一步
    console.log('--- 步骤 3: 开始回答第三个主问题 ---');
    const req3 = new MockRequest({
        message: "Yes, I used ChatGPT to practice interview questions",
        sessionId: sessionId,
        step: 3
    });
    const res3 = new MockResponse();
    
    await handleChatSimple(req3, res3);
    
    console.log(`进度: ${res3.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res3.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res3.responseData.question_completed}`);
    console.log(`机器人回复: "${res3.responseData.bot_response.substring(0, 50)}..."\n`);
    
    // 快速完成第三个主问题的所有followup
    console.log('--- 步骤 4-6: 快速完成第三个问题的所有followup ---');
    const followupAnswers = [
        "I used it before my Google interview in March 2024",
        "I used ChatGPT and also tried Claude for generating practice questions", 
        "It helped me feel more confident and I got the job"
    ];
    
    let lastResponse = res3.responseData;
    for (let i = 0; i < followupAnswers.length; i++) {
        const req = new MockRequest({
            message: followupAnswers[i],
            sessionId: sessionId,
            step: 4 + i
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        lastResponse = res.responseData;
        
        console.log(`   Followup ${i + 1}: 进度 ${lastResponse.orchestrator_state?.progressPercentage || 0}%, 完成 ${lastResponse.orchestrator_state?.completedQuestions || 0}, 问题完成: ${lastResponse.question_completed}`);
    }
    
    // 分析进度更新模式
    console.log('\n🎯 进度更新分析:');
    
    const step1Progress = res1.responseData.orchestrator_state?.progressPercentage || 0;
    const step2Progress = res2.responseData.orchestrator_state?.progressPercentage || 0; 
    const step3Progress = res3.responseData.orchestrator_state?.progressPercentage || 0;
    const finalProgress = lastResponse.orchestrator_state?.progressPercentage || 0;
    
    console.log(`   跳过第1个问题后: ${step1Progress}% (预期: ~17%)`);
    console.log(`   跳过第2个问题后: ${step2Progress}% (预期: ~33%)`);
    console.log(`   开始第3个问题时: ${step3Progress}%`);
    console.log(`   完成第3个问题后: ${finalProgress}% (预期: ~50%)`);
    
    // 检查跳过时进度是否立即更新
    const skipProgressWorks = step1Progress > 0 && step2Progress > step1Progress;
    const completeProgressWorks = finalProgress > step3Progress;
    
    console.log(`\n🎯 进度更新测试结果:`);
    console.log(`   跳过时立即更新: ${skipProgressWorks ? '✅ 正确' : '❌ 有问题'}`);
    console.log(`   完整回答时更新: ${completeProgressWorks ? '✅ 正确' : '❌ 有问题'}`);
    
    const allWorking = skipProgressWorks && completeProgressWorks;
    
    if (!skipProgressWorks) {
        console.log('\n⚠️ 问题发现: 跳过主问题时进度没有立即更新');
        console.log('这可能解释了为什么用户感觉进度条延迟更新');
    }
    
    return allWorking;
}

testProgressSkipCounting()
    .then(success => {
        console.log(`\n🏁 跳过进度计数测试完成 - ${success ? '通过' : '发现问题'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });