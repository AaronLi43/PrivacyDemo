/**
 * 测试友善面试官修复
 * 验证系统是否不再过度追问，能正确处理用户拒绝
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

async function testFriendlyInterviewerFix() {
    console.log('🧪 测试友善面试官修复...\n');
    
    const sessionId = 'friendly-test-' + Date.now();
    
    // 测试场景：用户回答教育问题，然后说不记得某些细节
    const testScenario = [
        {
            message: "I study CS at UCLA",
            expectedBehavior: "应该问followup问题，如时间、地点、导师"
        },
        {
            message: "I started in September 2023 and will graduate in June 2025",
            expectedBehavior: "时间信息已提供，应该问其他followup如地点或导师"
        },
        {
            message: "I cannot remember the exact location details",
            expectedBehavior: "用户表示不记得，应该停止追问地点，询问其他问题或进入下一个主题"
        },
        {
            message: "My supervisor is Professor Chen",
            expectedBehavior: "导师信息已提供，应该完成教育话题，进入工作话题"
        }
    ];
    
    console.log('📋 测试场景：');
    testScenario.forEach((scenario, index) => {
        console.log(`   ${index + 1}. "${scenario.message}"`);
        console.log(`      预期: ${scenario.expectedBehavior}`);
    });
    
    console.log('\n🚀 开始模拟对话...\n');
    
    for (let i = 0; i < testScenario.length; i++) {
        const scenario = testScenario[i];
        
        console.log(`--- 轮次 ${i + 1} ---`);
        console.log(`用户: "${scenario.message}"`);
        
        const req = new MockRequest({
            message: scenario.message,
            sessionId: sessionId,
            step: i + 1
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        
        console.log(`机器人: "${res.responseData.bot_response}"`);
        console.log(`问题完成: ${res.responseData.question_completed}`);
        console.log(`Follow-up数量: ${res.responseData.follow_up_questions?.length || 0}`);
        
        // 分析机器人行为
        const botResponse = res.responseData.bot_response.toLowerCase();
        
        if (i === 2) { // 用户说不记得的轮次
            const isStillAsking = botResponse.includes('where') || botResponse.includes('location');
            console.log(`🔍 拒绝处理检查: ${isStillAsking ? '❌ 仍在追问地点' : '✅ 停止追问地点'}`);
            
            if (isStillAsking) {
                console.log('⚠️  系统应该停止询问地点相关问题');
            }
        }
        
        if (i === 3) { // 最后一轮，应该进入下一个话题
            const isAdvancing = res.responseData.question_completed || botResponse.includes('work') || botResponse.includes('job');
            console.log(`🔍 话题推进检查: ${isAdvancing ? '✅ 推进到下一话题' : '❌ 仍停留在教育话题'}`);
        }
        
        console.log('');
    }
    
    // 友善度评估
    console.log('🎯 友善度评估:');
    
    // 最后一轮检查
    const finalReq = new MockRequest({
        message: "I cannot remember",
        sessionId: sessionId,
        step: 5
    });
    const finalRes = new MockResponse();
    
    await handleChatSimple(finalReq, finalRes);
    
    const finalResponse = finalRes.responseData.bot_response.toLowerCase();
    const isStillPushing = finalResponse.includes('clarify') || finalResponse.includes('specific') || 
                         (finalResponse.includes('when') && finalResponse.includes('?'));
    
    console.log(`   - 用户说"不记得"后: ${isStillPushing ? '❌ 仍在追问' : '✅ 不再逼问'}`);
    console.log(`   - 最终回复: "${finalRes.responseData.bot_response}"`);
    
    const isFriendlyNow = !isStillPushing;
    
    if (isFriendlyNow) {
        console.log('\n🎉 友善面试官修复成功！');
        console.log('✅ 系统现在更加理解和友善');
        console.log('✅ 不再过度追问用户不记得的细节');
        console.log('✅ 面试流程更加自然和舒适');
    } else {
        console.log('\n⚠️ 还需要进一步调整');
        console.log('系统在某些情况下仍可能过于坚持');
    }
    
    return isFriendlyNow;
}

// 运行测试
testFriendlyInterviewerFix()
    .then(success => {
        console.log(`\n🏁 友善面试官测试完成 - ${success ? '成功' : '需要改进'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });