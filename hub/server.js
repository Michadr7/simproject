// P4: the hub server

// Mikkadr Hub P4: the one local server behind the hub (it absorbed hub/assets-server.js). Binds to 127.0.0.1 only, refuses any Host that is not 127.0.0.1 or localhost on its own port,
// refuses a foreign Origin, and serves nothing outside an allowlist. Reads are GET and HEAD; the writes are the plan POSTs below and, only when the hub is started with --runs, the run POSTs. This file has no process code: runs are started by the controller it is given (hub/runs.js).
//   /                                          hub/web/index.html (the shell)              /web/<name>.html|js|css   hub/web/
//   /assets  /tokens                           .hub/assets.html and .hub/watcher.html (built by npm run assets and npm run watcher)
//   /studio.html /viewer.html /builders.js /orbit.js /compare.js                          the asset studio and 3D viewer (hub/)
//   /dist/<name>.js|json|png|jpg  /dist/vendor/<name>.js                                  the game's modules and pictures (not dist/releases, not dist/saves)
//   /assets-src/<path>.glb|gltf|bin|png|jpg|jpeg   /register   /previews/<key>.png|manifest.json|catalog.json
//   GET  /api/gauges  /api/waiting  /api/work  /api/plans  /api/plans/<id>[?rev=n]  /api/plans/found   JSON (counts, names and plan text; never raw model fields)
//   POST /api/plans/<id>/answer {verdict,note,revision}   /api/plans/found/add {hash}   /api/plans/found/hide {hash}   /api/waiting/hide {hash}
//   P5 (only when the hub is started with --runs): GET /api/hub-token  /api/runs  /api/runs/<id>  /api/runs/<id>/feed?after=n  /api/chat/feed?after=n  /api/activity (R7b: mood, one line, a short list)
//   POST /api/runs/start {plan,revision,model}  /api/runs/<id>/stop|confirm|resume|close  /answer {question,text}  /continue {extra}: each also needs the X-Hub-Token header
// Hub v2 V2 (only with --runs, each POST with the X-Hub-Token header): GET /api/jobs (the job table, what runs, each last result)   POST /api/jobs/start {job}   /api/jobs/stop {id}   /api/hub/restart {}
//   POST /api/plans/<id>/quick {revision}  (one press approves and starts a Haiku S plan the master filed)   GET /api/hub-id (always: {hub, pid, startedAt}, so a newer hub can recognise this one)
// Hub v2 V3 (only with --runs): GET /api/commit/proposal  /api/commit/summary  /api/push/status   POST /api/commit {files,message,hash}  /api/commit/undo {}  /api/push {head}  (token on each POST; commit and push are separate presses, the hub commits and pushes only on the owner's press)
// Hub v2 V4 (also without --runs; the token is GET /api/hub-token's recordsToken): GET /api/assets/summary   POST /api/assets/add {name,kind,source,licence,stage,note}  /api/assets/stage {id,stage}  /api/assets/file {id,file} (V4b: attach a file from assets-src/)  /api/records/undo {id}  (409 when the row changed since)
//   A job is named by its key only, checked against the table in hub/jobs.js; no script, argument or path is ever read from a request. The processes live in hub/job-runner.mjs.
// Every POST needs Content-Type application/json, an Origin equal to the hub's own (a missing one is refused), and a body of at most 64 KB. Ids and hashes are checked against patterns; the page never sends a path.
// `resolveRoute` is pure (path and host in, a file, an api name or a refusal out) so tests can pin it; `createHubServer` wraps it.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {listPlans,readPlan,savePlan,sendPlan,foundPlans,addIgnored,writeAtomic} from './plans-store.mjs';
import {latestRevision,ID_PATTERN,HASH_PATTERN,answerPlan,titleOf} from './plans.js';
import {renderMarkdown} from './markdown.js';
import {loadReadings,evaluate} from './watcher.js';
import {buildWaiting} from './waiting.js';
import {buildActivity,feedRunOf,gaugeOf} from './activity.js';
import {lifeOf} from './cache-store.mjs';
import {buildTokensPage,logTotal} from './tokens-page.mjs';
import {canPublish,bumpPlan,LEVELS} from './web/deploy-rules.js';
import {checkFetchUrl,cleanFolder} from './web/fetch-rules.js';
import {appendReading} from './watcher.js';
import {buildWork,projectLine} from './work.js';
import {parseRunBlock,quickFix} from './runplan.js';
import {JOB_ID} from './jobs.js';
import {HUB_VERSION} from './web/shell.js';

export const MAX_BODY=64*1024,MAX_RUN_ANSWER=8000;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream'};
export const typeOf=file=>TYPES[path.extname(file).toLowerCase()]||'application/octet-stream';

export const hostAllowed=(host,port)=>typeof host==='string'&&(host===`127.0.0.1:${port}`||host===`localhost:${port}`);
const FIXED={'/':'hub/web/index.html','/assets':'.hub/assets.html','/register':'assets-register.json','/studio.html':'hub/studio.html','/viewer.html':'hub/viewer.html','/builders.js':'hub/builders.js','/orbit.js':'hub/orbit.js','/compare.js':'hub/compare.js'};
const WEB=/^\/web\/[A-Za-z0-9._-]+\.(html|js|css)$/;
const DIST=/^\/dist\/(vendor\/)?[A-Za-z0-9._-]+\.(js|json|png|jpg)$/;
const SRC=/\.(glb|gltf|bin|png|jpg|jpeg)$/i;
const PREVIEW=/^\/previews\/([a-f0-9]{16,40}\.png|manifest\.json|catalog\.json)$/;
const PLAN_API=/^\/api\/plans\/([a-z0-9][a-z0-9-]{0,79})$/;
const ANSWER_API=/^\/api\/plans\/([a-z0-9][a-z0-9-]{0,79})\/answer$/;
const QUICK_API=/^\/api\/plans\/([a-z0-9][a-z0-9-]{0,79})\/quick$/;
const TOOL_WRITES={'/api/jobs/start':'job-start','/api/jobs/stop':'job-stop','/api/hub/restart':'hub-restart','/api/probe':'probe'};
// Hub v2 V3: commit and push, each its own press. [api name, is a write]. The reads need no token (like the other lists); every write needs the hub token.
const COMMIT_ROUTES={'/api/commit/proposal':['commit-proposal',false],'/api/commit/summary':['commit-summary',false],'/api/push/status':['push-status',false],'/api/commit':['commit-do',true],'/api/commit/undo':['commit-undo',true],'/api/push':['push-do',true]};
// Hub v2 V4: the Assets area. They work without --runs, with their own token (records.token, given by GET /api/hub-token as recordsToken).
const RECORD_ROUTES={'/api/assets/summary':['assets-summary',false],'/api/assets/add':['assets-add',true],'/api/assets/stage':['assets-stage',true],'/api/assets/file':['assets-file',true],'/api/records/undo':['records-undo',true]};
const MAX_PICKED=5000;
export const HUB_NAME='mikkadr-hub';
// P5 run routes. The server only validates and hands over to the run controller (hub/runs.js); it has no process code of its own.
const RUN_API=/^\/api\/runs\/(run-[0-9]{8}-[0-9]{6}-[0-9a-f]{4})(?:\/(feed|stop|confirm|answer|resume|continue|close))?$/;
const RUN_WRITES=['stop','confirm','answer','resume','continue','close'];
const RUN_MODELS=['haiku','sonnet','opus','fable'];
const CHAT_WRITES=['/api/chat/send','/api/chat/new','/api/chat/model','/api/chat/stop'];

// Returns {file} (an absolute path inside `root`), {api, id?, write?} (write routes take POST, the rest GET), or {status, why}. `pathname` is the decoded URL path.
export function resolveRoute(root,pathname,host,port){
 if(!hostAllowed(host,port))return {status:403,why:'host not allowed'};
 if(typeof pathname!=='string'||!pathname.startsWith('/')||pathname.includes('\0')||pathname.includes('\\'))return {status:400,why:'bad path'};
 const segments=pathname.split('/');if(segments.includes('..')||segments.includes('.'))return {status:403,why:'path escapes'};
 if(pathname==='/tokens')return {api:'tokens'};
 if(pathname==='/api/gauges')return {api:'gauges'};
 if(pathname==='/api/plans')return {api:'plans'};
 if(pathname==='/api/waiting')return {api:'waiting'};
 if(pathname==='/api/work')return {api:'work'};
 if(pathname==='/api/waiting/hide')return {api:'waiting-hide',write:true};
 if(pathname==='/api/plans/found')return {api:'found'};
 if(pathname==='/api/plans/found/add')return {api:'found-add',write:true};
 if(pathname==='/api/plans/found/hide')return {api:'found-hide',write:true};
 if(pathname==='/api/hub-token')return {api:'hub-token'};
 if(pathname==='/api/runs')return {api:'runs'};
 if(pathname==='/api/runs/start')return {api:'run-start',write:true};
 if(pathname==='/api/chat')return {api:'chat'};
 if(pathname==='/api/chat/feed')return {api:'chatfeed'};
 if(pathname==='/api/activity')return {api:'activity'};
 if(pathname==='/api/jobs')return {api:'jobs'};
 if(pathname==='/api/hub-id')return {api:'hub-id'};
 if(Object.hasOwn(RECORD_ROUTES,pathname))return {api:RECORD_ROUTES[pathname][0],write:RECORD_ROUTES[pathname][1]};
 if(Object.hasOwn(COMMIT_ROUTES,pathname))return {api:COMMIT_ROUTES[pathname][0],write:COMMIT_ROUTES[pathname][1]};
 if(Object.hasOwn(TOOL_WRITES,pathname))return {api:TOOL_WRITES[pathname],write:true};
 const qm=QUICK_API.exec(pathname);if(qm)return {api:'quick',id:qm[1],write:true};
 if(CHAT_WRITES.includes(pathname))return {api:'chat-'+pathname.slice(10),write:true};
 const rm=RUN_API.exec(pathname);if(rm){const act=rm[2]||'get';return {api:'run-'+act,id:rm[1],write:RUN_WRITES.includes(act)}}
 const am=ANSWER_API.exec(pathname);if(am)return {api:'answer',id:am[1],write:true};
 const pm=PLAN_API.exec(pathname);if(pm)return {api:'plan',id:pm[1]};
 let rel=null;
 if(Object.hasOwn(FIXED,pathname))rel=FIXED[pathname];
 else if(WEB.test(pathname))rel='hub'+pathname;
 else if(DIST.test(pathname))rel=pathname.slice(1);
 else if(pathname.startsWith('/assets-src/')&&SRC.test(pathname))rel=pathname.slice(1);
 else if(PREVIEW.test(pathname))rel='.hub/'+pathname.slice(1);
 if(rel===null)return {status:404,why:'not on the allowlist'};
 const file=path.resolve(root,rel),inside=path.relative(root,file);
 if(inside.startsWith('..')||path.isAbsolute(inside))return {status:403,why:'path escapes'};
 return {file};
}

// The API answers, as plain objects. Plans go out as summaries (no text) in the list and with one revision rendered in the single view.
const win=w=>({known:!!w.known,pct:w.known?w.pct:null,zone:w.known?w.zone:null,resetsAt:w.known?w.resetsAt??null:null});
export function gaugesOf(root,now=Date.now()){
 const s=evaluate(loadReadings(path.join(root,'.hub','usage.jsonl')),{now});
 return {weekly:win(s.weekly),fiveHour:win(s.fiveHour),ageMin:s.ageMin,stale:s.stale,warnings:s.warnings.map(w=>({level:w.level,text:w.text}))}}
export const planSummary=p=>{const last=latestRevision(p);return {id:p.id,title:p.title,from:p.from,source:p.source,status:p.status,revision:last.n,sentAt:last.at,answered:p.answers.length}};
export const plansOf=root=>({plans:listPlans(path.join(root,'plans')).map(planSummary)});
export function planOf(root,id,rev){
 if(!ID_PATTERN.test(id))return null;
 const p=readPlan(path.join(root,'plans'),id);if(!p)return null;
 const shown=p.revisions.find(r=>r.n===rev)||latestRevision(p);
 return {...planSummary(p),shown:shown.n,revisions:p.revisions.map(r=>({n:r.n,at:r.at,hash:r.hash})),answers:p.answers,html:renderMarkdown(shown.text),quick:quickFix(p)}}
export const foundOf=root=>({files:foundPlans(root,path.join(root,'plans')).map(f=>({hash:f.hash,path:f.path,title:titleOf(f.text,f.path.split('/').pop()),bytes:Buffer.byteLength(f.text),modifiedAt:f.modifiedAt}))});

