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
            sidebarHidden: false
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

        // Conversation height slider
        document.getElementById('conversation-height').addEventListener('input', (e) => {
            this.setConversationHeight(e.target.value);
        });

        // File uploads
        document.getElementById('questions-file').addEventListener('change', (e) => {
            this.handleQuestionsUpload(e.target.files[0]);
        });

        document.getElementById('return-file').addEventListener('change', (e) => {
            this.handleReturnUpload(e.target.files[0]);
        });

        // Action buttons
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetConversation();
        });

        document.getElementById('edit-export-btn').addEventListener('click', () => {
            this.enterEditMode();
        });

        document.getElementById('export-direct-btn').addEventListener('click', () => {
            this.exportDirect();
        });

        document.getElementById('analyze-export-btn').addEventListener('click', () => {
            this.analyzeAndExport();
        });

        // Chat input
        document.getElementById('send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        document.getElementById('chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
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
        document.getElementById('export-with-choices').addEventListener('click', () => {
            this.exportWithChoices();
        });

        document.getElementById('export-with-analysis').addEventListener('click', () => {
            this.exportWithAnalysis();
        });

        document.getElementById('export-original').addEventListener('click', () => {
            this.exportOriginal();
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

        // Privacy error hover events (delegated)
        document.addEventListener('mouseenter', (e) => {
            if (e.target.classList.contains('privacy-error')) {
                this.showPrivacyTooltip(e.target);
            }
        });

        document.addEventListener('mouseleave', (e) => {
            if (e.target.classList.contains('privacy-error')) {
                this.hidePrivacyTooltip();
            }
        });

        // Close tooltip when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.privacy-tooltip') && !e.target.closest('.privacy-error')) {
                this.hidePrivacyTooltip();
            }
        });

        // Privacy popup (legacy)
        document.addEventListener('click', (e) => {
            if (e.target.closest('.privacy-error')) {
                e.preventDefault();
                this.showPrivacyPopup(e.target.closest('.privacy-error'));
            }
        });

        // Close popup on outside click
        document.addEventListener('click', (e) => {
            if (e.target.id === 'privacy-popup') {
                this.closePrivacyPopup();
            }
        });
    }

    // Set application mode
    async setMode(mode) {
        this.state.mode = mode;
        this.state.editMode = false;
        this.state.editableLog = [];
        this.state.analyzedLog = [];
        this.state.showPrivacyAnalysis = false;
        this.state.privacyChoices = {};

        try {
            await API.setMode(mode);
            this.updateModeInfo();
            this.updateUI();
            this.saveToLocalStorage();
        } catch (error) {
            console.error('Failed to set mode:', error);
            this.showNotification('Failed to set mode', 'error');
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
            neutral: '⚖️ Neutral Mode: Export conversation log without any modifications!',
            featured: '🔒 Featured Mode: Privacy analysis runs when you export the conversation log!'
        };

        modeInfo.innerHTML = `<p><strong>${modeDescriptions[this.state.mode]}</strong></p>`;
        document.getElementById('stat-mode').textContent = `${modeIcons[this.state.mode]} ${this.state.mode.charAt(0).toUpperCase() + this.state.mode.slice(1)}`;
    }

    // Set conversation height
    setConversationHeight(height) {
        this.state.conversationHeight = parseInt(height);
        document.getElementById('height-value').textContent = `${height}px`;
        document.getElementById('conversation-container').style.maxHeight = `${height}px`;
        this.saveToLocalStorage();
    }

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
    async handleQuestionsUpload(file) {
        if (!file) return;

        try {
            API.validateFile(file, ['.json']);
            const result = await API.uploadQuestions(file);
            
            if (result.success) {
                this.state.questions = result.questions || [];
                this.showNotification(`✅ Loaded ${this.state.questions.length} questions`, 'success');
                this.saveToLocalStorage();
            } else {
                this.showNotification('❌ Failed to load questions', 'error');
            }
        } catch (error) {
            console.error('Questions upload error:', error);
            this.showNotification(`❌ Error loading file: ${error.message}`, 'error');
        }
    }

    // Handle return log upload
    async handleReturnUpload(file) {
        if (!file) return;

        try {
            API.validateFile(file, ['.json']);
            const result = await API.uploadReturn(file);
            
            if (result.success) {
                this.showNotification('✅ Thank you! Your file has been received.', 'success');
            } else {
                this.showNotification('❌ Failed to upload file', 'error');
            }
        } catch (error) {
            console.error('Return upload error:', error);
            this.showNotification(`❌ Error uploading file: ${error.message}`, 'error');
        }
    }

    // Reset conversation
    async resetConversation() {
        try {
            await API.resetConversation();
            
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

            // Send to API
            const response = await API.sendMessage(message, this.state.currentStep - 1);
            
            if (response.success) {
                // Update bot response
                const lastMessage = this.state.conversationLog[this.state.conversationLog.length - 1];
                lastMessage.bot = response.bot_response;
                
                // Handle privacy detection for featured mode
                if (this.state.mode === 'featured' && response.privacy_detection) {
                    lastMessage.privacy = response.privacy_detection;
                }

                this.updateUI();
                this.saveToLocalStorage();
                this.scrollToBottom();
            } else {
                this.showNotification('❌ Failed to send message', 'error');
            }
        } catch (error) {
            console.error('Send message error:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Enter edit mode (naive mode only)
    enterEditMode() {
        if (this.state.mode !== 'naive') return;
        
        this.state.editMode = true;
        this.state.editableLog = JSON.parse(JSON.stringify(this.state.conversationLog));
        this.state.originalLog = JSON.parse(JSON.stringify(this.state.conversationLog));
        this.updateUI();
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
                exportData = this.state.conversationLog;
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
            const response = await API.analyzeLog(this.state.conversationLog);
            
            if (response.success) {
                this.state.analyzedLog = response.analyzed_log;
                this.state.showPrivacyAnalysis = true;
                this.updateUI();
                this.showNotification('🔍 Privacy analysis completed', 'success');
            } else {
                this.showNotification('❌ Privacy analysis failed', 'error');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            this.showNotification(`❌ Analysis error: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    // Export with choices
    async exportWithChoices() {
        try {
            const finalLog = this.generateFinalLogWithChoices();
            const filename = `conversation_log_with_choices_${this.state.currentStep}.json`;
            API.downloadFile(JSON.stringify(finalLog, null, 2), filename);
            this.showNotification('📥 Export with choices completed', 'success');
        } catch (error) {
            console.error('Export with choices error:', error);
            this.showNotification('❌ Export failed', 'error');
        }
    }

    // Export with analysis
    async exportWithAnalysis() {
        try {
            const filename = `conversation_log_with_privacy_analysis_${this.state.currentStep}.json`;
            API.downloadFile(JSON.stringify(this.state.analyzedLog, null, 2), filename);
            this.showNotification('📥 Export with analysis completed', 'success');
        } catch (error) {
            console.error('Export with analysis error:', error);
            this.showNotification('❌ Export failed', 'error');
        }
    }

    // Export original
    async exportOriginal() {
        try {
            const filename = `conversation_log_original_${this.state.currentStep}.json`;
            API.downloadFile(JSON.stringify(this.state.conversationLog, null, 2), filename);
            this.showNotification('📥 Original export completed', 'success');
        } catch (error) {
            console.error('Export original error:', error);
            this.showNotification('❌ Export failed', 'error');
        }
    }

    // Close privacy analysis
    closePrivacyAnalysis() {
        this.state.showPrivacyAnalysis = false;
        this.state.analyzedLog = [];
        this.state.privacyChoices = {};
        this.updateUI();
    }

    // Check API status
    async checkAPIStatus() {
        try {
            const response = await API.testConnection();
            this.state.apiConnected = response.success;
            this.updateAPIStatus();
        } catch (error) {
            this.state.apiConnected = false;
            this.updateAPIStatus();
        }
    }

    // Test API connection
    async testAPIConnection() {
        try {
            this.showLoading(true);
            const response = await API.testConnection();
            
            if (response.success) {
                this.state.apiConnected = true;
                this.showNotification('✅ API connection successful!', 'success');
            } else {
                this.state.apiConnected = false;
                this.showNotification('❌ API connection failed', 'error');
            }
        } catch (error) {
            this.state.apiConnected = false;
            this.showNotification(`❌ API connection error: ${error.message}`, 'error');
        } finally {
            this.updateAPIStatus();
            this.showLoading(false);
        }
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

    // Apply privacy correction
    async applyPrivacyCorrection(messageIndex, originalText, correctedText) {
        try {
            const response = await API.applyCorrection(parseInt(messageIndex), originalText, correctedText);
            
            if (response.success) {
                // Update the element
                const element = document.querySelector(`[data-message-index="${messageIndex}"]`);
                if (element) {
                    element.textContent = correctedText;
                    element.classList.remove('privacy-error');
                    element.classList.add('privacy-corrected');
                }
                
                this.closePrivacyPopup();
                this.showNotification('✅ Privacy correction applied', 'success');
            } else {
                this.showNotification('❌ Failed to apply correction', 'error');
            }
        } catch (error) {
            console.error('Apply correction error:', error);
            this.showNotification(`❌ Error: ${error.message}`, 'error');
        }
    }

    // Generate naive export data
    generateNaiveExportData() {
        return {
            metadata: {
                mode: 'naive',
                export_timestamp: this.state.currentStep,
                total_messages: this.state.conversationLog.length,
                has_edits: this.state.editMode
            },
            conversation: this.state.conversationLog,
            original_conversation: this.state.originalLog
        };
    }

    // Generate neutral export data
    generateNeutralExportData() {
        return {
            metadata: {
                mode: 'neutral',
                export_timestamp: this.state.currentStep,
                total_messages: this.state.conversationLog.length
            },
            conversation: this.state.conversationLog
        };
    }

    // Generate final log with choices
    generateFinalLogWithChoices() {
        const finalLog = [];
        
        for (let i = 0; i < this.state.analyzedLog.length; i++) {
            const turn = this.state.analyzedLog[i];
            const choice = this.state.privacyChoices[i];
            
            if (turn.privacy && choice === 'accept' && turn.privacy.suggestion) {
                finalLog.push({
                    user: turn.privacy.suggestion,
                    bot: turn.bot,
                    privacy: turn.privacy,
                    choice: choice
                });
            } else {
                finalLog.push({
                    user: turn.user,
                    bot: turn.bot,
                    privacy: turn.privacy,
                    choice: choice || 'none'
                });
            }
        }
        
        return {
            metadata: {
                mode: 'featured_with_choices',
                export_timestamp: this.state.currentStep,
                total_messages: finalLog.length,
                privacy_issues: Object.keys(this.state.privacyChoices).length
            },
            conversation: finalLog,
            privacy_choices: this.state.privacyChoices
        };
    }

    // Update UI
    updateUI() {
        this.updateConversationDisplay();
        this.updateStatistics();
        this.updateExportButtons();
        this.updatePrivacyAnalysis();
        this.updateModeInfo();
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
            
            // User message with enhanced privacy highlighting
            let userText = turn.user;
            if (this.state.analyzedLog[i] && this.state.analyzedLog[i].privacy) {
                const privacy = this.state.analyzedLog[i].privacy;
                const severity = privacy.severity || 'medium';
                const affectedText = privacy.affected_text || turn.user;
                
                // If we have specific affected text, highlight only that part
                if (privacy.affected_text && privacy.affected_text !== turn.user) {
                    const escapedAffectedText = this.escapeHtml(privacy.affected_text);
                    const escapedFullText = this.escapeHtml(turn.user);
                    const highlightedText = escapedFullText.replace(
                        escapedAffectedText,
                        `<span class="privacy-error severity-${severity}" 
                            data-type="${privacy.type}" 
                            data-explanation="${this.escapeHtml(privacy.explanation)}" 
                            data-suggestion="${this.escapeHtml(privacy.suggestion || '')}" 
                            data-message-index="${i}"
                            data-severity="${severity}">${escapedAffectedText}</span>`
                    );
                    userText = highlightedText;
                } else {
                    // Highlight the entire message
                    userText = `<span class="privacy-error severity-${severity}" 
                        data-type="${privacy.type}" 
                        data-explanation="${this.escapeHtml(privacy.explanation)}" 
                        data-suggestion="${this.escapeHtml(privacy.suggestion || '')}" 
                        data-message-index="${i}"
                        data-severity="${severity}">${this.escapeHtml(turn.user)}</span>`;
                }
            } else {
                userText = this.escapeHtml(turn.user);
            }
            
            html += `
                <div class="message">
                    <div class="message-user">
                        <div class="message-header">
                            <i class="fas fa-user"></i> User
                        </div>
                        <div class="message-content">${userText}</div>
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
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        const analyzeExportBtn = document.getElementById('analyze-export-btn');
        
        if (this.state.conversationLog.length > 0) {
            exportButtons.style.display = 'block';
            
            if (this.state.mode === 'naive') {
                editExportBtn.style.display = 'block';
                analyzeExportBtn.style.display = 'none';
            } else if (this.state.mode === 'featured') {
                editExportBtn.style.display = 'none';
                analyzeExportBtn.style.display = 'block';
            } else {
                editExportBtn.style.display = 'none';
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
            
            const privacyIssues = this.state.analyzedLog.filter(turn => turn.privacy);
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
        const privacyIssues = this.state.analyzedLog.filter(turn => turn.privacy);
        
        if (privacyIssues.length === 0) {
            choicesContainer.innerHTML = '<p class="text-center">✅ No privacy issues detected</p>';
            return;
        }
        
        let html = '';
        
        for (let i = 0; i < this.state.analyzedLog.length; i++) {
            const turn = this.state.analyzedLog[i];
            if (!turn.privacy) continue;
            
            const currentChoice = this.state.privacyChoices[i] || 'none';
            
            html += `
                <div class="choice-item">
                    <h4>Message ${i + 1}: Privacy Choice</h4>
                    <p><strong>Issue:</strong> ${turn.privacy.type}</p>
                    <p><strong>Explanation:</strong> ${turn.privacy.explanation}</p>
                    ${turn.privacy.suggestion ? `<p><strong>Suggestion:</strong> ${turn.privacy.suggestion}</p>` : ''}
                    
                    <div class="choice-buttons">
                        <button class="btn btn-success" onclick="app.makePrivacyChoice(${i}, 'accept')" 
                                ${!turn.privacy.suggestion ? 'disabled' : ''}>
                            ✅ Accept Suggestion
                        </button>
                        <button class="btn btn-warning" onclick="app.makePrivacyChoice(${i}, 'keep')">
                            ⚠️ Keep Original
                        </button>
                        <button class="btn btn-secondary" onclick="app.makePrivacyChoice(${i}, 'none')">
                            ❓ Undecided
                        </button>
                    </div>
                    
                    <div class="choice-status ${currentChoice}">
                        ${this.getChoiceStatusText(currentChoice)}
                    </div>
                </div>
            `;
        }
        
        choicesContainer.innerHTML = html;
    }

    // Make privacy choice
    makePrivacyChoice(index, choice) {
        if (choice === 'none') {
            delete this.state.privacyChoices[index];
        } else {
            this.state.privacyChoices[index] = choice;
        }
        
        this.updatePrivacyChoices();
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

        // Get privacy data from element
        const messageIndex = parseInt(element.dataset.messageIndex);
        const privacyData = this.state.analyzedLog[messageIndex]?.privacy;
        
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
            applyBtn.dataset.messageIndex = messageIndex;
            applyBtn.dataset.originalText = element.textContent;
            applyBtn.dataset.suggestionText = privacyData.suggestion;
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

// Global function for privacy popup
window.closePrivacyPopup = function() {
    if (window.app) {
        window.app.closePrivacyPopup();
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