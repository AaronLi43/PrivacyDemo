// node logs2returns.mjs --log server.log --backend https://privacydemo.onrender.com --study 68adb0cb59d609257e432438 --mode featured --consent Shared
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as wait } from 'timers/promises';
import FormData from 'form-data';
import fetch from 'node-fetch';

const ARGV = process.argv.slice(2);
const args = Object.fromEntries(ARGV.map(s=>{
  const i=s.indexOf('='); return i>0?[s.slice(0,i), s.slice(i+1)]:[s, true];
}));

// Collect log files from CLI supporting both "--log file" and "--log=file"
const LOGS = (() => {
  const files = [];
  for (let i = 0; i < ARGV.length; i++) {
    const token = ARGV[i];
    if (token === '--log') {
      const val = ARGV[i+1];
      if (val && !val.startsWith('--')) { files.push(val); i++; }
    } else if (token.startsWith('--log=')) {
      files.push(token.slice('--log='.length));
    }
  }
  return files.filter(Boolean);
})();

function readFlag(flag, defaultValue){
  for (let i=0;i<ARGV.length;i++){
    const t = ARGV[i];
    if (t === flag){
      const v = ARGV[i+1];
      if (v && !v.startsWith('--')) return v;
    }
    if (t.startsWith(flag+'=')) return t.slice(flag.length+1);
  }
  return defaultValue;
}
const BACKEND = readFlag('--backend', 'http://localhost:3000');
const STUDY   = readFlag('--study', '');
const MODE    = readFlag('--mode', 'neutral');       // 你实验里的展示模式：neutral/featured 等
const CONSENT = readFlag('--consent', 'Ignored');    // Shared / Ignored
const SESSION = readFlag('--session', '');           // 若要统一填 session，可给一个值

if (!LOGS.length) {
  console.error('Usage: node logs2returns.mjs --log <logfile> [--log <logfile2> ...] --backend <url> --study <studyId> --mode featured --consent Shared');
  process.exit(1);
}

const reSession   = /session ready \{[^}]*currentSessionId:\s*'([^']+)'[^}]*prevLen:\s*(\d+),\s*newLen:\s*(\d+)/;
const reUserPrev  = /lastUserPreview:\s*'([^']*)'/;
const reUtterance = /executor parsed \{[^}]*utterance:\s*"([^"]+)"/; // 优先
const reUtteranceAlt = /aiResponsePreview:\s*'[\s\S]*?"utterance":\s*"([^"]+)/; // 退路：预览里截取

function pushTurn(map, sid, role, text, ts){
  if (!text || !text.trim()) return;
  const arr = map.get(sid) || [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  // 去重（相邻重复）
  const last = arr[arr.length-1];
  if (!last || last.role!==role || last.text!==normalized) {
    arr.push({ role, text: normalized, ts });
    map.set(sid, arr);
  }
}
function parseLogFile(file){
  const out = new Map(); // sid -> [{role,text,ts}]
  const lines = fs.readFileSync(file,'utf8').split(/\r?\n/);
  for (const line of lines){
    // 尝试抽 timestamp（方括号或 ISO）仅用于排序
    const tsMatch = line.match(/^\S+\s+\[(\d{4}-\d{2}-\d{2}T[^\]]+)\]/) || line.match(/^\S+\s+\[(.*?)\]/);
    const ts = tsMatch?.[1] || '';
    // 捕捉当前 session
    const s = line.match(reSession);
    if (s) {
      const sid = s[1];
      // 可在这里记录 prevLen/newLen，如需
      continue;
    }
    // user
    const u = line.match(reUserPrev);
    if (u){
      // 需要找离这条最近的 sessionId => 日志中常紧邻在一起；为了稳妥，用上一条包含 session ready 的 sid。
      // 简化：尝试从同一行或近几行中抓 sid（日志往往有标识如 [/api/chat][id]，我们用这个 id 做次级 sid）
      const tag = (line.match(/\[\/api\/chat]\[([a-z0-9]+)\]/i) || [])[1] || '';
      const sid = tag || 'unknown-session';
      pushTurn(out, sid, 'user', u[1], ts);
      continue;
    }
    // assistant
    const a = line.match(reUtterance) || line.match(reUtteranceAlt);
    if (a){
      const tag = (line.match(/\[\/api\/chat]\[([a-z0-9]+)\]/i) || [])[1] || '';
      const sid = tag || 'unknown-session';
      pushTurn(out, sid, 'assistant', a[1], ts);
      continue;
    }
  }
  // 排序
  for (const [sid, arr] of out){
    arr.sort((x,y) => (x.ts||'').localeCompare(y.ts||''));
  }
  return out;
}

async function uploadReturn(conversation, opts){
  const { backend, study, mode, consent, session } = opts;
  const fd = new FormData();
  const payload = {
    conversation,
    recovered_from: 'server_logs',
    recovered_at: new Date().toISOString()
  };
  fd.append('file', Buffer.from(JSON.stringify(payload,null,2),'utf8'), { filename:'recovered_from_logs.json', contentType:'application/json' });
  if (study)   fd.append('study', study);
  if (session) fd.append('session', session);
  fd.append('mode', mode || 'neutral');
  fd.append('sharedOriginal', consent || 'Ignored');

  const res = await fetch(`${backend}/api/upload_return`, { method:'POST', body: fd, headers: fd.getHeaders() });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${text}`);
  return text;
}

(async ()=>{
  const merged = new Map(); // sid -> turns
  for (const f of LOGS){
    const m = parseLogFile(f);
    for (const [sid, arr] of m){
      const tgt = merged.get(sid) || [];
      merged.set(sid, tgt.concat(arr));
    }
  }
  let count=0, uploaded=0, skipped=0;
  for (const [sid, arr] of merged){
    // 合并后再做一次相邻去重
    arr.sort((x,y)=>(x.ts||'').localeCompare(y.ts||''));
    const convo = [];
    for (const t of arr){
      if (!convo.length || convo[convo.length-1].role!==t.role || convo[convo.length-1].text!==t.text){
        convo.push({ role:t.role, text:t.text });
      }
    }
    if (convo.length<1){ skipped++; continue; }
    count++;
    try{
      const out = await uploadReturn(convo, { backend: BACKEND, study: STUDY, mode: MODE, consent: CONSENT, session: SESSION });
      console.log(`[OK] session=${sid} turns=${convo.length} -> ${out}`);
      uploaded++;
      await wait(150); // 轻微节流
    }catch(e){
      console.error(`[FAIL] session=${sid} turns=${convo.length} ->`, e.message);
    }
  }
  console.log(`Done. sessions=${count}, uploaded=${uploaded}, skipped=${skipped}`);
})();
