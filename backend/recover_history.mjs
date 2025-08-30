// Usage:
//   node recover_history.mjs --bucket your-bucket --region us-east-1 --out recovered
// Optional:
//   --prefix returns/ --prefix exports/ --before 2025-08-27T00:00:00Z

import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream, mkdirSync, existsSync, writeFileSync } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
const pipe = promisify(pipeline);

// Robust CLI args parser supporting:
//   --key=value
//   --key value
//   repeated --prefix flags become an array
function parseArgs(argv){
  const out = {};
  for (let i=0; i<argv.length; i++){
    const token = argv[i];
    if (token.startsWith("--")){
      const eq = token.indexOf("=");
      if (eq !== -1){
        const k = token.slice(0, eq);
        const v = token.slice(eq+1);
        if (out[k] === undefined) out[k] = v; else out[k] = Array.isArray(out[k])?[...out[k], v]:[out[k], v];
      } else {
        const k = token;
        const next = argv[i+1];
        if (next && !next.startsWith("--")){
          if (out[k] === undefined) out[k] = next; else out[k] = Array.isArray(out[k])?[...out[k], next]:[out[k], next];
          i++;
        } else {
          out[k] = true;
        }
      }
    } else {
      // loose positional tokens: store as true for completeness
      out[token] = true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const BUCKET = args["--bucket"] || args.bucket;
const REGION = args["--region"] || process.env.AWS_REGION || "us-east-1";
const OUTDIR = args["--out"] || "recovered";
const BEFORE = args["--before"] ? Date.parse(args["--before"]) : null;
const PREFIXES = (Array.isArray(args["--prefix"])?args["--prefix"]:[args["--prefix"]]).filter(Boolean);
const DEFAULT_PREFIXES = ["returns/","exports/"];

if (!BUCKET) {
  console.error("Missing --bucket");
  process.exit(1);
}
const prefixes = (PREFIXES.length?PREFIXES:DEFAULT_PREFIXES);

const s3 = new S3Client({ region: REGION });

function safe(s){ return String(s||"").replace(/[^a-zA-Z0-9._-]/g,"_"); }
async function streamToBuffer(stream){ const chunks=[]; for await (const c of stream) chunks.push(Buffer.from(c)); return Buffer.concat(chunks); }

function looksLikePlaceholder(json){
  try{
    // “占位”的典型：server_poller 写的、且 conversation 为空、也没有 client_return_raw
    const meta = json?.exportData?.metadata;
    const convo = json?.exportData?.conversation;
    const hasConvo = Array.isArray(convo) && convo.length>0;
    const hasClientRaw = !!json?.exportData?.snapshot?.client_return_raw;
    const source = (meta?.source||"").toString().toLowerCase();
    if (hasConvo || hasClientRaw) return false;
    if (source === "server_poller") return true;
    // returns/ 的原始上报通常不含 exportData.meta.source=server_poller
    // 如果完全没有 conversation 字段，也算“占位”
    if (!hasConvo && !json?.conversation && !json?.answers && !json?.messages && !json?.chat) return true;
    return false;
  }catch{ return false; }
}

function extractPid(json){
  return json?.participant_id
      || json?.pid
      || json?.prolific?.participant_id
      || json?.prolific?.pid
      || json?.exportData?.snapshot?.prolific?.participant_id
      || json?.exportData?.metadata?.participant_id
      || json?.exportData?.metadata?.prolific?.pid
      || null;
}

function convoLen(json){
  const c = json?.exportData?.conversation || json?.conversation || json?.messages || json?.chat || json?.answers;
  if (Array.isArray(c)) return c.length;
  if (json?.responses && typeof json.responses === "object") return Object.keys(json.responses).length;
  return 0;
}

async function listAll(prefix){
  const out=[];
  let ContinuationToken;
  let pages=0;
  while(true){
    const resp = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix, ContinuationToken }));
    (resp.Contents||[]).forEach(obj => out.push(obj));
    if (!resp.IsTruncated) break;
    ContinuationToken = resp.NextContinuationToken;
    if (++pages>500) break; // guard
  }
  return out;
}

async function main(){
  if (!existsSync(OUTDIR)) mkdirSync(OUTDIR, { recursive:true });
  const index = [];
  for (const pref of prefixes){
    console.log(`Scanning prefix: ${pref}`);
    const objs = await listAll(pref);
    console.log(`  found ${objs.length} objects`);
    for (const o of objs){
      if (!o.Key) continue;
      if (BEFORE && o.LastModified && new Date(o.LastModified).getTime() > BEFORE) continue;
      try {
        const got = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: o.Key }));
        const buf = await streamToBuffer(got.Body);
        // 粗略过滤非 JSON
        if (!/^\s*[{[]/.test(buf.toString("utf8"))) continue;
        const json = JSON.parse(buf.toString("utf8"));
        if (looksLikePlaceholder(json)) continue; // 跳过占位
        const pid = extractPid(json) || "NA";
        const turns = convoLen(json);
        const local = `${OUTDIR}/${safe(o.Key)}`;
        const dir = local.split("/").slice(0,-1).join("/");
        if (!existsSync(dir)) mkdirSync(dir, { recursive:true });
        writeFileSync(local, JSON.stringify(json,null,2), "utf8");
        index.push({
          key: o.Key,
          local,
          lastModified: o.LastModified?.toISOString?.() || "",
          size: o.Size||0,
          participant_id: pid,
          submission_id: json?.exportData?.metadata?.submission_id || json?.snapshot?.prolific?.submission_id || "",
          study: json?.exportData?.snapshot?.prolific?.study || json?.prolific?.study || "",
          status: json?.exportData?.metadata?.status || json?.snapshot?.prolific?.status || "",
          conversation_len: turns,
          source: json?.exportData?.metadata?.source || (pref.startsWith("returns/")?"client_return":"unknown")
        });
      } catch (e){
        // ignore unreadable
      }
    }
  }
  // 写索引
  const csvHeader = "key,local,lastModified,size,participant_id,submission_id,study,status,conversation_len,source\n";
  const csv = index.reduce((acc,row)=>{
    const esc = v => `"${String(v??"").replace(/"/g,'""')}"`;
    return acc + [row.key,row.local,row.lastModified,row.size,row.participant_id,row.submission_id,row.study,row.status,row.conversation_len,row.source].map(esc).join(",")+"\n";
  }, csvHeader);
  writeFileSync(`${OUTDIR}/index.csv`, csv, "utf8");
  console.log(`Done. Exported ${index.length} items → ${OUTDIR}/ (see index.csv)`);
}

main().catch(e=>{ console.error(e); process.exit(1); });
