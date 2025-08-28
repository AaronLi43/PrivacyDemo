/**
 * 测试"无经历"与"记忆问题"的区别
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

async function testNoExperienceVsMemory() {
    console.log('🧪 测试"无经历"与"记忆问题"的区别\n');
    
    // 测试1: 真正的无经历 - 应该跳过
    console.log('📋 测试1: 真正的无经历');
    const req1 = new MockRequest({
        message: "No, I never used AI for interviews",
        sessionId: 'test-no-exp-' + Date.now(),
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    
    const skippedDueToNoExperience = res1.responseData.question_completed && 
                                   res1.responseData.bot_response.includes('work');
    
    console.log(`   ✅ 无经历跳过: ${skippedDueToNoExperience ? '通过' : '失败'}`);
    console.log(`   📝 回复: "${res1.responseData.bot_response}"`);
    
    // 测试2: 记忆问题 - 应该继续追问followup
    console.log('\n📋 测试2: 记忆问题但可能有经历');
    const req2 = new MockRequest({
        message: "I cannot remember exactly when I used AI",
        sessionId: 'test-memory-' + Date.now(),
        step: 1
    });
    const res2 = new MockResponse();
    
    await handleChatSimple(req2, res2);
    
    const continuedWithFollowups = !res2.responseData.question_completed &&
                                  res2.responseData.follow_up_questions &&
                                  res2.responseData.follow_up_questions.length > 0;
    
    console.log(`   ✅ 记忆问题继续followup: ${continuedWithFollowups ? '通过' : '失败'}`);
    console.log(`   📝 回复: "${res2.responseData.bot_response}"`);
    
    // 测试3: 明确的"没做过"表述 - 应该跳过
    console.log('\n📋 测试3: 明确的"没做过"表述');
    const req3 = new MockRequest({
        message: "I haven't used AI for job interviews",
        sessionId: 'test-havent-' + Date.now(),
        step: 1
    });
    const res3 = new MockResponse();
    
    await handleChatSimple(req3, res3);
    
    const skippedDueToHavent = res3.responseData.question_completed;
    
    console.log(`   ✅ "Haven't"跳过: ${skippedDueToHavent ? '通过' : '失败'}`);
    console.log(`   📝 回复: "${res3.responseData.bot_response}"`);
    
    // 测试4: 含有"remember"和"never"的混合情况 - "never"优先，应该跳过
    console.log('\n📋 测试4: 混合情况（记忆+从未）');
    const req4 = new MockRequest({
        message: "I can't remember because I never used AI for interviews",
        sessionId: 'test-mixed-' + Date.now(),
        step: 1
    });
    const res4 = new MockResponse();
    
    await handleChatSimple(req4, res4);
    
    const skippedDueToNever = res4.responseData.question_completed;
    
    console.log(`   ✅ 混合情况处理: ${skippedDueToNever ? '通过' : '失败'}`);
    console.log(`   📝 回复: "${res4.responseData.bot_response}"`);
    
    // 总结
    const allTestsPassed = skippedDueToNoExperience && continuedWithFollowups && 
                          skippedDueToHavent && skippedDueToNever;
    
    console.log(`\n🎯 测试结果: ${allTestsPassed ? '✅ 全部通过' : '❌ 有失败'}`);
    
    if (allTestsPassed) {
        console.log('🎉 "无经历"与"记忆问题"区别逻辑正确！');
        console.log('✅ 真正无经历会跳过到下一个主问题');
        console.log('✅ 记忆问题会继续问followup');
        console.log('✅ 明确的否定表述会正确跳过');
    }
    
    return allTestsPassed;
}

testNoExperienceVsMemory()
    .then(success => {
        console.log(`\n🏁 测试完成 - ${success ? '成功' : '需要调整'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });