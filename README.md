# Privacy-Aware Data Collection

A web application that helps collect data while protecting sensitive information. The application uses LLM to detect and synthesize sensitive information in user responses.

## Features

- Upload questionnaire in JSON format
- Text input questions with privacy analysis
- Multiple choice questions with privacy analysis
- Progress tracking
- Export answers with synthesized sensitive information

## Questionnaire JSON Format

The questionnaire should be a JSON file with the following structure:

```json
{
  "title": "Your Questionnaire Title",
  "description": "Optional description of the questionnaire",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "question": "What is your current employment status?",
      "required": true
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "question": "Which of the following best describes your work situation?",
      "options": [
        "I am a student",
        "I am employed full-time",
        "I am self-employed",
        "I am retired",
        "I am looking for work",
        "Other"
      ],
      "required": true,
      "allow_multiple": true
    }
  ]
}
```

### Field Descriptions

- `title`: The title of the questionnaire
- `description`: Optional description of the questionnaire
- `questions`: Array of question objects
  - `id`: Unique identifier for the question
  - `type`: Either "text" or "multiple_choice"
  - `question`: The question text
  - `required`: Boolean indicating if the question is required
  - `options`: Array of options (only for multiple_choice type)
  - `allow_multiple`: Boolean indicating if multiple selections are allowed (only for multiple_choice type)

## Exported Answers Format

The exported answers will be in the following JSON format:

```json
{
  "questionnaire": {
    "title": "Your Questionnaire Title",
    "description": "Optional description of the questionnaire",
    "questions": [...]
  },
  "answers": {
    "0": {
      "question": "What is your current employment status?",
      "answer": "I am currently working as a software engineer at a technology company",
      "originalAnswer": "I am currently working as a software engineer at Google",
      "type": "text"
    },
    "1": {
      "question": "Which of the following best describes your work situation?",
      "answers": [
        "I am employed full-time",
        "I work in the technology sector"
      ],
      "originalAnswers": [
        "I am employed full-time",
        "I work at Google"
      ],
      "type": "multiple_choice"
    }
  },
  "timestamp": "2024-03-14T12:00:00.000Z"
}
```

## Test Cases

Here are some example questionnaires to test the application:

### Test Case 1: Basic Employment Survey
```json
{
  "title": "Employment Survey",
  "description": "A survey about employment status and work experience",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "question": "What is your current job title and company?",
      "required": true
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "question": "How long have you been in your current role?",
      "options": [
        "Less than 1 year",
        "1-3 years",
        "3-5 years",
        "More than 5 years",
        "Other"
      ],
      "required": true,
      "allow_multiple": false
    }
  ]
}
```

### Test Case 2: Education Background
```json
{
  "title": "Education Background",
  "description": "Survey about educational history and qualifications",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "question": "What is your highest level of education and where did you study?",
      "required": true
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "question": "Which of the following degrees do you hold?",
      "options": [
        "Bachelor's Degree",
        "Master's Degree",
        "PhD",
        "Associate's Degree",
        "High School Diploma",
        "Other"
      ],
      "required": true,
      "allow_multiple": true
    }
  ]
}
```

### Test Case 3: Location and Contact
```json
{
  "title": "Location and Contact Information",
  "description": "Survey about location and preferred contact methods",
  "questions": [
    {
      "id": "q1",
      "type": "text",
      "question": "What is your current city and state of residence?",
      "required": true
    },
    {
      "id": "q2",
      "type": "multiple_choice",
      "question": "How would you prefer to be contacted?",
      "options": [
        "Email",
        "Phone",
        "Text Message",
        "Mail",
        "Other"
      ],
      "required": true,
      "allow_multiple": true
    }
  ]
}
```

## Privacy Protection

The application will detect and synthesize sensitive information such as:
- Personal identifiers (names, addresses, phone numbers)
- Company names and specific workplace information
- Educational institution names
- Specific dates and time periods
- Financial information
- Other personally identifiable information

When sensitive information is detected, the application will:
1. Highlight the sensitive text
2. Provide a synthesized version that maintains the meaning while removing sensitive details
3. Allow users to accept or ignore the suggestions
4. Store the synthesized version in the exported answers

## Running the Application

1. Start the backend server:
```bash
cd backend
uvicorn main:app --reload
```

2. Start the frontend development server:
```bash
cd frontend
npm start
```

3. Open http://localhost:3000 in your browser

4. Upload a questionnaire JSON file and start answering questions 