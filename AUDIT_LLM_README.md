# Audit LLM for Question Completion and Question Presence

## Overview

The Audit LLM is a secondary AI model that provides two key functions:

1. **Question Completion Evaluation**: Evaluates whether a conversation should proceed to the next question
2. **Question Presence Audit**: Checks if chatbot responses include appropriate questions and regenerates responses if needed

The Audit LLM provides an additional layer of decision-making to ensure proper question flow, prevent premature question transitions, and maintain engaging conversations with appropriate questions.

## How It Works

### Question Completion Evaluation
1. **Main LLM Decision**: The primary LLM continues the conversation and can signal "NEXT_QUESTION:" when it feels ready to move on
2. **Audit LLM Evaluation**: If the main LLM doesn't signal completion, the audit LLM evaluates the conversation
3. **Follow-up Question Generation**: When the audit LLM determines a response is insufficient, it can suggest specific follow-up questions
4. **Follow-up Mode**: The system enters follow-up mode to ask these questions before returning to the main question flow
5. **Combined Decision**: The system uses both decisions to determine when to proceed

### Question Presence Audit
1. **Response Analysis**: After generating a response, the audit LLM checks if it contains appropriate questions
2. **Question Detection**: Evaluates whether the response includes engaging questions that help continue the conversation
3. **Regeneration Decision**: If questions are missing and confidence is high, triggers response regeneration
4. **Response Regeneration**: Generates a new response with explicit instructions to include questions
5. **Validation**: Ensures the regenerated response actually contains questions before using it

## Configuration

### Environment Variables

```bash
# Enable/disable audit LLM (default: disabled)
ENABLE_AUDIT_LLM=true

# Required for both main and audit LLM
OPENAI_API_KEY=your_openai_api_key_here
```

### API Endpoints

- `GET /api/config` - Returns configuration including audit LLM status
- `POST /api/chat` - Enhanced with audit LLM evaluation

## Audit LLM Evaluation Criteria

### Question Completion Evaluation
The audit LLM evaluates based on:

1. **User Response Quality**: Has the user provided substantial information?
2. **Conversation Completeness**: Has the topic been sufficiently explored?
3. **Natural Flow**: Would moving to the next question feel natural?
4. **Information Gathering**: Has enough meaningful information been collected?

For final questions, it also checks:
- Has the AI engaged in sufficient follow-up conversation (3-4 exchanges)?
- Is the conversation ready to conclude naturally?

### Question Presence Evaluation
The audit LLM evaluates based on:

1. **Question Presence**: Does the AI response contain at least one question?
2. **Question Relevance**: Is the question relevant to the conversation context?
3. **Question Appropriateness**: Is the question appropriate for the current stage?
4. **Conversation Flow**: Does the question help move the conversation forward?

**Exceptions** (when questions are NOT required):
- When the AI is providing a final summary or conclusion
- When the AI is acknowledging information without needing more details
- When the conversation is naturally concluding
- When the AI is transitioning between topics without needing user input

## Follow-up Question Generation

When the audit LLM determines a response is insufficient, it can generate specific follow-up questions:

1. **Question Relevance**: Questions are tailored to what the user just shared
2. **Specific Examples**: Questions ask for concrete experiences and details
3. **Natural Flow**: Questions maintain conversational tone
4. **Limited Scope**: Typically 1-2 questions to avoid overwhelming the user

## Follow-up Mode

When follow-up questions are suggested:
1. **Mode Transition**: The system enters follow-up mode
2. **Question Sequence**: Follow-up questions are asked one at a time
3. **Completion Criteria**: Each follow-up question is evaluated for completion
4. **Return to Main Flow**: After follow-up questions are complete, returns to main question flow

## Response Format

### Question Completion Audit
The audit LLM returns a JSON object:

```json
{
    "shouldProceed": true/false,
    "reason": "Brief explanation of decision",
    "confidence": 0.0-1.0,
    "followUpQuestions": ["question1", "question2"]
}
```

**Note**: `followUpQuestions` is only included when `shouldProceed` is `false` and the system is not already in follow-up mode.

### Question Presence Audit
The audit LLM returns a JSON object:

```json
{
    "hasQuestion": true/false,
    "reason": "Brief explanation of decision",
    "confidence": 0.0-1.0,
    "shouldRegenerate": true/false
}
```

**Decision Guidelines**:
- `hasQuestion = false` AND `shouldRegenerate = true`: Response lacks questions and should be regenerated
- `hasQuestion = true` AND `shouldRegenerate = false`: Response has appropriate questions
- `hasQuestion = false` AND `shouldRegenerate = false`: Response doesn't need questions (exception case)

## Confidence Threshold

### Question Completion
The system only proceeds to the next question if:
- `shouldProceed` is `true`
- `confidence` is >= 0.7

