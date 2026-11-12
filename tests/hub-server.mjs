// Mikkadr Hub P4 S2 and S4: the hub server. Loopback only, Host and Origin checks, the allowlist, the read APIs (plans, gauges, found), the three guarded POST routes, and no route that starts a process.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveRoute,createHubServer} from '../hub/server.js';
import {sendPlan,savePlan,readPlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';

const real=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const P=7777,H=`127.0.0.1:${P}`,at=p=>resolveRoute(real,p,H,P);

// routing: the new routes, and the API names
assert.deepEqual(at('/api/gauges'),{api:'gauges'});assert.deepEqual(at('/api/plans'),{api:'plans'});assert.deepEqual(at('/api/plans/2026-11-10-x'),{api:'plan',id:'2026-11-10-x'});
for(const p of ['/api/plans/../x','/api/plans/UPPER','/api/plans/a/b','/api/waitingx','/api/waiting/other','/api/plans/ ','/api/other','/api/plans/found/other','/api/plans/x/answer/y'])assert.ok(at(p).status>=400,'refused: '+p);
assert.deepEqual(at('/api/plans/found'),{api:'found'});assert.deepEqual(at('/api/waiting'),{api:'waiting'});assert.deepEqual(at('/api/waiting/hide'),{api:'waiting-hide',write:true});assert.deepEqual(at('/api/plans/found/add'),{api:'found-add',write:true});assert.deepEqual(at('/api/plans/found/hide'),{api:'found-hide',write:true});assert.deepEqual(at('/api/plans/2026-11-10-x/answer'),{api:'answer',id:'2026-11-10-x',write:true});
assert.equal(path.relative(real,at('/').file).split(path.sep).join('/'),'hub/web/index.html');
assert.equal(path.relative(real,at('/assets').file).split(path.sep).join('/'),'.hub/assets.html');
assert.equal(at('/tokens').api,'tokens','/tokens is built on every visit (since 2.5c)');
assert.ok(at('/web/app.js').file&&at('/web/hub.css').file&&at('/web/index.html').file);
for(const p of ['/web/x.json','/web/sub/x.js','/web/../package.json','/web/.env','/plans/ignored.json','/plans/x.json','/hub/plans.js','/.hub/usage.jsonl','/hub/server.js','/package.json','/server.js'])assert.ok(!at(p).file,`${p} is not served`);
assert.equal(resolveRoute(real,'/api/plans','evil.example:7777',P).status,403,'Host is checked on API routes too');
assert.equal(resolveRoute(real,'/','localhost:7777',P).file!==undefined,true);

// a real server on a scratch root so plans and readings are ours
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-server-'));
fs.mkdirSync(path.join(root,'hub','web'),{recursive:true});fs.mkdirSync(path.join(root,'.hub'),{recursive:true});
fs.writeFileSync(path.join(root,'hub','web','index.html'),'<!doctype html><title>hub</title>');fs.writeFileSync(path.join(root,'.hub','assets.html'),'<p>assets</p>');
fs.writeFileSync(path.join(root,'package.json'),'{"secret":true}');
const T=Date.UTC(2026,10,10,12),now=Date.now();
fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:now-60000,source:'probe',model:'claude-haiku-5-5',costUsd:0.001,weekly:{pct:63,resetsAt:Math.floor(now/1000)+86400},fiveHour:{pct:20,resetsAt:Math.floor(now/1000)+3600}})+'\n');
const plans=path.join(root,'plans');
sendPlan(plans,{source:'a.md',title:'Alpha plan',from:'claude',text:'# Alpha plan\n- step <b>one</b>\n\n`code`',now:T});
sendPlan(plans,{source:'b.md',title:'Beta',from:'claude',text:'# Beta\ntext',now:T+1});
const beta=readPlan(plans,'2026-11-10-beta');savePlan(plans,answerPlan(beta,{verdict:'approved',note:'go',revision:1,now:T+2}).plan);
fs.writeFileSync(path.join(plans,'ignored.json'),'[]');

