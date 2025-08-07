const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// OpenAI API
const OpenAI = require('openai');

// AWS SDK
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Initialize OpenAI
let openaiClient;
try {
    if (process.env.OPENAI_API_KEY) {
        openaiClient = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        console.log('✅ OpenAI initialized successfully');
    } else {
        console.log('⚠️  OPENAI_API_KEY not found, using fallback responses');
    }
} catch (error) {
    console.log('⚠️  Failed to initialize OpenAI, using fallback responses:', error.message);
}

// Initialize AWS S3 Client
let s3Client;
try {
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        s3Client = new S3Client({
            region: 'us-east-2',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
        });
        console.log('✅ AWS S3 client initialized successfully');
    } else {
        console.log('⚠️  AWS credentials not found, S3 uploads will be disabled');
    }
} catch (error) {
    console.log('⚠️  Failed to initialize AWS S3 client:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Audit LLM configuration
const ENABLE_AUDIT_LLM = true; // Always enable audit LLM for all modes in the study
console.log(`🔍 Audit LLM: ${ENABLE_AUDIT_LLM ? 'ENABLED' : 'DISABLED'}`);

// Global mode configuration
let currentMode = 'chat';

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS ? 
    process.env.CORS_ORIGINS.split(',') : 
    [
        'https://privacy-demo-flame.vercel.app',
        'https://privacy-demo-git-main-privacy-demo-flame.vercel.app',
        'http://localhost:8000',
        'http://localhost:3000',
        'http://127.0.0.1:8000',
        'http://127.0.0.1:3000'
    ];

console.log('🔧 CORS origins configured:', corsOrigins);

// Middleware
app.use(cors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Session-based conversation management
const sessions = new Map(); // Store conversations by session ID

// Helper function to get or create session
function getSession(sessionId) {
    if (!sessions.has(sessionId)) {
        sessions.set(sessionId, {
            conversationHistory: [],
            currentMode: 'chat',
            uploadedQuestions: [],
            uploadedReturnLog: [],
            activeChatSession: null,
                    globalPiiCounters: {
            ADDRESS: 0,
            IP_ADDRESS: 0,
            URL: 0,
            SSN: 0,
            PHONE_NUMBER: 0,
            EMAIL: 0,
            DRIVERS_LICENSE: 0,
            PASSPORT_NUMBER: 0,
            TAXPAYER_IDENTIFICATION_NUMBER: 0,
            ID_NUMBER: 0,
            NAME: 0,
            USERNAME: 0,
            KEYS: 0,
            GEOLOCATION: 0,
            AFFILIATION: 0,
            DEMOGRAPHIC_ATTRIBUTE: 0,
            TIME: 0,
            HEALTH_INFORMATION: 0,
            FINANCIAL_INFORMATION: 0,
            EDUCATIONAL_RECORD: 0
        },
        detectedEntities: {} // Track detected entities to ensure consistent placeholders
        });
    }
    return sessions.get(sessionId);
}

// Helper function to generate session ID
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Legacy global variables (deprecated - use session-based instead)
// These are kept for backward compatibility but should not be used
let globalPiiCounters = {
    ADDRESS: 0,
    IP_ADDRESS: 0,
    URL: 0,
    SSN: 0,
    PHONE_NUMBER: 0,
    EMAIL: 0,
    DRIVERS_LICENSE: 0,
    PASSPORT_NUMBER: 0,
    TAXPAYER_IDENTIFICATION_NUMBER: 0,
    ID_NUMBER: 0,
    NAME: 0,
    USERNAME: 0,
    KEYS: 0,
    GEOLOCATION: 0,
    AFFILIATION: 0,
    DEMOGRAPHIC_ATTRIBUTE: 0,
    TIME: 0,
    HEALTH_INFORMATION: 0,
    FINANCIAL_INFORMATION: 0,
    EDUCATIONAL_RECORD: 0
};

// Background questions (first 3 questions - no follow-ups needed)
const backgroundQuestions = [
    "Tell me about your educational background - what did you study in college or university?",
    "I'd love to hear about your current work and how you got into it by job interviews?",
    "What first got you interested in using GenAI tools like ChatGPT or Gemini for job interviews?"
];

// Main predefined questions stored on server
const predefinedQuestions = {
    naive: [
        "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
        "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
        "Have you ever considered or actually used GenAI during a live interview? What happened?",
        "Tell me about a time when you felt AI gave you a real competitive edge in an interview process.",
        "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
        "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job applications?",
        "Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues?"
    ],
    neutral: [
        "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
        "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
        "Have you ever considered or actually used GenAI during a live interview? What happened?",
        "Tell me about a time when you felt AI gave you a real competitive edge in an interview process.",
        "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
        "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job applications?",
        "Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues?"
    ],
    featured: [
        "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
        "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
        "Have you ever considered or actually used GenAI during a live interview? What happened?",
        "Tell me about a time when you felt AI gave you a real competitive edge in an interview process.",
        "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
        "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job applications?",
        "Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues?"
    ]
};

// Helper function to check if a question is a background question
function isBackgroundQuestion(question) {
    return backgroundQuestions.includes(question);
}



// Helper function to manage conversation context
function manageConversationContext(sessionId) {
    const session = getSession(sessionId);
    // Keep track of conversation context without resetting
    // This allows for continuous conversation tracking
    const maxMessages = 1000; // Increased limit to allow longer conversations
    
    if (session.conversationHistory.length > maxMessages) {
        console.log('Conversation getting very long, keeping context but trimming history for performance');
        
        // Keep only recent messages in history for reference but maintain chat session
        session.conversationHistory = session.conversationHistory.slice(-100);
    }
}

// Helper function to get the next uncompleted question index
function getNextUncompletedQuestionIndex(sessionId) {
    // This is a simplified implementation for the server
    // In a real implementation, you would track completed questions in the conversation state
    // For now, we'll use a simple approach based on the current conversation step
    
    const session = getSession(sessionId);
    // Get the current step from the conversation history
    const currentStep = session.conversationHistory.length;
    
    // Assuming questions are processed sequentially, the next question index would be the current step
    // This is a basic implementation - in production you'd want more sophisticated tracking
    return currentStep;
}

// Helper function to get the next placeholder number for a PII category
function getNextPlaceholderNumber(piiCategory, sessionId) {
    const session = getSession(sessionId);
    if (session.globalPiiCounters.hasOwnProperty(piiCategory)) {
        session.globalPiiCounters[piiCategory]++;
        return session.globalPiiCounters[piiCategory];
    }
    // For unknown categories, use a generic counter
    if (!session.globalPiiCounters['UNKNOWN']) {
        session.globalPiiCounters['UNKNOWN'] = 0;
    }
    session.globalPiiCounters['UNKNOWN']++;
    return session.globalPiiCounters['UNKNOWN'];
}

// Enhanced function to get next question from predefined questions array
function getNextQuestionFromArray(predefinedQuestions, currentIndex = 0) {
    if (!predefinedQuestions || !Array.isArray(predefinedQuestions)) {
        return null;
    }
    
    // If we're at the end of the questions, return null
    if (currentIndex >= predefinedQuestions.length) {
        return null;
    }
    
    // Return the next question
    return predefinedQuestions[currentIndex];
}

// API Routes

// Test API Connection
app.get('/api/test_connection', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Backend server is running',
        timestamp: new Date().toISOString(),
        conversation_context: {
            has_active_session: false, // Simplified for now
            message_count: 0, // Simplified for now
            current_mode: 'chat'
        }
    });
});

