# Quick Start Guide - User Agent Tests

## 🚀 Get Started in 3 Steps

### Step 1: Start the Backend Server
```bash
cd backend
node server.js
```
**Keep this running in a separate terminal window!**

### Step 2: Run the Test
In a new terminal window:
```bash
cd backend
node test-user-agent-detailed.js
```

### Step 3: Watch the Magic Happen! 🎉
The test will automatically:
- Answer all 3 background questions
- Answer all 7 main questions  
- Handle follow-up questions automatically
- Show detailed logs and audit results
- Provide comprehensive test summary

## 📋 What You'll See

The test simulates a realistic user going through the complete interview process:

**Background Questions (3):**
- Educational background
- Current work experience  
- Interest in GenAI tools

**Main Questions (7):**
- Specific GenAI usage examples
- Types of AI-assisted tasks
- Live interview AI usage
- Competitive advantages
- Close calls and ethical issues
- Crossing boundaries
- Private AI usage

**Follow-up Questions:**
- Automatically generated and answered
- Realistic user responses
- Comprehensive coverage

## 🔧 Alternative Ways to Run

### Windows Batch File
```bash
run-user-agent-test.bat
```

### PowerShell Script
```powershell
.\run-user-agent-test.ps1
```

### Quick Validation (No API calls)
```bash
node test-user-agent-quick.js
```

## 📊 Expected Output

```
================================================================================
🧪 DETAILED USER AGENT FLOW TEST
================================================================================
📝 Test Session ID: test-detailed-flow-1234567890
⏰ Started at: 2024-01-15T10:30:00.000Z
🌐 Target URL: http://localhost:3000
================================================================================

🔄 PHASE 1: Background Questions
──────────────────────────────────────────────────

[2024-01-15T10:30:01.000Z] [INFO] 📋 Processing Background Question 1/3
[2024-01-15T10:30:01.000Z] [INFO] Question: Tell me about your educational background...
[2024-01-15T10:30:01.000Z] [INFO] User Response: I studied Computer Science at UCLA...
[2024-01-15T10:30:01.000Z] [INFO] 📤 Making API request to http://localhost:3000/api/chat
[2024-01-15T10:30:02.000Z] [INFO] 📥 API response received in 1000ms
[2024-01-15T10:30:02.000Z] [INFO] 🤖 Bot Response: Thank you for sharing your educational background...
[2024-01-15T10:30:02.000Z] [INFO] 📊 Question Completed: true
[2024-01-15T10:30:02.000Z] [INFO] 🔍 Audit Result: Available
[2024-01-15T10:30:02.000Z] [INFO] 📈 Audit Scores: {completeness: 0.9, relevance: 0.95}
[2024-01-15T10:30:02.000Z] [INFO] ✅ Audit Verdict: ALLOW_NEXT_QUESTION

... (continues for all questions)

🎉 TEST COMPLETED SUCCESSFULLY!
================================================================================
📊 Test Summary: {
  totalSteps: 25,
  totalRequests: 25,
  successfulRequests: 25,
  failedRequests: 0,
  backgroundQuestions: 3,
  mainQuestions: 7,
  followUps: 15,
  totalDuration: "300000ms",
  averageRequestTime: "12000ms"
}
```

## ⚠️ Troubleshooting

### "Cannot connect to server"
- Make sure `node server.js` is running
- Check if port 3000 is available
- Verify no firewall blocking the connection

### "Module not found: axios"
- Run `npm install axios` in the backend directory

### "Server already in use"
- Stop other services using port 3000
- Or change the port in server.js

## 🎯 What This Tests

1. **Complete User Flow**: Simulates real user behavior
2. **Question Progression**: Tests the orchestrator state management
3. **Audit System**: Validates question completion auditing
4. **Follow-up Handling**: Tests automatic follow-up question processing
5. **Session Management**: Verifies session persistence
6. **API Reliability**: Tests the complete chat API endpoint
7. **Performance**: Measures response times and success rates

## 📈 Test Results Analysis

The test provides comprehensive metrics:
- **Success Rate**: Percentage of successful API calls
- **Performance**: Average response times
- **Audit Results**: Question completion scores and verdicts
- **Flow Completion**: Whether all questions were processed
- **Error Handling**: Any failures and their causes

## 🔄 Running Multiple Tests

You can run the test multiple times to:
- Test different scenarios
- Validate consistency
- Measure performance variations
- Debug specific issues

Each test run gets a unique session ID for isolation.

## 📝 Customization

Want to test different responses? Edit `userResponses` in the test file:
```javascript
const userResponses = {
  background: [
    {
      question: "Your custom question",
      response: "Your custom response"
    }
  ],
  // ... more questions
};
```

## 🎉 Ready to Test?

1. **Start the server**: `node server.js`
2. **Run the test**: `node test-user-agent-detailed.js`
3. **Watch the logs**: See the complete user journey
4. **Analyze results**: Review audit scores and performance

**Happy testing! 🚀**

