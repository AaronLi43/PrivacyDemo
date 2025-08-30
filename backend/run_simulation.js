// run_simulation.js
// This script executes the simulation with predefined parameters

import { spawn } from 'child_process';

// Get command line args
const args = {};
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const n = process.argv[i + 1];
  if (!n || n.startsWith('--')) { args[k] = true; continue; }
  args[k] = n; i++;
}

// Allow overriding the backend URL for testing
const backend = args.backend || 'https://privacydemo.onrender.com';
console.log(`Using backend: ${backend}`);

// Check if we should use in-memory allocation (no Redis needed)
const useMemory = args.memory === true || args.memory === 'true';
console.log(`Allocation mode: ${useMemory ? 'in-memory (no Redis needed)' : 'Redis-based'}`);

// Create a more compact redirect URL to avoid line wrapping issues in console
const redirectUrl = 'https://privacy-demo-flame.vercel.app/redirect.html?PROLIFIC_PID=test123&STUDY_ID=test456&SESSION_ID=test789';

const params = [
  'simulate_allocations.mjs',
  '--redirect', redirectUrl,
  '--backend', backend,
  '--N', args.N || '10', // Reduced number for testing
  '--total', args.total || '150',
  '--strategy', args.strategy || 'balanced',
  '--pilot', args.pilot || '2'
];

// Add memory flag if specified
if (useMemory) {
  params.push('--memory');
}

console.log('Starting simulation with parameters:');
console.log(params.join(' '));

const simulation = spawn('node', params, { stdio: 'inherit' });

simulation.on('close', (code) => {
  console.log(`Simulation process exited with code ${code}`);
});