// Get predefined questions API
app.get('/api/predefined_questions/:mode', (req, res) => {
    try {
        const { mode } = req.params;
        
        if (!predefinedQuestions[mode]) {
            return res.status(400).json({ error: 'Invalid mode' });
        }
        
        res.json({
            success: true,
            questions: [...backgroundQuestions, ...predefinedQuestions[mode]],
            backgroundQuestions: backgroundQuestions,
            mainQuestions: predefinedQuestions[mode],
            mode: mode
        });
    } catch (error) {
        console.error('Get predefined questions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});



// Debug API to show conversation context
app.get('/api/debug_context', (req, res) => {
    res.json({
        conversation_history: [], // Simplified for now
        active_chat_session: false, // Simplified for now
        current_mode: 'chat',
        uploaded_questions: [],
        uploaded_return_log: [],
        global_pii_counters: {}
    });
});

// Configuration API
app.get('/api/config', (req, res) => {
    res.json({
        audit_llm_enabled: true, // Always enable audit LLM for the study
        openai_available: openaiClient !== null,
        features: {
            audit_llm: true, // Always enable audit LLM for the study
            privacy_detection: currentMode === 'featured',
            question_mode: true
        }
    });
});

// Chat API
app.post('/api/chat', async (req, res) => {
    try {
        const { message, step = 0, questionMode = false, currentQuestion = null, predefinedQuestions = [], isFinalQuestion = false, followUpMode = false, sessionId } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message is required and cannot be empty' });
        }

        // Get or create session
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);

        // Add user message to history
        session.conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            step: step
        });
        
        console.log(`Chat API: Received message="${message}", questionMode=${questionMode}, currentQuestion="${currentQuestion}", sessionId=${currentSessionId}`);

        // Manage conversation context (reset if too long)
        manageConversationContext(currentSessionId);

        // Check if this is the first exchange (only one user message in history)
        const isFirstExchange = session.conversationHistory.length === 1;
        console.log(`Conversation history length: ${session.conversationHistory.length}, isFirstExchange: ${isFirstExchange}`);
        
        // Generate AI response using OpenAI or fallback
        let aiResponse;
        let questionCompleted = false;
        let auditResult = null;
        let questionPresenceResult = null;
        
        if (openaiClient) {
            try {
                // Enhanced system prompt for the chatbot with question guidance
                let systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant. Keep your responses short and concise.`;
                
                // If in question mode, enhance the system prompt with predefined questions
                if (questionMode && predefinedQuestions && predefinedQuestions.length > 0) {
                    const finalQuestionNote = isFinalQuestion ? 
                        "\n\nFINAL QUESTION INSTRUCTIONS: This is the LAST question in the conversation. You MUST include the final question in your response before engaging in follow-up conversation. Do NOT provide a summary or acknowledgment without asking the question first.\n\nCRITICAL: Your response MUST include the actual final question. Only after asking the final question should you engage in follow-up conversation.\n\nExample of a good final question response:\n'That's really interesting! Now, let me ask you the final question: Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues? I'd love to hear about your experiences with this aspect of AI usage.'\n\nDo NOT respond with just an acknowledgment like 'That's fantastic feedback' without including the final question." : 
                        "";
                    
                    if (isFirstExchange) {
                        systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant conducting a conversation based on predefined questions. 

Your role is to:
1. Provide a warm, welcoming introduction
2. Explain that you'll be asking questions about their experiences with AI and job interviews
3. Then naturally transition to asking the first question in an interactive, conversational way

IMPORTANT: Do NOT immediately jump into asking the first question. Start with a proper introduction and welcome.

CRITICAL: When asking the predefined questions, be INTERACTIVE and CONVERSATIONAL. Don't just ask the question directly. Instead:
- Show genuine curiosity and interest
- Provide context about why you're asking
- Make it feel like a natural conversation, not an interview
- Ask follow-up questions based on their responses
- Engage with what they share before moving to the next topic

Example of a good first response:
"Hello! Thank you for joining me today. I'm here to have a conversation with you about your experiences with AI and job interviews. I'll be asking you some questions to learn more about how you've used AI tools in your interview preparation process. 

I'm really curious about your background! What was your major or field of study in college or university? I'd love to hear about what drew you to that field and what you found most interesting about it."

Current question context: ${currentQuestion || 'Starting conversation'}

Predefined questions to cover: ${predefinedQuestions.join(', ')}

Remember to be warm, welcoming, and conversational. Provide context about what the conversation will be about before asking your first question.${finalQuestionNote}`;
                    } else {
                        // Check if current question is a background question
                        const isBackground = isBackgroundQuestion(currentQuestion);
                        
                        if (isBackground) {
                            systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant conducting a conversation based on predefined questions. 

You are currently asking a BACKGROUND QUESTION (education, job, or AI experience). 

BACKGROUND QUESTION GUIDELINES:
- These are introductory questions to get basic information
- Be friendly and conversational but move through them quickly
- Do NOT ask extensive follow-up questions for background information
- Focus on getting basic information and transitioning smoothly to more substantive topics
- Keep responses shorter and more direct
- Show interest but don't dig deep - save detailed follow-up for main questions
- After getting a basic answer, move to the next question naturally

CRITICAL: For background questions, be INTERACTIVE but EFFICIENT:
- Show genuine interest but do NOT ask multiple follow-up questions
- Get the basic information and move on
- Use phrases like "That's interesting!", "Thanks for sharing that", "I'd love to hear more about your work"
- Keep the conversation flowing smoothly
- Do NOT ask detailed follow-up questions - just acknowledge and move to next question

Current question context: ${currentQuestion || 'Starting conversation'}

Predefined questions to cover: ${predefinedQuestions.join(', ')}

When you feel you have the basic information about this background question, naturally transition to the next question.

Example of a good background question response:
"That's fascinating! Thanks for sharing that. Now, let me ask you about your current work - what do you do for a living?"

Remember to be warm and conversational but efficient with background questions.${finalQuestionNote}`;
                        } else {
                            systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant conducting a conversation based on predefined questions. 

Your role is to ask the predefined questions naturally and engage in follow-up conversation based on the user's responses. You should:

1. Ask the predefined questions naturally and engage in follow-up conversation based on the user's responses
2. Gradually ask more specific and personal follow-up questions to gather concrete, real stories
3. Show genuine interest in their answers
4. Keep responses concise but engaging
5. Move to the next predefined question when you feel the current topic has been sufficiently explored

CRITICAL: When asking predefined questions, be INTERACTIVE and CONVERSATIONAL:
- Show genuine curiosity and interest in their responses
- Provide context about why you're asking the question
- Make it feel like a natural conversation, not an interview
- Ask follow-up questions based on what they share
- Engage with their responses before moving to the next topic
- Use phrases like "I'm curious about...", "I'd love to hear more about...", "That's interesting! Can you tell me..."
- Don't just ask the question directly - build up to it naturally
- Show enthusiasm and genuine interest in learning about their experiences
- Make the conversation feel warm and engaging, not robotic or formal

Current question context: ${currentQuestion || 'Starting conversation'}

Predefined questions to cover: ${predefinedQuestions.join(', ')}

CONVERSATION FLOW INSTRUCTIONS:
- Always start with the general topic from the predefined question
- Gradually ask more specific and personal follow-up questions to gather concrete, real stories
- The follow-up questions should be more generic and focused on concrete, real experiences
- Example flow: From General topic to Specific experience then to Personal story finally to Real examples
- Generate your own follow-up questions based on the user's responses to gather more specific and personal information

CRITICAL INSTRUCTION: You should naturally engage in conversation about the current question and ask relevant follow-up questions based on the user's responses. 

IMPORTANT: The "NEXT_QUESTION:" prefix is ONLY for internal use to signal question transitions. It should NEVER appear in the final response sent to the user.

When you feel you have gathered sufficient information about the current question and the conversation about this topic feels complete, you MUST indicate that you're moving to the next question by starting your response with "NEXT_QUESTION:" followed by your response.

IMPORTANT: When using "NEXT_QUESTION:", your response should ONLY contain:
- A brief acknowledgment of what the user shared
- A smooth transition to the next question
- The actual next question

DO NOT include any additional follow-up questions or commentary after asking the next question. The "NEXT_QUESTION:" response should be a clean transition to the new topic.

CRITICAL: Your "NEXT_QUESTION:" response must end with the main question. Do not add any additional questions, clarifications, or follow-ups after the main question.

CRITICAL: The "NEXT_QUESTION:" prefix will be automatically removed from the response before it is sent to the user. Do not worry about the prefix appearing in the final output.

Guidelines for when to move to the next question:
- When the user has provided substantial information about the current question
- When the conversation about the current question feels complete and natural
- When you have a good understanding of the user's response to the current question
- When you've had enough meaningful discussion about the current topic
- Trust your judgment - you can move on after just one exchange if the user has given a comprehensive answer, or continue longer if they seem to want to elaborate

Example of a proper "NEXT_QUESTION:" response:
"Thanks for sharing that! Now, let me ask you, what is your occupation?"

NOT like this (which would cause double questions):
"Thanks for sharing that! Now, let me ask you, what is your occupation? Do you enjoy your work?"

CONVERSATION FLOW EXAMPLES:
- Start: "How to use GenAI to prepare for a job interview" (general topic)
- Follow-up: Ask about their specific experiences, such as "What was the first time that you used AI to prepare for a job interview?" or "Can you tell me about a specific tool you've used for interview preparation?"
- Continue with more specific questions about their experience, tools used, outcomes, etc.
- Generate follow-up questions that ask for concrete, personal stories and real examples

The response should be exactly ONE transition sentence followed by ONE main question, nothing more.

Remember to be conversational and ask follow-up questions based on what the user shares. Don't rush through questions, but also don't artificially extend conversations that feel complete.${finalQuestionNote}`;
                        }
                    }
                }

                console.log(`System prompt type: ${isFirstExchange ? 'FIRST_EXCHANGE' : 'REGULAR'}`);

                // Build messages array for OpenAI
                const messages = [
                    { role: 'system', content: systemPrompt }
                ];

                // Add conversation history
                session.conversationHistory.forEach(msg => {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                });

                // If in question mode, add context to help the AI understand the current state
                let userMessage = message;
                if (questionMode && currentQuestion) {
                    // Check if this is the final follow-up of the final question
                    const isFinalFollowUpOfFinalQuestion = isFinalQuestion && followUpMode;
                    
                    const finalQuestionContext = isFinalQuestion ? 
                        (isFinalFollowUpOfFinalQuestion ? 
                            " This is the FINAL follow-up of the FINAL question - after asking your follow-up question, include wrapping-up sentences that explicitly tell the user the study is over and thank them for their participation. Example: 'Thank you so much for sharing all of this with me! I've really enjoyed learning about your experiences with AI and job interviews. This concludes our conversation - thank you for your participation!'" :
                            " This is the FINAL question - engage in natural follow-up conversation with 3-4 questions before ending with a thank you and summary.") : 
                        "";
                    
                    userMessage = `[CONTEXT: Current question is "${currentQuestion}". You are in a conversation flow with predefined questions. Be INTERACTIVE and CONVERSATIONAL - show genuine interest, ask follow-up questions, and engage naturally with their responses. Trust your judgment on when to move to the next question based on the natural flow of conversation.${finalQuestionContext}]\n\nUser: ${message}`;
                    console.log(`Question Mode Context: Current question="${currentQuestion}", Message="${userMessage}"`);
                }

                // Add the current user message
                messages.push({ role: 'user', content: userMessage });

                const completion = await openaiClient.chat.completions.create({
                    model: "gpt-4o",
                    messages: messages,
                    max_tokens: 1000,
                    temperature: 0.8
                });

                aiResponse = completion.choices[0].message.content;
                
                // Check if LLM signaled question completion
                let mainLLMCompleted = false;
                
                // More robust NEXT_QUESTION detection and removal
                const nextQuestionPatterns = [
                    /^NEXT_QUESTION:\s*/i,           // At start with colon
                    /^NEXT_QUESTION\s*/i,            // At start without colon
                    /\bNEXT_QUESTION:\s*/gi,         // Anywhere with colon
                    /\bNEXT_QUESTION\s*/gi           // Anywhere without colon
                ];
                
                for (const pattern of nextQuestionPatterns) {
                    if (pattern.test(aiResponse)) {
                        console.log(`Found NEXT_QUESTION pattern: ${pattern.source}, removing and marking as completed`);
                        aiResponse = aiResponse.replace(pattern, '').trim();
                        mainLLMCompleted = true;
                        break; // Only need to find one pattern
                    }
                }
                
                // Final cleanup: remove any remaining NEXT_QUESTION text that might have been missed
                aiResponse = aiResponse.replace(/\bNEXT_QUESTION\b/gi, '').trim();
                
                if (mainLLMCompleted) {
                    console.log('Question completed via NEXT_QUESTION signal');
                } else if (questionMode && isFinalQuestion) {
                    // Check if the final question response indicates conversation completion
                    const endingPatterns = [
                        /thank you.*sharing.*with me/i,
                        /thank you.*participation/i,
                        /concludes our conversation/i,
                        /conversation.*complete/i,
                        /enjoyed learning about you/i,
                        /thank you.*time/i
                    ];
                    
                    const hasEndingPattern = endingPatterns.some(pattern => pattern.test(aiResponse));
                    if (hasEndingPattern) {
                        mainLLMCompleted = true;
                        console.log('Final question completed via conversation ending signal');
                    }
                }

                // Audit LLM evaluation for question completion and question presence
                if (ENABLE_AUDIT_LLM && questionMode && currentQuestion) {
                    console.log('Calling audit LLM for question completion evaluation...');
                    auditResult = await auditQuestionCompletion(message, aiResponse, currentQuestion, session.conversationHistory, isFinalQuestion, followUpMode);
                    
                    // Check if this is a background question
                    const isBackground = isBackgroundQuestion(currentQuestion);
                    
                    // If audit LLM recommends proceeding and confidence is high enough
                    if (auditResult && auditResult.shouldProceed && auditResult.confidence >= 0.7) {
                        console.log(`Audit LLM recommends proceeding to next question: ${auditResult.reason} (confidence: ${auditResult.confidence})`);
                        
                        // For now, just mark the question as completed and let the frontend handle the next question
                        // The frontend will automatically move to the next question in its flow
                        questionCompleted = true;
                        console.log('Question completed via audit LLM recommendation');
                    } else if (auditResult && !auditResult.shouldProceed && !followUpMode && !isBackground && auditResult.followUpQuestions && auditResult.followUpQuestions.length > 0) {
                        // Audit LLM suggests follow-up questions (only when not already in follow-up mode AND not a background question)
                        console.log(`Audit LLM suggests follow-up questions: ${auditResult.reason} (confidence: ${auditResult.confidence})`);
                        console.log(`Follow-up questions: ${auditResult.followUpQuestions.join(', ')}`);
                        
                        // Send audit feedback back to chatbot LLM to polish the follow-up question
                        const polishedResponse = await polishResponseWithAuditFeedback(
                            message, 
                            aiResponse, 
                            auditResult, 
                            currentQuestion, 
                            session.conversationHistory,
                            isFinalQuestion,
                            followUpMode
                        );
                        
                        if (polishedResponse) {
                            aiResponse = polishedResponse;
                            console.log('Response polished with audit LLM feedback');
                        } else {
                            // Fallback to direct follow-up question if polishing fails
                            const firstFollowUpQuestion = auditResult.followUpQuestions[0];
                            if (firstFollowUpQuestion && typeof firstFollowUpQuestion === 'string' && firstFollowUpQuestion.trim().length > 0) {
                                // Validate that it's actually a question and not reasoning text
                                const questionWords = /\b(What|How|Why|When|Where|Who|Did|Do|Can|Are|Is|Could|Would|Will|Have|Has|Was|Were)\b/i;
                                const endsWithQuestionMark = /\?$/;
                                const isReasoningText = /(reason|confidence|brief explanation|minimal information|detailed response|topic sufficiently explored|follow-up conversation|conversation ready|adequately addressed|thoroughly addressed|audit decision|evaluation criteria|decision guidelines)/i;
                                
                                if ((questionWords.test(firstFollowUpQuestion) || endsWithQuestionMark.test(firstFollowUpQuestion)) && !isReasoningText.test(firstFollowUpQuestion)) {
                                    aiResponse = firstFollowUpQuestion;
                                    console.log('Added follow-up question via audit LLM recommendation');
                                } else {
                                    console.log('First followUpQuestion appears to be reasoning text, using fallback response');
                                    aiResponse = "Could you share a bit more about this topic?";
                                }
                            } else {
                                console.log('No valid followUpQuestions found, using fallback response');
                                aiResponse = "Could you share a bit more about this topic?";
                            }
                        }
                    } else if (auditResult && !auditResult.shouldProceed && isBackground) {
                        // For background questions, force completion even if audit suggests continuing
                        console.log(`Background question - forcing completion despite audit recommendation: ${auditResult.reason}`);
                        questionCompleted = true;
                        console.log('Background question completed (forced)');
                    } else if (auditResult) {
                        console.log(`Audit LLM recommends continuing current question: ${auditResult.reason} (confidence: ${auditResult.confidence})`);
                        
                        // Even when continuing, send audit feedback to improve the response
                        const polishedResponse = await polishResponseWithAuditFeedback(
                            message, 
                            aiResponse, 
                            auditResult, 
                            currentQuestion, 
                            session.conversationHistory,
                            isFinalQuestion,
                            followUpMode
                        );
                        
                        if (polishedResponse) {
                            aiResponse = polishedResponse;
                            console.log('Response polished with audit LLM feedback');
                        }
                    }
                    
                    // Check for question presence in the response
                    console.log('Calling audit LLM for question presence evaluation...');
                    const questionPresenceResult = await auditQuestionPresence(message, aiResponse, currentQuestion, session.conversationHistory, isFinalQuestion, followUpMode);
                    
                    if (questionPresenceResult && questionPresenceResult.shouldRegenerate && questionPresenceResult.confidence >= 0.7) {
                        console.log(`Question presence audit recommends regeneration: ${questionPresenceResult.reason} (confidence: ${questionPresenceResult.confidence})`);
                        
                        // Regenerate the response with explicit instruction to include questions
                        const regeneratedResponse = await regenerateResponseWithQuestions(
                            message, 
                            aiResponse, 
                            currentQuestion, 
                            session.conversationHistory,
                            isFinalQuestion,
                            followUpMode
                        );
                        
                        if (regeneratedResponse) {
                            aiResponse = regeneratedResponse;
                            console.log('Response regenerated with questions via audit LLM recommendation');
                        }
                    } else if (questionPresenceResult) {
                        console.log(`Question presence audit result: ${questionPresenceResult.reason} (confidence: ${questionPresenceResult.confidence})`);
                    }
                }

                // Final decision: prioritize audit LLM decision over main LLM decision
                if (auditResult && auditResult.shouldProceed === false && auditResult.confidence >= 0.7) {
                    // Audit LLM explicitly says not to proceed - respect this decision
                    console.log(`Audit LLM decision takes precedence: ${auditResult.reason} (confidence: ${auditResult.confidence})`);
                    questionCompleted = false;
                } else if (mainLLMCompleted) {
                    // Only use main LLM's decision if audit LLM didn't explicitly say not to proceed
                    console.log('Using main LLM decision to proceed to next question');
                    questionCompleted = true;
                }
                
            } catch (aiError) {
                console.error('AI API error:', aiError);
                console.error('AI API error details:', aiError.message);
                console.error('AI API error stack:', aiError.stack);
                aiResponse = `I apologize, but I'm having trouble processing your request right now. Please try again later. (Error: ${aiError.message})`;
            }
        } else {
            // Fallback response when AI is not available
            if (questionMode && currentQuestion) {
                aiResponse = `Thank you for sharing that information about "${message}". Let me ask you the next question: ${currentQuestion}`;
                questionCompleted = true; // Force completion in fallback mode
            } else {
                aiResponse = `This is a simulated response to: "${message}". In a real implementation, this would be processed by an AI model. To enable real AI responses, please configure a valid OPENAI_API_KEY environment variable.`;
            }
        }
        
        session.conversationHistory.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString(),
            step: step
        });

        // Check if privacy detection is needed (featured mode)
        let privacyDetection = null;
        if (session.currentMode === 'featured') {
            try {
                // Use conversation context for enhanced privacy detection
                privacyDetection = await detectPrivacyWithAI(message, session.conversationHistory);
                if (!privacyDetection || privacyDetection.error) {
                    privacyDetection = detectPrivacyWithPatterns(message, session.conversationHistory);
                }
            } catch (error) {
                console.error('Privacy detection error in chat:', error);
                privacyDetection = detectPrivacyWithPatterns(message, session.conversationHistory);
            }
        }

        // Log question completion status for debugging
        if (questionMode) {
            console.log(`Question completion status: ${questionCompleted}`);
            console.log(`Final AI response being sent: "${aiResponse}"`);
            if (auditResult) {
                console.log(`Audit LLM evaluation: ${JSON.stringify(auditResult)}`);
            }
        }
        
        res.json({
            success: true,
            bot_response: aiResponse,
            conversation_history: session.conversationHistory,
            step: step,
            privacy_detection: privacyDetection,
            question_completed: questionCompleted,
            audit_result: auditResult,
            follow_up_questions: auditResult && auditResult.followUpQuestions ? auditResult.followUpQuestions : null,
            question_presence_audit: questionPresenceResult || null,
            session_id: currentSessionId
        });
    } catch (error) {
        console.error('Chat API error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Privacy Detection API
app.post('/api/privacy_detection', async (req, res) => {
    try {
        const { user_message } = req.body;
        
        if (!user_message) {
            return res.status(400).json({ error: 'User message is required' });
        }

        // Enhanced AI-based privacy detection with conversation context and fallback to pattern matching
        let privacyResult = await detectPrivacyWithAI(user_message, null);
        
        // If AI detection fails, fall back to pattern matching
        if (!privacyResult || privacyResult.error) {
            console.log('AI privacy detection failed, using pattern matching fallback');
            privacyResult = detectPrivacyWithPatterns(user_message, null);
        }
        
        // For simple patterns (names, emails, phones), prefer pattern-based detection for consistency
        const simplePatterns = [
            /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/, // Full Name
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
            /\b\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/, // Phone Number
            /\b\d{3}-\d{2}-\d{4}\b/, // SSN
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/ // Credit Card
        ];
        
        const hasSimplePattern = simplePatterns.some(pattern => pattern.test(user_message));
        if (hasSimplePattern) {
            console.log('Simple pattern detected, using pattern-based detection for consistency');
            privacyResult = detectPrivacyWithPatterns(user_message, null);
        }
        


        res.json(privacyResult);
    } catch (error) {
        console.error('Privacy detection error:', error);
        // Final fallback to pattern matching
        const fallbackResult = detectPrivacyWithPatterns(req.body.user_message, null);
        res.json(fallbackResult);
    }
});

// Audit LLM for Question Completion Evaluation
async function auditQuestionCompletion(userMessage, aiResponse, currentQuestion, conversationHistory, isFinalQuestion = false, followUpMode = false) {
    if (!openaiClient) {
        console.log('⚠️  Audit LLM not available - skipping question completion audit');
        return { shouldProceed: false, reason: 'Audit LLM not available' };
    }

    try {
        const auditPrompt = `You are an impartial auditor evaluating whether a conversation should proceed to the next question.

CURRENT CONTEXT:
- Current Question: "${currentQuestion}"
- User's Latest Response: "${userMessage}"
- AI's Response: "${aiResponse}"
- Is Final Question: ${isFinalQuestion}
- Follow-up Mode: ${followUpMode}
- Is Background Question: ${isBackgroundQuestion(currentQuestion)}

EVALUATION CRITERIA:
1. Has the user provided substantial information about the current question?
2. Has the conversation about this topic reached a natural conclusion?
3. Would moving to the next question feel natural and appropriate?
4. Has the AI gathered enough meaningful information about this topic?

For the final question only:
- Has the AI engaged in sufficient follow-up conversation (3-4 exchanges)?
- Is the conversation ready to conclude naturally?

BACKGROUND QUESTION GUIDELINES:
- Background questions are about: education, current job, and AI experience
- For background questions, be more lenient and allow faster progression
- Brief responses (1-2 sentences) are often sufficient for background questions
- NEVER suggest follow-up questions for background questions - always proceed to next question
- Focus on getting basic information quickly to move to more substantive topics
- Allow proceeding even with moderate responses (2-3 sentences)
- Background questions should be completed efficiently without extensive follow-up

DECISION GUIDELINES:
- If user response is brief (1-2 sentences): 
  * For background questions: shouldProceed = true (allow quick progression)
  * For main questions: shouldProceed = false, suggest follow-up questions
- If user response is moderate (3-4 sentences with some detail): 
  * For background questions: shouldProceed = true (sufficient for background)
  * For main questions: shouldProceed = false, suggest follow-up questions
- If user response is comprehensive (5+ sentences with specific examples): shouldProceed = true
- For final questions: require more follow-up conversation before concluding

FOLLOW-UP MODE GUIDELINES:
When in follow-up mode (Follow-up Mode: true):
- Be more lenient about completing follow-up questions
- Allow completion after 1-2 exchanges for follow-up questions
- Focus on whether the specific follow-up question has been adequately addressed
- Do not suggest additional follow-up questions (since we're already in follow-up mode)

FOLLOW-UP QUESTION GUIDELINES:
When shouldProceed = false AND NOT in follow-up mode AND NOT a background question, you should suggest 1-2 specific follow-up questions that would help gather more information about the current topic. These questions should:
- Be specific and relevant to what the user just shared
- Ask for concrete examples, details, or experiences
- Help deepen the conversation about the current topic
- Be natural and conversational in tone
- Focus on practical experiences and actions rather than personal opinions or feelings
- keep it interactive and engaging
- Ask about specific tools, methods, outcomes, or concrete situations

- MUST be actual questions that start with question words (What, How, Why, When, Where, Who, Did, Do, Can, Are, Is, Could, Would, Will, Have, Has, Was, Were)
- MUST end with a question mark (?)
- MUST NOT contain any reasoning, explanations, or audit decision text
- MUST NOT contain phrases like "User has not yet provided", "need more follow-up questions", "should proceed", "confidence", "reason", etc.

CRITICAL: The followUpQuestions array should contain ONLY actual questions that will be asked to the user. Do NOT include any reasoning, explanations, or audit decision text in the followUpQuestions array.

CRITICAL: NEVER suggest follow-up questions for background questions. Background questions should always proceed to the next question without follow-up.

NOTE: When in follow-up mode, do NOT suggest additional follow-up questions since we're already asking follow-up questions.

RESPONSE FORMAT:
Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{
    "shouldProceed": true/false,
    "reason": "Brief explanation of your decision",
    "confidence": 0.0-1.0,
    "followUpQuestions": ["question1", "question2"] (only include when shouldProceed = false AND NOT in follow-up mode)
}

EXAMPLES:
- Brief response (background question): {"shouldProceed": true, "reason": "Background question adequately answered with basic information, ready to proceed", "confidence": 0.8}
- Brief response (main question): {"shouldProceed": false, "reason": "User provided minimal information, need more follow-up questions", "confidence": 0.8, "followUpQuestions": ["Can you tell me about a specific time when you used AI for interview prep?", "What specific tools or methods did you use?"]}
- Moderate response (background question): {"shouldProceed": true, "reason": "Background question sufficiently answered, ready to move to more substantive topics", "confidence": 0.9}
- Comprehensive response: {"shouldProceed": true, "reason": "User provided detailed response with specific examples, topic sufficiently explored", "confidence": 0.9}
- Final question needs more discussion: {"shouldProceed": false, "reason": "Final question needs more follow-up conversation before concluding", "confidence": 0.7, "followUpQuestions": ["What specific outcomes did you achieve from using AI?", "Can you share another example of how you used AI in your preparation?"]}
- Follow-up mode brief response: {"shouldProceed": true, "reason": "Follow-up question adequately addressed, ready to proceed", "confidence": 0.8}
- Follow-up mode comprehensive response: {"shouldProceed": true, "reason": "Follow-up question thoroughly addressed", "confidence": 0.9}
- Background question with minimal response: {"shouldProceed": true, "reason": "Background question completed efficiently, no follow-up needed", "confidence": 0.8}

IMPORTANT: Notice that the "reason" field contains the explanation, while the "followUpQuestions" array contains ONLY actual questions that will be asked to the user.

IMPORTANT: Never generate follow-up questions that ask about skepticism, doubts, concerns, or negative feelings. Always focus on positive experiences, practical applications, and concrete outcomes.

IMPORTANT: Respond with ONLY the JSON object, no markdown formatting, no code blocks.`;

        const auditMessages = [
            { role: 'system', content: auditPrompt }
        ];

        // Add recent conversation context (last 6 messages for context)
        const recentMessages = conversationHistory.slice(-6);
        if (recentMessages.length > 0) {
            const contextMessage = `Recent conversation context:\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
            auditMessages.push({ role: 'user', content: contextMessage });
        }

        const auditCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: auditMessages,
            max_tokens: 300,
            temperature: 0.3
        });

        const auditResponse = auditCompletion.choices[0].message.content;
        
        // Clean the response to handle markdown code blocks
        let cleanedResponse = auditResponse.trim();
        
        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse the JSON response
        try {
            const auditResult = JSON.parse(cleanedResponse);
            // Filter followUpQuestions to remove any that contain audit reasoning
            if (auditResult && Array.isArray(auditResult.followUpQuestions)) {
                auditResult.followUpQuestions = auditResult.followUpQuestions
                    .filter(q => {
                        if (!q || typeof q !== 'string') return false;
                        
                        // Remove questions that contain audit reasoning patterns
                        const reasoningPatterns = [
                            /^User (has|provided|not yet provided)/i,
                            /^The user (has|provided|not yet provided)/i,
                            /need more follow-up questions/i,
                            /should proceed/i,
                            /confidence:/i,
                            /reason:/i,
                            /brief explanation/i,
                            /minimal information/i,
                            /detailed response/i,
                            /topic sufficiently explored/i,
                            /follow-up conversation/i,
                            /conversation ready/i,
                            /adequately addressed/i,
                            /thoroughly addressed/i,
                            /audit decision/i,
                            /evaluation criteria/i,
                            /decision guidelines/i
                        ];
                        
                        // Check if the question contains any reasoning patterns
                        const hasReasoningPattern = reasoningPatterns.some(pattern => pattern.test(q));
                        if (hasReasoningPattern) return false;
                        
                        // Sanity check: avoid long reasoning text
                        if (q.length > 200) return false;
                        
                        // Must contain question words or end with question mark
                        const questionWords = /\b(What|How|Why|When|Where|Who|Did|Do|Can|Are|Is|Could|Would|Will|Have|Has|Was|Were)\b/i;
                        const endsWithQuestionMark = /\?$/;
                        
                        return questionWords.test(q) || endsWithQuestionMark.test(q);
                    })
                    .map(q => {
                        // Extract the actual question using regex for common question words
                        const match = q.match(/\b(What|How|Why|When|Where|Who|Did|Do|Can|Are|Is|Could|Would|Will|Have|Has|Was|Were)\b.*/i);
                        if (match) {
                            return match[0].trim();
                        }
                        return q.trim();
                    })
                    .filter(q => q && q.length > 0); // Remove empty questions after processing
            }
            console.log(`Audit LLM Result: ${JSON.stringify(auditResult)}`);
            return auditResult;
        } catch (parseError) {
            console.error('Failed to parse audit LLM response:', parseError);
            console.log('Raw audit response:', auditResponse);
            console.log('Cleaned response:', cleanedResponse);
            return { shouldProceed: false, reason: 'Failed to parse audit response', confidence: 0.0 };
        }

    } catch (error) {
        console.error('Audit LLM error:', error);
        return { shouldProceed: false, reason: 'Audit LLM error: ' + error.message, confidence: 0.0 };
    }
}

// Audit LLM for Question Presence Check
async function auditQuestionPresence(userMessage, aiResponse, currentQuestion, conversationHistory, isFinalQuestion = false, followUpMode = false) {
    if (!openaiClient) {
        console.log('⚠️  Audit LLM not available - skipping question presence audit');
        return { hasQuestion: true, reason: 'Audit LLM not available' };
    }

    try {
        const auditPrompt = `You are an impartial auditor evaluating whether a chatbot response includes appropriate questions.

CURRENT CONTEXT:
- Current Question: "${currentQuestion}"
- User's Latest Response: "${userMessage}"
- AI's Response: "${aiResponse}"
- Is Final Question: ${isFinalQuestion}
- Follow-up Mode: ${followUpMode}
- Is Background Question: ${isBackgroundQuestion(currentQuestion)}

EVALUATION CRITERIA:
1. Does the AI response contain at least one question?
2. Is the question relevant to the conversation context?
3. Is the question appropriate for the current stage of the conversation?
4. Does the question help move the conversation forward?

QUESTION PRESENCE GUIDELINES:
- The AI should ask questions to engage the user and gather information
- Questions should be natural and conversational
- Questions should be relevant to the current topic or help transition to the next topic
- For background questions: Questions should be efficient and move quickly to main topics
- For main questions: Questions should be engaging and encourage detailed responses
- For final questions: The AI MUST include the final question in the response before concluding

CRITICAL RULES:
- If followUpMode = true, the response MUST contain questions to guide the conversation forward
- If isFinalQuestion = true AND followUpMode = false AND the response does not contain the final question, it MUST be regenerated
- If isFinalQuestion = true AND followUpMode = true, this is the final follow-up question for a topic, not the final question of the conversation
- For final follow-up questions (followUpMode = true), the AI should still ask follow-up questions to gather more information
- Only for the actual final question of the conversation (followUpMode = false) should summaries be allowed after the question is asked

EXCEPTIONS (when questions are NOT required):
- When the AI is providing a final summary or conclusion AFTER the final question of the entire conversation has been asked (isFinalQuestion = true AND followUpMode = false)
- When the AI is providing wrapping-up sentences in the final follow-up of the final question (isFinalQuestion = true AND followUpMode = true) with explicit thank you and study completion statements
- When the AI is acknowledging information without needing more details (ONLY when NOT in followUpMode)
- When the AI is transitioning between topics without needing user input (ONLY when NOT in followUpMode)

IMPORTANT: 
- If followUpMode = true, questions are ALWAYS required to guide the conversation
- For final questions of the entire conversation (isFinalQuestion = true AND followUpMode = false), the AI MUST still ask the final question before concluding
- For final follow-up questions of a topic (isFinalQuestion = true AND followUpMode = true), the AI should still ask follow-up questions to gather more information
- Only after the final question of the entire conversation has been asked and the user has responded should the AI provide a summary without questions

RESPONSE FORMAT:
Respond with ONLY a JSON object in this exact format (no markdown, no code blocks):
{
    "hasQuestion": true/false,
    "reason": "Brief explanation of your decision",
    "confidence": 0.0-1.0,
    "shouldRegenerate": true/false
}

DECISION GUIDELINES:
- hasQuestion = false AND shouldRegenerate = true: Response lacks questions and should be regenerated
- hasQuestion = true AND shouldRegenerate = false: Response has appropriate questions
- hasQuestion = false AND shouldRegenerate = false: Response doesn't need questions (exception case)

EXAMPLES:
- Response with good question: {"hasQuestion": true, "reason": "Response includes relevant follow-up question", "confidence": 0.9, "shouldRegenerate": false}
- Response without question (needs regeneration): {"hasQuestion": false, "reason": "Response lacks engaging questions to continue conversation", "confidence": 0.8, "shouldRegenerate": true}
- Response without question (final question not asked): {"hasQuestion": false, "reason": "Final question not yet asked, should include the final question", "confidence": 0.9, "shouldRegenerate": true}
- Response without question (follow-up mode): {"hasQuestion": false, "reason": "Follow-up mode requires questions to guide conversation", "confidence": 0.95, "shouldRegenerate": true}
- Response without question (final follow-up question): {"hasQuestion": false, "reason": "Final follow-up question should still include questions to gather more information", "confidence": 0.9, "shouldRegenerate": true}
- Response without question (exception - after final question): {"hasQuestion": false, "reason": "Final summary response after final question was asked, no questions needed", "confidence": 0.9, "shouldRegenerate": false}
- Response without question (exception - final follow-up with wrapping-up): {"hasQuestion": false, "reason": "Final follow-up of final question with proper wrapping-up sentences - study completion allowed", "confidence": 0.9, "shouldRegenerate": false}
- Response with irrelevant question: {"hasQuestion": true, "reason": "Response has question but it's not relevant to current topic", "confidence": 0.7, "shouldRegenerate": true}

IMPORTANT: Respond with ONLY the JSON object, no markdown formatting, no code blocks.`;

        const auditMessages = [
            { role: 'system', content: auditPrompt }
        ];

        // Add recent conversation context (last 4 messages for context)
        const recentMessages = conversationHistory.slice(-4);
        if (recentMessages.length > 0) {
            const contextMessage = `Recent conversation context:\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
            auditMessages.push({ role: 'user', content: contextMessage });
        }

        // Special check for follow-up mode - questions are always required
        if (followUpMode) {
            const questionWords = /\b(What|How|Why|When|Where|Who|Did|Do|Can|Are|Is|Could|Would|Will|Have|Has|Was|Were)\b/i;
            const endsWithQuestionMark = /\?$/;
            const hasQuestion = questionWords.test(aiResponse) || endsWithQuestionMark.test(aiResponse);
            
            if (!hasQuestion) {
                console.log('Follow-up mode detected but response lacks questions - forcing regeneration');
                return {
                    hasQuestion: false,
                    reason: "Follow-up mode requires questions to guide conversation",
                    confidence: 0.95,
                    shouldRegenerate: true
                };
            }
        }

        // Special check for final questions and final follow-up questions
        if (isFinalQuestion && currentQuestion) {
            const questionWords = /\b(What|How|Why|When|Where|Who|Did|Do|Can|Are|Is|Could|Would|Will|Have|Has|Was|Were)\b/i;
            const endsWithQuestionMark = /\?$/;
            const hasQuestion = questionWords.test(aiResponse) || endsWithQuestionMark.test(aiResponse);
            
            // Check if this is the final follow-up of the final question
            const isFinalFollowUpOfFinalQuestion = isFinalQuestion && followUpMode;
            
            // Check for wrapping-up sentences in final follow-up of final question
            const hasWrappingUpSentences = isFinalFollowUpOfFinalQuestion && (
                /thank you.*sharing.*with me/i.test(aiResponse) ||
                /thank you.*participation/i.test(aiResponse) ||
                /concludes our conversation/i.test(aiResponse) ||
                /conversation.*complete/i.test(aiResponse) ||
                /enjoyed learning about you/i.test(aiResponse) ||
                /thank you.*time/i.test(aiResponse) ||
                /study.*over/i.test(aiResponse) ||
                /study.*complete/i.test(aiResponse)
            );
            
            if (!hasQuestion) {
                if (isFinalFollowUpOfFinalQuestion && hasWrappingUpSentences) {
                    console.log('Final follow-up of final question with wrapping-up sentences detected - allowing completion');
                    return {
                        hasQuestion: false,
                        reason: "Final follow-up of final question with proper wrapping-up sentences - study completion allowed",
                        confidence: 0.9,
                        shouldRegenerate: false
                    };
                } else if (followUpMode) {
                    console.log('Final follow-up question detected but response lacks questions - forcing regeneration');
                    return {
                        hasQuestion: false,
                        reason: "Final follow-up question should still include questions to gather more information",
                        confidence: 0.95,
                        shouldRegenerate: true
                    };
                } else {
                    console.log('Final question (7th question) detected but response lacks questions - forcing regeneration');
                    return {
                        hasQuestion: false,
                        reason: "Final question (7th question) not included in response - must regenerate to include the final question",
                        confidence: 0.98,
                        shouldRegenerate: true
                    };
                }
            }
        }

        const auditCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: auditMessages,
            max_tokens: 200,
            temperature: 0.3
        });

        const auditResponse = auditCompletion.choices[0].message.content;
        
        // Clean the response to handle markdown code blocks
        let cleanedResponse = auditResponse.trim();
        
        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse the JSON response
        try {
            const auditResult = JSON.parse(cleanedResponse);
            console.log(`Question Presence Audit Result: ${JSON.stringify(auditResult)}`);
            return auditResult;
        } catch (parseError) {
            console.error('Failed to parse question presence audit response:', parseError);
            console.log('Raw audit response:', auditResponse);
            console.log('Cleaned response:', cleanedResponse);
            return { hasQuestion: true, reason: 'Failed to parse audit response', confidence: 0.0, shouldRegenerate: false };
        }

    } catch (error) {
        console.error('Question presence audit error:', error);
        return { hasQuestion: true, reason: 'Audit LLM error: ' + error.message, confidence: 0.0, shouldRegenerate: false };
    }
}

