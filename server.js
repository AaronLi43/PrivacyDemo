const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// Google Gemini AI
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
let genAI, model;
try {
    if (process.env.GEMINI_API_KEY) {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log('✅ Gemini AI initialized successfully');
    } else {
        console.log('⚠️  GEMINI_API_KEY not found, using fallback responses');
    }
} catch (error) {
    console.log('⚠️  Failed to initialize Gemini AI, using fallback responses:', error.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('frontend'));

// Configure multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Global state (in production, use a proper database)
let conversationHistory = [];
let currentMode = 'chat';
let uploadedQuestions = [];
let uploadedReturnLog = [];
let activeChatSession = null; // Store the active chat session for context

// Helper function to manage conversation context
function manageConversationContext() {
    // Keep track of conversation context without resetting
    // This allows for continuous conversation tracking
    const maxMessages = 1000; // Increased limit to allow longer conversations
    
    if (conversationHistory.length > maxMessages) {
        console.log('Conversation getting very long, keeping context but trimming history for performance');
        
        // Keep only recent messages in history for reference but maintain chat session
        conversationHistory = conversationHistory.slice(-100);
    }
}

// API Routes

// Test API Connection
app.get('/api/test_connection', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'Backend server is running',
        timestamp: new Date().toISOString(),
        conversation_context: {
            has_active_session: activeChatSession !== null,
            message_count: conversationHistory.length,
            current_mode: currentMode
        }
    });
});

// Debug API to show conversation context
app.get('/api/debug_context', (req, res) => {
    res.json({
        conversation_history: conversationHistory,
        active_chat_session: activeChatSession !== null,
        current_mode: currentMode,
        uploaded_questions: uploadedQuestions,
        uploaded_return_log: uploadedReturnLog
    });
});

// Chat API
app.post('/api/chat', async (req, res) => {
    try {
        const { message, step = 0, questionMode = false, currentQuestion = null, predefinedQuestions = [], conversationTurns = 0 } = req.body;
        
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: 'Message is required and cannot be empty' });
        }

        // Add user message to history
        conversationHistory.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
            step: step
        });
        
        console.log(`Chat API: Received message="${message}", questionMode=${questionMode}, currentQuestion="${currentQuestion}", turns=${conversationTurns}`);

        // Manage conversation context (reset if too long)
        manageConversationContext();

        // Generate AI response using Gemini or fallback
        let aiResponse;
        let questionCompleted = false;
        
        if (model) {
            try {
                // Enhanced system prompt for the chatbot with question guidance
                let systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant. Keep your responses short and concise.`;
                
                // If in question mode, enhance the system prompt with predefined questions
                if (questionMode && predefinedQuestions && predefinedQuestions.length > 0) {
                    systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant conducting a conversation based on predefined questions. 

Your role is to ask the predefined questions naturally and engage in follow-up conversation based on the user's responses. You should:

1. Ask the current question naturally and conversationally
2. Based on the user's response, ask relevant follow-up questions to gather more information
3. Show genuine interest in their answers
4. Keep responses concise but engaging
5. Move to the next predefined question after two follow-up questions

Current question context: ${currentQuestion || 'Starting conversation'}

Predefined questions to cover: ${predefinedQuestions.join(', ')}

IMPORTANT: After asking 2 follow-up questions for the current predefined question, you should indicate that you're moving to the next question by starting your response with "NEXT_QUESTION:" followed by your response. This helps the system track progress.

You will receive context about which question you're currently asking and how many turns have been made. Pay attention to this context and move to the next question when appropriate.

Remember to be conversational and ask follow-up questions based on what the user shares.`;
                }

                // Initialize or maintain chat session for conversation context
                if (!activeChatSession) {
                    // Create new chat session with system prompt
                    activeChatSession = model.startChat({
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 1024,
                        },
                    });
                    
                    // Send system prompt to initialize the session
                    await activeChatSession.sendMessage(systemPrompt);
                } else if (questionMode && !activeChatSession) {
                    // Only create new session if one doesn't exist, maintain context otherwise
                    activeChatSession = model.startChat({
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 1024,
                        },
                    });
                    await activeChatSession.sendMessage(systemPrompt);
                }

                // Send user message to existing chat session (maintains context)
                let messageToSend = message;
                
                // Ensure we have a valid message to send
                if (!messageToSend || messageToSend.trim() === '') {
                    messageToSend = "Hello"; // Fallback message
                }
                
                // If in question mode, add context to help the AI understand the current state
                if (questionMode && currentQuestion) {
                    messageToSend = `[CONTEXT: Current question is "${currentQuestion}". This is turn ${conversationTurns} for this question. After 2 follow-up questions, you should move to the next question.]\n\nUser: ${messageToSend}`;
                    console.log(`Question Mode Context: Current question="${currentQuestion}", Turn=${conversationTurns}, Message="${messageToSend}"`);
                }
                
                const result = await activeChatSession.sendMessage(messageToSend);
                aiResponse = result.response.text();
                
                // Check if LLM signaled question completion
                if (questionMode && aiResponse.startsWith('NEXT_QUESTION:')) {
                    questionCompleted = true;
                    aiResponse = aiResponse.replace('NEXT_QUESTION:', '').trim();
                }
                
                // Fallback: If we've had too many exchanges without completion, force move to next question
                if (questionMode && !questionCompleted && conversationTurns >= 6) { // 1 initial + 2 follow-ups = 3 exchanges per question, allow 2 extra
                    questionCompleted = true;
                    console.log('Forcing question completion due to too many exchanges');
                }
                
                // Additional fallback: If this is the first turn and no question was asked, force completion
                if (questionMode && !questionCompleted && conversationTurns === 1 && !aiResponse.toLowerCase().includes('?')) {
                    questionCompleted = true;
                    console.log('Forcing question completion - no question asked on first turn');
                }
                
                // Smart completion detection: If AI response doesn't contain a question and we've had at least 2 turns, complete
                if (questionMode && !questionCompleted && conversationTurns >= 3 && !aiResponse.toLowerCase().includes('?')) {
                    questionCompleted = true;
                    console.log('Forcing question completion - no question in response after multiple turns');
                }
                
            } catch (aiError) {
                console.error('AI API error:', aiError);
                aiResponse = `I apologize, but I'm having trouble processing your request right now. Please try again later. (Error: ${aiError.message})`;
                
                // Only reset chat session on critical errors, not on temporary issues
                if (aiError.message.includes('400 Bad Request') || aiError.message.includes('contents.parts must not be empty')) {
                    console.log('Resetting chat session due to malformed request');
                    activeChatSession = null;
                }
                // For other errors, keep the session to maintain context
            }
        } else {
            // Fallback response when AI is not available
            if (questionMode && currentQuestion) {
                aiResponse = `Thank you for sharing that information about "${message}". Let me ask you the next question: ${currentQuestion}`;
                questionCompleted = true; // Force completion in fallback mode
            } else {
                aiResponse = `This is a simulated response to: "${message}". In a real implementation, this would be processed by an AI model. To enable real AI responses, please configure a valid GEMINI_API_KEY environment variable.`;
            }
        }
        
        conversationHistory.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date().toISOString(),
            step: step
        });

        // Check if privacy detection is needed (featured mode)
        let privacyDetection = null;
        if (currentMode === 'featured') {
            try {
                privacyDetection = await detectPrivacyWithAI(message);
                if (!privacyDetection || privacyDetection.error) {
                    privacyDetection = detectPrivacyWithPatterns(message);
                }
            } catch (error) {
                console.error('Privacy detection error in chat:', error);
                privacyDetection = detectPrivacyWithPatterns(message);
            }
        }

        res.json({
            success: true,
            bot_response: aiResponse,
            conversation_history: conversationHistory,
            step: step,
            privacy_detection: privacyDetection,
            question_completed: questionCompleted
        });
    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Privacy Detection API
app.post('/api/privacy_detection', async (req, res) => {
    try {
        const { user_message } = req.body;
        
        if (!user_message) {
            return res.status(400).json({ error: 'User message is required' });
        }

        // Enhanced AI-based privacy detection with fallback to pattern matching
        let privacyResult = await detectPrivacyWithAI(user_message);
        
        // If AI detection fails, fall back to pattern matching
        if (!privacyResult || privacyResult.error) {
            console.log('AI privacy detection failed, using pattern matching fallback');
            privacyResult = detectPrivacyWithPatterns(user_message);
        }

        res.json(privacyResult);
    } catch (error) {
        console.error('Privacy detection error:', error);
        // Final fallback to pattern matching
        const fallbackResult = detectPrivacyWithPatterns(req.body.user_message);
        res.json(fallbackResult);
    }
});

// AI-based privacy detection function
async function detectPrivacyWithAI(userMessage) {
    if (!model) {
        return { error: 'AI model not available' };
    }

    try {
        const privacyPrompt = `You are a privacy detection expert. Analyze this message for privacy and security issues. Look for:

1. Personal Identifiable Information (PII): names, addresses, phone numbers, SSNs, emails
2. Financial information: credit card numbers, bank accounts, passwords
3. Medical/health information: diagnoses, medications, health conditions
4. Location data: specific addresses, GPS coordinates
5. Credentials: passwords, PINs, access codes
6. Sensitive personal details: birth dates, ID numbers

User message: "${userMessage}"

IMPORTANT: Respond with ONLY raw JSON (no markdown formatting, no code blocks, no explanations). Return a SINGLE object, not an array. Use this exact format:
{"privacy_issue": true/false, "type": "issue_category", "suggestion": "safer_alternative_text", "explanation": "why_this_is_a_privacy_issue", "severity": "high/medium/low", "affected_text": "specific_text_that_poses_risk"}

Examples of privacy issues:
- Credit card numbers (16 digits, often with dashes/spaces)
- SSNs (XXX-XX-XXXX format)
- Full names with other personal info
- Complete addresses
- Phone numbers
- Email addresses with passwords
- Medical diagnoses or conditions
- Bank account numbers

If no privacy issues found, respond with: {"privacy_issue": false, "type": null, "suggestion": null, "explanation": null, "severity": null, "affected_text": null}`;

        const result = await model.generateContent(privacyPrompt);
        const responseText = result.response.text();
        
        // Clean the response text to extract JSON (remove markdown formatting)
        let cleanedResponse = responseText.trim();
        
        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
            cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
            cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to parse JSON response
        try {
            const privacyData = JSON.parse(cleanedResponse);
            
            // Handle both single object and array responses
            let processedData;
            
            if (Array.isArray(privacyData)) {
                console.log(`AI returned array with ${privacyData.length} privacy issues, using the first one`);
                // If AI returns an array of privacy issues, take the first one
                if (privacyData.length > 0) {
                    processedData = privacyData[0];
                } else {
                    // Empty array means no privacy issues
                    processedData = {
                        privacy_issue: false,
                        type: null,
                        suggestion: null,
                        explanation: null,
                        severity: null,
                        affected_text: null
                    };
                }
            } else {
                // Single object response
                processedData = privacyData;
            }
            
            // Validate the response format
            if (typeof processedData.privacy_issue === 'boolean') {
                return {
                    privacy_issue: processedData.privacy_issue,
                    type: processedData.type || null,
                    suggestion: processedData.suggestion || null,
                    explanation: processedData.explanation || null,
                    severity: processedData.severity || 'medium',
                    affected_text: processedData.affected_text || userMessage,
                    detection_method: 'ai'
                };
            } else {
                throw new Error('Invalid privacy_issue field');
            }
        } catch (parseError) {
            console.error('Failed to parse AI privacy response:', parseError);
            console.error('Original response:', responseText);
            console.error('Cleaned response:', cleanedResponse);
            throw new Error('Invalid JSON response from AI');
        }
    } catch (error) {
        console.error('AI privacy detection error:', error);
        return { error: error.message };
    }
}

// Pattern-based privacy detection fallback
function detectPrivacyWithPatterns(userMessage) {
    const privacyIssues = [];
    const sensitivePatterns = [
        { 
            pattern: /\b\d{3}-\d{2}-\d{4}\b/, 
            type: 'Social Security Number',
            severity: 'high',
            suggestion: 'Use "XXX-XX-XXXX" instead',
            explanation: 'Social Security Numbers are highly sensitive personal identifiers that should be redacted'
        },
        { 
            pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, 
            type: 'Credit Card Number',
            severity: 'high',
            suggestion: 'Use "****-****-****-****" instead',
            explanation: 'Credit card numbers are sensitive financial information that should be masked'
        },
        { 
            pattern: /\b\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/, 
            type: 'Phone Number',
            severity: 'medium',
            suggestion: 'Use "(555) 123-4567" format or remove',
            explanation: 'Phone numbers can be used to identify individuals'
        },
        { 
            pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, 
            type: 'Email Address',
            severity: 'medium',
            suggestion: 'Use "user@example.com" instead',
            explanation: 'Email addresses can be used to identify and contact individuals'
        },
        { 
            pattern: /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/i, 
            type: 'Full Address',
            severity: 'high',
            suggestion: 'Use "City, State" format instead',
            explanation: 'Complete addresses can reveal personal location information'
        },
        {
            pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
            type: 'Full Name',
            severity: 'medium',
            suggestion: 'Use "First Name" or "Last Name" instead',
            explanation: 'Full names can be used to identify individuals'
        },
        {
            pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
            type: 'Date of Birth',
            severity: 'high',
            suggestion: 'Use "MM/DD/YYYY" format or remove',
            explanation: 'Birth dates are sensitive personal information'
        },
        {
            pattern: /\b\d{3}-\d{2}-\d{4}\b/,
            type: 'SSN Pattern',
            severity: 'high',
            suggestion: 'Use "XXX-XX-XXXX" format',
            explanation: 'This appears to be a Social Security Number pattern'
        }
    ];

    let hasIssues = false;
    let detectedType = null;
    let suggestion = null;
    let explanation = null;
    let severity = 'medium';
    let affectedText = userMessage;

    sensitivePatterns.forEach(({ pattern, type, severity: patternSeverity, suggestion: patternSuggestion, explanation: patternExplanation }) => {
        if (pattern.test(userMessage)) {
            hasIssues = true;
            detectedType = type;
            suggestion = patternSuggestion;
            explanation = patternExplanation;
            severity = patternSeverity;
            
            // Extract the matched text
            const match = userMessage.match(pattern);
            if (match) {
                affectedText = match[0];
            }
        }
    });

    return {
        privacy_issue: hasIssues,
        type: detectedType,
        suggestion: suggestion,
        explanation: explanation,
        severity: severity,
        affected_text: affectedText,
        detection_method: 'pattern'
    };
}

// Analyze Log API
app.post('/api/analyze_log', async (req, res) => {
    try {
        const { conversation_log } = req.body;
        
        if (!conversation_log || !Array.isArray(conversation_log)) {
            return res.status(400).json({ error: 'Valid conversation log is required' });
        }

        // Analyze each user message for privacy issues
        const analyzedLog = [];
        let privacyIssuesFound = 0;

        for (const message of conversation_log) {
            if (message.user) {
                try {
                    let privacyResult = await detectPrivacyWithAI(message.user);
                    if (!privacyResult || privacyResult.error) {
                        privacyResult = detectPrivacyWithPatterns(message.user);
                    }
                    
                    analyzedLog.push({
                        user: message.user,
                        bot: message.bot,
                        privacy: privacyResult.privacy_issue ? privacyResult : null
                    });

                    if (privacyResult.privacy_issue) {
                        privacyIssuesFound++;
                    }
                } catch (error) {
                    console.error('Privacy analysis error for message:', error);
                    const fallbackResult = detectPrivacyWithPatterns(message.user);
                    analyzedLog.push({
                        user: message.user,
                        bot: message.bot,
                        privacy: fallbackResult.privacy_issue ? fallbackResult : null
                    });
                    
                    if (fallbackResult.privacy_issue) {
                        privacyIssuesFound++;
                    }
                }
            } else {
                analyzedLog.push({
                    user: message.user,
                    bot: message.bot,
                    privacy: null
                });
            }
        }

        const analysis = {
            total_messages: conversation_log.length,
            user_messages: conversation_log.filter(msg => msg.user).length,
            assistant_messages: conversation_log.filter(msg => msg.bot).length,
            privacy_issues_found: privacyIssuesFound,
            recommendations: [
                'Consider implementing end-to-end encryption',
                'Review data retention policies',
                'Ensure GDPR compliance'
            ]
        };

        res.json({
            success: true,
            analyzed_log: analyzedLog,
            analysis: analysis,
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
        const { message_index, original_text, corrected_text } = req.body;
        
        if (message_index === undefined || !original_text || !corrected_text) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Update the conversation history with the corrected text
        if (conversationHistory[message_index]) {
            conversationHistory[message_index].content = corrected_text;
            conversationHistory[message_index].corrected = true;
            conversationHistory[message_index].original_text = original_text;
        }

        res.json({
            success: true,
            message: 'Correction applied successfully',
            updated_conversation: conversationHistory
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
        uploadedQuestions = JSON.parse(fileContent);

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
        uploadedReturnLog = JSON.parse(fileContent);

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
        conversationHistory = [];
        uploadedQuestions = [];
        uploadedReturnLog = [];
        currentMode = 'chat';
        activeChatSession = null; // Reset the chat session to clear context
        
        res.json({
            success: true,
            message: 'Conversation and data reset successfully'
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Export API
app.post('/api/export', (req, res) => {
    try {
        const { export_type, data } = req.body;
        
        if (!export_type) {
            return res.status(400).json({ error: 'Export type is required' });
        }

        let exportData = {};
        
        switch (export_type) {
            case 'conversation':
                exportData = {
                    conversation_history: conversationHistory,
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Serve the thanks page
app.get('/thanks', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'thanks.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at http://localhost:${PORT}`);
}); 