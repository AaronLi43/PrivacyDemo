# Chatbot Flow Test

This test file verifies that the chatbot can properly follow the first 8 predefined questions and perform followup privacy analysis using simulated user responses.

## What the Test Covers

### 1. API Connection Test
- Verifies that the backend server is running and accessible
- Tests the `/api/test_connection` endpoint

### 2. Background Questions Flow Test
- Tests the background questionnaire functionality
- Simulates user responses to background questions
- Verifies that the chatbot can handle background question transitions
- Tests the `/api/background-questions` and `/api/chat` endpoints

### 3. Main Questions Flow Test (First 8 Questions)
- Tests the main predefined questions functionality
- Simulates user responses to the first 8 questions
- Verifies question completion detection
- Tests privacy detection during conversation
- Uses the featured mode for enhanced privacy features

### 4. Privacy Analysis Test
- Tests individual message privacy detection
- Tests conversation-wide privacy analysis
- Verifies that PII (Personally Identifiable Information) is properly detected
- Tests the `/api/privacy_detection` and `/api/conversation_privacy_analysis` endpoints

### 5. Complete Conversation Flow Test
- Tests the entire conversation flow from start to finish
- Combines background questions and main questions
- Verifies end-to-end functionality
- Tests conversation analysis and privacy risk assessment

## Prerequisites

1. **Server Running**: Make sure the backend server is running on `http://localhost:3000`
2. **Dependencies**: Install the required dependencies:
   ```bash
   npm install
   ```

## Running the Test

### Option 1: Using npm script
```bash
npm test
```

### Option 2: Direct execution
```bash
node test-chatbot-flow.js
```

## Test Output

The test will provide detailed output including:

- ✅/❌ Status for each test
- Detailed progress information
- Privacy detection results
- Conversation flow verification
- Final summary with success rate

## Test Results

The test generates two types of output:

1. **Console Output**: Real-time progress and results
2. **JSON Report**: Detailed test report saved as `test-report-YYYY-MM-DD.json`

### Sample Output
```
🚀 Starting Chatbot Flow Tests...

📡 Running API Connection Test...
✅ API connection successful

🔍 Running Background Questions Flow Test...
📝 Testing 8 background questions...
  Question 1: What is your current professional field or industry?...
  Question 2: How many years of professional experience do you have?...
  ✅ Background questions flow completed successfully

🎯 Running Main Questions Flow Test (First 8 Questions)...
📝 Testing first 8 of 19 main questions...
  Question 1: How did you first come across the idea of using GenAI...
  ✅ Question 1 completed
  🔒 Privacy detection was active during conversation
✅ Main questions flow completed successfully (8/8 questions completed)

🔒 Running Privacy Analysis Test...
  Testing individual message privacy detection...
    🔍 Privacy issue detected: Full Name
    🔍 Privacy issue detected: Email Address
    🔍 Privacy issue detected: Full Address
    🔍 Privacy issue detected: Phone Number
  Testing conversation-wide privacy analysis...
    📊 Analysis completed: 3 messages with privacy issues
    🎯 Risk level: HIGH
✅ Privacy analysis completed successfully

🔄 Running Complete Conversation Flow Test...
  Starting complete conversation simulation...
    ✅ Main question 1 completed
    ✅ Main question 2 completed
    ✅ Main question 3 completed
    ✅ Main question 4 completed
  Testing conversation analysis...
✅ Complete conversation flow test passed
   📊 Background questions: 3
   📊 Main questions: 4
   🔒 Privacy analysis: MEDIUM risk level

📊 Test Results Summary:
==================================================
Total Tests: 5
Passed: 5
Failed: 0
Success Rate: 100.0%

📋 Detailed Results:
✅ API Connection Test: API connection successful
✅ Background Questions Flow Test: Successfully processed 3 background questions
✅ Main Questions Flow Test (First 8 Questions): Successfully processed 8/8 questions with privacy detection
✅ Privacy Analysis Test: Privacy analysis successful - 3 issues detected
✅ Complete Conversation Flow Test: Complete conversation flow successful

📄 Detailed report saved to: test-report-2024-01-15.json

🎯 Final Summary:
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "totalTests": 5,
  "passed": 5,
  "failed": 0,
  "successRate": "100.0%",
  "errors": []
}
```

## Test Configuration

The test uses realistic user responses that simulate actual user behavior:

### Background Questions Responses
- Professional field and experience
- Education level
- Interview experience
- AI tool familiarity
- Privacy concerns

### Main Questions Responses
- AI usage in interview preparation
- Specific examples of AI assistance
- Tools and techniques used
- Personal experiences and outcomes
- Ethical considerations

## Privacy Detection Test Cases

The test includes messages with various types of PII:
- Full names
- Email addresses
- Physical addresses
- Phone numbers
- Social security numbers (simulated)

## Troubleshooting

### Common Issues

1. **Server Not Running**
   ```
   ❌ API connection failed: connect ECONNREFUSED 127.0.0.1:3000
   ```
   Solution: Start the server with `npm start`

2. **Missing Dependencies**
   ```
   Error: Cannot find module 'axios'
   ```
   Solution: Run `npm install`

3. **Rate Limiting**
   ```
   Error: Request failed with status code 429
   ```
   Solution: The test includes delays between requests, but you may need to increase them

4. **OpenAI API Issues**
   ```
   Error: Invalid API key
   ```
   Solution: Ensure your `.env` file has a valid `OPENAI_API_KEY`

## Customization

You can modify the test by:

1. **Changing User Responses**: Edit the `userResponses` object in the test file
2. **Adding More Tests**: Extend the `runAllTests()` method
3. **Modifying Test Parameters**: Adjust delays, question counts, etc.
4. **Testing Different Modes**: Change the mode from 'featured' to 'naive' or 'neutral'

## Expected Behavior

A successful test run should show:
- All 5 tests passing
- Background questions flowing naturally
- Main questions completing properly
- Privacy detection working correctly
- Complete conversation flow functioning end-to-end
- 100% success rate 