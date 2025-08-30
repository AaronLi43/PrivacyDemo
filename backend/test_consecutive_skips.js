/**
 * 测试连续跳过多个主问题的情况
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

async function testConsecutiveSkips() {
    console.log('🧪 测试连续跳过多个主问题\n');
    
    const sessionId = 'consecutive-skip-' + Date.now();
    
    // 用于跳过的无经验回答
    const noExperienceAnswers = [
        "No, I never used AI for interviews",
        "I haven't done job interviews recently",
        "Never used AI for that purpose", 
        "No, I don't have experience with that",
        "I haven't used AI for interviews",
        "No experience with AI in job interviews"
    ];
    
    console.log('📋 测试场景: 连续对所有6个主问题都表示无经验');
    console.log('预期: 应该依次跳过每个主问题，最终完成面试\n');
    
    let currentStep = 1;
    let lastResponse = null;
    
    // 连续跳过所有主问题
    for (let i = 0; i < 6; i++) {
        const answer = noExperienceAnswers[i];
        console.log(`--- 步骤 ${currentStep}: 回答第${i + 1}个主问题 ---`);
        console.log(`用户回答: "${answer}"`);
        
        const req = new MockRequest({
            message: answer,
            sessionId: sessionId,
            step: currentStep
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        lastResponse = res.responseData;
        
        console.log(`机器人回复: "${lastResponse.bot_response}"`);
        console.log(`问题完成: ${lastResponse.question_completed}`);
        console.log(`面试完成: ${lastResponse.interview_finished}`);
        console.log(`允许动作: [${lastResponse.allowed_actions.join(', ')}]`);
        
        // 检查是否提前结束
        if (lastResponse.interview_finished) {
            console.log(`🚨 面试在第${i + 1}个主问题后提前结束！`);
            break;
        }
        
        // 检查是否正确跳到下一个主问题
        if (i < 5) { // 不是最后一个问题
            const hasNextQuestion = lastResponse.bot_response.length > 50 && 
                                   lastResponse.question_completed &&
                                   !lastResponse.interview_finished;
            
            if (!hasNextQuestion) {
                console.log(`⚠️ 第${i + 1}个问题跳过后没有正确显示下一个问题`);
            } else {
                console.log(`✅ 成功跳过第${i + 1}个问题，显示第${i + 2}个问题`);
            }
        }
        
        currentStep++;
        console.log('');
    }
    
    // 分析最终状态
    console.log('🎯 最终状态分析:');
    console.log(`   - 面试完成: ${lastResponse.interview_finished ? '是' : '否'}`);
    console.log(`   - 允许动作: [${lastResponse.allowed_actions.join(', ')}]`);
    console.log(`   - 最终回复: "${lastResponse.bot_response}"`);
    
    // 检查是否正确完成了所有6个主问题的跳过
    const correctlyFinished = lastResponse.interview_finished && 
                             lastResponse.allowed_actions.includes('POST_TASK_SURVEY');
    
    console.log(`\n🎯 连续跳过测试结果: ${correctlyFinished ? '✅ 正确' : '❌ 有问题'}`);
    
    if (correctlyFinished) {
        console.log('🎉 连续跳过逻辑正确！');
        console.log('✅ 能够连续跳过所有主问题');
        console.log('✅ 最终正确完成面试并路由到调查');
    } else {
        console.log('⚠️ 连续跳过逻辑需要检查：');
        if (!lastResponse.interview_finished) {
            console.log('   - 面试没有正确完成');
        }
        if (!lastResponse.allowed_actions.includes('POST_TASK_SURVEY')) {
            console.log('   - 没有正确路由到调查');
        }
    }
    
    return correctlyFinished;
}

testConsecutiveSkips()
    .then(success => {
        console.log(`\n🏁 连续跳过测试完成 - ${success ? '通过' : '需要修复'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });