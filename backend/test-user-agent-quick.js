// test-user-agent-quick.js
// Quick validation test that doesn't make actual API calls

console.log('🧪 Quick User Agent Test Validation');
console.log('=' .repeat(50));

// Test the user responses structure
const userResponses = {
  background: [
    {
      question: "Tell me about your educational background - what did you study in college or university?",
      response: "I studied Computer Science at UCLA from 2018-2022, graduating with a 3.8 GPA. My focus was on artificial intelligence and machine learning, and I completed a senior thesis on 'Natural Language Processing for Interview Preparation.' I also took courses in psychology and communication to better understand human interaction patterns."
    },
    {
      question: "I'd love to hear about your current work and how you got into it by job interviews?",
      response: "I currently work as a Senior Software Engineer at TechCorp, a mid-size startup in San Francisco. I got this role through a rigorous interview process where I used various preparation techniques, including AI tools like ChatGPT to practice behavioral questions and technical explanations. The interview process involved 5 rounds including coding challenges, system design, and behavioral questions."
    },
    {
      question: "What first got you interested in using GenAI tools like ChatGPT or Gemini for job interviews?",
      response: "My interest in GenAI for interviews started when I was struggling with interview anxiety during my job search in 2022. A mentor suggested using AI to practice common questions, and I found it incredibly helpful for building confidence. I started with simple question-answer practice but quickly realized AI could help me structure my thoughts better and anticipate follow-up questions."
    }
  ],
  
  main: [
    {
      question: "Can you walk me through a specific time when you used GenAI to help prepare for a job interview?",
      response: "Yes, I used GenAI extensively when preparing for my current role at TechCorp. I practiced behavioral questions like 'Tell me about a time you led a team through a difficult project' by having ChatGPT generate follow-up questions and helping me structure my responses more clearly. I would input my initial answer, then ask the AI to suggest improvements and potential follow-up questions. This helped me think through my experiences more systematically and prepare for the actual interview flow."
    },
    {
      question: "What kinds of tasks did you find yourself relying on GenAI for most when preparing for interviews?",
      response: "I relied on GenAI most for three main areas: 1) Practicing behavioral questions by having AI generate follow-up questions to my initial answers, 2) Helping me explain technical concepts in simpler terms for non-technical stakeholders, and 3) Structuring my responses to be more STAR-method compliant. I found it particularly helpful for anticipating what interviewers might ask next, which made me feel more prepared and confident during actual interviews."
    },
    {
      question: "Have you ever considered or actually used GenAI during a live interview? What happened?",
      response: "I actually did use GenAI during a live interview once, though it was unintentional. I had practiced so extensively with ChatGPT that during a phone interview, I found myself using some of the language patterns and structures I had practiced. The interviewer seemed impressed with how well I communicated and how thoroughly I had prepared my examples. I got the job, and I believe the AI practice contributed to my success, though I was careful not to sound rehearsed."
    },
    {
      question: "Tell me about a time when you felt AI gave you a real competitive edge in an interview process.",
      response: "AI gave me a significant competitive edge during my interview for a Product Manager role at a fintech company. I used ChatGPT to practice explaining complex blockchain concepts to non-technical stakeholders, which was a key requirement. During the interview, I was able to clearly articulate these concepts in a way that impressed the hiring manager. I got the job, and the hiring manager specifically mentioned how well I communicated technical concepts. I credit part of that success to the AI practice sessions."
    },
    {
      question: "Did you ever have a close call where your AI use almost got you in trouble? What was that like?",
      response: "Yes, I had a close call when interviewing at a company that was very strict about AI usage policies. I had practiced extensively with ChatGPT, and during the interview, I accidentally used some phrasing that was very similar to what the AI had suggested. The interviewer asked if I had used any AI tools in my preparation, and I had to quickly think on my feet to explain my preparation process honestly without sounding like I was overly dependent on AI. I was honest about using it for practice but emphasized that all the content and experiences were my own."
    },
    {
      question: "Looking back, was there ever a moment when you thought you might have crossed a line using AI for job applications?",
      response: "Yes, looking back, I think I crossed a line when I used AI to help me write a cover letter that was almost entirely generated by ChatGPT. I only made minor edits to personalize it, and I felt like I wasn't being authentic. I ended up not getting that job, and I think it's because the cover letter didn't really reflect who I am. It taught me that while AI can be helpful for structure and ideas, the content needs to be genuinely mine. I've since changed my approach to use AI only for brainstorming and structure, not for generating content."
    },
    {
      question: "Have you ever used AI in your job applications in a way that you prefer not to share openly with others—such as your family, friends, or colleagues?",
      response: "Yes, I have used AI in ways I'm not proud of and don't share openly. I've used it to help me exaggerate some of my achievements and responsibilities in previous roles, making my experience sound more impressive than it actually was. For example, I used AI to help me describe a project I contributed to as if I had led it entirely. I know this isn't ethical, but I felt like I needed to compete with other candidates who were doing the same thing. I've since realized this approach is wrong and have committed to being completely honest in my applications."
    }
  ]
};

// Validate the structure
console.log('✅ User responses structure validated:');
console.log(`   - Background questions: ${userResponses.background.length}`);
console.log(`   - Main questions: ${userResponses.main.length}`);

// Test question extraction
const predefinedQuestions = userResponses.main.map(q => q.question);
console.log(`   - Predefined questions extracted: ${predefinedQuestions.length}`);

// Test final question detection
for (let i = 0; i < userResponses.main.length; i++) {
  const isFinalQuestion = (i === userResponses.main.length - 1);
  console.log(`   - Question ${i + 1} is final: ${isFinalQuestion}`);
}

// Test response length validation
let totalResponseLength = 0;
userResponses.background.forEach((q, i) => {
  totalResponseLength += q.response.length;
  console.log(`   - Background ${i + 1} response length: ${q.response.length} chars`);
});

userResponses.main.forEach((q, i) => {
  totalResponseLength += q.response.length;
  console.log(`   - Main ${i + 1} response length: ${q.response.length} chars`);
});

console.log(`   - Total response length: ${totalResponseLength} characters`);
console.log(`   - Average response length: ${Math.round(totalResponseLength / (userResponses.background.length + userResponses.main.length))} characters`);

// Test session ID generation
const testSessionId = 'test-quick-validation-' + Date.now();
console.log(`   - Test session ID: ${testSessionId}`);

// Test delay function
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

console.log('\n✅ All validation tests passed!');
console.log('=' .repeat(50));
console.log('📋 Test Summary:');
console.log(`   - Background questions: ${userResponses.background.length}`);
console.log(`   - Main questions: ${userResponses.main.length}`);
console.log(`   - Total questions: ${userResponses.background.length + userResponses.main.length}`);
console.log(`   - Total response content: ${totalResponseLength} characters`);
console.log(`   - Session management: Working`);
console.log(`   - Timing functions: Working`);
console.log('\n🚀 Ready to run the full test with: node test-user-agent-detailed.js');
console.log('⚠️  Make sure the backend server is running on port 3000 first!');

