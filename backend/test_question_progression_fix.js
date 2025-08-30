/**
 * 测试问题推进修复
 * 验证ADVANCE_TO_NEXT逻辑是否正确包含下一个问题
 */

import { handleChatSimple } from './chatHandlerSimple.js';

// Mock Express对象
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

async function testQuestionProgression() {
    console.log('🧪 测试问题推进修复...\n');
    
    const sessionId = 'fix-test-' + Date.now();
    
    // 第一轮：回答教育问题
    console.log('1. 回答教育背景问题...');
    const req1 = new MockRequest({
        message: "I studied Computer Science at Stanford University from 2018 to 2022. I graduated magna cum laude and specialized in artificial intelligence and machine learning.",
        sessionId: sessionId,
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    console.log(`   ✅ 响应成功: ${res1.responseData.success}`);
    console.log(`   📝 机器人回复: "${res1.responseData.bot_response.substring(0, 100)}..."`);
    console.log(`   🔄 问题完成: ${res1.responseData.question_completed}`);
    console.log(`   📊 对话历史长度: ${res1.responseData.conversation_history.length}`);
    
    // 第二轮：回答followup让系统决定ADVANCE_TO_NEXT
    console.log('\n2. 回答followup问题触发下一个主问题...');
    const req2 = new MockRequest({
        message: "I was particularly influenced by Professor Fei-Fei Li who taught me about computer vision, and Professor Andrew Ng who introduced me to machine learning. They were both incredible mentors who shaped my understanding of AI.",
        sessionId: sessionId,
        step: 2
    });
    const res2 = new MockResponse();
    
    await handleChatSimple(req2, res2);
    console.log(`   ✅ 响应成功: ${res2.responseData.success}`);
    console.log(`   📝 机器人回复长度: ${res2.responseData.bot_response.length} 字符`);
    console.log(`   📝 机器人完整回复: "${res2.responseData.bot_response}"`);
    console.log(`   🔄 问题完成: ${res2.responseData.question_completed}`);
    console.log(`   🏁 面试完成: ${res2.responseData.interview_finished}`);
    
    // 验证修复
    const isFixed = res2.responseData.bot_response.length > 50 && 
                   res2.responseData.bot_response.includes('?');
    
    console.log(`\n🎯 修复验证:`);
    console.log(`   - 回复长度充足: ${res2.responseData.bot_response.length > 50 ? '✅' : '❌'}`);
    console.log(`   - 包含问题内容: ${res2.responseData.bot_response.includes('?') ? '✅' : '❌'}`);
    console.log(`   - 修复状态: ${isFixed ? '✅ 已修复' : '❌ 仍有问题'}`);
    
    if (isFixed) {
        console.log('\n🎉 问题推进修复成功！机器人现在会正确显示下一个问题。');
    } else {
        console.log('\n⚠️ 修复可能需要进一步调整。');
    }
    
    return isFixed;
}

// 运行测试
testQuestionProgression()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });