/**
 * LLM智能检查模块
 * 
 * 功能：
 * 1. 相关性检查 - 判断是否可以进入下一个主问题
 * 2. 覆盖度检查 - 判断followup是否已被现有答案覆盖
 * 3. 动态followup生成 - 基于上下文重新生成自然的followup
 */

import OpenAI from 'openai';

// 使用与server.js相同的OpenAI客户端
let openaiClient;
try {
    if (process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    } else {
        console.warn('⚠️ OPENAI_API_KEY not found, LLM checks will be simulated');
    }
} catch (error) {
    console.error('❌ Failed to initialize OpenAI for LLM checks:', error);
}

/**
 * 调用OpenAI API的通用函数
 * @param {string} systemPrompt - 系统提示
 * @param {string} userPrompt - 用户提示
 * @param {Object} options - 选项
 * @returns {Promise<string>} LLM响应
 */
async function callLLM(systemPrompt, userPrompt, options = {}) {
    if (!openaiClient) {
        // 模拟模式 - 用于测试和开发
        console.log('🔄 LLM Check (Simulated):', userPrompt.substring(0, 100) + '...');
        return simulateLLMResponse(userPrompt, options);
    }
    
    try {
        const response = await openaiClient.chat.completions.create({
            model: options.model || "gpt-4o-mini",
            temperature: options.temperature || 0.0,
            max_tokens: options.maxTokens || 200,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ]
        });
        
        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('❌ LLM API call failed:', error);
        // 降级到模拟模式
        return simulateLLMResponse(userPrompt, options);
    }
}

/**
 * 模拟LLM响应（用于测试和API失败时的降级）
 * @param {string} prompt - 提示内容
 * @param {Object} options - 选项
 * @returns {string} 模拟响应
 */
