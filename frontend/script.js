// Main Application Class
class PrivacyDemoApp {
    constructor() {
        this.state = {
            mode: 'naive',
            conversationLog: [],
            currentStep: 0,
            questions: [],
            analyzedLog: [],
            privacyChoices: {},
            showPrivacyAnalysis: false,
            editMode: false,
            editableLog: [],
            originalLog: [],
            conversationHeight: 400,
            apiConnected: false,
            sidebarHidden: false,
            consentGiven: false,
            pendingExportAction: null,
            // New properties for featured mode
            realTimeDetection: false,
            privacyDetectionQueue: [],
            isDetecting: false,
            // Question management properties
            currentQuestionIndex: 0,
            questionsCompleted: false,
            questionMode: false,
            predefinedQuestionsCompleted: 0, // Track completed predefined questions
            conversationTurnsForCurrentQuestion: 0, // Track turns for current question
            // Prolific ID for user identification
            prolificId: null,
            prolificIdSubmitted: false,
            // Survey data
            surveyData: {},
            surveyCompleted: false,
            predefinedQuestions: {
                naive: [
                    "What is your name?",
                    "How old are you?",
                    "Where do you live?",
                    "What is your occupation?",
                    "Do you have any hobbies?"
                ],
                neutral: [
                    "What is your name?",
                    "How old are you?",
                    "Where do you live?",
                    "What is your occupation?",
                    "Do you have any hobbies?"
                ],
                featured: [
                    "What is your name?",
                    "How old are you?",
                    "Where do you live?",
                    "What is your occupation?",
                    "Do you have any hobbies?"
                ]
            }
        };

        this.init();
    }

    // Initialize the application
    init() {
        this.bindEvents();
        this.updateUI();
        this.updateSidebarToggle();
        this.checkAPIStatus();
        this.loadFromLocalStorage();
        
        // Show Prolific ID popup if not submitted yet
        if (!this.state.prolificIdSubmitted || !this.state.prolificId) {
            this.showProlificIdPopup();
        }
    }