// Regenerate response with questions
async function regenerateResponseWithQuestions(userMessage, originalResponse, currentQuestion, conversationHistory, isFinalQuestion, followUpMode) {
    if (!openaiClient) {
        console.log('⚠️  OpenAI client not available - skipping response regeneration');
        return null;
    }

    try {
        const regeneratePrompt = `You are a helpful, friendly, and knowledgeable AI assistant. Your task is to regenerate a response that includes appropriate questions to engage the user.

ORIGINAL USER MESSAGE: "${userMessage}"
ORIGINAL AI RESPONSE: "${originalResponse}"
CURRENT QUESTION: "${currentQuestion}"
IS FINAL QUESTION: ${isFinalQuestion}
FOLLOW-UP MODE: ${followUpMode}

AUDIT FEEDBACK: The previous response was missing questions that would help continue the conversation and gather more information from the user.

INSTRUCTIONS:
1. Regenerate a response that includes at least one relevant question
2. Make the question natural and conversational
3. Ensure the question helps gather more information about the current topic
4. Keep the response engaging and interactive
5. Show genuine interest and curiosity
6. Make the conversation feel warm and natural

QUESTION GUIDELINES:
- Ask follow-up questions that invite elaboration
- Questions should be specific and relevant to what the user shared
- Questions should help deepen the conversation
- Use phrases like "I'm curious about...", "I'd love to hear more about...", "That's interesting! Can you tell me..."
- Make questions feel natural and conversational, not robotic

FOLLOW-UP MODE HANDLING:
- When in follow-up mode, you MUST include questions to guide the conversation
- Questions are ALWAYS required in follow-up mode to keep the conversation flowing
- Questions should help gather more detailed information about the current topic
- Keep the conversation engaging and interactive
- Questions should be specific to the user's previous response
- Users need guidance on what to say next - provide clear questions

BACKGROUND QUESTION HANDLING:
- For background questions (education, job, AI experience), be more concise but still ask relevant questions
- Focus on getting basic information efficiently while maintaining engagement
- Questions should help transition smoothly to more substantive topics

FINAL QUESTION HANDLING (7th Question):
- For the final question of the entire conversation (7th question), you MUST include the final question in your response
- The final question should be the main question that was supposed to be asked
- Do NOT provide just an acknowledgment or summary - you MUST ask the question
- After asking the final question, you can include follow-up questions to gather more information
- Questions should help gather comprehensive information before concluding
- Focus on getting detailed responses about the final topic
- CRITICAL: The 7th question is the final question - always include it in your response

FINAL FOLLOW-UP QUESTION HANDLING:
- For final follow-up questions of a topic (followUpMode = true), you should still ask follow-up questions
- These are not the final questions of the conversation, just the final follow-up for the current topic
- Ask engaging follow-up questions to gather more information about the current topic
- Questions should help deepen the conversation about the current subject
- Focus on getting comprehensive information about the current topic before moving to the next main question

FINAL FOLLOW-UP OF FINAL QUESTION HANDLING:
- For the final follow-up of the final question (isFinalQuestion = true AND followUpMode = true), you should include wrapping-up sentences
- After asking your follow-up question, include explicit wrapping-up sentences that tell the user the study is over
- Thank the user for their participation and explicitly state that the conversation is concluding
- Example: "Thank you so much for sharing all of this with me! I've really enjoyed learning about your experiences with AI and job interviews. This concludes our conversation - thank you for your participation!"

IMPORTANT: Your response should be a single, cohesive message that naturally incorporates questions. Do not include multiple separate questions or responses.

Example of a good regenerated response with questions:
"That's fascinating! I can see how your computer science background at MIT would give you a great foundation for understanding AI tools. I'm curious about your first experience with ChatGPT - what made you decide to try it for interview preparation? And what specific aspects of your interview prep did you find it most helpful for?"

Example of a good follow-up mode response:
"It's amazing how that experience with AI during your interview has influenced your day-to-day work. It really highlights how versatile and beneficial these tools can be, not just in interviews, but across various aspects of professional life. I'm curious - what specific ways have you found yourself using AI tools in your daily work routine? And have you noticed any particular improvements in your productivity or problem-solving approach since incorporating AI into your workflow?"

Example of a good final question response (7th question):
"That's really interesting! Now, let me ask you the final question: Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues? I'd love to hear about your experiences with this aspect of AI usage."

Example of a good final follow-up question response:
"That's really interesting! I can see how using AI for interview prep has been quite effective for you. For this final follow-up about your interview preparation, I'd love to hear more about the specific outcomes - what kind of feedback did you receive from interviewers about your responses? And did you notice any particular improvements in your confidence or communication style?"

Example of a good final follow-up of final question response (with wrapping-up):
"That's really interesting! I can see how using AI for interview prep has been quite effective for you. For this final follow-up about your interview preparation, I'd love to hear more about the specific outcomes - what kind of feedback did you receive from interviewers about your responses? And did you notice any particular improvements in your confidence or communication style? Thank you so much for sharing all of this with me! I've really enjoyed learning about your experiences with AI and job interviews. This concludes our conversation - thank you for your participation!"

Please provide a regenerated response that includes appropriate questions:`;

        const regenerateMessages = [
            { role: 'system', content: regeneratePrompt }
        ];

        // Add recent conversation context for better understanding
        const recentMessages = conversationHistory.slice(-4);
        if (recentMessages.length > 0) {
            const contextMessage = `Recent conversation context:\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
            regenerateMessages.push({ role: 'user', content: contextMessage });
        }

        const regenerateCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: regenerateMessages,
            max_tokens: 400,
            temperature: 0.8
        });

        const regeneratedResponse = regenerateCompletion.choices[0].message.content.trim();
        
        // Validate the regenerated response
        if (regeneratedResponse && regeneratedResponse.length > 0 && regeneratedResponse.length < 600) {
            // Check if the regenerated response actually contains a question
            const questionWords = /\b(What|How|Why|When|Where|Who|Did|Do|Can|Are|Is|Could|Would|Will|Have|Has|Was|Were)\b/i;
            const endsWithQuestionMark = /\?$/;
            
            if (questionWords.test(regeneratedResponse) || endsWithQuestionMark.test(regeneratedResponse)) {
                console.log(`Response regenerated successfully with questions: "${regeneratedResponse}"`);
                return regeneratedResponse;
            } else {
                console.log('Regenerated response does not contain questions, using fallback');
                return null;
            }
        } else {
            console.log('Regenerated response validation failed, using original response');
            return null;
        }

    } catch (error) {
        console.error('Response regeneration error:', error);
        return null;
    }
}

// Polish response with audit LLM feedback
async function polishResponseWithAuditFeedback(userMessage, originalResponse, auditResult, currentQuestion, conversationHistory, isFinalQuestion, followUpMode) {
    if (!openaiClient) {
        console.log('⚠️  OpenAI client not available - skipping response polishing');
        return null;
    }

    try {
        const polishPrompt = `You are a helpful, friendly, and knowledgeable AI assistant. Your task is to polish and improve a response based on audit feedback.

ORIGINAL USER MESSAGE: "${userMessage}"
ORIGINAL AI RESPONSE: "${originalResponse}"
CURRENT QUESTION: "${currentQuestion}"
AUDIT FEEDBACK: ${JSON.stringify(auditResult, null, 2)}

AUDIT EVALUATION:
- Should Proceed: ${auditResult.shouldProceed}
- Reason: ${auditResult.reason}
- Confidence: ${auditResult.confidence}
- Follow-up Questions Suggested: ${auditResult.followUpQuestions ? auditResult.followUpQuestions.length : 0}

INSTRUCTIONS:
1. If the audit suggests follow-up questions, incorporate them naturally into your response
2. Make the response more interactive, conversational, and engaging
3. Show genuine interest and curiosity
4. Keep the response concise but warm and natural
5. If the audit indicates the user provided minimal information, ask for more details in a friendly way
6. If the audit suggests continuing the conversation, make your response more engaging
7. Use phrases like "I'm curious about...", "I'd love to hear more about...", "That's interesting! Can you tell me..."

BACKGROUND QUESTION HANDLING:
- For background questions (education, job, AI experience), be more concise and move quickly to the next topic
- Don't ask too many follow-up questions for background information
- Focus on getting basic information and transitioning smoothly to more substantive topics
- Keep background question responses shorter and more direct

RESPONSE GUIDELINES:
- Be conversational and natural, not robotic
- Show enthusiasm and genuine interest
- Ask follow-up questions that invite elaboration
- Make the conversation feel warm and engaging
- Don't just ask the question directly - build up to it naturally
- If suggesting follow-up questions, integrate them smoothly into the conversation

IMPORTANT: Your response should be a single, cohesive message that naturally incorporates the audit feedback. Do not include multiple separate questions or responses.

Example of a good polished response:
"I'm really curious about your experience with AI tools! What first got you interested in using them for interview preparation? I'd love to hear about your journey and what specific tools you've found most helpful."

Please provide a polished, conversational response that incorporates the audit feedback:`;

        const polishMessages = [
            { role: 'system', content: polishPrompt }
        ];

        // Add recent conversation context for better understanding
        const recentMessages = conversationHistory.slice(-4);
        if (recentMessages.length > 0) {
            const contextMessage = `Recent conversation context:\n${recentMessages.map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;
            polishMessages.push({ role: 'user', content: contextMessage });
        }

        const polishCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: polishMessages,
            max_tokens: 300,
            temperature: 0.8
        });

        const polishedResponse = polishCompletion.choices[0].message.content.trim();
        
        // Validate the polished response
        if (polishedResponse && polishedResponse.length > 0 && polishedResponse.length < 500) {
            console.log(`Response polished successfully: "${polishedResponse}"`);
            return polishedResponse;
        } else {
            console.log('Polished response validation failed, using original response');
            return null;
        }

    } catch (error) {
        console.error('Response polishing error:', error);
        return null;
    }
}

