/**
 * 测试进度条计数逻辑
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

async function testProgressCounting() {
    console.log('🧪 测试进度条计数逻辑\n');
    
    const sessionId = 'progress-test-' + Date.now();
    
    console.log('📋 测试场景: 完整回答第一个主问题和所有follow-up');
    console.log('预期: 每个步骤后进度条都应该适当更新\n');
    
    // 步骤1: 回答第一个主问题 - 应该进入follow-up，不增加进度
    console.log('--- 步骤 1: 回答第一个主问题 ---');
    const req1 = new MockRequest({
        message: "Yes, I used ChatGPT to prepare for my software engineer interview at Google",
        sessionId: sessionId,
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    
    console.log(`进度: ${res1.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res1.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res1.responseData.question_completed}`);
    console.log(`机器人回复: "${res1.responseData.bot_response}"\n`);
    
    // 步骤2: 回答第一个follow-up
    console.log('--- 步骤 2: 回答第一个follow-up ---');
    const req2 = new MockRequest({
        message: "I started my CS degree at UCLA in September 2020 and graduated in June 2024",
        sessionId: sessionId,
        step: 2
    });
    const res2 = new MockResponse();
    
    await handleChatSimple(req2, res2);
    
    console.log(`进度: ${res2.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res2.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res2.responseData.question_completed}`);
    console.log(`机器人回复: "${res2.responseData.bot_response}"\n`);
    
    // 步骤3: 回答第二个follow-up  
    console.log('--- 步骤 3: 回答第二个follow-up ---');
    const req3 = new MockRequest({
        message: "UCLA is located in Los Angeles, California",
        sessionId: sessionId,
        step: 3
    });
    const res3 = new MockResponse();
    
    await handleChatSimple(req3, res3);
    
    console.log(`进度: ${res3.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res3.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res3.responseData.question_completed}`);
    console.log(`机器人回复: "${res3.responseData.bot_response}"\n`);
    
    // 步骤4: 回答第三个（最后一个）follow-up - 这时应该完成第一个主问题，进度应该更新
    console.log('--- 步骤 4: 回答最后一个follow-up ---');
    const req4 = new MockRequest({
        message: "Professor Chen was my most influential instructor, he taught me algorithms and data structures",
        sessionId: sessionId,
        step: 4
    });
    const res4 = new MockResponse();
    
    await handleChatSimple(req4, res4);
    
    console.log(`进度: ${res4.responseData.orchestrator_state?.progressPercentage || 0}%`);
    console.log(`完成问题数: ${res4.responseData.orchestrator_state?.completedQuestions || 0}`);
    console.log(`问题完成: ${res4.responseData.question_completed}`);
    console.log(`机器人回复: "${res4.responseData.bot_response}"\n`);
    
    // 分析进度条行为
    console.log('🎯 进度条行为分析:');
    
    const step1Progress = res1.responseData.orchestrator_state?.progressPercentage || 0;
    const step2Progress = res2.responseData.orchestrator_state?.progressPercentage || 0;
    const step3Progress = res3.responseData.orchestrator_state?.progressPercentage || 0;
    const step4Progress = res4.responseData.orchestrator_state?.progressPercentage || 0;
    
    console.log(`   1. 主问题回答后: ${step1Progress}%`);
    console.log(`   2. 第1个followup后: ${step2Progress}%`);
    console.log(`   3. 第2个followup后: ${step3Progress}%`);
    console.log(`   4. 第3个followup后: ${step4Progress}%`);
    
    // 检查进度是否正确更新
    const expectedProgressAfterFirst = Math.round((1 / 6) * 100); // 完成1个主问题，总共6个
    const progressIncreasedCorrectly = step4Progress > step1Progress && step4Progress >= expectedProgressAfterFirst;
    
    console.log(`\n预期完成第1个主问题后进度: ~${expectedProgressAfterFirst}%`);
    console.log(`实际完成第1个主问题后进度: ${step4Progress}%`);
    
    console.log(`\n🎯 进度计数测试结果: ${progressIncreasedCorrectly ? '✅ 正确' : '❌ 有问题'}`);
    
    if (progressIncreasedCorrectly) {
        console.log('🎉 进度条正确地在完成主问题后更新！');
    } else {
        console.log('⚠️ 进度条未能正确更新，需要修复逻辑');
        console.log('问题可能在于：');
        console.log('   - completedQuestions 没有在正确时机增加');
        console.log('   - progressPercentage 计算有误');
        console.log('   - 主问题完成判断逻辑有问题');
    }
    
    return progressIncreasedCorrectly;
}

testProgressCounting()
    .then(success => {
        console.log(`\n🏁 进度计数测试完成 - ${success ? '通过' : '需要修复'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });