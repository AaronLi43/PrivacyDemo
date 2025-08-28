/**
 * Simplified Orchestrator Module
 * 
 * 核心目标：
 * 1. 简化的问题推进逻辑
 * 2. 防止问题回退和重复
 * 3. 状态持久化支持
 * 4. 与现有前端完全兼容
 * 5. 智能LLM检查决策
 */

// 导入LLM检查功能
import { 
    checkRelevance, 
    checkCoverage, 
    regenerateFollowup, 
    makeSmartDecision 
} from './llmChecks.js';

// 问题数据定义（从server.js提取）
const unifiedQuestions = [
    "Could you tell me about your educational background - what did you study in college or university?",
    "I'd love to hear about your current work and how you got into it by job interviews?",
    "Can you walk me through a specific time when you used AI before and during job interviews?",
    "Did you ever have a moment when using AI during your job search made you nervous — like it might cause a problem? Could you tell me about that? ",
    "Did you ever find yourself questioning whether your use of AI in interviews was fully appropriate? If so, what led to that feeling?",
    "Have you ever used AI for your job interviews in a way that you prefer not to share openly with others—such as your employer, family, friends, or colleagues?"
];

// Follow-ups映射
const FOLLOWUPS_BY_QUESTION = {
    [unifiedQuestions[0]]: [
        { id: "Q1_F1", prompt: "When did you start your degree and when did you finish?", keywords: [
            "when","start","started","begin","began","enroll","enrolled",
            "from","since","until","between",
            "finish","finished","complete","completed","graduated","graduation",
            "class of","year","semester","quarter","fall","spring","summer","winter",
            "freshman","sophomore","junior","senior","201","202"
        ] },
        { id: "Q1_F2", prompt: "Where is your college or university located?", keywords: [
            "where","location","located","city","town","state","province","country","region",
            "university","college","school","campus","institution",
            "university of","college of","state university","polytechnic","tech university"
        ] },
        { id: "Q1_F3", prompt: "Who comes to mind as someone you learned the most from during your degree? Naming a person can sometimes help you reflect more concretely on your experience.", keywords: [
            "supervisor","advisor","adviser","mentor","thesis advisor","capstone advisor","co-advisor",
            "professor","instructor","teacher","faculty","staff",
            "Dr.","Ph.D","PhD","Professor","prof"
        ] }
    ],
    [unifiedQuestions[1]]: [
        { id: "Q2_F1", prompt: "What is your current job title?", keywords: [
            "job","position","role","title","work","career","occupation",
            "analyst","engineer","manager","director","specialist","coordinator",
            "developer","designer","consultant","administrator","executive"
        ] },
        { id: "Q2_F2", prompt: "When did you start your current job and when did you do the interview?", keywords: [
            "when","start","started","begin","began","hired","joined",
            "interview","interviewed","apply","applied","application",
            "month","year","ago","recent","recently","last","this"
        ] }
    ],
    [unifiedQuestions[2]]: [
        { id: "Q3_F1", prompt: "Which AI tools did you use and for what tasks?", keywords: [
            "ChatGPT","GPT","Claude","Bard","Gemini","Copilot",
            "AI","artificial intelligence","tool","platform","application",
            "resume","cover letter","answers","questions","research","practice"
        ] },
        { id: "Q3_F2", prompt: "How did you use AI and what difference did it make?", keywords: [
            "how","method","way","process","approach",
            "help","helped","improve","improved","better","confidence","confident",
            "difference","impact","effect","result","outcome"
        ] }
    ],
    [unifiedQuestions[3]]: [
        { id: "Q4_F1", prompt: "What specifically made you nervous about using AI?", keywords: [
            "nervous","worried","concerned","anxious","afraid","fear",
            "caught","discovered","found out","detected","flagged",
            "cheating","unfair","inappropriate","wrong","ethical"
        ] }
    ],
    [unifiedQuestions[4]]: [
        { id: "Q5_F1", prompt: "What made you question whether your AI use was appropriate?", keywords: [
            "appropriate","right","wrong","fair","unfair","ethical","unethical",
            "should","shouldn't","allowed","not allowed","acceptable",
            "question","questioned","doubt","doubted","wonder","wondered"
        ] }
    ],
    [unifiedQuestions[5]]: [
        { id: "Q6_F1", prompt: "What specific AI uses do you prefer to keep private?", keywords: [
            "private","secret","hidden","confidential","personal",
            "share","tell","mention","discuss","reveal","disclose",
            "employer","boss","family","friends","colleagues","coworkers"
        ] }
    ]
};

/**
 * 初始化会话状态
 * @param {string} sessionId - 会话ID
 * @param {string} mode - 模式 (naive/neutral/featured)
 * @returns {Object} 初始化的状态对象
 */
export function initSession(sessionId, mode = 'neutral') {
    return {
        // 基础信息
        sessionId: sessionId,
        mode: mode,
        startTimestamp: new Date().toISOString(),
        lastActivityTimestamp: new Date().toISOString(),
        
        // 问题管理
        mainQuestions: unifiedQuestions,
        currentMainIdx: 0,
        completedMainQuestions: new Set(), // 防止重复的关键
        
        // 当前问题状态
        currentQuestionAnswers: [],    // 累积当前主问题的所有回答
        currentFollowups: [],          // 当前主问题的followup列表
        currentFollowupIdx: 0,
        completedFollowups: new Set(),  // 已完成的followup ID
        
        // 进度跟踪
        totalQuestions: unifiedQuestions.length,
        completedQuestions: 0,
        progressPercentage: 0,
        
        // 对话记录（用于生成导出JSON）
        conversationLog: [],
        originalConversation: [],
        privacyAnalysis: [],
        privacySuggestions: [],
        
        // 调试和恢复信息
        lastAction: null,
        lastError: null,
        retryCount: 0,
        
        // 防止重复问题的追踪
        followupAttempts: new Map() // 记录每个followup被问的次数
    };
}

/**
 * 获取当前应该询问的问题
 * @param {Object} state - 会话状态
 * @returns {Object} 当前问题信息
 */
export function getCurrentQuestion(state) {
    // 更新活动时间戳
    state.lastActivityTimestamp = new Date().toISOString();
    
    // 检查是否已完成所有主问题
    if (state.currentMainIdx >= state.mainQuestions.length) {
        return {
            type: 'completed',
            message: "Thanks so much—that's all we need for now.",
            isComplete: true
        };
    }
    
    const mainQuestion = state.mainQuestions[state.currentMainIdx];
    const mainQuestionId = `main_${state.currentMainIdx}`;
    
    // 检查主问题是否已完成（防回退）
    if (!state.completedMainQuestions.has(mainQuestionId)) {
        // 需要询问主问题
        return {
            type: 'main',
            id: mainQuestionId,
            question: mainQuestion,
            index: state.currentMainIdx,
            isFirstTime: state.currentQuestionAnswers.length === 0
        };
    }
    
    // 主问题已完成，检查是否有未完成的followup
    const followups = FOLLOWUPS_BY_QUESTION[mainQuestion] || [];
    
    for (let i = 0; i < followups.length; i++) {
        const followup = followups[i];
        const followupId = `${mainQuestionId}_followup_${i}`;
        
        if (!state.completedFollowups.has(followupId)) {
            // 找到未完成的followup
            state.currentFollowupIdx = i;
            return {
                type: 'followup',
                id: followupId,
                question: followup.prompt,
                keywords: followup.keywords,
                mainQuestionIdx: state.currentMainIdx,
                followupIdx: i
            };
        }
    }
    
    // 当前主问题及其所有followup都已完成，移到下一个主问题
    state.currentMainIdx++;
    state.currentQuestionAnswers = [];
    state.completedFollowups.clear(); // 清空followup记录，为下一个主问题准备
    
    // 递归调用获取下一个问题
    return getCurrentQuestion(state);
}

/**
 * 处理用户的回答
 * @param {Object} state - 会话状态
 * @param {string} userAnswer - 用户的回答
 * @param {Object} currentQuestion - 当前问题对象
 * @returns {Object} 处理结果
 */
