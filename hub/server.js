// Mikkadr Hub P4: the one local server behind the hub (it absorbed hub/assets-server.js). Binds to 127.0.0.1 only, refuses any Host that is not 127.0.0.1 or localhost on its own port,
// refuses a foreign Origin, and serves nothing outside an allowlist. Reads are GET and HEAD; the writes are the plan POSTs below and, only when the hub is started with --runs, the run POSTs. This file has no process code: runs are started by the controller it is given (hub/runs.js).
//   /                                          hub/web/index.html (the shell)              /web/<name>.html|js|css   hub/web/
//   /assets  /tokens                           .hub/assets.html and .hub/watcher.html (built by npm run assets and npm run watcher)
//   /studio.html /viewer.html /builders.js /orbit.js /compare.js                          the asset studio and 3D viewer (hub/)
//   /dist/<name>.js|json|png|jpg  /dist/vendor/<name>.js                                  the game's modules and pictures (not dist/releases, not dist/saves)
//   /assets-src/<path>.glb|gltf|bin|png|jpg|jpeg   /register   /previews/<key>.png|manifest.json|catalog.json
//   GET  /api/gauges  /api/waiting  /api/plans  /api/plans/<id>[?rev=n]  /api/plans/found   JSON (counts, names and plan text; never raw model fields)
//   POST /api/plans/<id>/answer {verdict,note,revision}   /api/plans/found/add {hash}   /api/plans/found/hide {hash}   /api/waiting/hide {hash}
//   P5 (only when the hub is started with --runs): GET /api/hub-token  /api/runs  /api/runs/<id>  /api/runs/<id>/feed?after=n  /api/chat/feed?after=n  /api/activity (R7b: mood, one line, a short list)
//   POST /api/runs/start {plan,revision,model}  /api/runs/<id>/stop|confirm|resume|close  /answer {question,text}  /continue {extra}: each also needs the X-Hub-Token header
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
import {buildActivity,feedRunOf} from './activity.js';

export const MAX_BODY=64*1024,MAX_RUN_ANSWER=8000;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream'};
export const typeOf=file=>TYPES[path.extname(file).toLowerCase()]||'application/octet-stream';

export const hostAllowed=(host,port)=>typeof host==='string'&&(host===`127.0.0.1:${port}`||host===`localhost:${port}`);
const FIXED={'/':'hub/web/index.html','/assets':'.hub/assets.html','/tokens':'.hub/watcher.html','/register':'assets-register.json','/studio.html':'hub/studio.html','/viewer.html':'hub/viewer.html','/builders.js':'hub/builders.js','/orbit.js':'hub/orbit.js','/compare.js':'hub/compare.js'};
const WEB=/^\/web\/[A-Za-z0-9._-]+\.(html|js|css)$/;
const DIST=/^\/dist\/(vendor\/)?[A-Za-z0-9._-]+\.(js|json|png|jpg)$/;
const SRC=/\.(glb|gltf|bin|png|jpg|jpeg)$/i;
const PREVIEW=/^\/previews\/([a-f0-9]{16,40}\.png|manifest\.json|catalog\.json)$/;
const PLAN_API=/^\/api\/plans\/([a-z0-9][a-z0-9-]{0,79})$/;
const ANSWER_API=/^\/api\/plans\/([a-z0-9][a-z0-9-]{0,79})\/answer$/;
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
 if(pathname==='/api/gauges')return {api:'gauges'};
 if(pathname==='/api/plans')return {api:'plans'};
 if(pathname==='/api/waiting')return {api:'waiting'};
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
 return {...planSummary(p),shown:shown.n,revisions:p.revisions.map(r=>({n:r.n,at:r.at,hash:r.hash})),answers:p.answers,html:renderMarkdown(shown.text)}}
export const foundOf=root=>({files:foundPlans(root,path.join(root,'plans')).map(f=>({hash:f.hash,path:f.path,title:titleOf(f.text,f.path.split('/').pop()),bytes:Buffer.byteLength(f.text),modifiedAt:f.modifiedAt}))});

// Waiting for you: the four sources read from files, then the pure list. Asset items come from .hub/attention.json (written by npm run assets); hidden ones are kept by content hash in .hub/hidden-assets.json.
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''))}catch{return fallback}};
const hiddenFile=root=>path.join(root,'.hub','hidden-assets.json');
export const readHidden=root=>{const a=readJson(hiddenFile(root),[]);return Array.isArray(a)?a.filter(h=>HASH_PATTERN.test(String(h))):[]};
export const attentionOf=root=>{const a=readJson(path.join(root,'.hub','attention.json'),null);return a&&Array.isArray(a.items)?{generatedAt:Number(a.generatedAt)||0,items:a.items.filter(i=>i&&typeof i.id==='string'&&HASH_PATTERN.test(String(i.hash)))}:null};
export function waitingOf(root,now=Date.now(),runs=null){
 const dir=path.join(root,'plans'),l=runs?runs.list():null; // run items only when runs are switched on
 return buildWaiting({plans:listPlans(dir).map(planSummary),found:foundPlans(root,dir),attention:attentionOf(root),hidden:readHidden(root),gauges:gaugesOf(root,now),runs:l?l.runs:[],ready:l?l.ready:[],now})}
