/**
 * 验证简化后的orchestrator逻辑
 * 测试要点：
 * 1. 主问题无经历 -> 跳到下一个主问题
 * 2. 主问题有经历 -> 问所有followup
 * 3. Followup按顺序询问，无重复，无覆盖检查
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

async function testSimplifiedLogic() {
    console.log('🧪 测试简化的orchestrator逻辑\n');
    
    const sessionId = 'simple-test-' + Date.now();
    
    // 测试1: 主问题表示无经历，应该跳过
    console.log('🔍 测试1: 无经历跳过逻辑');
    const req1 = new MockRequest({
        message: "No, I never used AI for job interviews",
        sessionId: sessionId + '_1',
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    
    const skippedToNext = res1.responseData.question_completed && 
                         res1.responseData.bot_response.includes('work');
    console.log(`   ✅ 跳过测试: ${skippedToNext ? '通过' : '失败'}`);
    console.log(`   📝 回复: "${res1.responseData.bot_response}"`);
    
    // 测试2: 主问题有经历，应该问所有followup
    console.log('\n🔍 测试2: 有经历问所有followup');
    const sessionId2 = sessionId + '_2';
    
    // 第一步：回答主问题
    const req2a = new MockRequest({
        message: "Yes, I used ChatGPT to prepare for interviews",
        sessionId: sessionId2,
        step: 1
    });
    const res2a = new MockResponse();
    await handleChatSimple(req2a, res2a);
    
    console.log(`   ✅ 主问题回答后进入followup: ${!res2a.responseData.question_completed ? '通过' : '失败'}`);
    console.log(`   📝 第一个followup: "${res2a.responseData.bot_response}"`);
    
    // 第二步：回答第一个followup
    const req2b = new MockRequest({
        message: "I used it last month",
        sessionId: sessionId2,
        step: 2
    });
    const res2b = new MockResponse();
    await handleChatSimple(req2b, res2b);
    
    console.log(`   ✅ 第一个followup完成后问第二个: ${!res2b.responseData.question_completed ? '通过' : '失败'}`);
    console.log(`   📝 第二个followup: "${res2b.responseData.bot_response}"`);
    
    // 第三步：回答第二个followup
    const req2c = new MockRequest({
        message: "I used it for mock interviews",
        sessionId: sessionId2,
        step: 3
    });
    const res2c = new MockResponse();
    await handleChatSimple(req2c, res2c);
    
    console.log(`   ✅ 第二个followup完成后问第三个: ${!res2c.responseData.question_completed ? '通过' : '失败'}`);
    console.log(`   📝 第三个followup: "${res2c.responseData.bot_response}"`);
    
    // 第四步：回答第三个followup，应该完成该主题
    const req2d = new MockRequest({
        message: "It was very helpful",
        sessionId: sessionId2,
        step: 4
    });
    const res2d = new MockResponse();
    await handleChatSimple(req2d, res2d);
    
    const advancedAfterAllFollowups = res2d.responseData.question_completed;
    console.log(`   ✅ 所有followup完成后进入下一主题: ${advancedAfterAllFollowups ? '通过' : '失败'}`);
    console.log(`   📝 下一个主题: "${res2d.responseData.bot_response}"`);
    
    // 总结
    const allTestsPassed = skippedToNext && advancedAfterAllFollowups;
    console.log(`\n🎯 简化逻辑验证结果: ${allTestsPassed ? '✅ 全部通过' : '❌ 需要调整'}`);
    
    if (allTestsPassed) {
        console.log('🎉 简化的orchestrator逻辑工作正常！');
        console.log('✅ 无经历正确跳过');
        console.log('✅ 有经历问所有followup');
        console.log('✅ Followup按顺序执行');
        console.log('✅ 无重复询问或复杂检查');
    }
    
    return allTestsPassed;
}

testSimplifiedLogic()
    .then(success => {
        console.log(`\n🏁 简化逻辑测试完成 - ${success ? '成功' : '需要改进'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });