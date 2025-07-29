const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');
require('dotenv').config();

// OpenAI API
const OpenAI = require('openai');

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
        const { message, step = 0, questionMode = false, currentQuestion = null, predefinedQuestions = [], isFinalQuestion = false } = req.body;
        
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
        
        console.log(`Chat API: Received message="${message}", questionMode=${questionMode}, currentQuestion="${currentQuestion}"`);

        // Manage conversation context (reset if too long)
        manageConversationContext();

        // Generate AI response using OpenAI or fallback
        let aiResponse;
        let questionCompleted = false;
        
        if (openaiClient) {
            try {
                // Enhanced system prompt for the chatbot with question guidance
                let systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant. Keep your responses short and concise.`;
                
                // If in question mode, enhance the system prompt with predefined questions
                if (questionMode && predefinedQuestions && predefinedQuestions.length > 0) {
                    const finalQuestionNote = isFinalQuestion ? 
                        "\n\nFINAL QUESTION INSTRUCTIONS: This is the LAST question in the conversation. After asking 1-2 follow-up questions about this topic, you MUST end the conversation. Do NOT use 'NEXT_QUESTION:' for the final question. Instead, provide a natural conclusion that:\n1. Thanks the user for their participation\n2. Briefly summarizes what you've learned about them\n3. Clearly indicates the conversation is complete\n\nCRITICAL: After the user responds to your final follow-up question, you MUST end the conversation with a thank you and summary. Do not ask any more questions.\n\nExample ending: 'Thank you so much for sharing all of this with me! I've really enjoyed learning about your background, your work at MIT, and your love for hiking. You seem like a fascinating person. This concludes our conversation - thank you for your time!'" : 
                        "";
                    
                    systemPrompt = `You are a helpful, friendly, and knowledgeable AI assistant conducting a conversation based on predefined questions. 

Your role is to ask the predefined questions naturally and engage in follow-up conversation based on the user's responses. You should:

1. Ask the current question naturally and conversationally
2. Based on the user's response, ask relevant follow-up questions to gather more information
3. Show genuine interest in their answers
4. Keep responses concise but engaging
5. Move to the next predefined question when you feel the current topic has been sufficiently explored

Current question context: ${currentQuestion || 'Starting conversation'}

Predefined questions to cover: ${predefinedQuestions.join(', ')}

CRITICAL INSTRUCTION: You should naturally engage in conversation about the current question and ask relevant follow-up questions based on the user's responses. 

When you feel you have gathered sufficient information about the current question and the conversation about this topic feels complete, you MUST indicate that you're moving to the next question by starting your response with "NEXT_QUESTION:" followed by your response.

IMPORTANT: When using "NEXT_QUESTION:", your response should ONLY contain:
- A brief acknowledgment of what the user shared
- A smooth transition to the next question
- The actual next question

DO NOT include any additional follow-up questions or commentary after asking the next question. The "NEXT_QUESTION:" response should be a clean transition to the new topic.

CRITICAL: Your "NEXT_QUESTION:" response must end with the main question. Do not add any additional questions, clarifications, or follow-ups after the main question.

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

The response should be exactly ONE transition sentence followed by ONE main question, nothing more.

Remember to be conversational and ask follow-up questions based on what the user shares. Don't rush through questions, but also don't artificially extend conversations that feel complete.${finalQuestionNote}`;
                }

                // Build messages array for OpenAI
                const messages = [
                    { role: 'system', content: systemPrompt }
                ];

                // Add conversation history
                conversationHistory.forEach(msg => {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                });

                // If in question mode, add context to help the AI understand the current state
                let userMessage = message;
                if (questionMode && currentQuestion) {
                    const finalQuestionContext = isFinalQuestion ? 
                        " This is the FINAL question - after sufficient follow-up discussion, you must end the conversation with a thank you and summary." : 
                        "";
                    userMessage = `[CONTEXT: Current question is "${currentQuestion}". You are in a conversation flow with predefined questions. Trust your judgment on when to move to the next question based on the natural flow of conversation.${finalQuestionContext}]\n\nUser: ${message}`;
                    console.log(`Question Mode Context: Current question="${currentQuestion}", Message="${userMessage}"`);
                }

                // Add the current user message
                messages.push({ role: 'user', content: userMessage });

                const completion = await openaiClient.chat.completions.create({
                    model: "gpt-4o",
                    messages: messages,
                    max_tokens: 1000,
                    temperature: 0.7
                });

                aiResponse = completion.choices[0].message.content;
                
                // Check if LLM signaled question completion or conversation ending
                if (questionMode && aiResponse.startsWith('NEXT_QUESTION:')) {
                    questionCompleted = true;
                    aiResponse = aiResponse.replace('NEXT_QUESTION:', '').trim();
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
                        questionCompleted = true;
                        console.log('Final question completed via conversation ending signal');
                    }
                }
                
            } catch (aiError) {
                console.error('AI API error:', aiError);
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

        // Log question completion status for debugging
        if (questionMode) {
            console.log(`Question completion status: ${questionCompleted}`);
            console.log(`Final AI response being sent: "${aiResponse}"`);
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
    if (!openaiClient) {
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

IMPORTANT:
- Respond with ONLY raw JSON (no markdown formatting, no code blocks, no explanations)
- Return a SINGLE object, not an array
- For the "suggestion" field: Provide the safer version in the following format:
  Before: "<original_message>"
  After: "<safer_version>"
- Make the smallest possible modification to remove sensitive information while keeping the message's meaning intact
- Replace specific sensitive details with generic placeholders or safer alternatives

Use this exact format:
{"privacy_issue": true/false, "type": "issue_category", "suggestion": "Before: \"<original>\"\nAfter: \"<safer>\"", "explanation": "brief_reason", "severity": "high/medium/low", "affected_text": "specific_text_that_poses_risk"}

Examples of safer versions:
- Before: "My name is John Smith and I live at 123 Main St"
  After: "My name is [Name] and I live at [Address]"
- Before: "My phone is 555-123-4567"
  After: "My phone is [Phone Number]"
- Before: "My credit card is 1234-5678-9012-3456"
  After: "My credit card is ---"

If no privacy issues found, respond with: {"privacy_issue": false, "type": null, "suggestion": null, "explanation": null, "severity": null, "affected_text": null}`;

        const completion = await openaiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are a privacy detection expert. Analyze messages for privacy and security issues and respond with ONLY valid JSON." },
                { role: "user", content: privacyPrompt }
            ],
            max_tokens: 500,
            temperature: 0.1
        });
        const responseText = completion.choices[0].message.content;
        
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
            replacement: 'XXX-XX-XXXX',
            explanation: 'SSN detected'
        },
        { 
            pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, 
            type: 'Credit Card Number',
            severity: 'high',
            replacement: '****-****-****-****',
            explanation: 'Credit card number detected'
        },
        { 
            pattern: /\b\(?\d{3}\)?[-\s]?\d{3}[-\s]?\d{4}\b/, 
            type: 'Phone Number',
            severity: 'medium',
            replacement: '[Phone Number]',
            explanation: 'Phone number detected'
        },
        { 
            pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, 
            type: 'Email Address',
            severity: 'medium',
            replacement: '[Email]',
            explanation: 'Email address detected'
        },
        { 
            pattern: /\b\d+\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr)\b/i, 
            type: 'Full Address',
            severity: 'high',
            replacement: '[Address]',
            explanation: 'Full address detected'
        },
        {
            pattern: /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
            type: 'Full Name',
            severity: 'medium',
            replacement: '[Name]',
            explanation: 'Full name detected'
        },
        {
            pattern: /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
            type: 'Date of Birth',
            severity: 'high',
            replacement: '[Date]',
            explanation: 'Date of birth detected'
        }
    ];

    let hasIssues = false;
    let detectedType = null;
    let suggestion = null;
    let explanation = null;
    let severity = 'medium';
    let affectedText = userMessage;

    // Find the first matching pattern and create a complete modified message
    for (const { pattern, type, severity: patternSeverity, replacement, explanation: patternExplanation } of sensitivePatterns) {
        if (pattern.test(userMessage)) {
            hasIssues = true;
            detectedType = type;
            severity = patternSeverity;
            explanation = patternExplanation;
            
            // Create complete modified message by replacing the sensitive text
            // For better privacy, try to create more natural replacements
            let modifiedMessage = userMessage;
            
            // Handle specific patterns with more natural replacements
            if (type === 'Full Address') {
                // Replace full address with a more natural description
                modifiedMessage = userMessage.replace(pattern, 'a location in the area');
            } else if (type === 'Full Name') {
                // Replace full name with a more natural description
                modifiedMessage = userMessage.replace(pattern, 'someone');
            } else if (type === 'Phone Number') {
                // Replace phone number with a generic placeholder
                modifiedMessage = userMessage.replace(pattern, '[Phone Number]');
            } else if (type === 'Email Address') {
                // Replace email with a generic placeholder
                modifiedMessage = userMessage.replace(pattern, '[Email]');
            } else {
                // Use the default replacement for other patterns
                modifiedMessage = userMessage.replace(pattern, replacement);
            }
            
            suggestion = `Before: "${userMessage}"\nAfter: "${modifiedMessage}"`;
            
            // Extract the matched text
            const match = userMessage.match(pattern);
            if (match) {
                affectedText = match[0];
            }
            break; // Only handle the first match to avoid multiple replacements
        }
    }

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