// AI-based privacy detection function with conversation context
async function detectPrivacyWithAI(userMessage, conversationContext = null) {
    if (!openaiClient) {
        return { error: 'AI model not available' };
    }

    try {
        // Build context-aware prompt - only consider conversation before and after current message
        let contextInfo = '';
        
        if (conversationContext && conversationContext.length > 0) {
            // Find the current message index in the conversation
            const currentMessageIndex = conversationContext.findIndex(msg => msg.content === userMessage);
            
            if (currentMessageIndex !== -1) {
                // Get messages before and after the current message
                const beforeMessages = conversationContext.slice(0, currentMessageIndex);
                const afterMessages = conversationContext.slice(currentMessageIndex + 1);
                
                // Extract user messages from before and after
                const beforeUserMessages = beforeMessages
                    .filter(msg => msg.role === 'user')
                    .map(msg => msg.content)
                    .slice(-3); // Last 3 messages before
                
                const afterUserMessages = afterMessages
                    .filter(msg => msg.role === 'user')
                    .map(msg => msg.content)
                    .slice(0, 3); // First 3 messages after
                
                if (beforeUserMessages.length > 0 || afterUserMessages.length > 0) {
                    contextInfo = `\n\nCONVERSATION CONTEXT:\n`;
                    if (beforeUserMessages.length > 0) {
                        contextInfo += `Messages before: ${beforeUserMessages.join(' | ')}\n`;
                    }
                    if (afterUserMessages.length > 0) {
                        contextInfo += `Messages after: ${afterUserMessages.join(' | ')}`;
                    }
                }
            }
        }

        // Step 1: Detection LLM - Identify PII and create numbered placeholders
        const detectionPrompt = `You are an expert in cybersecurity and data privacy. You are now
tasked to detect PII from the given text, using the following taxonomy only:

ADDRESS
IP_ADDRESS
URL
SSN
PHONE_NUMBER
EMAIL
DRIVERS_LICENSE
PASSPORT_NUMBER
TAXPAYER_IDENTIFICATION_NUMBER
ID_NUMBER
NAME
USERNAME
KEYS: Passwords, passkeys, API keys, encryption keys, and any
other form of security keys.
GEOLOCATION: Places and locations, such as cities, provinces,
countries, international regions, or named infrastructures
(e.g., bus stops, bridges, etc.).
AFFILIATION: Names of organizations, such as public and private companies, schools, universities, public institutions,
prisons, healthcare institutions, non-governmental organizations, churches, etc. This includes university names like "Carnegie Mellon", "MIT", "Stanford", etc.
DEMOGRAPHIC_ATTRIBUTE: Demographic attributes of a
person, such as native language, descent, heritage, ethnicity,
nationality, religious or political group, birthmarks, ages,
sexual orientation, gender, and sex.
TIME: Description of a specific date, time, or duration.
HEALTH_INFORMATION: Details concerning an individual's
health status, medical conditions, treatment records, and
health insurance information.
FINANCIAL_INFORMATION: Financial details such as bank account numbers, credit card numbers, investment records,
salary information, and other financial statuses or activities.
EDUCATIONAL_RECORD: Educational background details, including academic records, transcripts, degrees, and certifications.

For the given message that a user sends to a chatbot, identify all the personally identifiable information using the above taxonomy only.
Note that the information should be related to a real person not in a public context, but okay if not uniquely identifiable.
Result should be in its minimum possible unit.

IMPORTANT: For each detected PII, assign a numbered placeholder (e.g., NAME1, NAME2, EMAIL1, etc.) that counts across the entire conversation history. The numbering should be sequential across all conversations, not just within a single message. For example, if NAME1 was used in a previous message, the next name should be NAME2.

DUPLICATE ENTITY DETECTION: If you detect the same entity (e.g., "Carnegie Mellon") that was mentioned before, use the same placeholder number. For example, if "Carnegie Mellon" was previously assigned AFFILIATION1, use AFFILIATION1 again for the same entity.

CRITICAL CLASSIFICATION RULES:
- "Carnegie Mellon", "MIT", "Stanford", etc. should be classified as AFFILIATION, not NAME
- Academic fields, majors, and subjects are EDUCATIONAL_RECORD
- Only actual person names (like "John Smith", "Sarah Johnson") should be classified as NAME
- Universities and organizations should be classified as AFFILIATION

Use this exact format:
{
  "privacy_issue": true/false,
  "detected_pii": [
    {
      "type": "PII_CATEGORY",
      "original_text": "exact_text_found",
      "placeholder": "CATEGORY1",
      "explanation": "brief_reason"
    }
  ],
  "text_with_placeholders": "original_text_with_PII_replaced_by_placeholders",
  "affected_text": "comma_separated_list_of_all_detected_texts"
}

If no privacy issues found, respond with:
{
  "privacy_issue": false,
  "detected_pii": [],
  "text_with_placeholders": "original_text_unchanged",
  "affected_text": null
}

Current user message: "${userMessage}"${contextInfo}`;

        // Step 1: Detection LLM - Identify PII and create numbered placeholders
        const detectionCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a privacy detection expert. Analyze messages for privacy and security issues considering conversation context and respond with ONLY valid JSON." },
                { role: "user", content: detectionPrompt }
            ],
            max_tokens: 800,
            temperature: 0.1
        });
        const detectionResponseText = detectionCompletion.choices[0].message.content;
        
        // Clean the detection response text to extract JSON
        let cleanedDetectionResponse = detectionResponseText.trim();
        
        // Remove markdown code blocks if present
        if (cleanedDetectionResponse.startsWith('```json')) {
            cleanedDetectionResponse = cleanedDetectionResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedDetectionResponse.startsWith('```')) {
            cleanedDetectionResponse = cleanedDetectionResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse detection response
        let detectionData;
        try {
            detectionData = JSON.parse(cleanedDetectionResponse);
        } catch (parseError) {
            console.error('Failed to parse AI detection response:', parseError);
            console.error('Original response:', detectionResponseText);
            console.error('Cleaned response:', cleanedDetectionResponse);
            throw new Error('Invalid JSON response from detection AI');
        }
        
        // If no privacy issues detected, return early
        if (!detectionData.privacy_issue || !detectionData.detected_pii || detectionData.detected_pii.length === 0) {
            return {
                privacy_issue: false,
                type: null,
                suggestion: null,
                explanation: null,
                affected_text: null,
                sensitive_text: null
            };
        }
        
        // Update placeholders with conversation-wide numbering and duplicate detection
        let updatedTextWithPlaceholders = detectionData.text_with_placeholders;
        const updatedDetectedPii = [];
        const session = getSession(null); // Use default session for now
        
        for (const pii of detectionData.detected_pii) {
            // Check if this entity was previously detected in the conversation
            const entityKey = `${pii.original_text.toLowerCase().trim()}_${pii.type}`;
            let existingPlaceholder = null;
            
            // Check if we've seen this entity before in the current session
            if (session.detectedEntities && session.detectedEntities[entityKey]) {
                existingPlaceholder = session.detectedEntities[entityKey];
                console.log(`Reusing placeholder ${existingPlaceholder} for duplicate entity: "${pii.original_text}"`);
            }
            
            let newPlaceholder;
            if (existingPlaceholder) {
                // Use the same placeholder for duplicate entities
                newPlaceholder = existingPlaceholder;
            } else {
                // Generate new placeholder for new entity
                const nextNumber = getNextPlaceholderNumber(pii.type);
                newPlaceholder = `${pii.type}${nextNumber}`;
                
                // Track this new entity
                if (!session.detectedEntities) {
                    session.detectedEntities = {};
                }
                session.detectedEntities[entityKey] = newPlaceholder;
                console.log(`Tracking new entity: "${pii.original_text}" -> ${newPlaceholder}`);
            }
            
            // Update the placeholder in the detected PII
            const updatedPii = {
                ...pii,
                placeholder: newPlaceholder
            };
            updatedDetectedPii.push(updatedPii);
            
            // Replace the placeholder in the text
            const oldPlaceholder = pii.placeholder;
            if (oldPlaceholder && oldPlaceholder !== newPlaceholder) {
                const regex = new RegExp(`\\b${oldPlaceholder}\\b`, 'g');
                updatedTextWithPlaceholders = updatedTextWithPlaceholders.replace(regex, newPlaceholder);
            }
        }
        
        // Update the detection data with conversation-wide numbering
        detectionData.detected_pii = updatedDetectedPii;
        detectionData.text_with_placeholders = updatedTextWithPlaceholders;
        
        // Step 2: Abstraction LLM - Create abstracted text with placeholders
        const abstractionPrompt = `Rewrite the text to abstract the protected information, without changing other parts.

For example:
Input: <Text>I graduated from CMU, and I earn a six-figure salary. Today in the office...</Text><ProtectedInformation>CMU,Today</ProtectedInformation>
Output JSON: {"results": [{"protected": "CMU", "abstracted": "MIT"}, {"protected": "Today", "abstracted": "Yesterday"}]}

Current input:
<Text>${detectionData.text_with_placeholders}</Text>
<ProtectedInformation>${detectionData.affected_text}</ProtectedInformation>

Create abstracted text by replacing the protected information with realistic but fake data (not generic terms). Use "results" as the main key in the JSON object with an array of objects containing "protected" and "abstracted" fields.

For example:
- Names: Replace with fake names like "Brian Johnson", "Sarah Williams"
- Emails: Replace with fake emails like "brian.johnson@example.com"
- Phone numbers: Replace with fake numbers like "(555) 123-4567"
- Addresses: Replace with fake addresses like "123 Oak Street, Springfield, IL 62701"
- Universities: Replace with fake universities like "MIT", "Stanford"
- Companies: Replace with fake companies like "TechCorp", "InnovateInc"

Use this exact format:
{"results": [{"protected": "specific_text", "abstracted": "fake_realistic_data"}, {"protected": "another_text", "abstracted": "another_fake_data"}]}`;

        const abstractionCompletion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a privacy abstraction expert. Create abstracted versions of text with PII replaced by generic terms. Respond with ONLY valid JSON." },
                { role: "user", content: abstractionPrompt }
            ],
            max_tokens: 800,
            temperature: 0.1
        });
        const abstractionResponseText = abstractionCompletion.choices[0].message.content;
        
        // Clean the abstraction response text
        let cleanedAbstractionResponse = abstractionResponseText.trim();
        
        // Remove markdown code blocks if present
        if (cleanedAbstractionResponse.startsWith('```json')) {
            cleanedAbstractionResponse = cleanedAbstractionResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedAbstractionResponse.startsWith('```')) {
            cleanedAbstractionResponse = cleanedAbstractionResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Parse abstraction response
        try {
            const abstractionData = JSON.parse(cleanedAbstractionResponse);
            
            // Handle new results array format
            if (abstractionData.results && Array.isArray(abstractionData.results)) {
                const results = abstractionData.results;
                if (results.length > 0) {
                    // Convert results array to the expected format
                    const protectedTexts = results.map(r => r.protected).join(',');
                    const abstractedTexts = results.map(r => r.abstracted).join(',');
                    
                    // Create before/after suggestion
                    let originalText = detectionData.text_with_placeholders;
                    let abstractedText = originalText;
                    
                    // Replace each protected text with its abstracted version
                    results.forEach(result => {
                        const regex = new RegExp(result.protected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        abstractedText = abstractedText.replace(regex, result.abstracted);
                    });
                    
                    return {
                        privacy_issue: true,
                        type: detectionData.detected_pii[0]?.type || 'PII_DETECTED',
                        suggestion: `Before: "${originalText}"\nAfter: "${abstractedText}"`,
                        explanation: `Protected information abstracted: ${protectedTexts}`,
                        affected_text: protectedTexts,
                        sensitive_text: protectedTexts,
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: abstractedText
                        }
                    };
                } else {
                    // No results found
                    return {
                        privacy_issue: false,
                        type: 'NONE',
                        suggestion: 'No PII detected',
                        explanation: 'No sensitive information found',
                        affected_text: '',
                        sensitive_text: '',
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: detectionData.text_with_placeholders
                        }
                    };
                }
            }
            // Fallback to old format for backward compatibility
            else if (typeof abstractionData.privacy_issue === 'boolean') {
                if (abstractionData.privacy_issue === true) {
                    return {
                        privacy_issue: true,
                        type: abstractionData.type || detectionData.detected_pii[0].type,
                        suggestion: abstractionData.suggestion || null,
                        explanation: abstractionData.explanation || detectionData.detected_pii[0].explanation,
                        affected_text: abstractionData.affected_text || detectionData.affected_text,
                        sensitive_text: abstractionData.sensitive_text || detectionData.affected_text,
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: abstractionData.suggestion ? 
                                abstractionData.suggestion.split('\nAfter: "')[1]?.replace(/"/, '') || detectionData.text_with_placeholders :
                                detectionData.text_with_placeholders
                        }
                    };
                } else {
                    // No privacy issues detected
                    return {
                        privacy_issue: false,
                        type: abstractionData.type || 'NONE',
                        suggestion: abstractionData.suggestion || 'No PII detected',
                        explanation: abstractionData.explanation || 'No sensitive information found',
                        affected_text: abstractionData.affected_text || '',
                        sensitive_text: abstractionData.sensitive_text || '',
                        safer_versions: {
                            replacing: detectionData.text_with_placeholders,
                            abstraction: detectionData.text_with_placeholders
                        }
                    };
                }
            } else {
                throw new Error('Invalid abstraction response format');
            }
        } catch (parseError) {
            console.error('Failed to parse AI abstraction response:', parseError);
            console.error('Original response:', abstractionResponseText);
            console.error('Cleaned response:', cleanedAbstractionResponse);
            throw new Error('Invalid JSON response from abstraction AI');
        }
    } catch (error) {
        console.error('AI privacy detection error:', error);
        return { error: error.message };
    }
}