// Waiting for you: the four sources read from files, then the pure list. Asset items come from .hub/attention.json (written by npm run assets); hidden ones are kept by content hash in .hub/hidden-assets.json.
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))}catch{return fallback}};
const hiddenFile=root=>path.join(root,'.hub','hidden-assets.json');
export const readHidden=root=>{const a=readJson(hiddenFile(root),[]);return Array.isArray(a)?a.filter(h=>HASH_PATTERN.test(String(h))):[]};
export const attentionOf=root=>{const a=readJson(path.join(root,'.hub','attention.json'),null);return a&&Array.isArray(a.items)?{generatedAt:Number(a.generatedAt)||0,items:a.items.filter(i=>i&&typeof i.id==='string'&&HASH_PATTERN.test(String(i.hash)))}:null};
export function waitingOf(root,now=Date.now(),runs=null,records=null){
 const dir=path.join(root,'plans'),l=runs?runs.list():null; // run items only when runs are switched on
 return buildWaiting({plans:listPlans(dir).map(planSummary),found:foundPlans(root,dir),attention:attentionOf(root),hidden:readHidden(root),gauges:gaugesOf(root,now),runs:l?l.runs:[],ready:l?l.ready:[],fileChecks:(()=>{try{const b=records&&records.brief&&records.brief();return b&&b.checks||[]}catch{return []}})(),now})}
// Hub v2 V1: the Work tree (hub/work.js). The plan summaries get four small facts from the plan text (the project line, the Run block's model and size, why it cannot start, the deny note); the text itself never leaves.
export function workOf(root,now=Date.now(),runs=null,records=null){
 const dir=path.join(root,'plans'),l=runs?runs.list():null;
 const plans=listPlans(dir).map(p=>{const last=latestRevision(p),pr=parseRunBlock(last.text),ans=[...p.answers].reverse().find(a=>a.revision===last.n);
  return {...planSummary(p),project:projectLine(last.text),run:pr.run&&pr.run.model&&pr.run.size?{model:pr.run.model,size:pr.run.size}:null,runProblem:pr.ok?null:pr.errors[0]||'The plan asks for Fable. A plan may not choose Fable.',note:ans&&ans.verdict==='denied'?ans.note:''}});
 return {...buildWork({plans,runs:l?l.runs:[],ready:l?l.ready:[],waiting:waitingOf(root,now,runs,records).items,found:foundOf(root).files,enabled:!!(l&&l.enabled)}),locked:!!(l&&l.locked)}}
export function hideAsset(root,hash){
 const a=attentionOf(root);if(!a||!a.items.some(i=>i.hash===hash))return false;
 const list=readHidden(root);if(!list.includes(hash)){list.push(hash);fs.mkdirSync(path.join(root,'.hub'),{recursive:true});writeAtomic(hiddenFile(root),JSON.stringify(list.slice(-1000)))}
 return true}

// R7b: what the hub is doing right now, for the corner bot (names and counts only). Reads the run list and at most the tail of one feed file; no model call.
export function activityOf(runs=null,chat=null,{root=null,now=Date.now(),jobs=null}={}){
 const list=runs?runs.list().runs:[],id=feedRunOf(list);let runFeed=[];
 if(id){let f=runs.feed(id,0);while(f&&f.events.length===500){const more=runs.feed(id,f.last);if(!more||!more.events.length)break;f=more}runFeed=f?f.events.slice(-40):[]}
 const jr=jobs&&jobs.list?jobs.list().running:null,jobRunning=!!jr;
 return {enabled:!!(runs&&chat),jobRunning,...buildActivity({chat:chat?chat.view():null,chatFeed:chat?chat.feed(0):null,runs:list,runFeed,job:jr?{key:jr.key,label:jr.label}:null,now,gauge:root?gaugeOf(gaugesOf(root,now)):null,life:root?lifeOf(root):null})}}

// Reads a request body up to MAX_BODY bytes: resolves to a string, or null when it is too big (the rest is drained and dropped).
const readBody=req=>new Promise(ok=>{let size=0,chunks=[],big=false;req.on('data',c=>{size+=c.length;if(size>MAX_BODY)big=true;else chunks.push(c)});req.on('end',()=>ok(big?null:Buffer.concat(chunks).toString('utf8')));req.on('error',()=>ok(null))});

