// Enhanced test script for Audit LLM functionality
const fetch = require('node-fetch');

// Test questions subset (first 3 questions from each category)
const testQuestions = {
    naive: [
        "How did you first come across the idea of using GenAI (e.g., ChatGPT, Gemini) to help with job interviews?",
        "Can you walk us through a time when you used GenAI as part of your job interview preparation process?",
        "Has AI ever played a major role in your interview preparation? Tell us about that experience."
    ],
    neutral: [
        "How did you first come across the idea of using GenAI (e.g., ChatGPT, Gemini) to help with job interviews?",
        "Can you walk us through a time when you used GenAI as part of your job interview preparation process?",
        "Has AI ever played a major role in your interview preparation? Tell us about that experience."
    ],
    featured: [
        "How did you first come across the idea of using GenAI (e.g., ChatGPT, Gemini) to help with job interviews?",
        "Can you walk us through a time when you used GenAI as part of your job interview preparation process?",
        "Has AI ever played a major role in your interview preparation? Tell us about that experience."
    ]
};

// Test responses with varying levels of detail
const testResponses = [
    {
        name: "Brief Response",
        response: "I used ChatGPT once for interview prep.",
        expectedAuditDecision: false,
        description: "Minimal information - should trigger more follow-up questions"
    },
    {
        name: "Moderate Response", 
        response: "I discovered ChatGPT through a friend and used it to practice interview questions. It helped me structure my answers better.",
        expectedAuditDecision: false,
        description: "Some information but could use more detail"
    },
    {
        name: "Comprehensive Response",
        response: "I first discovered ChatGPT through a friend who was using it for interview prep. I was skeptical at first, but after trying it myself, I found it incredibly helpful for structuring my responses and practicing common questions. I used it for about 3 interviews and felt much more confident. The AI helped me think through different scenarios and prepare more thorough answers.",
        expectedAuditDecision: true,
        description: "Detailed response with specific examples - should allow proceeding"
    },
    {
        name: "Very Detailed Response",
        response: "I first came across GenAI tools like ChatGPT about 6 months ago when a colleague mentioned using them for interview preparation. I was initially hesitant because I wanted to be authentic in my interviews, but I decided to try it out. I used ChatGPT to help me structure responses to common behavioral questions, and it was surprisingly effective. I practiced with it for about 2 weeks before my first interview, and I felt much more prepared. The AI helped me think through different scenarios I hadn't considered, like how to handle difficult questions about past failures. I ended up using it for 3 different interviews, and I got offers from 2 of them. I think the key was using it as a tool to enhance my preparation rather than relying on it completely.",
        expectedAuditDecision: true,
        description: "Very comprehensive response with timeline, specific outcomes - definitely ready to proceed"
    }
];

async function testAuditLLM() {
    console.log('🧪 Enhanced Audit LLM Testing Suite\n');
    console.log('=' .repeat(60));

    try {
        // Test 1: Check configuration endpoint
        console.log('\n1. Testing Configuration...');
        const configResponse = await fetch('http://localhost:3000/api/config');
        const configData = await configResponse.json();
        console.log('✅ Config response:', configData);
        
        if (!configData.audit_llm_enabled) {
            console.log('⚠️  Audit LLM is DISABLED. Please set ENABLE_AUDIT_LLM=true in environment variables.');
            return;
        }

        // Test 2: Comprehensive question testing
        console.log('\n2. Testing Audit LLM with Predefined Questions...');
        console.log('=' .repeat(60));
        
        const testResults = [];
        
        // Test each question mode
        for (const [mode, questions] of Object.entries(testQuestions)) {
            console.log(`\n📋 Testing Mode: ${mode.toUpperCase()}`);
            console.log('-'.repeat(40));
            
            for (let i = 0; i < questions.length; i++) {
                const question = questions[i];
                console.log(`\nQuestion ${i + 1}: "${question}"`);
                
                // Test each response type
                for (const testCase of testResponses) {
                    console.log(`\n  Testing: ${testCase.name}`);
                    console.log(`  Response: "${testCase.response}"`);
                    
                    try {
                        const chatResponse = await fetch('http://localhost:3000/api/chat', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                message: testCase.response,
                                questionMode: true,
                                currentQuestion: question,
                                predefinedQuestions: questions,
                                isFinalQuestion: false
                            })
                        });

                        const chatData = await chatResponse.json();
                        
                        if (chatData.audit_result) {
                            const auditResult = chatData.audit_result;
                            const decision = auditResult.shouldProceed ? 'PROCEED' : 'CONTINUE';
                            const confidence = auditResult.confidence;
                            const reason = auditResult.reason;
                            
                            console.log(`  ✅ Audit Decision: ${decision} (confidence: ${confidence})`);
                            console.log(`  📝 Reason: ${reason}`);
                            
                            // Evaluate if audit decision matches expectation
                            const decisionCorrect = auditResult.shouldProceed === testCase.expectedAuditDecision;
                            const confidenceGood = confidence >= 0.7;
                            
                            console.log(`  🎯 Expected: ${testCase.expectedAuditDecision ? 'PROCEED' : 'CONTINUE'}`);
                            console.log(`  ✅ Decision Match: ${decisionCorrect ? 'YES' : 'NO'}`);
                            console.log(`  ✅ Confidence Good: ${confidenceGood ? 'YES' : 'NO'}`);
                            
                            // Store results for analysis
                            testResults.push({
                                mode,
                                question: i + 1,
                                testCase: testCase.name,
                                userResponse: testCase.response,
                                expectedDecision: testCase.expectedAuditDecision,
                                actualDecision: auditResult.shouldProceed,
                                confidence: confidence,
                                reason: reason,
                                decisionCorrect,
                                confidenceGood,
                                description: testCase.description
                            });
                        } else {
                            console.log(`  ⚠️  No audit result received`);
                        }
                        
                    } catch (error) {
                        console.log(`  ❌ Error: ${error.message}`);
                    }
                }
            }
        }

        // Test 3: Analyze results
        console.log('\n3. Analysis Results...');
        console.log('=' .repeat(60));
        
        if (testResults.length > 0) {
            const totalTests = testResults.length;
            const correctDecisions = testResults.filter(r => r.decisionCorrect).length;
            const goodConfidence = testResults.filter(r => r.confidenceGood).length;
            const averageConfidence = testResults.reduce((sum, r) => sum + r.confidence, 0) / totalTests;
            
            console.log(`📊 Test Summary:`);
            console.log(`   Total Tests: ${totalTests}`);
            console.log(`   Correct Decisions: ${correctDecisions}/${totalTests} (${(correctDecisions/totalTests*100).toFixed(1)}%)`);
            console.log(`   Good Confidence (≥0.7): ${goodConfidence}/${totalTests} (${(goodConfidence/totalTests*100).toFixed(1)}%)`);
            console.log(`   Average Confidence: ${averageConfidence.toFixed(3)}`);
            
            // Detailed breakdown
            console.log(`\n📋 Detailed Breakdown:`);
            const decisionBreakdown = {};
            testResults.forEach(result => {
                const key = `${result.testCase} (${result.expectedDecision ? 'Should Proceed' : 'Should Continue'})`;
                if (!decisionBreakdown[key]) {
                    decisionBreakdown[key] = { correct: 0, total: 0, avgConfidence: 0 };
                }
                decisionBreakdown[key].total++;
                if (result.decisionCorrect) decisionBreakdown[key].correct++;
                decisionBreakdown[key].avgConfidence += result.confidence;
            });
            
            Object.entries(decisionBreakdown).forEach(([key, stats]) => {
                const accuracy = (stats.correct / stats.total * 100).toFixed(1);
                const avgConf = (stats.avgConfidence / stats.total).toFixed(3);
                console.log(`   ${key}: ${stats.correct}/${stats.total} correct (${accuracy}%), avg confidence: ${avgConf}`);
            });
            
            // Recommendations
            console.log(`\n💡 Recommendations:`);
            if (correctDecisions / totalTests >= 0.8) {
                console.log(`   ✅ Audit LLM is performing well with ${(correctDecisions/totalTests*100).toFixed(1)}% accuracy`);
            } else {
                console.log(`   ⚠️  Audit LLM accuracy is ${(correctDecisions/totalTests*100).toFixed(1)}% - consider tuning prompts`);
            }
            
            if (goodConfidence / totalTests >= 0.8) {
                console.log(`   ✅ Confidence levels are good with ${(goodConfidence/totalTests*100).toFixed(1)}% above threshold`);
            } else {
                console.log(`   ⚠️  Confidence levels need improvement - only ${(goodConfidence/totalTests*100).toFixed(1)}% above threshold`);
            }
            
            if (averageConfidence >= 0.7) {
                console.log(`   ✅ Average confidence of ${averageConfidence.toFixed(3)} is acceptable`);
            } else {
                console.log(`   ⚠️  Average confidence of ${averageConfidence.toFixed(3)} is below threshold`);
            }
        }

        console.log('\n🎉 Enhanced Audit LLM test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testAuditLLM(); 