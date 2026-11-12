// Mikkadr Hub P5 R3: the run controller and the run routes, against the fake Claude CLI. No model call; the real claude.exe is never looked up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sendPlan,savePlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';
import {appendReading} from '../hub/watcher.js';
import {createRuns,processName,flaggedPaths} from '../hub/runs.js';
import {readRun,saveRun,readFeed,acquireLock,releaseLock,readLock,lockFile,newRunId,RUN_ID} from '../hub/run-store.mjs';
import {createHubServer,resolveRoute} from '../hub/server.js';
import {isAlive} from '../hub/runner.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),FAKE=path.join(HERE,'fixtures','fake-claude.mjs'),HUB=path.join(HERE,'..','hub');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-runs-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};
const setWeekly=(pct,five=20)=>fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:five,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
let planN=0;
function makePlan(model,size,{answerAt,approve=true}={}){
 const name=`plan-${++planN}`,text=`# ${name}\n\n## Run\nmodel: ${model}\nwhy: test\nsize: ${size}\nneeds: npm test\n`;
 let {plan}=sendPlan(path.join(root,'plans'),{source:name+'.md',title:name,from:'master',text,now:Date.now()});
 if(approve)plan=answerPlan(plan,{verdict:'approved',note:'go',revision:1,now:answerAt??Date.now()}).plan;
 savePlan(path.join(root,'plans'),plan);return plan}
const env={HUB_FAKE_SCENARIO:'normal',HUB_FAKE_OUT:path.join(root,'fake-out.json')};
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0});
const status=id=>readRun(root,id).status;
const finished=async id=>waitFor(()=>!['running'].includes(status(id))&&readRun(root,id));
setWeekly(12);
const sonnetS=makePlan('sonnet','S');

