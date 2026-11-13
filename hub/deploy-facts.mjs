// Mikkadr Hub 2.7: gathers the facts for the next publish (files, the live version, git, wrangler login). Used by the deploy scripts only.
// The judging of the facts is in hub/deploy.js.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createGit} from './git.mjs';
import {LIVE_URL} from './web/deploy-rules.js';

export async function readLive({fetchFn=globalThis.fetch,timeoutMs=8000}={}){
 try{const r=await fetchFn(LIVE_URL,{cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});if(!r.ok)throw new Error('status '+r.status);const j=await r.json();return {live:{version:typeof j.version==='string'?j.version.slice(0,20):null},liveError:false}}
 catch{return {live:null,liveError:true}}}
export async function gatherFacts({root,fetchFn,spawnSyncFn=spawnSync}={}){
 const read=f=>{try{return fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,'')}catch{return null}};
 const facts={version:null,releaseFolder:false,indexPointsHere:null,live:null,liveError:false,tests:null,changed:null,devMode:null,wrangler:'unknown'};
 try{facts.version=JSON.parse(read('package.json')).version}catch{}
 if(facts.version){facts.releaseFolder=fs.existsSync(path.join(root,'dist','releases',facts.version));const idx=read('dist/index.html');facts.indexPointsHere=idx==null?null:idx.includes(`releases/${facts.version}/`)}
 Object.assign(facts,await readLive({fetchFn}));
 // the newest finished test run the hub knows
 try{const dir=path.join(root,'.hub','jobs');let best=null;for(const n of fs.readdirSync(dir)){if(!n.endsWith('.json'))continue;let r;try{r=JSON.parse(read('.hub/jobs/'+n))}catch{continue}
  if((r.key==='test'||r.key==='check')&&r.summary&&Number.isFinite(r.summary.total)&&r.endedAt&&(!best||r.endedAt>best.at))best={ok:!!r.summary.ok,at:r.endedAt}}facts.tests=best}catch{}
 // files changed since the last commit, not counting what the hub never commits
 try{const g=createGit({root}),s=g.status();if(!s.error){const skip=/^(assets-src\/|\.claude\/|\.hub\/|\.env|\.dev\.vars|simproject\.code-workspace)/;facts.changed=s.stdout.split('\0').filter(e=>e.length>3).map(e=>e.slice(3)).filter(p=>!skip.test(p)).length}}catch{}
 const flag=read('dist/dev-flag.js');if(flag!=null){const m=/export const DEV_MODE\s*=\s*(true|false)/.exec(flag);if(m)facts.devMode=m[1]==='true'}
 // is wrangler logged in? (its own check; only the yes or no is kept, never the account details)
 try{const w=path.join(root,'node_modules','wrangler','bin','wrangler.js');if(fs.existsSync(w)){const r=spawnSyncFn(process.execPath,[w,'whoami'],{cwd:root,encoding:'utf8',timeout:30000,windowsHide:true}),o=String(r.stdout||'')+String(r.stderr||'');
  facts.wrangler=/you are logged in/i.test(o)?'in':/not authenticated|not logged in|wrangler login/i.test(o)?'out':'unknown'}}catch{}
 return facts}