const srv=createHubServer({root,logsDir:path.join(root,'no-logs')}),port=await srv.listen(),O=`http://127.0.0.1:${port}`;
const call=(method,url,headers={},body)=>new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port,method,path:url,headers:Object.fromEntries(Object.entries(headers).filter(([,v])=>v!==undefined))},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>res({status:x.statusCode,type:x.headers['content-type'],body:s,headers:x.headers}))});r.on('error',rej);r.end(body)});
try{
 assert.equal(srv.server.address().address,'127.0.0.1','bound to loopback only');
 // pages
 const home=await call('GET','/');assert.equal(home.status,200);assert.match(home.type,/text\/html/);assert.equal(home.headers['x-content-type-options'],'nosniff');assert.equal(home.headers['cache-control'],'no-store');
 assert.equal((await call('GET','/assets')).body,'<p>assets</p>');
 {const tk=await call('GET','/tokens');assert.equal(tk.status,200,'built fresh, with or without a stored page');assert.match(tk.type,/text\/html/);assert.match(tk.body,/Tokens so far/);assert.match(tk.body,/Not known yet/,'the learned rate says why it is not known');assert.ok(!/<script/i.test(tk.body),'still no scripts')}
 assert.equal((await call('HEAD','/')).status,200);
 // security
 assert.equal((await call('GET','/',{Host:'evil.example'})).status,403,'wrong Host');
 assert.equal((await call('GET','/api/plans',{Host:'evil.example'})).status,403,'wrong Host on the API');
 assert.equal((await call('GET','/',{Host:`127.0.0.1:${port}.evil.com`})).status,403);
 assert.equal((await call('GET','/api/plans',{Origin:'http://evil.example'})).status,403,'foreign Origin');
 assert.equal((await call('GET','/api/plans',{Origin:'null'})).status,403,'Origin null');
 assert.equal((await call('GET','/api/plans',{Origin:`http://127.0.0.1:${port}`})).status,200,'own Origin');
 for(const m of ['POST','PUT','PATCH','DELETE'])for(const u of ['/','/api/plans','/api/plans/2026-11-10-alpha-plan','/api/gauges','/api/plans/found','/studio.html'])assert.equal((await call(m,u,{'Content-Type':'application/json',Origin:O},'{}')).status,405,`${m} ${u} is refused`);
 for(const m of ['GET','PUT','PATCH','DELETE'])for(const u of ['/api/plans/2026-11-10-alpha-plan/answer','/api/plans/found/add','/api/plans/found/hide','/api/waiting/hide'])assert.equal((await call(m,u,{'Content-Type':'application/json',Origin:O},'{}')).status,405,`${m} ${u} takes POST only`);
 assert.equal((await call('GET','/package.json')).status,404,'the project files are not served');
 assert.equal((await call('GET','/plans/ignored.json')).status,404);
 assert.equal((await call('GET','/web/%2e%2e/package.json')).status>=400,true);
 // read APIs
 const list=JSON.parse((await call('GET','/api/plans')).body);
 assert.deepEqual(list.plans.map(p=>[p.id,p.status,p.revision,p.answered]),[['2026-11-10-alpha-plan','waiting',1,0],['2026-11-10-beta','approved',1,1]],'ignored.json is not a plan');
 assert.ok(!('text' in list.plans[0])&&!('html' in list.plans[0]),'the list carries no plan text');
 const one=await call('GET','/api/plans/2026-11-10-alpha-plan');assert.match(one.type,/json/);const o=JSON.parse(one.body);
 assert.equal(o.title,'Alpha plan');assert.equal(o.revisions.length,1);assert.ok(!('text' in o.revisions[0]),'revisions list hash and time only');
 assert.match(o.html,/<h1>Alpha plan<\/h1>/);assert.match(o.html,/step &lt;b&gt;one&lt;\/b&gt;/,'plan text is escaped');assert.ok(!o.html.includes('<b>'));
 assert.equal(JSON.parse((await call('GET','/api/plans/2026-11-10-beta')).body).answers[0].note,'go');
 assert.equal((await call('GET','/api/plans/nope')).status,404);
 const g=JSON.parse((await call('GET','/api/gauges')).body);
 assert.deepEqual(Object.keys(g).sort(),['ageMin','fiveHour','stale','warnings','weekly']);
 assert.equal(g.weekly.pct,63);assert.equal(g.weekly.zone,'watch');assert.equal(g.fiveHour.pct,20);assert.equal(g.stale,false);
 assert.ok(!JSON.stringify(g).includes('claude-haiku')&&!JSON.stringify(g).includes('costUsd'),'no raw reading fields (model, cost) go out');
 // ── S4: found plan files (the server's own scan), then the guarded writes
 fs.mkdirSync(path.join(root,'docs'));fs.mkdirSync(path.join(root,'node_modules','x'),{recursive:true});fs.mkdirSync(path.join(root,'.hub','p'),{recursive:true});fs.mkdirSync(path.join(root,'assets-src'));
 fs.writeFileSync(path.join(root,'PLAN-ideas.md'),'# Ideas plan\nfirst');fs.writeFileSync(path.join(root,'docs','my-plan.md'),'no heading here');fs.writeFileSync(path.join(root,'notes.md'),'# not a plan');
 fs.writeFileSync(path.join(root,'node_modules','x','plan.md'),'# skipped');fs.writeFileSync(path.join(root,'.hub','p','plan.md'),'# skipped');fs.writeFileSync(path.join(root,'assets-src','plan.md'),'# skipped');fs.writeFileSync(path.join(root,'a.md'),'# Alpha plan\nbody <b>one</b>');
 const found=async()=>JSON.parse((await call('GET','/api/plans/found')).body).files;
 let files=await found();
 assert.deepEqual(files.map(f=>f.path),['PLAN-ideas.md','docs/my-plan.md'],'*plan*.md and PLAN*.md, skipping node_modules, dot folders, assets-src; a.md was already sent (a plan names it as its source)');
 assert.equal(files[0].title,'Ideas plan');assert.equal(files[1].title,'my-plan.md');assert.ok(files.every(f=>/^[a-f0-9]{16}$/.test(f.hash)&&!('text' in f)),'hashes and names only, no text');
 const post=(u,body,h={})=>call('POST',u,{'Content-Type':'application/json',Origin:O,...h},typeof body==='string'?body:JSON.stringify(body));
 // the write guard
 assert.equal((await post('/api/plans/found/hide',{hash:files[0].hash},{Origin:undefined})).status,403,'no Origin');
 assert.equal((await post('/api/plans/found/hide',{hash:files[0].hash},{Origin:'http://evil.example'})).status,403,'foreign Origin');
 assert.equal((await post('/api/plans/found/hide',{hash:files[0].hash},{Host:'evil.example'})).status,403,'foreign Host');
 assert.equal((await post('/api/plans/found/hide',{hash:files[0].hash},{'Content-Type':'text/plain'})).status,415,'text/plain is how a cross-site form posts');
 assert.equal((await post('/api/plans/found/hide',{hash:files[0].hash},{'Content-Type':'application/x-www-form-urlencoded'})).status,415);
 assert.equal((await post('/api/plans/found/hide',{hash:files[0].hash},{'Content-Type':'application/json; charset=utf-8'})).status,200,'a charset is fine');
 files=await found();assert.deepEqual(files.map(f=>f.path),['docs/my-plan.md'],'hidden by hash');
 assert.equal((await post('/api/plans/found/hide','{nope')).status,400,'not JSON');assert.equal((await post('/api/plans/found/hide','[1]')).status,400,'not an object');
 assert.equal((await post('/api/plans/found/hide',{hash:'zz'})).status,400,'hash pattern');assert.equal((await post('/api/plans/found/hide',{hash:'../../etc/passwd'})).status,400);assert.equal((await post('/api/plans/found/add',{path:'package.json'})).status,400,'a path from the page is not a thing');
 const big=await post('/api/plans/found/hide',JSON.stringify({hash:'0123456789abcdef',pad:'x'.repeat(70000)}));assert.equal(big.status,413,'over 64 KB');
 assert.equal((await post('/api/plans/found/add',{hash:'0123456789abcdef'})).status,404,'a hash the scan does not know');
 // add: the scan decides the path; the file becomes a plan from sender "claude", the same as npm run plan
 const added=await post('/api/plans/found/add',{hash:files[0].hash});assert.equal(added.status,200);const ad=JSON.parse(added.body);
 assert.equal(ad.action,'created');assert.equal(ad.plan.source,'docs/my-plan.md');assert.equal(ad.plan.from,'claude');assert.deepEqual(ad.files,[],'and it leaves the found list');
 assert.equal(JSON.parse((await call('GET','/api/plans')).body).plans.length,3);
 // edited after hiding: shows again
 fs.writeFileSync(path.join(root,'PLAN-ideas.md'),'# Ideas plan\nsecond');assert.deepEqual((await found()).map(f=>f.path),['PLAN-ideas.md'],'an edited hidden file shows again');
 // answers
 const A='/api/plans/2026-11-10-alpha-plan/answer';
 assert.equal((await post(A,{verdict:'denied',note:'',revision:1})).status,400,'deny needs a reason');
 assert.equal((await post(A,{verdict:'maybe',revision:1})).status,400);assert.equal((await post(A,{verdict:'approved',revision:'1'})).status,400,'revision must be a number');assert.equal((await post(A,{verdict:'approved',note:{x:1},revision:1})).status,400,'note must be text');
 assert.equal((await post('/api/plans/nope/answer',{verdict:'approved',revision:1})).status,404);assert.equal((await post('/api/plans/..%2f..%2fx/answer',{verdict:'approved',revision:1})).status>=400,true);
 // a newer revision arrives (a second send of a.md), then an answer to revision 1 is a 409 and nothing is saved
 sendPlan(plans,{source:'a.md',title:'Alpha plan',from:'claude',text:'# Alpha plan\nrevised',now:T+50});
 const stale=await post(A,{verdict:'approved',note:'ok',revision:1});assert.equal(stale.status,409);assert.match(JSON.parse(stale.body).error,/newer revision/);
 assert.equal(readPlan(plans,'2026-11-10-alpha-plan').answers.length,0,'a refused answer changes nothing');
 const good=await post(A,{verdict:'approved',note:'go',revision:2});assert.equal(good.status,200);const gp=JSON.parse(good.body);assert.equal(gp.status,'approved');assert.equal(gp.answers[0].note,'go');assert.equal(gp.answers[0].revision,2);
 assert.equal((await post(A,{verdict:'denied',note:'late',revision:2})).status,409,'already answered');
 // revisions can be read one by one
 const r1=JSON.parse((await call('GET','/api/plans/2026-11-10-alpha-plan?rev=1')).body);assert.equal(r1.shown,1);assert.equal(r1.revision,2);assert.match(r1.html,/step &lt;b&gt;one/,'revision 1 text, escaped');assert.ok(!/revised/.test(r1.html));
 assert.equal(JSON.parse((await call('GET','/api/plans/2026-11-10-alpha-plan?rev=99')).body).shown,2,'an unknown revision shows the newest');
 assert.equal(JSON.parse((await call('GET','/api/plans/2026-11-10-alpha-plan?rev=abc')).body).shown,2);
}finally{await srv.close();fs.rmSync(root,{recursive:true,force:true})}

