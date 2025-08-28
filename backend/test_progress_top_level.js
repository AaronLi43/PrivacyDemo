/**
 * 测试顶层进度信息
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

async function testProgressTopLevel() {
    console.log('🧪 测试顶层进度信息\n');
    
    const sessionId = 'top-level-progress-' + Date.now();
    
    // 步骤1: 跳过一个主问题，检查顶层进度信息
    console.log('--- 步骤 1: 跳过主问题，检查顶层进度 ---');
    const req1 = new MockRequest({
        message: "No, I never used AI for interviews",
        sessionId: sessionId,
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    
    console.log('📊 响应中的进度信息:');
    console.log(`   顶层 progress_percentage: ${res1.responseData.progress_percentage}`);
    console.log(`   顶层 completed_questions: ${res1.responseData.completed_questions}`);
    console.log(`   顶层 total_questions: ${res1.responseData.total_questions}`);
    console.log(`   顶层 current_question_index: ${res1.responseData.current_question_index}`);
    
    console.log('\n   orchestrator_state 中的进度:');
    console.log(`   orchestrator_state.progressPercentage: ${res1.responseData.orchestrator_state?.progressPercentage}`);
    console.log(`   orchestrator_state.completedQuestions: ${res1.responseData.orchestrator_state?.completedQuestions}`);
    
    // 检查顶层是否有进度信息
    const hasTopLevelProgress = 
        typeof res1.responseData.progress_percentage === 'number' &&
        typeof res1.responseData.completed_questions === 'number' &&
        typeof res1.responseData.total_questions === 'number';
    
    console.log(`\n✅ 顶层进度信息存在: ${hasTopLevelProgress ? '是' : '否'}`);
    
    // 步骤2: 再跳过几个问题直到完成，检查最终进度
    console.log('\n--- 步骤 2-6: 快速跳过所有剩余问题 ---');
    const skipAnswers = [
        "I haven't done job interviews recently",
        "Never used AI for that purpose", 
        "No, I don't have experience with that",
        "I haven't used AI for interviews",
        "No experience with AI in job interviews"
    ];
    
    let lastResponse = res1.responseData;
    for (let i = 0; i < skipAnswers.length; i++) {
        const req = new MockRequest({
            message: skipAnswers[i],
            sessionId: sessionId,
            step: 2 + i
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        lastResponse = res.responseData;
        
        console.log(`   步骤 ${2 + i}: 进度 ${lastResponse.progress_percentage}%, 完成 ${lastResponse.completed_questions}/${lastResponse.total_questions}`);
    }
    
    // 检查最终状态
    console.log('\n📊 最终状态检查:');
    console.log(`   最终进度: ${lastResponse.progress_percentage}%`);
    console.log(`   面试完成: ${lastResponse.interview_finished}`);
    console.log(`   顶层进度一致: ${lastResponse.progress_percentage === lastResponse.orchestrator_state?.progressPercentage ? '是' : '否'}`);
    
    const allCorrect = hasTopLevelProgress && 
                      lastResponse.progress_percentage === 100 && 
                      lastResponse.interview_finished;
    
    console.log(`\n🎯 顶层进度信息测试: ${allCorrect ? '✅ 全部正确' : '❌ 有问题'}`);
    
    if (allCorrect) {
        console.log('🎉 进度信息现在在响应顶层可用！');
        console.log('前端应该能够立即看到进度更新。');
    } else {
        console.log('⚠️ 仍存在问题:');
        if (!hasTopLevelProgress) console.log('   - 顶层缺少进度信息');
        if (lastResponse.progress_percentage !== 100) console.log('   - 最终进度不是100%');
        if (!lastResponse.interview_finished) console.log('   - 面试未正确完成');
    }
    
    return allCorrect;
}

testProgressTopLevel()
    .then(success => {
        console.log(`\n🏁 顶层进度信息测试完成 - ${success ? '通过' : '需要修复'}`);
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('测试失败:', error);
        process.exit(1);
    });