    // Bind all event listeners
    bindEvents() {
        // Mode selection
        document.getElementById('mode-select').addEventListener('change', (e) => {
            this.setMode(e.target.value);
        });

        // File uploads
        // document.getElementById('questions-file').addEventListener('change', (e) => {
        //     this.handleQuestionsUpload(e.target.files[0]);
        // });

        // document.getElementById('return-file').addEventListener('change', (e) => {
        //     this.handleReturnUpload(e.target.files[0]);
        // });

        // Action buttons
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetConversation();
        });

        document.getElementById('exit-edit-btn').addEventListener('click', () => {
            this.exitEditMode();
        });

        document.getElementById('show-congratulation-btn').addEventListener('click', () => {
            this.showCongratulationPopup();
        });

        // Test export button (for debugging)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 't') {
                console.log('Test export triggered');
                this.exportDirect();
            }
        });

        // Main export buttons (in chat input area)
        document.getElementById('edit-export-btn-main').addEventListener('click', () => {
            if (this.state.editMode) {
                this.showSurveyPopup('exportDirect');
            } else {
                this.enterEditMode();
            }
        });

        document.getElementById('export-direct-btn-main').addEventListener('click', () => {
            this.showSurveyPopup('exportDirect');
        });

        document.getElementById('analyze-export-btn-main').addEventListener('click', () => {
            if (this.state.mode === 'featured') {
                this.showSurveyPopup('exportComprehensive');
            } else {
                this.showConsentPopup('analyzeAndExport');
            }
        });

        document.getElementById('edit-export-btn').addEventListener('click', () => {
            if (this.state.editMode) {
                this.showConsentPopup('exportDirect');
            } else {
                this.enterEditMode();
            }
        });

        document.getElementById('export-direct-btn').addEventListener('click', () => {
            this.exportDirect();
        });

        document.getElementById('analyze-export-btn').addEventListener('click', () => {
            this.showConsentPopup('analyzeAndExport');
        });

        // Chat input with real-time privacy detection
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        const chatInput = document.getElementById('chat-input');
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Real-time privacy detection for featured mode
        chatInput.addEventListener('input', (e) => {
            if (this.state.mode === 'featured') {
                this.handleRealTimePrivacyDetection(e.target.value);
            }
        });

        // API test
        document.getElementById('test-api-btn').addEventListener('click', () => {
            this.testAPIConnection();
        });

        // Sidebar toggle
        document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Privacy analysis buttons
        document.getElementById('export-comprehensive').addEventListener('click', () => {
            this.exportComprehensive();
        });

        // Privacy tooltip events
        document.getElementById('tooltip-apply-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.applyTooltipSuggestion();
        });

        document.getElementById('tooltip-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hidePrivacyTooltip();
        });

        // Privacy popup (legacy)
        document.addEventListener('click', (e) => {
            const privacyError = e.target.closest('.privacy-error');
            if (privacyError) {
                e.preventDefault();
                this.showPrivacyPopup(privacyError);
            }
        });

        // Close popup on outside click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'privacy-popup') {
                this.closePrivacyPopup();
            }
        });

        // Consent popup events
        document.getElementById('consent-agree-btn').addEventListener('click', () => {
            this.handleConsentResponse(true);
        });

        document.getElementById('consent-decline-btn').addEventListener('click', () => {
            this.handleConsentResponse(false);
        });

        // Close consent popup on outside click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'consent-popup') {
                this.closeConsentPopup();
            }
        });

        // Prolific ID popup events
        document.getElementById('prolific-id-submit-btn').addEventListener('click', () => {
            this.handleProlificIdSubmit();
        });

        // Close prolific ID popup on outside click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'prolific-id-popup') {
                this.closeProlificIdPopup();
            }
        });

        // Prolific ID input enter key
        document.getElementById('prolific-id-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleProlificIdSubmit();
            }
        });

        // Congratulation popup events
        document.getElementById('next-stage-btn').addEventListener('click', () => {
            this.handleNextStage();
        });

        // Close congratulation popup on outside click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'congratulation-popup') {
                this.closeCongratulationPopup();
            }
        });

        // Survey popup events
        document.getElementById('survey-form').addEventListener('submit', (e) => {
            e.preventDefault();
            console.log('Survey form submitted');
            this.handleSurveySubmit();
        });

        // Close survey popup on outside click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'survey-popup') {
                this.closeSurveyPopup();
            }
        });

        // Debug: Manual next question button (for testing)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'n' && this.state.questionMode) {
                e.preventDefault();
                console.log('Manual next question triggered');
                this.state.currentQuestionIndex++;
                this.state.predefinedQuestionsCompleted++;
                this.state.conversationTurnsForCurrentQuestion = 0;
                
                if (this.state.predefinedQuestionsCompleted >= this.state.predefinedQuestions[this.state.mode].length) {
                    this.state.questionsCompleted = true;
                    this.state.questionMode = false;
                    this.showCongratulationPopup();
                } else {
                    this.showNotification('Manual: Moved to next question', 'info');
                }
                this.updateUI();
            }
        });

        // Debug: Test survey submission (Ctrl+T)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 't') {
                e.preventDefault();
                console.log('Test survey submission triggered');
                this.state.pendingExportAction = 'exportDirect';
                this.handleSurveySubmit();
            }
        });

        // Debug: Test consent and survey flow (Ctrl+C)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                console.log('Test consent and survey flow triggered');
                this.showSurveyPopup('exportDirect');
            }
        });

        // Privacy analysis filter toggle
        const filterToggle = document.getElementById('privacy-filter-toggle');
        if (filterToggle) {
            filterToggle.addEventListener('change', () => {
                this.updateConversationDisplay(true);
            });
        }
    }

    // Set application mode
    async setMode(mode) {
        this.state.mode = mode;
        this.state.editMode = false; // Disable edit mode when changing modes
        this.state.editableLog = [];
        this.state.analyzedLog = [];
        this.state.showPrivacyAnalysis = false;
        this.state.privacyChoices = {};
        
        // Enable/disable real-time detection based on mode
        this.state.realTimeDetection = (mode === 'featured');
        
        // Clear any existing real-time detection
        this.clearRealTimeDetection();

        // Initialize question mode
        this.state.currentQuestionIndex = 0;
        this.state.questionsCompleted = false;
        this.state.questionMode = true;
        this.state.predefinedQuestionsCompleted = 0; // Reset predefined questions counter
        this.state.conversationTurnsForCurrentQuestion = 0; // Reset conversation turns counter
        this.state.conversationLog = []; // Clear conversation when changing modes
        
        // Start the conversation with the first question from LLM
        await this.startQuestionConversation();

        // Skip API call for mode setting - focus on frontend functionality
        this.updateModeInfo();
        this.updateUI();
        this.saveToLocalStorage();
    }

    // Start question conversation with LLM
    async startQuestionConversation() {
        try {
            this.showLoading(true);
            
            const currentQuestion = this.state.predefinedQuestions[this.state.mode][this.state.currentQuestionIndex];
            const predefinedQuestions = this.state.predefinedQuestions[this.state.mode];
            
            // Send initial message to start the conversation
            const response = await API.sendMessage("Hello, I'm ready to answer your questions.", this.state.currentStep, {
                questionMode: true,
                currentQuestion: currentQuestion,
                predefinedQuestions: predefinedQuestions
            });
            
            if (response && response.bot_response) {
                this.state.conversationLog.push({
                    user: '',
                    bot: response.bot_response,
                    timestamp: new Date().toISOString()
                });
            }
            
            this.updateUI();
            this.scrollToBottom();
            this.showLoading(false);
            
        } catch (error) {
            console.error('Error starting question conversation:', error);
            this.showLoading(false);
        }
    }

    // Update mode information display
    updateModeInfo() {
        const modeInfo = document.getElementById('mode-info');
        const modeIcons = {
            naive: '😊',
            neutral: '⚖️',
            featured: '🔒'
        };
        const modeDescriptions = {
            naive: '💡 Naive Mode: You can edit your conversation log before exporting!',
            neutral: '⚖️ Neutral Mode: Privacy analysis runs when you export the conversation log!',
            featured: '🔒 Featured Mode: Real-time privacy detection with interactive corrections!'
        };
        
        modeInfo.innerHTML = `<p><strong>${modeIcons[this.state.mode]} ${modeDescriptions[this.state.mode]}</strong></p>`;
        document.getElementById('stat-mode').textContent = `${modeIcons[this.state.mode]} ${this.state.mode.charAt(0).toUpperCase() + this.state.mode.slice(1)}`;
    }

    // Show congratulation popup when all questions are completed
    showCongratulationPopup() {
        const popup = document.getElementById('congratulation-popup');
        const popupTitle = document.getElementById('congratulation-title');
        const popupMessage = document.getElementById('congratulation-message');
        const nextStageBtn = document.getElementById('next-stage-btn');
        
        // Set appropriate message based on mode
        const modeMessages = {
            naive: {
                title: '🎉 Questions Completed!',
                message: 'Great job! You\'ve completed all the questions. You can now edit your conversation and export it.',
                buttonText: 'Enter Edit Mode'
            },
            neutral: {
                title: '🎉 Questions Completed!',
                message: 'Great job! You\'ve completed all the questions. You can now export your conversation for privacy analysis.',
                buttonText: 'Enter Edit Mode'
            },
            featured: {
                title: '🎉 Questions Completed!',
                message: 'Great job! You\'ve completed all the questions. You can now analyze and export your conversation with privacy detection.',
                buttonText: 'Analyze & Export'
            }
        };
        
        const currentModeMessage = modeMessages[this.state.mode];
        popupTitle.textContent = currentModeMessage.title;
        popupMessage.textContent = currentModeMessage.message;
        nextStageBtn.innerHTML = `<i class="fas fa-arrow-right"></i> ${currentModeMessage.buttonText}`;
        
        popup.style.display = 'flex';
    }

    // Handle next stage button click
    handleNextStage() {
        const popup = document.getElementById('congratulation-popup');
        popup.style.display = 'none';
        
        if (this.state.mode === 'featured') {
            // For featured mode, trigger analyze and export functionality
            this.showNotification('🔍 Starting privacy analysis...', 'info');
            this.analyzeAndExport();
        } else {
            // For naive and neutral modes, enter edit mode
            this.enterEditMode();
            this.showNotification('✏️ Edit mode enabled - You can now edit your conversation!', 'success');
        }
    }

    // Close congratulation popup
    closeCongratulationPopup() {
        const popup = document.getElementById('congratulation-popup');
        popup.style.display = 'none';
    }

    // Handle real-time privacy detection for featured mode
    async handleRealTimePrivacyDetection(text) {
        if (!this.state.realTimeDetection || !text.trim()) {
            this.clearRealTimeDetection();
            return;
        }

        // Debounce the detection to avoid too many API calls
        clearTimeout(this.detectionTimeout);
        this.detectionTimeout = setTimeout(async () => {
            await this.performRealTimeDetection(text);
        }, 500); // 500ms delay
    }

    // Perform real-time privacy detection
    async performRealTimeDetection(text) {
        try {
            const response = await fetch('/api/privacy_detection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ user_message: text })
            });

            if (response.ok) {
                const result = await response.json();
                // Only use the actual API response for privacy detection
                if (result.privacy_issue) {
                    this.displayRealTimePrivacyIssues(text, result);
                } else {
                    this.clearRealTimeDetection();
                }
            } else {
                // Only fallback if the API is unreachable or returns an error
                this.clearRealTimeDetection();
            }
        } catch (error) {
            console.error('Real-time privacy detection error:', error);
            // Fallback to client-side detection ONLY if API is unreachable
            // (Optional: you can remove the fallback entirely if strict API-only is desired)
            // this.displayRealTimePrivacyIssues(text, this.clientSidePatternDetection(text));
            this.clearRealTimeDetection();
        }
    }

    // Display real-time privacy issues in the input field
    displayRealTimePrivacyIssues(text, privacyResult) {
        const chatInput = document.getElementById('chat-input');
        
        if (!privacyResult.privacy_issue) {
            this.clearRealTimeDetection();
            return;
        }

        // No highlight: just show warning
        this.showRealTimeWarning(privacyResult);
    }

    // Show real-time warning indicator
    showRealTimeWarning(privacyResult) {
        // Create warning indicator (disabled - no notification shown)
        // const warning = document.createElement('div');
        // warning.id = 'realtime-warning';
        // warning.style.position = 'fixed';
        // warning.style.top = '20px';
        // warning.style.right = '20px';
        // warning.style.backgroundColor = '#dc3545';
        // warning.style.color = 'white';
        // warning.style.padding = '10px 15px';
        // warning.style.borderRadius = '8px';
        // warning.style.zIndex = '1000';
        // warning.style.fontSize = '14px';
        // warning.style.fontWeight = 'bold';
        // warning.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
        // warning.style.animation = 'slideIn 0.3s ease-out';
        // warning.innerHTML = `
        //     <i class="fas fa-exclamation-triangle"></i>
        //     Privacy Issue Detected: ${privacyResult.type}
        //     <button onclick="window.app.clearRealTimeDetection()" style="background: none; border: none; color: white; margin-left: 10px; cursor: pointer;">
        //         <i class="fas fa-times"></i>
        //     </button>
        // `;

        // document.body.appendChild(warning);
    }

    // Clear real-time detection
    clearRealTimeDetection() {
        // Remove overlay
        if (this.state.realTimeOverlay && typeof this.state.realTimeOverlay.remove === 'function') {
            this.state.realTimeOverlay.remove();
            this.state.realTimeOverlay = null;
        } else {
            this.state.realTimeOverlay = null;
        }

        // Remove warning
        const warning = document.getElementById('realtime-warning');
        if (warning) {
            warning.remove();
        }

        // Clear timeout
        if (this.detectionTimeout) {
            clearTimeout(this.detectionTimeout);
            this.detectionTimeout = null;
        }
    }

    // Escape regex special characters
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // Set conversation height


    // Toggle sidebar visibility
    toggleSidebar() {
        this.state.sidebarHidden = !this.state.sidebarHidden;
        this.updateSidebarToggle();
        this.saveToLocalStorage();
    }

    // Update sidebar toggle button and container state
    updateSidebarToggle() {
        const container = document.querySelector('.container');
        const toggleBtn = document.getElementById('toggle-sidebar-btn');
        
        if (this.state.sidebarHidden) {
            container.classList.add('sidebar-hidden');
            toggleBtn.innerHTML = '<i class="fas fa-eye"></i><span> Show Config</span>';
        } else {
            container.classList.remove('sidebar-hidden');
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i><span> Hide Config</span>';
        }
    }

    // Handle questions file upload
    // async handleQuestionsUpload(file) {
    //     if (!file) return;

    //     try {
    //         API.validateFile(file, ['.json']);
        
    //         // Mock API response for questions upload
    //         setTimeout(() => {
    //             this.state.questions = [
    //                 "What is your name?",
    //                 "What is your email address?",
    //                 "What is your phone number?"
    //             ];
    //             this.showNotification(`✅ Loaded ${this.state.questions.length} questions`, 'success');
    //             this.saveToLocalStorage();
    //         }, 500);
        
    //     } catch (error) {
    //         console.error('Questions upload error:', error);
    //         this.showNotification(`❌ Error loading file: ${error.message}`, 'error');
    //     }
    // }

    // Handle return log upload
    // async handleReturnUpload(file) {
    //     if (!file) return;

    //     try {
    //         API.validateFile(file, ['.json']);
        
    //         // Mock API response for return upload
    //         setTimeout(() => {
    //             this.showNotification('✅ Thank you! Your file has been received.', 'success');
    //         }, 500);
        
    //     } catch (error) {
    //         console.error('Return upload error:', error);
    //         this.showNotification(`❌ Error uploading file: ${error.message}`, 'error');
    //     }
    // }

    // Reset conversation
    async resetConversation() {
        try {
            this.showLoading(true);
            
            // Reset conversation state
            this.state.conversationLog = [];
            this.state.currentStep = 0;
            this.state.analyzedLog = [];
            this.state.showPrivacyAnalysis = false;
            this.state.privacyChoices = {};
            this.state.editMode = false;
            this.state.editableLog = [];
            this.state.originalLog = [];
            this.state.consentGiven = false;
            this.state.pendingExportAction = null;
            
            // Reset question mode
            this.state.currentQuestionIndex = 0;
            this.state.questionsCompleted = false;
            this.state.questionMode = true;
            this.state.predefinedQuestionsCompleted = 0; // Reset predefined questions counter
            this.state.conversationTurnsForCurrentQuestion = 0; // Reset conversation turns counter
            
            // Reset Prolific ID state
            this.state.prolificId = null;
            this.state.prolificIdSubmitted = false;
            
            // Reset survey data
            this.state.surveyData = {};
            this.state.surveyCompleted = false;
            
            // Clear real-time detection
            this.clearRealTimeDetection();
            
            // Start asking questions again with LLM
            await this.startQuestionConversation();
            
            this.updateUI();
            this.saveToLocalStorage();
            this.showLoading(false);
            
            this.showNotification('🔄 Conversation reset successfully', 'success');
        } catch (error) {
            console.error('Reset error:', error);
            this.showNotification('❌ Reset failed', 'error');
            this.showLoading(false);
        }
    }

    // Send message
    async sendMessage() {
        // Check if Prolific ID has been submitted
        if (!this.state.prolificIdSubmitted) {
            this.showNotification('Please enter your Prolific ID first to continue.', 'warning');
            this.showProlificIdPopup();
            return;
        }

        const input = document.getElementById('chat-input');
        const message = input.value.trim();
        
        if (!message) return;

        // Clear real-time detection when sending message
        this.clearRealTimeDetection();

        try {
            API.validateMessage(message);
            
            // Add user message to log
            this.state.conversationLog.push({
                user: message,
                bot: '',
                timestamp: new Date().toISOString()
            });

            this.state.currentStep++;
            input.value = '';
            this.updateUI();
            this.showLoading(true);

            // Handle question mode
            if (this.state.questionMode) {
                // In question mode, send to backend with question parameters
                try {
                    const lastMessage = this.state.conversationLog[this.state.conversationLog.length - 1];
                    
                    // Get the current question - this should be the correct one for this turn
                    let currentQuestion = this.state.predefinedQuestions[this.state.mode][this.state.currentQuestionIndex];
                    const predefinedQuestions = this.state.predefinedQuestions[this.state.mode];
                    
                    // Increment conversation turns for current question
                    this.state.conversationTurnsForCurrentQuestion++;
                    
                    console.log(`Frontend: Sending question ${this.state.currentQuestionIndex + 1}/${predefinedQuestions.length}: "${currentQuestion}" (turn ${this.state.conversationTurnsForCurrentQuestion})`);
                    
                    const response = await API.sendMessage(message, this.state.currentStep, {
                        questionMode: true,
                        currentQuestion: currentQuestion,
                        predefinedQuestions: predefinedQuestions,
                        conversationTurns: this.state.conversationTurnsForCurrentQuestion
                    });
                    
                    if (response && response.bot_response) {
                        // Remove "NEXT_QUESTION:" prefix if present
                        let botResponse = response.bot_response;
                        if (botResponse.startsWith('NEXT_QUESTION:')) {
                            botResponse = botResponse.replace('NEXT_QUESTION:', '').trim();
                        }
                        lastMessage.bot = botResponse;
                    } else {
                        lastMessage.bot = '⚠️ No response from server.';
                    }
                    
                    // Optionally handle privacy detection for featured mode
                    if (this.state.mode === 'featured' && response && response.privacy_detection) {
                        lastMessage.privacy = response.privacy_detection;
                    }
                    
                    // Check if the backend indicates a predefined question is completed
                    if (response && response.question_completed) {
                        this.state.currentQuestionIndex++;
                        this.state.predefinedQuestionsCompleted++;
                        this.state.conversationTurnsForCurrentQuestion = 0; // Reset turns counter for next question
                        console.log(`Question ${this.state.predefinedQuestionsCompleted} completed. Moving to next question.`);
                    }
                    
                    this.updateUI();
                    this.saveToLocalStorage();
                    this.scrollToBottom();
                    this.showLoading(false);
                    
                    // Check if all predefined questions are completed
                    if (this.state.predefinedQuestionsCompleted >= this.state.predefinedQuestions[this.state.mode].length) {
                        this.state.questionsCompleted = true;
                        this.state.questionMode = false;
                        this.showCongratulationPopup();
                    }
                    
                    return;
                } catch (apiError) {
                    const lastMessage = this.state.conversationLog[this.state.conversationLog.length - 1];
                    lastMessage.bot = `❌ Error: ${apiError.message}`;
                    this.updateUI();
                    this.showLoading(false);
                    return;
                }
            }

            // Send message to backend API and update bot response
            try {
                const lastMessage = this.state.conversationLog[this.state.conversationLog.length - 1];
                const response = await API.sendMessage(message, this.state.currentStep);
                if (response && response.bot_response) {
                    lastMessage.bot = response.bot_response;
                } else {
                    lastMessage.bot = '⚠️ No response from server.';
                }
                // Optionally handle privacy detection for featured mode
                if (this.state.mode === 'featured' && response && response.privacy_detection) {
                    lastMessage.privacy = response.privacy_detection;
                }
                this.updateUI();
                this.saveToLocalStorage();
                this.scrollToBottom();
                this.showLoading(false);
            } catch (apiError) {
                const lastMessage = this.state.conversationLog[this.state.conversationLog.length - 1];
                lastMessage.bot = `❌ Error: ${apiError.message}`;
                this.updateUI();
                this.showLoading(false);
            }

        } catch (error) {
            console.error('Send message error:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
            this.showLoading(false);
        }
    }

    // Enter edit mode (all modes)
    enterEditMode() {
        this.state.editMode = true;
        this.state.originalLog = JSON.parse(JSON.stringify(this.state.conversationLog));
        this.updateUI();
        this.showNotification('✏️ Edit mode enabled - You can now edit your conversation!', 'success');
    }

    // Exit edit mode
    exitEditMode() {
        this.state.editMode = false;
        this.updateUI();
        this.showNotification('✅ Edit mode disabled', 'info');
    }

    // Export direct
    async exportDirect() {
        try {
            console.log('Starting exportDirect...');
            let exportData;
            
            if (this.state.mode === 'naive') {
                exportData = this.generateNaiveExportData();
            } else if (this.state.mode === 'neutral') {
                exportData = this.generateNeutralExportData();
            } else {
                // For featured mode, create a basic export with consent metadata
                exportData = {
                    metadata: {
                        mode: 'featured',
                        export_timestamp: this.state.currentStep,
                        total_messages: this.state.conversationLog.length,
                        consent_given: this.state.consentGiven,
                        prolific_id: this.state.prolificId,
                        survey_completed: this.state.surveyCompleted
                    },
                    conversation: this.state.conversationLog,
                    survey_data: this.state.surveyData
                };

                // Include original conversation if consent was given
                if (this.state.consentGiven && this.state.originalLog.length > 0) {
                    exportData.original_conversation = this.state.originalLog;
                }
            }

            console.log('Export data generated:', exportData);
            const filename = `conversation_log_${this.state.currentStep}.json`;
            console.log('Downloading file:', filename);
            API.downloadFile(JSON.stringify(exportData, null, 2), filename);
            this.showNotification('📥 Export completed', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('❌ Export failed', 'error');
        }
    }

    // Export direct and redirect to thanks page
    async exportDirectAndRedirect() {
        try {
            console.log('Starting exportDirectAndRedirect...');
            let exportData;
            
            if (this.state.mode === 'naive') {
                exportData = this.generateNaiveExportData();
            } else if (this.state.mode === 'neutral') {
                exportData = this.generateNeutralExportData();
            } else {
                // For featured mode, create a basic export with consent metadata
                exportData = {
                    metadata: {
                        mode: 'featured',
                        export_timestamp: this.state.currentStep,
                        total_messages: this.state.conversationLog.length,
                        consent_given: this.state.consentGiven,
                        prolific_id: this.state.prolificId,
                        survey_completed: this.state.surveyCompleted
                    },
                    conversation: this.state.conversationLog,
                    survey_data: this.state.surveyData
                };

                // Include original conversation if consent was given
                if (this.state.consentGiven && this.state.originalLog.length > 0) {
                    exportData.original_conversation = this.state.originalLog;
                }
            }

            console.log('Export data generated:', exportData);
            const filename = `conversation_log_${this.state.currentStep}.json`;
            console.log('Downloading file:', filename);
            
            // Ensure the download happens
            try {
                API.downloadFile(JSON.stringify(exportData, null, 2), filename);
                console.log('Download initiated successfully');
                this.showNotification('📁 Data downloaded successfully!', 'success');
            } catch (downloadError) {
                console.error('Download error:', downloadError);
                this.showNotification('⚠️ Download failed, but continuing...', 'warning');
            }
            
            // Wait a moment for the download to start, then redirect
            setTimeout(() => {
                console.log('Redirecting to thanks page...');
                this.redirectToThanksPage();
            }, 1500);
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('❌ Export failed', 'error');
            // Still try to redirect even if export fails
            setTimeout(() => {
                this.redirectToThanksPage();
            }, 1000);
        }
    }

    // Analyze and export (featured mode)
    async analyzeAndExport() {
        if (this.state.mode !== 'featured') return;

        try {
            this.showLoading(true);
            
            // Use real backend API for privacy analysis
            const analyzedLog = [];
            
            for (let i = 0; i < this.state.conversationLog.length; i++) {
                const turn = this.state.conversationLog[i];
                
                // Analyze user message for privacy issues
                let userPrivacyResult = null;
                if (turn.user && turn.user.trim()) {
                    try {
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.user })
                        });
                        
                        if (response.ok) {
                            userPrivacyResult = await response.json();
                        } else {
                            console.error(`Privacy detection failed for user message ${i}:`, response.status);
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for user message ${i}:`, error);
                    }
                }
                
                // Analyze bot message for privacy issues (if any)
                let botPrivacyResult = null;
                if (turn.bot && turn.bot.trim()) {
                    try {
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.bot })
                        });
                        
                        if (response.ok) {
                            botPrivacyResult = await response.json();
                        } else {
                            console.error(`Privacy detection failed for bot message ${i}:`, response.status);
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for bot message ${i}:`, error);
                    }
                }
                
                // Create analysis entry
                const analysisEntry = {
                    user: turn.user,
                    bot: turn.bot,
                    userPrivacy: userPrivacyResult,
                    botPrivacy: botPrivacyResult,
                    hasPrivacyIssues: (userPrivacyResult && userPrivacyResult.privacy_issue) || 
                                     (botPrivacyResult && botPrivacyResult.privacy_issue)
                };
                
                analyzedLog.push(analysisEntry);
            }
            
            this.state.analyzedLog = analyzedLog;
            this.state.showPrivacyAnalysis = true;
            this.state.editMode = true; // Enable edit mode for all messages
            // Store original conversation for consent-based export
            this.state.originalLog = JSON.parse(JSON.stringify(this.state.conversationLog));
            
            // Ensure question mode is false to show export buttons
            this.state.questionMode = false;
            
            this.updateUI();
            
            // Count privacy issues found
            const totalIssues = analyzedLog.filter(entry => entry.hasPrivacyIssues).length;
            this.showNotification(`🔍 Privacy analysis completed - Found ${totalIssues} messages with privacy issues!`, 'success');
            this.showLoading(false);
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.showNotification(`❌ Analysis error: ${error.message}`, 'error');
            this.showLoading(false);
        }
    }

    // Analyze and export with redirect to thanks page
    async analyzeAndExportAndRedirect() {
        if (this.state.mode !== 'featured') return;

        try {
            this.showLoading(true);
            
            // Use real backend API for privacy analysis
            const analyzedLog = [];
            
            for (let i = 0; i < this.state.conversationLog.length; i++) {
                const turn = this.state.conversationLog[i];
                
                // Analyze user message for privacy issues
                let userPrivacyResult = null;
                if (turn.user && turn.user.trim()) {
                    try {
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.user })
                        });
                        
                        if (response.ok) {
                            userPrivacyResult = await response.json();
                        } else {
                            console.error(`Privacy detection failed for user message ${i}:`, response.status);
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for user message ${i}:`, error);
                    }
                }
                
                // Analyze bot message for privacy issues (if any)
                let botPrivacyResult = null;
                if (turn.bot && turn.bot.trim()) {
                    try {
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.bot })
                        });
                        
                        if (response.ok) {
                            botPrivacyResult = await response.json();
                        } else {
                            console.error(`Privacy detection failed for bot message ${i}:`, response.status);
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for bot message ${i}:`, error);
                    }
                }
                
                // Create analysis entry
                const analysisEntry = {
                    user: turn.user,
                    bot: turn.bot,
                    userPrivacy: userPrivacyResult,
                    botPrivacy: botPrivacyResult,
                    hasPrivacyIssues: (userPrivacyResult && userPrivacyResult.privacy_issue) || 
                                     (botPrivacyResult && botPrivacyResult.privacy_issue)
                };
                
                analyzedLog.push(analysisEntry);
            }
            
            this.state.analyzedLog = analyzedLog;
            
            // Generate comprehensive export data with analysis
            const exportData = this.generateComprehensiveExportData();
            exportData.privacy_analysis = analyzedLog;
            
            // Count privacy issues found
            const totalIssues = analyzedLog.filter(entry => entry.hasPrivacyIssues).length;
            
            // Export the data
            const filename = `conversation_analysis_${this.state.currentStep}.json`;
            
            // Ensure the download happens
            try {
                API.downloadFile(JSON.stringify(exportData, null, 2), filename);
                console.log('Analysis download initiated successfully');
                this.showNotification(`📁 Analysis data downloaded successfully! Found ${totalIssues} privacy issues.`, 'success');
            } catch (downloadError) {
                console.error('Analysis download error:', downloadError);
                this.showNotification('⚠️ Download failed, but continuing...', 'warning');
            }
            
            this.showLoading(false);
            
            // Wait a moment for the download to start, then redirect
            setTimeout(() => {
                console.log('Redirecting to thanks page...');
                this.redirectToThanksPage();
            }, 1500);
            
        } catch (error) {
            console.error('Analysis and export error:', error);
            this.showNotification(`❌ Analysis error: ${error.message}`, 'error');
            this.showLoading(false);
            // Still try to redirect even if analysis fails
            setTimeout(() => {
                this.redirectToThanksPage();
            }, 1000);
        }
    }

    // Comprehensive export for featured mode
    async exportComprehensive() {
        try {
            console.log('Starting exportComprehensive...');
            const filename = `conversation_log_comprehensive_${this.state.currentStep}.json`;
            
            // Create comprehensive export data that includes everything
            const exportData = this.generateComprehensiveExportData();
            
            console.log('Comprehensive export data generated:', exportData);
            console.log('Downloading file:', filename);
            API.downloadFile(JSON.stringify(exportData, null, 2), filename);
            this.showNotification('📥 Comprehensive export completed', 'success');
        } catch (error) {
            console.error('Comprehensive export error:', error);
            this.showNotification('❌ Export failed', 'error');
        }
    }

    // Comprehensive export and redirect to thanks page
    async exportComprehensiveAndRedirect() {
        try {
            console.log('Starting exportComprehensiveAndRedirect...');
            const filename = `conversation_log_comprehensive_${this.state.currentStep}.json`;
            
            // Create comprehensive export data that includes everything
            const exportData = this.generateComprehensiveExportData();
            
            console.log('Comprehensive export data generated:', exportData);
            console.log('Downloading file:', filename);
            
            // Ensure the download happens
            try {
                API.downloadFile(JSON.stringify(exportData, null, 2), filename);
                console.log('Comprehensive download initiated successfully');
                this.showNotification('📁 Comprehensive data downloaded successfully!', 'success');
            } catch (downloadError) {
                console.error('Comprehensive download error:', downloadError);
                this.showNotification('⚠️ Download failed, but continuing...', 'warning');
            }
            
            // Wait a moment for the download to start, then redirect
            setTimeout(() => {
                console.log('Redirecting to thanks page...');
                this.redirectToThanksPage();
            }, 1500);
        } catch (error) {
            console.error('Comprehensive export error:', error);
            this.showNotification('❌ Export failed', 'error');
            // Still try to redirect even if export fails
            setTimeout(() => {
                this.redirectToThanksPage();
            }, 1000);
        }
    }

    // Close privacy analysis
    closePrivacyAnalysis() {
        this.state.showPrivacyAnalysis = false;
        this.state.analyzedLog = [];
        this.state.privacyChoices = {};
        this.state.editMode = false; // Disable edit mode when closing analysis
        this.updateUI();
    }

    // Check API status
    async checkAPIStatus() {
        // Skip backend server check - always show as connected for API focus
        this.state.apiConnected = true;
        this.updateAPIStatus();
    }

    // Test API connection
    async testAPIConnection() {
        // Skip actual API test - always show success for API focus
        this.showLoading(true);
        
        // Simulate a brief loading time
        setTimeout(() => {
            this.state.apiConnected = true;
            this.showNotification('✅ API connection successful!', 'success');
            this.updateAPIStatus();
            this.showLoading(false);
        }, 500);
    }

    // Update API status display
    updateAPIStatus() {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (this.state.apiConnected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = 'Connected';
        } else {
            statusDot.className = 'status-dot error';
            statusText.textContent = 'Disconnected';
        }
    }

    // Show privacy popup
    showPrivacyPopup(element) {
        const popup = document.getElementById('privacy-popup');
        const title = document.getElementById('popup-title');
        const explanation = document.getElementById('popup-explanation');
        const suggestion = document.getElementById('popup-suggestion');
        const applyBtn = document.getElementById('popup-apply-btn');

        const type = element.getAttribute('data-type');
        const explanationText = element.getAttribute('data-explanation');
        const suggestionText = element.getAttribute('data-suggestion');
        const messageIndex = element.getAttribute('data-message-index');

        title.textContent = `🔒 Privacy Issue: ${type}`;
        explanation.textContent = explanationText;

        if (suggestionText) {
            suggestion.textContent = suggestionText;
            applyBtn.style.display = 'block';
            applyBtn.onclick = () => this.applyPrivacyCorrection(messageIndex, element.textContent, suggestionText);
        } else {
            suggestion.textContent = 'No automatic fix available. Please review manually.';
            applyBtn.style.display = 'none';
        }

        popup.style.display = 'flex';
    }

    // Close privacy popup
    closePrivacyPopup() {
        document.getElementById('privacy-popup').style.display = 'none';
    }

    // Show consent popup
    showConsentPopup(action) {
        console.log('Showing consent popup for action:', action);
        this.state.pendingExportAction = action;
        document.getElementById('consent-popup').style.display = 'flex';
    }

    // Close consent popup
    closeConsentPopup() {
        document.getElementById('consent-popup').style.display = 'none';
        this.state.pendingExportAction = null;
    }

    // Handle consent response
    handleConsentResponse(consentGiven) {
        console.log('Consent response received:', consentGiven);
        console.log('Pending action:', this.state.pendingExportAction);
        
        this.state.consentGiven = consentGiven;
        
        // Store the pending action before closing the popup
        const pendingAction = this.state.pendingExportAction;
        this.closeConsentPopup();
        
        if (pendingAction) {
            console.log('Executing action:', pendingAction);
            
            if (pendingAction === 'survey') {
                // Show survey after consent
                console.log('Showing survey after consent');
                const popup = document.getElementById('survey-popup');
                popup.style.display = 'flex';
            } else if (pendingAction === 'exportDirect') {
                this.exportDirect();
            } else if (pendingAction === 'analyzeAndExport') {
                this.analyzeAndExport();
            }
        } else {
            console.log('No pending action found');
        }
    }

    // Apply privacy correction
    async applyPrivacyCorrection(messageIndex, originalText, correctedText) {
        try {
            // Mock API call for privacy correction
            setTimeout(() => {
                // Update the element
                const element = document.querySelector(`[data-message-index="${messageIndex}"]`);
                if (element) {
                    element.textContent = correctedText;
                }
                
                this.closePrivacyPopup();
                // this.showNotification('✅ Privacy correction applied', 'success');
            }, 300);
            
        } catch (error) {
            console.error('Apply correction error:', error);
            // this.showNotification(`❌ Error: ${error.message}`, 'error');
        }
    }

    // Generate naive export data
    generateNaiveExportData() {
        // Count edited messages
        const editedMessages = this.state.conversationLog.filter(turn => turn.edited).length;
        
        const exportData = {
            metadata: {
                mode: 'naive',
                export_timestamp: this.state.currentStep,
                total_messages: this.state.conversationLog.length,
                has_edits: this.state.editMode,
                edited_messages_count: editedMessages,
                export_type: 'naive_with_edits',
                consent_given: this.state.consentGiven,
                consent_details: {
                    original_data_included: this.state.consentGiven,
                    survey_data_included: this.state.surveyCompleted,
                    prolific_id_included: !!this.state.prolificId
                },
                prolific_id: this.state.prolificId,
                survey_completed: this.state.surveyCompleted
            },
            conversation: this.state.conversationLog,
            survey_data: this.state.surveyData
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        return exportData;
    }

    // Generate neutral export data
    generateNeutralExportData() {
        const exportData = {
            metadata: {
                mode: 'neutral',
                export_timestamp: this.state.currentStep,
                total_messages: this.state.conversationLog.length,
                consent_given: this.state.consentGiven,
                consent_details: {
                    original_data_included: this.state.consentGiven,
                    survey_data_included: this.state.surveyCompleted,
                    prolific_id_included: !!this.state.prolificId
                },
                prolific_id: this.state.prolificId,
                survey_completed: this.state.surveyCompleted
            },
            conversation: this.state.conversationLog,
            survey_data: this.state.surveyData
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        return exportData;
    }

    // Generate analysis export data (includes edited messages with privacy analysis)
    generateAnalysisExportData() {
        const exportLog = [];
        
        for (let i = 0; i < this.state.conversationLog.length; i++) {
            const currentTurn = this.state.conversationLog[i]; // Use current (potentially edited) messages
            const analyzedTurn = this.state.analyzedLog[i]; // Get privacy analysis data
            
            exportLog.push({
                user: currentTurn.user, // Use edited user message
                bot: currentTurn.bot, // Use edited bot message
                userPrivacy: analyzedTurn ? analyzedTurn.userPrivacy : null, // Include user privacy analysis
                botPrivacy: analyzedTurn ? analyzedTurn.botPrivacy : null, // Include bot privacy analysis
                original_user: analyzedTurn ? analyzedTurn.user : currentTurn.user, // Keep original for reference
                original_bot: analyzedTurn ? analyzedTurn.bot : currentTurn.bot, // Keep original bot for reference
                user_edited: currentTurn.user_edited || false, // Track if user message was edited
                bot_edited: currentTurn.bot_edited || false, // Track if bot message was edited
                has_edits: (currentTurn.user_edited || currentTurn.bot_edited) // Flag if any message was edited
            });
        }
        
        const exportData = {
            metadata: {
                mode: 'featured_with_analysis',
                export_timestamp: this.state.currentStep,
                total_messages: exportLog.length,
                privacy_issues: this.state.analyzedLog.filter(turn => turn.hasPrivacyIssues).length,
                has_edits: this.state.editMode,
                edited_user_messages: exportLog.filter(turn => turn.user_edited).length,
                edited_bot_messages: exportLog.filter(turn => turn.bot_edited).length,
                export_type: 'analysis_with_edits',
                consent_given: this.state.consentGiven,
                prolific_id: this.state.prolificId,
                survey_completed: this.state.surveyCompleted
            },
            conversation: exportLog,
            privacy_analysis: this.state.analyzedLog,
            survey_data: this.state.surveyData
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        return exportData;
    }

    // Generate comprehensive export data
    generateComprehensiveExportData() {
        const exportData = {
            metadata: {
                mode: 'featured',
                export_timestamp: this.state.currentStep,
                total_messages: this.state.conversationLog.length,
                privacy_analysis_performed: this.state.analyzedLog.length > 0,
                privacy_issues_found: this.state.analyzedLog.filter(entry => entry.hasPrivacyIssues).length,
                consent_given: this.state.consentGiven,
                consent_details: {
                    original_data_included: this.state.consentGiven,
                    survey_data_included: this.state.surveyCompleted,
                    prolific_id_included: !!this.state.prolificId,
                    privacy_choices_included: Object.keys(this.state.privacyChoices).length > 0
                },
                prolific_id: this.state.prolificId,
                survey_completed: this.state.surveyCompleted
            },
            conversation: this.state.conversationLog,
            survey_data: this.state.surveyData,
            privacy_choices: this.state.privacyChoices
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        // Include privacy analysis if available
        if (this.state.analyzedLog.length > 0) {
            exportData.privacy_analysis = this.state.analyzedLog;
        }

        return exportData;
    }

    // Generate privacy choices summary
    generatePrivacyChoicesSummary() {
        const summary = {
            total_choices: 0,
            accepted_suggestions: 0,
            kept_original: 0,
            undecided: 0
        };
        
        Object.values(this.state.privacyChoices).forEach(choiceObj => {
            // Handle both old format (string) and new format (object with user/bot properties)
            if (typeof choiceObj === 'string') {
                summary.total_choices++;
                switch (choiceObj) {
                    case 'accept':
                        summary.accepted_suggestions++;
                        break;
                    case 'keep':
                        summary.kept_original++;
                        break;
                    default:
                        summary.undecided++;
                        break;
                }
            } else {
                // New format: object with user/bot properties
                Object.values(choiceObj).forEach(choice => {
                    summary.total_choices++;
                    switch (choice) {
                        case 'accept':
                            summary.accepted_suggestions++;
                            break;
                        case 'keep':
                            summary.kept_original++;
                            break;
                        default:
                            summary.undecided++;
                            break;
                    }
                });
            }
        });
        
        return summary;
    }

    // Update UI
    updateUI() {
        // Show two-column layout only during Privacy Analysis & Export stage
        const twoCol = document.getElementById('two-column-layout');
        const chatContainer = document.querySelector('.chat-container');
        if (this.state.showPrivacyAnalysis) {
            if (twoCol) twoCol.style.display = 'flex';
            if (chatContainer) chatContainer.style.display = 'none';
            this.updateConversationDisplay(true); // pass flag for analysis mode
            this.updatePrivacyAnalysis();
        } else {
            if (twoCol) twoCol.style.display = 'none';
            if (chatContainer) chatContainer.style.display = '';
            this.updateConversationDisplay(false);
        }
        this.updateStatistics();
        this.updateExportButtons();
        this.updateModeInfo();
        this.updateEditModeUI();
    }

    // Update conversation display
    updateConversationDisplay(analysisMode = false) {
        let container;
        let filterActive = false;
        if (analysisMode) {
            // Two-column layout: left column
            const twoCol = document.getElementById('two-column-layout');
            if (twoCol) {
                container = twoCol.querySelector('.left-column #conversation-container');
            }
            // Check filter toggle
            const filterToggle = document.getElementById('privacy-filter-toggle');
            if (filterToggle) filterActive = filterToggle.checked;
        } else {
            // Chat mode: main chat container
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                container = chatContainer.querySelector('#conversation-container');
            }
        }
        if (!container) return;
        if (this.state.conversationLog.length === 0) {
            let emptyMessage = 'Start a conversation by typing a message below!';
            if (this.state.questionMode) {
                emptyMessage = 'The chatbot will start asking you questions. Please wait...';
            }
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <p>${emptyMessage}</p>
                </div>
            `;
            return;
        }
        let html = '';
        for (let i = 0; i < this.state.conversationLog.length; i++) {
            // In analysis mode with filter, skip messages without privacy issues
            if (analysisMode && filterActive) {
                const analyzed = this.state.analyzedLog[i];
                if (!analyzed || !analyzed.hasPrivacyIssues) continue;
            }
            const turn = this.state.conversationLog[i];
            let userWarning = '';
            let botWarning = '';
            if (analysisMode) {
                const analyzed = this.state.analyzedLog[i];
                // User privacy issue warning sign
                if (analyzed && analyzed.userPrivacy && analyzed.userPrivacy.privacy_issue) {
                    userWarning = '<span class="privacy-warning-sign" data-type="user" data-index="' + i + '" style="cursor: pointer;">&#9888;&#65039;</span>';
                }
                // Bot privacy issue warning sign
                if (analyzed && analyzed.botPrivacy && analyzed.botPrivacy.privacy_issue) {
                    botWarning = '<span class="privacy-warning-sign" data-type="bot" data-index="' + i + '" style="cursor: pointer;">&#9888;&#65039;</span>';
                }
                html += `<div class="message-pair editable" data-index="${i}">
                    <div class="message message-user" id="log-entry-user-${i}">${userWarning}<textarea class="message-edit-input" data-message-index="${i}" data-message-type="user"
                        placeholder="Edit your message here...">${this.escapeHtml(turn.user)}</textarea>
                    </div>
                    <div class="message message-bot" id="log-entry-bot-${i}">${botWarning}<textarea class="message-edit-input" data-message-index="${i}" data-message-type="bot"
                        placeholder="Edit bot response here...">${this.escapeHtml(turn.bot)}</textarea>
                    </div>
                </div>`;
            } else {
                html += `<div class="message-pair" data-index="${i}">
                    <div class="message message-user" id="log-entry-user-${i}">${this.escapeHtml(turn.user)}</div>
                    <div class="message message-bot" id="log-entry-bot-${i}">${this.escapeHtml(turn.bot)}</div>
                </div>`;
            }
        }
        container.innerHTML = html;
        // Bind edit events in analysis mode
        if (analysisMode) {
            this.bindEditModeEvents();
            // Bind warning sign clicks for navigation
            const warningSigns = container.querySelectorAll('.privacy-warning-sign');
            warningSigns.forEach(sign => {
                sign.addEventListener('click', () => {
                    const idx = sign.getAttribute('data-index');
                    const type = sign.getAttribute('data-type');
                    // Scroll to and highlight the corresponding analysis result
                    const analysisEntry = document.querySelector(`#analysis-entry-${type}-${idx}`);
                    if (analysisEntry) {
                        analysisEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        analysisEntry.classList.add('nav-highlight');
                        setTimeout(() => analysisEntry.classList.remove('nav-highlight'), 2000);
                    }
                });
            });
        }
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Bind events for edit mode
    bindEditModeEvents() {
        const editInputs = document.querySelectorAll('.message-edit-input');
        editInputs.forEach(input => {
            // Save changes on blur (when user clicks away)
            input.addEventListener('blur', (e) => {
                const messageIndex = parseInt(e.target.dataset.messageIndex);
                const messageType = e.target.dataset.messageType || 'user';
                this.saveMessageEdit(messageIndex, e.target.value, messageType);
            });
            
            // Save changes on Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const messageIndex = parseInt(e.target.dataset.messageIndex);
                    const messageType = e.target.dataset.messageType || 'user';
                    this.saveMessageEdit(messageIndex, e.target.value, messageType);
                    e.target.blur();
                }
            });
        });
    }

    // Save message edit
    saveMessageEdit(messageIndex, newText, messageType = 'user') {
        if (messageIndex >= 0 && messageIndex < this.state.conversationLog.length) {
            if (messageType === 'user') {
                this.state.conversationLog[messageIndex].user = newText;
                this.state.conversationLog[messageIndex].user_edited = true; // Mark as edited
            } else if (messageType === 'bot') {
                this.state.conversationLog[messageIndex].bot = newText;
                this.state.conversationLog[messageIndex].bot_edited = true; // Mark as edited
            }
            this.saveToLocalStorage();
        }
    }

    // Update edit mode UI elements
    updateEditModeUI() {
        const exitEditBtn = document.getElementById('exit-edit-btn');
        const chatHeader = document.querySelector('.chat-header');
        const chatHeaderTitle = document.getElementById('chat-header-title');
        const mainHeaderTitle = document.getElementById('main-header-title');
        const chatInputGroup = document.getElementById('chat-input-group');
        const editExportContainer = document.getElementById('edit-export-container');
        
        if (this.state.editMode) {
            // Show exit edit button
            exitEditBtn.style.display = 'block';
            
            // Update header for edit mode
            chatHeader.classList.add('edit-mode');
            
            // Set appropriate header text based on mode
            const modeTitles = {
                naive: '✏️ Review & Export Stage',
                neutral: '✏️ Review & Export Stage', 
                featured: '🔍 Privacy Analysis & Export Stage'
            };
            chatHeaderTitle.innerHTML = `<i class="fas fa-edit"></i> ${modeTitles[this.state.mode]}`;
            
            // Update main header title for edit stage
            const mainHeaderTitles = {
                naive: '✏️ Review & Export Stage',
                neutral: '✏️ Review & Export Stage',
                featured: '🔍 Privacy Analysis & Export Stage'
            };
            mainHeaderTitle.innerHTML = `<i class="fas fa-edit"></i> ${mainHeaderTitles[this.state.mode]}`;
            
            // Hide chat input, show export buttons
            chatInputGroup.style.display = 'none';
            editExportContainer.style.display = 'block';
            
            // Update export buttons in the main container
            this.updateMainExportButtons();
            
        } else {
            // Hide exit edit button
            exitEditBtn.style.display = 'none';
            
            // Reset header for normal mode
            chatHeader.classList.remove('edit-mode');
            chatHeaderTitle.innerHTML = '<i class="fas fa-comments"></i> Chat Interface';
            
            // Reset main header title for normal mode
            mainHeaderTitle.innerHTML = '<i class="fas fa-lock"></i> Chatbot';
            
            // Show chat input, hide export buttons
            chatInputGroup.style.display = 'flex';
            editExportContainer.style.display = 'none';
        }
    }

    // Update main export buttons (in the chat input area)
    updateMainExportButtons() {
        const editExportBtnMain = document.getElementById('edit-export-btn-main');
        const exportDirectBtnMain = document.getElementById('export-direct-btn-main');
        const analyzeExportBtnMain = document.getElementById('analyze-export-btn-main');
        
        if (this.state.mode === 'naive') {
            if (this.state.editMode) {
                // In edit mode, change button text and functionality
                editExportBtnMain.innerHTML = '<i class="fas fa-save"></i> Save & Export';
                editExportBtnMain.className = 'btn btn-success';
            } else {
                // Normal edit mode button
                editExportBtnMain.innerHTML = '<i class="fas fa-edit"></i> Edit & Export';
                editExportBtnMain.className = 'btn btn-primary';
            }
            editExportBtnMain.style.display = 'block';
            exportDirectBtnMain.style.display = 'none';
            analyzeExportBtnMain.style.display = 'none';
        } else if (this.state.mode === 'featured') {
            editExportBtnMain.style.display = 'none';
            exportDirectBtnMain.style.display = 'none';
            analyzeExportBtnMain.innerHTML = '<i class="fas fa-download"></i> Export Comprehensive Data';
            analyzeExportBtnMain.style.display = 'block';
        } else {
            // Neutral mode
            if (this.state.editMode) {
                editExportBtnMain.innerHTML = '<i class="fas fa-save"></i> Save & Export';
                editExportBtnMain.className = 'btn btn-success';
            } else {
                editExportBtnMain.innerHTML = '<i class="fas fa-edit"></i> Edit & Export';
                editExportBtnMain.className = 'btn btn-primary';
            }
            editExportBtnMain.style.display = 'block';
            exportDirectBtnMain.style.display = 'none';
            analyzeExportBtnMain.style.display = 'none';
        }
    }

    // Update statistics
    updateStatistics() {
        document.getElementById('stat-messages').textContent = this.state.conversationLog.length;
        
        // Show predefined question progress in question mode
        if (this.state.questionMode) {
            const totalQuestions = this.state.predefinedQuestions[this.state.mode].length;
            const turnsInfo = this.state.conversationTurnsForCurrentQuestion > 0 ? ` (${this.state.conversationTurnsForCurrentQuestion} turns)` : '';
            document.getElementById('stat-step').textContent = `${this.state.predefinedQuestionsCompleted}/${totalQuestions}${turnsInfo}`;
        } else {
            document.getElementById('stat-step').textContent = this.state.currentStep;
        }
        
        let privacyCount = 0;
        if (this.state.analyzedLog.length > 0) {
            privacyCount = this.state.analyzedLog.filter(turn => turn.privacy).length;
        } else {
            privacyCount = this.state.conversationLog.filter(turn => turn.privacy).length;
        }
        
        document.getElementById('stat-privacy').textContent = privacyCount;
    }

    // Update export buttons
    updateExportButtons() {
        const exportButtons = document.getElementById('export-buttons');
        const editExportBtn = document.getElementById('edit-export-btn');
        const exportDirectBtn = document.getElementById('export-direct-btn');
        const analyzeExportBtn = document.getElementById('analyze-export-btn');
        
        // Only show export buttons if questions are completed and conversation has content
        if (this.state.conversationLog.length > 0 && !this.state.questionMode) {
            exportButtons.style.display = 'block';
            
            if (this.state.mode === 'naive') {
                if (this.state.editMode) {
                    // In edit mode, change button text and functionality
                    editExportBtn.innerHTML = '<i class="fas fa-save"></i> Save & Export';
                    editExportBtn.className = 'btn btn-success';
                } else {
                    // Normal edit mode button
                    editExportBtn.innerHTML = '<i class="fas fa-edit"></i> Edit & Export';
                    editExportBtn.className = 'btn btn-primary';
                }
                editExportBtn.style.display = 'block';
                exportDirectBtn.style.display = 'none'; // Hide Export Direct in naive mode
                analyzeExportBtn.style.display = 'none';
            } else if (this.state.mode === 'featured') {
                editExportBtn.style.display = 'none'; // Hide Edit & Export in featured mode
                exportDirectBtn.style.display = 'none'; // Hide Export Direct in featured mode
                analyzeExportBtn.style.display = 'block';
            } else {
                // Neutral mode - show Edit & Export button
                if (this.state.editMode) {
                    // In edit mode, change button text and functionality
                    editExportBtn.innerHTML = '<i class="fas fa-save"></i> Save & Export';
                    editExportBtn.className = 'btn btn-success';
                } else {
                    // Normal edit mode button
                    editExportBtn.innerHTML = '<i class="fas fa-edit"></i> Edit & Export';
                    editExportBtn.className = 'btn btn-primary';
                }
                editExportBtn.style.display = 'block';
                exportDirectBtn.style.display = 'none'; // Hide Export Direct in neutral mode
                analyzeExportBtn.style.display = 'none';
            }
        } else {
            exportButtons.style.display = 'none';
        }
    }

    // Update privacy analysis section
    updatePrivacyAnalysis() {
        const analysisSection = document.getElementById('privacy-analysis');
        if (!analysisSection) return;
        // Filter toggle logic
        const filterToggle = document.getElementById('privacy-filter-toggle');
        let filterActive = false;
        if (filterToggle) {
            filterActive = filterToggle.checked;
            filterToggle.onchange = () => this.updatePrivacyAnalysis();
        }
        if (this.state.showPrivacyAnalysis && this.state.analyzedLog.length > 0) {
            analysisSection.style.display = 'block';
            const privacyIssues = this.state.analyzedLog.filter(turn => turn.hasPrivacyIssues);
            document.getElementById('total-messages').textContent = this.state.analyzedLog.length;
            document.getElementById('privacy-issues').textContent = privacyIssues.length;
            this.updatePrivacyChoices(filterActive);
        } else {
            analysisSection.style.display = 'none';
        }
    }

    // Update privacy choices
    updatePrivacyChoices(filterActive = false) {
        const choicesContainer = document.getElementById('privacy-choices');
        if (!choicesContainer) return;
        let html = '';
        for (let i = 0; i < this.state.analyzedLog.length; i++) {
            const turn = this.state.analyzedLog[i];
            if (filterActive && !turn.hasPrivacyIssues) continue;
            if (!turn.hasPrivacyIssues) continue;
            if (!this.state.privacyChoices[i]) this.state.privacyChoices[i] = {};
            const currentChoices = this.state.privacyChoices[i];
            // User message privacy issues
            if (turn.userPrivacy && turn.userPrivacy.privacy_issue) {
                const userChoice = currentChoices.user || 'none';
                html += `
                    <div class="choice-item" data-index="${i}" id="analysis-entry-user-${i}">
                        <h4>Message ${i + 1}: User Message Privacy Issue</h4>
                        <p><strong>Issue:</strong> ${turn.userPrivacy.type}</p>
                        <p><strong>Severity:</strong> ${turn.userPrivacy.severity}</p>
                        <p><strong>Explanation:</strong> ${turn.userPrivacy.explanation}</p>
                        ${turn.userPrivacy.suggestion ? `<p><strong>Suggestion:</strong> ${turn.userPrivacy.suggestion}</p>` : ''}
                        <p><strong>Affected Text:</strong> "${turn.userPrivacy.affected_text}"</p>
                        <div class="choice-buttons">
                            <button class="btn btn-success" onclick="app.makePrivacyChoice(${i}, 'user', 'accept')" 
                                    ${!turn.userPrivacy.suggestion ? 'disabled' : ''}>
                                ✅ Accept Suggestion
                            </button>
                            <button class="btn btn-warning" onclick="app.makePrivacyChoice(${i}, 'user', 'keep')">
                                ⚠️ Keep Original
                            </button>
                            <button class="btn btn-info go-to-log-btn" data-log-index="${i}" data-log-type="user" type="button">Go to Log</button>
                        </div>
                        <div class="choice-status ${userChoice}">
                            ${this.getChoiceStatusText(userChoice)}
                        </div>
                    </div>
                `;
            }
            // Bot message privacy issues
            if (turn.botPrivacy && turn.botPrivacy.privacy_issue) {
                const botChoice = currentChoices.bot || 'none';
                html += `
                    <div class="choice-item" data-index="${i}" id="analysis-entry-bot-${i}">
                        <h4>Message ${i + 1}: Bot Response Privacy Issue</h4>
                        <p><strong>Issue:</strong> ${turn.botPrivacy.type}</p>
                        <p><strong>Severity:</strong> ${turn.botPrivacy.severity}</p>
                        <p><strong>Explanation:</strong> ${turn.botPrivacy.explanation}</p>
                        ${turn.botPrivacy.suggestion ? `<p><strong>Suggestion:</strong> ${turn.botPrivacy.suggestion}</p>` : ''}
                        <p><strong>Affected Text:</strong> "${turn.botPrivacy.affected_text}"</p>
                        <div class="choice-buttons">
                            <button class="btn btn-success" onclick="app.makePrivacyChoice(${i}, 'bot', 'accept')" 
                                    ${!turn.botPrivacy.suggestion ? 'disabled' : ''}>
                                ✅ Accept Suggestion
                            </button>
                            <button class="btn btn-warning" onclick="app.makePrivacyChoice(${i}, 'bot', 'keep')">
                                ⚠️ Keep Original
                            </button>
                            <button class="btn btn-info go-to-log-btn" data-log-index="${i}" data-log-type="bot" type="button">Go to Log</button>
                        </div>
                        <div class="choice-status ${botChoice}">
                            ${this.getChoiceStatusText(botChoice)}
                        </div>
                    </div>
                `;
            }
        }
        if (!html) {
            html = '<p class="text-center">No privacy issues found</p>';
        }
        choicesContainer.innerHTML = html;
        // Bind Go to Log buttons
        const goToLogBtns = choicesContainer.querySelectorAll('.go-to-log-btn');
        goToLogBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const idx = btn.getAttribute('data-log-index');
                const type = btn.getAttribute('data-log-type');
                const logEntry = document.querySelector(`#log-entry-${type}-${idx}`);
                if (logEntry) {
                    logEntry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    logEntry.classList.add('nav-highlight');
                    setTimeout(() => logEntry.classList.remove('nav-highlight'), 2000);
                }
            });
        });
    }

    // Make privacy choice (now per message and per issue type)
    makePrivacyChoice(index, issueType, choice) {
        if (!this.state.privacyChoices[index]) this.state.privacyChoices[index] = {};
        if (choice === 'none') {
            delete this.state.privacyChoices[index][issueType];
        } else {
            this.state.privacyChoices[index][issueType] = choice;
        }
        // Clean up empty objects
        if (Object.keys(this.state.privacyChoices[index]).length === 0) {
            delete this.state.privacyChoices[index];
        }
        
        // Apply privacy correction immediately if choice is 'accept'
        if (choice === 'accept' && this.state.analyzedLog[index]) {
            const analyzedTurn = this.state.analyzedLog[index];
            if (issueType === 'user' && analyzedTurn.userPrivacy && analyzedTurn.userPrivacy.privacy_issue && analyzedTurn.userPrivacy.suggestion) {
                this.state.conversationLog[index].user = analyzedTurn.userPrivacy.suggestion;
            } else if (issueType === 'bot' && analyzedTurn.botPrivacy && analyzedTurn.botPrivacy.privacy_issue && analyzedTurn.botPrivacy.suggestion) {
                this.state.conversationLog[index].bot = analyzedTurn.botPrivacy.suggestion;
            }
        }
        
        this.updatePrivacyChoices();
        this.updateConversationDisplay(); // Update the UI to show the change
        this.saveToLocalStorage();
    }

    // Get choice status text
    getChoiceStatusText(choice) {
        switch (choice) {
            case 'accept':
                return '✅ Choice: Accept Suggestion - Will use safer text in export';
            case 'keep':
                return '⚠️ Choice: Keep Original - Will use original text in export';
            default:
                return '';
        }
    }

    // Scroll to bottom of conversation
    scrollToBottom() {
        const container = document.getElementById('conversation-container');
        container.scrollTop = container.scrollHeight;
    }

    // Show loading overlay
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="notification-icon ${icons[type] || icons.info}"></i>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    // Save to localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem('privacyDemoState', JSON.stringify(this.state));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    // Load from localStorage
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('privacyDemoState');
            if (saved) {
                const savedState = JSON.parse(saved);
                this.state = { ...this.state, ...savedState };
                this.updateUI();
                this.updateSidebarToggle();
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
    }

    // Show privacy tooltip
    showPrivacyTooltip(element) {
        const tooltip = document.getElementById('privacy-tooltip-container');
        const title = document.getElementById('tooltip-title');
        const severity = document.getElementById('tooltip-severity');
        const explanation = document.getElementById('tooltip-explanation');
        const suggestion = document.getElementById('tooltip-suggestion');
        const suggestionText = document.getElementById('tooltip-suggestion-text');
        const applyBtn = document.getElementById('tooltip-apply-btn');

        // Get privacy data from element (support both analyzed log and real-time data)
        let privacyData = null;
        const messageIndex = parseInt(element.dataset.messageIndex);
        
        if (messageIndex !== undefined && this.state.analyzedLog[messageIndex]) {
            privacyData = this.state.analyzedLog[messageIndex].privacy;
        } else if (element.dataset.privacyType) {
            // Real-time detection data
            privacyData = {
                type: element.dataset.privacyType,
                severity: element.dataset.privacySeverity,
                explanation: element.dataset.privacyExplanation,
                suggestion: element.dataset.privacySuggestion,
                affected_text: element.textContent
            };
        }
        
        if (!privacyData) return;

        // Update tooltip content
        title.textContent = privacyData.type || 'Privacy Issue';
        explanation.textContent = privacyData.explanation || 'This text contains potentially sensitive information.';
        
        // Set severity
        severity.textContent = privacyData.severity || 'medium';
        severity.className = `tooltip-severity ${privacyData.severity || 'medium'}`;

        // Show suggestion if available
        if (privacyData.suggestion) {
            suggestion.style.display = 'block';
            suggestionText.textContent = privacyData.suggestion;
            applyBtn.style.display = 'inline-block';
            
            // Store data for applying suggestion
            if (messageIndex !== undefined) {
                applyBtn.dataset.messageIndex = messageIndex;
                applyBtn.dataset.originalText = element.textContent;
                applyBtn.dataset.suggestionText = privacyData.suggestion;
            } else {
                // For real-time detection, apply to input field
                applyBtn.dataset.realtime = 'true';
                applyBtn.dataset.originalText = element.textContent;
                applyBtn.dataset.suggestionText = privacyData.suggestion;
            }
        } else {
            suggestion.style.display = 'none';
            applyBtn.style.display = 'none';
        }

        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 10}px`;

        // Show tooltip
        tooltip.classList.add('show');
    }

    // Hide privacy tooltip
    hidePrivacyTooltip() {
        const tooltip = document.getElementById('privacy-tooltip-container');
        tooltip.classList.remove('show');
    }

    // Apply tooltip suggestion
    async applyTooltipSuggestion() {
        const tooltip = document.getElementById('privacy-tooltip-container');
        const suggestionText = document.getElementById('tooltip-suggestion-text').textContent;
        const targetElement = tooltip.dataset.targetElement;
        
        if (targetElement) {
            const element = document.querySelector(targetElement);
            if (element) {
                element.textContent = suggestionText;
                element.classList.remove('privacy-error');
                this.hidePrivacyTooltip();
                this.showNotification('✅ Privacy fix applied', 'success');
            }
        }
    }

    // Show Prolific ID popup
    showProlificIdPopup() {
        const popup = document.getElementById('prolific-id-popup');
        const input = document.getElementById('prolific-id-input');
        
        // Clear any previous input
        input.value = '';
        
        // Show popup
        popup.style.display = 'flex';
        
        // Focus on input
        setTimeout(() => {
            input.focus();
        }, 100);
    }

    // Close Prolific ID popup
    closeProlificIdPopup() {
        const popup = document.getElementById('prolific-id-popup');
        popup.style.display = 'none';
    }

    // Handle Prolific ID submission
    handleProlificIdSubmit() {
        const input = document.getElementById('prolific-id-input');
        const prolificId = input.value.trim();
        
        if (!prolificId) {
            this.showNotification('Please enter your Prolific ID to continue.', 'warning');
            return;
        }
        
        // Save Prolific ID to state
        this.state.prolificId = prolificId;
        this.state.prolificIdSubmitted = true;
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Close popup
        this.closeProlificIdPopup();
        
        // Show success notification
        this.showNotification(`Welcome! Prolific ID: ${prolificId}`, 'success');
        
        // Start the question conversation if in question mode
        if (this.state.questionMode) {
            this.startQuestionConversation();
        }
    }

    // Show survey popup
    showSurveyPopup(exportAction) {
        console.log('Showing survey popup for export action:', exportAction);
        this.state.pendingExportAction = exportAction;
        
        // First show consent popup, then survey will be shown after consent
        this.showConsentPopup('survey');
    }

    // Close survey popup
    closeSurveyPopup() {
        const popup = document.getElementById('survey-popup');
        popup.style.display = 'none';
        this.state.pendingExportAction = null;
    }

    // Handle survey submission
    handleSurveySubmit() {
        const form = document.getElementById('survey-form');
        const formData = new FormData(form);
        
        // Collect survey data
        const surveyData = {};
        for (let i = 1; i <= 8; i++) {
            const value = formData.get(`q${i}`);
            surveyData[`q${i}`] = value || '';
        }
        
        console.log('Collected survey data:', surveyData);
        
        // Save survey data to state
        this.state.surveyData = surveyData;
        this.state.surveyCompleted = true;
        
        console.log('Survey state after saving:', {
            surveyData: this.state.surveyData,
            surveyCompleted: this.state.surveyCompleted,
            pendingExportAction: this.state.pendingExportAction
        });
        
        // Save to localStorage
        this.saveToLocalStorage();
        
        // Close survey popup
        this.closeSurveyPopup();
        
        // Show success notification
        this.showNotification('✅ Survey completed! Exporting data...', 'success');
        
        // Debug: Log the pending export action
        console.log('Pending export action:', this.state.pendingExportAction);
        
        // Execute the pending export action and redirect to thanks page
        if (this.state.pendingExportAction) {
            console.log('Executing export action:', this.state.pendingExportAction);
            
            // Use setTimeout to ensure the notification is shown before export
            setTimeout(() => {
                switch (this.state.pendingExportAction) {
                    case 'exportDirect':
                        console.log('Executing exportDirect...');
                        this.exportDirectAndRedirect();
                        break;
                    case 'exportComprehensive':
                        console.log('Executing exportComprehensive...');
                        this.exportComprehensiveAndRedirect();
                        break;
                    case 'analyzeAndExport':
                        console.log('Executing analyzeAndExport...');
                        this.analyzeAndExportAndRedirect();
                        break;
                    default:
                        console.error('Unknown export action:', this.state.pendingExportAction);
                        // Fallback to direct export
                        this.exportDirectAndRedirect();
                }
            }, 500);
        } else {
            console.error('No pending export action found, using fallback');
            // Fallback to direct export
            setTimeout(() => {
                this.exportDirectAndRedirect();
            }, 500);
        }
    }

    // Redirect to thanks page
    redirectToThanksPage() {
        try {
            const prolificId = this.state.prolificId || '';
            const thanksUrl = `/thanks?prolific_id=${encodeURIComponent(prolificId)}`;
            console.log('Redirecting to thanks page:', thanksUrl);
            
            // Show a notification before redirecting
            this.showNotification('🔄 Redirecting to completion page...', 'info');
            
            // Use a small delay to ensure the notification is shown
            setTimeout(() => {
                try {
                    window.location.href = thanksUrl;
                } catch (redirectError) {
                    console.error('Redirect error:', redirectError);
                    // Fallback: try to navigate using window.location.replace
                    try {
                        window.location.replace(thanksUrl);
                    } catch (fallbackError) {
                        console.error('Fallback redirect also failed:', fallbackError);
                        // Last resort: show a message to the user
                        alert('Please navigate to the thanks page manually. Your data has been downloaded.');
                    }
                }
            }, 500);
        } catch (error) {
            console.error('Error in redirectToThanksPage:', error);
            // Fallback: show a message to the user
            alert('Please navigate to the thanks page manually. Your data has been downloaded.');
        }
    }
}

// Global functions for popup interactions
function closePrivacyPopup() {
    const popup = document.getElementById('privacy-popup');
    popup.style.display = 'none';
}

function closeConsentPopup() {
    const popup = document.getElementById('consent-popup');
    popup.style.display = 'none';
}

function closeSurveyPopup() {
    const popup = document.getElementById('survey-popup');
    popup.style.display = 'none';
}

function closeProlificIdPopup() {
    const popup = document.getElementById('prolific-id-popup');
    popup.style.display = 'none';
}

function closeCongratulationPopup() {
    const popup = document.getElementById('congratulation-popup');
    popup.style.display = 'none';
}

// Initialize the application
const app = new PrivacyDemoApp();

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(notificationStyles);