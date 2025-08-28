/**
 * Chat处理器集成测试
 * 
 * 测试新的简化orchestrator与/api/chat接口的集成
 * 运行方式: node test_chatIntegration.js
 */

import { handleChatSimple, getSessionStats } from './chatHandlerSimple.js';

// 颜色输出函数
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// 模拟Express请求和响应对象
class MockRequest {
    constructor(body) {
        this.body = body;
    }
}

class MockResponse {
    constructor() {
        this.statusCode = 200;
        this.responseData = null;
        this.headers = {};
    }
    
    status(code) {
        this.statusCode = code;
        return this;
    }
    
    json(data) {
        this.responseData = data;
        return this;
    }
    
    header(name, value) {
        this.headers[name] = value;
        return this;
    }
}

// 测试计数器
let testCount = 0;
let passCount = 0;
let failCount = 0;

async function test(name, testFn) {
    testCount++;
    console.log(`\n${colors.blue(`Test ${testCount}: ${name}`)}`);
    
    try {
        const result = await testFn();
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

function assertTrue(condition, message = '') {
    if (condition) {
        return true;
    }
    console.log(`Expected true, got false. ${message}`);
    return false;
}

function assertEqual(actual, expected, message = '') {
    if (actual === expected) {
        return true;
    }
    console.log(`Expected: ${expected}, Got: ${actual}. ${message}`);
    return false;
}

// 开始测试
console.log(colors.blue('=== Chat处理器集成测试 ===\n'));

// 测试1: START_QUESTION_MODE 处理
test('START_QUESTION_MODE 初始化处理', async () => {
    const req = new MockRequest({
        message: "__START__",
        action: "START_QUESTION_MODE",
        sessionId: "test-start-123"
    });
    const res = new MockResponse();
    
    await handleChatSimple(req, res);
    
    return assertEqual(res.statusCode, 200, 'Should return 200') &&
           assertTrue(res.responseData.success, 'Should be successful') &&
           assertTrue(res.responseData.bot_response.includes('Welcome'), 'Should include welcome message') &&
           assertTrue(res.responseData.bot_response.includes('educational background'), 'Should include first question') &&
           assertEqual(res.responseData.question_completed, false, 'First question should not be completed') &&
           assertEqual(res.responseData.interview_finished, false, 'Interview should not be finished');
});

// 测试2: 正常用户回答处理
test('正常用户回答处理', async () => {
    const sessionId = "test-answer-456";
    
    // 第一步：用户回答
    const req = new MockRequest({
        message: "I studied Computer Science at MIT from 2018 to 2022. I graduated with honors and focused on AI.",
        sessionId: sessionId,
        step: 1
    });
    const res = new MockResponse();
    
    await handleChatSimple(req, res);
    
    return assertEqual(res.statusCode, 200, 'Should return 200') &&
           assertTrue(res.responseData.success, 'Should be successful') &&
           assertTrue(res.responseData.bot_response.length > 0, 'Should have bot response') &&
           assertTrue(Array.isArray(res.responseData.conversation_history), 'Should have conversation history') &&
           assertTrue(res.responseData.conversation_history.length >= 1, 'Should have conversation entries') &&
           assertEqual(res.responseData.session_id, sessionId, 'Should maintain session ID');
});

// 测试3: 空消息处理
test('空消息错误处理', async () => {
    const req = new MockRequest({
        message: "",
        sessionId: "test-empty-789"
    });
    const res = new MockResponse();
    
    await handleChatSimple(req, res);
    
    return assertEqual(res.statusCode, 400, 'Should return 400 for empty message') &&
           assertTrue(res.responseData.error, 'Should have error message') &&
           assertTrue(res.responseData.error.includes('Message is required'), 'Should specify message requirement');
});

// 测试4: 会话持久性测试
test('会话持久性和状态管理', async () => {
    const sessionId = "test-persistence-101";
    
    // 第一个请求
    const req1 = new MockRequest({
        message: "I studied Engineering at Stanford.",
        sessionId: sessionId,
        step: 1
    });
    const res1 = new MockResponse();
    
    await handleChatSimple(req1, res1);
    
    // 第二个请求（同一会话）
    const req2 = new MockRequest({
        message: "I started in 2019 and graduated in 2023.",
        sessionId: sessionId,
        step: 2
    });
    const res2 = new MockResponse();
    
    await handleChatSimple(req2, res2);
    
    return assertTrue(res1.responseData.success, 'First request should succeed') &&
           assertTrue(res2.responseData.success, 'Second request should succeed') &&
           assertEqual(res1.responseData.session_id, sessionId, 'Should maintain session ID in first response') &&
           assertEqual(res2.responseData.session_id, sessionId, 'Should maintain session ID in second response') &&
           assertTrue(res2.responseData.conversation_history.length >= 2, 'Should accumulate conversation history');
});

// 测试5: API响应格式兼容性
test('API响应格式兼容性验证', async () => {
    const req = new MockRequest({
        message: "Test message for format validation",
        sessionId: "test-format-202"
    });
    const res = new MockResponse();
    
    await handleChatSimple(req, res);
    
    const response = res.responseData;
    
    // 验证所有必需的字段存在
    const requiredFields = [
        'success', 'bot_response', 'conversation_history', 'step',
        'privacy_detection', 'question_completed', 'audit_result',
        'orchestrator_tags', 'no_answer_cause', 'followup_coverage',
        'next_followup', 'pending_followup_exists', 'followup_polish_meta',
        'follow_up_questions', 'question_presence_audit', 'interview_finished',
        'allowed_actions', 'session_id', 'timings_ms'
    ];
    
    let allFieldsPresent = true;
    const missingFields = [];
    
    for (const field of requiredFields) {
        if (!response.hasOwnProperty(field)) {
            allFieldsPresent = false;
            missingFields.push(field);
        }
    }
    
    if (!allFieldsPresent) {
        console.log(`Missing fields: ${missingFields.join(', ')}`);
    }
    
    return assertTrue(allFieldsPresent, 'All required API fields should be present') &&
           assertTrue(typeof response.success === 'boolean', 'success should be boolean') &&
           assertTrue(typeof response.bot_response === 'string', 'bot_response should be string') &&
           assertTrue(Array.isArray(response.conversation_history), 'conversation_history should be array') &&
           assertTrue(Array.isArray(response.allowed_actions), 'allowed_actions should be array') &&
           assertTrue(response.timings_ms && typeof response.timings_ms.total === 'number', 'timings_ms should have total');
});

// 测试6: 错误处理和恢复
test('错误处理和恢复机制', async () => {
    // 测试无效的JSON输入
    const req = new MockRequest({
        message: "Valid message",
        sessionId: null, // 这应该触发会话ID生成
        step: "invalid" // 无效的步骤值
    });
    const res = new MockResponse();
    
    await handleChatSimple(req, res);
    
    // 应该仍然成功处理（因为有降级策略）
    return assertTrue(res.responseData.success !== undefined, 'Should handle invalid input gracefully') &&
           assertTrue(res.responseData.session_id && res.responseData.session_id.length > 0, 'Should generate session ID when needed');
});

// 测试7: 会话统计功能
test('会话统计功能', async () => {
    // 创建一些会话
    const sessions = ['stats-1', 'stats-2', 'stats-3'];
    
    for (const sessionId of sessions) {
        const req = new MockRequest({
            message: "Test message for stats",
            sessionId: sessionId
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
    }
    
    // 获取统计信息
    const stats = getSessionStats();
    
    return assertTrue(stats.totalSessions >= 3, 'Should have at least 3 total sessions') &&
           assertTrue(stats.activeSessions >= 0, 'Should have valid active session count') &&
           assertTrue(stats.hasOwnProperty('sessionsbyMode'), 'Should have session mode breakdown') &&
           assertTrue(typeof stats.totalSessions === 'number', 'Total sessions should be a number');
});

// 测试8: 智能决策集成测试
test('智能决策集成测试', async () => {
    const sessionId = "test-decision-303";
    
    // 提供一个相对完整的回答
    const req = new MockRequest({
        message: "I studied Computer Science at Stanford University from 2018 to 2022. I graduated magna cum laude and specialized in machine learning. My thesis advisor was Dr. Sarah Chen who taught me advanced neural network architectures.",
        sessionId: sessionId
    });
    const res = new MockResponse();
    
    await handleChatSimple(req, res);
    
    return assertTrue(res.responseData.success, 'Should process comprehensive answer successfully') &&
           assertTrue(res.responseData.audit_result !== null, 'Should have audit result') &&
           assertTrue(res.responseData.audit_result.hasOwnProperty('verdict'), 'Audit result should have verdict') &&
           assertTrue(['ALLOW_NEXT_QUESTION', 'REQUIRE_MORE'].includes(res.responseData.audit_result.verdict), 'Should have valid audit verdict');
});

// 测试9: 面试完成处理
test('面试完成处理', async () => {
    const sessionId = "test-completion-404";
    
    // 模拟一个接近完成的会话（手动设置状态）
    // 这需要多次交互来达到完成状态
    let currentStep = 1;
    let lastResponse;
    
    // 模拟多轮对话直到完成
    const responses = [
        "I studied Computer Science at MIT, graduated in 2022.",
        "I work as a Software Engineer at Google, got the job through campus recruiting in 2022.",
        "I used ChatGPT to help me prepare for technical interviews and write better answers.",
        "No, I was never nervous about using AI tools.",
        "I never questioned whether it was appropriate.",
        "I don't hide my AI usage from anyone."
    ];
    
    for (const message of responses) {
        const req = new MockRequest({
            message: message,
            sessionId: sessionId,
            step: currentStep++
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        lastResponse = res.responseData;
        
        if (lastResponse.interview_finished) {
            break;
        }
    }
    
    // 检查最终状态
    return assertTrue(lastResponse !== undefined, 'Should have received responses') &&
           assertTrue(typeof lastResponse.interview_finished === 'boolean', 'Should have interview_finished flag');
});

// 运行所有测试
async function runAllTests() {
    console.log(colors.yellow('开始运行Chat处理器集成测试...\n'));
    
    await test('START_QUESTION_MODE 初始化处理', async () => {
        const req = new MockRequest({
            message: "__START__",
            action: "START_QUESTION_MODE",
            sessionId: "test-start-123"
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        
        return assertEqual(res.statusCode, 200, 'Should return 200') &&
               assertTrue(res.responseData.success, 'Should be successful') &&
               assertTrue(res.responseData.bot_response.includes('Welcome'), 'Should include welcome message') &&
               assertTrue(res.responseData.bot_response.includes('educational background'), 'Should include first question');
    });
    
    await test('正常用户回答处理', async () => {
        const sessionId = "test-answer-456";
        
        const req = new MockRequest({
            message: "I studied Computer Science at MIT from 2018 to 2022.",
            sessionId: sessionId,
            step: 1
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        
        return assertEqual(res.statusCode, 200, 'Should return 200') &&
               assertTrue(res.responseData.success, 'Should be successful') &&
               assertTrue(res.responseData.bot_response.length > 0, 'Should have bot response');
    });
    
    await test('空消息错误处理', async () => {
        const req = new MockRequest({
            message: "",
            sessionId: "test-empty-789"
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        
        return assertEqual(res.statusCode, 400, 'Should return 400 for empty message') &&
               assertTrue(res.responseData.error, 'Should have error message');
    });
    
    await test('API响应格式兼容性验证', async () => {
        const req = new MockRequest({
            message: "Test message for format validation",
            sessionId: "test-format-202"
        });
        const res = new MockResponse();
        
        await handleChatSimple(req, res);
        
        const response = res.responseData;
        const requiredFields = ['success', 'bot_response', 'conversation_history', 'session_id'];
        
        return requiredFields.every(field => response.hasOwnProperty(field));
    });
    
    await test('会话统计功能', async () => {
        const stats = getSessionStats();
        return typeof stats === 'object' && 
               typeof stats.totalSessions === 'number' &&
               stats.hasOwnProperty('sessionsbyMode');
    });
    
    // 输出测试结果
    console.log('\n' + colors.blue('=== 集成测试结果 ==='));
    console.log(`总测试数: ${testCount}`);
    console.log(`通过: ${colors.green(passCount)}`);
    console.log(`失败: ${colors.red(failCount)}`);
    
    if (failCount === 0) {
        console.log(colors.green('\n🎉 所有Chat集成测试通过！'));
        console.log(colors.green('✅ 简化orchestrator与API接口集成成功'));
        console.log(colors.green('✅ 响应格式与前端兼容'));
        console.log(colors.green('✅ 错误处理机制正常'));
        console.log(colors.green('✅ 智能决策功能集成正常'));
    } else {
        console.log(colors.red(`\n⚠️  有 ${failCount} 个测试失败，需要修复`));
    }
    
    // 性能演示
    console.log('\n' + colors.blue('=== 性能演示 ==='));
    const startTime = Date.now();
    
    const perfReq = new MockRequest({
        message: "Performance test message",
        sessionId: "perf-test"
    });
    const perfRes = new MockResponse();
    
    await handleChatSimple(perfReq, perfRes);
    
    const duration = Date.now() - startTime;
    console.log(`单次API调用耗时: ${duration}ms`);
    console.log(`响应数据大小: ${JSON.stringify(perfRes.responseData).length} 字符`);
    
    if (perfRes.responseData.timings_ms) {
        console.log(`服务器内部耗时: ${perfRes.responseData.timings_ms.total}ms`);
    }
    
    console.log(colors.green('\n✅ 集成测试完成'));
    
    return failCount === 0;
}

// 运行测试
runAllTests()
    .then(success => {
        if (!success) {
            process.exit(1);
        }
    })
    .catch(error => {
        console.error(colors.red('集成测试失败:'), error);
        process.exit(1);
    });