// ── guards
assert.ok(!/findClaude\s*\(/.test(fs.readFileSync(fileURLToPath(import.meta.url),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')).join('\n').replace(/findClaude\s*\(\s*\)\s*\)/g,'')),'this test never looks up the real claude.exe');
// a run never uses git: no run file names git, commit or push (the house-rules line that TELLS the run not to is the one allowed mention).
// Hub v2 V3: the hub itself now commits and pushes, but only on the owner's press, through hub/commit-ctl.mjs and hub/git.mjs (server.js and chat.js name them; tests/hub-commit.mjs pins how).
for(const f of ['runner.js','runs.js','run-store.mjs','runplan.js']){
 const code=fs.readFileSync(path.join(HUB,f),'utf8').split('\n').filter(l=>!l.trim().startsWith('//')&&!l.includes('HOUSE_RULES')).join('\n').replace(/\/\/.*$/gm,'').replace(/\.push\(/g,'.add(');
 assert.ok(!/\bgit(\.exe)?\b|\bcommit(s|ted)?\b|\bpush\b/i.test(code),`${f} does not name git, commit or push`)}
assert.ok(!/child_process/.test(fs.readFileSync(path.join(HUB,'server.js'),'utf8').replace(/\/\/.*$/gm,'')),'server.js has no process code');

// ── ids, paths, flags
assert.match(newRunId(Date.UTC(2026,10,11,14,2,11)),/^run-20261111-140211-[0-9a-f]{4}$/);
assert.deepEqual(flaggedPaths(['hub/a.js','dist/b.js','package.json','tests/x.mjs','scripts/s.mjs','.claude/settings.json','src/hub/c.js','plans/p.json']),['hub/a.js','package.json','tests/x.mjs','scripts/s.mjs','.claude/settings.json','plans/p.json']);
if(process.platform==='win32')assert.equal(await processName(process.pid),path.basename(process.execPath).toLowerCase());

// ── a whole run: start, feed, finish
env.HUB_FAKE_SCENARIO='flagged';
let r=runs.start({planId:sonnetS.id,revision:1,model:'sonnet'});assert.ok(r.run,JSON.stringify(r));
assert.equal(r.run.status,'running');assert.equal(r.run.capTokens,600000);assert.equal(runs.locked(),true);assert.equal(runs.list().holding,r.run.id);
assert.ok(fs.existsSync(lockFile(root)),'the lock is held while it works');
const id1=r.run.id;await finished(id1);
let run=readRun(root,id1);
assert.equal(run.status,'done');assert.equal(run.tokens,450);assert.deepEqual(run.flagged,['hub/x.js','package.json']);assert.deepEqual(run.files,['x.js','package.json','ok.js']);
assert.equal(runs.locked(),false);assert.ok(!fs.existsSync(lockFile(root)),'the lock is released');
const listed=runs.list();assert.equal(listed.holding,null);assert.equal(listed.runs[0].status,'done');
assert.ok(!JSON.stringify(listed).match(/sessionId|"pid"|hubPid/),'the public view hides the session id and pids');
const feed=readFeed(root,id1,0);assert.ok(feed.events.length>=5&&feed.events[0].n===1&&feed.events[0].kind==='turn'&&feed.events[1].kind==='started');
assert.equal(readFeed(root,id1,feed.last).events.length,0);assert.equal(readFeed(root,id1,2).events[0].n,3);
assert.match(fs.readFileSync(path.join(root,'.hub','usage.jsonl'),'utf8'),/"source":"run"/,'the run\'s own gauge reading is kept');
assert.equal(JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8')).stdin.startsWith('Build from approved plan '+sonnetS.id),true);
setWeekly(12);
// close a finished run
assert.equal(runs.close(id1).run.status,'closed');assert.ok(runs.close(id1).error,'already closed');

// ── start refusals
assert.equal(runs.start({planId:sonnetS.id,revision:1,model:'haiku'}).code,409,'card model differs from the plan');
assert.equal(runs.start({planId:sonnetS.id,revision:2,model:'sonnet'}).code,409,'not the newest revision');
assert.equal(runs.start({planId:'no-such-plan',revision:1,model:'sonnet'}).code,404);
const waitingPlan=makePlan('sonnet','S',{approve:false});assert.equal(runs.start({planId:waitingPlan.id,revision:1,model:'sonnet'}).code,409,'unapproved');
assert.equal(createRuns({root,claude:null}).start({planId:sonnetS.id,revision:1,model:'sonnet'}).code,503,'no claude.exe');
// a plan whose stored text no longer matches its hash
const bad=makePlan('sonnet','S');const badFile=path.join(root,'plans',bad.id+'.json'),badJson=JSON.parse(fs.readFileSync(badFile,'utf8'));badJson.revisions[0].text+='\nsneaky edit';fs.writeFileSync(badFile,JSON.stringify(badJson));
assert.match(runs.start({planId:bad.id,revision:1,model:'sonnet'}).error,/does not match its stored hash/);
// an approval stamped while a run's process was working is void
const T=Date.now()-3600000; // an old run, one hour ago: only an approval stamped inside its 2 seconds is void
saveRun(root,{...readRun(root,id1),id:newRunId(T),status:'closed',turns:[{n:1,startedAt:T-1000,endedAt:T+1000,end:'result',tokens:1}],createdAt:T});
const forged=makePlan('sonnet','S',{answerAt:T});assert.match(runs.start({planId:forged.id,revision:1,model:'sonnet'}).error,/void/);
// weekly use: the whole cap is counted against the 97 stop
setWeekly(96);assert.equal(runs.start({planId:sonnetS.id,revision:1,model:'sonnet'}).code,409);setWeekly(12);
setWeekly(12);fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),'');assert.match(runs.start({planId:sonnetS.id,revision:1,model:'sonnet'}).error,/no current weekly reading|No usage/i);setWeekly(12);

// ── one at a time, plans locked while it works, Stop
env.HUB_FAKE_SCENARIO='hang';
const sonnetS2=makePlan('sonnet','S');
r=runs.start({planId:sonnetS2.id,revision:1,model:'sonnet'});const idH=r.run.id;await waitFor(()=>readRun(root,idH).pid);
assert.match(runs.start({planId:sonnetS.id,revision:1,model:'sonnet'}).error,/already active/);
const pidH=readRun(root,idH).pid;assert.ok(isAlive(pidH));
r=await runs.stop(idH);assert.equal(r.run.status,'stopped');assert.equal(isAlive(pidH),false);assert.equal(runs.locked(),false);
assert.ok((await runs.stop(idH)).error,'a stopped run cannot be stopped again');
// resume the stopped run: a resumed turn uses --resume and the same session
env.HUB_FAKE_SCENARIO='normal';
r=runs.resume(idH);assert.equal(r.run.status,'running');await finished(idH);
assert.equal(status(idH),'done');
let rec=JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8'));assert.ok(rec.argv.includes('--resume')&&!rec.argv.includes('--session-id'));assert.match(rec.stdin,/Continue from where you stopped/);
assert.ok(runs.resume(idH).error,'a finished run is not resumed');

// ── Opus: the second yes
const opusS=makePlan('opus','S');
r=runs.start({planId:opusS.id,revision:1,model:'opus'});assert.equal(r.needsConfirm,true);assert.equal(r.run.status,'confirming');assert.ok(r.run.confirmUntil>Date.now());
const idO=r.run.id;assert.equal(runs.locked(),false,'nothing runs before the second yes');assert.equal(runs.list().holding,idO,'but it holds the slot');
assert.match(runs.start({planId:sonnetS.id,revision:1,model:'sonnet'}).error,/already active/);
r=runs.confirm(idO);assert.equal(r.run.status,'running');await finished(idO);assert.equal(status(idO),'done');
// the confirmation expires
const quick=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,confirmMs:60});
const opusS2=makePlan('opus','S');r=quick.start({planId:opusS2.id,revision:1,model:'opus'});await sleep(120);
assert.match(quick.confirm(r.run.id).error||'',/second yes did not come/);assert.equal(readRun(root,r.run.id).status,'closed');
// cancel while confirming
const opusS3=makePlan('opus','S');r=runs.start({planId:opusS3.id,revision:1,model:'opus'});assert.equal((await runs.stop(r.run.id)).run.status,'closed');

// ── questions and answers
env.HUB_FAKE_SCENARIO='question';
const qPlan=makePlan('sonnet','S');r=runs.start({planId:qPlan.id,revision:1,model:'sonnet'});const idQ=r.run.id;await finished(idQ);
run=readRun(root,idQ);assert.equal(run.status,'waiting-answer');assert.match(run.question.text,/^QUESTION: Should the minimap be round or square\?/);assert.equal(run.question.id,1);
assert.equal(runs.locked(),false,'nothing runs while it waits for you');assert.equal(runs.list().holding,idQ);
assert.match(runs.answer(idQ,{question:7,text:'round'}).error,/newer question/);
env.HUB_FAKE_SCENARIO='normal';
r=runs.answer(idQ,{question:1,text:'Round, please.'});assert.equal(r.run.status,'running');await finished(idQ);
assert.equal(status(idQ),'done');rec=JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8'));
assert.equal(rec.stdin,'Round, please.');assert.ok(rec.argv.includes('--resume'));assert.equal(readRun(root,idQ).turn,2);
assert.ok(runs.answer(idQ,{question:1,text:'again'}).error,'a finished run takes no answer');
// close a waiting run
env.HUB_FAKE_SCENARIO='question';const q2=makePlan('sonnet','S');r=runs.start({planId:q2.id,revision:1,model:'sonnet'});await finished(r.run.id);assert.equal(runs.close(r.run.id).run.status,'closed');

// ── the cap: capped, then Continue with more
env.HUB_FAKE_SCENARIO='overcap';
const capPlan=makePlan('sonnet','S');r=runs.start({planId:capPlan.id,revision:1,model:'sonnet'});const idC=r.run.id;await finished(idC);
run=readRun(root,idC);assert.equal(run.status,'capped');assert.ok(run.tokens>=600000&&run.tokens<=1000000,'tokens '+run.tokens);assert.match(run.reason,/reached its cap/);
assert.match(runs.resume(idC).error,/cannot be resumed/);
env.HUB_FAKE_SCENARIO='normal';
const usedC=readRun(root,idC).tokens;
r=runs.continueMore(idC,{extra:1000000});assert.equal(r.run.status,'running');assert.equal(r.run.capTokens,usedC+1000000,'the extra is on top of what was really used');await finished(idC);
assert.equal(status(idC),'done');assert.ok(readRun(root,idC).tokens>600000,'tokens are cumulative across turns');
assert.match(runs.continueMore(idC,{extra:1000000}).error,/hit its cap/);
// opus + capped: Continue with more needs the second yes
env.HUB_FAKE_SCENARIO='overcap';
const opusCap=makePlan('opus','S');r=runs.start({planId:opusCap.id,revision:1,model:'opus'});r=runs.confirm(r.run.id);const idOC=r.run.id;await finished(idOC);assert.equal(status(idOC),'capped');
env.HUB_FAKE_SCENARIO='normal';
const usedOC=readRun(root,idOC).tokens;
r=runs.continueMore(idOC,{extra:200000});assert.equal(r.needsConfirm,true);assert.equal(readRun(root,idOC).status,'confirming');
r=runs.confirm(idOC);assert.equal(r.run.status,'running');assert.equal(r.run.capTokens,usedOC+200000);await finished(idOC);assert.equal(status(idOC),'done');

// ── the weekly guard stops a run, and a stopped-by-guard run is not resumed while use is high
env.HUB_FAKE_SCENARIO='gauge';setWeekly(90);
const gPlan=makePlan('sonnet','M');r=runs.start({planId:gPlan.id,revision:1,model:'sonnet'});assert.ok(r.run,JSON.stringify(r));const idG=r.run.id;await finished(idG);
assert.equal(status(idG),'guard-stopped');assert.match(readRun(root,idG).reason,/97/);
assert.equal(runs.resume(idG).code,409,'the run\'s own reading says 96%: no resume');setWeekly(12);

// ── crash, resume, violation
env.HUB_FAKE_SCENARIO='crash';
const cPlan=makePlan('sonnet','S');r=runs.start({planId:cPlan.id,revision:1,model:'sonnet'});const idX=r.run.id;await finished(idX);
assert.equal(status(idX),'failed');assert.match(readRun(root,idX).reason,/without a result/);
env.HUB_FAKE_SCENARIO='normal';r=runs.resume(idX);await finished(idX);assert.equal(status(idX),'done');
env.HUB_FAKE_SCENARIO='violation';
const vPlan=makePlan('sonnet','S');r=runs.start({planId:vPlan.id,revision:1,model:'sonnet'});const idV=r.run.id;await finished(idV);
assert.equal(status(idV),'failed');assert.equal(readRun(root,idV).violation,true);assert.match(runs.resume(idV).error,/violation/);
env.HUB_FAKE_SCENARIO='normal';

// ── the lock is shared with npm run assets
assert.deepEqual(acquireLock(root,'assets'),{ok:true});
const lp=makePlan('sonnet','S');r=runs.start({planId:lp.id,revision:1,model:'sonnet'});assert.match(r.error,/assets/);
assert.deepEqual(acquireLock(root,'run-x'),{ok:false,holder:'assets'});releaseLock(root,'run-x');assert.ok(readLock(root),'only the owner releases');
releaseLock(root,'assets');assert.equal(readLock(root),null);
fs.writeFileSync(lockFile(root),JSON.stringify({owner:'ghost',pid:2147483000,at:1}));assert.deepEqual(acquireLock(root,'assets'),{ok:true},'a lock from a dead process is taken over');releaseLock(root,'assets');
// an interrupted start left no lock behind, and the earlier "assets" refusal left no run holding the slot
assert.equal(runs.list().holding,null);

// ── restart clean-up: a run still marked running is killed if its pid is still the same program, then marked interrupted
if(process.platform==='win32'){
 env.HUB_FAKE_SCENARIO='question';const rp=makePlan('sonnet','S');r=runs.start({planId:rp.id,revision:1,model:'sonnet'});const idR=r.run.id;await finished(idR);
 const hang=()=>spawn(process.execPath,[FAKE],{env:{...process.env,HUB_FAKE_SCENARIO:'hang'},stdio:['pipe','ignore','ignore'],windowsHide:true});
 const live=hang(),stranger=hang();await sleep(400);
 const mark=(pid,exeName)=>{const x=readRun(root,idR);x.status='running';x.pid=pid;x.exeName=exeName;x.turns.at(-1).endedAt=null;saveRun(root,x)};
 mark(live.pid,path.basename(process.execPath).toLowerCase());
 const fresh=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env});
 assert.equal(await fresh.reapOrphans(),1);await waitFor(()=>!isAlive(live.pid));
 assert.equal(status(idR),'interrupted');assert.equal(readRun(root,idR).turns.at(-1).end,'interrupted');
 mark(stranger.pid,'other.exe');assert.equal(await fresh.reapOrphans(),1);
 assert.ok(isAlive(stranger.pid),'a pid that is not our program is never killed');stranger.kill();
 env.HUB_FAKE_SCENARIO='normal';r=fresh.resume(idR);assert.equal(r.run.status,'running','an interrupted run can be resumed');await finished(idR);
 // a confirmation left open when the hub stopped is dropped
 const op=makePlan('opus','S');r=runs.start({planId:op.id,revision:1,model:'opus'});assert.equal(await fresh.reapOrphans(),0);assert.equal(readRun(root,r.run.id).status,'closed')}

// ── the routes
resolveRoute(root,'/api/runs','127.0.0.1:1',1);
const R=(p,h='127.0.0.1:8765')=>resolveRoute(root,p,h,8765);
assert.deepEqual(R('/api/runs'),{api:'runs'});assert.deepEqual(R('/api/runs/start'),{api:'run-start',write:true});
assert.deepEqual(R('/api/runs/run-20261111-140211-ab12'),{api:'run-get',id:'run-20261111-140211-ab12',write:false});
assert.deepEqual(R('/api/runs/run-20261111-140211-ab12/stop'),{api:'run-stop',id:'run-20261111-140211-ab12',write:true});
assert.deepEqual(R('/api/runs/run-20261111-140211-ab12/feed'),{api:'run-feed',id:'run-20261111-140211-ab12',write:false});
for(const bad of ['/api/runs/x','/api/runs/run-1/stop','/api/runs/run-20261111-140211-ab12/delete','/api/runs/run-20261111-140211-ab12/../stop','/api/runs/'])assert.ok(R(bad).status,bad+' is refused');
assert.equal(R('/api/runs','evil.example').status,403);

const parseBody=s=>{if(!s)return null;try{return JSON.parse(s)}catch{return s}}; // some refusals (a bad Origin or Host) are plain text
const srv=createHubServer({root,runs}),port=await srv.listen(),ORIGIN=`http://127.0.0.1:${port}`;
const call=(method,url,{headers={},body,json=true,origin=ORIGIN,token=runs.token,ct='application/json'}={})=>new Promise((res,rej)=>{
 const h={...(origin?{Origin:origin}:{}),...(token?{'X-Hub-Token':token}:{}),...(ct&&method==='POST'?{'Content-Type':ct}:{}),...headers};
 const q=http.request({host:'127.0.0.1',port,method,path:url,headers:h},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>res({status:x.statusCode,body:parseBody(s)}))});q.on('error',rej);q.end(body===undefined?undefined:(json?JSON.stringify(body):body))});
