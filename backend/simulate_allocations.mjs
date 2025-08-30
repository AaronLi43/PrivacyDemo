// simulate_allocations.mjs
// Usage:
//   node simulate_allocations.mjs \
//     --redirect "https://privacy-demo-flame.vercel.app/redirect.html?PROLIFIC_PID=68699e9de73805fdd3a99559&STUDY_ID=68a73ea3884f8e489ff8c02d&SESSION_ID=0u4j8uugvbla" \
//     --backend https://privacydemo.onrender.com \
//     --N 60 --total 150 --strategy balanced --pilot 2 --memory

import { argv, env } from 'node:process';
import crypto from 'node:crypto';

function parseArgs() {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const k = a.replace(/^--/, '');
    const v = argv[i + 1]?.startsWith('--') ? true : argv[i + 1];
    if (a.startsWith('--')) {
      args[k] = v ?? true;
      if (v !== true) i++;
    }
  }
  return args;
}

function parseRedirectURL(u) {
  const url = new URL(u);
  const sp = url.searchParams;
  return {
    PROLIFIC_PID: sp.get('PROLIFIC_PID') || `TEST_${Date.now()}`,
    STUDY_ID: sp.get('STUDY_ID') || `TEST_STUDY_${Date.now()}`,
    SESSION_ID: sp.get('SESSION_ID') || `TEST_SESSION_${Date.now()}`,
  };
}

function uid(n = 8) {
  return crypto.randomBytes(n).toString('hex');
}

// In-memory store for allocations when using memory mode
const memoryStore = {
  counts: {},
  pidMap: {},
  
  // Get counts for a study, returns [naive_count, neutral_count, featured_count]
  getCounts(study) {
    if (!this.counts[study]) {
      this.counts[study] = {
        naive: 0,
        neutral: 0,
        featured: 0
      };
    }
    const c = this.counts[study];
    return [c.naive, c.neutral, c.featured];
  },
  
  // Increment count for a specific mode in a study
  incrementCount(study, mode) {
    if (!this.counts[study]) {
      this.counts[study] = {
        naive: 0,
        neutral: 0, 
        featured: 0
      };
    }
    this.counts[study][mode] += 1;
    return this.counts[study][mode];
  },
  
  // Map a participant ID to a mode
  mapPidToMode(study, pid, mode) {
    const key = `${study}:${pid}`;
    this.pidMap[key] = mode;
    return mode;
  },
  
  // Get mode for a participant ID if already mapped
  getMode(study, pid) {
    const key = `${study}:${pid}`;
    return this.pidMap[key];
  },
  
  // Reset all data (for testing)
  reset() {
    this.counts = {};
    this.pidMap = {};
  }
};

// Mirrors the Redis Lua allocation logic but in JavaScript
function allocateInMemory(study, cap, testMode, strategy, pilotMin, pid) {
  // Test mode just returns a random mode
  if (testMode) {
    const modes = ['naive', 'neutral', 'featured'];
    const idx = Math.floor(Math.random() * modes.length);
    return modes[idx];
  }
  
  // Check if participant already has an allocation
  if (pid) {
    const existingMode = memoryStore.getMode(study, pid);
    if (existingMode) return existingMode;
  }
  
  // Get current counts
  const [naiveCount, neutralCount, featuredCount] = memoryStore.getCounts(study);
  
  // Build list of modes that are not at capacity
  const notFull = [];
  if (naiveCount < cap) notFull.push(0);   // 0 = naive
  if (neutralCount < cap) notFull.push(1); // 1 = neutral
  if (featuredCount < cap) notFull.push(2); // 2 = featured
  
  if (notFull.length === 0) return null; // All modes are at capacity
  
  // Handle pilot minimum requirement
  const pilotCandidates = [];
  if (pilotMin > 0) {
    const counts = [naiveCount, neutralCount, featuredCount];
    for (const idx of notFull) {
      if (counts[idx] < pilotMin) {
        pilotCandidates.push(idx);
      }
    }
  }
  
  const pool = (pilotCandidates.length > 0) ? pilotCandidates : notFull;
  
  // Select mode based on strategy
  let pickIdx;
  
  // Random strategy - pick randomly from available modes
  if (strategy === 'random') {
    pickIdx = pool[Math.floor(Math.random() * pool.length)];
  } 
  // Weighted strategy - modes with more capacity have higher probability
  else if (strategy === 'weighted') {
    const counts = [naiveCount, neutralCount, featuredCount];
    const weights = [];
    let totalWeight = 0;
    
    for (const idx of pool) {
      const weight = cap - counts[idx];
      weights.push({ idx, weight: Math.max(1, weight) });
      totalWeight += Math.max(1, weight);
    }
    
    const rand = Math.random() * totalWeight;
    let accumulated = 0;
    
    for (const { idx, weight } of weights) {
      accumulated += weight;
      if (rand <= accumulated) {
        pickIdx = idx;
        break;
      }
    }
    
    if (pickIdx === undefined) {
      pickIdx = pool[pool.length - 1];
    }
  } 
  // Balanced strategy (default) - prefer modes with lowest counts
  else {
    const counts = [naiveCount, neutralCount, featuredCount];
    let minCount = Infinity;
    
    // Find minimum count
    for (const idx of pool) {
      if (counts[idx] < minCount) {
        minCount = counts[idx];
      }
    }
    
    // Find all modes with minimum count
    const ties = pool.filter(idx => counts[idx] === minCount);
    
    // Pick randomly from modes with minimum count
    pickIdx = ties[Math.floor(Math.random() * ties.length)];
  }
  
  // Increment count for selected mode
  let mode;
  if (pickIdx === 0) {
    memoryStore.incrementCount(study, 'naive');
    mode = 'naive';
  } else if (pickIdx === 1) {
    memoryStore.incrementCount(study, 'neutral');
    mode = 'neutral';
  } else {
    memoryStore.incrementCount(study, 'featured');
    mode = 'featured';
  }
  
  // Map PID to mode if provided
  if (pid) {
    memoryStore.mapPidToMode(study, pid, mode);
  }
  
  return mode;
}

async function main() {
  const args = parseArgs();
  if (!args.redirect) {
    console.error('Missing --redirect "<your redirect.html?PROLIFIC_PID=...&STUDY_ID=...&SESSION_ID=...>"');
    process.exit(1);
  }

  const { PROLIFIC_PID, STUDY_ID, SESSION_ID } = parseRedirectURL(args.redirect);
  const BACKEND_BASE = args.backend || env.BACKEND_BASE || 'https://privacydemo.onrender.com';
  const N = Number(args.N || 60);             // Number of simulations to run
  const desired_total = Number(args.total || 150);
  const desired_strategy = String(args.strategy || 'balanced'); // 'balanced' | 'random' | 'weighted'
  const pilot_min_per_group = Number(args.pilot || 0);          // Minimum per group (e.g. 2)
  const test_mode = false; // Set to true if you don't want to count toward quota
  const use_memory = args.memory === true;    // Use in-memory allocation instead of Redis

  console.log('=== Simulation Start ===');
  console.log({ 
    BACKEND_BASE, 
    STUDY_ID, 
    desired_total, 
    desired_strategy, 
    pilot_min_per_group, 
    N,
    use_memory: use_memory ? 'yes (in-memory allocation)' : 'no (using Redis)' 
  });

  // Clear demarcation between modes
  if (use_memory) {
    console.log('\n');
    console.log('****************************************************************');
    console.log('*                    LOCAL IN-MEMORY MODE                      *');
    console.log('*    No backend server requests will be made in this mode      *');
    console.log('*    Allocations are handled entirely within this process      *');
    console.log('****************************************************************');
  } else {
    console.log('\n');
    console.log('****************************************************************');
    console.log('*                     BACKEND SERVER MODE                      *');
    console.log('*      Real HTTP requests will be sent to the backend at:      *');
    console.log(`*      ${BACKEND_BASE}                    *`);
    console.log('*   Check backend console for incoming request confirmations   *');
    console.log('****************************************************************');
  }

  const results = { naive: 0, neutral: 0, featured: 0, null: 0 };
  const cap = Math.floor(desired_total / 3);

  // Add a unique suffix to avoid contaminating real studies
  const STUDY_ID_TEST = `${STUDY_ID}_SIM_${Date.now()}`;

  // Reset the in-memory store before starting if we're using it
  if (use_memory) {
    memoryStore.reset();
    console.log('Using in-memory allocation (no Redis required)');
  }

  const allocURL = `${BACKEND_BASE}/api/study/allocate`;
  for (let i = 0; i < N; i++) {
    const pid = `${PROLIFIC_PID}_SIM_${i}_${uid(2)}`;
    const session = `${SESSION_ID}_SIM_${i}_${uid(2)}`;

    // Use in-memory allocation if specified
    if (use_memory) {
      const mode = allocateInMemory(
        STUDY_ID_TEST, 
        cap, 
        test_mode, 
        desired_strategy, 
        pilot_min_per_group,
        pid
      );
      
      if (mode && results[mode] !== undefined) {
        results[mode] += 1;
      } else {
        results.null += 1;
      }
      
      // Optional delay to see progress more clearly
      if (args.delay) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      continue;
    }

    // Otherwise, use the backend API
    const payload = {
      study: STUDY_ID_TEST,
      pid,
      session,
      desired_total,
      desired_strategy,
      pilot_min_per_group,
      test_mode
    };

    console.log(`\n`);
    console.log(`🔴 🔴 🔴 REAL BACKEND REQUEST #${i+1}/${N} 🔴 🔴 🔴`);
    console.log(`🌐 Making actual HTTP request to: ${allocURL}`);
    console.log(`👉 If backend is running, you should see a confirmation in the backend logs`);
    const startTime = Date.now();
    
    try {
      const resp = await fetch(allocURL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`[${i+1}/${N}] HTTP ${resp.status} (${duration}ms): ${errorText}`);
        results.null++;
        continue;
      }
      
      const data = await resp.json();
      const m = data?.mode || null;
      console.log(`[${i+1}/${N}] Response received (${duration}ms): mode=${m}, backend=${data.backend || 'unknown'}`);
      
      if (m && results[m] !== undefined) results[m] += 1;
      else results.null += 1;
      
      // Add a small delay between requests to make them easier to observe
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (e) {
      console.error(`[${i+1}/${N}] Request error: ${e.message}`);
      results.null++;
    }
  }

  // Print results
  console.log('\n=== Allocation Results ===');
  console.table({
    naive: results.naive,
    neutral: results.neutral,
    featured: results.featured,
    null: results.null
  });

  // Check status for confirmation
  if (use_memory) {
    // For in-memory mode, generate status directly
    const [naiveCount, neutralCount, featuredCount] = memoryStore.getCounts(STUDY_ID_TEST);
    const status = {
      counts: {
        naive: naiveCount,
        neutral: neutralCount,
        featured: featuredCount
      },
      cap_per_mode: cap,
      assigned_unique: Object.keys(memoryStore.pidMap).filter(k => k.startsWith(`${STUDY_ID_TEST}:`)).length,
      allocation_config: {
        baseCap: cap,
        balanceThreshold: Math.floor(cap * 0.1),
        total: desired_total
      },
      balance_status: {
        isBalanced: naiveCount <= cap && neutralCount <= cap && featuredCount <= cap,
        anyModeAtCap: naiveCount >= cap || neutralCount >= cap || featuredCount >= cap,
        modeStatus: {
          naive: { count: naiveCount, atCap: naiveCount >= cap, remaining: Math.max(0, cap - naiveCount) },
          neutral: { count: neutralCount, atCap: neutralCount >= cap, remaining: Math.max(0, cap - neutralCount) },
          featured: { count: featuredCount, atCap: featuredCount >= cap, remaining: Math.max(0, cap - featuredCount) }
        }
      },
      backend: 'memory'
    };
    
    console.log('\n=== Memory Storage Status ===');
    console.log(JSON.stringify(status, null, 2));
  } else {
    // For Redis mode, fetch from server
    try {
      const statusURL = `${BACKEND_BASE}/api/study/status?study=${encodeURIComponent(STUDY_ID_TEST)}&desired_total=${encodeURIComponent(desired_total)}`;
      
      console.log(`\n`);
      console.log(`🔴 🔴 🔴 REAL BACKEND STATUS REQUEST 🔴 🔴 🔴`);
      console.log(`🌐 Making actual HTTP request to: ${statusURL}`);
      console.log(`👉 If backend is running, you should see a confirmation in the backend logs`);
      
      const startTime = Date.now();
      
      const s = await fetch(statusURL);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (!s.ok) {
        const errorText = await s.text();
        console.error(`Status request failed: HTTP ${s.status} (${duration}ms): ${errorText}`);
      } else {
        const status = await s.json();
        console.log(`\n=== Server Status (/api/study/status) - Response time: ${duration}ms ===`);
        console.log(JSON.stringify(status, null, 2));
      }
    } catch (e) {
      console.warn('Cannot fetch status:', e.message);
    }
  }

  // 规则校验
  console.log('\n=== Checks ===');
  const checks = [];
  for (const mode of ['naive', 'neutral', 'featured']) {
    checks.push({
      rule: `${mode} <= cap (${cap})`,
      pass: results[mode] <= cap,
      value: results[mode]
    });
  }
  const sum = results.naive + results.neutral + results.featured;
  checks.push({ rule: `sum <= 3*cap (${3 * cap})`, pass: sum <= 3 * cap, value: sum });
  console.table(checks);

  // 简易“均衡度”指标（max-min）
  const arr = [results.naive, results.neutral, results.featured];
  const maxv = Math.max(...arr), minv = Math.min(...arr);
  console.log(`\nBalance gap (max-min): ${maxv - minv}  (strategy=${desired_strategy})`);

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