export function hideAsset(root,hash){
 const a=attentionOf(root);if(!a||!a.items.some(i=>i.hash===hash))return false;
 const list=readHidden(root);if(!list.includes(hash)){list.push(hash);fs.mkdirSync(path.join(root,'.hub'),{recursive:true});writeAtomic(hiddenFile(root),JSON.stringify(list.slice(-1000)))}
 return true}

// R7b: what the hub is doing right now, for the corner bot (names and counts only). Reads the run list and at most the tail of one feed file; no model call.
export function activityOf(runs=null,chat=null){
 const list=runs?runs.list().runs:[],id=feedRunOf(list);let runFeed=[];
 if(id){let f=runs.feed(id,0);while(f&&f.events.length===500){const more=runs.feed(id,f.last);if(!more||!more.events.length)break;f=more}runFeed=f?f.events.slice(-40):[]}
 return {enabled:!!(runs&&chat),...buildActivity({chat:chat?chat.view():null,chatFeed:chat?chat.feed(0):null,runs:list,runFeed})}}

// Reads a request body up to MAX_BODY bytes: resolves to a string, or null when it is too big (the rest is drained and dropped).
const readBody=req=>new Promise(ok=>{let size=0,chunks=[],big=false;req.on('data',c=>{size+=c.length;if(size>MAX_BODY)big=true;else chunks.push(c)});req.on('end',()=>ok(big?null:Buffer.concat(chunks).toString('utf8')));req.on('error',()=>ok(null))});

// runs: the run controller from hub/runs.js, or null (the default) when runs are not switched on: every run POST then answers 503 and the lists are empty.
export function createHubServer({root,port=0,runs=null,chat=null}={}){
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
    if(r.api.startsWith('chat-')){
     // the master chat: same token rule as runs (the chat only exists when runs are on)
     if(!chat||!runs)return json(503,{error:'the chat is not switched on (start the hub with --runs)'});
     if(!runs.checkToken(req.headers['x-hub-token']))return json(403,{error:'hub token required'});
     let res;
     if(r.api==='chat-send'){if(typeof b.text!=='string')return json(400,{error:'text must be a string'});res=chat.send({text:b.text,busy:runs.locked()})}
     else if(r.api==='chat-model'){if(typeof b.model!=='string'||!RUN_MODELS.includes(b.model))return json(400,{error:'model must be haiku, sonnet, opus or fable'});res=chat.setModel({model:b.model,confirm:b.confirm===true})}
     else if(r.api==='chat-stop')res=await chat.stop();
     else res=chat.newChat();
     if(res.error)return json(res.code||409,{error:res.error,reasons:res.reasons});
     return json(200,{chat:res.chat,needsConfirm:!!res.needsConfirm})}
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
      res=runs.start({planId:b.plan,revision:b.revision,model:b.model})}
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
     const a=answerPlan(plan,{verdict:b.verdict,note:b.note,revision:b.revision,now:Date.now()});
     if(a.error)return json(a.code,{error:a.error});
     savePlan(plansDir,a.plan);return json(200,planOf(root,r.id))}
    if(typeof b.hash!=='string'||!HASH_PATTERN.test(b.hash))return json(400,{error:'hash must be 16 hex characters'});
    if(r.api==='waiting-hide'){if(!hideAsset(root,b.hash))return json(404,{error:'that item is no longer on the list'});return json(200,waitingOf(root,Date.now(),runs))}
    if(r.api==='found-hide'){addIgnored(plansDir,b.hash);return json(200,foundOf(root))}
    const f=foundPlans(root,plansDir).find(x=>x.hash===b.hash); // the server's own scan decides the path
    if(!f)return json(404,{error:'that file is no longer waiting to be added'});
    const s=sendPlan(plansDir,{source:f.path,from:'claude',text:f.text});
    if(s.error)return json(400,{error:s.error});
    return json(200,{action:s.action,plan:planSummary(s.plan),...foundOf(root)})}
   if(r.api){
    if(r.api==='gauges')return json(200,gaugesOf(root));
    if(r.api==='plans')return json(200,plansOf(root));
    if(r.api==='waiting')return json(200,waitingOf(root,Date.now(),runs));
    if(r.api==='found')return json(200,foundOf(root));
    if(r.api==='hub-token')return json(200,{token:runs?runs.token:null,runs:!!runs,chat:!!chat});
    if(r.api==='chat')return json(200,chat?chat.view():{enabled:false,messages:[],working:false,model:'sonnet',tokens:0,pending:null});
    if(r.api==='chatfeed')return json(200,chat?chat.feed(Number.parseInt(url.searchParams.get('after'),10)||0):{turn:0,working:false,events:[],last:0});
    if(r.api==='activity')return json(200,activityOf(runs,chat));
    if(r.api==='runs')return json(200,runs?runs.list():{enabled:false,locked:false,holding:null,runs:[],ready:[]});
    if(r.api==='run-get'){const v=runs&&runs.get(r.id);return v?json(200,{run:v}):json(404,{error:'no such run'})}
    if(r.api==='run-feed'){const f=runs&&runs.feed(r.id,Number.parseInt(url.searchParams.get('after'),10)||0);return f?json(200,f):json(404,{error:'no such run'})}
    const p=planOf(root,r.id,Number.parseInt(url.searchParams.get('rev'),10));return p?json(200,p):json(404,{error:'no such plan'})}
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
