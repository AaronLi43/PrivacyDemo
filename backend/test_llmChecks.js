/**
 * 测试LLM检查功能
 * 
 * 运行方式: node test_llmChecks.js
 */

import { 
    checkRelevance, 
    checkCoverage, 
    regenerateFollowup, 
    makeSmartDecision 
} from './llmChecks.js';

// 颜色输出函数
const colors = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`
};

// 测试计数器
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, testFn) {
    testCount++;
    console.log(`\n${colors.blue(`Test ${testCount}: ${name}`)}`);
    
    return testFn()
        .then(result => {
            if (result) {
                console.log(colors.green('✅ PASSED'));
                passCount++;
            } else {
                console.log(colors.red('❌ FAILED'));
                failCount++;
            }
        })
        .catch(error => {
            console.log(colors.red(`❌ FAILED - ${error.message}`));
            failCount++;
        });
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

// 测试数据
const educationAnswers = [
    {
        questionId: 'main_0',
        question: 'Tell me about your educational background',
        answer: 'I studied Computer Science at Stanford University from 2018 to 2022',
        timestamp: new Date().toISOString()
    }
];

const incompleteEducationAnswers = [
    {
        questionId: 'main_0',
        question: 'Tell me about your educational background',
        answer: 'I studied engineering',
        timestamp: new Date().toISOString()
    }
];

const followupExample = {
    id: "Q1_F1",
    prompt: "When did you start your degree and when did you finish?",
    keywords: ["when", "start", "started", "finish", "finished", "graduated", "graduation", "year"]
};

const workQuestion = "I'd love to hear about your current work and how you got into it by job interviews?";

// 开始测试
console.log(colors.blue('=== LLM检查功能测试套件 ===\n'));

// 测试1: 相关性检查 - 充分的答案
test('相关性检查 - 充分的教育背景答案', async () => {
    const result = await checkRelevance(educationAnswers, 
        "Could you tell me about your educational background - what did you study in college or university?");
    
    return assertTrue(result.hasOwnProperty('verdict'), 'Should have verdict property') &&
           assertTrue(['NEXT_MAIN_QUESTION', 'NEED_FOLLOWUPS'].includes(result.verdict), 'Should have valid verdict') &&
           assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning') &&
           assertEqual(result.answersCount, 1, 'Should count answers correctly');
});

// 测试2: 相关性检查 - 不充分的答案
test('相关性检查 - 不充分的教育背景答案', async () => {
    const result = await checkRelevance(incompleteEducationAnswers,
        "Could you tell me about your educational background - what did you study in college or university?");
    
    return assertTrue(result.verdict === 'NEED_FOLLOWUPS', 'Should need follow-ups for incomplete answer') &&
           assertTrue(result.reasoning.length > 0, 'Should have reasoning');
});

// 测试3: 覆盖度检查 - 已覆盖的followup
test('覆盖度检查 - 时间信息已包含在答案中', async () => {
    const result = await checkCoverage(educationAnswers, followupExample);
    
    return assertTrue(result.hasOwnProperty('verdict'), 'Should have verdict property') &&
           assertTrue(['ALREADY_ANSWERED', 'NEEDS_ASKING'].includes(result.verdict), 'Should have valid verdict') &&
           assertEqual(result.followupId, followupExample.id, 'Should track followup ID');
});

// 测试4: 覆盖度检查 - 未覆盖的followup
test('覆盖度检查 - 时间信息未包含在简短答案中', async () => {
    const result = await checkCoverage(incompleteEducationAnswers, followupExample);
    
    return assertTrue(result.verdict === 'NEEDS_ASKING', 'Should need asking for incomplete coverage') &&
           assertTrue(result.reasoning.length > 0, 'Should have reasoning');
});

// 测试5: 动态followup生成
test('动态followup生成 - 基于上下文重新生成问题', async () => {
    const regenerated = await regenerateFollowup(followupExample, educationAnswers);
    
    return assertTrue(typeof regenerated === 'string', 'Should return string') &&
           assertTrue(regenerated.length > 0, 'Should not be empty') &&
           assertTrue(regenerated.includes('?'), 'Should be a question') &&
           assertTrue(regenerated !== followupExample.prompt, 'Should be different from original');
});

// 测试6: 智能决策 - 完整信息
test('智能决策 - 充分信息应该进入下一个问题', async () => {
    const followups = [followupExample];
    const result = await makeSmartDecision(educationAnswers, 
        "Could you tell me about your educational background?", followups);
    
    return assertTrue(result.hasOwnProperty('decision'), 'Should have decision property') &&
           assertTrue(['ADVANCE_TO_NEXT', 'ASK_FOLLOWUPS'].includes(result.decision), 'Should have valid decision') &&
           assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning');
});

// 测试7: 智能决策 - 需要更多信息
test('智能决策 - 不充分信息应该询问followup', async () => {
    const followups = [followupExample];
    const result = await makeSmartDecision(incompleteEducationAnswers, 
        "Could you tell me about your educational background?", followups);
    
    // 根据答案不完整，应该需要更多信息
    return assertTrue(result.decision === 'ASK_FOLLOWUPS' || result.nextFollowups.length > 0, 
                     'Should ask follow-ups for incomplete answers');
});

// 测试8: 错误处理 - API失败时的降级
test('错误处理 - API失败时应该使用降级策略', async () => {
    // 测试空答案列表的情况
    const result = await checkRelevance([], "Test question");
    
    return assertTrue(result.hasOwnProperty('verdict'), 'Should still return verdict even with empty answers') &&
           assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning');
});

// 测试9: 批量处理效率
test('批量处理 - 多个followup检查', async () => {
    const multipleFollowups = [
        followupExample,
        {
            id: "Q1_F2",
            prompt: "Where is your university located?",
            keywords: ["where", "location", "university", "college"]
        }
    ];
    
    const startTime = Date.now();
    
    // 并行处理多个检查
    const promises = multipleFollowups.map(followup => 
        checkCoverage(educationAnswers, followup)
    );
    const results = await Promise.all(promises);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    return assertEqual(results.length, 2, 'Should process all followups') &&
           assertTrue(duration < 5000, 'Should complete in reasonable time') &&
           assertTrue(results.every(r => r.hasOwnProperty('verdict')), 'All results should have verdicts');
});

// 测试10: 模拟模式验证
test('模拟模式 - 当没有API密钥时应该正常工作', async () => {
    // 这个测试验证模拟模式是否正常工作
    const result = await checkRelevance(educationAnswers, 
        "Test question about education and degree");
    
    return assertTrue(result.hasOwnProperty('verdict'), 'Should work in simulation mode') &&
           assertTrue(result.verdict.length > 0, 'Should return valid verdict');
});

// 运行所有测试
async function runAllTests() {
    console.log(colors.yellow('开始运行LLM检查功能测试...'));
    
    await test('相关性检查 - 充分的教育背景答案', async () => {
        const result = await checkRelevance(educationAnswers, 
            "Could you tell me about your educational background - what did you study in college or university?");
        
        return assertTrue(result.hasOwnProperty('verdict'), 'Should have verdict property') &&
               assertTrue(['NEXT_MAIN_QUESTION', 'NEED_FOLLOWUPS'].includes(result.verdict), 'Should have valid verdict') &&
               assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning') &&
               assertEqual(result.answersCount, 1, 'Should count answers correctly');
    });

    await test('相关性检查 - 不充分的教育背景答案', async () => {
        const result = await checkRelevance(incompleteEducationAnswers,
            "Could you tell me about your educational background - what did you study in college or university?");
        
        return assertTrue(result.verdict === 'NEED_FOLLOWUPS', 'Should need follow-ups for incomplete answer') &&
               assertTrue(result.reasoning.length > 0, 'Should have reasoning');
    });

    await test('覆盖度检查 - 时间信息已包含', async () => {
        const result = await checkCoverage(educationAnswers, followupExample);
        
        return assertTrue(result.hasOwnProperty('verdict'), 'Should have verdict property') &&
               assertTrue(['ALREADY_ANSWERED', 'NEEDS_ASKING'].includes(result.verdict), 'Should have valid verdict') &&
               assertEqual(result.followupId, followupExample.id, 'Should track followup ID');
    });

    await test('覆盖度检查 - 时间信息未包含', async () => {
        const result = await checkCoverage(incompleteEducationAnswers, followupExample);
        
        return assertTrue(result.verdict === 'NEEDS_ASKING', 'Should need asking for incomplete coverage') &&
               assertTrue(result.reasoning.length > 0, 'Should have reasoning');
    });

    await test('动态followup生成', async () => {
        const regenerated = await regenerateFollowup(followupExample, educationAnswers);
        
        return assertTrue(typeof regenerated === 'string', 'Should return string') &&
               assertTrue(regenerated.length > 0, 'Should not be empty') &&
               assertTrue(regenerated.includes('?'), 'Should be a question');
    });

    await test('智能决策 - 充分信息', async () => {
        const followups = [followupExample];
        const result = await makeSmartDecision(educationAnswers, 
            "Could you tell me about your educational background?", followups);
        
        return assertTrue(result.hasOwnProperty('decision'), 'Should have decision property') &&
               assertTrue(['ADVANCE_TO_NEXT', 'ASK_FOLLOWUPS'].includes(result.decision), 'Should have valid decision') &&
               assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning');
    });

    await test('智能决策 - 不充分信息', async () => {
        const followups = [followupExample];
        const result = await makeSmartDecision(incompleteEducationAnswers, 
            "Could you tell me about your educational background?", followups);
        
        return assertTrue(result.hasOwnProperty('decision'), 'Should have decision property') &&
               assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning');
    });

    await test('错误处理测试', async () => {
        const result = await checkRelevance([], "Test question");
        
        return assertTrue(result.hasOwnProperty('verdict'), 'Should handle empty answers') &&
               assertTrue(result.hasOwnProperty('reasoning'), 'Should have reasoning');
    });

    // 输出测试结果
    console.log('\n' + colors.blue('=== 测试结果 ==='));
    console.log(`总测试数: ${testCount}`);
    console.log(`通过: ${colors.green(passCount)}`);
    console.log(`失败: ${colors.red(failCount)}`);

    if (failCount === 0) {
        console.log(colors.green('\n🎉 所有LLM检查功能测试通过!'));
    } else {
        console.log(colors.red(`\n⚠️  有 ${failCount} 个测试失败，需要检查`));
    }

    // 实际使用示例
    console.log('\n' + colors.blue('=== 实际使用示例 ==='));

    console.log('\n1. 相关性检查示例:');
    const relevanceDemo = await checkRelevance(educationAnswers, 
        "Tell me about your educational background");
    console.log(`   决策: ${relevanceDemo.verdict}`);
    console.log(`   推理: ${relevanceDemo.reasoning}`);

    console.log('\n2. 覆盖度检查示例:');
    const coverageDemo = await checkCoverage(educationAnswers, followupExample);
    console.log(`   决策: ${coverageDemo.verdict}`);
    console.log(`   推理: ${coverageDemo.reasoning}`);

    console.log('\n3. 智能followup生成示例:');
    const regeneratedDemo = await regenerateFollowup(followupExample, educationAnswers);
    console.log(`   原始: ${followupExample.prompt}`);
    console.log(`   生成: ${regeneratedDemo}`);

    console.log(colors.green('\n✅ LLM功能演示完成'));
}

// 运行测试
runAllTests().catch(error => {
    console.error(colors.red('测试运行失败:'), error);
    process.exit(1);
});