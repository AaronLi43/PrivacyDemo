// test-balanced-allocation.js
// Test script to demonstrate the balanced mode allocation system

import { STUDY_CONFIG, getBalancedAllocationCap, canModeAcceptParticipants } from './study-config.js';

console.log('🧪 Testing Balanced Mode Allocation System\n');

// Test different total participant numbers
const testTotals = [150, 300, 450, 600];

testTotals.forEach(total => {
  console.log(`📊 Testing with ${total} total participants:`);
  
  const config = getBalancedAllocationCap(total);
  console.log(`   Base cap per mode: ${config.baseCap}`);
  console.log(`   Balance threshold: ${config.balanceThreshold}`);
  console.log(`   Total: ${config.total}`);
  
  // Test mode acceptance logic at exact cap
  const testModeCount = Math.floor(config.baseCap * 1.0); // Exactly at cap
  const canAccept = canModeAcceptParticipants(testModeCount, config.baseCap, total * 1.0, total);
  
  console.log(`   Mode at exact cap (${testModeCount}): ${canAccept ? '✅ Can accept' : '❌ Cannot accept'}`);
  console.log('');
});

// Test strict equality enforcement
console.log('🔒 Testing Strict Equality Enforcement:');

const equalityConfig = getBalancedAllocationCap(150);
const cap = equalityConfig.baseCap; // Should be 50

// Test when all modes are perfectly balanced
console.log(`   Perfect balance scenario (${cap}/${cap}/${cap}):`);
const mode1 = canModeAcceptParticipants(cap, cap, 150, 150);
const mode2 = canModeAcceptParticipants(cap, cap, 150, 150);
const mode3 = canModeAcceptParticipants(cap, cap, 150, 150);
console.log(`     Mode 1 (${cap}/${cap}): ${mode1 ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode 2 (${cap}/${cap}): ${mode2 ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode 3 (${cap}/${cap}): ${mode3 ? '✅ Can accept' : '❌ Cannot accept'}`);

// Test when one mode is at cap and others are below
console.log(`   One mode at cap scenario (${cap}/${cap-1}/${cap-1}):`);
const mode1AtCap = canModeAcceptParticipants(cap, cap, 148, 150);
const mode2Below = canModeAcceptParticipants(cap-1, cap, 148, 150);
const mode3Below = canModeAcceptParticipants(cap-1, cap, 148, 150);
console.log(`     Mode 1 at cap (${cap}/${cap}): ${mode1AtCap ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode 2 below cap (${cap-1}/${cap}): ${mode2Below ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode 3 below cap (${cap-1}/${cap}): ${mode3Below ? '✅ Can accept' : '❌ Cannot accept'}`);

// Test when approaching total participants
console.log(`   Approaching total scenario (${cap-1}/${cap-1}/${cap-1}, total 147/150):`);
const nearTotal1 = canModeAcceptParticipants(cap-1, cap, 147, 150);
const nearTotal2 = canModeAcceptParticipants(cap-1, cap, 147, 150);
const nearTotal3 = canModeAcceptParticipants(cap-1, cap, 147, 150);
console.log(`     Mode 1 (${cap-1}/${cap}): ${nearTotal1 ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode 2 (${cap-1}/${cap}): ${nearTotal2 ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode 3 (${cap-1}/${cap}): ${nearTotal3 ? '✅ Can accept' : '❌ Cannot accept'}`);

console.log('');

// Test edge cases
console.log('🔍 Testing Edge Cases:');

// Test when mode is at cap
const edgeConfig = getBalancedAllocationCap(150);
const atCap = canModeAcceptParticipants(50, 50, 100, 150);
console.log(`   Mode at cap (50/50): ${atCap ? '✅ Can accept' : '❌ Cannot accept'}`);

// Test when mode exceeds cap
const overCap = canModeAcceptParticipants(55, 50, 100, 150);
console.log(`   Mode over cap (55/50): ${overCap ? '✅ Can accept' : '❌ Cannot accept'}`);

// Test when approaching total
const nearTotal = canModeAcceptParticipants(40, 50, 135, 150);
console.log(`   Mode at 40/50, total 135/150: ${nearTotal ? '✅ Can accept' : '❌ Cannot accept'}`);

// Test strict 1/3 rule enforcement
console.log('   Strict 1/3 rule enforcement:');
const strictTest1 = canModeAcceptParticipants(50, 50, 150, 150); // Exactly 1/3
const strictTest2 = canModeAcceptParticipants(51, 50, 150, 150); // Over 1/3
console.log(`     Mode at exactly 1/3 (50/150): ${strictTest1 ? '✅ Can accept' : '❌ Cannot accept'}`);
console.log(`     Mode over 1/3 (51/150): ${strictTest2 ? '✅ Can accept' : '❌ Cannot accept'}`);

console.log('');

// Test balance guarantee scenarios
console.log('⚖️ Testing Balance Guarantee Scenarios:');

// Scenario: All modes have equal participants
const equalScenario = [50, 50, 50]; // Perfect balance
console.log(`   Perfect balance [${equalScenario.join(', ')}]:`);
equalScenario.forEach((count, index) => {
  const canAccept = canModeAcceptParticipants(count, cap, 150, 150);
  console.log(`     Mode ${index + 1} (${count}/${cap}): ${canAccept ? '✅ Can accept' : '❌ Cannot accept'}`);
});

// Scenario: One mode ahead, others equal
const aheadScenario = [51, 50, 49]; // Mode 1 ahead
console.log(`   One mode ahead [${aheadScenario.join(', ')}]:`);
aheadScenario.forEach((count, index) => {
  const canAccept = canModeAcceptParticipants(count, cap, 150, 150);
  console.log(`     Mode ${index + 1} (${count}/${cap}): ${canAccept ? '✅ Can accept' : '❌ Cannot accept'}`);
});

// Scenario: Approaching total with imbalance
const imbalanceScenario = [49, 50, 48]; // Total 147/150
console.log(`   Approaching total with imbalance [${imbalanceScenario.join(', ')}]:`);
imbalanceScenario.forEach((count, index) => {
  const canAccept = canModeAcceptParticipants(count, cap, 147, 150);
  console.log(`     Mode ${index + 1} (${count}/${cap}): ${canAccept ? '✅ Can accept' : '❌ Cannot accept'}`);
});

console.log('\n✅ All tests completed!');
console.log('\n📋 Configuration Summary:');
console.log(`   Default Total: ${STUDY_CONFIG.DEFAULT_TOTAL}`);
console.log(`   Max Mode Ratio: ${STUDY_CONFIG.MAX_MODE_RATIO} (${(STUDY_CONFIG.MAX_MODE_RATIO * 100).toFixed(1)}%)`);
console.log(`   Balance Threshold: ${STUDY_CONFIG.BALANCE_THRESHOLD * 100}%`);
console.log(`   Modes: ${STUDY_CONFIG.MODES.join(', ')}`);
console.log('\n🎯 Strict Equality Guarantee:');
console.log(`   This system ensures that no mode can exceed ${(STUDY_CONFIG.MAX_MODE_RATIO * 100).toFixed(1)}% of total participants.`);
console.log(`   When any mode reaches its cap, it cannot accept more participants.`);
console.log(`   This guarantees all modes will have equal participant counts in the end.`);