function simulateLLMResponse(prompt, options = {}) {
    // 基于关键词的简单模拟逻辑，更加宽松和友善
    const lowerPrompt = prompt.toLowerCase();
    
    if (options.checkType === 'relevance') {
        // 检查用户是否表示拒绝或不记得
        if (lowerPrompt.includes('cannot remember') || lowerPrompt.includes('dont remember') || 
            lowerPrompt.includes("don't remember") || lowerPrompt.includes('not sure') ||
            lowerPrompt.includes('forget') || lowerPrompt.includes('no idea')) {
            return 'NEXT_MAIN_QUESTION'; // 用户不记得，不要继续追问
        }
        
        // 平衡的相关性判断：需要更多细节但不过度追问
        if (lowerPrompt.includes('education') || lowerPrompt.includes('study') || lowerPrompt.includes('degree') || lowerPrompt.includes('university') || lowerPrompt.includes('college')) {
            // 教育话题：如果回答很详细（包含多个要素）则足够，否则需要followup
            const hasTimeInfo = /20\d{2}|year|semester|started|graduated|finish/i.test(lowerPrompt);
            const hasLocationInfo = /ucla|stanford|mit|harvard|at\s+\w+|university of/i.test(lowerPrompt);
            const hasPeopleInfo = /professor|dr\.|teacher|mentor|advisor|supervisor/i.test(lowerPrompt);
            const detailCount = [hasTimeInfo, hasLocationInfo, hasPeopleInfo].filter(Boolean).length;
            
            return detailCount >= 2 ? 'NEXT_MAIN_QUESTION' : 'NEED_FOLLOWUPS';
        } else if (lowerPrompt.includes('work') || lowerPrompt.includes('job') || lowerPrompt.includes('interview') || lowerPrompt.includes('position')) {
            // 工作话题：需要职位和时间信息
            const hasJobTitle = /engineer|analyst|manager|developer|assistant|student|intern/i.test(lowerPrompt);
            const hasTimeInfo = /20\d{2}|month|year|ago|recent|start|began|since/i.test(lowerPrompt);
            
            return hasJobTitle && hasTimeInfo ? 'NEXT_MAIN_QUESTION' : 'NEED_FOLLOWUPS';
        } else if (lowerPrompt.includes('ai') || lowerPrompt.includes('chatgpt') || lowerPrompt.includes('tool')) {
            // AI使用话题：通常需要更多具体细节
            return 'NEED_FOLLOWUPS';
        }
        
        // 对于其他情况，如果有实质内容但不够详细，需要followup
        return lowerPrompt.length > 20 ? 'NEED_FOLLOWUPS' : 'NEED_FOLLOWUPS';
    }
    
    if (options.checkType === 'coverage') {
        // 检查用户是否表示拒绝或不记得
        if (lowerPrompt.includes('cannot remember') || lowerPrompt.includes('dont remember') || 
            lowerPrompt.includes("don't remember") || lowerPrompt.includes('not sure') ||
            lowerPrompt.includes('forget') || lowerPrompt.includes('no idea')) {
            return 'ALREADY_ANSWERED'; // 用户不记得，标记为已回答，不再追问
        }
        
        // 更宽松的覆盖度检查
        if (lowerPrompt.includes('when') && (lowerPrompt.includes('start') || lowerPrompt.includes('finish'))) {
            // 只要提到任何年份、月份或时间词汇就认为已回答
            return /20\d{2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|last|this|month|year|recently/i.test(lowerPrompt) ? 'ALREADY_ANSWERED' : 'NEEDS_ASKING';
        } else if (lowerPrompt.includes('where') && (lowerPrompt.includes('location') || lowerPrompt.includes('located'))) {
            // 地点问题需要明确的地理位置词汇，不只是大学名称
            return /in\s+\w+|city|state|province|country|located\s+in|california|new york|boston|los angeles|texas|florida|illinois/i.test(lowerPrompt) ? 'ALREADY_ANSWERED' : 'NEEDS_ASKING';
        } else if (lowerPrompt.includes('who') && lowerPrompt.includes('professor')) {
            // 只要提到任何人名或称谓就认为已回答
            return /professor|dr\.|teacher|mentor|advisor|supervisor|chen|johnson|smith|wang|li/i.test(lowerPrompt) ? 'ALREADY_ANSWERED' : 'NEEDS_ASKING';
        }
        
        // 默认更宽松：如果回答有实质内容就认为已回答
        return lowerPrompt.length > 5 ? 'ALREADY_ANSWERED' : 'NEEDS_ASKING';
    }
    
    if (options.checkType === 'regenerate') {
        // 动态重新生成模拟
        return `Based on what you shared about your background, ${prompt.toLowerCase().replace(/^.*?prompt:\s*"/i, '').replace(/".*$/, '')}`;
    }
    
    return 'CONTINUE';
}

/**
 * 相关性检查 - 判断是否应该进入下一个主问题
 * @param {Array} answers - 当前问题的所有回答
 * @param {string} mainQuestion - 主问题
 * @returns {Promise<Object>} 检查结果
 */
export async function checkRelevance(answers, mainQuestion) {
    const systemPrompt = `You are a concise interview evaluator. 
Your task is to determine if the user has provided sufficient information to answer the main question.

Rules:
- If the user's answers adequately address the main question with reasonable detail, return "NEXT_MAIN_QUESTION"
- If more information is needed or the answers are too brief/vague, return "NEED_FOLLOWUPS"
- Focus on completeness and relevance, not perfection

Return only: "NEXT_MAIN_QUESTION" or "NEED_FOLLOWUPS"`;

    const userPrompt = `Main Question: "${mainQuestion}"

User's Answers:
${answers.map((ans, idx) => `${idx + 1}. Q: ${ans.question}\n   A: ${ans.answer}`).join('\n\n')}

Assessment:`;

    try {
        const response = await callLLM(systemPrompt, userPrompt, { 
            checkType: 'relevance',
            maxTokens: 50 
        });
        
        const verdict = response.includes('NEXT_MAIN_QUESTION') ? 'NEXT_MAIN_QUESTION' : 'NEED_FOLLOWUPS';
        
        return {
            verdict: verdict,
            reasoning: response,
            answersCount: answers.length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Relevance check failed:', error);
        // 降级策略：如果有多个回答，认为足够了
        return {
            verdict: answers.length >= 2 ? 'NEXT_MAIN_QUESTION' : 'NEED_FOLLOWUPS',
            reasoning: 'Fallback logic: Multiple answers provided',
            answersCount: answers.length,
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
}

/**
 * 覆盖度检查 - 判断followup是否已被现有答案覆盖
 * @param {Array} answers - 现有答案
 * @param {Object} followup - followup问题对象
 * @returns {Promise<Object>} 检查结果
 */
export async function checkCoverage(answers, followup) {
    const systemPrompt = `You are a precise coverage analyzer.
Your task is to determine if a follow-up question has already been answered in the user's previous responses.

Rules:
- Check if the follow-up question's specific information is already present in the answers
- Use the provided keywords as hints for what to look for
- Return "ALREADY_ANSWERED" only if the information is clearly present
- Return "NEEDS_ASKING" if the information is missing or unclear
- Be strict - partial coverage still means "NEEDS_ASKING"

Return only: "ALREADY_ANSWERED" or "NEEDS_ASKING"`;

    const userPrompt = `Follow-up Question: "${followup.prompt}"
Keywords to check for: ${followup.keywords ? followup.keywords.slice(0, 10).join(', ') : 'none'}

Existing Answers:
${answers.map((ans, idx) => `${idx + 1}. ${ans.answer}`).join('\n\n')}

Coverage assessment:`;

    try {
        const response = await callLLM(systemPrompt, userPrompt, { 
            checkType: 'coverage',
            maxTokens: 50 
        });
        
        const verdict = response.includes('ALREADY_ANSWERED') ? 'ALREADY_ANSWERED' : 'NEEDS_ASKING';
        
        return {
            verdict: verdict,
            reasoning: response,
            followupId: followup.id,
            keywordsChecked: followup.keywords ? followup.keywords.length : 0,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ Coverage check failed:', error);
        // 降级策略：检查关键词在答案中的出现频率
        const answersText = answers.map(a => a.answer.toLowerCase()).join(' ');
        const keywordMatches = followup.keywords ? 
            followup.keywords.filter(keyword => answersText.includes(keyword.toLowerCase())).length : 0;
        const coverageRatio = followup.keywords ? keywordMatches / followup.keywords.length : 0;
        
        return {
            verdict: coverageRatio > 0.3 ? 'ALREADY_ANSWERED' : 'NEEDS_ASKING',
            reasoning: `Fallback: ${keywordMatches}/${followup.keywords?.length || 0} keywords matched`,
            followupId: followup.id,
            keywordsChecked: followup.keywords ? followup.keywords.length : 0,
            timestamp: new Date().toISOString(),
            error: error.message
        };
    }
}

/**
 * 动态followup生成 - 基于已有答案重新生成更自然的followup
 * @param {Object} followup - 原始followup对象
 * @param {Array} existingAnswers - 已有答案
 * @returns {Promise<string>} 重新生成的followup问题
 */
export async function regenerateFollowup(followup, existingAnswers) {
    const systemPrompt = `You are a skilled interviewer who asks natural follow-up questions.
Your task is to rephrase a follow-up question to make it more conversational and contextually aware.

Rules:
- Acknowledge what the user has already shared
- Make the question feel natural and connected to their previous answers
- Keep the core intent of the original question
- Use a conversational, friendly tone
- End with a question mark
- Keep it concise (1-2 sentences max)`;

    const userPrompt = `Original follow-up: "${followup.prompt}"

Context from user's previous answers:
${existingAnswers.slice(-3).map((ans, idx) => `${idx + 1}. ${ans.answer}`).join('\n')}

Rephrase this follow-up to be more natural and contextually aware:`;

    try {
        const response = await callLLM(systemPrompt, userPrompt, { 
            checkType: 'regenerate',
            maxTokens: 100 
        });
        
        // 确保以问号结尾
        let regenerated = response.trim();
        if (!regenerated.endsWith('?')) {
            regenerated += '?';
        }
        
        return regenerated;
    } catch (error) {
        console.error('❌ Followup regeneration failed:', error);
        // 降级策略：简单添加过渡词
        return `Thanks for sharing that. ${followup.prompt}`;
    }
}

/**
 * 批量检查多个followup的覆盖度
 * @param {Array} answers - 现有答案
 * @param {Array} followups - followup列表
 * @returns {Promise<Array>} 检查结果数组
 */
export async function checkMultipleFollowups(answers, followups) {
    const results = [];
    
    // 并行处理多个检查以提高性能
    const checkPromises = followups.map(followup => 
        checkCoverage(answers, followup)
            .then(result => ({ followup, result }))
            .catch(error => ({ 
                followup, 
                result: { 
                    verdict: 'NEEDS_ASKING', 
                    error: error.message 
                } 
            }))
    );
    
    const checkResults = await Promise.all(checkPromises);
    
    for (const { followup, result } of checkResults) {
        results.push({
            followup: followup,
            ...result
        });
    }
    
    return results;
}

/**
 * 综合智能决策 - 结合相关性和覆盖度检查做出最终决策
 * @param {Array} answers - 现有答案
 * @param {string} mainQuestion - 主问题
 * @param {Array} followups - 可能的followup列表
 * @returns {Promise<Object>} 决策结果
 */
export async function makeSmartDecision(answers, mainQuestion, followups) {
    // 1. 首先检查相关性
    const relevanceCheck = await checkRelevance(answers, mainQuestion);
    
    if (relevanceCheck.verdict === 'NEXT_MAIN_QUESTION') {
        return {
            decision: 'ADVANCE_TO_NEXT',
            reasoning: 'Main question sufficiently answered',
            relevanceCheck: relevanceCheck,
            nextFollowups: []
        };
    }
    
    // 2. 如果需要更多信息，检查哪些followup还需要问
    const coverageResults = await checkMultipleFollowups(answers, followups);
    const needsAsking = coverageResults.filter(r => r.verdict === 'NEEDS_ASKING');
    
    if (needsAsking.length === 0) {
        // 所有信息都已覆盖，可以进入下一个主问题
        return {
            decision: 'ADVANCE_TO_NEXT',
            reasoning: 'All follow-ups covered by existing answers',
            relevanceCheck: relevanceCheck,
            coverageResults: coverageResults,
            nextFollowups: []
        };
    }
    
    // 3. 需要询问一些followup
    return {
        decision: 'ASK_FOLLOWUPS',
        reasoning: `${needsAsking.length} follow-up questions needed`,
        relevanceCheck: relevanceCheck,
        coverageResults: coverageResults,
        nextFollowups: needsAsking.slice(0, 3) // 限制一次最多3个followup
    };
}

// 导出所有函数
export default {
    checkRelevance,
    checkCoverage,
    regenerateFollowup,
    checkMultipleFollowups,
    makeSmartDecision,
    callLLM // 导出给测试使用
};