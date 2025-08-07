// API Configuration
const API_BASE_URL = 'https://privacydemo.onrender.com';

// Session management
let currentSessionId = null;

// Generate a new session ID
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Get or create session ID
function getSessionId() {
    if (!currentSessionId) {
        currentSessionId = generateSessionId();
    }
    return currentSessionId;
}

// Reset session ID for new conversation
function resetSessionId() {
    currentSessionId = null;
}
const API_ENDPOINTS = {
    CHAT: '/api/chat',
    PRIVACY_DETECTION: '/api/privacy_detection',
    ANALYZE_LOG: '/api/analyze_log',
    APPLY_CORRECTION: '/api/apply_privacy_correction',
    UPLOAD_QUESTIONS: '/api/upload_questions',
    UPLOAD_RETURN: '/api/upload_return',
    TEST_API: '/api/test_connection',
    SET_MODE: '/api/set_mode',
    RESET: '/api/reset',
    EXPORT: '/api/export',
    UPLOAD_TO_S3: '/api/upload-to-s3'
};

// API Utility Functions
class API {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers,
            },
        };

        console.log('🌐 Making API request to:', url);
        console.log('📋 Request config:', config);

        try {
            const response = await fetch(url, config);
            
            console.log('📥 Response status:', response.status);
            console.log('📥 Response headers:', response.headers);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const data = await response.json();
                console.log('📥 Response data:', data);
                return data;
            } else {
                const text = await response.text();
                console.log('📥 Response text:', text);
                return text;
            }
        } catch (error) {
            console.error('❌ API request failed:', error);
            console.error('❌ Request URL:', url);
            console.error('❌ Request config:', config);
            
            // Provide more specific error information
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error(`Network error: Unable to connect to ${API_BASE_URL}. Please check if the server is running and accessible.`);
            }
            
            throw error;
        }
    }

    // Chat API
    static async sendMessage(message, step = 0, additionalParams = {}) {
        const requestBody = {
            message: message,
            step: step,
            sessionId: getSessionId(),
            ...additionalParams
        };
        
        console.log('📤 Sending message to API:', {
            message: message,
            step: step,
            sessionId: getSessionId(),
            additionalParams: additionalParams
        });
        
        try {
            const response = await this.request(API_ENDPOINTS.CHAT, {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });
            
            console.log('📥 API response received:', response);
            return response;
        } catch (error) {
            console.error('❌ API sendMessage error:', error);
            throw error;
        }
    }

    // Privacy Detection API
    static async detectPrivacy(userMessage) {
        return this.request(API_ENDPOINTS.PRIVACY_DETECTION, {
            method: 'POST',
            body: JSON.stringify({
                user_message: userMessage
            })
        });
    }

    // Analyze Conversation Log
    static async analyzeLog(conversationLog) {
        return this.request(API_ENDPOINTS.ANALYZE_LOG, {
            method: 'POST',
            body: JSON.stringify({
                conversation_log: conversationLog
            })
        });
    }

    // Apply Privacy Correction
    static async applyCorrection(messageIndex, originalText, correctedText) {
        return this.request(API_ENDPOINTS.APPLY_CORRECTION, {
            method: 'POST',
            body: JSON.stringify({
                message_index: messageIndex,
                original_text: originalText,
                corrected_text: correctedText,
                sessionId: getSessionId()
            })
        });
    }

    // Upload Questions File
    static async uploadQuestions(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.request(API_ENDPOINTS.UPLOAD_QUESTIONS, {
            method: 'POST',
            headers: {}, // Let browser set Content-Type for FormData
            body: formData
        });
    }

    // Upload Return Log
    static async uploadReturn(file) {
        const formData = new FormData();
        formData.append('file', file);
        
        return this.request(API_ENDPOINTS.UPLOAD_RETURN, {
            method: 'POST',
            headers: {}, // Let browser set Content-Type for FormData
            body: formData
        });
    }

    // Test API Connection
    static async testConnection() {
        console.log('🔍 Testing API connection to:', API_BASE_URL);
        try {
            const response = await this.request(API_ENDPOINTS.TEST_API, {
                method: 'GET'
            });
            console.log('✅ API connection test successful:', response);
            return response;
        } catch (error) {
            console.error('❌ API connection test failed:', error);
            throw error;
        }
    }

    // Set Mode
    static async setMode(mode) {
        return this.request(API_ENDPOINTS.SET_MODE, {
            method: 'POST',
            body: JSON.stringify({
                mode: mode
            })
        });
    }

    // Reset Conversation
    static async resetConversation() {
        return this.request(API_ENDPOINTS.RESET, {
            method: 'POST',
            body: JSON.stringify({
                sessionId: getSessionId()
            })
        });
    }

    // Export Data
    static async exportData(exportType, data = {}) {
        return this.request(API_ENDPOINTS.EXPORT, {
            method: 'POST',
            body: JSON.stringify({
                export_type: exportType,
                data: data,
                sessionId: getSessionId()
            })
        });
    }

    // Upload to S3
    static async uploadToS3(exportData, prolificId) {
        return this.request(API_ENDPOINTS.UPLOAD_TO_S3, {
            method: 'POST',
            body: JSON.stringify({
                exportData: exportData,
                prolificId: prolificId
            })
        });
    }

    // Download File Helper
    static downloadFile(data, filename, mimeType = 'application/json') {
        try {
            console.log('Starting file download:', filename);
            
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            // Add to DOM, click, and remove
            document.body.appendChild(link);
            link.click();
            
            // Clean up
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
            console.log('File download initiated successfully:', filename);
            return true;
        } catch (error) {
            console.error('Download file error:', error);
            
            // Fallback: try alternative download method
            try {
                const blob = new Blob([data], { type: mimeType });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                console.log('Fallback download method used');
                return true;
            } catch (fallbackError) {
                console.error('Fallback download also failed:', fallbackError);
                return false;
            }
        }
    }

    // Error Handler
    static handleError(error, context = '') {
        console.error(`API Error in ${context}:`, error);
        
        let userMessage = 'An error occurred. Please try again.';
        
        if (error.message.includes('Failed to fetch')) {
            userMessage = 'Unable to connect to the server. Please check your internet connection.';
        } else if (error.message.includes('401')) {
            userMessage = 'Authentication failed. Please check your API key.';
        } else if (error.message.includes('403')) {
            userMessage = 'Access denied. Please check your permissions.';
        } else if (error.message.includes('404')) {
            userMessage = 'The requested resource was not found.';
        } else if (error.message.includes('500')) {
            userMessage = 'Server error. Please try again later.';
        } else if (error.message.includes('timeout')) {
            userMessage = 'Request timed out. Please try again.';
        }
        
        return {
            error: true,
            message: userMessage,
            details: error.message
        };
    }

    // Success Response Handler
    static handleSuccess(data, context = '') {
        console.log(`API Success in ${context}:`, data);
        return {
            error: false,
            data: data
        };
    }

    // Retry Logic
    static async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }

    // Batch Operations
    static async batchAnalyze(messages) {
        const results = [];
        const batchSize = 5; // Process 5 messages at a time
        
        for (let i = 0; i < messages.length; i += batchSize) {
            const batch = messages.slice(i, i + batchSize);
            const batchPromises = batch.map(message => 
                this.detectPrivacy(message.user)
            );
            
            try {
                const batchResults = await Promise.all(batchPromises);
                results.push(...batchResults);
            } catch (error) {
                console.error(`Batch analysis failed for batch ${i / batchSize + 1}:`, error);
                // Add empty results for failed batch
                results.push(...new Array(batch.length).fill(null));
            }
        }
        
        return results;
    }

    // Progress Tracking
    static createProgressTracker(total, onProgress) {
        let completed = 0;
        
        return {
            increment: (amount = 1) => {
                completed += amount;
                const progress = Math.min((completed / total) * 100, 100);
                onProgress(progress, completed, total);
            },
            set: (value) => {
                completed = value;
                const progress = Math.min((completed / total) * 100, 100);
                onProgress(progress, completed, total);
            },
            getProgress: () => {
                return {
                    percentage: Math.min((completed / total) * 100, 100),
                    completed,
                    total
                };
            }
        };
    }

    // Validation Helpers
    static validateMessage(message) {
        if (!message || typeof message !== 'string') {
            throw new Error('Message must be a non-empty string');
        }
        
        if (message.trim().length === 0) {
            throw new Error('Message cannot be empty');
        }
        
        if (message.length > 10000) {
            throw new Error('Message is too long (max 10,000 characters)');
        }
        
        return true;
    }

    static validateConversationLog(log) {
        if (!Array.isArray(log)) {
            throw new Error('Conversation log must be an array');
        }
        
        for (const entry of log) {
            if (!entry.user || !entry.bot) {
                throw new Error('Each conversation entry must have user and bot properties');
            }
        }
        
        return true;
    }

    static validateFile(file, allowedTypes = ['.json']) {
        if (!file) {
            throw new Error('No file selected');
        }
        
        const fileName = file.name.toLowerCase();
        const isValidType = allowedTypes.some(type => fileName.endsWith(type));
        
        if (!isValidType) {
            throw new Error(`File type not supported. Allowed types: ${allowedTypes.join(', ')}`);
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
            throw new Error('File size too large (max 10MB)');
        }
        
        return true;
    }
}

// Export for use in other modules
window.API = API; 