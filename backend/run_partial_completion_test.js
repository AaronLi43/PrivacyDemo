#!/usr/bin/env node

// run_partial_completion_test.js
// Simple runner script for the partial completion test

import { testPartialCompletion } from './test_partial_completion.js';

console.log('🚀 Running Partial Completion Test');
console.log('=====================================');
console.log('This test will:');
console.log('1. Start a conversation with the backend');
console.log('2. Simulate user completing 3 out of 7 questions');
console.log('3. Trigger completion status without completion code');
console.log('4. Upload partial completion data to S3');
console.log('5. Check your S3 bucket for the test file');
console.log('');

// Run the test
testPartialCompletion()
    .then(() => {
        console.log('\n🎉 Test completed successfully!');
        console.log('📁 Check your S3 bucket for files containing: test_partial_completion_123');
    })
    .catch((error) => {
        console.error('\n❌ Test failed:', error);
        process.exit(1);
    });