### Question Presence
The system only regenerates responses if:
- `shouldRegenerate` is `true`
- `confidence` is >= 0.7

## Frontend Integration

The frontend displays audit LLM status in the sidebar and logs audit decisions in the console.

### Status Indicators

- 🔍 **Audit LLM: Enabled** - Audit LLM is active
- 🔍 **Audit LLM: Disabled** - Audit LLM is inactive

## Testing

Run the test scripts to verify functionality:

```bash
# Start the server first
npm start

# In another terminal, run the audit LLM test
node test-audit-llm.js

# Test follow-up question functionality
node test-follow-up-questions.js
```

## Benefits

1. **Consistent Question Flow**: Prevents premature question transitions
2. **Quality Control**: Ensures sufficient information is gathered
3. **Natural Conversation**: Maintains conversational flow
4. **Configurable**: Can be enabled/disabled as needed
5. **Transparent**: Provides clear reasoning for decisions

## Example Scenarios

### Question Completion Scenarios

#### Scenario 1: Brief User Response
- **User**: "I used ChatGPT once"
- **Audit Decision**: `shouldProceed: false, reason: "User provided minimal information, need more follow-up questions", followUpQuestions: ["Can you tell me about a specific time when you used AI for interview prep?", "What made you decide to try using AI in the first place?"]`

#### Scenario 2: Comprehensive Response
- **User**: "I discovered ChatGPT through a friend who was using it for interview prep. I was skeptical at first, but after trying it myself, I found it incredibly helpful for structuring my responses and practicing common questions. I used it for about 3 interviews and felt much more confident."
- **Audit Decision**: `shouldProceed: true, reason: "User provided detailed response, topic sufficiently explored"`

#### Scenario 3: Follow-up Mode
- **User**: "I used it to practice behavioral questions"
- **Audit Decision**: `shouldProceed: true, reason: "Follow-up question adequately addressed, ready to proceed"` (no additional follow-up questions since already in follow-up mode)

### Question Presence Scenarios

#### Scenario 4: Response with Good Questions
- **AI Response**: "That's fascinating! I can see how your computer science background at MIT would give you a great foundation for understanding AI tools. I'm curious about your first experience with ChatGPT - what made you decide to try it for interview preparation?"
- **Audit Decision**: `hasQuestion: true, reason: "Response includes relevant follow-up question", confidence: 0.9, shouldRegenerate: false`

#### Scenario 5: Response Without Questions (Needs Regeneration)
- **AI Response**: "That's interesting. Computer science is a great field. MIT is a prestigious university."
- **Audit Decision**: `hasQuestion: false, reason: "Response lacks engaging questions to continue conversation", confidence: 0.8, shouldRegenerate: true`

#### Scenario 6: Response Without Questions (Exception)
- **AI Response**: "Thank you so much for sharing all of this with me! I've really enjoyed learning about your background, your work at MIT, and your love for hiking. You seem like a fascinating person. This concludes our conversation - thank you for your time!"
- **Audit Decision**: `hasQuestion: false, reason: "Final summary response, no questions needed", confidence: 0.9, shouldRegenerate: false`

## Implementation Details

### Server-Side (`server.js`)

#### Question Completion Audit
- `auditQuestionCompletion()` function handles the question completion audit logic
- Enhanced to support follow-up question generation
- Integrated into the main chat flow
- Respects `ENABLE_AUDIT_LLM` environment variable
- Supports `followUpMode` parameter for follow-up question handling

#### Question Presence Audit
- `auditQuestionPresence()` function handles the question presence audit logic
- `regenerateResponseWithQuestions()` function regenerates responses with questions
- Integrated into the main chat flow after question completion audit
- Validates regenerated responses to ensure they contain questions
- Provides fallback handling when regeneration fails

### Frontend (`script.js`)

- Displays audit LLM status
- Logs audit decisions for debugging
- Integrates with existing question completion logic
- Handles follow-up mode state management
- Updates UI to show follow-up question progress
- Receives and displays question presence audit results

## Troubleshooting

### Common Issues

1. **Audit LLM not responding**: Check `OPENAI_API_KEY` and `ENABLE_AUDIT_LLM`
2. **High API costs**: Audit LLM uses additional API calls
3. **Slow responses**: Audit LLM adds latency to chat responses

### Debug Information

Check server logs for:
- `🔍 Audit LLM: ENABLED/DISABLED`
- `Calling audit LLM for question completion evaluation...`
- `Audit LLM Result: {...}`
- `Audit LLM recommends proceeding/continuing...`
- `Calling audit LLM for question presence evaluation...`
- `Question Presence Audit Result: {...}`
- `Question presence audit recommends regeneration...`
- `Response regenerated with questions via audit LLM recommendation...` 