// run_upload_tests.mjs
// Usage:
//   node run_upload_tests.mjs \
//     --backend https://privacydemo.onrender.com \
//     --pid TEST_PID_123 --study TEST_STUDY_123 --session TEST_SESSION_123 \
//     --mode featured --share Ignored
//
// This script sends realistic test payloads to the real backend to verify:
// 1) Partial completion export via /api/upload-to-s3 (keeps raw data even when Ignored)
// 2) Full completion with code via /api/upload-to-s3 (uses submission_id path)
// 3) Multipart JSON upload via /api/upload_return

import { argv, env } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const k = a.replace(/^--/, '');
    const v = argv[i + 1]?.startsWith?.('--') ? true : argv[i + 1];
    if (a.startsWith('--')) {
      args[k] = v ?? true;
      if (v !== true) i++;
    }
  }
  return args;
}

function buildConversation(sampleUserPrefix = 'I had an experience where', length = 4) {
  const entries = [];
  const now = Date.now();
  for (let i = 0; i < length; i++) {
    entries.push({
      user: `${sampleUserPrefix} thing ${i + 1} happened during my internship; I felt concerned about privacy and expectations.`,
      bot: i < length - 1
        ? `Thanks for sharing. Could you elaborate a bit more on point ${i + 1}?`
        : `Understood. Based on what you've said, is there anything else you'd like to add?`,
      timestamp: new Date(now + i * 1000).toISOString(),
      question_index: i,
      question_text: `Question ${i + 1}`
    });
  }
  return entries;
}

async function postJson(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { ok: r.ok, status: r.status, data };
}

async function postMultipartJson(url, fields, jsonObject) {
  // Create a temporary JSON file for multipart upload
  const tmpDir = path.join(process.cwd(), 'uploads');
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch {}
  const tmpPath = path.join(tmpDir, `return_${Date.now()}.json`);
  fs.writeFileSync(tmpPath, JSON.stringify(jsonObject, null, 2), 'utf-8');

  const form = new FormData();
  for (const [k, v] of Object.entries(fields || {})) form.append(k, String(v));
  form.append('file', new Blob([fs.readFileSync(tmpPath)] , { type: 'application/json' }), path.basename(tmpPath));

  const r = await fetch(url, { method: 'POST', body: form });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  // Cleanup
  try { fs.unlinkSync(tmpPath); } catch {}
  return { ok: r.ok, status: r.status, data };
}

function buildExportFormat({ mode, pid, study, session, shareBool, conversationLen = 5, consentGiven = true }) {
  const conversation = buildConversation('During my last interview cycle,', conversationLen);
  return {
    metadata: {
      mode, // 'featured' | 'neutral' | 'naive'
      export_timestamp: new Date().toISOString(),
      total_messages: conversation.length,
      consent_given: !!consentGiven,
      consent_tag: consentGiven ? 'accept' : 'decline',
      survey_completed: true,
      edited_messages_count: 0,
      privacy_features_used: { placeholder: 0, blurred_data: 0, ignore: 0 },
      prolific: { pid, study: study ?? null, session: session ?? null, test_mode: false },
      study_context: {
        mode_readable: mode,
        whether_share_original: shareBool ? 'Shared' : 'Ignored'
      }
    },
    conversation,
    survey_data: {
      q1: 'nil', q2: 'nil', q3: '4', q4: '4',
      q10: 'Privacy Information', q11: "I am comfortable because I'm familiar", q12: '3', q13: '4', q14: '4', q15: '18-29', q16: 'Prefer not to say', q17: 'Prefer not to say', q18: "Bachelor's degree",
      questions: conversation.map((c) => c.question_text)
    },
    original_conversation: conversation,
    privacy_analysis: [],
    privacy_suggestions: []
  };
}

async function main() {
  const args = parseArgs();
  const BACKEND_BASE = args.backend || env.BACKEND_BASE || 'https://privacydemo.onrender.com';
  const pid = args.pid || `TEST_PID_${Date.now()}`;
  const study = args.study || `TEST_STUDY_${Date.now()}`;
  const session = args.session || `TEST_SESSION_${Date.now()}`;
  const mode = (args.mode || 'featured').toLowerCase(); // 'naive' | 'neutral' | 'featured'
  const share = (args.share || 'Ignored'); // 'Shared' | 'Ignored' or boolean-like
  const shareBool = String(share).toLowerCase() === 'shared' || String(share).toLowerCase() === 'true';

  console.log('=== Running Upload Tests ===');
  console.log({ BACKEND_BASE, pid, study, session, mode, share, shareBool });

  // 1) Partial completion export (keeps raw data even when consent is Ignored)
  const partialExportData = buildExportFormat({ mode, pid, study, session, shareBool, conversationLen: 3, consentGiven: shareBool });
  partialExportData.export_type = 'partial_completion';
  partialExportData.metadata.mode = mode; // keep study mode for reference
  partialExportData.metadata.submission_id = null;
  const partialPayload = {
    exportData: partialExportData,
    pid,
    study,
    session,
    mode,
    sharedOriginal: shareBool
  };

  const partialRes = await postJson(`${BACKEND_BASE}/api/upload-to-s3`, partialPayload);
  console.log('\n[Partial Completion]');
  console.log({ ok: partialRes.ok, status: partialRes.status, filename: partialRes.data?.filename, key: partialRes.data?.s3_key, error: partialRes.data?.error });

  // 2) Full completion with code (includes submission_id; expect path exports/complete/<sid>.json)
  const submissionId = `SUB_${Math.random().toString(36).slice(2,10)}`;
  const fullExportData = buildExportFormat({ mode, pid, study, session, shareBool, conversationLen: 5, consentGiven: shareBool });
  fullExportData.export_type = 'full_completion';
  // Keep mode as interview mode; indicate coded completion via metadata.mode_coding and include code block
  fullExportData.metadata.submission_id = submissionId;
  fullExportData.metadata.mode_coding = 'coded';
  fullExportData.code = { language: 'python', content: 'print("hello world")' };
  const fullPayload = {
    exportData: fullExportData,
    pid,
    study,
    session,
    mode,
    sharedOriginal: shareBool
  };

  const fullRes = await postJson(`${BACKEND_BASE}/api/upload-to-s3`, fullPayload);
  console.log('\n[Full Completion With Code]');
  console.log({ ok: fullRes.ok, status: fullRes.status, filename: fullRes.data?.filename, key: fullRes.data?.s3_key, error: fullRes.data?.error });

  // 3) Multipart upload to /api/upload_return
  const returnLog = [
    { type: 'info', message: 'User clicked return', ts: new Date().toISOString() },
    { type: 'event', message: 'Navigated to exit page', ts: new Date().toISOString() }
  ];
  const multipartFields = { pid, study, session, mode, sharedOriginal: shareBool ? 'Shared' : 'Ignored' };
  const uploadRes = await postMultipartJson(`${BACKEND_BASE}/api/upload_return`, multipartFields, returnLog);
  console.log('\n[Multipart /api/upload_return]');
  console.log({ ok: uploadRes.ok, status: uploadRes.status, filename: uploadRes.data?.filename, key: uploadRes.data?.s3_key, error: uploadRes.data?.error });

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});