// no route starts a process or calls a model: the server's source does not import them
// Hub v2.5c: the probe route. Token needed, refused while anything works, one reading appended with its token total; the probe itself is a stub here (no model call).
{const root2=fs.mkdtempSync(path.join(os.tmpdir(),'hub-probe-'));fs.mkdirSync(path.join(root2,'.hub'));
 let calls=0,busy=false;const runsStub={checkToken:t=>t==='tk',locked:()=>busy},probeFn=async o=>{calls++;assert.equal(o.approved,true);return {at:Date.now(),source:'probe',weekly:{pct:31,resetsAt:2e9},fiveHour:{pct:7,resetsAt:2e9},costUsd:0.004}};
 const s2=createHubServer({root:root2,runs:runsStub,probeFn,logsDir:path.join(root2,'no-logs')}),p2=await s2.listen();
 const post=(h)=>new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port:p2,method:'POST',path:'/api/probe',headers:{'Content-Type':'application/json',Origin:'http://127.0.0.1:'+p2,...h}},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,body:JSON.parse(b||'{}')}))});r.on('error',rej);r.end('{}')});
 try{assert.equal((await post({})).status,403,'no token, no reading');assert.equal(calls,0);assert.equal(calls,0,'and no model call');
  busy=true;assert.equal((await post({'X-Hub-Token':'tk'})).status,423,'refused while a run works');assert.equal(calls,0);busy=false;
  const ok=await post({'X-Hub-Token':'tk'});assert.equal(ok.status,200);assert.equal(ok.body.reading.weekly,31);assert.equal(calls,1);
  const rows=fs.readFileSync(path.join(root2,'.hub','usage.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));assert.equal(rows.length,1);assert.equal(rows[0].source,'probe');
  const noProbe=createHubServer({root:root2,runs:runsStub}),p3=await noProbe.listen();await noProbe.close?.()}
 finally{await s2.close?.()}
 fs.rmSync(root2,{recursive:true,force:true})}const src=fs.readFileSync(path.join(real,'hub','server.js'),'utf8');
assert.ok(!/child_process|\bspawn\b|(?<![.\w])exec(File|Sync)?\(|fetch\(|https?\.request|probe\.js/.test(src.replace(/\/\/.*$/gm,'')),'server.js starts no process and makes no request');
console.log('hub-server ok');
