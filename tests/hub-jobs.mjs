// Mikkadr Hub v2 V2: the tools. The job table, the job runner, the restart supervisor, the job routes, the master's tool buttons and the one-press Quick fix.
// Tiny fixture scripts (written into a throw-away folder) stand in for the project's scripts, and the FAKE Claude CLI for a run. No model call, no real claude.exe, and the real hub is never restarted here.
// What it pins: a job is a key into a fixed table (no shell strings, nothing from a request but the key), one job at a time under the shared lock, the record format, services start and stop,
// the index is rebuilt after a finished run, exit code 75 means "start me again", an older hub is replaced only when it answers as this hub, and every refused case of the routes and of Quick fix.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {fileURLToPath} from 'node:url';
import {JOBS,JOB_ID,tableProblems,stepsOf,summarise} from '../hub/jobs.js';
import {createJobs,newJobId,tailOf,TAIL_LINES,MAX_LINE,LOCK_OWNER} from '../hub/job-runner.mjs';
import {supervise,RESTART_CODE,HUB_NAME,writeHubFile,readHubFile,hubFile,getLocalJson,findOldHub,replaceOldHub} from '../hub/supervisor.mjs';
import {createRuns,processName,QUICK_NOTE} from '../hub/runs.js';
import {quickFix} from '../hub/runplan.js';
import {createHubServer,resolveRoute} from '../hub/server.js';
import {acquireLock,releaseLock,readLock,lockFile,readRun} from '../hub/run-store.mjs';
import {sendPlan,savePlan,readPlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';
import {isAlive,killTree} from '../hub/runner.js';
import {buildStatus,toolActions,toolLines} from '../hub/status.js';
import {MASTER_RULES} from '../hub/chat.js';
import {parseActionLine,withoutActions,chatActionState,chatActionCall,callFor,TOOL_OPS,HUB_OPS,QUICK_LABEL,QUICK_CAP} from '../hub/web/run-actions.js';
import {resultLine,nextLine,buttonOf,gameLink} from '../hub/web/tools.js';
import {TREE} from '../hub/web/shell.js';

const HERE=path.dirname(fileURLToPath(import.meta.url)),REPO=path.join(HERE,'..'),FAKE=path.join(HERE,'fixtures','fake-claude.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=10000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-jobs-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));fs.mkdirSync(path.join(root,'fx'));
const fx=(name,code)=>fs.writeFileSync(path.join(root,'fx',name),code);
fx('ok.mjs',"for(let i=1;i<=250;i++)console.log('line '+i);console.log('x'.repeat(500));console.log('args '+process.argv.slice(2).join(',')+' cwd '+process.cwd()+' electron '+(process.env.ELECTRON_RUN_AS_NODE||'none'));\n");
fx('bad.mjs',"console.log('about to fail');console.error('it broke');process.exit(3);\n");
fx('slow.mjs',"console.log('up');setInterval(()=>{},1000);\n");
fx('tests.mjs',"console.log('PASS a.mjs: ok');console.log('FAIL b.mjs');console.log('boom');console.log('FAIL c.mjs');console.log('2 of 5 test files failed.');process.exit(1);\n");
fx('green.mjs',"console.log('PASS a.mjs: ok');console.log('All 5 test files passed.');\n");

// ── the real table: every script is a plain path inside the repo that exists, every argument a plain flag, nothing a shell would read
assert.deepEqual(tableProblems(JOBS),[]);
assert.deepEqual(Object.keys(JOBS),['test','release','check','index','deploy-check','bump-step','bump','deploy','assets','dev','relay']);
for(const j of Object.values(JOBS)){if(j.steps)continue;assert.ok(fs.existsSync(path.join(REPO,j.script)),j.script+' exists');assert.ok(!/npm|cmd|powershell|[ &|;<>"'`$%^]/.test([j.script,...j.args].join('')),j.key+' has no shell words')}
assert.deepEqual(JOBS.release.args,['--force']);assert.deepEqual(JOBS.check.steps,['release','test']);assert.equal(JOBS.dev.kind,'service');assert.equal(JOBS.relay.kind,'service');assert.equal(JOBS.assets.ownLock,true);
assert.deepEqual(stepsOf(JOBS,'check'),[{key:'release',script:'scripts/package-release.mjs',args:['--force']},{key:'test',script:'scripts/run-tests.mjs',args:[]}]);
assert.deepEqual(stepsOf(JOBS,'test'),[{key:'test',script:'scripts/run-tests.mjs',args:[]}]);assert.deepEqual(stepsOf(JOBS,'nope'),[]);
// the job runner and the routes name no shell and no npm in their code
for(const f of ['jobs.js','job-runner.mjs']){const code=fs.readFileSync(path.join(REPO,'hub',f),'utf8').replace(/\/\/.*$/gm,'');assert.ok(!/shell\s*:\s*true|(?<![.\w])exec\(|execSync|cmd\.exe|npm(\.cmd)?['"]/.test(code),f+' starts nothing through a shell or npm')}
// a table that is not safe is named, and the runner refuses to exist with it
const J=(o={})=>({key:'a',label:'A',kind:'job',script:'scripts/a.mjs',args:[],...o});
for(const [why,t] of [['shell string',{a:J({script:'scripts/a.mjs && del x'})}],['parent folder',{a:J({script:'../a.mjs'})}],['absolute path',{a:J({script:'C:/x/a.mjs'})}],['backslash',{a:J({script:'scripts\\a.mjs'})}],['not a script',{a:J({script:'scripts/a.cmd'})}],
 ['argument with a value',{a:J({args:['--out=C:/x']})}],['argument that is a path',{a:J({args:['x.js']})}],['argument with a space',{a:J({args:['--a b']})}],['unknown kind',{a:J({kind:'shell'})}],['no label',{a:J({label:''})}],
 ['key mismatch',{b:J()}],['key with a slash',{'a/b':J({key:'a/b'})}],['step that is not a job',{a:J({steps:['x'],script:undefined})}],['step of steps',{a:J(),b:J({key:'b',steps:['a']}),c:J({key:'c',steps:['b']})}],
 ['step naming a service',{s:J({key:'s',kind:'service'}),b:J({key:'b',steps:['s']})}],['a link that is not localhost',{a:J({kind:'service',url:'http://evil.example:80'})}]]){
 assert.ok(tableProblems(t).length>=1,why);assert.throws(()=>createJobs({root,table:t}),/not safe/,why)}

// ── the summariser
assert.deepEqual(summarise('test','PASS a.mjs: ok\nAll 148 test files passed.\n',0),{ok:true,passed:148,total:148,failing:[],text:'148 of 148 passed'});
assert.deepEqual(summarise('test','PASS a.mjs: ok\r\nFAIL b.mjs\r\nstack\r\nFAIL c.mjs\r\n2 of 148 test files failed.\r\n',1),{ok:false,passed:146,total:148,failing:['b.mjs','c.mjs'],text:'146 of 148 passed, 2 failed'});
assert.equal(summarise('test','All 148 test files passed.',1).ok,false,'a pass line with a failing exit code is not a pass');assert.equal(summarise('test','',1).text,'The tests ended without a count');
assert.deepEqual(summarise('check','All 3 test files passed.',0,{step:'test'}),{ok:true,passed:3,total:3,failing:[],text:'3 of 3 passed'});
assert.deepEqual(summarise('check','boom',1,{step:'release'}),{ok:false,text:'The release failed, so the tests did not run'});
assert.deepEqual(summarise('index','',0),{ok:true,text:'Done'});assert.deepEqual(summarise('release','',2),{ok:false,text:'Failed (exit code 2)'});
assert.deepEqual(summarise('test','All 3 test files passed.',0,{stopped:true}),{ok:false,text:'Stopped by you'});
assert.match(newJobId(Date.UTC(2026,10,11,14,2,11)),/^job-20261111-140211-[0-9a-f]{4}$/);assert.ok(JOB_ID.test(newJobId()));
assert.equal(tailOf(Array.from({length:300},(_,i)=>'l'+i).join('\r\n')).length,TAIL_LINES);assert.equal(tailOf('a\n\n \nb').length,2);assert.equal(tailOf('y'.repeat(900))[0].length,MAX_LINE);

// ── the runner, on fixture scripts
const table={
 ok:{key:'ok',label:'Ok job',kind:'job',script:'fx/ok.mjs',args:['--force'],about:'fine'},
 bad:{key:'bad',label:'Bad job',kind:'job',script:'fx/bad.mjs',args:[]},
 slow:{key:'slow',label:'Slow job',kind:'job',script:'fx/slow.mjs',args:[]},
 test:{key:'test',label:'Run the tests',kind:'job',script:'fx/tests.mjs',args:[]},
 green:{key:'green',label:'Green',kind:'job',script:'fx/green.mjs',args:[]},
 check:{key:'check',label:'Check',kind:'job',steps:['bad','ok']},
 both:{key:'both',label:'Both',kind:'job',steps:['ok','green']},
 gone:{key:'gone',label:'Gone',kind:'job',script:'fx/missing.mjs',args:[]},
 index:{key:'index',label:'Rebuild the index',kind:'job',script:'fx/green.mjs',args:[]},
 dev:{key:'dev',label:'Game dev server',kind:'service',script:'fx/slow.mjs',args:[],url:'http://localhost:8000'},
 relay:{key:'relay',label:'Relay',kind:'service',script:'fx/bad.mjs',args:[]}};
let working=false; // what the hub would say: a run or a chat turn works
const jobs=createJobs({root,table,busy:()=>working,nameOf:processName});
const recFile=id=>path.join(root,'.hub','jobs',id+'.json'),rec=id=>JSON.parse(fs.readFileSync(recFile(id),'utf8'));
assert.equal(jobs.has('ok'),true);assert.equal(jobs.has('nope'),false);assert.equal(jobs.has('constructor'),false);assert.equal(jobs.has(undefined),false);
assert.equal(jobs.start('nope').code,400);assert.equal(jobs.start('__proto__').code,400);assert.equal(jobs.start(['ok']).code,400);assert.equal(jobs.active(),false);assert.equal(jobs.wait(),null);
let l=jobs.list();assert.equal(l.enabled,true);assert.equal(l.busy,false);assert.equal(l.running,null);assert.deepEqual(l.jobs.map(j=>j.key),Object.keys(table));assert.ok(l.jobs.every(j=>j.last===null&&j.running===null));
assert.equal(l.jobs.find(j=>j.key==='dev').url,'http://localhost:8000');assert.ok(!JSON.stringify(l).includes('fx/'),'the list never shows a script path');

// a job that passes: the record
let r=jobs.start('ok');assert.ok(r.job,JSON.stringify(r));assert.equal(r.job.status,'running');assert.ok(JOB_ID.test(r.job.id));assert.equal(jobs.active(),true);
assert.equal(readLock(root).owner,LOCK_OWNER,'the shared lock is held while it works');assert.equal(jobs.list().running.id,r.job.id);assert.equal(jobs.list().busy,true);
assert.equal(jobs.start('ok').code,409,'another job while one runs');assert.match(jobs.start('bad').error,/Another job is running \(Ok job\)/);
let done=await jobs.wait();
assert.equal(done.status,'done');assert.equal(done.exitCode,0);assert.deepEqual(done.summary,{ok:true,text:'Done'});assert.equal(done.tail.length,TAIL_LINES);assert.equal(done.tail.at(-2).length,MAX_LINE);
assert.match(done.tail.at(-1),/^args --force cwd .*hub-jobs-.* electron none$/,'the fixed argument from the table, the repo as working folder, a clean environment');
assert.equal(jobs.active(),false);assert.ok(!fs.existsSync(lockFile(root)),'the lock is released');
let saved=rec(done.id);assert.deepEqual(Object.keys(saved).sort(),['auto','endedAt','exitCode','hubPid','id','key','kind','label','pid','startedAt','status','summary','tail'].sort());
assert.equal(saved.key,'ok');assert.equal(saved.status,'done');assert.equal(saved.exitCode,0);assert.equal(saved.pid,null);assert.ok(saved.endedAt>=saved.startedAt);assert.equal(saved.tail.length,200);assert.equal(saved.auto,false);
assert.deepEqual(fs.readdirSync(path.join(root,'.hub','jobs')).filter(n=>!n.endsWith('.json')),[],'no temp file is left');assert.ok(!('pid' in done)&&!('hubPid' in done),'the public view hides pids');
assert.equal(jobs.last('ok').id,done.id);assert.equal(jobs.last('bad'),null);assert.equal(jobs.list().jobs.find(j=>j.key==='ok').last.id,done.id);

// a job that fails, the tests with their count, a script that is not there
jobs.start('bad');done=await jobs.wait();assert.equal(done.status,'failed');assert.equal(done.exitCode,3);assert.deepEqual(done.summary,{ok:false,text:'Failed (exit code 3)'});assert.deepEqual(done.tail,['about to fail','it broke']);
jobs.start('test');done=await jobs.wait();assert.equal(done.status,'failed');assert.deepEqual(done.summary,{ok:false,passed:3,total:5,failing:['b.mjs','c.mjs'],text:'3 of 5 passed, 2 failed'});
jobs.start('gone');done=await jobs.wait();assert.equal(done.status,'failed');assert.notEqual(done.exitCode,0);assert.ok(!fs.existsSync(lockFile(root)));
// steps: stop at the first failure; run all when each passes
jobs.start('check');done=await jobs.wait();assert.equal(done.status,'failed');assert.equal(done.summary.text,'The release failed, so the tests did not run');assert.ok(!done.tail.some(x=>x.startsWith('args ')),'the second step never ran');
jobs.start('both');done=await jobs.wait();assert.equal(done.status,'done');assert.ok(done.tail.some(x=>x.startsWith('args --force'))&&done.tail.includes('All 5 test files passed.'),'both steps ran, in order');

// refused while something else works or holds the lock; nothing is recorded for a refusal
const before=fs.readdirSync(path.join(root,'.hub','jobs')).length;
working=true;r=jobs.start('ok');assert.equal(r.code,409);assert.match(r.error,/A run or a chat turn is working/);assert.equal(jobs.list().busy,true);working=false;
assert.equal(acquireLock(root,'run-20261111-140211-ab12').ok,true);r=jobs.start('ok');assert.equal(r.code,409);assert.match(r.error,/holds the lock \(run-20261111-140211-ab12\)/);
assert.equal(readLock(root).owner,'run-20261111-140211-ab12','a refused job leaves the lock with its holder');releaseLock(root,'run-20261111-140211-ab12');
assert.equal(fs.readdirSync(path.join(root,'.hub','jobs')).length,before);assert.equal(jobs.active(),false);

// Stop a job that is working: its process is gone, the record says so, the lock is free
r=jobs.start('slow');const slowId=r.job.id,slowPid=(await waitFor(()=>{try{return rec(slowId).pid?rec(slowId):null}catch{return null}})).pid;assert.ok(isAlive(slowPid));
assert.equal((await jobs.stop('job-20261111-140211-ab12')).code,404);assert.equal((await jobs.stop('../x')).code,400);assert.equal((await jobs.stop(slowPid)).code,400,'a pid is not a job id');
r=await jobs.stop(slowId);assert.equal(r.job.status,'stopped');assert.deepEqual(r.job.summary,{ok:false,text:'Stopped by you'});await waitFor(()=>!isAlive(slowPid));assert.ok(!fs.existsSync(lockFile(root)));assert.equal(rec(slowId).status,'stopped');
assert.equal((await jobs.stop(slowId)).code,404,'already stopped');

// services: no lock, start while something works, tracked, stopped, and one that ends by itself
working=true;acquireLock(root,'chat');
r=jobs.start('dev');assert.ok(r.job,JSON.stringify(r));assert.equal(r.job.kind,'service');assert.equal(readLock(root).owner,'chat','a service does not take the lock');assert.equal(jobs.active(),false,'a service is not a job at work');
working=false;releaseLock(root,'chat');
const devId=r.job.id,devPid=rec(devId).pid;assert.ok(Number.isInteger(devPid)&&isAlive(devPid));
assert.equal(jobs.start('dev').code,409,'already running');l=jobs.list();assert.equal(l.busy,false);assert.equal(l.running,null);assert.equal(l.jobs.find(j=>j.key==='dev').running.id,devId);
jobs.start('green');done=await jobs.wait();assert.equal(done.status,'done','a job runs beside a service');
r=await jobs.stop(devId);assert.equal(r.job.status,'stopped');assert.deepEqual(r.job.summary,{ok:true,text:'Stopped'});await waitFor(()=>!isAlive(devPid));assert.equal(jobs.list().jobs.find(j=>j.key==='dev').running,null);
r=jobs.start('relay');const relayId=r.job.id;await waitFor(()=>rec(relayId).status!=='running');assert.equal(rec(relayId).status,'failed');assert.equal(rec(relayId).summary.text,'It ended by itself (exit code 3)');
// shutdown (the hub exits, or restarts): nothing it started outlives it
jobs.start('dev');jobs.start('slow');const p1=rec(jobs.list().jobs.find(j=>j.key==='dev').running.id).pid,sid=jobs.list().running.id,p2=(await waitFor(()=>rec(sid).pid?rec(sid):null)).pid;
await jobs.shutdown();await waitFor(()=>!isAlive(p1)&&!isAlive(p2));assert.equal(jobs.active(),false);assert.ok(!fs.existsSync(lockFile(root)));

// after a hub that died: records still marked running are closed, a service that is still alive is stopped, a stranger that reused a pid is left alone
const orphan=spawn(process.execPath,[path.join(root,'fx','slow.mjs')],{stdio:'ignore',windowsHide:true});
const mk=(o)=>{const id=newJobId();fs.writeFileSync(recFile(id),JSON.stringify({id,key:'dev',label:'Game dev server',kind:'service',auto:false,status:'running',startedAt:Date.now()-5000,endedAt:null,exitCode:null,summary:null,tail:[],pid:null,hubPid:1,...o}));return id};
const o1=mk({pid:orphan.pid}),o2=mk({kind:'job',key:'ok',label:'Ok job',pid:null});
acquireLock(root,LOCK_OWNER,{pid:99999998});
if(process.platform==='win32'){
 assert.equal(await jobs.reapOrphans(),2);await waitFor(()=>!isAlive(orphan.pid));
 for(const id of [o1,o2]){assert.equal(rec(id).status,'interrupted');assert.equal(rec(id).summary.text,'The hub stopped while this was running');assert.equal(rec(id).pid,null)}
 assert.ok(!fs.existsSync(lockFile(root)),'the dead job\'s lock is cleared');assert.equal(await jobs.reapOrphans(),0);
 const stranger=createJobs({root,table,nameOf:async()=>'notepad.exe'}),o3=mk({pid:process.pid});assert.equal(await stranger.reapOrphans(),1);assert.equal(rec(o3).status,'interrupted');assert.ok(isAlive(process.pid),'a pid under another program name is never stopped')}
else{await killTree(orphan.pid);releaseLock(root,LOCK_OWNER)}

// ── the index is rebuilt after a run finishes (and only then)
const setWeekly=(pct,five=20)=>fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:five,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
let planN=0;
function makePlan(model,size,{approve=true,from='master',deny=false}={}){
 const name=`plan-${++planN}`,text=`# ${name}\n\n## Run\nmodel: ${model}\nwhy: test\nsize: ${size}\nneeds: npm test\n`;
 let {plan}=sendPlan(path.join(root,'plans'),{source:name+'.md',title:name,from,text,now:Date.now()});
 if(approve||deny)plan=answerPlan(plan,{verdict:deny?'denied':'approved',note:deny?'no':'go',revision:1,now:Date.now()}).plan;
 savePlan(path.join(root,'plans'),plan);return plan}
const env={HUB_FAKE_SCENARIO:'normal',HUB_FAKE_OUT:path.join(root,'fake-out.json')};
let chatBusy=false;const ended=[];
const jobs2=createJobs({root,table,busy:()=>runs.locked()||chatBusy});
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0,busy:()=>chatBusy||jobs2.active(),onEnd:v=>{ended.push(v.status);if(v.status==='done')jobs2.start('index',{auto:true})}});
setWeekly(12);
r=runs.start({planId:makePlan('sonnet','S').id,revision:1,model:'sonnet'});assert.ok(r.run,JSON.stringify(r));
assert.equal(jobs2.start('ok').code,409,'no job while a run works');
await waitFor(()=>readRun(root,r.run.id).status==='done');
const auto=await waitFor(()=>jobs2.last('index'));assert.equal(auto.auto,true);assert.equal(auto.status,'done');assert.equal(auto.key,'index');assert.deepEqual(ended,['done']);
env.HUB_FAKE_SCENARIO='crash';setWeekly(12);
r=runs.start({planId:makePlan('sonnet','S').id,revision:1,model:'sonnet'});await waitFor(()=>readRun(root,r.run.id).status!=='running');await sleep(150);
assert.equal(ended.length,2);assert.notEqual(ended[1],'done');assert.equal(jobs2.last('index').id,auto.id,'a run that did not finish starts no index job');
runs.close(r.run.id);
// a run refuses to start while a job works
env.HUB_FAKE_SCENARIO='normal';setWeekly(12);
jobs2.start('slow');const busyPlan=makePlan('sonnet','S');r=runs.start({planId:busyPlan.id,revision:1,model:'sonnet'});assert.equal(r.code,409,'no run while a job works');
await jobs2.stop(jobs2.list().running.id);

// ── Quick fix: one press approves and starts, only for a Haiku S plan the master filed
assert.equal(QUICK_CAP,150000);assert.equal(QUICK_LABEL,'Approve and start (Haiku, up to 150,000 tokens)');
const q1=makePlan('haiku','S',{approve:false});
assert.deepEqual(quickFix(q1),{model:'haiku',size:'S',capTokens:150000,revision:1});
assert.equal(quickFix(makePlan('sonnet','S',{approve:false})),null,'not Haiku');assert.equal(quickFix(makePlan('haiku','S',{approve:false,from:'vscode'})),null,'not filed by the master');
assert.equal(quickFix(makePlan('haiku','S')),null,'already approved');assert.equal(quickFix(makePlan('haiku','S',{deny:true})),null,'denied');assert.equal(quickFix(null),null);
{const {plan}=sendPlan(path.join(root,'plans'),{source:'nob.md',title:'nob',from:'master',text:'# nob\n\nNo run block.\n',now:Date.now()});assert.equal(quickFix(plan),null,'no Run block')}
const still=id=>readPlan(path.join(root,'plans'),id);
const refused=(o,re,why,code=409)=>{const x=runs.quick(o);assert.equal(x.code,code,why+': '+JSON.stringify(x));assert.match(x.error,re,why);return x};
refused({planId:'no-such-plan',revision:1},/No such plan/,'unknown plan',404);
refused({planId:q1.id,revision:2},/newest revision is 1/,'a revision that is not the newest');
refused({planId:makePlan('haiku','S',{approve:false,from:'vscode'}).id,revision:1},/only for a plan the master filed/,'a plan the master did not file');
refused({planId:makePlan('sonnet','S',{approve:false}).id,revision:1},/only for a Haiku plan of size S/,'Sonnet');
refused({planId:makePlan('opus','S',{approve:false}).id,revision:1},/only for a Haiku plan of size S/,'Opus');
refused({planId:makePlan('haiku','S',{deny:true}).id,revision:1},/You denied this revision/,'a revision you denied');
refused({planId:makePlan('haiku','S').id,revision:1},/already approved/,'already approved');
assert.equal(createRuns({root,claude:null}).quick({planId:q1.id,revision:1}).code,503,'no claude.exe');
// the stored text must match its hash
{const bad=makePlan('haiku','S',{approve:false}),f=path.join(root,'plans',bad.id+'.json'),j=JSON.parse(fs.readFileSync(f,'utf8'));j.revisions[0].text=j.revisions[0].text.replace('why: test','why: sneaky');fs.writeFileSync(f,JSON.stringify(j));refused({planId:bad.id,revision:1},/does not match its stored hash/,'edited plan text')}
// the same checks as the two presses, made before anything is saved: the weekly guard, no reading, something else working
setWeekly(98.5);refused({planId:q1.id,revision:1},/./,'the weekly guard');assert.equal(still(q1.id).status,'waiting','a refused press leaves the plan waiting');assert.equal(still(q1.id).answers.length,0);
fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),'');refused({planId:q1.id,revision:1},/./,'no gauge reading');assert.equal(still(q1.id).status,'waiting');
setWeekly(12);chatBusy=true;refused({planId:q1.id,revision:1},/./,'the master is working');assert.equal(still(q1.id).status,'waiting');chatBusy=false;
jobs2.start('slow');refused({planId:q1.id,revision:1},/./,'a job is working');assert.equal(still(q1.id).status,'waiting');await jobs2.stop(jobs2.list().running.id);
acquireLock(root,'assets');refused({planId:q1.id,revision:1},/holds the lock \(assets\)/,'the lock is held by something else');assert.equal(still(q1.id).status,'waiting');assert.equal(readLock(root).owner,'assets');releaseLock(root,'assets');
const q2=q1;
env.HUB_FAKE_SCENARIO='hang';setWeekly(12);
r=runs.quick({planId:q2.id,revision:1});assert.ok(r.run,JSON.stringify(r));assert.equal(r.run.status,'running');assert.equal(r.run.model,'haiku');assert.equal(r.run.capTokens,150000);assert.ok(!r.needsConfirm);
assert.equal(still(q2.id).status,'approved');assert.equal(still(q2.id).answers.at(-1).note,QUICK_NOTE);
const q3=makePlan('haiku','S',{approve:false});refused({planId:q3.id,revision:1},/locked while a run works/,'a run is working',423);assert.equal(still(q3.id).status,'waiting');
await runs.stop(r.run.id);runs.close(r.run.id);refused({planId:q2.id,revision:1},/already approved/,'pressed twice');

// ── the routes
const R=(p,host='127.0.0.1:8765')=>resolveRoute(root,p,host,8765);
assert.deepEqual(R('/api/jobs'),{api:'jobs'});assert.deepEqual(R('/api/hub-id'),{api:'hub-id'});
assert.equal(R('/api/jobs/start').api,'job-start');assert.equal(R('/api/jobs/start').write,true);assert.equal(R('/api/jobs/stop').api,'job-stop');assert.equal(R('/api/hub/restart').api,'hub-restart');assert.equal(R('/api/hub/restart').write,true);
assert.deepEqual(R('/api/plans/minimap-plan/quick'),{api:'quick',id:'minimap-plan',write:true});
for(const bad of ['/api/jobs/run','/api/jobs/start/test','/api/jobs/test','/api/hub/stop','/api/plans/../quick','/api/plans/Minimap/quick'])assert.ok(R(bad).status,bad+' is refused');
assert.equal(R('/api/jobs','evil.example').status,403);

let restartSays={error:'A run is working. Stop it or wait for it, then restart.'},went=0;
const srv=createHubServer({root,runs,jobs:jobs2,restart:()=>restartSays,startedAt:1234}),port=await srv.listen(),ORIGIN=`http://127.0.0.1:${port}`;
const parseBody=s=>{if(!s)return null;try{return JSON.parse(s)}catch{return s}};
const call=(method,url,{body,json=true,origin=ORIGIN,token=runs.token,ct='application/json',to=port}={})=>new Promise((res,rej)=>{
 const h={...(origin?{Origin:origin}:{}),...(token?{'X-Hub-Token':token}:{}),...(ct&&method==='POST'?{'Content-Type':ct}:{})};
 const q=http.request({host:'127.0.0.1',port:to,method,path:url,headers:h},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>res({status:x.statusCode,body:parseBody(s)}))});q.on('error',rej);q.end(body===undefined?undefined:(json?JSON.stringify(body):body))});
let t=await call('GET','/api/jobs');assert.equal(t.status,200);assert.equal(t.body.enabled,true);assert.deepEqual(t.body.jobs.map(j=>j.key),Object.keys(table));assert.equal(t.body.jobs.find(j=>j.key==='index').last.auto,true);
assert.ok(!JSON.stringify(t.body).match(/fx\/|"pid"|hubPid/),'no script path and no pid leaves the hub');
t=await call('GET','/api/hub-id',{token:null,origin:null});assert.match(t.body.version,/^2\.\d+(\.\d+)?$/,'hub-id carries the hub version');delete t.body.version;assert.deepEqual(t.body,{hub:HUB_NAME,pid:process.pid,startedAt:1234,canRestart:true});
// refusals, in the order of the checks
for(const url of ['/api/jobs/start','/api/jobs/stop','/api/hub/restart',`/api/plans/${q3.id}/quick`]){
 assert.equal((await call('GET',url)).status,405,url+' is not a GET');
 assert.equal((await call('POST',url,{origin:null,body:{}})).status,403,url+': no Origin');
 assert.equal((await call('POST',url,{origin:'http://evil.example',body:{}})).status,403,url+': another site, even with the token');
 assert.equal((await call('POST',url,{ct:'text/plain',body:{}})).status,415,url+': not JSON');
 assert.equal((await call('POST',url,{body:'x'.repeat(70000),json:false})).status,413,url+': too large');
 assert.equal((await call('POST',url,{body:'{not json',json:false})).status,400,url+': broken JSON');
 assert.equal((await call('POST',url,{token:null,body:{job:'ok',id:'job-20261111-140211-ab12',revision:1}})).status,403,url+': no token');
 assert.equal((await call('POST',url,{token:'0'.repeat(48),body:{job:'ok',id:'job-20261111-140211-ab12',revision:1}})).status,403,url+': wrong token')}
assert.equal((await call('POST','/api/jobs')).status,405);
for(const job of ['nope','fx/ok.mjs','scripts/run-tests.mjs','constructor','__proto__','OK',' ok',['ok'],{key:'ok'},7,null,undefined,'ok && del x'])assert.equal((await call('POST','/api/jobs/start',{body:{job}})).status,400,'unknown job refused: '+JSON.stringify(job));
t=await call('POST','/api/jobs/start',{body:{job:'ok',script:'fx/bad.mjs',args:['--evil'],cwd:'C:\\'}});assert.equal(t.status,200,JSON.stringify(t.body));done=await jobs2.wait();
assert.equal(done.status,'done');assert.match(done.tail.at(-1),/^args --force cwd /,'a script or an argument in the request is ignored: only the key counts');
for(const id of ['x','../x','run-20261111-140211-ab12',7,null,['job-20261111-140211-ab12']])assert.equal((await call('POST','/api/jobs/stop',{body:{id}})).status,400,'bad job id: '+JSON.stringify(id));
assert.equal((await call('POST','/api/jobs/stop',{body:{id:'job-20261111-140211-ab12'}})).status,404,'not running');
// busy: another job, the master, a run
t=await call('POST','/api/jobs/start',{body:{job:'slow'}});assert.equal(t.status,200);const hid=t.body.job.id;
assert.equal((await call('POST','/api/jobs/start',{body:{job:'ok'}})).status,409,'a job is running');
assert.equal((await call('POST',`/api/plans/${q3.id}/quick`,{body:{revision:1}})).status,409,'no one-press start while a job works');assert.equal(still(q3.id).status,'waiting');
t=await call('GET','/api/jobs');assert.equal(t.body.running.id,hid);assert.equal(t.body.busy,true);
t=await call('POST','/api/jobs/stop',{body:{id:hid}});assert.equal(t.status,200);assert.equal(t.body.job.status,'stopped');
chatBusy=true;t=await call('POST','/api/jobs/start',{body:{job:'ok'}});assert.equal(t.status,409,'the master is working');assert.match(t.body.error,/A run or a chat turn is working/);
t=await call('POST','/api/jobs/start',{body:{job:'dev'}});assert.equal(t.status,200,'a server may start while the master works');t=await call('POST','/api/jobs/stop',{body:{id:t.body.job.id}});assert.equal(t.status,200);chatBusy=false;
// quick over HTTP
for(const revision of ['1',0,1.5,null,100001])assert.equal((await call('POST',`/api/plans/${q3.id}/quick`,{body:{revision}})).status,400,'revision '+revision);
assert.equal((await call('POST','/api/plans/no-such-plan/quick',{body:{revision:1}})).status,404);
t=await call('GET',`/api/plans/${q3.id}`);assert.deepEqual(t.body.quick,{model:'haiku',size:'S',capTokens:150000,revision:1},'the plan page is told the button may be shown');
t=await call('GET',`/api/plans/${busyPlan.id}`);assert.equal(t.body.quick,null);
env.HUB_FAKE_SCENARIO='hang';setWeekly(12);
t=await call('POST',`/api/plans/${q3.id}/quick`,{body:{revision:1}});assert.equal(t.status,200,JSON.stringify(t.body));assert.equal(t.body.run.status,'running');assert.equal(t.body.run.model,'haiku');assert.equal(still(q3.id).status,'approved');
const q4=makePlan('haiku','S',{approve:false});assert.equal((await call('POST',`/api/plans/${q4.id}/quick`,{body:{revision:1}})).status,423,'plans are locked while a run works');
assert.equal((await call('POST','/api/jobs/start',{body:{job:'ok'}})).status,409,'a run is working');
// restart: refused while something works, then allowed; the hub answers first and goes after
t=await call('POST','/api/hub/restart',{body:{}});assert.equal(t.status,409);assert.match(t.body.error,/A run is working/);
await call('POST',`/api/runs/${t=(await call('GET','/api/runs')).body.holding}/stop`,{body:{}});runs.close(t);
restartSays={go:()=>{went++}};t=await call('POST','/api/hub/restart',{body:{}});assert.deepEqual(t.body,{restarting:true});await waitFor(()=>went===1);
await srv.close();
// a hub that was not started by the supervisor cannot restart itself; a hub without --runs has no tools
const plain=createHubServer({root,runs,jobs:jobs2}),pp=await plain.listen();
t=await call('POST','/api/hub/restart',{body:{},to:pp,origin:`http://127.0.0.1:${pp}`});assert.equal(t.status,503);assert.match(t.body.error,/cannot restart itself/);
assert.equal((await call('GET','/api/hub-id',{to:pp,origin:null})).body.canRestart,false);await plain.close();
const off=createHubServer({root}),op=await off.listen(),O={to:op,origin:`http://127.0.0.1:${op}`};
assert.deepEqual((await call('GET','/api/jobs',O)).body,{enabled:false,busy:false,running:null,jobs:[]});
assert.equal((await call('POST','/api/jobs/start',{...O,body:{job:'test'}})).status,503);assert.equal((await call('POST','/api/hub/restart',{...O,body:{}})).status,503);assert.equal((await call('POST',`/api/plans/${q4.id}/quick`,{...O,body:{revision:1}})).status,503);
assert.equal((await call('GET',`/api/plans/${q4.id}`,O)).body.quick,null,'no one-press button when runs are off');
assert.equal((await call('GET','/api/hub-id',O)).body.hub,HUB_NAME);await off.close();

// ── restart: the supervisor starts the hub again on exit code 75, and only then (a pretend server; the real hub is not restarted by this test)
assert.equal(RESTART_CODE,75);
const pretend=codes=>{const seen=[];return {seen,startChild:n=>{seen.push(n);const c=new EventEmitter();setImmediate(()=>c.emit('exit',codes[seen.length-1]));return c}}};
let p=pretend([75,75,0]),log=[];assert.equal(await supervise({startChild:p.startChild,log:m=>log.push(m),fastMs:0}),0);assert.deepEqual(p.seen,[0,1,2]);assert.equal(log.length,2);
p=pretend([3]);assert.equal(await supervise({startChild:p.startChild}),3,'any other exit code ends it');assert.deepEqual(p.seen,[0]);
p=pretend([null]);assert.equal(await supervise({startChild:p.startChild}),1,'killed by a signal');
assert.equal(await supervise({startChild:()=>{throw new Error('no')}}),1);
{const c=new EventEmitter();setImmediate(()=>c.emit('error',new Error('spawn failed')));assert.equal(await supervise({startChild:()=>c}),1)}
p=pretend(Array(20).fill(75));log=[];assert.equal(await supervise({startChild:p.startChild,log:m=>log.push(m)}),1,'a hub that keeps asking to restart within seconds is stopped');assert.equal(p.seen.length,5);assert.match(log.at(-1),/5 times in a row/);
{let clock=0;p=pretend([75,75,75,75,75,75,75,0]);assert.equal(await supervise({startChild:n=>{clock+=10000;return p.startChild(n)},now:()=>clock,fastMs:3000}),0,'slow restarts are fine');assert.equal(p.seen.length,8)}
// npm run hub is the supervisor, and the supervised hub is the same file with --child
const cli=fs.readFileSync(path.join(REPO,'hub','hub-cli.mjs'),'utf8');assert.ok(cli.includes("'--child'")&&cli.includes('supervise(')&&cli.includes('HUB_SUPERVISED')&&cli.includes('RESTART_CODE'));
assert.equal(JSON.parse(fs.readFileSync(path.join(REPO,'package.json'),'utf8').replace(/^\uFEFF/,'')).scripts.hub,'node hub/hub-cli.mjs');

// ── an older hub on the port: replaced only when it answers as this hub
writeHubFile(root,{pid:4242,port:8765,startedAt:99});assert.deepEqual(readHubFile(root),{pid:4242,port:8765,startedAt:99});assert.ok(!fs.readFileSync(hubFile(root),'utf8').startsWith('\uFEFF'));
const hubSays=a=>async(port,p)=>{assert.equal(p,'/api/hub-id');return a};
assert.deepEqual(await findOldHub({root,port:8765,getJson:hubSays({hub:HUB_NAME,pid:4242})}),{hub:true,pid:4242});
const killed=[],kill=async pid=>{killed.push(pid);return {gone:true}};
for(const [why,port,answer] of [['nothing answers',8765,null],['it is not a hub',8765,{hub:'something-else',pid:4242}],['another pid answers',8765,{hub:HUB_NAME,pid:4243}],['the pid is a string',8765,{hub:HUB_NAME,pid:'4242'}],['another port',8766,{hub:HUB_NAME,pid:4242}],['a web page answers',8765,'<html>']]){
 assert.deepEqual(await findOldHub({root,port,getJson:hubSays(answer)}),{hub:false},why);
 assert.deepEqual(await replaceOldHub({root,port,getJson:hubSays(answer),kill}),{replaced:false,pid:null},why)}
assert.deepEqual(await replaceOldHub({root,port:8765,getJson:async()=>{throw new Error('down')},kill}),{replaced:false,pid:null});
assert.deepEqual(killed,[],'a pid that did not answer as a hub is never stopped');
writeHubFile(root,{pid:process.pid,port:8765,startedAt:1});assert.deepEqual(await replaceOldHub({root,port:8765,getJson:hubSays({hub:HUB_NAME,pid:process.pid}),kill}),{replaced:false,pid:null},'a hub never replaces itself');
fs.writeFileSync(hubFile(root),'{broken');assert.equal(readHubFile(root),null);assert.deepEqual(await replaceOldHub({root,port:8765,getJson:hubSays({hub:HUB_NAME,pid:4242}),kill}),{replaced:false,pid:null},'no hub file');assert.deepEqual(killed,[]);
writeHubFile(root,{pid:4242,port:8765,startedAt:99});assert.deepEqual(await replaceOldHub({root,port:8765,getJson:hubSays({hub:HUB_NAME,pid:4242}),kill}),{replaced:true,pid:4242});assert.deepEqual(killed,[4242]);
// the real question over HTTP: a hub answers, a stranger on the port does not
{const h=createHubServer({root}),hp=await h.listen();const a=await getLocalJson(hp,'/api/hub-id');assert.equal(a.hub,HUB_NAME);assert.equal(a.pid,process.pid);await h.close();
 const s=http.createServer((q,res)=>res.end('<html>hello</html>'));await new Promise(ok=>s.listen(0,'127.0.0.1',ok));assert.equal(await getLocalJson(s.address().port,'/api/hub-id'),null);await new Promise(ok=>s.close(ok));
 assert.equal(await getLocalJson(hp,'/api/hub-id',500),null,'nothing listens')}

// ── the master: tool lines, their buttons, and what a click sends
assert.deepEqual(TOOL_OPS,['test','release','check','index','dev-start','dev-stop','restart']);assert.deepEqual(HUB_OPS,['quick']);
for(const op of TOOL_OPS){assert.deepEqual(parseActionLine('ACTION: '+op),{op});assert.deepEqual(parseActionLine(`  **ACTION:** \`${op}\`  `),{op});assert.ok(MASTER_RULES.includes('ACTION: '+op),'the master is told about '+op)}
for(const bad of ['ACTION: test tests/x.mjs','ACTION: test --force','ACTION: release 0.40.0','ACTION: restart now','ACTION: dev','ACTION: assets','ACTION: relay','ACTION: quick a 1','ACTION: run npm test','ACTION: tests','please ACTION: test','ACTION: test && del x'])assert.equal(parseActionLine(bad),null,bad);
assert.equal(withoutActions('I will check.\nACTION: check\nThen we see.'),'I will check.\nThen we see.');
const view=(o={})=>({enabled:true,busy:false,running:null,jobs:[{key:'test',label:'Run the tests',kind:'job',running:null,last:null},{key:'release',label:'Make a release',kind:'job',running:null,last:null},{key:'check',label:'Check',kind:'job',running:null,last:null},{key:'index',label:'Rebuild the index',kind:'job',running:null,last:null},{key:'dev',label:'Game dev server',kind:'service',url:'http://localhost:8000',running:null,last:null}],...o});
const devUp=view();devUp.jobs[4].running={id:'job-20261111-140211-ab12',startedAt:Date.now()};
assert.deepEqual(chatActionState({op:'test'},{jobs:view()}),{label:'Run the tests',enabled:true,why:'A script on this PC. It uses no tokens.',primary:true});
assert.equal(chatActionState({op:'test'},{}).enabled,false);assert.match(chatActionState({op:'test'},{jobs:{enabled:false}}).why,/Tools are off/);
assert.match(chatActionState({op:'check'},{jobs:view({busy:true})}).why,/Something is working/);assert.equal(chatActionState({op:'restart'},{jobs:view({busy:true})}).enabled,false);assert.equal(chatActionState({op:'restart'},{jobs:view()}).enabled,true);
{const v=view();v.jobs[0].running={id:'job-20261111-140211-ab12',startedAt:1};assert.match(chatActionState({op:'test'},{jobs:v}).why,/running now/)}
assert.equal(chatActionState({op:'dev-start'},{jobs:view()}).enabled,true);assert.equal(chatActionState({op:'dev-start'},{jobs:view({busy:true})}).enabled,true,'the dev server may start while something works');assert.match(chatActionState({op:'dev-start'},{jobs:devUp}).why,/already running/);
assert.equal(chatActionState({op:'dev-stop'},{jobs:devUp}).enabled,true);assert.match(chatActionState({op:'dev-stop'},{jobs:view()}).why,/not running/);
assert.equal(chatActionState({op:'assets'},{jobs:view()}).enabled,false,'not an action the master may propose');
assert.deepEqual(chatActionCall({op:'test'},{jobs:view()}),{op:'job-start',args:{job:'test'}});assert.deepEqual(chatActionCall({op:'dev-start'},{jobs:view()}),{op:'job-start',args:{job:'dev'}});
assert.deepEqual(chatActionCall({op:'dev-stop'},{jobs:devUp}),{op:'job-stop',args:{id:'job-20261111-140211-ab12'}});assert.equal(chatActionCall({op:'dev-stop'},{jobs:view()}),null);assert.deepEqual(chatActionCall({op:'restart'},{}),{op:'hub-restart',args:{}});
assert.deepEqual(callFor('job-start',{job:'test'}),{url:'/api/jobs/start',body:{job:'test'}});assert.deepEqual(callFor('job-stop',{id:'job-20261111-140211-ab12'}),{url:'/api/jobs/stop',body:{id:'job-20261111-140211-ab12'}});
assert.deepEqual(callFor('hub-restart',{}),{url:'/api/hub/restart',body:{}});assert.deepEqual(callFor('quick',{plan:'a',revision:2}),{url:'/api/plans/a/quick',body:{revision:2}});assert.equal(callFor('job-start',{}),null);assert.equal(callFor('quick',{}),null);
// the Quick fix button in the chat
const plans=[{id:'a',title:'Typo',status:'waiting',revision:2}];
assert.deepEqual(chatActionState({op:'quick',plan:'a',revision:2},{plans}),{label:QUICK_LABEL,enabled:true,why:'One press approves this revision and starts it.',primary:false});
assert.match(chatActionState({op:'quick',plan:'a',revision:1},{plans}).why,/newer revision/);assert.match(chatActionState({op:'quick',plan:'a',revision:2},{plans:[{...plans[0],status:'approved'}]}).why,/Already approved/);assert.equal(chatActionState({op:'quick',plan:'x',revision:1},{plans}).enabled,false);
assert.deepEqual(chatActionCall({op:'quick',plan:'a',revision:2},{}),{op:'quick',args:{plan:'a',revision:2}});
// the status block the master reads
assert.deepEqual(toolActions(view()),['ACTION: test','ACTION: release','ACTION: check','ACTION: index','ACTION: dev-start','ACTION: restart']);assert.deepEqual(toolActions(view({busy:true})),['ACTION: dev-start']);
assert.deepEqual(toolActions(devUp),['ACTION: test','ACTION: release','ACTION: check','ACTION: index','ACTION: dev-stop','ACTION: restart']);assert.deepEqual(toolActions(null),[]);assert.deepEqual(toolActions({enabled:false}),[]);
assert.deepEqual(toolLines(view()),['Tests: not run from the hub yet.']);assert.deepEqual(toolLines(null),[]);
{const v=view(),now=Date.now();v.jobs[0].last={endedAt:now-120000,summary:{ok:false,passed:146,total:148,failing:['b.mjs','c.mjs'],text:'146 of 148 passed, 2 failed'}};v.jobs[2].last={endedAt:now-9e6,summary:{ok:true,passed:148,total:148,failing:[],text:'148 of 148 passed'}};
 v.jobs[4].running={id:'x',startedAt:now};v.running={label:'Rebuild the index'};
 const L=toolLines(v,now);assert.match(L[0],/^Tests \(last run from the hub, \d\d:\d\d, .*\): 146 of 148 passed, 2 failed; failing: b\.mjs, c\.mjs\.$/,'the newest of test and check');
 assert.equal(L[1],'A job is running now: Rebuild the index.');assert.equal(L[2],'Running servers: Game dev server (http://localhost:8000).');
 const s=buildStatus({jobs:v,now});assert.ok(s.includes(L[0])&&s.includes('Tool actions (scripts on this PC, no tokens;')&&s.includes('ACTION: dev-stop'));
 assert.ok(!buildStatus({now}).includes('Tool actions'),'no tool lines when the tools are off')}

// ── the Tools page: plain words
assert.ok(!('soon' in TREE.foot.find(x=>x.key==='tools')),'Tools is a real page now');
const NOW=new Date(2026,10,11,20,0,0).getTime(),at=m=>NOW-m*60000;
assert.deepEqual(resultLine({kind:'job',running:null,last:null},NOW),{text:'Not run from the hub yet',cls:''});assert.deepEqual(resultLine({kind:'service',running:null,last:null},NOW),{text:'Not running',cls:''});
assert.deepEqual(resultLine({kind:'job',running:{id:'x',startedAt:at(2)}},NOW),{text:'Running now, started 19:58',cls:'run'});assert.deepEqual(resultLine({kind:'service',running:{id:'x',startedAt:at(60)}},NOW),{text:'Running since 19:00',cls:'run'});
assert.deepEqual(resultLine({kind:'job',running:null,last:{status:'done',startedAt:at(81),endedAt:at(78),auto:false,summary:{ok:true,text:'148 of 148 passed'}}},NOW),{text:'148 of 148 passed · 18:42 (1 h ago) · took 3 min',cls:'ok'});
assert.deepEqual(resultLine({kind:'job',running:null,last:{status:'failed',startedAt:at(5.5),endedAt:at(5),auto:true,summary:{ok:false,text:'Failed (exit code 1)'}}},NOW),{text:'Failed (exit code 1) · 19:55 (5 min ago) · took 30 s · started by the hub after a run',cls:'bad'});
assert.deepEqual(resultLine({kind:'service',running:null,last:{status:'stopped',startedAt:at(30),endedAt:at(0),summary:{ok:true,text:'Stopped'}}},NOW),{text:'Not running. Last time: stopped · 20:00 (just now)',cls:''});
assert.equal(resultLine({kind:'service',running:null,last:{status:'failed',startedAt:at(30),endedAt:at(3000),summary:{ok:false,text:'It ended by itself (exit code 1)'}}},NOW).cls,'bad');
assert.match(nextLine(null),/switched off/);assert.match(nextLine({enabled:false}),/npm run hub -- --runs/);assert.match(nextLine({enabled:true,running:{label:'Run the tests'}}),/^Run the tests is running\./);
assert.match(nextLine({enabled:true,busy:true,running:null,jobs:[]}),/A run or the master is working/);assert.match(nextLine(view()),/^Nothing is running\. Press Run on a row\./);
{const v=view();v.jobs[0].last={summary:{ok:false,total:5,passed:3,failing:['b.mjs'],text:'x'}};assert.match(nextLine(v),/The last test run had failures/);v.jobs[0].last={summary:{ok:false,text:'Stopped by you'}};assert.match(nextLine(v),/^Nothing is running/)}
assert.deepEqual(buttonOf({kind:'job',running:null}),{op:'start',label:'Run',primary:true});assert.deepEqual(buttonOf({kind:'service',running:null}),{op:'start',label:'Start',primary:false});assert.deepEqual(buttonOf({kind:'service',running:{id:'x'}}),{op:'stop',label:'Stop',danger:true});
assert.equal(gameLink({running:{id:'x'},url:'http://localhost:8000'}),'http://localhost:8000');assert.equal(gameLink({running:null,url:'http://localhost:8000'}),null);assert.equal(gameLink({running:{id:'x'},url:'http://evil.example'}),null);assert.equal(gameLink({running:{id:'x'},url:'javascript:alert(1)'}),null);assert.equal(gameLink(null),null);
// the page draws text only, and sends only a key or an id
const page=fs.readFileSync(path.join(REPO,'hub','web','tools.js'),'utf8').replace(/\/\/.*$/gm,'');
assert.ok(!/innerHTML|insertAdjacentHTML|document\.write|outerHTML/.test(page),'text only');assert.ok(page.includes("act('job-start',{job:j.key})")&&page.includes("act('job-stop',{id:j.running.id})"));

await jobs2.shutdown();await runs.shutdown();
fs.rmSync(root,{recursive:true,force:true});
console.log('hub-jobs: the job table (no shell strings), the summariser, the lock, the record, services, the index after a finished run, restart on exit code 75, replacing only a real older hub, every refused route, the master\'s tool buttons and Quick fix passed.');
