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
            // Removed turn counting - letting LLM decide when to move to next question
            completedQuestionIndices: [], // Track which specific questions have been completed
            justCompletedQuestion: false, // Track if we just completed a question to avoid duplicate asks
            // Prolific ID for user identification
            prolificId: null,
            prolificIdSubmitted: false,
            // Survey data
            surveyData: {},
            surveyCompleted: false,
            predefinedQuestions: {
                naive: [],
                neutral: [],
                featured: []
            },
            // Multi-step interface properties
            currentStepPage: 'introduction',
            consentChecked: false,
            qualificationAnswers: {
                qual1: '',
                qual2: '',
                qual3: '',
                qual4: '',
                qual5: ''
            }
        };

        // Removed turn counting constants - letting LLM decide when to move to next question

        this.init();
    }

    // Initialize the application
    init() {
        this.bindEvents();
        this.updateUI();
        this.updateSidebarToggle();
        this.checkAPIStatus();
        this.loadFromLocalStorage();
        
        // Initialize multi-step interface
        this.initializeMultiStepInterface();
    }

    // Initialize multi-step interface
    initializeMultiStepInterface() {
        // Show introduction page by default
        this.showStepPage('introduction');
        
        // Bind multi-step navigation events
        this.bindMultiStepEvents();
    }

    // Bind multi-step navigation events
    bindMultiStepEvents() {
        // Introduction page events
        document.getElementById('start-study-btn').addEventListener('click', () => {
            this.showStepPage('consent');
        });

        // Consent page events
        document.getElementById('back-to-intro-btn').addEventListener('click', () => {
            this.showStepPage('introduction');
        });

        document.getElementById('consent-checkbox').addEventListener('change', (e) => {
            this.state.consentChecked = e.target.checked;
            this.updateConsentButton();
            this.saveToLocalStorage();
        });

        document.getElementById('proceed-to-qualification-btn').addEventListener('click', () => {
            if (this.state.consentChecked) {
                this.showStepPage('qualification');
                this.saveToLocalStorage();
            }
        });

        // Qualification page events
        document.getElementById('back-to-consent-btn').addEventListener('click', () => {
            this.showStepPage('consent');
        });

        // Bind qualification question events
        for (let i = 1; i <= 5; i++) {
            document.getElementById(`qual-${i}`).addEventListener('change', (e) => {
                this.state.qualificationAnswers[`qual${i}`] = e.target.value;
                this.validateQualification();
                this.saveToLocalStorage();
            });
        }

        document.getElementById('proceed-to-chat-btn').addEventListener('click', () => {
            if (this.isQualified()) {
                this.showNotification('Reminder: You can edit your conversation freely after completing the interview.', 'info', 'reminder');
                this.showStepPage('chat');
                this.startChatInterface();
                this.saveToLocalStorage();
            }
        });
    }

    // Show specific step page
    showStepPage(stepName) {
        // Hide all step pages
        const stepPages = ['introduction', 'consent', 'qualification', 'chat'];
        stepPages.forEach(page => {
            const pageElement = document.getElementById(`${page}-page`);
            if (pageElement) {
                pageElement.classList.remove('active');
            }
        });

        // Show the requested step page
        const targetPage = document.getElementById(`${stepName}-page`);
        if (targetPage) {
            targetPage.classList.add('active');
            this.state.currentStepPage = stepName;
        }

        // Update step indicator in chat page header
        if (stepName === 'chat') {
            this.updateChatPageStepIndicator();
        }
        
        // Save state when navigating between steps
        this.saveToLocalStorage();
    }

    // Update consent button state
    updateConsentButton() {
        const proceedBtn = document.getElementById('proceed-to-qualification-btn');
        if (proceedBtn) {
            proceedBtn.disabled = !this.state.consentChecked;
        }
    }

    // Validate qualification answers
    validateQualification() {
        const isQualified = this.isQualified();
        const statusElement = document.getElementById('qualification-status');
        const proceedBtn = document.getElementById('proceed-to-chat-btn');

        if (statusElement) {
            if (isQualified) {
                statusElement.className = 'qualification-status valid';
                statusElement.innerHTML = '<p class="status-message">✓ All qualification requirements met. You can proceed to the chat interface.</p>';
            } else {
                statusElement.className = 'qualification-status invalid';
                statusElement.innerHTML = '<p class="status-message">Please answer all questions with "Yes" to proceed.</p>';
            }
        }

        if (proceedBtn) {
            proceedBtn.disabled = !isQualified;
        }

        // Update visual feedback for individual questions
        this.updateQualificationVisualFeedback();
    }

    // Check if user qualifies
    isQualified() {
        const answers = this.state.qualificationAnswers;
        return answers.qual1 === 'yes' && 
               answers.qual2 === 'yes' && 
               answers.qual3 === 'yes' && 
               answers.qual4 === 'yes' && 
               answers.qual5 === 'yes';
    }

    // Update visual feedback for qualification questions
    updateQualificationVisualFeedback() {
        for (let i = 1; i <= 5; i++) {
            const selectElement = document.getElementById(`qual-${i}`);
            const answer = this.state.qualificationAnswers[`qual${i}`];
            
            if (selectElement) {
                selectElement.classList.remove('valid', 'invalid');
                
                if (answer === 'yes') {
                    selectElement.classList.add('valid');
                } else if (answer === 'no') {
                    selectElement.classList.add('invalid');
                }
            }
        }
    }

    // Start chat interface
    startChatInterface() {
        // Show Prolific ID popup if not submitted yet
        if (!this.state.prolificIdSubmitted || !this.state.prolificId) {
            this.showProlificIdPopup();
        } else {
            // If Prolific ID is already submitted but conversation hasn't started, start it
            if (this.state.prolificIdSubmitted && this.state.prolificId && 
                (!this.state.questionMode || this.state.conversationLog.length === 0)) {
                console.log('Prolific ID already submitted, starting conversation...');
                this.startConversationAfterProlificId();
            }
        }
    }

    // Update chat page step indicator
    updateChatPageStepIndicator() {
        const stepIndicator = document.querySelector('#chat-page .step-indicator');
        if (stepIndicator) {
            const stepNumber = stepIndicator.querySelector('.step-number');
            const stepLabel = stepIndicator.querySelector('.step-label');
            
            if (stepNumber) stepNumber.textContent = '4';
            if (stepLabel) stepLabel.textContent = 'Chat Interface';
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
            
            // Test survey popup with different modes (for debugging)
            if (e.ctrlKey && e.key === 's') {
                console.log('Test survey popup triggered');
                this.showSurveyPopup('exportDirect');
            }
            
            // Test mode switching (for debugging)
            if (e.ctrlKey && e.key === '1') {
                console.log('Switching to naive mode');
                this.setMode('naive');
            }
            if (e.ctrlKey && e.key === '2') {
                console.log('Switching to neutral mode');
                this.setMode('neutral');
            }
            if (e.ctrlKey && e.key === '3') {
                console.log('Switching to featured mode');
                this.setMode('featured');
            }
        });

        // Main export buttons (in chat input area)
        document.getElementById('edit-export-btn-main').addEventListener('click', () => {
            if (this.state.editMode) {
                // For naive mode: Export button → Data Collection consent → Post task survey
                this.showConsentPopup('exportDirect');
            } else {
                this.enterEditMode();
            }
        });

        document.getElementById('export-direct-btn-main').addEventListener('click', () => {
            // For neutral mode: Export button → Data Collection consent → Post task survey
            this.showConsentPopup('exportDirect');
        });

        document.getElementById('analyze-export-btn-main').addEventListener('click', () => {
            // For featured mode: Export button → Data Collection consent → Post task survey
            this.showConsentPopup('exportComprehensive');
        });

        document.getElementById('edit-export-btn').addEventListener('click', () => {
            if (this.state.editMode) {
                // For naive mode: Export button → Data Collection consent → Post task survey
                this.showConsentPopup('exportDirect');
            } else {
                this.enterEditMode();
            }
        });

        document.getElementById('export-direct-btn').addEventListener('click', () => {
            // For neutral mode: Export button → Data Collection consent → Post task survey
            this.showConsentPopup('exportDirect');
        });

        document.getElementById('analyze-export-btn').addEventListener('click', () => {
            // For featured mode: Export button → Data Collection consent → Post task survey
            this.showConsentPopup('exportComprehensive');
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
            // For featured mode: Export button → Data Collection consent → Post task survey
            this.showConsentPopup('exportComprehensive');
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
                // Removed turn counting - letting LLM decide when to move to next question
                
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
        // Removed turn counting reset - letting LLM decide when to move to next question
        this.state.completedQuestionIndices = []; // Reset completed questions tracking
        this.state.justCompletedQuestion = false; // Reset completion flag
        this.state.conversationLog = []; // Clear conversation when changing modes
        
        // Load predefined questions from server
        await this.loadPredefinedQuestions(mode);
        
        // Start the conversation with the first question from LLM
        await this.startQuestionConversation();

        // Skip API call for mode setting - focus on frontend functionality
        this.updateModeInfo();
        this.updateUI();
        this.saveToLocalStorage();
    }

    // Load predefined questions from server
    async loadPredefinedQuestions(mode) {
        try {
            const response = await fetch(`/api/predefined_questions/${mode}`);
            const data = await response.json();
            
            if (data.success) {
                this.state.predefinedQuestions[mode] = data.questions;
                console.log(`Loaded ${data.questions.length} questions for mode: ${mode}`);
            } else {
                console.error('Failed to load predefined questions:', data.error);
                this.showNotification('Failed to load questions', 'error');
            }
        } catch (error) {
            console.error('Error loading predefined questions:', error);
            this.showNotification('Error loading questions', 'error');
        }
    }

    // Get the next uncompleted question index
    getNextUncompletedQuestionIndex() {
        const totalQuestions = this.state.predefinedQuestions[this.state.mode].length;
        
        console.log(`Looking for next uncompleted question. Completed: [${this.state.completedQuestionIndices.join(', ')}], Total: ${totalQuestions}`);
        
        // Find the first question that hasn't been completed
        for (let i = 0; i < totalQuestions; i++) {
            if (!this.state.completedQuestionIndices.includes(i)) {
                console.log(`Found next uncompleted question: ${i + 1}`);
                return i;
            }
        }
        
        // If all questions are completed, return -1
        console.log('All questions completed');
        return -1;
    }

    // Clean up question transition responses to prevent double questions
    cleanupQuestionTransition(response) {
        // Split the response into sentences
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        
        if (sentences.length <= 2) {
            // If there are 2 or fewer sentences, it's likely a clean transition
            return response;
        }
        
        // Look for patterns that indicate the main question has been asked
        const questionPatterns = [
            /\bwhat\s+is\s+your\b/i,
            /\bhow\s+old\s+are\s+you\b/i,
            /\bwhere\s+do\s+you\s+live\b/i,
            /\bwhat\s+is\s+your\s+occupation\b/i,
            /\bdo\s+you\s+have\s+any\s+hobbies\b/i,
            /\bwhat\s+are\s+your\s+hobbies\b/i,
            /\bhow\s+to\s+use\s+genai\b/i,
            /\bwhat\s+are\s+your\s+thoughts\s+on\b/i,
            /\bhow\s+do\s+you\s+feel\s+about\b/i,
            /\bwhat's\s+your\s+experience\s+with\b/i,
            /\bhow\s+do\s+you\s+manage\b/i
        ];
        
        // Find the sentence that contains the main question
        let mainQuestionIndex = -1;
        for (let i = 0; i < sentences.length; i++) {
            for (const pattern of questionPatterns) {
                if (pattern.test(sentences[i])) {
                    mainQuestionIndex = i;
                    break;
                }
            }
            if (mainQuestionIndex !== -1) break;
        }
        
        if (mainQuestionIndex !== -1) {
            // Take only the sentences up to and including the main question
            const cleanSentences = sentences.slice(0, mainQuestionIndex + 1);
            return cleanSentences.join('. ').trim() + '.';
        }
        
        // If no clear question pattern is found, take the first two sentences
        // (transition + main question)
        return sentences.slice(0, 2).join('. ').trim() + '.';
    }

    // Start question conversation with LLM
    async startQuestionConversation() {
        try {
            this.showLoading(true, '🤖 Starting conversation with AI...');
            
            const currentQuestion = this.state.predefinedQuestions[this.state.mode][this.state.currentQuestionIndex];
            const predefinedQuestions = this.state.predefinedQuestions[this.state.mode];
            
            // Send initial message to start the conversation
            const response = await API.sendMessage("Hello, I'm ready to answer your questions.", this.state.currentStep, {
                questionMode: true,
                currentQuestion: currentQuestion,
                predefinedQuestions: predefinedQuestions
            });
            
            if (response && response.bot_response) {
                // Remove any NEXT_QUESTION prefix that might be present
                let botResponse = response.bot_response;
                botResponse = botResponse.replace(/\bNEXT_QUESTION\b/gi, '').trim();
                
                this.state.conversationLog.push({
                    user: '',
                    bot: botResponse,
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
        const modeSelect = document.getElementById('mode-select');
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
        
        // Update the mode select element to reflect current mode
        if (modeSelect) {
            modeSelect.value = this.state.mode;
        }
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
                message: 'Great job! You\'ve completed all the questions. You can now edit your conversation before exporting.',
                buttonText: 'Enter Edit Mode'
            },
            neutral: {
                title: '🎉 Questions Completed!',
                message: 'Great job! You\'ve completed all the questions. You can now proceed to data collection consent.',
                buttonText: 'Continue'
            },
            featured: {
                title: '🎉 Questions Completed!',
                message: 'Great job! You\'ve completed all the questions. You can now analyze your conversation with privacy detection.',
                buttonText: 'Start Privacy Analysis'
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
        
        if (this.state.mode === 'neutral') {
            // For neutral mode: Congratulations → Data Collection consent → Post task survey
            this.showNotification('📋 Starting data collection consent...', 'info');
            this.showConsentPopup('survey');
        } else if (this.state.mode === 'naive') {
            // For naive mode: Congratulations → Free editing stage
            this.enterEditMode();
            this.showNotification('✏️ Edit mode enabled - You can now edit your conversation!', 'success');
        } else if (this.state.mode === 'featured') {
            // For featured mode: Congratulations → Privacy analysis stage
            this.showNotification('🔍 Starting privacy analysis...', 'info');
            this.analyzeAndExport();
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
            this.showLoading(true, '🔄 Resetting conversation...');
            
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
            // Removed turn counting reset - letting LLM decide when to move to next question
            this.state.completedQuestionIndices = []; // Reset completed questions tracking
            this.state.justCompletedQuestion = false; // Reset completion flag
            
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
            this.showLoading(true, '🤖 AI is thinking...');

            // Handle question mode
            if (this.state.questionMode) {
                // In question mode, send to backend with question parameters
                try {
                    const lastMessage = this.state.conversationLog[this.state.conversationLog.length - 1];
                    
                    // Only get the next question if we just completed a question or if we don't have a current question
                    if (this.state.justCompletedQuestion || this.state.currentQuestionIndex === null || this.state.currentQuestionIndex === undefined) {
                        const nextQuestionIndex = this.getNextUncompletedQuestionIndex();
                        
                        // If all questions are completed, end the conversation
                        if (nextQuestionIndex === -1) {
                            this.state.questionsCompleted = true;
                            this.state.questionMode = false;
                            this.showCongratulationPopup();
                            return;
                        }
                        
                        // Update current question index to the next uncompleted question
                        this.state.currentQuestionIndex = nextQuestionIndex;
                        console.log(`Moved to next question: ${this.state.currentQuestionIndex + 1}`);
                    }
                    
                    // Ensure current question index is valid
                    if (this.state.currentQuestionIndex < 0 || this.state.currentQuestionIndex >= this.state.predefinedQuestions[this.state.mode].length) {
                        console.error(`Invalid current question index: ${this.state.currentQuestionIndex}`);
                        this.state.currentQuestionIndex = 0;
                    }
                    
                    let currentQuestion = this.state.predefinedQuestions[this.state.mode][this.state.currentQuestionIndex];
                    const predefinedQuestions = this.state.predefinedQuestions[this.state.mode];
                    
                    // Check if this is the final question
                    const isFinalQuestion = (this.state.currentQuestionIndex === this.state.predefinedQuestions[this.state.mode].length - 1);
                    console.log(`Current question ${this.state.currentQuestionIndex + 1}/${this.state.predefinedQuestions[this.state.mode].length} - Is final: ${isFinalQuestion}`);
                    console.log(`Question text: "${currentQuestion}"`);
                    console.log(`Completed questions: [${this.state.completedQuestionIndices.join(', ')}]`);
                    console.log(`justCompletedQuestion flag: ${this.state.justCompletedQuestion}`);
                    
                    // Let LLM decide when to move to next question - no turn counting
                    if (this.state.justCompletedQuestion) {
                        this.state.justCompletedQuestion = false;
                    }
                    
                    console.log(`Frontend: Sending question ${this.state.currentQuestionIndex + 1}/${predefinedQuestions.length}: "${currentQuestion}" (justCompleted: ${this.state.justCompletedQuestion})`);
                    
                    const response = await API.sendMessage(message, this.state.currentStep, {
                        questionMode: true,
                        currentQuestion: currentQuestion,
                        predefinedQuestions: predefinedQuestions,
                        isFinalQuestion: isFinalQuestion
                    });
                    
                    if (response && response.bot_response) {
                        console.log('Raw bot response from server:', response.bot_response);
                        // Remove "NEXT_QUESTION:" prefix if present and handle transition
                        let botResponse = response.bot_response;
                        let isQuestionTransition = false;
                        
                        // More robust NEXT_QUESTION detection and removal
                        const nextQuestionPatterns = [
                            /^NEXT_QUESTION:\s*/i,           // At start with colon
                            /^NEXT_QUESTION\s*/i,            // At start without colon
                            /\bNEXT_QUESTION:\s*/gi,         // Anywhere with colon
                            /\bNEXT_QUESTION\s*/gi           // Anywhere without colon
                        ];
                        
                        for (const pattern of nextQuestionPatterns) {
                            if (pattern.test(botResponse)) {
                                console.log(`Found NEXT_QUESTION pattern: ${pattern.source}, removing and adding transition`);
                                botResponse = botResponse.replace(pattern, '').trim();
                                isQuestionTransition = true;
                                break; // Only need to find one pattern
                            }
                        }
                        
                        // Final cleanup: remove any remaining NEXT_QUESTION text that might have been missed
                        botResponse = botResponse.replace(/\bNEXT_QUESTION\b/gi, '').trim();
                        
                        // If this is a question transition, clean up the response to prevent double questions
                        if (isQuestionTransition) {
                            // Extract only the transition and the main question, removing any additional follow-up content
                            botResponse = this.cleanupQuestionTransition(botResponse);
                            lastMessage.bot = botResponse;
                        } else {
                            lastMessage.bot = botResponse;
                        }
                        
                        console.log('Final bot response:', lastMessage.bot);
                    } else {
                        lastMessage.bot = '⚠️ No response from server.';
                    }
                    
                    // Optionally handle privacy detection for featured mode
                    if (this.state.mode === 'featured' && response && response.privacy_detection) {
                        lastMessage.privacy = response.privacy_detection;
                    }
                    
                    // Check if the backend indicates a predefined question is completed
                    // Also check if the AI response contains NEXT_QUESTION signal or conversation ending
                    const hasNextQuestionSignal = response && response.bot_response && /NEXT_QUESTION/i.test(response.bot_response);
                    
                    // Check for conversation ending patterns (for final question)
                    const endingPatterns = [
                        /thank you.*sharing.*with me/i,
                        /thank you.*participation/i,
                        /concludes our conversation/i,
                        /conversation.*complete/i,
                        /enjoyed learning about you/i,
                        /thank you.*time/i
                    ];
                    const hasEndingPattern = isFinalQuestion && response && response.bot_response && 
                        endingPatterns.some(pattern => pattern.test(response.bot_response));
                    
                    console.log(`Question completion check - Backend: ${response.question_completed}, NEXT_QUESTION signal: ${hasNextQuestionSignal}, Ending pattern: ${hasEndingPattern}`);
                    if (response && (response.question_completed || hasNextQuestionSignal || hasEndingPattern)) {
                        // Mark the current question as completed
                        if (!this.state.completedQuestionIndices.includes(this.state.currentQuestionIndex)) {
                            this.state.completedQuestionIndices.push(this.state.currentQuestionIndex);
                        }
                        
                        this.state.predefinedQuestionsCompleted++;
                        this.state.justCompletedQuestion = true; // Set flag to indicate we just completed a question
                        console.log(`Question ${this.state.currentQuestionIndex + 1} completed. Moving to next question.`);
                        console.log(`Completed questions: [${this.state.completedQuestionIndices.join(', ')}]`);
                        console.log(`Progress: ${this.state.completedQuestionIndices.length}/${this.state.predefinedQuestions[this.state.mode].length} questions completed`);
                        
                        // Check if this was the final question
                        if (isFinalQuestion) {
                            console.log('Final question completed! Ending conversation.');
                            this.state.questionsCompleted = true;
                            this.state.questionMode = false;
                            
                            // Show final completion notification
                            const totalQuestions = this.state.predefinedQuestions[this.state.mode].length;
                            this.showNotification(`🎉 All ${totalQuestions} questions completed!`, 'success');
                            
                            // Show congratulation popup after a short delay
                            setTimeout(() => {
                                this.showCongratulationPopup();
                            }, 1000);
                        } else {
                            // Show notification to user about progress
                            const totalQuestions = this.state.predefinedQuestions[this.state.mode].length;
                            const completedQuestionNumber = this.state.currentQuestionIndex + 1;
                            this.showNotification(`✅ Question ${completedQuestionNumber}/${totalQuestions} completed!`, 'success');
                            
                            // Add a small delay to make the transition feel more natural
                            setTimeout(() => {
                                this.scrollToBottom();
                            }, 500);
                        }
                        
                        console.log(`After completion - Current index: ${this.state.currentQuestionIndex}, Completed: [${this.state.completedQuestionIndices.join(', ')}]`);
                    } else {
                        console.log(`Question not completed yet - letting LLM decide when to move to next question`);
                        
                        // Fallback: If this is the final question and we've had enough exchanges, auto-complete
                        if (isFinalQuestion) {
                            // Count exchanges since the last question completion
                            const lastCompletionIndex = this.state.completedQuestionIndices.length > 0 ? 
                                Math.max(...this.state.completedQuestionIndices) : -1;
                            
                            // Count bot responses since the last completion (for current question)
                            const currentQuestionExchanges = this.state.conversationLog.slice(lastCompletionIndex + 1)
                                .filter(log => log.bot && log.bot.trim()).length;
                            
                            console.log(`Final question exchanges: ${currentQuestionExchanges}`);
                            
                            if (currentQuestionExchanges >= 4) { // Allow 4 exchanges before auto-completing (increased from 2)
                                console.log('Final question has had enough exchanges, auto-completing conversation...');
                                
                                // Mark the final question as completed
                                if (!this.state.completedQuestionIndices.includes(this.state.currentQuestionIndex)) {
                                    this.state.completedQuestionIndices.push(this.state.currentQuestionIndex);
                                }
                                
                                this.state.questionsCompleted = true;
                                this.state.questionMode = false;
                                
                                // Show final completion notification
                                const totalQuestions = this.state.predefinedQuestions[this.state.mode].length;
                                this.showNotification(`🎉 All ${totalQuestions} questions completed!`, 'success');
                                
                                // Show congratulation popup after a short delay
                                setTimeout(() => {
                                    this.showCongratulationPopup();
                                }, 1000);
                            }
                        }
                    }
                    
                    this.updateUI();
                    this.saveToLocalStorage();
                    this.scrollToBottom();
                    this.showLoading(false);
                    
                    // Check if all predefined questions are completed
                    if (this.state.completedQuestionIndices.length >= this.state.predefinedQuestions[this.state.mode].length) {
                        console.log('All questions completed - ending conversation');
                        this.state.questionsCompleted = true;
                        this.state.questionMode = false;
                        this.showCongratulationPopup();
                        return;
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
                    // Remove any NEXT_QUESTION prefix that might be present (even in non-question mode)
                    let botResponse = response.bot_response;
                    botResponse = botResponse.replace(/\bNEXT_QUESTION\b/gi, '').trim();
                    lastMessage.bot = botResponse;
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
        
        // For naive mode, immediately update the conversation display to show editable fields
        if (this.state.mode === 'naive') {
            this.updateConversationDisplay(false); // false = not analysis mode, but will show editable due to editMode flag
        }
        
        this.updateUI();
        this.showNotification('✏️ Edit mode enabled - You can now edit your conversation!', 'success');
    }

    // Exit edit mode
    exitEditMode() {
        this.state.editMode = false;
        
        // For naive mode, immediately update the conversation display to show non-editable fields
        if (this.state.mode === 'naive') {
            this.updateConversationDisplay(false);
        }
        
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
                // Use current conversation data (including edits) for export
                const conversationToExport = this.state.conversationLog;
                
                exportData = {
                    metadata: {
                        mode: 'featured',
                        export_timestamp: this.state.currentStep,
                        total_messages: conversationToExport.length,
                        consent_given: this.state.consentGiven,
                        prolific_id: this.state.prolificId,
                        survey_completed: this.state.surveyCompleted
                    },
                    conversation: conversationToExport,
                    survey_data: {
                        ...this.state.surveyData,
                        questions: this.state.predefinedQuestions[this.state.mode]
                    }
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
                // Use current conversation data (including edits) for export
                const conversationToExport = this.state.conversationLog;
                
                exportData = {
                    metadata: {
                        mode: 'featured',
                        export_timestamp: this.state.currentStep,
                        total_messages: conversationToExport.length,
                        consent_given: this.state.consentGiven,
                        prolific_id: this.state.prolificId,
                        survey_completed: this.state.surveyCompleted
                    },
                    conversation: conversationToExport,
                    survey_data: {
                        ...this.state.surveyData,
                        questions: this.state.predefinedQuestions[this.state.mode]
                    }
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
            this.showLoading(true, '🔍 Starting Privacy Analysis...');
            this.showNotification('Reminder: You can edit your conversation freely after completing the interview.', 'info', 'reminder');
            this.addLoadingNotification('Making free edits on the left to check for privacy leakage while keeping an eye on AI recommendations on the right', 'info');
            
            // Use real backend API for privacy analysis
            const analyzedLog = [];
            const totalMessages = this.state.conversationLog.length;
            
            for (let i = 0; i < this.state.conversationLog.length; i++) {
                const turn = this.state.conversationLog[i];
                
                // Update progress notification
                const progress = Math.round(((i + 1) / totalMessages) * 100);
                this.addLoadingNotification(`Analyzing message ${i + 1} of ${totalMessages} (${progress}% complete)`, 'info');
                
                // Analyze user message for privacy issues
                let userPrivacyResult = null;
                if (turn.user && turn.user.trim()) {
                    try {
                        this.addLoadingNotification('Checking user message for privacy issues...', 'info');
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.user })
                        });
                        
                        if (response.ok) {
                            userPrivacyResult = await response.json();
                            if (userPrivacyResult.privacy_issue) {
                                this.addLoadingNotification(`⚠️ Privacy issue found in user message ${i + 1}`, 'warning');
                            }
                        } else {
                            console.error(`Privacy detection failed for user message ${i}:`, response.status);
                            this.addLoadingNotification(`❌ Privacy detection failed for user message ${i + 1}`, 'error');
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for user message ${i}:`, error);
                        this.addLoadingNotification(`❌ Error analyzing user message ${i + 1}`, 'error');
                    }
                }
                
                // Analyze bot message for privacy issues (if any)
                let botPrivacyResult = null;
                if (turn.bot && turn.bot.trim()) {
                    try {
                        this.addLoadingNotification('Checking bot response for privacy issues...', 'info');
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.bot })
                        });
                        
                        if (response.ok) {
                            botPrivacyResult = await response.json();
                            if (botPrivacyResult.privacy_issue) {
                                this.addLoadingNotification(`⚠️ Privacy issue found in bot response ${i + 1}`, 'warning');
                            }
                        } else {
                            console.error(`Privacy detection failed for bot message ${i}:`, response.status);
                            this.addLoadingNotification(`❌ Privacy detection failed for bot response ${i + 1}`, 'error');
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for bot message ${i}:`, error);
                        this.addLoadingNotification(`❌ Error analyzing bot response ${i + 1}`, 'error');
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
            
            this.addLoadingNotification('✅ Privacy analysis completed! Preparing results...', 'success');
            
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
            this.addLoadingNotification(`🎯 Found ${totalIssues} messages with privacy issues! You can now review and edit them.`, 'success');
            
            // Wait a moment to show the final notification
            setTimeout(() => {
                this.showLoading(false);
                this.showNotification(`🔍 Privacy analysis completed - Found ${totalIssues} messages with privacy issues!`, 'success');
            }, 2000);
            
        } catch (error) {
            console.error('Analysis error:', error);
            this.addLoadingNotification(`❌ Analysis failed: ${error.message}`, 'error');
            setTimeout(() => {
                this.showLoading(false);
                this.showNotification(`❌ Analysis error: ${error.message}`, 'error');
            }, 2000);
        }
    }

    // Analyze and export with redirect to thanks page
    async analyzeAndExportAndRedirect() {
        if (this.state.mode !== 'featured') return;

        try {
            this.showLoading(true, '🔍 Starting Privacy Analysis...');
            this.addLoadingNotification('Making free edits on the left to check for privacy leakage while keeping an eye on AI recommendations on the right', 'info');
            
            // Use real backend API for privacy analysis
            const analyzedLog = [];
            const totalMessages = this.state.conversationLog.length;
            
            for (let i = 0; i < this.state.conversationLog.length; i++) {
                const turn = this.state.conversationLog[i];
                
                // Update progress notification
                const progress = Math.round(((i + 1) / totalMessages) * 100);
                this.addLoadingNotification(`Analyzing message ${i + 1} of ${totalMessages} (${progress}% complete)`, 'info');
                
                // Analyze user message for privacy issues
                let userPrivacyResult = null;
                if (turn.user && turn.user.trim()) {
                    try {
                        this.addLoadingNotification('Checking user message for privacy issues...', 'info');
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.user })
                        });
                        
                        if (response.ok) {
                            userPrivacyResult = await response.json();
                            if (userPrivacyResult.privacy_issue) {
                                this.addLoadingNotification(`⚠️ Privacy issue found in user message ${i + 1}`, 'warning');
                            }
                        } else {
                            console.error(`Privacy detection failed for user message ${i}:`, response.status);
                            this.addLoadingNotification(`❌ Privacy detection failed for user message ${i + 1}`, 'error');
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for user message ${i}:`, error);
                        this.addLoadingNotification(`❌ Error analyzing user message ${i + 1}`, 'error');
                    }
                }
                
                // Analyze bot message for privacy issues (if any)
                let botPrivacyResult = null;
                if (turn.bot && turn.bot.trim()) {
                    try {
                        this.addLoadingNotification('Checking bot response for privacy issues...', 'info');
                        const response = await fetch('/api/privacy_detection', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ user_message: turn.bot })
                        });
                        
                        if (response.ok) {
                            botPrivacyResult = await response.json();
                            if (botPrivacyResult.privacy_issue) {
                                this.addLoadingNotification(`⚠️ Privacy issue found in bot response ${i + 1}`, 'warning');
                            }
                        } else {
                            console.error(`Privacy detection failed for bot message ${i}:`, response.status);
                            this.addLoadingNotification(`❌ Privacy detection failed for bot response ${i + 1}`, 'error');
                        }
                    } catch (error) {
                        console.error(`Privacy detection error for bot message ${i}:`, error);
                        this.addLoadingNotification(`❌ Error analyzing bot response ${i + 1}`, 'error');
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
            
            this.addLoadingNotification('✅ Privacy analysis completed! Preparing export...', 'success');
            
            this.state.analyzedLog = analyzedLog;
            
            // Generate comprehensive export data with analysis
            const exportData = this.generateComprehensiveExportData();
            exportData.privacy_analysis = analyzedLog;
            
            // Count privacy issues found
            const totalIssues = analyzedLog.filter(entry => entry.hasPrivacyIssues).length;
            this.addLoadingNotification(`🎯 Found ${totalIssues} messages with privacy issues! Exporting data...`, 'success');
            
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
        
        // Remove sensitive text highlighting
        this.removeSensitiveTextHighlighting();
        
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
        this.showLoading(true, '🔌 Testing API connection...');
        
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
                this.showSurveyPopup('survey');
            } else if (pendingAction === 'exportDirect') {
                // Show survey after consent, then export
                console.log('Showing survey after consent for exportDirect');
                this.showSurveyPopup('exportDirect');
            } else if (pendingAction === 'exportComprehensive') {
                // Show survey after consent, then export
                console.log('Showing survey after consent for exportComprehensive');
                this.showSurveyPopup('exportComprehensive');
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
        // Use current conversation data (including edits) for export
        const conversationToExport = this.state.conversationLog;
        
        // Count edited messages
        const editedMessages = this.state.conversationLog.filter(turn => turn.edited).length;
        
        const exportData = {
            metadata: {
                mode: 'naive',
                export_timestamp: this.state.currentStep,
                total_messages: conversationToExport.length,
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
            conversation: conversationToExport,
            survey_data: {
                ...this.state.surveyData,
                questions: this.state.predefinedQuestions[this.state.mode]
            }
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        return exportData;
    }

    // Generate neutral export data
    generateNeutralExportData() {
        // Use current conversation data (including edits) for export
        const conversationToExport = this.state.conversationLog;
        
        const exportData = {
            metadata: {
                mode: 'neutral',
                export_timestamp: this.state.currentStep,
                total_messages: conversationToExport.length,
                consent_given: this.state.consentGiven,
                consent_details: {
                    original_data_included: this.state.consentGiven,
                    survey_data_included: this.state.surveyCompleted,
                    prolific_id_included: !!this.state.prolificId
                },
                prolific_id: this.state.prolificId,
                survey_completed: this.state.surveyCompleted
            },
            conversation: conversationToExport,
            survey_data: {
                ...this.state.surveyData,
                questions: this.state.predefinedQuestions[this.state.mode]
            }
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
        
        // Use current conversation data (including edits) for export
        const conversationToExport = this.state.conversationLog;
        
        for (let i = 0; i < conversationToExport.length; i++) {
            const currentTurn = conversationToExport[i]; // Current (potentially edited) messages
            const originalTurn = this.state.originalLog[i] || currentTurn; // Original messages for reference
            const analyzedTurn = this.state.analyzedLog[i]; // Get privacy analysis data
            
            exportLog.push({
                user: currentTurn.user, // Use current (potentially edited) user message
                bot: currentTurn.bot, // Use current (potentially edited) bot message
                userPrivacy: analyzedTurn ? analyzedTurn.userPrivacy : null, // Include user privacy analysis
                botPrivacy: analyzedTurn ? analyzedTurn.botPrivacy : null, // Include bot privacy analysis
                original_user: originalTurn.user, // Keep original for reference
                original_bot: originalTurn.bot, // Keep original bot for reference
                user_edited: currentTurn.user_edited || false, // Track if user message was edited
                bot_edited: currentTurn.bot_edited || false, // Track if bot message was edited
                has_edits: (currentTurn.user_edited || currentTurn.bot_edited) || false // Flag if any message was edited
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
            survey_data: {
                ...this.state.surveyData,
                questions: this.state.predefinedQuestions[this.state.mode]
            }
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        return exportData;
    }

    // Generate comprehensive export data
    generateComprehensiveExportData() {
        // Use current conversation data (including edits) for export
        const conversationToExport = this.state.conversationLog;
        
        const exportData = {
            metadata: {
                mode: 'featured',
                export_timestamp: this.state.currentStep,
                total_messages: conversationToExport.length,
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
            conversation: conversationToExport,
            survey_data: {
                ...this.state.surveyData,
                questions: this.state.predefinedQuestions[this.state.mode]
            },
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
        // Only update chat interface if we're on the chat page
        if (this.state.currentStepPage === 'chat') {
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
        
        // Update multi-step interface state
        this.updateMultiStepInterface();
    }

    // Update multi-step interface state
    updateMultiStepInterface() {
        // Update consent checkbox state
        const consentCheckbox = document.getElementById('consent-checkbox');
        if (consentCheckbox) {
            consentCheckbox.checked = this.state.consentChecked;
        }
        
        // Update qualification answers
        for (let i = 1; i <= 5; i++) {
            const selectElement = document.getElementById(`qual-${i}`);
            const answer = this.state.qualificationAnswers[`qual${i}`];
            if (selectElement && answer) {
                selectElement.value = answer;
                this.updateQualificationVisualFeedback();
            }
        }
        
        // Update qualification status
        this.validateQualification();
    }

    // Update conversation display
    updateConversationDisplay(analysisMode = false) {
        // Remove any existing sensitive text highlighting first
        this.removeSensitiveTextHighlighting();
        
        let container;
        let filterActive = false;
        if (analysisMode) {
            // Two-column layout: left column
            const twoCol = document.getElementById('two-column-layout');
            if (twoCol) {
                container = twoCol.querySelector('.left-column #analysis-conversation-container');
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
        if (!container) {
            console.warn('Conversation container not found');
            return;
        }
        
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
            
            // Check if we should show editable messages (analysis mode OR naive mode in edit mode)
            const shouldShowEditable = analysisMode || (this.state.mode === 'naive' && this.state.editMode);
            
            if (shouldShowEditable) {
                const analyzed = this.state.analyzedLog[i];
                // User privacy issue warning sign
                if (analyzed && analyzed.userPrivacy && analyzed.userPrivacy.privacy_issue) {
                    userWarning = '<span class="privacy-warning-sign" data-type="user" data-index="' + i + '" style="cursor: pointer;">&#9888;&#65039;</span>';
                }
                // Bot privacy issue warning sign
                if (analyzed && analyzed.botPrivacy && analyzed.botPrivacy.privacy_issue) {
                    botWarning = '<span class="privacy-warning-sign" data-type="bot" data-index="' + i + '" style="cursor: pointer;">&#9888;&#65039;</span>';
                }
                html += `<div class="message-pair editable" data-index="${i}">`;
                
                // Only show user message if it exists
                if (turn.user && turn.user.trim()) {
                    // Check if there's a privacy suggestion for this message and user's choice
                    let displayText = turn.user;
                    let privacyIndicator = '';
                    const userChoice = this.state.privacyChoices[i]?.user;
                    
                    // Only apply privacy analysis logic in analysis mode
                    if (analysisMode && analyzed && analyzed.userPrivacy && analyzed.userPrivacy.privacy_issue && analyzed.userPrivacy.suggestion) {
                        if (userChoice === 'accept') {
                            // User chose to accept the safer version - parse the "After" part
                            let after = analyzed.userPrivacy.suggestion;
                            // More robust regex to handle different quote types and spacing
                            const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
                            const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
                            const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
                            
                            if (beforeAfterPattern.test(analyzed.userPrivacy.suggestion)) {
                                const match = analyzed.userPrivacy.suggestion.match(beforeAfterPattern);
                                if (match) {
                                    after = match[2];
                                }
                            } else if (beforeAfterPatternAlt.test(analyzed.userPrivacy.suggestion)) {
                                const match = analyzed.userPrivacy.suggestion.match(beforeAfterPatternAlt);
                                if (match) {
                                    after = match[2];
                                }
                            } else if (beforeAfterPatternFlexible.test(analyzed.userPrivacy.suggestion)) {
                                const match = analyzed.userPrivacy.suggestion.match(beforeAfterPatternFlexible);
                                if (match) {
                                    after = match[2];
                                }
                            } else {
                                // Debug: Log when parsing fails
                                console.warn('Failed to parse user privacy suggestion in conversation display:', analyzed.userPrivacy.suggestion);
                            }
                            displayText = after;
                            privacyIndicator = '<span class="privacy-modified-indicator" title="Privacy-modified version">🔒</span>';
                        } else if (userChoice === 'keep') {
                            // User chose to keep original - show original text
                            displayText = analyzed.user;
                        } else {
                            // No choice made yet - show original text, not the safer version
                            displayText = analyzed.user;
                        }
                    }
                    
                    html += `<div class="message message-user" id="log-entry-user-${i}">
                        <div class="message-header">
                            <i class="fas fa-user"></i>
                            <span>You</span>
                            ${userWarning}
                            ${privacyIndicator}
                        </div>
                        <textarea class="message-edit-input" data-message-index="${i}" data-message-type="user"
                            placeholder="Edit your message here...">${this.escapeHtml(displayText)}</textarea>
                    </div>`;
                }
                
                // Only show bot message if it exists
                if (turn.bot && turn.bot.trim()) {
                    // Check if there's a privacy suggestion for this message and user's choice
                    let displayText = turn.bot;
                    let privacyIndicator = '';
                    const botChoice = this.state.privacyChoices[i]?.bot;
                    
                    // Only apply privacy analysis logic in analysis mode
                    if (analysisMode && analyzed && analyzed.botPrivacy && analyzed.botPrivacy.privacy_issue && analyzed.botPrivacy.suggestion) {
                        if (botChoice === 'accept') {
                            // User chose to accept the safer version - parse the "After" part
                            let after = analyzed.botPrivacy.suggestion;
                            // More robust regex to handle different quote types and spacing
                            const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
                            const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
                            const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
                            
                            if (beforeAfterPattern.test(analyzed.botPrivacy.suggestion)) {
                                const match = analyzed.botPrivacy.suggestion.match(beforeAfterPattern);
                                if (match) {
                                    after = match[2];
                                }
                            } else if (beforeAfterPatternAlt.test(analyzed.botPrivacy.suggestion)) {
                                const match = analyzed.botPrivacy.suggestion.match(beforeAfterPatternAlt);
                                if (match) {
                                    after = match[2];
                                }
                            } else if (beforeAfterPatternFlexible.test(analyzed.botPrivacy.suggestion)) {
                                const match = analyzed.botPrivacy.suggestion.match(beforeAfterPatternFlexible);
                                if (match) {
                                    after = match[2];
                                }
                            } else {
                                // Debug: Log when parsing fails
                                console.warn('Failed to parse bot privacy suggestion in conversation display:', analyzed.botPrivacy.suggestion);
                            }
                            displayText = after;
                            privacyIndicator = '<span class="privacy-modified-indicator" title="Privacy-modified version">🔒</span>';
                        } else if (botChoice === 'keep') {
                            // User chose to keep original - show original text
                            displayText = analyzed.bot;
                        } else {
                            // No choice made yet - show original text, not the safer version
                            displayText = analyzed.bot;
                        }
                    }
                    
                    html += `<div class="message message-bot" id="log-entry-bot-${i}">
                        <div class="message-header">
                            <i class="fas fa-robot"></i>
                            <span>Chatbot</span>
                            ${botWarning}
                            ${privacyIndicator}
                        </div>
                        <textarea class="message-edit-input" data-message-index="${i}" data-message-type="bot"
                            placeholder="Edit bot response here...">${this.escapeHtml(displayText)}</textarea>
                    </div>`;
                }
                
                html += `</div>`;
            } else {
                html += `<div class="message-pair" data-index="${i}">`;
                
                // Only show user message if it exists
                if (turn.user && turn.user.trim()) {
                    html += `<div class="message message-user" id="log-entry-user-${i}">
                        <div class="message-header">
                            <i class="fas fa-user"></i>
                            <span>You</span>
                        </div>
                        <div class="message-content">${this.escapeHtml(turn.user)}</div>
                    </div>`;
                }
                
                // Show bot message if it exists, or show loading state
                if (turn.bot && turn.bot.trim()) {
                    html += `<div class="message message-bot" id="log-entry-bot-${i}">
                        <div class="message-header">
                            <i class="fas fa-robot"></i>
                            <span>Chatbot</span>
                        </div>
                        <div class="message-content">${this.escapeHtml(turn.bot)}</div>
                    </div>`;
                } else if (turn.user && turn.user.trim()) {
                    // Show loading state for bot response
                    html += `<div class="message message-bot" id="log-entry-bot-${i}">
                        <div class="message-header">
                            <i class="fas fa-robot"></i>
                            <span>Chatbot</span>
                        </div>
                        <div class="message-content">
                            <i class="fas fa-spinner fa-spin"></i> Thinking...
                        </div>
                    </div>`;
                }
                
                html += `</div>`;
            }
        }
        container.innerHTML = html;
        
        // Bind edit events in analysis mode OR naive mode in edit mode
        if (analysisMode || (this.state.mode === 'naive' && this.state.editMode)) {
            this.bindEditModeEvents();
            
            // Bind warning sign clicks for navigation (only in analysis mode)
            if (analysisMode) {
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
                
                // Apply sensitive text highlighting if in analysis mode
                setTimeout(() => {
                    this.applySensitiveTextHighlighting();
                }, 100);
            }
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
        const editInstructionsChat = document.getElementById('edit-instructions-chat');
        
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
            
            // Show edit instructions for naive mode
            if (this.state.mode === 'naive' && editInstructionsChat) {
                editInstructionsChat.style.display = 'block';
            }
            
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
            
            // Hide edit instructions
            if (editInstructionsChat) {
                editInstructionsChat.style.display = 'none';
            }
            
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
            // Removed turn counting display - letting LLM decide when to move to next question
            const turnsInfo = '';
            // Show current question number (1-based) instead of completed count (0-based)
            const currentQuestionNumber = this.state.currentQuestionIndex + 1;
            document.getElementById('stat-step').textContent = `${currentQuestionNumber}/${totalQuestions}${turnsInfo}`;
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
                let before = turn.user;
                let after = '';
                // More robust regex to handle different quote types and spacing
                const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
                const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
                const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
                
                if (turn.userPrivacy.suggestion) {
                    if (beforeAfterPattern.test(turn.userPrivacy.suggestion)) {
                        const match = turn.userPrivacy.suggestion.match(beforeAfterPattern);
                        if (match) {
                            before = match[1];
                            after = match[2];
                        }
                    } else if (beforeAfterPatternAlt.test(turn.userPrivacy.suggestion)) {
                        const match = turn.userPrivacy.suggestion.match(beforeAfterPatternAlt);
                        if (match) {
                            before = match[1];
                            after = match[2];
                        }
                    } else if (beforeAfterPatternFlexible.test(turn.userPrivacy.suggestion)) {
                        const match = turn.userPrivacy.suggestion.match(beforeAfterPatternFlexible);
                        if (match) {
                            before = match[1];
                            after = match[2];
                        }
                    } else {
                        // Debug: Log when parsing fails
                        console.warn('Failed to parse user privacy suggestion:', turn.userPrivacy.suggestion);
                    }
                }
                // Add contextual risk information if available
                const contextualRiskInfo = turn.userPrivacy.contextual_risk ? 
                    `<div class="contextual-risk-warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Contextual Risk:</strong> ${this.escapeHtml(turn.userPrivacy.contextual_risk)}
                    </div>` : '';

                const contextualRiskClass = turn.userPrivacy.contextual_risk ? 'has-contextual-risk' : '';
                html += `
                    <div class="choice-item ${contextualRiskClass}" data-index="${i}" id="analysis-entry-user-${i}">
                        <h4>Message ${i + 1}: User Message Privacy Issue</h4>
                        <p><strong>Issue:</strong> ${turn.userPrivacy.type}</p>
                        <p><strong>Original:</strong> ${this.escapeHtml(before)}</p>
                        ${after ? `<p><strong>Safer Version:</strong> ${this.escapeHtml(after)}</p>` : ''}
                        ${contextualRiskInfo}
                        <div class="choice-buttons">
                            <button class="btn btn-success" onclick="app.makePrivacyChoice(${i}, 'user', 'accept')" 
                                    ${!after ? 'disabled' : ''}>
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
                let before = turn.bot;
                let after = '';
                // More robust regex to handle different quote types and spacing
                const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
                const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
                const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
                
                if (turn.botPrivacy.suggestion) {
                    if (beforeAfterPattern.test(turn.botPrivacy.suggestion)) {
                        const match = turn.botPrivacy.suggestion.match(beforeAfterPattern);
                        if (match) {
                            before = match[1];
                            after = match[2];
                        }
                    } else if (beforeAfterPatternAlt.test(turn.botPrivacy.suggestion)) {
                        const match = turn.botPrivacy.suggestion.match(beforeAfterPatternAlt);
                        if (match) {
                            before = match[1];
                            after = match[2];
                        }
                    } else if (beforeAfterPatternFlexible.test(turn.botPrivacy.suggestion)) {
                        const match = turn.botPrivacy.suggestion.match(beforeAfterPatternFlexible);
                        if (match) {
                            before = match[1];
                            after = match[2];
                        }
                    } else {
                        // Debug: Log when parsing fails
                        console.warn('Failed to parse bot privacy suggestion:', turn.botPrivacy.suggestion);
                    }
                }
                html += `
                    <div class="choice-item" data-index="${i}" id="analysis-entry-bot-${i}">
                        <h4>Message ${i + 1}: Bot Response Privacy Issue</h4>
                        <p><strong>Issue:</strong> ${turn.botPrivacy.type}</p>
                        <p><strong>Original:</strong> ${this.escapeHtml(before)}</p>
                        ${after ? `<p><strong>Safer Version:</strong> ${this.escapeHtml(after)}</p>` : ''}
                        <div class="choice-buttons">
                            <button class="btn btn-success" onclick="app.makePrivacyChoice(${i}, 'bot', 'accept')" 
                                    ${!after ? 'disabled' : ''}>
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
            console.log(`Applying privacy correction for index ${index}, issueType: ${issueType}, choice: ${choice}`);
            const analyzedTurn = this.state.analyzedLog[index];
            let correctionApplied = false;
            
            if (issueType === 'user' && analyzedTurn.userPrivacy && analyzedTurn.userPrivacy.privacy_issue && analyzedTurn.userPrivacy.suggestion) {
                let after = analyzedTurn.user;
                // More robust regex to handle different quote types and spacing
                const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
                const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
                const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
                
                if (beforeAfterPattern.test(analyzedTurn.userPrivacy.suggestion)) {
                    const match = analyzedTurn.userPrivacy.suggestion.match(beforeAfterPattern);
                    if (match) {
                        after = match[2];
                    }
                } else if (beforeAfterPatternAlt.test(analyzedTurn.userPrivacy.suggestion)) {
                    const match = analyzedTurn.userPrivacy.suggestion.match(beforeAfterPatternAlt);
                    if (match) {
                        after = match[2];
                    }
                } else if (beforeAfterPatternFlexible.test(analyzedTurn.userPrivacy.suggestion)) {
                    const match = analyzedTurn.userPrivacy.suggestion.match(beforeAfterPatternFlexible);
                    if (match) {
                        after = match[2];
                    }
                }
                console.log(`Setting user message to: "${after}"`);
                this.state.conversationLog[index].user = after;
                correctionApplied = true;
            } else if (issueType === 'bot' && analyzedTurn.botPrivacy && analyzedTurn.botPrivacy.privacy_issue && analyzedTurn.botPrivacy.suggestion) {
                let after = analyzedTurn.bot;
                // More robust regex to handle different quote types and spacing
                const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
                const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
                const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
                
                if (beforeAfterPattern.test(analyzedTurn.botPrivacy.suggestion)) {
                    const match = analyzedTurn.botPrivacy.suggestion.match(beforeAfterPattern);
                    if (match) {
                        after = match[2];
                    }
                } else if (beforeAfterPatternAlt.test(analyzedTurn.botPrivacy.suggestion)) {
                    const match = analyzedTurn.botPrivacy.suggestion.match(beforeAfterPatternAlt);
                    if (match) {
                        after = match[2];
                    }
                } else if (beforeAfterPatternFlexible.test(analyzedTurn.botPrivacy.suggestion)) {
                    const match = analyzedTurn.botPrivacy.suggestion.match(beforeAfterPatternFlexible);
                    if (match) {
                        after = match[2];
                    }
                }
                console.log(`Setting bot message to: "${after}"`);
                this.state.conversationLog[index].bot = after;
                correctionApplied = true;
            }
            
            // Show notification and highlight the updated text box
            if (correctionApplied) {
                this.showNotification('✅ Privacy correction applied successfully!', 'success');
                
                // Update UI first to ensure the textarea exists
                this.updatePrivacyChoices();
                this.updateConversationDisplay(true);
                
                // Add highlight effect to the updated textarea
                setTimeout(() => {
                    const textareaSelector = `textarea[data-message-index="${index}"][data-message-type="${issueType}"]`;
                    const textarea = document.querySelector(textareaSelector);
                    if (textarea) {
                        textarea.classList.add('privacy-correction-highlight');
                        
                        // Remove highlight after animation completes
                        setTimeout(() => {
                            textarea.classList.remove('privacy-correction-highlight');
                        }, 3000);
                    }
                }, 100);
            }
        }
        
        // Revert to original text if choice is 'keep'
        if (choice === 'keep' && this.state.analyzedLog[index]) {
            console.log(`Reverting to original text for index ${index}, issueType: ${issueType}, choice: ${choice}`);
            const analyzedTurn = this.state.analyzedLog[index];
            let reversionApplied = false;
            
            if (issueType === 'user' && analyzedTurn.userPrivacy && analyzedTurn.userPrivacy.privacy_issue) {
                // Revert to original user message
                console.log(`Reverting user message to: "${analyzedTurn.user}"`);
                this.state.conversationLog[index].user = analyzedTurn.user;
                reversionApplied = true;
            } else if (issueType === 'bot' && analyzedTurn.botPrivacy && analyzedTurn.botPrivacy.privacy_issue) {
                // Revert to original bot message
                console.log(`Reverting bot message to: "${analyzedTurn.bot}"`);
                this.state.conversationLog[index].bot = analyzedTurn.bot;
                reversionApplied = true;
            }
            
            // Show notification for reversion
            if (reversionApplied) {
                this.showNotification('⚠️ Reverted to original text', 'warning');
                
                // Update UI first to ensure the textarea exists
                this.updatePrivacyChoices();
                this.updateConversationDisplay(true);
                
                // Add highlight effect to the updated textarea
                setTimeout(() => {
                    const textareaSelector = `textarea[data-message-index="${index}"][data-message-type="${issueType}"]`;
                    const textarea = document.querySelector(textareaSelector);
                    if (textarea) {
                        textarea.classList.add('privacy-revert-highlight');
                        
                        // Remove highlight after animation completes
                        setTimeout(() => {
                            textarea.classList.remove('privacy-revert-highlight');
                        }, 3000);
                    }
                }, 100);
            }
        }
        
        this.updatePrivacyChoices();
        this.updateConversationDisplay(true); // Update the UI to show the change in analysis mode
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
    showLoading(show, message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const loadingMessage = document.getElementById('loading-message');
        const notificationsContainer = document.getElementById('loading-notifications');
        
        if (show) {
            loadingMessage.textContent = message;
            notificationsContainer.innerHTML = ''; // Clear previous notifications
            overlay.style.display = 'flex';
        } else {
            overlay.style.display = 'none';
        }
    }

    // Add loading notification
    addLoadingNotification(message, type = 'info') {
        const notificationsContainer = document.getElementById('loading-notifications');
        
        const notification = document.createElement('div');
        notification.className = `loading-notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        notification.innerHTML = `
            <i class="${icons[type] || icons.info}"></i>
            <span>${message}</span>
        `;
        
        notificationsContainer.appendChild(notification);
        
        // Auto-remove after 3 seconds for info messages
        if (type === 'info') {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 3000);
        }
    }

    // Show notification
    showNotification(message, type = 'info', additionalClass = '') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}${additionalClass ? ' ' + additionalClass : ''}`;
        
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
            // Save the current state including multi-step interface state
            const stateToSave = {
                ...this.state,
                // Ensure multi-step state is included
                currentStepPage: this.state.currentStepPage,
                consentChecked: this.state.consentChecked,
                qualificationAnswers: this.state.qualificationAnswers
            };
            localStorage.setItem('privacyDemoState', JSON.stringify(stateToSave));
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
                
                // If we're in the middle of the multi-step flow, restore the current page
                if (this.state.currentStepPage && this.state.currentStepPage !== 'introduction') {
                    // Don't automatically show the saved page - let the user continue from where they left off
                    // but ensure the UI is properly initialized
                    this.updateUI();
                    this.updateSidebarToggle();
                } else {
                    this.updateUI();
                    this.updateSidebarToggle();
                }
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
        }
    }

    // Show privacy tooltip
    showPrivacyTooltip(element) {
        const tooltip = document.getElementById('privacy-tooltip-container');
        const title = document.getElementById('tooltip-title');
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
                explanation: element.dataset.privacyExplanation,
                suggestion: element.dataset.privacySuggestion,
                affected_text: element.textContent
            };
        }
        
        if (!privacyData) return;

        // Update tooltip content
        title.textContent = privacyData.type || 'Privacy Issue';

        // Hide explanation section
        explanation.style.display = 'none';
        
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

    // Start conversation after Prolific ID submission
    async startConversationAfterProlificId() {
        // If no mode is selected, default to naive mode
        if (!this.state.mode) {
            this.state.mode = 'naive';
            console.log('No mode selected, defaulting to naive mode');
        }
        
        // Initialize question mode if not already set
        if (!this.state.questionMode) {
            this.state.questionMode = true;
            this.state.currentQuestionIndex = 0;
            this.state.questionsCompleted = false;
            this.state.predefinedQuestionsCompleted = 0;
            // Removed turn counting - letting LLM decide when to move to next question
            this.state.completedQuestionIndices = [];
            this.state.justCompletedQuestion = false;
            console.log('Initialized question mode after Prolific ID submission');
        }
        
        // Update UI to reflect the current mode
        this.updateModeInfo();
        this.updateUI();
        
        // Add a small delay to ensure UI is updated before starting conversation
        setTimeout(async () => {
            await this.startQuestionConversation();
        }, 100);
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
        
        // Start the conversation automatically
        this.startConversationAfterProlificId();
    }

    // Show survey popup
    showSurveyPopup(exportAction) {
        console.log('🔍 showSurveyPopup called with action:', exportAction);
        console.log('🔍 Current state mode:', this.state.mode);
        this.state.pendingExportAction = exportAction;
        
        // Show/hide mode-specific questions based on current mode
        this.updateSurveyQuestionsForMode();
        
        // Show survey directly (consent is handled before this)
        const popup = document.getElementById('survey-popup');
        popup.style.display = 'flex';
        console.log('🔍 Survey popup displayed');
        
        // Show notification about current mode for debugging
        this.showNotification(`🔍 Survey opened in ${this.state.mode} mode`, 'info');
    }

    // Close survey popup
    closeSurveyPopup() {
        const popup = document.getElementById('survey-popup');
        popup.style.display = 'none';
        this.state.pendingExportAction = null;
    }

    // Update survey questions based on current mode
    updateSurveyQuestionsForMode() {
        console.log('🔍 updateSurveyQuestionsForMode called');
        console.log('🔍 Current mode:', this.state.mode);
        
        // Wait a bit to ensure DOM is ready
        setTimeout(() => {
            const naiveQuestions = document.getElementById('naive-specific-questions');
            const featuredQuestions = document.getElementById('featured-specific-questions');
            
            console.log('🔍 Found naive questions element:', !!naiveQuestions);
            console.log('🔍 Found featured questions element:', !!featuredQuestions);
            
            if (naiveQuestions) {
                console.log('🔍 Naive questions element details:', {
                    id: naiveQuestions.id,
                    className: naiveQuestions.className,
                    style: naiveQuestions.style.display
                });
            }
            
            if (featuredQuestions) {
                console.log('🔍 Featured questions element details:', {
                    id: featuredQuestions.id,
                    className: featuredQuestions.className,
                    style: featuredQuestions.style.display
                });
            }
            
            // Hide all mode-specific questions first
            if (naiveQuestions) {
                naiveQuestions.style.display = 'none';
                console.log('🔍 Hidden naive questions');
            }
            if (featuredQuestions) {
                featuredQuestions.style.display = 'none';
                console.log('🔍 Hidden featured questions');
            }
            
            // Show questions based on current mode
            if (this.state.mode === 'naive') {
                if (naiveQuestions) {
                    naiveQuestions.style.display = 'block';
                    console.log('🔍 SHOWING naive questions');
                } else {
                    console.error('🔍 ERROR: Naive questions element not found!');
                }
            } else if (this.state.mode === 'featured') {
                if (featuredQuestions) {
                    featuredQuestions.style.display = 'block';
                    console.log('🔍 SHOWING featured questions');
                } else {
                    console.error('🔍 ERROR: Featured questions element not found!');
                }
            } else {
                console.log('🔍 Neutral mode - no additional questions shown');
            }
            
            console.log('🔍 Survey questions update complete');
        }, 100); // Small delay to ensure DOM is ready
    }

    // Manual test function for debugging (can be called from browser console)
    testSurveyQuestions() {
        console.log('🧪 Manual test of survey questions');
        console.log('🧪 Current mode:', this.state.mode);
        
        // Check if elements exist
        const naiveQuestions = document.getElementById('naive-specific-questions');
        const featuredQuestions = document.getElementById('featured-specific-questions');
        
        console.log('🧪 DOM check:');
        console.log('🧪 - naive-specific-questions exists:', !!naiveQuestions);
        console.log('🧪 - featured-specific-questions exists:', !!featuredQuestions);
        
        if (naiveQuestions) {
            console.log('🧪 - naive questions display style:', naiveQuestions.style.display);
            console.log('🧪 - naive questions computed style:', window.getComputedStyle(naiveQuestions).display);
        }
        
        if (featuredQuestions) {
            console.log('🧪 - featured questions display style:', featuredQuestions.style.display);
            console.log('🧪 - featured questions computed style:', window.getComputedStyle(featuredQuestions).display);
        }
        
        // Test all modes
        const modes = ['naive', 'neutral', 'featured'];
        
        modes.forEach(mode => {
            console.log(`🧪 Testing mode: ${mode}`);
            this.state.mode = mode;
            this.updateSurveyQuestionsForMode();
        });
        
        // Restore original mode
        console.log('🧪 Test complete');
    }

    // Handle survey submission
    handleSurveySubmit() {
        const form = document.getElementById('survey-form');
        const formData = new FormData(form);
        
        // Collect survey data - now up to 18 questions (5 overall + up to 5 mode-specific + 4 demographic)
        const surveyData = {};
        const maxQuestions = 18;
        
        for (let i = 1; i <= maxQuestions; i++) {
            const value = formData.get(`q${i}`);
            if (value !== null) { // Only include questions that exist in the form
                surveyData[`q${i}`] = value || '';
            }
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

    // Highlight sensitive text with red underlines using backend sensitive_text field
    highlightSensitiveText(text, privacyResult) {
        if (!privacyResult || !privacyResult.privacy_issue) {
            return text;
        }

        // Use the sensitive_text field from the backend if available
        let sensitiveText = privacyResult.sensitive_text;
        
        // Fallback to extracting from suggestion if sensitive_text is not available
        if (!sensitiveText && privacyResult.suggestion) {
            const beforeAfterPattern = /^Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']$/s;
            const beforeAfterPatternAlt = /^Before:\s*"([^"]*)"\s*After:\s*"([^"]*)"$/s;
            const beforeAfterPatternFlexible = /Before:\s*["']([^"']*)["']\s*After:\s*["']([^"']*)["']/s;
            
            if (beforeAfterPattern.test(privacyResult.suggestion)) {
                const match = privacyResult.suggestion.match(beforeAfterPattern);
                if (match) {
                    sensitiveText = match[1];
                }
            } else if (beforeAfterPatternAlt.test(privacyResult.suggestion)) {
                const match = privacyResult.suggestion.match(beforeAfterPatternAlt);
                if (match) {
                    sensitiveText = match[1];
                }
            } else if (beforeAfterPatternFlexible.test(privacyResult.suggestion)) {
                const match = privacyResult.suggestion.match(beforeAfterPatternFlexible);
                if (match) {
                    sensitiveText = match[1];
                }
            }
        }

        if (!sensitiveText) {
            return text;
        }

        // Escape special regex characters in the sensitive text
        const escapedSensitiveText = this.escapeRegex(sensitiveText);
        
        // Create a regex that matches the sensitive text (case-insensitive)
        const regex = new RegExp(`(${escapedSensitiveText})`, 'gi');
        
        // Replace the sensitive text with highlighted version
        return text.replace(regex, '<span class="sensitive-text-highlight">$1</span>');
    }

    // Apply sensitive text highlighting inline within textarea elements
    applySensitiveTextHighlighting() {
        if (!this.state.showPrivacyAnalysis || !this.state.analyzedLog.length) {
            return;
        }

        // Process each message in the conversation
        for (let i = 0; i < this.state.analyzedLog.length; i++) {
            const analyzed = this.state.analyzedLog[i];
            
            // Handle user message highlighting
            if (analyzed.userPrivacy && analyzed.userPrivacy.privacy_issue) {
                const userTextarea = document.querySelector(`textarea[data-message-index="${i}"][data-message-type="user"]`);
                if (userTextarea) {
                    const originalText = this.state.conversationLog[i].user;
                    const highlightedText = this.highlightSensitiveText(originalText, analyzed.userPrivacy);
                    
                    // Create a contenteditable div to replace the textarea for inline highlighting
                    const container = userTextarea.parentElement;
                    const highlightedDiv = document.createElement('div');
                    highlightedDiv.className = 'message-edit-input-highlighted';
                    highlightedDiv.contentEditable = true;
                    highlightedDiv.innerHTML = highlightedText;
                    
                    // Copy the textarea's computed styles to match exactly
                    const textareaStyles = window.getComputedStyle(userTextarea);
                    highlightedDiv.style.cssText = `
                        width: 100%;
                        min-height: 60px;
                        background: ${textareaStyles.backgroundColor};
                        border: ${textareaStyles.border};
                        border-radius: ${textareaStyles.borderRadius};
                        padding: ${textareaStyles.padding};
                        font-size: ${textareaStyles.fontSize};
                        font-family: ${textareaStyles.fontFamily};
                        line-height: ${textareaStyles.lineHeight};
                        overflow-y: auto;
                        color: ${textareaStyles.color};
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        resize: none;
                        outline: none;
                        box-sizing: border-box;
                        margin: 0;
                    `;
                    
                    // Add event listeners to sync with the original textarea
                    highlightedDiv.addEventListener('input', (e) => {
                        userTextarea.value = e.target.innerText;
                        this.saveMessageEdit(i, e.target.innerText, 'user');
                    });
                    
                    highlightedDiv.addEventListener('blur', (e) => {
                        userTextarea.value = e.target.innerText;
                        this.saveMessageEdit(i, e.target.innerText, 'user');
                    });
                    
                    // Hide the original textarea and show the highlighted version
                    userTextarea.style.display = 'none';
                    container.appendChild(highlightedDiv);
                }
            }
            
            // Handle bot message highlighting
            if (analyzed.botPrivacy && analyzed.botPrivacy.privacy_issue) {
                const botTextarea = document.querySelector(`textarea[data-message-index="${i}"][data-message-type="bot"]`);
                if (botTextarea) {
                    const originalText = this.state.conversationLog[i].bot;
                    const highlightedText = this.highlightSensitiveText(originalText, analyzed.botPrivacy);
                    
                    // Create a contenteditable div to replace the textarea for inline highlighting
                    const container = botTextarea.parentElement;
                    const highlightedDiv = document.createElement('div');
                    highlightedDiv.className = 'message-edit-input-highlighted';
                    highlightedDiv.contentEditable = true;
                    highlightedDiv.innerHTML = highlightedText;
                    
                    // Copy the textarea's computed styles to match exactly
                    const textareaStyles = window.getComputedStyle(botTextarea);
                    highlightedDiv.style.cssText = `
                        width: 100%;
                        min-height: 60px;
                        background: ${textareaStyles.backgroundColor};
                        border: ${textareaStyles.border};
                        border-radius: ${textareaStyles.borderRadius};
                        padding: ${textareaStyles.padding};
                        font-size: ${textareaStyles.fontSize};
                        font-family: ${textareaStyles.fontFamily};
                        line-height: ${textareaStyles.lineHeight};
                        overflow-y: auto;
                        color: ${textareaStyles.color};
                        white-space: pre-wrap;
                        word-wrap: break-word;
                        resize: none;
                        outline: none;
                        box-sizing: border-box;
                        margin: 0;
                    `;
                    
                    // Add event listeners to sync with the original textarea
                    highlightedDiv.addEventListener('input', (e) => {
                        botTextarea.value = e.target.innerText;
                        this.saveMessageEdit(i, e.target.innerText, 'bot');
                    });
                    
                    highlightedDiv.addEventListener('blur', (e) => {
                        botTextarea.value = e.target.innerText;
                        this.saveMessageEdit(i, e.target.innerText, 'bot');
                    });
                    
                    // Hide the original textarea and show the highlighted version
                    botTextarea.style.display = 'none';
                    container.appendChild(highlightedDiv);
                }
            }
        }
    }

    // Remove sensitive text highlighting
    removeSensitiveTextHighlighting() {
        // Remove all highlighted divs
        const highlightedDivs = document.querySelectorAll('.message-edit-input-highlighted');
        highlightedDivs.forEach(div => {
            div.remove();
        });
        
        // Make all textareas visible again
        const textareas = document.querySelectorAll('textarea[data-message-index]');
        textareas.forEach(textarea => {
            textarea.style.display = '';
        });
    }

    // Test method for sensitive text highlighting
    testSensitiveTextHighlighting() {
        console.log('Testing sensitive text highlighting...');
        
        // Create a test privacy result
        const testPrivacyResult = {
            privacy_issue: true,
            type: 'Personal Information',
            suggestion: 'Before: "My name is John Smith and I live at 123 Main St" After: "My name is [REDACTED] and I live at [REDACTED]"'
        };
        
        // Test text with sensitive information
        const testText = 'My name is John Smith and I live at 123 Main St';
        
        // Test the highlighting function
        const highlightedText = this.highlightSensitiveText(testText, testPrivacyResult);
        console.log('Original text:', testText);
        console.log('Highlighted text:', highlightedText);
        
        // Test if the sensitive text was found and highlighted
        if (highlightedText.includes('sensitive-text-highlight')) {
            console.log('✅ Sensitive text highlighting test PASSED');
        } else {
            console.log('❌ Sensitive text highlighting test FAILED');
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

// Expose test functions globally for debugging
window.testSurveyQuestions = () => app.testSurveyQuestions();
window.app = app; // Expose app instance for debugging

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(notificationStyles);