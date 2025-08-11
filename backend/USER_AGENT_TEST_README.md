# User Agent Test Scripts

This directory contains comprehensive test scripts that simulate a user agent going through the complete question flow, including background questions, main questions, and follow-ups.

## Test Scripts Overview

### 1. `test-user-agent-detailed.js` (Recommended)
- **Purpose**: Comprehensive test with detailed logging and realistic user responses
- **Features**: 
  - Simulates all 3 background questions
  - Simulates all 7 main questions
  - Handles follow-up questions automatically
  - Detailed timestamped logging
  - Comprehensive test results summary
  - Error handling and retry logic

### 2. `test-user-agent-complete-flow.js`
- **Purpose**: Basic test with simpler flow
- **Features**:
  - Basic question flow simulation
  - Simple logging
  - Good for quick testing

## Prerequisites

1. **Backend Server Running**: Make sure your backend server is running on port 3000
   ```bash
   cd backend
   node server.js
   ```

2. **Dependencies**: Ensure axios is installed
   ```bash
   npm install axios
   ```

## Running the Tests

### Option 1: Direct Node.js execution
```bash
cd backend
node test-user-agent-detailed.js
```

### Option 2: Using the batch file (Windows)
```bash
cd backend
run-user-agent-test.bat
```

### Option 3: Using the PowerShell script (Windows)
```powershell
cd backend
.\run-user-agent-test.ps1
```

## What the Test Does

### Phase 1: Background Questions
The test simulates a user answering 3 background questions:
1. Educational background
2. Current work and interview experience
3. Interest in GenAI tools

### Phase 2: Main Questions
The test simulates a user answering 7 main questions about GenAI usage in job interviews:
1. Specific example of using GenAI for interview prep
2. Types of tasks relying on GenAI
3. Using GenAI during live interviews
4. Competitive edge from AI
5. Close calls with AI usage
6. Crossing ethical lines
7. Private AI usage

### Phase 3: Follow-up Questions
- Automatically handles follow-up questions when they appear
- Simulates realistic user responses to follow-ups
- Processes up to 2 follow-ups per main question

### Phase 4: Final Summary
- Sends a concluding message
- Captures final bot response
- Generates comprehensive test summary

## Test Output

The test provides detailed logging including:

- **Timestamps**: All actions are timestamped for debugging
- **Request/Response Details**: Full API call information
- **Audit Results**: Question completion audit scores and verdicts
- **Follow-up Processing**: Automatic handling of follow-up questions
- **Performance Metrics**: Request timing and success rates
- **Error Handling**: Detailed error information if something fails

## Sample Output Structure

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
[2024-01-15T10:35:00.000Z] [INFO] 📊 Test Summary: {
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

## Customization

### Modifying User Responses
Edit the `userResponses` object in the test file to customize the simulated user responses:

```javascript
const userResponses = {
  background: [
    {
      question: "Your custom question here",
      response: "Your custom response here"
    }
  ],
  main: [
    // ... customize main questions
  ]
};
```

### Adjusting Timing
Modify the delay values to control the pace of the test:

```javascript
await delay(1000);  // Wait 1 second between questions
await delay(500);   // Wait 0.5 seconds for follow-ups
```

### Changing Test Configuration
Modify the test configuration at the top of the file:

```javascript
const BASE_URL = 'http://localhost:3000';  // Change server URL
const TEST_SESSION_ID = 'custom-session-id';  // Custom session ID
```

## Troubleshooting

### Common Issues

1. **Server Not Running**
   - Error: `ECONNREFUSED`
   - Solution: Start the backend server with `node server.js`

2. **Missing Dependencies**
   - Error: `Cannot find module 'axios'`
   - Solution: Run `npm install axios`

3. **Port Already in Use**
   - Error: `EADDRINUSE`
   - Solution: Change the port in server.js or stop other services using port 3000

4. **API Errors**
   - Check server logs for detailed error information
   - Verify the API endpoint is working with a simple test

### Debug Mode
The test includes extensive logging. If you need more detail, you can add additional console.log statements or modify the logging level.

## Performance Considerations

- **Request Rate**: The test includes delays between requests to avoid overwhelming the server
- **Session Management**: Uses a unique session ID for each test run
- **Error Handling**: Continues testing even if individual requests fail
- **Memory Usage**: Minimal memory footprint, suitable for long test runs

## Integration with CI/CD

The test scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions step
- name: Run User Agent Test
  run: |
    cd backend
    npm install
    node test-user-agent-detailed.js
```

## Support

If you encounter issues:
1. Check the server logs for backend errors
2. Verify all dependencies are installed
3. Ensure the server is running and accessible
4. Check the test output for specific error messages