export function processAnswer(state, userAnswer, currentQuestion) {
    // 记录回答
    state.currentQuestionAnswers.push({
        questionId: currentQuestion.id,
        questionType: currentQuestion.type,
        question: currentQuestion.question,
        answer: userAnswer,
        timestamp: new Date().toISOString()
    });
    
    // 添加到对话记录
    state.conversationLog.push({
        user: userAnswer,
        bot: currentQuestion.question,
        timestamp: new Date().toISOString()
    });
    
    // 根据问题类型处理
    if (currentQuestion.type === 'main') {
        // 主问题回答后，默认标记为待检查
        // LLM检查后会决定是否标记为完成
        return {
            status: 'pending_check',
            needsLLMCheck: true,
            checkType: 'relevance'
        };
    } else if (currentQuestion.type === 'followup') {
        // Followup回答后，标记为完成
        state.completedFollowups.add(currentQuestion.id);
        return {
            status: 'followup_completed',
            needsLLMCheck: true,
            checkType: 'coverage'
        };
    }
    
    return {
        status: 'processed'
    };
}

/**
 * 标记主问题为完成
 * @param {Object} state - 会话状态
 */
export function markMainQuestionComplete(state) {
    const mainQuestionId = `main_${state.currentMainIdx}`;
    state.completedMainQuestions.add(mainQuestionId);
    state.completedQuestions++;
    state.progressPercentage = Math.round((state.completedQuestions / state.totalQuestions) * 100);
}

/**
 * 检查是否应该进入下一个主问题
 * @param {Object} state - 会话状态
 * @param {Object} llmCheckResult - LLM检查结果
 * @returns {boolean} 是否应该进入下一个主问题
 */
export function shouldAdvanceToNext(state, llmCheckResult) {
    // 基于LLM检查结果决定
    if (llmCheckResult && llmCheckResult.verdict === 'NEXT_MAIN_QUESTION') {
        markMainQuestionComplete(state);
        return true;
    }
    
    // 检查是否所有followup都已完成
    const mainQuestion = state.mainQuestions[state.currentMainIdx];
    const followups = FOLLOWUPS_BY_QUESTION[mainQuestion] || [];
    const mainQuestionId = `main_${state.currentMainIdx}`;
    
    let allFollowupsCompleted = true;
    for (let i = 0; i < followups.length; i++) {
        const followupId = `${mainQuestionId}_followup_${i}`;
        if (!state.completedFollowups.has(followupId)) {
            allFollowupsCompleted = false;
            break;
        }
    }
    
    if (allFollowupsCompleted && followups.length > 0) {
        markMainQuestionComplete(state);
        return true;
    }
    
    return false;
}

/**
 * 智能决策 - 使用LLM判断下一步行动
 * @param {Object} state - 会话状态
 * @returns {Promise<Object>} 决策结果
 */
export async function makeIntelligentDecision(state) {
    if (state.currentQuestionAnswers.length === 0) {
        return {
            decision: 'NEED_MAIN_ANSWER',
            reasoning: 'No answers provided yet for main question'
        };
    }
    
    const mainQuestion = state.mainQuestions[state.currentMainIdx];
    const followups = FOLLOWUPS_BY_QUESTION[mainQuestion] || [];
    
    try {
        const decision = await makeSmartDecision(
            state.currentQuestionAnswers,
            mainQuestion,
            followups
        );
        
        // 更新状态基于决策结果
        if (decision.decision === 'ADVANCE_TO_NEXT') {
            markMainQuestionComplete(state);
        }
        
        return decision;
    } catch (error) {
        console.error('❌ Intelligent decision making failed:', error);
        // 降级策略
        return {
            decision: state.currentQuestionAnswers.length >= 2 ? 'ADVANCE_TO_NEXT' : 'ASK_FOLLOWUPS',
            reasoning: 'Fallback decision based on answer count',
            error: error.message
        };
    }
}

/**
 * 获取下一个需要询问的followup（智能版本）
 * @param {Object} state - 会话状态
 * @returns {Promise<Object>} followup问题信息
 */
export async function getNextIntelligentFollowup(state) {
    const mainQuestion = state.mainQuestions[state.currentMainIdx];
    const followups = FOLLOWUPS_BY_QUESTION[mainQuestion] || [];
    const mainQuestionId = `main_${state.currentMainIdx}`;
    
    // 找到还未完成的followup
    for (let i = 0; i < followups.length; i++) {
        const followup = followups[i];
        const followupId = `${mainQuestionId}_followup_${i}`;
        
        if (!state.completedFollowups.has(followupId)) {
            try {
                // 检查重复问题限制（最多问2次）
                const attemptCount = state.followupAttempts.get(followupId) || 0;
                if (attemptCount >= 2) {
                    console.log(`⏭️  Skipping ${followupId} - already asked ${attemptCount} times`);
                    state.completedFollowups.add(followupId);
                    continue;
                }
                
                // 检查用户是否表示拒绝回答（优先级最高）
                const latestAnswer = state.currentQuestionAnswers[state.currentQuestionAnswers.length - 1];
                if (latestAnswer) {
                    const lowerAnswer = latestAnswer.answer.toLowerCase();
                    if (lowerAnswer.includes('cannot remember') || lowerAnswer.includes('dont remember') || 
                        lowerAnswer.includes("don't remember") || lowerAnswer.includes('not sure') ||
                        lowerAnswer.includes('forget') || lowerAnswer.includes('no idea')) {
                        // 用户明确表示不记得，停止追问这类问题
                        state.completedFollowups.add(followupId);
                        console.log(`🚫 ${followupId} skipped - user indicated they don't remember`);
                        continue;
                    }
                }
                
                // 检查是否已被覆盖
                const coverageResult = await checkCoverage(state.currentQuestionAnswers, followup);
                
                if (coverageResult.verdict === 'ALREADY_ANSWERED') {
                    // 标记为完成并继续查找
                    state.completedFollowups.add(followupId);
                    console.log(`✅ ${followupId} marked as covered: ${coverageResult.reasoning}`);
                    continue;
                }
                
                // 记录这次询问
                state.followupAttempts.set(followupId, attemptCount + 1);
                
                // 生成智能的followup问题
                const regeneratedQuestion = await regenerateFollowup(followup, state.currentQuestionAnswers);
                
                console.log(`❓ Asking ${followupId} (attempt ${attemptCount + 1}/2): ${followup.prompt.substring(0, 50)}...`);
                
                return {
                    type: 'followup',
                    id: followupId,
                    question: regeneratedQuestion,
                    originalQuestion: followup.prompt,
                    keywords: followup.keywords,
                    mainQuestionIdx: state.currentMainIdx,
                    followupIdx: i,
                    intelligentlyGenerated: true,
                    coverageCheck: coverageResult,
                    attemptNumber: attemptCount + 1
                };
                
            } catch (error) {
                console.error('❌ Failed to process intelligent followup:', error);
                // 降级到原始问题
                return {
                    type: 'followup',
                    id: followupId,
                    question: followup.prompt,
                    keywords: followup.keywords,
                    mainQuestionIdx: state.currentMainIdx,
                    followupIdx: i,
                    intelligentlyGenerated: false,
                    error: error.message
                };
            }
        }
    }
    
    // 没有更多followup需要询问
    return null;
}

/**
 * 获取需要检查的followup列表
 * @param {Object} state - 会话状态
 * @returns {Array} 未完成的followup列表
 */
export function getPendingFollowups(state) {
    const mainQuestion = state.mainQuestions[state.currentMainIdx];
    const followups = FOLLOWUPS_BY_QUESTION[mainQuestion] || [];
    const mainQuestionId = `main_${state.currentMainIdx}`;
    
    const pending = [];
    for (let i = 0; i < followups.length; i++) {
        const followupId = `${mainQuestionId}_followup_${i}`;
        if (!state.completedFollowups.has(followupId)) {
            pending.push({
                id: followupId,
                ...followups[i],
                index: i
            });
        }
    }
    
    return pending;
}

/**
 * 保存状态快照（用于持久化）
 * @param {Object} state - 会话状态
 * @returns {Object} 可序列化的状态快照
 */
export function saveStateSnapshot(state) {
    return {
        ...state,
        completedMainQuestions: Array.from(state.completedMainQuestions),
        completedFollowups: Array.from(state.completedFollowups)
    };
}

/**
 * 从快照恢复状态
 * @param {Object} snapshot - 状态快照
 * @returns {Object} 恢复的状态对象
 */
export function restoreStateFromSnapshot(snapshot) {
    const state = { ...snapshot };
    state.completedMainQuestions = new Set(snapshot.completedMainQuestions || []);
    state.completedFollowups = new Set(snapshot.completedFollowups || []);
    return state;
}

/**
 * 生成前端兼容的响应格式
 * @param {Object} state - 会话状态
 * @param {string} botResponse - 机器人回复
 * @param {Object} options - 额外选项
 * @returns {Object} API响应对象
 */
export function buildApiResponse(state, botResponse, options = {}) {
    const currentQuestion = getCurrentQuestion(state);
    
    return {
        bot_response: botResponse,
        question_completed: currentQuestion.type === 'completed' || options.questionCompleted || false,
        follow_up_questions: options.followUpQuestions || [],
        audit_result: options.auditResult || null,
        privacy_detection: options.privacyDetection || null,
        
        // 内部状态，用于恢复
        orchestrator_state: {
            currentMainIdx: state.currentMainIdx,
            currentFollowupIdx: state.currentFollowupIdx,
            completedMainQuestions: Array.from(state.completedMainQuestions),
            completedFollowups: Array.from(state.completedFollowups),
            progressPercentage: state.progressPercentage
        },
        
        // 调试信息（仅在开发模式）
        ...(process.env.NODE_ENV === 'development' && {
            debug: {
                currentQuestion: currentQuestion,
                pendingFollowups: getPendingFollowups(state),
                totalAnswers: state.currentQuestionAnswers.length
            }
        })
    };
}

/**
 * 验证状态一致性（防止异常状态）
 * @param {Object} state - 会话状态
 * @returns {boolean} 状态是否有效（true=原本有效，false=发现并修复了问题）
 */
export function validateState(state) {
    let wasValid = true;
    
    // 确保索引在有效范围内
    if (state.currentMainIdx < 0 || state.currentMainIdx > state.mainQuestions.length) {
        console.error(`Invalid currentMainIdx: ${state.currentMainIdx}`);
        state.currentMainIdx = Math.max(0, Math.min(state.currentMainIdx, state.mainQuestions.length));
        wasValid = false;
    }
    
    // 确保Set对象存在
    if (!(state.completedMainQuestions instanceof Set)) {
        state.completedMainQuestions = new Set();
        wasValid = false;
    }
    if (!(state.completedFollowups instanceof Set)) {
        state.completedFollowups = new Set();
        wasValid = false;
    }
    
    // 确保进度百分比正确
    const expectedProgress = Math.round((state.completedQuestions / state.totalQuestions) * 100);
    if (Math.abs(state.progressPercentage - expectedProgress) > 1) {
        state.progressPercentage = expectedProgress;
        wasValid = false;
    }
    
    return wasValid;
}

/**
 * 处理错误和恢复
 * @param {Object} state - 会话状态
 * @param {Error} error - 错误对象
 * @returns {Object} 错误恢复响应
 */
export function handleError(state, error) {
    state.lastError = {
        message: error.message,
        timestamp: new Date().toISOString(),
        retryCount: state.retryCount++
    };
    
    // 保存当前状态以便恢复
    const snapshot = saveStateSnapshot(state);
    
    return {
        bot_response: "Let me continue with our conversation...",
        error_recovery: true,
        orchestrator_state: snapshot,
        retry_needed: state.retryCount < 3
    };
}

/**
 * 获取导出数据（符合示例JSON格式）
 * @param {Object} state - 会话状态
 * @param {Object} additionalData - 额外数据
 * @returns {Object} 导出数据对象
 */
export function getExportData(state, additionalData = {}) {
    const isComplete = state.currentMainIdx >= state.mainQuestions.length;
    
    return {
        metadata: {
            mode: state.mode,
            export_timestamp: new Date().toISOString(),
            export_type: isComplete ? 'full_completion' : 'partial_completion',
            completion_status: isComplete ? 'COMPLETED' : 'PARTIAL',
            total_questions: state.totalQuestions,
            completed_questions: state.completedQuestions,
            current_question_index: state.currentMainIdx,
            progress_percentage: state.progressPercentage,
            ...additionalData.metadata
        },
        conversation: state.conversationLog,
        original_conversation: state.originalConversation,
        privacy_analysis: state.privacyAnalysis,
        privacy_suggestions: state.privacySuggestions,
        survey_data: additionalData.surveyData || {}
    };
}

// 导出所有函数
export default {
    initSession,
    getCurrentQuestion,
    processAnswer,
    markMainQuestionComplete,
    shouldAdvanceToNext,
    makeIntelligentDecision,
    getNextIntelligentFollowup,
    getPendingFollowups,
    saveStateSnapshot,
    restoreStateFromSnapshot,
    buildApiResponse,
    validateState,
    handleError,
    getExportData
};