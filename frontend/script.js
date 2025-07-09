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
            isDetecting: false
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

        document.getElementById('close-analysis').addEventListener('click', () => {
            this.closePrivacyAnalysis();
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

        // Skip API call for mode setting - focus on frontend functionality
        this.updateModeInfo();
        this.updateUI();
        this.saveToLocalStorage();
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
        // Create warning indicator
        const warning = document.createElement('div');
        warning.id = 'realtime-warning';
        warning.style.position = 'fixed';
        warning.style.top = '20px';
        warning.style.right = '20px';
        warning.style.backgroundColor = '#dc3545';
        warning.style.color = 'white';
        warning.style.padding = '10px 15px';
        warning.style.borderRadius = '8px';
        warning.style.zIndex = '1000';
        warning.style.fontSize = '14px';
        warning.style.fontWeight = 'bold';
        warning.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
        warning.style.animation = 'slideIn 0.3s ease-out';
        warning.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            Privacy Issue Detected: ${privacyResult.type}
            <button onclick="window.app.clearRealTimeDetection()" style="background: none; border: none; color: white; margin-left: 10px; cursor: pointer;">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(warning);
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
            // Mock API call for reset
            setTimeout(() => {
                this.state.conversationLog = [];
                this.state.currentStep = 0;
                this.state.editMode = false;
                this.state.editableLog = [];
                this.state.analyzedLog = [];
                this.state.showPrivacyAnalysis = false;
                this.state.privacyChoices = {};
                this.state.originalLog = [];

                this.updateUI();
                this.saveToLocalStorage();
                this.showNotification('🔄 Conversation reset successfully', 'success');
            }, 300);
            
        } catch (error) {
            console.error('Reset error:', error);
            this.showNotification('❌ Failed to reset conversation', 'error');
        }
    }

    // Send message
    async sendMessage() {
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

    // Enter edit mode (naive mode only)
    enterEditMode() {
        if (this.state.mode !== 'naive') return;
        
        this.state.editMode = true;
        this.state.originalLog = JSON.parse(JSON.stringify(this.state.conversationLog));
        this.updateUI();
        this.showNotification('✏️ Edit mode enabled - All messages are now editable!', 'success');
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
                        consent_given: this.state.consentGiven
                    },
                    conversation: this.state.conversationLog
                };

                // Include original conversation if consent was given
                if (this.state.consentGiven && this.state.originalLog.length > 0) {
                    exportData.original_conversation = this.state.originalLog;
                }
            }

            const filename = `conversation_log_${this.state.currentStep}.json`;
            API.downloadFile(JSON.stringify(exportData, null, 2), filename);
            this.showNotification('📥 Export completed', 'success');
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('❌ Export failed', 'error');
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

    // Comprehensive export for featured mode
    async exportComprehensive() {
        try {
            const filename = `conversation_log_comprehensive_${this.state.currentStep}.json`;
            
            // Create comprehensive export data that includes everything
            const exportData = this.generateComprehensiveExportData();
            
            API.downloadFile(JSON.stringify(exportData, null, 2), filename);
            this.showNotification('📥 Comprehensive export completed', 'success');
        } catch (error) {
            console.error('Comprehensive export error:', error);
            this.showNotification('❌ Export failed', 'error');
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
            
            if (pendingAction === 'exportDirect') {
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
                this.showNotification('✅ Privacy correction applied', 'success');
            }, 300);
            
        } catch (error) {
            console.error('Apply correction error:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
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
                consent_given: this.state.consentGiven
            },
            conversation: this.state.conversationLog
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
                consent_given: this.state.consentGiven
            },
            conversation: this.state.conversationLog
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
                bot: currentTurn.bot,
                userPrivacy: analyzedTurn ? analyzedTurn.userPrivacy : null, // Include user privacy analysis
                botPrivacy: analyzedTurn ? analyzedTurn.botPrivacy : null, // Include bot privacy analysis
                original_user: analyzedTurn ? analyzedTurn.user : currentTurn.user, // Keep original for reference
                has_edits: analyzedTurn && analyzedTurn.user !== currentTurn.user // Flag if message was edited
            });
        }
        
        const exportData = {
            metadata: {
                mode: 'featured_with_analysis',
                export_timestamp: this.state.currentStep,
                total_messages: exportLog.length,
                privacy_issues: this.state.analyzedLog.filter(turn => turn.hasPrivacyIssues).length,
                has_edits: this.state.editMode,
                export_type: 'analysis_with_edits',
                consent_given: this.state.consentGiven
            },
            conversation: exportLog,
            privacy_analysis: this.state.analyzedLog
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
        }

        return exportData;
    }

    // Generate comprehensive export data for featured mode
    generateComprehensiveExportData() {
        const finalLog = [];
        
        for (let i = 0; i < this.state.conversationLog.length; i++) {
            const currentTurn = this.state.conversationLog[i]; // Use current (potentially edited) messages
            const analyzedTurn = this.state.analyzedLog[i];
            const choices = this.state.privacyChoices[i] || {};
            
            // Use the current conversation log directly since privacy corrections are applied immediately
            finalLog.push({
                user: currentTurn.user,
                bot: currentTurn.bot,
                userPrivacy: analyzedTurn ? analyzedTurn.userPrivacy : null,
                botPrivacy: analyzedTurn ? analyzedTurn.botPrivacy : null,
                choice: choices
            });
        }
        
        const exportData = {
            metadata: {
                mode: 'featured_comprehensive',
                export_timestamp: this.state.currentStep,
                total_messages: finalLog.length,
                privacy_issues: this.state.analyzedLog.filter(turn => turn.hasPrivacyIssues).length,
                privacy_choices_made: Object.keys(this.state.privacyChoices).length,
                has_edits: this.state.editMode,
                edited_messages_count: this.state.conversationLog.filter(turn => turn.edited).length,
                consent_given: this.state.consentGiven,
                export_type: 'comprehensive_with_analysis_and_choices'
            },
            conversation: finalLog,
            privacy_analysis: this.state.analyzedLog,
            privacy_choices: this.state.privacyChoices,
            privacy_choices_summary: this.generatePrivacyChoicesSummary()
        };

        // Include original conversation if consent was given
        if (this.state.consentGiven && this.state.originalLog.length > 0) {
            exportData.original_conversation = this.state.originalLog;
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
        this.updateConversationDisplay();
        this.updateStatistics();
        this.updateExportButtons();
        this.updatePrivacyAnalysis();
        this.updateModeInfo();
        this.updateEditModeUI();
    }

    // Update conversation display
    updateConversationDisplay() {
        const container = document.getElementById('conversation-container');
        
        if (this.state.conversationLog.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-comment-dots"></i>
                    <p>Start a conversation by typing a message below!</p>
                </div>
            `;
            return;
        }

        let html = '';
        
        for (let i = 0; i < this.state.conversationLog.length; i++) {
            const turn = this.state.conversationLog[i];
            
            // User message - make editable if in edit mode
            let userContent;
            if (this.state.editMode && this.state.mode === 'featured') {
                // Create editable textarea for user message
                userContent = `<div style="position:relative;display:flex;align-items:center;gap:0.5rem;">
                    <textarea class="message-edit-input" data-message-index="${i}" 
                        placeholder="Edit your message here...">${this.escapeHtml(turn.user)}</textarea>`;
                // If privacy detected, show concise icon/marker
                if (this.state.analyzedLog[i] && this.state.analyzedLog[i].hasPrivacyIssues) {
                    userContent += `<span title="Privacy issue detected" style="font-size:1.1em;line-height:1;vertical-align:middle;color:#dc3545;">&#9888;</span>`;
                }
                userContent += `</div>`;
            } else if (this.state.editMode) {
                // Naive/neutral edit mode: just textarea
                userContent = `<textarea class="message-edit-input" data-message-index="${i}" 
                    placeholder="Edit your message here...">${this.escapeHtml(turn.user)}</textarea>`;
            } else {
                // Regular display, no privacy highlight in featured mode
                userContent = this.escapeHtml(turn.user);
            }
            
            html += `
                <div class="message">
                    <div class="message-user">
                        <div class="message-header">
                            <i class="fas fa-user"></i> User
                            ${turn.edited ? '<span class="edit-indicator"><i class="fas fa-edit"></i> Edited</span>' : ''}
                        </div>
                        <div class="message-content">${userContent}</div>
                    </div>
                    <div class="message-bot">
                        <div class="message-header">
                            <i class="fas fa-robot"></i> Bot
                        </div>
                        <div class="message-content">${this.escapeHtml(turn.bot)}</div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Add event listeners for editable inputs if in edit mode
        if (this.state.editMode) {
            this.bindEditModeEvents();
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
                this.saveMessageEdit(parseInt(e.target.dataset.messageIndex), e.target.value);
            });
            
            // Save changes on Enter key
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.saveMessageEdit(parseInt(e.target.dataset.messageIndex), e.target.value);
                    e.target.blur();
                }
            });
        });
    }

    // Save message edit
    saveMessageEdit(messageIndex, newText) {
        if (messageIndex >= 0 && messageIndex < this.state.conversationLog.length) {
            this.state.conversationLog[messageIndex].user = newText;
            this.state.conversationLog[messageIndex].edited = true; // Mark as edited
            this.saveToLocalStorage();
            this.showNotification('✅ Message updated', 'success');
        }
    }

    // Update edit mode UI elements
    updateEditModeUI() {
        const exitEditBtn = document.getElementById('exit-edit-btn');
        
        if (this.state.editMode) {
            exitEditBtn.style.display = 'block';
        } else {
            exitEditBtn.style.display = 'none';
        }
    }

    // Update statistics
    updateStatistics() {
        document.getElementById('stat-messages').textContent = this.state.conversationLog.length;
        document.getElementById('stat-step').textContent = this.state.currentStep;
        
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
        
        if (this.state.conversationLog.length > 0) {
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
                editExportBtn.style.display = 'none';
                exportDirectBtn.style.display = 'none'; // Hide Export Direct in featured mode
                analyzeExportBtn.style.display = 'block';
            } else {
                // Neutral mode - show Export Direct
                editExportBtn.style.display = 'none';
                exportDirectBtn.style.display = 'block';
                analyzeExportBtn.style.display = 'none';
            }
        } else {
            exportButtons.style.display = 'none';
        }
    }

    // Update privacy analysis section
    updatePrivacyAnalysis() {
        const analysisSection = document.getElementById('privacy-analysis');
        
        if (this.state.showPrivacyAnalysis && this.state.analyzedLog.length > 0) {
            analysisSection.style.display = 'block';
            
            const privacyIssues = this.state.analyzedLog.filter(turn => turn.hasPrivacyIssues);
            document.getElementById('total-messages').textContent = this.state.analyzedLog.length;
            document.getElementById('privacy-issues').textContent = privacyIssues.length;
            
            this.updatePrivacyChoices();
        } else {
            analysisSection.style.display = 'none';
        }
    }

    // Update privacy choices
    updatePrivacyChoices() {
        const choicesContainer = document.getElementById('privacy-choices');
        const privacyIssues = this.state.analyzedLog.filter(turn => turn.hasPrivacyIssues);
        
        if (privacyIssues.length === 0) {
            choicesContainer.innerHTML = '<p class="text-center">✅ No privacy issues detected</p>';
            return;
        }
        
        let html = '';
        
        for (let i = 0; i < this.state.analyzedLog.length; i++) {
            const turn = this.state.analyzedLog[i];
            if (!turn.hasPrivacyIssues) continue;
            
            // Ensure privacyChoices[i] is an object
            if (!this.state.privacyChoices[i]) this.state.privacyChoices[i] = {};
            const currentChoices = this.state.privacyChoices[i];
            
            // Handle user message privacy issues
            if (turn.userPrivacy && turn.userPrivacy.privacy_issue) {
                const userChoice = currentChoices.user || 'none';
                html += `
                    <div class="choice-item">
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
                            <button class="btn btn-secondary" onclick="app.makePrivacyChoice(${i}, 'user', 'none')">
                                ❓ Undecided
                            </button>
                        </div>
                        <div class="choice-status ${userChoice}">
                            ${this.getChoiceStatusText(userChoice)}
                        </div>
                    </div>
                `;
            }
            
            // Handle bot message privacy issues
            if (turn.botPrivacy && turn.botPrivacy.privacy_issue) {
                const botChoice = currentChoices.bot || 'none';
                html += `
                    <div class="choice-item">
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
                            <button class="btn btn-secondary" onclick="app.makePrivacyChoice(${i}, 'bot', 'none')">
                                ❓ Undecided
                            </button>
                        </div>
                        <div class="choice-status ${botChoice}">
                            ${this.getChoiceStatusText(botChoice)}
                        </div>
                    </div>
                `;
            }
        }
        
        choicesContainer.innerHTML = html;
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
                return '❓ Choice: Undecided - Please make a choice before exporting';
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
        const applyBtn = document.getElementById('tooltip-apply-btn');
        const isRealTime = applyBtn.dataset.realtime === 'true';
        
        if (isRealTime) {
            // Apply suggestion to input field for real-time detection
            const chatInput = document.getElementById('chat-input');
            const originalText = applyBtn.dataset.originalText;
            const suggestionText = applyBtn.dataset.suggestionText;
            
            // Replace the original text with suggestion in the input field
            const currentValue = chatInput.value;
            const newValue = currentValue.replace(originalText, suggestionText);
            chatInput.value = newValue;
            
            // Clear real-time detection and trigger new detection
            this.clearRealTimeDetection();
            if (newValue.trim()) {
                this.handleRealTimePrivacyDetection(newValue);
            }
            
            this.showNotification('Privacy fix applied to input field!', 'success');
            this.hidePrivacyTooltip();
        } else {
            // Apply to existing message in conversation
            const messageIndex = parseInt(applyBtn.dataset.messageIndex);
            const originalText = applyBtn.dataset.originalText;
            const suggestionText = applyBtn.dataset.suggestionText;

            try {
                // Apply the correction
                const success = await this.applyPrivacyCorrection(messageIndex, originalText, suggestionText);
                
                if (success) {
                    this.showNotification('Privacy fix applied successfully!', 'success');
                    this.hidePrivacyTooltip();
                    this.updateConversationDisplay();
                } else {
                    this.showNotification('Failed to apply privacy fix', 'error');
                }
            } catch (error) {
                console.error('Error applying privacy fix:', error);
                this.showNotification('Error applying privacy fix', 'error');
            }
        }
    }
}

// Global function for privacy popup
window.closePrivacyPopup = function() {
    if (window.app) {
        window.app.closePrivacyPopup();
    }
};

// Global function for consent popup
window.closeConsentPopup = function() {
    if (window.app) {
        window.app.closeConsentPopup();
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PrivacyDemoApp();
});

// Add CSS for notifications
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(notificationStyles);