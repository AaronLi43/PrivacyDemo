# Question Presence Audit Implementation

## Summary

This implementation adds a new audit LLM feature that checks if chatbot responses include appropriate questions and regenerates responses if needed. This ensures that conversations remain engaging and interactive by maintaining a proper question-answer flow.

## Changes Made

### 1. New Functions Added

#### `auditQuestionPresence()` - `backend/server.js`
- **Purpose**: Evaluates whether a chatbot response contains appropriate questions
- **Input**: User message, AI response, current question, conversation history, flags
- **Output**: JSON object with `hasQuestion`, `reason`, `confidence`, and `shouldRegenerate` fields
- **Logic**: 
  - Checks if response contains question words or ends with question mark
  - Evaluates question relevance and appropriateness
  - Considers exceptions (final summaries, acknowledgments, etc.)
  - Returns decision on whether to regenerate response

#### `regenerateResponseWithQuestions()` - `backend/server.js`
- **Purpose**: Regenerates chatbot responses with explicit instructions to include questions
- **Input**: Original user message, original AI response, current question, conversation history, flags
- **Output**: New response with questions or null if regeneration fails
- **Logic**:
  - Uses OpenAI API to regenerate response with question-focused prompt
  - Validates that regenerated response actually contains questions
  - Provides fallback handling when regeneration fails
  - Ensures response quality and length constraints

### 2. Integration Points

#### Chat API Enhancement - `backend/server.js`
- **Location**: `/api/chat` endpoint
- **Changes**:
  - Added question presence audit after question completion audit
  - Integrated response regeneration when questions are missing
  - Added `question_presence_audit` field to response JSON
  - Added `questionPresenceResult` variable declaration

#### Audit Flow Integration
- **Sequence**: Question Completion Audit → Question Presence Audit → Response Regeneration
- **Conditions**: Only runs when `ENABLE_AUDIT_LLM` is true and in question mode
- **Confidence Threshold**: Requires confidence >= 0.7 for regeneration

### 3. New Test File

#### `frontend/test-question-presence.html`
- **Purpose**: Test the new question presence audit functionality
- **Features**:
  - Tests question presence audit evaluation
  - Tests response regeneration functionality
  - Displays audit results and bot responses
  - Provides clear success/error feedback

### 4. Documentation Updates

#### `AUDIT_LLM_README.md`
- **Updates**:
  - Added question presence audit documentation
  - Updated overview to include both audit functions
  - Added new evaluation criteria and response formats
  - Included example scenarios for question presence
  - Updated implementation details and debug information

## Technical Details

### Question Detection Logic
- **Pattern Matching**: Uses regex to detect question words and question marks
- **Question Words**: What, How, Why, When, Where, Who, Did, Do, Can, Are, Is, Could, Would, Will, Have, Has, Was, Were
- **Validation**: Ensures questions are relevant and appropriate for context

### Final Question Handling (7th Question)
- **Special Detection**: Final questions (7th question) are detected when `isFinalQuestion = true`
- **Forced Regeneration**: If the 7th question response lacks questions, it's automatically regenerated with higher confidence (0.98)
- **Question Inclusion**: The 7th question must include the actual final question before concluding
- **Exception Logic**: Only after the 7th question has been asked and answered should summaries be allowed
- **Specific Issue**: Addresses the problem where the chatbot generates responses like "That's fantastic feedback..." without including the final question

### NEXT_QUESTION Prefix Leakage Fix (6th Question)
- **Issue**: The "NEXT_QUESTION:" prefix was appearing in responses sent to users
- **Root Cause**: Incomplete prefix removal logic in the backend
- **Solution**: Enhanced prefix detection and removal with multiple regex patterns
- **Patterns**: Handles variations like "NEXT_QUESTION:", "NEXT_QUESTION", and different positions in text
- **Cleanup**: Final cleanup step removes any remaining NEXT_QUESTION text
- **System Prompt**: Updated to clarify that prefix is for internal use only

### Follow-Up Mode Handling
- **Strict Question Requirement**: When `followUpMode = true`, questions are ALWAYS required in responses
- **User Guidance**: Follow-up responses must include questions to guide users on what to say next
- **Conversation Flow**: Prevents responses that leave users unsure how to continue the conversation
- **Regeneration Logic**: Any follow-up response without questions is automatically regenerated

### Final Follow-Up Question Handling
- **Distinction**: Final follow-up questions (`isFinalQuestion = true` AND `followUpMode = true`) are different from final questions of the conversation
- **Question Requirement**: Final follow-up questions must still include questions to gather more information
- **Purpose**: These are the last follow-up questions for a specific topic, not the end of the conversation
- **Regeneration Logic**: If final follow-up questions lack questions, they are regenerated to include engaging follow-up questions

### Regeneration Process
1. **Audit Evaluation**: Determines if response needs regeneration
2. **Prompt Engineering**: Creates focused prompt for question inclusion
3. **API Call**: Uses OpenAI to generate new response
4. **Validation**: Checks that new response contains questions
5. **Fallback**: Uses original response if regeneration fails

### Exception Handling
- **Final Questions**: Must include the final question before concluding (special handling)
- **Background Questions**: More lenient question requirements
- **Follow-up Mode**: Different evaluation criteria
- **API Failures**: Graceful fallback to original response

## Configuration

### Environment Variables
- `ENABLE_AUDIT_LLM`: Controls both question completion and presence audits
- `OPENAI_API_KEY`: Required for both audit functions

### Confidence Thresholds
- **Question Completion**: 0.7 threshold for proceeding to next question
- **Question Presence**: 0.7 threshold for response regeneration

## API Response Changes

### New Fields in Chat API Response
```json
{
  "success": true,
  "bot_response": "...",
  "question_presence_audit": {
    "hasQuestion": true/false,
    "reason": "explanation",
    "confidence": 0.0-1.0,
    "shouldRegenerate": true/false
  }
}
```

## Benefits

1. **Improved Conversation Quality**: Ensures responses include engaging questions
2. **Better User Engagement**: Maintains interactive conversation flow
3. **Consistent Question Flow**: Prevents responses that don't advance the conversation
4. **Automatic Correction**: Self-corrects when questions are missing
5. **Configurable**: Can be enabled/disabled as needed
6. **Transparent**: Provides clear reasoning for regeneration decisions

## Testing

### Manual Testing
1. Open `frontend/test-question-presence.html`
2. Click "Test Question Presence Audit" to test basic functionality
3. Click "Test Response Regeneration" to test regeneration process
4. Check server logs for audit decision details

### Expected Behavior
- Responses without questions should trigger regeneration
- Regenerated responses should contain appropriate questions
- Follow-up mode responses MUST include questions to guide conversation
- **7th question (final question) MUST include the final question before concluding**
- **6th question should NOT contain "NEXT_QUESTION:" prefix in user-facing responses**
- Final follow-up questions MUST include questions to gather more information
- Background questions should have more lenient requirements
- Final summaries are only allowed after the 7th question has been asked and answered

## Future Enhancements

1. **Question Quality Metrics**: Evaluate question relevance and engagement
2. **Response Diversity**: Ensure varied question types and styles
3. **Context Awareness**: Better understanding of conversation flow
4. **Performance Optimization**: Reduce API calls for efficiency
5. **Custom Thresholds**: Configurable confidence levels per use case
