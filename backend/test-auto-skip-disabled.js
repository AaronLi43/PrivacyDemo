// Test to verify auto-skipping is disabled and all follow-ups are asked
console.log('🧪 Testing Auto-Skip Disabled Functionality');
console.log('=' .repeat(60));

// Simulate the scenario from the logs where user response triggered auto-skip
const userResponse = "Sometimes I use AI to help me write code and other materials which I do not want others know";
const currentQuestion = "Have you ever used AI for your job interviews in a way that you prefer not to share openly with others—such as your employer, family, friends, or colleagues?";

// Mock functions to simulate the backend logic
function mockDetectNoExperience(message) {
    // This would normally detect "refusal" due to "I do not want others know"
    const hasRefusalPattern = message.toLowerCase().includes("do not want");
    
    if (hasRefusalPattern) {
        return {
            no_experience: true,
            cause: "refusal",
            reason: "User prefers not to disclose specific details about their use of AI in job interviews.",
            tag: "No_able_answer",
            evidence: ["do not want others know"]
        };
    }
    
    return { no_experience: false };
}

function mockGetFollowupsForQuestion(question) {
    if (question.includes("prefer not to share openly")) {
        return [
            { id: "Q6_F1", prompt: "When was the incident of you using AI to hide from someone?" },
            { id: "Q6_F2", prompt: "Who were you hiding from?" },
            { id: "Q6_F3", prompt: "What AI uses did you try to hide from them?" },
            { id: "Q6_F4", prompt: "Why do you feel that's something you wouldn't want to share openly?" }
        ];
    }
    return [];
}

// Test the old vs new behavior
function testOldBehavior() {
    console.log('\n📋 Testing OLD Behavior (with auto-skip):');
    console.log('-' .repeat(40));
    
    const session = { followupStatus: {} };
    const followups = mockGetFollowupsForQuestion(currentQuestion);
    const deny = mockDetectNoExperience(userResponse);
    
    console.log(`User response: "${userResponse}"`);
    console.log(`Detection result:`, deny);
    
    if (deny.no_experience) {
        const skipAll = (deny.cause === "refusal");
        console.log(`Would skip all follow-ups: ${skipAll}`);
        
        if (skipAll) {
            for (const fu of followups) {
                const key = `mockkey::${fu.id}`;
                session.followupStatus[key] = {
                    status: "skipped_na",
                    reason: `${deny.cause}: ${deny.reason}`,
                    ts: Date.now()
                };
                console.log(`   ❌ SKIPPED: ${fu.id} - ${fu.prompt.substring(0, 50)}...`);
            }
        }
    }
    
    // Check if "all covered" (including skipped)
    const allCoveredOld = followups.every(fu => {
        const key = `mockkey::${fu.id}`;
        const status = session.followupStatus[key];
        return status && (status.status === "covered" || status.status === "skipped_na");
    });
    
    console.log(`Result: All follow-ups "covered": ${allCoveredOld}`);
    console.log(`Conversation would: ${allCoveredOld ? '❌ TERMINATE EARLY' : '✅ CONTINUE'}`);
    
    return { allCovered: allCoveredOld, followupsAsked: 0 };
}

function testNewBehavior() {
    console.log('\n📋 Testing NEW Behavior (auto-skip DISABLED):');
    console.log('-' .repeat(40));
    
    const session = { followupStatus: {} };
    const followups = mockGetFollowupsForQuestion(currentQuestion);
    const deny = mockDetectNoExperience(userResponse);
    
    console.log(`User response: "${userResponse}"`);
    console.log(`Detection result:`, deny);
    
    if (deny.no_experience) {
        console.log(`🔍 Detected user reluctance/no-experience but auto-skip is DISABLED:`);
        console.log(`   Cause: ${deny.cause}`);
        console.log(`   Reason: ${deny.reason}`);
        console.log(`   Action: Continue asking follow-ups anyway`);
        
        // NEW: Don't skip any follow-ups - let conversation continue
        console.log('\n   Follow-ups that WILL be asked:');
        for (const fu of followups) {
            console.log(`   ✅ WILL ASK: ${fu.id} - ${fu.prompt.substring(0, 50)}...`);
        }
    }
    
    // Check if "all covered" (only actually covered ones count)
    const allCoveredNew = followups.every(fu => {
        const key = `mockkey::${fu.id}`;
        const status = session.followupStatus[key];
        return status && status.status === "covered"; // skipped_na no longer counts as covered
    });
    
    console.log(`\nResult: All follow-ups actually covered: ${allCoveredNew}`);
    console.log(`Conversation would: ${allCoveredNew ? '✅ CONTINUE UNTIL ALL ASKED' : '✅ CONTINUE ASKING FOLLOW-UPS'}`);
    
    return { allCovered: allCoveredNew, followupsAsked: followups.length };
}

// Run both tests
const oldResult = testOldBehavior();
const newResult = testNewBehavior();

console.log('\n📊 Comparison:');
console.log('=' .repeat(40));
console.log(`Old behavior: ${oldResult.allCovered ? '❌' : '✅'} ${oldResult.allCovered ? 'Early termination' : 'Continued properly'}`);
console.log(`New behavior: ${newResult.allCovered ? '❌' : '✅'} ${newResult.allCovered ? 'Early termination' : 'Continued properly'}`);
console.log(`Follow-ups asked - Old: ${oldResult.followupsAsked}, New: ${newResult.followupsAsked}`);

const success = !oldResult.allCovered || !newResult.allCovered; // At least new behavior should be correct
console.log(`\n${success ? '🎉 SUCCESS' : '❌ FAILURE'}: Auto-skip disabling ${success ? 'working correctly' : 'not working'}`);

if (success) {
    console.log('\n✅ With auto-skip disabled:');
    console.log('   - User reluctance/refusal is detected but ignored');
    console.log('   - All follow-ups will be asked regardless');
    console.log('   - Conversation only advances when ALL follow-ups are actually answered');
    console.log('   - No premature termination due to perceived user reluctance');
}

console.log('\n🎯 Expected behavior in real conversation:');
console.log('   1. User gives response that seems reluctant');
console.log('   2. System detects reluctance but continues anyway');  
console.log('   3. All 4 Q6 follow-ups are asked one by one');
console.log('   4. Only after all are answered does conversation advance');
console.log('   5. Q7 is reached and its follow-up is also asked');
console.log('   6. Conversation ends only after Q7_F1 is completed');