// Enhanced pattern-based privacy detection with conversation context
function detectPrivacyWithPatterns(userMessage, conversationContext = null) {
    const privacyIssues = [];
    const sensitivePatterns = [
        { 
            pattern: /\b\d{3}-\d{2}-\d{4}\b/, 
            type: 'Social Security Number',
            replacement: 'XXX-XX-XXXX',
            explanation: 'SSN detected'
        },
        { 
            pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, 
            type: 'Credit Card Number',
            replacement: '****-****-****-****',
            explanation: 'Credit card number detected'
        },
        { 
            pattern: /\(\d{3}\)\s?\d{3}[-\s]?\d{4}/, 
            type: 'Phone Number',
            replacement: '[Phone Number]',
            explanation: 'Phone number detected'
        },
        { 
            pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, 
            type: 'Email Address',
            replacement: '[Email]',
            explanation: 'Email address detected'
        },
        { 
            pattern: /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/i, 
            type: 'Full Address',
            replacement: '[Address]',
            explanation: 'Full address detected'
        },
        {
            pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
            type: 'Full Name',
            replacement: '[Name]',
            explanation: 'Full name detected'
        },
        {
            pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
            type: 'Date of Birth',
            replacement: '[Date]',
            explanation: 'Date of birth detected'
        }
    ];

    let hasIssues = false;
    let detectedType = null;
    let suggestion = null;
    let explanation = null;
    let affectedText = userMessage;
    let sensitiveText = null;
    let replacingMessage = userMessage;
    let abstractionMessage = userMessage;

    // Find the first matching pattern and create a complete modified message
    for (const { pattern, type, replacement, explanation: patternExplanation } of sensitivePatterns) {
        if (pattern.test(userMessage)) {
            hasIssues = true;
            detectedType = type;
            explanation = patternExplanation;
            
            // Create complete modified message by replacing the sensitive text
            // For better privacy, try to create more natural replacements
            let modifiedMessage = userMessage;
            
            // Handle specific patterns with conversation-wide numbered placeholders for replacing and fake data for abstraction
            
            if (type === 'Full Address') {
                // Replace full address with conversation-wide numbered placeholder and fake address
                const addressNumber = getNextPlaceholderNumber('ADDRESS');
                replacingMessage = userMessage.replace(pattern, `[Address${addressNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '123 Oak Street, Springfield, IL 62701');
            } else if (type === 'Full Name') {
                // Replace full name with conversation-wide numbered placeholder and fake name
                const nameNumber = getNextPlaceholderNumber('NAME');
                replacingMessage = userMessage.replace(pattern, `[Name${nameNumber}]`);
                abstractionMessage = userMessage.replace(pattern, 'Brian Johnson');
            } else if (type === 'Phone Number') {
                // Replace phone number with conversation-wide numbered placeholder and fake number
                const phoneNumber = getNextPlaceholderNumber('PHONE_NUMBER');
                replacingMessage = userMessage.replace(pattern, `[Phone${phoneNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '(555) 123-4567');
            } else if (type === 'Email Address') {
                // Replace email with conversation-wide numbered placeholder and fake email
                const emailNumber = getNextPlaceholderNumber('EMAIL');
                replacingMessage = userMessage.replace(pattern, `[Email${emailNumber}]`);
                abstractionMessage = userMessage.replace(pattern, 'brian.johnson@example.com');
            } else if (type === 'Social Security Number') {
                const ssnNumber = getNextPlaceholderNumber('SSN');
                replacingMessage = userMessage.replace(pattern, `[SSN${ssnNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '123-45-6789');
            } else if (type === 'Credit Card Number') {
                const creditCardNumber = getNextPlaceholderNumber('FINANCIAL_INFORMATION');
                replacingMessage = userMessage.replace(pattern, `[CreditCard${creditCardNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '4111-1111-1111-1111');
            } else if (type === 'Date of Birth') {
                const dateNumber = getNextPlaceholderNumber('TIME');
                replacingMessage = userMessage.replace(pattern, `[Date${dateNumber}]`);
                abstractionMessage = userMessage.replace(pattern, '01/15/1985');
            } else {
                // Use the default replacement for other patterns
                replacingMessage = userMessage.replace(pattern, replacement);
                abstractionMessage = userMessage.replace(pattern, replacement);
            }
            
            modifiedMessage = replacingMessage; // Keep original behavior for suggestion
            
            suggestion = `Before: "${userMessage}"\nAfter: "${modifiedMessage}"`;
            
            // Extract the matched text
            const match = userMessage.match(pattern);
            if (match) {
                affectedText = match[0];
                sensitiveText = match[0];
            }
            break; // Only handle the first match to avoid multiple replacements
        }
    }

    return {
        privacy_issue: hasIssues,
        type: detectedType,
        suggestion: suggestion,
        explanation: explanation,
        affected_text: affectedText,
        sensitive_text: sensitiveText,
        safer_versions: {
            replacing: hasIssues ? replacingMessage : userMessage,
            abstraction: hasIssues ? abstractionMessage : userMessage
        }
    };
}



// Enhanced conversation-wide privacy analysis
async function analyzeConversationPrivacy(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
        return { error: 'No conversation history provided' };
    }

    try {
        // Extract all user messages
        const userMessages = conversationHistory
            .filter(msg => msg.role === 'user')
            .map(msg => msg.content);

        if (userMessages.length === 0) {
            return { error: 'No user messages found in conversation' };
        }

        // Analyze each message with conversation context
        const privacyAnalysis = [];
        let totalIssues = 0;

        for (let i = 0; i < userMessages.length; i++) {
            const message = userMessages[i];
            const context = conversationHistory.slice(0, i + 1); // All messages up to current

            try {
                let privacyResult = await detectPrivacyWithAI(message, context);
                if (!privacyResult || privacyResult.error) {
                    privacyResult = detectPrivacyWithPatterns(message, context);
                }

                if (privacyResult.privacy_issue) {
                    totalIssues++;
                }

                privacyAnalysis.push({
                    message_index: i,
                    message: message,
                    privacy_result: privacyResult
                });
            } catch (error) {
                console.error(`Privacy analysis error for message ${i}:`, error);
                privacyAnalysis.push({
                    message_index: i,
                    message: message,
                    privacy_result: { error: error.message }
                });
            }
        }

        // Generate conversation-wide privacy summary
        const summary = {
            total_messages: userMessages.length,
            messages_with_privacy_issues: totalIssues,
            privacy_risk_level: calculateConversationRiskLevel(totalIssues, userMessages.length),
            recommendations: generatePrivacyRecommendations(privacyAnalysis)
        };

        return {
            success: true,
            conversation_analysis: privacyAnalysis,
            summary: summary
        };

    } catch (error) {
        console.error('Conversation privacy analysis error:', error);
        return { error: error.message };
    }
}

// Calculate overall conversation privacy risk level
function calculateConversationRiskLevel(totalIssues, totalMessages) {
    const issuePercentage = (totalIssues / totalMessages) * 100;

    if (issuePercentage > 50) {
        return 'HIGH';
    } else if (issuePercentage > 25) {
        return 'MEDIUM';
    } else if (issuePercentage > 0) {
        return 'LOW';
    } else {
        return 'NONE';
    }
}

// Generate privacy recommendations based on analysis
function generatePrivacyRecommendations(privacyAnalysis) {
    const recommendations = [];
    const issueTypes = new Set();

    privacyAnalysis.forEach(analysis => {
        if (analysis.privacy_result.privacy_issue) {
            if (analysis.privacy_result.type) {
                issueTypes.add(analysis.privacy_result.type);
            }
        }
    });

    if (issueTypes.has('Social Security Number') || issueTypes.has('Credit Card Number')) {
        recommendations.push('CRITICAL: Immediately remove any SSN or credit card information from the conversation');
    }

    if (issueTypes.has('Full Address')) {
        recommendations.push('HIGH: Consider removing or generalizing specific address information');
    }

    if (issueTypes.has('Phone Number') || issueTypes.has('Email Address')) {
        recommendations.push('MEDIUM: Consider removing contact information to prevent unwanted contact');
    }

    if (issueTypes.has('Full Name')) {
        recommendations.push('LOW: Consider using initials or pseudonyms instead of full names');
    }

    if (recommendations.length === 0) {
        recommendations.push('No immediate privacy concerns detected');
    }

    return recommendations;
}

// Analyze Log API with enhanced conversation-wide privacy analysis
app.post('/api/analyze_log', async (req, res) => {
    try {
        const { conversation_log } = req.body;
        
        if (!conversation_log || !Array.isArray(conversation_log)) {
            return res.status(400).json({ error: 'Valid conversation log is required' });
        }

        // Convert conversation log to conversation history format for analysis
        const conversationHistory = conversation_log.map((msg, index) => ({
            role: msg.user ? 'user' : 'assistant',
            content: msg.user || msg.bot || '',
            timestamp: new Date().toISOString(),
            step: index
        }));

        // Use enhanced conversation-wide privacy analysis
        const privacyAnalysis = await analyzeConversationPrivacy(conversationHistory);
        
        if (privacyAnalysis.error) {
            return res.status(500).json({ error: privacyAnalysis.error });
        }

        // Convert back to the expected format for frontend compatibility
        const analyzedLog = conversation_log.map((msg, index) => {
            const privacyResult = privacyAnalysis.conversation_analysis[index];
            return {
                user: msg.user,
                bot: msg.bot,
                privacy: privacyResult && privacyResult.privacy_result.privacy_issue ? privacyResult.privacy_result : null
            };
        });

        res.json({
            success: true,
            analyzed_log: analyzedLog,
            analysis: privacyAnalysis.summary,
            conversation_analysis: privacyAnalysis.conversation_analysis,
            status: 'completed'
        });
    } catch (error) {
        console.error('Log analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Apply Privacy Correction API
app.post('/api/apply_privacy_correction', (req, res) => {
    try {
        const { message_index, original_text, corrected_text, sessionId } = req.body;
        
        if (message_index === undefined || !original_text || !corrected_text) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Get session
        const currentSessionId = sessionId || generateSessionId();
        const session = getSession(currentSessionId);

        // Update the conversation history with the corrected text
        if (session.conversationHistory[message_index]) {
            session.conversationHistory[message_index].content = corrected_text;
            session.conversationHistory[message_index].corrected = true;
            session.conversationHistory[message_index].original_text = original_text;
        }

        res.json({
            success: true,
            message: 'Correction applied successfully',
            updated_conversation: session.conversationHistory
        });
    } catch (error) {
        console.error('Apply correction error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload Questions API
app.post('/api/upload_questions', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const uploadedQuestions = JSON.parse(fileContent);

        // Clean up uploaded file
        fs.removeSync(req.file.path);

        res.json({
            success: true,
            message: 'Questions uploaded successfully',
            questions_count: uploadedQuestions.length
        });
    } catch (error) {
        console.error('Upload questions error:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

// Upload Return Log API
app.post('/api/upload_return', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const fileContent = fs.readFileSync(req.file.path, 'utf8');
        const uploadedReturnLog = JSON.parse(fileContent);

        // Clean up uploaded file
        fs.removeSync(req.file.path);

        res.json({
            success: true,
            message: 'Return log uploaded successfully',
            log_entries: uploadedReturnLog.length
        });
    } catch (error) {
        console.error('Upload return log error:', error);
        res.status(500).json({ error: 'Failed to process uploaded file' });
    }
});

// Set Mode API
app.post('/api/set_mode', (req, res) => {
    try {
        const { mode } = req.body;
        
        if (!mode) {
            return res.status(400).json({ error: 'Mode is required' });
        }

        currentMode = mode;
        
        res.json({
            success: true,
            message: `Mode set to ${mode}`,
            current_mode: currentMode
        });
    } catch (error) {
        console.error('Set mode error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset API
app.post('/api/reset', (req, res) => {
    try {
        const { sessionId } = req.body;
        
        if (sessionId && sessions.has(sessionId)) {
            // Reset specific session
            const session = sessions.get(sessionId);
            session.conversationHistory = [];
            session.uploadedQuestions = [];
            session.uploadedReturnLog = [];
            session.currentMode = 'chat';
            session.activeChatSession = null;
            
            // Reset PII counters for this session
            Object.keys(session.globalPiiCounters).forEach(key => {
                session.globalPiiCounters[key] = 0;
            });
            
            // Reset detected entities tracking
            session.detectedEntities = {};
            
            console.log(`Reset session: ${sessionId}`);
        } else {
            // Reset all sessions (fallback for backward compatibility)
            sessions.clear();
            console.log('Reset all sessions');
        }
        
        res.json({
            success: true,
            message: 'Conversation and data reset successfully',
            session_id: sessionId
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Conversation Privacy Analysis API
app.post('/api/conversation_privacy_analysis', async (req, res) => {
    try {
        const { conversation_history } = req.body;
        
        if (!conversation_history || !Array.isArray(conversation_history)) {
            return res.status(400).json({ error: 'Valid conversation history is required' });
        }

        // Use enhanced conversation-wide privacy analysis
        const privacyAnalysis = await analyzeConversationPrivacy(conversation_history);
        
        if (privacyAnalysis.error) {
            return res.status(500).json({ error: privacyAnalysis.error });
        }

        res.json({
            success: true,
            analysis: privacyAnalysis
        });
    } catch (error) {
        console.error('Conversation privacy analysis error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export API
app.post('/api/export', (req, res) => {
    try {
        const { export_type, data, sessionId } = req.body;
        
        if (!export_type) {
            return res.status(400).json({ error: 'Export type is required' });
        }

        // Get session for conversation export
        let session = null;
        if (export_type === 'conversation') {
            const currentSessionId = sessionId || generateSessionId();
            session = getSession(currentSessionId);
        }

        let exportData = {};
        
        switch (export_type) {
            case 'conversation':
                exportData = {
                    conversation_history: session ? session.conversationHistory : [],
                    export_timestamp: new Date().toISOString()
                };
                break;
            case 'analysis':
                exportData = {
                    analysis: data,
                    export_timestamp: new Date().toISOString()
                };
                break;
            case 'privacy_report':
                exportData = {
                    privacy_issues: data,
                    export_timestamp: new Date().toISOString()
                };
                break;
            default:
                return res.status(400).json({ error: 'Invalid export type' });
        }

        res.json({
            success: true,
            data: exportData,
            filename: `${export_type}_${new Date().toISOString().split('T')[0]}.json`
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// S3 Upload API
app.post('/api/upload-to-s3', async (req, res) => {
    try {
        const { exportData, prolificId } = req.body;
        
        if (!exportData) {
            return res.status(400).json({ error: 'Export data is required' });
        }

        if (!s3Client) {
            return res.status(500).json({ error: 'S3 client not configured' });
        }

        // Generate unique filename with prolific ID and timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = prolificId ? 
            `${prolificId}_conversation_${timestamp}.json` : 
            `conversation_${timestamp}.json`;

        // Prepare the data for upload
        const jsonData = JSON.stringify(exportData, null, 2);
        
        // Upload to S3
        const uploadParams = {
            Bucket: 'prolificjson',
            Key: filename,
            Body: jsonData,
            ContentType: 'application/json',
            Metadata: {
                'prolific-id': prolificId || 'unknown',
                'upload-timestamp': new Date().toISOString(),
                'conversation-length': exportData.conversation ? exportData.conversation.length.toString() : '0'
            }
        };

        const command = new PutObjectCommand(uploadParams);
        await s3Client.send(command);

        console.log(`✅ Successfully uploaded ${filename} to S3`);

        res.json({
            success: true,
            message: 'File uploaded to S3 successfully',
            filename: filename,
            s3_url: `s3://prolificjson/${filename}`
        });

    } catch (error) {
        console.error('S3 upload error:', error);
        res.status(500).json({ 
            error: 'Failed to upload to S3',
            details: error.message 
        });
    }
});

// API Health Check
app.get('/', (req, res) => {
    res.json({
        message: 'Privacy Demo Backend API is running',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        endpoints: {
            chat: '/api/chat',
            privacy_detection: '/api/privacy_detection',
            test_connection: '/api/test_connection',
            set_mode: '/api/set_mode',
            reset: '/api/reset',
            export: '/api/export',
            generate_user_agent_response: '/api/generate_user_agent_response'
        }
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Privacy Demo Backend API running on port ${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api/*`);
    console.log(`🔍 Health check: http://localhost:${PORT}/`);
});

// User Agent Response Generation API
app.post('/api/generate_user_agent_response', async (req, res) => {
    try {
        const { botMessage, conversationHistory = [], userProfile = null } = req.body;
        
        if (!botMessage || botMessage.trim() === '') {
            return res.status(400).json({ error: 'Bot message is required' });
        }

        if (!openaiClient) {
            return res.status(500).json({ error: 'LLM service not available' });
        }

        // Generate user agent response using LLM
        const userAgentResponse = await generateUserAgentResponse(botMessage, conversationHistory, userProfile);
        
        res.json({
            success: true,
            user_agent_response: userAgentResponse,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('User agent response generation error:', error);
        res.status(500).json({ 
            error: 'Failed to generate user agent response',
            details: error.message 
        });
    }
});

// Helper function to generate user agent response using LLM
async function generateUserAgentResponse(botMessage, conversationHistory = [], userProfile = null) {
    if (!openaiClient) {
        throw new Error('LLM service not available');
    }

    try {
        // Build context from conversation history
        let conversationContext = '';
        if (conversationHistory && conversationHistory.length > 0) {
            const recentMessages = conversationHistory.slice(-6); // Last 6 messages for context
            conversationContext = `\n\nRecent conversation context:\n${recentMessages.map(msg => 
                `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`
            ).join('\n')}`;
        }

        // Build user profile context
        let profileContext = '';
        if (userProfile) {
            profileContext = `\n\nUser Profile:\n${JSON.stringify(userProfile, null, 2)}`;
        }

        const systemPrompt = `You are a helpful AI assistant that generates realistic, personal responses for a user agent in a conversation about AI and job interviews.

Your task is to generate a natural, personal response to the bot's question that feels authentic and conversational. The response should:

1. Be personal and specific - include realistic details about education, work experience, or AI usage
2. Be conversational and natural - not robotic or overly formal
3. Be consistent with any previous responses in the conversation
4. Show genuine interest and engagement with the topic
5. Be appropriate in length (2-4 sentences typically)
6. Include realistic personal details that make sense for the context

IMPORTANT GUIDELINES:
- Generate responses that feel like they come from a real person
- Include specific details like university names, job titles, company names, etc.
- Make responses feel natural and conversational
- Be consistent with the user's background if mentioned before
- Avoid generic or vague responses
- Don't be overly enthusiastic or robotic
- Keep responses authentic and believable

RESPONSE CATEGORIES:
- Education: Include realistic university/college details, majors, experiences
- Work: Include realistic job titles, companies, experiences, timeframes
- AI Experience: Include realistic AI tools, usage patterns, timeframes, experiences
- Interview Preparation: Include realistic interview scenarios, AI usage, outcomes
- AI Concerns: Include realistic worries, privacy concerns, job security concerns
- AI Benefits: Include realistic benefits, time savings, productivity gains

${profileContext}

${conversationContext}

Generate a natural, personal response to this question: "${botMessage}"

Response:`;

        const messages = [
            { role: 'system', content: systemPrompt }
        ];

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            max_tokens: 300,
            temperature: 0.8
        });

        const response = completion.choices[0].message.content.trim();
        
        // Validate the response
        if (!response || response.length === 0) {
            throw new Error('Generated response is empty');
        }

        console.log(`User Agent Response Generated: "${response}"`);
        return response;

    } catch (error) {
        console.error('Error generating user agent response:', error);
        throw error;
    }
} 