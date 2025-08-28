/**
 * 简化的Chat处理器
 * 
 * 使用orchestratorSimple和LLM检查功能
 * 保持与现有前端的完全兼容
 */

import { 
    initSession, 
    getCurrentQuestion, 
    processAnswer,
    makeIntelligentDecision,
    getNextIntelligentFollowup,
    buildApiResponse,
    validateState,
    handleError as orchestratorHandleError,
    getExportData
} from './orchestratorSimple.js';

// 导入FOLLOWUPS_BY_QUESTION - 需要从orchestratorSimple.js中导出
import orchestratorSimple from './orchestratorSimple.js';

// 会话存储 - 与现有系统兼容
const sessions = new Map();

/**
 * 获取或创建会话
 * @param {string} sessionId 会话ID
 * @param {string} mode 模式
 * @returns {Object} 会话对象
 */
function getOrCreateSession(sessionId, mode = 'neutral') {
    if (!sessions.has(sessionId)) {
        const newSession = initSession(sessionId, mode);
        sessions.set(sessionId, newSession);
        
        console.log(`🆕 Created new session: ${sessionId} (mode: ${mode})`);
        return newSession;
    }
    
    const session = sessions.get(sessionId);
    
    // 验证状态一致性
    validateState(session);
    
    return session;
}

/**
 * 生成会话ID
 * @returns {string} 会话ID
 */
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 创建日志记录器
 * @param {Object} context 上下文
 * @returns {Object} 日志记录器
 */
function makeLogger(context) {
    const prefix = `[${context.route}:${context.requestId}]`;
    return {
        info: (msg, data) => console.log(`${prefix} INFO: ${msg}`, data || ''),
        warn: (msg, data) => console.warn(`${prefix} WARN: ${msg}`, data || ''),
        error: (msg, data) => console.error(`${prefix} ERROR: ${msg}`, data || '')
    };
}

/**
 * 简化的Chat处理器
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
export async function handleChatSimple(req, res) {
    const t0 = Date.now();
    const requestId = Math.random().toString(36).slice(2, 10);
    const log = makeLogger({ route: '/api/chat', requestId });

    try {
        const {
            message,
            step = 0,
            questionMode = true,
            sessionId,
            action = null
        } = req.body || {};

        log.info('incoming request', {
            hasMessage: !!message,
            step,
            questionMode,
            sessionIdProvided: !!sessionId,
            action,
            messagePreview: message ? message.substring(0, 50) + '...' : 'none'
        });

        // 验证输入
        if (!message || message.trim() === '') {
            log.warn('empty message provided');
            return res.status(400).json({ 
                error: 'Message is required and cannot be empty',
                timestamp: new Date().toISOString()
            });
        }

        // 获取或创建会话
        const currentSessionId = sessionId || generateSessionId();
        const session = getOrCreateSession(currentSessionId, 'neutral'); // 默认neutral模式

        log.info('session ready', { 
            sessionId: currentSessionId, 
            currentQuestionIndex: session.currentMainIdx,
            completedQuestions: session.completedQuestions
        });

        // 处理特殊启动消息
        if (message === "__START__" && action === "START_QUESTION_MODE") {
            log.info('handling START_QUESTION_MODE action');
            
            const firstQuestion = getCurrentQuestion(session);
            if (firstQuestion && firstQuestion.type !== 'completed') {
                const welcomeMessage = "Welcome, and thank you for being here today! We'll be discussing your experiences using AI for job interviews. Our goal is to better understand how people use AI in real-life situations and how that connects with their backgrounds. There are no right or wrong answers—we simply value your honest perspective, and we'd really appreciate it if you could elaborate on your responses to give us richer details.";
                const fullMessage = `${welcomeMessage}\n\n${firstQuestion.question}`;
                
                // 添加到对话记录
                session.conversationLog.push({
                    user: '',
                    bot: fullMessage,
                    timestamp: new Date().toISOString()
                });
                
                return res.json({
                    success: true,
                    bot_response: fullMessage,
                    conversation_history: session.conversationLog,
                    step,
                    question_completed: false,
                    pending_followup_exists: false,
                    allowed_actions: ["ASK_FOLLOWUP", "REQUEST_CLARIFY", "NEXT_QUESTION"],
                    interview_finished: false,
                    session_id: currentSessionId
                });
            }
        }

        // 获取当前问题
        const currentQuestion = getCurrentQuestion(session);
        
        if (currentQuestion.type === 'completed') {
            log.info('interview completed');
            
            // 根据模式设置不同的路由
            let allowedActions = [];
            switch(session.mode) {
                case 'neutral':
                    allowedActions = ["POST_TASK_SURVEY"];
                    break;
                case 'naive':
                    allowedActions = ["FREE_EDITING"];
                    break;
                case 'featured':
                    allowedActions = ["PRIVACY_ANALYSIS"];
                    break;
                default:
                    allowedActions = ["POST_TASK_SURVEY"];
            }
            
            return res.json({
                success: true,
                bot_response: "Thanks so much—that's all we need for now.",
                conversation_history: session.conversationLog,
                step,
                question_completed: true,
                pending_followup_exists: false,
                allowed_actions: allowedActions,
                interview_finished: true,
                session_id: currentSessionId,
                
                // 进度信息 - 面试完成时应该是100%
                progress_percentage: 100,
                completed_questions: session.totalQuestions,
                total_questions: session.totalQuestions,
                current_question_index: session.currentMainIdx,
                
                timings_ms: { total: Date.now() - t0 }
            });
        }

        // 处理用户回答 - 检查是否在回答followup
        const questionToProcess = session.currentFollowup || currentQuestion;
        const processResult = processAnswer(session, message, questionToProcess);
        
        // 如果刚刚回答了followup，清除当前followup状态
        if (session.currentFollowup) {
            session.currentFollowup = null;
        }
        log.info('answer processed', {
            resultStatus: processResult.status,
            answersCount: session.currentQuestionAnswers.length
        });

        // 检查当前主问题是否刚刚完成（所有followup都已回答）
        const checkIfMainQuestionJustCompleted = () => {
            const mainQuestion = session.mainQuestions[session.currentMainIdx];
            // 这是一个简化版本，我们假设有followup需要完成才能显示完成状态
            // 实际的followup检查逻辑在makeIntelligentDecision中处理
            const mainQuestionId = `main_${session.currentMainIdx}`;
            
            // 只有当主问题还没有被标记为完成，并且当前有followup被标记为完成时才返回true
            if (session.completedMainQuestions.has(mainQuestionId)) {
                return false; // 已经标记为完成了
            }
            
            // 检查是否刚刚完成了一个followup
            return session.completedFollowups.size > 0;
        };

        // 进行智能决策
        let decision;
        let botResponse = '';
        let questionCompleted = checkIfMainQuestionJustCompleted(); // 检查是否刚完成
        let followUpQuestions = [];
        let auditResult = null;

        try {
            decision = await makeIntelligentDecision(session);
            log.info('intelligent decision made', {
                decision: decision.decision,
                reasoning: decision.reasoning.substring(0, 100) + '...'
            });
            
            auditResult = {
                verdict: decision.decision === 'ADVANCE_TO_NEXT' ? 'ALLOW_NEXT_QUESTION' : 'REQUIRE_MORE',
                reasoning: decision.reasoning,
                coverage_map: decision.coverageResults || [],
                timestamp: new Date().toISOString()
            };

            if (decision.decision === 'ADVANCE_TO_NEXT') {
                // 标记当前问题为完成并进入下一个主问题
                questionCompleted = true;
                
                // 更新session状态：标记当前主问题为完成
                const currentMainQuestionId = `main_${session.currentMainIdx}`;
                if (!session.completedMainQuestions.has(currentMainQuestionId)) {
                    session.completedMainQuestions.add(currentMainQuestionId);
                    session.completedQuestions++;
                    session.progressPercentage = Math.round((session.completedQuestions / session.totalQuestions) * 100);
                    
                    log.info(`✅ Question ${session.currentMainIdx + 1}/6 completed! Progress: ${session.progressPercentage}%`);
                }
                
                // 移动到下一个问题
                session.currentMainIdx++;
                session.currentQuestionAnswers = []; // 清空当前问题答案
                
                // 获取下一个问题
                const nextQuestion = getCurrentQuestion(session);
                
                if (nextQuestion.type === 'completed') {
                    botResponse = "Thanks so much—that's all we need for now.";
                } else if (nextQuestion.type === 'main') {
                    botResponse = `Thank you for sharing that information. ${nextQuestion.question}`;
                } else {
                    botResponse = "Let me ask you another question.";
                }
                
            } else if (decision.decision === 'ASK_FOLLOWUPS') {
                // 询问followup问题
                const nextFollowup = await getNextIntelligentFollowup(session);
                
                if (nextFollowup) {
                    // 存储当前正在问的followup，以便处理用户回答时使用
                    session.currentFollowup = nextFollowup;
                    
                    // 为follow-up添加自然的连接语
                    const transitions = [
                        "Thanks for that. ",
                        "That's helpful to know. ",
                        "I'd love to know more about that. ",
                        "That gives me good context. ",
                        "I appreciate you sharing that. "
                    ];
                    
                    // 根据follow-up索引选择不同的过渡语，使对话更自然
                    const transitionIndex = nextFollowup.followupIdx % transitions.length;
                    const transition = transitions[transitionIndex];
                    
                    botResponse = `${transition}${nextFollowup.question}`;
                    followUpQuestions = [nextFollowup.question];
                    
                    log.info('next followup generated', {
                        followupId: nextFollowup.id,
                        intelligentlyGenerated: nextFollowup.intelligentlyGenerated
                    });
                } else {
                    // 没有更多followup，当前主问题完成！
                    questionCompleted = true;
                    
                    // 更新session状态：标记当前主问题为完成
                    const currentMainQuestionId = `main_${session.currentMainIdx}`;
                    if (!session.completedMainQuestions.has(currentMainQuestionId)) {
                        session.completedMainQuestions.add(currentMainQuestionId);
                        session.completedQuestions++;
                        session.progressPercentage = Math.round((session.completedQuestions / session.totalQuestions) * 100);
                        
                        log.info(`✅ Question ${session.currentMainIdx + 1}/6 completed! Progress: ${session.progressPercentage}%`);
                    }
                    
                    // 移动到下一个问题
                    session.currentMainIdx++;
                    session.currentQuestionAnswers = []; // 清空当前问题答案
                    
                    // 获取下一个问题
                    const nextQuestion = getCurrentQuestion(session);
                    
                    if (nextQuestion.type === 'completed') {
                        botResponse = "Thanks so much—that's all we need for now.";
                    } else if (nextQuestion.type === 'main') {
                        botResponse = `Thank you for sharing that information. ${nextQuestion.question}`;
                    } else {
                        botResponse = "Let me ask you another question.";
                    }
                }
            } else {
                // 需要主问题回答
                botResponse = "Could you please provide more details about that?";
            }

        } catch (error) {
            log.error('decision making failed', { error: error.message });
            
            // 降级策略
            const errorResponse = orchestratorHandleError(session, error);
            return res.json({
                success: true,
                bot_response: errorResponse.bot_response,
                conversation_history: session.conversationLog,
                step,
                question_completed: false,
                pending_followup_exists: false,
                allowed_actions: ["ASK_FOLLOWUP", "REQUEST_CLARIFY", "NEXT_QUESTION"],
                interview_finished: false,
                session_id: currentSessionId,
                error_recovery: true,
                orchestrator_state: errorResponse.orchestrator_state,
                timings_ms: { total: Date.now() - t0 }
            });
        }

        // 添加机器人回复到对话记录
        session.conversationLog.push({
            user: message,
            bot: botResponse,
            timestamp: new Date().toISOString()
        });

        // 检查面试是否完成
        const nextQuestionCheck = getCurrentQuestion(session);
        const interviewFinished = nextQuestionCheck.type === 'completed';
        
        // 根据面试状态和模式设置allowed_actions
        let allowedActions = ["ASK_FOLLOWUP", "REQUEST_CLARIFY", "NEXT_QUESTION"];
        if (interviewFinished) {
            switch(session.mode) {
                case 'neutral':
                    allowedActions = ["POST_TASK_SURVEY"];
                    break;
                case 'naive':
                    allowedActions = ["FREE_EDITING"];
                    break;
                case 'featured':
                    allowedActions = ["PRIVACY_ANALYSIS"];
                    break;
                default:
                    allowedActions = ["POST_TASK_SURVEY"];
            }
        }

        // 构建兼容的API响应
        const response = {
            success: true,
            bot_response: botResponse,
            conversation_history: session.conversationLog,
            step,
            privacy_detection: null, // 将在后续版本添加
            question_completed: questionCompleted,
            audit_result: auditResult,
            orchestrator_tags: decision?.relevanceCheck?.reasoning ? ['INTELLIGENT_DECISION'] : [],
            no_answer_cause: null,
            followup_coverage: decision?.coverageResults || [],
            next_followup: followUpQuestions.length > 0 ? { prompt: followUpQuestions[0] } : null,
            pending_followup_exists: followUpQuestions.length > 0,
            followup_polish_meta: null,
            follow_up_questions: followUpQuestions,
            question_presence_audit: null, // 将在后续版本添加
            interview_finished: interviewFinished,
            allowed_actions: allowedActions,
            session_id: currentSessionId,
            
            // 进度信息 - 添加到顶层以确保前端可以访问
            progress_percentage: session.progressPercentage,
            completed_questions: session.completedQuestions,
            total_questions: session.totalQuestions,
            current_question_index: session.currentMainIdx,
            
            // 简化orchestrator的内部状态（用于调试和恢复）
            orchestrator_state: {
                currentMainIdx: session.currentMainIdx,
                completedQuestions: session.completedQuestions,
                progressPercentage: session.progressPercentage,
                completedMainQuestions: Array.from(session.completedMainQuestions),
                completedFollowups: Array.from(session.completedFollowups)
            },
            
            timings_ms: { total: Date.now() - t0 }
        };

        log.info('response prepared', {
            responseLength: botResponse.length,
            questionCompleted,
            interviewFinished,
            followUpQuestions: followUpQuestions.length
        });

        return res.json(response);

    } catch (error) {
        const t1 = Date.now();
        log.error('handler fatal error', { 
            error: error.message, 
            stack: error.stack, 
            totalMs: t1 - t0 
        });
        
        return res.status(500).json({
            error: 'Internal server error',
            details: error.message,
            timestamp: new Date().toISOString(),
            timings_ms: { total: t1 - t0 }
        });
    }
}

/**
 * 兼容性包装器 - 处理旧版本的API调用
 * @param {Object} req 请求对象
 * @param {Object} res 响应对象
 */
export async function handleChatLegacy(req, res) {
    // 这里可以调用原始的复杂处理器
    // 目前先返回一个提示
    return res.json({
        success: false,
        error: 'Legacy handler not implemented yet',
        message: 'Please use the simplified orchestrator',
        timestamp: new Date().toISOString()
    });
}

/**
 * 获取会话统计信息
 * @returns {Object} 统计信息
 */
export function getSessionStats() {
    const stats = {
        totalSessions: sessions.size,
        activeSessions: 0,
        completedSessions: 0,
        sessionsbyMode: { naive: 0, neutral: 0, featured: 0 }
    };
    
    for (const session of sessions.values()) {
        if (session.currentMainIdx >= session.totalQuestions) {
            stats.completedSessions++;
        } else {
            stats.activeSessions++;
        }
        
        stats.sessionsbyMode[session.mode] = (stats.sessionsbyMode[session.mode] || 0) + 1;
    }
    
    return stats;
}

/**
 * 清理过期会话（可选的内存管理）
 * @param {number} maxAgeMs 最大年龄（毫秒）
 */
export function cleanupOldSessions(maxAgeMs = 24 * 60 * 60 * 1000) { // 24小时
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of sessions.entries()) {
        const lastActivity = new Date(session.lastActivityTimestamp).getTime();
        if (now - lastActivity > maxAgeMs) {
            sessions.delete(sessionId);
            cleanedCount++;
        }
    }
    
    console.log(`🧹 Cleaned up ${cleanedCount} old sessions, ${sessions.size} remaining`);
    return cleanedCount;
}

// 导出所有函数
export default {
    handleChatSimple,
    handleChatLegacy,
    getSessionStats,
    cleanupOldSessions,
    generateSessionId
};