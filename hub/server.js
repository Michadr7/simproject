// Mikkadr Hub P4: the one local server behind the hub (it absorbed hub/assets-server.js). Binds to 127.0.0.1 only, refuses any Host that is not 127.0.0.1 or localhost on its own port,
// refuses a foreign Origin, and serves nothing outside an allowlist. Reads are GET and HEAD; the only writes are the three plan POSTs below. No route starts a process or calls a model.
//   /                                          hub/web/index.html (the shell)              /web/<name>.html|js|css   hub/web/
//   /assets  /tokens                           .hub/assets.html and .hub/watcher.html (built by npm run assets and npm run watcher)
//   /studio.html /viewer.html /builders.js /orbit.js /compare.js                          the asset studio and 3D viewer (hub/)
//   /dist/<name>.js|json|png|jpg  /dist/vendor/<name>.js                                  the game's modules and pictures (not dist/releases, not dist/saves)
//   /assets-src/<path>.glb|gltf|bin|png|jpg|jpeg   /register   /previews/<key>.png|manifest.json|catalog.json
//   GET  /api/gauges  /api/waiting  /api/plans  /api/plans/<id>[?rev=n]  /api/plans/found   JSON (counts, names and plan text; never raw model fields)
//   POST /api/plans/<id>/answer {verdict,note,revision}   /api/plans/found/add {hash}   /api/plans/found/hide {hash}   /api/waiting/hide {hash}
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

export const MAX_BODY=64*1024;
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
export function waitingOf(root,now=Date.now()){
 const dir=path.join(root,'plans');
 return buildWaiting({plans:listPlans(dir).map(planSummary),found:foundPlans(root,dir),attention:attentionOf(root),hidden:readHidden(root),gauges:gaugesOf(root,now),now})}
export function hideAsset(root,hash){
 const a=attentionOf(root);if(!a||!a.items.some(i=>i.hash===hash))return false;
 const list=readHidden(root);if(!list.includes(hash)){list.push(hash);fs.mkdirSync(path.join(root,'.hub'),{recursive:true});writeAtomic(hiddenFile(root),JSON.stringify(list.slice(-1000)))}
 return true}

// Reads a request body up to MAX_BODY bytes: resolves to a string, or null when it is too big (the rest is drained and dropped).
const readBody=req=>new Promise(ok=>{let size=0,chunks=[],big=false;req.on('data',c=>{size+=c.length;if(size>MAX_BODY)big=true;else chunks.push(c)});req.on('end',()=>ok(big?null:Buffer.concat(chunks).toString('utf8')));req.on('error',()=>ok(null))});

export function createHubServer({root,port=0}={}){
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
    if(r.api==='answer'){
     if(b.note!==undefined&&typeof b.note!=='string')return json(400,{error:'note must be text'});
     const plan=readPlan(plansDir,r.id);if(!plan)return json(404,{error:'no such plan'});
     const a=answerPlan(plan,{verdict:b.verdict,note:b.note,revision:b.revision,now:Date.now()});
     if(a.error)return json(a.code,{error:a.error});
     savePlan(plansDir,a.plan);return json(200,planOf(root,r.id))}
    if(typeof b.hash!=='string'||!HASH_PATTERN.test(b.hash))return json(400,{error:'hash must be 16 hex characters'});
    if(r.api==='waiting-hide'){if(!hideAsset(root,b.hash))return json(404,{error:'that item is no longer on the list'});return json(200,waitingOf(root))}
    if(r.api==='found-hide'){addIgnored(plansDir,b.hash);return json(200,foundOf(root))}
    const f=foundPlans(root,plansDir).find(x=>x.hash===b.hash); // the server's own scan decides the path
    if(!f)return json(404,{error:'that file is no longer waiting to be added'});
    const s=sendPlan(plansDir,{source:f.path,from:'claude',text:f.text});
    if(s.error)return json(400,{error:s.error});
    return json(200,{action:s.action,plan:planSummary(s.plan),...foundOf(root)})}
   if(r.api){
    if(r.api==='gauges')return json(200,gaugesOf(root));
    if(r.api==='plans')return json(200,plansOf(root));
    if(r.api==='waiting')return json(200,waitingOf(root));
    if(r.api==='found')return json(200,foundOf(root));
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
