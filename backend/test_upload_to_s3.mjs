// test_upload_to_s3.mjs
// Usage:
//   node test_upload_to_s3.mjs --backend http://localhost:3000
//   node test_upload_to_s3.mjs --backend https://privacydemo.onrender.com

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const k = a.slice(2);
  const v = (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) ? process.argv[++i] : true;
  args[k] = v;
}
const backend = args.backend || 'http://localhost:3000';
const pid     = args.pid     || ('P_' + Math.random().toString(36).slice(2,7));
const study   = args.study   || 'S_TEST';
const session = args.session || ('SESS_' + Math.random().toString(36).slice(2,5));
const mode    = args.mode    || 'neutral';      // neutral | naive | featured
const shared  = args.shared  || 'Shared';       // Shared | Ignored

let _fetch = globalThis.fetch;
if (typeof _fetch !== 'function') {
  const { fetch } = await import('undici'); _fetch = fetch;
}

const body = {
  // 这个字段是必须的：你的 server 会校验 exportData 是否存在
  exportData: {
    metadata: {
      mode: mode,
      export_timestamp: new Date().toISOString(),
      study_context: { whether_share_original: shared }
    },
    conversation: [
      { role: 'user', text: 'hello world' },
      { role: 'assistant', text: 'hi!' }
    ]
  },
  // 这些是 server 端会读的“Prolific 三件套”（不是必须，但建议带上）
  pid, study, session,
  mode,                        // 用于生成文件名里的 Mode
  sharedOriginal: shared       // 'Shared' or 'Ignored' 均可，内部会做标准化
};

console.log('➡️  POST', backend + '/api/upload-to-s3');
console.log('    pid/study/session:', pid, study, session);
const res = await _fetch(backend + '/api/upload-to-s3', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const text = await res.text();
let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }

if (!res.ok) {
  console.error('❌ HTTP', res.status, json);
  process.exit(1);
}
console.log('✅ Response:', json);
// 期待字段：success=true, s3_key="exports/<timestamp>_<PID>_<Mode>_<Shared|Ignored>.json"
if (json.success && json.s3_key) {
  console.log('🎯 Uploaded to S3 key:', json.s3_key);
  process.exit(0);
} else {
  console.error('⚠️ No s3_key in response. Full:', json);
  process.exit(2);
}