let t=await call('GET','/api/hub-token');assert.equal(t.status,200);assert.equal(t.body.token,runs.token);assert.equal(t.body.token.length,48);
t=await call('GET','/api/runs');assert.equal(t.status,200);assert.equal(t.body.enabled,true);
const start=(o={})=>call('POST','/api/runs/start',{body:{plan:'x',revision:1,model:'sonnet',...o.body},...o.opts});
// refusals, in order of the checks
assert.equal((await call('POST','/api/runs/start',{origin:null,body:{plan:'x',revision:1,model:'sonnet'}})).status,403,'no Origin');
assert.equal((await call('POST','/api/runs/start',{origin:'http://evil.example',body:{plan:'x',revision:1,model:'sonnet'}})).status,403,'another site, even with the token');
assert.equal((await call('POST','/api/runs/start',{origin:`http://localhost:${port}.evil.example`,body:{}})).status,403,'look-alike origin');
assert.equal((await call('POST','/api/runs/start',{ct:'text/plain',body:{plan:'x'}})).status,415,'not JSON');
assert.equal((await call('POST','/api/runs/start',{ct:'application/x-www-form-urlencoded',body:'plan=x',json:false})).status,415,'a plain form post');
assert.equal((await call('POST','/api/runs/start',{token:null,body:{plan:sonnetS.id,revision:1,model:'sonnet'}})).status,403,'no token');
assert.equal((await call('POST','/api/runs/start',{token:'0'.repeat(48),body:{plan:sonnetS.id,revision:1,model:'sonnet'}})).status,403,'wrong token');
assert.equal((await call('POST','/api/runs/start',{token:runs.token.slice(0,40),body:{}})).status,403,'short token');
assert.equal((await call('POST','/api/runs/start',{body:'{not json',json:false})).status,400);
assert.equal((await call('POST','/api/runs/start',{body:[]})).status,400);
assert.equal((await call('POST','/api/runs/start',{body:'x'.repeat(70000),json:false})).status,413);
assert.equal((await start({body:{plan:'../etc'}})).status,400,'plan must match the id pattern');
assert.equal((await start({body:{plan:'C:\\x'}})).status,400);
assert.equal((await start({body:{revision:'1'}})).status,400);assert.equal((await start({body:{revision:0}})).status,400);
assert.equal((await start({body:{model:'gpt'}})).status,400);assert.equal((await start({body:{model:'claude-opus-5-5'}})).status,400,'a model id is not a model name');
assert.equal((await call('GET','/api/runs/start')).status,405,'start is not a GET');
assert.equal((await call('POST','/api/runs')).status,405);
const runId='run-20261111-140211-ab12';
assert.equal((await call('POST',`/api/runs/${runId}/answer`,{body:{question:1,text:''}})).status,400);
assert.equal((await call('POST',`/api/runs/${runId}/answer`,{body:{question:1,text:'x'.repeat(8001)}})).status,400);
assert.equal((await call('POST',`/api/runs/${runId}/answer`,{body:{question:'1',text:'x'}})).status,400);
assert.equal((await call('POST',`/api/runs/${runId}/continue`,{body:{extra:99999}})).status,400);
assert.equal((await call('POST',`/api/runs/${runId}/continue`,{body:{extra:3000001}})).status,400);
assert.equal((await call('POST',`/api/runs/${runId}/continue`,{body:{extra:'1000000'}})).status,400);
assert.equal((await call('POST',`/api/runs/${runId}/stop`,{body:{}})).status,404,'unknown run');
assert.equal((await call('GET',`/api/runs/${runId}`)).status,404);assert.equal((await call('GET',`/api/runs/${runId}/feed`)).status,404);
// the happy path over HTTP, and the plan lock
env.HUB_FAKE_SCENARIO='hang';
const hp=makePlan('sonnet','S');
t=await start({body:{plan:hp.id,revision:1}});assert.equal(t.status,200,JSON.stringify(t.body));assert.equal(t.body.run.status,'running');const hid=t.body.run.id;await waitFor(()=>readRun(root,hid).pid);
assert.equal((await call('GET',`/api/runs/${hid}`)).body.run.id,hid);
t=await call('POST',`/api/plans/${waitingPlan.id}/answer`,{body:{verdict:'approved',revision:1},token:null});assert.equal(t.status,423,'plans are locked while a run works');
assert.equal((await start({body:{plan:hp.id}})).status,409,'a second start while one works');
t=await call('POST',`/api/runs/${hid}/stop`,{body:{}});assert.equal(t.status,200);assert.equal(t.body.run.status,'stopped');
t=await call('POST',`/api/plans/${waitingPlan.id}/answer`,{body:{verdict:'approved',revision:1},token:null});assert.equal(t.status,200,'unlocked again: plans answer without a token (as in P4)');
t=await call('GET',`/api/runs/${hid}/feed?after=0`);assert.equal(t.status,200);assert.ok(t.body.events.length>=1);
t=await call('POST',`/api/runs/${hid}/close`,{body:{}});assert.equal(t.body.run.status,'closed');
// opus over HTTP: two clicks
env.HUB_FAKE_SCENARIO='normal';
const hop=makePlan('opus','S');t=await start({body:{plan:hop.id,model:'opus'}});assert.equal(t.body.needsConfirm,true);assert.equal(t.body.run.status,'confirming');
t=await call('POST',`/api/runs/${t.body.run.id}/confirm`,{body:{}});assert.equal(t.status,200);assert.equal(t.body.run.status,'running');await waitFor(()=>!runs.locked());
await srv.close();

// runs not switched on
const off=createHubServer({root}),offPort=await off.listen();
const callOff=(method,url,body)=>new Promise(res=>{const q=http.request({host:'127.0.0.1',port:offPort,method,path:url,headers:{Origin:`http://127.0.0.1:${offPort}`,'Content-Type':'application/json','X-Hub-Token':runs.token}},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>res({status:x.statusCode,body:parseBody(s)}))});q.end(JSON.stringify(body||{}))});
assert.equal((await callOff('POST','/api/runs/start',{plan:'x',revision:1,model:'sonnet'})).status,503);
assert.deepEqual((await callOff('GET','/api/runs')).body,{enabled:false,locked:false,holding:null,runs:[],ready:[]});
assert.equal((await callOff('GET','/api/hub-token')).body.token,null);
await off.close();

fs.rmSync(root,{recursive:true,force:true});
console.log('hub-runs: ok');