// runs: the run controller from hub/runs.js, or null (the default) when runs are not switched on: every run POST then answers 503 and the lists are empty.
// jobs: the job runner (hub/job-runner.mjs) or null. restart: () => {error} or {go}, given by the program that can end this process (hub/hub-cli.mjs), or null.
// commits: the commit and push controller (hub/commit-ctl.mjs) or null. This file has no process code: git is started only by hub/git.mjs.
// records: the asset record store (hub/records-store.mjs) or null.
let probing=false;
export function createHubServer({root,port=0,runs=null,chat=null,jobs=null,commits=null,records=null,restart=null,startedAt=Date.now(),logsDir=undefined,probeFn=null}={}){
 const plansDir=path.join(root,'plans');
 const server=http.createServer(async(req,res)=>{
  const headers=type=>({'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Cross-Origin-Resource-Policy':'same-origin'});
  const send=(status,body,type='text/plain; charset=utf-8')=>{res.writeHead(status,headers(type));res.end(body)};
  const json=(status,obj)=>send(status,JSON.stringify(obj),'application/json; charset=utf-8');
  const actual=server.address()&&server.address().port;
  let url;try{url=new URL(req.url,'http://x')}catch{return send(400,'bad url')}
  let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return send(400,'bad url')}
  let originHost=null;
  if(req.headers.origin){try{originHost=new URL(req.headers.origin).host}catch{return send(403,'origin not allowed')}if(!hostAllowed(originHost,actual))return send(403,'origin not allowed')}
  const r=resolveRoute(root,pathname,req.headers.host,actual);
  if(r.status)return send(r.status,r.why);
  const read=req.method==='GET'||req.method==='HEAD';
  if(r.write?req.method!=='POST':!read)return send(405,r.write?'POST only':'read-only');
  try{
   if(r.write){
    // the write guard: a same-origin page sending JSON, nothing else
    if(!originHost)return json(403,{error:'origin required'});
    if(!/^application\/json\s*(;|$)/i.test(req.headers['content-type']||''))return json(415,{error:'content type must be application/json'});
    if(Number(req.headers['content-length']||0)>MAX_BODY){req.resume();return json(413,{error:'body too large'})}
    const text=await readBody(req);if(text===null)return json(413,{error:'body too large'});
    let b;try{b=JSON.parse(text)}catch{return json(400,{error:'body is not JSON'})}
    if(!b||typeof b!=='object'||Array.isArray(b))return json(400,{error:'body must be an object'});
    if(r.api==='assets-add'||r.api==='assets-stage'||r.api==='assets-file'||r.api==='records-undo'){
     // Hub v2 V4: records. Their own token; the store validates every field (unknown fields are refused) and refuses an undo when the row changed after the record.
     if(!records)return json(503,{error:'records are not switched on'});
     if(!records.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     let out;
     if(r.api==='assets-add')out=records.add(b,'you');
     else if(r.api==='assets-stage')out=records.stage(b,'you');
     else if(r.api==='assets-file')out=await records.attach(b,'you');
     else{if(Object.keys(b).some(k=>k!=='id'))return json(400,{error:'Unknown field'});out=records.undo(b.id,'you')}
     if(out.error)return json(out.code||409,{error:out.error});
     return json(200,out)}
    if(r.api.startsWith('chat-')){
     // the master chat: same token rule as runs (the chat only exists when runs are on)
     if(!chat||!runs)return json(503,{error:'the chat is not switched on (start the hub with --runs)'});
     if(!runs.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     let res;
     if(r.api==='chat-send'){if(typeof b.text!=='string')return json(400,{error:'text must be a string'});res=chat.send({text:b.text,busy:runs.locked()||!!(jobs&&jobs.active())})}
     else if(r.api==='chat-model'){if(typeof b.model!=='string'||!RUN_MODELS.includes(b.model))return json(400,{error:'model must be haiku, sonnet, opus or fable'});res=chat.setModel({model:b.model,confirm:b.confirm===true})}
     else if(r.api==='chat-stop')res=await chat.stop();
     else res=chat.newChat();
     if(res.error)return json(res.code||409,{error:res.error,reasons:res.reasons});
     return json(200,{chat:res.chat,needsConfirm:!!res.needsConfirm})}
    if(r.api==='job-start'||r.api==='job-stop'||r.api==='hub-restart'||r.api==='quick'){
     // Hub v2 V2: the tools and the one-press start. The same token rule as runs; the only thing read from the body is a job key, a job id or a revision number, each checked.
     if(!runs)return json(503,{error:'tools are not switched on (start the hub with --runs)'});
     if(!runs.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     if(r.api==='quick'){
      if(!Number.isInteger(b.revision)||b.revision<1||b.revision>100000)return json(400,{error:'revision must be a whole number'});
      if(runs.locked())return json(423,{error:'Plans are locked while a run works. Stop the run or wait for it.'});
      const out=runs.quick({planId:r.id,revision:b.revision});
      if(out.error)return json(out.code||409,{error:out.error,reasons:out.reasons});
      return json(200,{run:out.run,needsConfirm:!!out.needsConfirm})}
     if(r.api==='hub-restart'){
      if(!restart)return json(503,{error:'This hub cannot restart itself. Stop it and start it again with: npm run hub -- --runs'});
      const out=restart();
      if(!out||out.error)return json(409,{error:out&&out.error||'The hub cannot restart now.'});
      res.on('finish',()=>{try{out.go()}catch{}});
      return json(200,{restarting:true})}
     if(!jobs)return json(503,{error:'tools are not switched on (start the hub with --runs)'});
     let out;
     if(r.api==='job-start'){
      if(typeof b.job!=='string'||!jobs.has(b.job))return json(400,{error:'job must be one of the jobs the hub knows'});
      if(b.job==='fetch-asset'){ // a download the owner asked for: only a good https link and a plain folder; the script checks them again, and every redirect
       const c=checkFetchUrl(b.url);if(c.error)return json(400,{error:c.error});
       const folder=cleanFolder(b.folder);if(!folder)return json(400,{error:'That folder name is not allowed. Use up to 3 plain names, like Characters/man.'});
       writeAtomic(path.join(root,'.hub','fetch-request.json'),JSON.stringify({url:c.url,folder,at:Date.now()}))}      if(b.job==='bump'){ // raising the version: only on a passing-or-not check that names the current and the live version, with the level and the new number typed back; the script checks it all again
       if(!LEVELS.includes(b.level))return json(400,{error:'level must be patch, minor or major'});
       const chk=jobs.last('deploy-check'),last=jobs.last('bump'),plan=bumpPlan(chk,b.level,last);
       if(!plan.ok)return json(409,{error:plan.why});
       if(b.confirm!==plan.to)return json(409,{error:'You confirmed '+String(b.confirm).slice(0,20)+', but the next '+b.level+' version is '+plan.to+'. Press Bump again.'});
       writeAtomic(path.join(root,'.hub','bump-request.json'),JSON.stringify({level:b.level,from:plan.from,to:plan.to,at:Date.now()}))}      if(b.job==='deploy'){ // going online: only on a passing check of the last 10 minutes, with the version it named typed back; the script checks all of it again
       const chk=jobs.last('deploy-check'),can=canPublish(chk,Date.now(),jobs.last('deploy'));
       if(!can.ok)return json(409,{error:can.why});
       if(b.confirm!==chk.summary.version)return json(409,{error:`You confirmed ${String(b.confirm).slice(0,20)}, but the check names ${chk.summary.version}. Press Check again.`});
       writeAtomic(path.join(root,'.hub','deploy-confirm.json'),JSON.stringify({version:chk.summary.version,at:Date.now()}))}
      out=jobs.start(b.job);if(out.error){for(const f of ['deploy-confirm.json','bump-request.json','fetch-request.json']){try{fs.unlinkSync(path.join(root,'.hub',f))}catch{}}}}
     else{
      if(typeof b.id!=='string'||!JOB_ID.test(b.id))return json(400,{error:'id must be a job id'});
      out=await jobs.stop(b.id)}
     if(out.error)return json(out.code||409,{error:out.error});
     return json(200,{job:out.job})}
    if(r.api==='probe'){
     // Hub v2.5c: "Take a fresh reading". One small Haiku call (about 7,600 tokens). Pressing the button is the owner's go-ahead; the token rule is the same as runs, and nothing else may be working.
     if(!runs)return json(503,{error:'readings need the hub to be started with --runs'});
     if(!runs.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     if(!probeFn)return json(503,{error:'This hub cannot take a reading.'});
     if(probing)return json(423,{error:'A reading is already being taken.'});
     if(runs.locked()||(chat&&chat.working())||(jobs&&jobs.active()))return json(423,{error:'Something is working. Take a reading when it has finished.'});
     probing=true;
     try{const rd=await probeFn({approved:true}),row={...rd,tokensTotal:logTotal(logsDir||undefined)};if(row.tokensTotal==null)delete row.tokensTotal;
      appendReading(path.join(root,'.hub','usage.jsonl'),row);
      return json(200,{reading:{weekly:rd.weekly?rd.weekly.pct:null,fiveHour:rd.fiveHour?rd.fiveHour.pct:null,costUsd:rd.costUsd??null}})}
     catch(e){return json(502,{error:String(e&&e.message||'The reading failed.').slice(0,200)})}
     finally{probing=false}}    if(r.api==='commit-do'||r.api==='commit-undo'||r.api==='push-do'){
     // Hub v2 V3: the owner's press. The token rule is the same as runs; the controller refuses while anything works, and checks every path against its own proposal.
     if(!commits||!runs)return json(503,{error:'commit is not switched on (start the hub with --runs)'});
     if(!runs.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     let out;
     if(r.api==='commit-do'){
      if(!Array.isArray(b.files)||b.files.length>MAX_PICKED||b.files.some(f=>typeof f!=='string'||f.length>400))return json(400,{error:'files must be a list of file names'});
      if(typeof b.message!=='string')return json(400,{error:'message must be text'});
      if(typeof b.hash!=='string'||!/^[0-9a-f]{24}$/.test(b.hash))return json(400,{error:'hash must come from the proposal'});
      out=await commits.commit({files:b.files,message:b.message,hash:b.hash})}
     else if(r.api==='commit-undo')out=await commits.undo();
     else{
      if(typeof b.head!=='string'||!/^[0-9a-f]{4,40}$/.test(b.head))return json(400,{error:'head must be a commit id'});
      out=await commits.push({head:b.head})}
     if(out.error)return json(out.code||409,{error:out.error,proposal:out.proposal,push:out.push,kind:out.kind});
     return json(200,out)}
    if(r.api.startsWith('run-')){
     // run routes: the per-start token first (a page on another site never has it), then plain validation, then the controller decides
     if(!runs)return json(503,{error:'runs are not switched on (start the hub with --runs)'});
     if(!runs.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     const int=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
     let res;
     if(r.api==='run-start'){
      if(typeof b.plan!=='string'||!ID_PATTERN.test(b.plan))return json(400,{error:'plan must be a plan id'});
      if(!int(b.revision,1,100000))return json(400,{error:'revision must be a whole number'});
      if(typeof b.model!=='string'||!RUN_MODELS.includes(b.model))return json(400,{error:'model must be haiku, sonnet, opus or fable'});
      if(b.size!=null&&!['S','M','L'].includes(b.size))return json(400,{error:'size must be S, M or L'});
      res=runs.start({planId:b.plan,revision:b.revision,model:b.model,size:b.size??null})}
     else if(r.api==='run-answer'){
      if(!int(b.question,1,100000))return json(400,{error:'question must be a whole number'});
      if(typeof b.text!=='string'||!b.text.trim()||b.text.length>MAX_RUN_ANSWER||b.text.includes('\0'))return json(400,{error:`text must be 1 to ${MAX_RUN_ANSWER} characters`});
      res=runs.answer(r.id,{question:b.question,text:b.text})}
     else if(r.api==='run-continue'){
      if(!int(b.extra,100000,3000000))return json(400,{error:'extra must be between 100,000 and 3,000,000 tokens'});
      res=runs.continueMore(r.id,{extra:b.extra})}
     else if(r.api==='run-stop')res=await runs.stop(r.id);
     else if(r.api==='run-confirm')res=runs.confirm(r.id);
     else if(r.api==='run-resume')res=runs.resume(r.id);
     else res=runs.close(r.id);
     if(res.error)return json(res.code||409,{error:res.error,reasons:res.reasons});
     return json(200,{run:res.run,needsConfirm:!!res.needsConfirm})}
    if(r.api==='answer'){
     if(runs&&runs.locked())return json(423,{error:'Plans are locked while a run works. Stop the run or wait for it.'});
     if(b.note!==undefined&&typeof b.note!=='string')return json(400,{error:'note must be text'});
     const plan=readPlan(plansDir,r.id);if(!plan)return json(404,{error:'no such plan'});
     if(plan.status==='approved'&&b.verdict==='denied'&&runs&&runs.list().runs.some(x=>x.planId===plan.id&&x.status!=='closed'))return json(409,{error:'A run of this plan is not closed yet. Close the run first.'});
     const a=answerPlan(plan,{verdict:b.verdict,note:b.note,revision:b.revision,now:Date.now()});
     if(a.error)return json(a.code,{error:a.error});
     savePlan(plansDir,a.plan);return json(200,planOf(root,r.id))}
    if(typeof b.hash!=='string'||!HASH_PATTERN.test(b.hash))return json(400,{error:'hash must be 16 hex characters'});
    if(r.api==='waiting-hide'){if(!hideAsset(root,b.hash))return json(404,{error:'that item is no longer on the list'});return json(200,waitingOf(root,Date.now(),runs,records))}
    if(r.api==='found-hide'){addIgnored(plansDir,b.hash);return json(200,foundOf(root))}
    const f=foundPlans(root,plansDir).find(x=>x.hash===b.hash); // the server's own scan decides the path
    if(!f)return json(404,{error:'that file is no longer waiting to be added'});
    const s=sendPlan(plansDir,{source:f.path,from:'claude',text:f.text});
    if(s.error)return json(400,{error:s.error});
    return json(200,{action:s.action,plan:planSummary(s.plan),...foundOf(root)})}
   if(r.api){
    if(r.api==='tokens')return send(200,buildTokensPage({root,logs:logsDir}),'text/html; charset=utf-8');
    if(r.api==='gauges')return json(200,gaugesOf(root));
    if(r.api==='plans')return json(200,plansOf(root));
    if(r.api==='waiting')return json(200,waitingOf(root,Date.now(),runs,records));
    if(r.api==='work')return json(200,workOf(root,Date.now(),runs,records));
    if(r.api==='found')return json(200,foundOf(root));
    if(r.api==='hub-token')return json(200,{token:runs?runs.token:null,runs:!!runs,chat:!!chat,records:!!records,recordsToken:records?records.token:null});
    if(r.api==='assets-summary'){if(!records)return json(200,{enabled:false});const s=await records.summary();return s.error?json(s.code||500,{error:s.error}):json(200,{enabled:true,...s})}
    if(r.api==='chat')return json(200,chat?chat.view():{enabled:false,messages:[],working:false,model:'sonnet',tokens:0,pending:null});
    if(r.api==='chatfeed')return json(200,chat?chat.feed(Number.parseInt(url.searchParams.get('after'),10)||0):{turn:0,working:false,events:[],last:0});
    if(r.api==='activity')return json(200,activityOf(runs,chat,{root,jobs}));
    if(r.api==='jobs')return json(200,jobs&&runs?jobs.list():{enabled:false,busy:false,running:null,jobs:[]});
    if(r.api==='hub-id')return json(200,{hub:HUB_NAME,version:HUB_VERSION,pid:process.pid,startedAt,canRestart:!!(restart&&runs)});
    if(r.api==='commit-proposal')return json(200,commits&&runs?commits.proposal():{enabled:false});
    if(r.api==='commit-summary')return json(200,commits&&runs?commits.summary():{enabled:false,files:0,unpushed:0});
    if(r.api==='push-status')return json(200,commits&&runs?commits.pushStatus():{enabled:false,canPush:false,count:0,commits:[]});
    if(r.api==='runs')return json(200,runs?runs.list():{enabled:false,locked:false,holding:null,runs:[],ready:[]});
    if(r.api==='run-get'){const v=runs&&runs.get(r.id);return v?json(200,{run:v}):json(404,{error:'no such run'})}
    if(r.api==='run-feed'){const f=runs&&runs.feed(r.id,Number.parseInt(url.searchParams.get('after'),10)||0);return f?json(200,f):json(404,{error:'no such run'})}
    const p=planOf(root,r.id,Number.parseInt(url.searchParams.get('rev'),10));if(p&&!(runs&&runs.enabled()))p.quick=null; // the one-press start is only offered when a run can start
    return p?json(200,p):json(404,{error:'no such plan'})}
  }catch{return json(500,{error:'could not complete that'})}
  fs.stat(r.file,(err,st)=>{
   if(err||!st.isFile())return send(404,'not found');
   res.writeHead(200,{...headers(typeOf(r.file)),'Content-Length':st.size});
   if(req.method==='HEAD')return res.end();
   fs.createReadStream(r.file).pipe(res);
  });
 });
 return {server,listen:()=>new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>ok(server.address().port))}),close:()=>new Promise(r=>server.close(()=>r()))};
}
