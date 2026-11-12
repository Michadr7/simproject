// Mikkadr Hub P5 R4, Hub v2 V1: screenshots of the Work tree (steps, runs, plans, the things that need you), the chat and the bot, driven by the FAKE Claude CLI (tests/fixtures/fake-claude.mjs). No model call, no real claude.exe.
//   node scripts/hub-shots.mjs <outDir>
// It builds a throw-away hub folder in the temp directory (a copy of hub/web, its own plans/ and .hub/), runs the hub on a random port, plays the fake runs through the real HTTP routes, and
// photographs each state with headless Edge. Edge is started asynchronously: a synchronous call would freeze this process, and with it the server Edge is loading from.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {findGit,createGit} from '../hub/git.mjs';
import {createCommits} from '../hub/commit-ctl.mjs';
import {sendPlan,savePlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';
import {createRuns} from '../hub/runs.js';
import {createChat} from '../hub/chat.js';
import {readRun} from '../hub/run-store.mjs';
import {createHubServer} from '../hub/server.js';
import {JOBS} from '../hub/jobs.js';
import {createJobs} from '../hub/job-runner.mjs';
import {createRecords} from '../hub/records-store.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url)),REPO=path.join(HERE,'..'),FAKE=path.join(REPO,'tests','fixtures','fake-claude.mjs');
const out=path.resolve(process.argv[2]||path.join(os.tmpdir(),'hub-shots'));fs.mkdirSync(out,{recursive:true});
const EDGE=['C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe','C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'].find(p=>fs.existsSync(p));
if(!EDGE){console.error('Edge was not found.');process.exit(1)}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=10000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};

const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-shots-root-'));
fs.cpSync(path.join(REPO,'hub','web'),path.join(root,'hub','web'),{recursive:true});fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'shots',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:58,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
const env={HUB_FAKE_SCENARIO:'normal',HUB_FAKE_OUT:path.join(root,'fake-out.json'),HUB_FAKE_RESULT:'Added the minimap: a round map in the top-right corner that follows the player. npm test passes.'};
// Hub v2 V4: the Assets page, on a COPY of the register in the throw-away folder (the real one is never written), with pretend shipped assets and pretend new files in assets-src/
fs.copyFileSync(path.join(REPO,'assets-register.json'),path.join(root,'assets-register.json'));
const shipped=[['prop:chair','Chair','in-game',true],['prop:table','Table','in-game',true],['prop:lamp','Lamp','in-game',false],['nature:pine','Pine tree','in-game',true],['rigged:fox','Fox','converted',false],['pictures:signs','Sign pictures (12)','in-game',null]].map(([id,name,stage,c])=>({origin:'module',id,name,stage,hasCredit:c,licence:c===false?'':'CC0'}));
const records=createRecords({root,load:async()=>({assets:shipped}),originals:async()=>['Incoming/oak_tree_01.glb','Incoming/Park_Bench.glb','Sounds/door_slam.wav']});
const chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,records});
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0,busy:()=>chat.working()});
// Hub v2 V2: the Tools page, on tiny pretend scripts (the real tests are never run for a screenshot)
fs.mkdirSync(path.join(root,'fx'));
fs.writeFileSync(path.join(root,'fx','tests.mjs'),"console.log('PASS accounts.mjs: ok');console.log('FAIL fuel-game.mjs');console.log('AssertionError: the pump did not stop at a full tank');console.log('FAIL hub-work.mjs');console.log('2 of 149 test files failed.');process.exit(1);\n");
fs.writeFileSync(path.join(root,'fx','ok.mjs'),"console.log('Wrote PROJECT-BRIEF.md and PROJECT-INDEX.md');\n");
fs.writeFileSync(path.join(root,'fx','slow.mjs'),"console.log('Serving the game on http://localhost:8000');setInterval(()=>{},1000);\n");
const shotTable={};for(const [k,j] of Object.entries(JOBS))shotTable[k]=j.steps?j:{...j,ownLock:false,script:k==='test'?'fx/tests.mjs':j.kind==='service'||k==='release'?'fx/slow.mjs':'fx/ok.mjs',args:[]};
const jobs=createJobs({root,table:shotTable,busy:()=>runs.locked()||chat.working()});
// Hub v2 V3: the Commit page, on a throw-away git repository of its own (with a local bare repository standing in for GitHub). Skipped when GitHub Desktop's git is not found. The real repository is never touched.
const gitPath=findGit(),gitRoot=gitPath?fs.mkdtempSync(path.join(os.tmpdir(),'hub-shots-git-')):null;
let commits=null;
if(gitPath){
 const G=(cwd,...a)=>execFileSync(gitPath,a,{cwd,encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']});
 const bare=path.join(gitRoot,'github.git'),wk=path.join(gitRoot,'work');fs.mkdirSync(bare);G(bare,'init','--bare','-b','main');fs.mkdirSync(wk);G(wk,'init','-b','main');
 for(const [k,v] of [['user.name','Shots'],['user.email','shots@example.invalid'],['commit.gpgsign','false'],['core.hooksPath',path.join(gitRoot,'no-hooks')]])G(wk,'config',k,v);
 G(wk,'remote','add','origin',bare);
 const W=(f,t)=>{const p=path.join(wk,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,t)};
 for(const f of ['dist/game.js','dist/town.js','hub/server.js','tests/hub-work.mjs','README.md','package.json'])W(f,'one\n');
 G(wk,'add','--','dist/game.js','dist/town.js','hub/server.js','tests/hub-work.mjs','README.md','package.json');G(wk,'commit','-m','Version 0.35.3');G(wk,'push','-u','origin','main');
 W('dist/vendor-note.txt','x\n');G(wk,'add','--','dist/vendor-note.txt');G(wk,'commit','-m','Hub v2 V2: Tools page');
 for(const f of ['dist/game.js','dist/town.js','hub/server.js','tests/hub-work.mjs','README.md'])W(f,'two\n');
 W('hub/commit.js','new\n');W('hub/web/commit.js','new\n');W('tests/hub-commit.mjs','new\n');W('plans/2026-11-12-v3.json','{}\n');W('dist/big model.glb','x'.repeat(6*1024*1024));
 W('.env','SECRET=1\n');W('.claude/settings.json','{}\n');W('assets-src/man.glb','x\n');W('keys/server.pem','x\n');
 commits=createCommits({root:wk,git:createGit({root:wk,gitPath}),busy:()=>runs.locked()||chat.working()||jobs.active(),runs,jobs});
}
const srv=createHubServer({root,runs,chat,jobs,commits,records,restart:()=>({error:'Not in a screenshot.'})}),port=await srv.listen(),base=`http://127.0.0.1:${port}`;
const edgeProfile=fs.mkdtempSync(path.join(os.tmpdir(),'hub-shots-edge-'));

function makePlan(title,model,size,{approve=true,block=true}={}){
 const text=`# ${title}\n\nA short plan used for a screenshot.\n\n${block?`## Run\nmodel: ${model}\nwhy: ${model==='opus'?'design work':'builds against tests'}\nsize: ${size}\nneeds: npm test\n`:''}`;
 let {plan}=sendPlan(path.join(root,'plans'),{source:title.toLowerCase().replace(/\W+/g,'-')+'.md',title,from:'master',text,now:Date.now()});
 if(approve){plan=answerPlan(plan,{verdict:'approved',note:'go',revision:1,now:Date.now()}).plan;savePlan(path.join(root,'plans'),plan)}return plan}
const call=(url,body)=>new Promise((ok,fail)=>{const data=body===undefined?null:JSON.stringify(body);const req=http.request(base+url,{method:data?'POST':'GET',headers:{Host:`127.0.0.1:${port}`,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),Origin:base,'X-Hub-Token':runs.token}:{})}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,body:JSON.parse(t)}))});req.on('error',fail);if(data)req.write(data);req.end()});
const start=async(plan,model,scenario)=>{env.HUB_FAKE_SCENARIO=scenario;const r=await call('/api/runs/start',{plan:plan.id,revision:1,model});if(r.status!==200)throw new Error('start: '+JSON.stringify(r.body));return r.body.run.id};
const status=id=>readRun(root,id).status;
const settle=id=>waitFor(()=>status(id)!=='running');

function shoot(name,hash,{w=1280,h=860,wait=4500}={}){
 return new Promise((ok,fail)=>{
  const file=path.join(out,name+'.png');
  const p=spawn(EDGE,['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run',`--user-data-dir=${edgeProfile}`,`--window-size=${w},${h}`,`--virtual-time-budget=${wait}`,`--screenshot=${file}`,`${base}/${hash}`],{stdio:'ignore',windowsHide:true});
  const t=setTimeout(()=>{p.kill();fail(new Error('Edge timed out on '+name))},40000);
  p.on('exit',()=>{clearTimeout(t);fs.existsSync(file)?ok(file):fail(new Error('no screenshot for '+name))})})}
const ONLY=process.env.HUB_SHOTS_ONLY?new RegExp(process.env.HUB_SHOTS_ONLY):null; // HUB_SHOTS_ONLY=<regex> photographs only the matching names (the states are still played)
const shots=[];const snap=async(name,...a)=>{if(ONLY&&!ONLY.test(name))return;shots.push(await shoot(name,...a))};

try{
 // 1. a Sonnet run, working
 const p1=makePlan('Minimap M1: Round map in the corner','sonnet','M');
 let id=await start(p1,'sonnet','work');
 await waitFor(()=>runs.feed(id,0).events.some(e=>e.kind==='tokens'));
 await snap('01-run-working',`?menu=open#runs/${id}`);
 await snap('02-runs-page-with-active-run','?menu=open#runs');
 // 2. Stop
 await call(`/api/runs/${id}/stop`,{});await settle(id);
 await snap('03-run-stopped',`?menu=open#runs/${id}`);
 const stoppedId=id;
 // 3. a run the hub lost (interrupted)
 const p2=makePlan('Fuel price tweak','sonnet','S');id=await start(p2,'sonnet','work');await waitFor(()=>runs.feed(id,0).events.some(e=>e.kind==='tokens'));await runs.shutdown();await settle(id);
 // 4. paused by the 5-hour limit
 const p3=makePlan('Warehouse K1: Racks','sonnet','S');id=await start(p3,'sonnet','pause');await settle(id);
 fs.appendFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now()+1,source:'shots',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:58,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n'); // pretend the 5-hour window reset
 // 5. hit its cap
 const p4=makePlan('People A2: Walking animations','sonnet','S');const cappedId=id=await start(p4,'sonnet','overcap');await waitFor(()=>status(id)==='capped');
 // 6. finished with flagged files
 const p5=makePlan('Hub chat tweaks','sonnet','S');const doneId=id=await start(p5,'sonnet','flagged');await settle(id);
 // 7. ended without a result
 const p6=makePlan('Save format change','sonnet','S');id=await start(p6,'sonnet','crash');await settle(id);
 // plans that are ready, one of them Opus
 makePlan('Incident log','sonnet','S');makePlan('Netcode review','opus','S');
 // Hub v2 V1: plans that wait for approval, one that cannot start, and the Work tree at 1400 px and 800 px
 const pw=makePlan('Warehouse K2: Forklift pallets and a very-long-file-name-that-must-wrap-inside-the-card.js','sonnet','M',{approve:false});makePlan('People A3: NPC cars','sonnet','L',{approve:false});makePlan('People B1: Knockdown','sonnet','S',{block:false});
 await snap('30-work-1400','?menu=open#work',{w:1400,h:900});
 await snap('31-work-800','?menu=closed#work',{w:800,h:900});
 await snap('32-work-800-tree-open','?menu=open#work',{w:800,h:900});
 await snap('33-work-step-finished-1400',`?menu=open#runs/${doneId}`,{w:1400,h:1000});
 await snap('34-work-step-waiting-1400',`?menu=open#work/${pw.id}`,{w:1400,h:1000});
 await snap('35-work-step-stopped-1400',`?menu=open#runs/${cappedId}`,{w:1400,h:900});
 await snap('04-waiting-for-you','?menu=open#waiting',{h:1100});
 await snap('05-run-finished-with-flagged-files',`?menu=open#runs/${doneId}`,{h:1000});
 await snap('06-run-hit-its-cap',`?menu=open#runs/${cappedId}`);
 // 8. a question
 for(const r of runs.list().runs)if(['paused','interrupted','failed','done','capped','stopped'].includes(r.status))runs.close(r.id);
 const p7=makePlan('Minimap M2: Shape and zoom','sonnet','S');id=await start(p7,'sonnet','question');await waitFor(()=>status(id)==='waiting-answer');
 await snap('07-waiting-with-question','?menu=open#waiting');
 await snap('08-run-question',`?menu=open#runs/${id}`);
 runs.close(id);
 // 9. Opus: the second yes
 const opus=runs.list().ready.find(p=>p.model==='opus');
 id=await start({id:opus.planId},'opus','work');
 await snap('09-opus-second-yes',`?menu=open#runs/${id}`);
 await call(`/api/runs/${id}/confirm`,{});await waitFor(()=>runs.feed(id,0).events.some(e=>e.kind==='tokens'));
 await snap('10-opus-working',`?menu=open#runs/${id}`);
 await call(`/api/runs/${id}/stop`,{});await settle(id);
 // 10. a narrow window
 await snap('11-narrow-waiting','?menu=closed#waiting',{w:500,h:900}); // headless Edge will not make a window narrower than 500
 await snap('12-narrow-run',`?menu=closed#runs/${stoppedId}`,{w:500,h:1000});
 // 11. the master chat
 delete env.HUB_FAKE_RESULT;
 const say=async(text,scenario='master',reply)=>{env.HUB_FAKE_SCENARIO=scenario;if(reply)env.HUB_FAKE_REPLY=reply;else delete env.HUB_FAKE_REPLY;const r=await call('/api/chat/send',{text});if(r.status!==200)throw new Error('chat: '+JSON.stringify(r.body));if(scenario==='master')await waitFor(()=>!chat.working())};
 await say('I want a minimap in the corner of the screen.','master','Good idea. Two questions first: round or square, and should it show cars?\n\nIf you say round and no cars, I can write the plan.');
 await say('Round, and no cars.');
 await snap('13-chat-with-plan-filed','?menu=open#chat',{h:1000});
 await call('/api/chat/model',{model:'opus'});
 await snap('14-chat-opus-second-yes','?menu=open#chat',{h:1000});
 await call('/api/chat/model',{model:'sonnet'});
 // R7c: the master proposes clicks (Start a ready plan, Resume and Close the stopped Opus run); the filed plan above already has the hub's own Approve button
 const rdy=runs.list().ready.find(p=>p.title==='Incident log');
 await say('What should I do next?','master',`Two things are waiting for you.\n\nThe incident log plan is approved and ready, so you can start it. The Netcode review run was stopped at 1,825 tokens: resume it if you still want the review, or close it.\nACTION: start ${rdy.planId} ${rdy.revision}\nACTION: resume ${id}\nACTION: close ${id}`);
 await snap('20-chat-proposed-actions','?menu=open#chat',{h:1100});
 await snap('21-chat-proposed-actions-narrow','?menu=closed&bot=mini#chat',{w:500,h:1000});
 await say('Now check the plan against the warehouse code.','masterhang');await sleep(300);
 await snap('15-chat-working','?menu=open#chat',{h:1000});
 // 12. the corner bot (R7b): the live list while the master works, folded away, after a stop, and in a narrow window
 await snap('16-bot-open-while-working','?menu=open&bot=open#waiting');
 await snap('17-bot-folded-away','?menu=open&bot=mini#waiting');
 await call('/api/chat/stop',{});
 await snap('18-bot-open-after-stop','?menu=closed&bot=open#plans');
 await snap('19-bot-narrow','?menu=closed&bot=open#runs',{w:500,h:900});
 // 13. the scene: the background and the sliding highlight take the hue of the page, of the row you hover, and of what the hub is doing
 await snap('22-scene-stopped-run','?menu=open#waiting');
 for(const r of runs.list().runs)if(r.status!=='closed')runs.close(r.id);
 await snap('23-scene-chat-idle','?menu=open#chat');
 await snap('24-scene-plans-hover-runs','?menu=open&hover=runs#plans');
 await snap('25-scene-waiting-menu-closed','?menu=closed#waiting');
 // 14. Hub v2 V2: Tools. Failing tests named, the index done, the dev server running; then a job at work; then the master proposing tool clicks
 await call('/api/jobs/start',{job:'test'});await jobs.wait();await call('/api/jobs/start',{job:'index'});await jobs.wait();await call('/api/jobs/start',{job:'dev'});
 await snap('40-tools-1400','?menu=open#tools',{w:1400,h:1000});
 await snap('41-tools-800','?menu=closed#tools',{w:800,h:1000});
 await call('/api/jobs/start',{job:'release'});
 await snap('42-tools-job-running-1400','?menu=open#tools',{w:1400,h:1000});
 await call('/api/jobs/stop',{id:jobs.list().running.id});
 await say('Did the tests pass?','master','No. The last test run from the hub had 2 failures: fuel-game.mjs and hub-work.mjs. Run them again after a fix, or stop the game server if you are done playing.\nACTION: test\nACTION: dev-stop\nACTION: restart');
 await snap('43-chat-tool-actions-1400','?menu=open#chat',{w:1400,h:1000});
 // 15. Hub v2 V3: Commit. The test result (failing, from step 14), the grouped list, the left-out paths struck through, a big file warning; then one commit by script, its Undo, and the separate Push card
 if(commits){
  await snap('44-commit-1400','?menu=open#commit',{w:1400,h:1500});
  await snap('45-commit-800','?menu=closed#commit',{w:800,h:1700});
  const prop=await call('/api/commit/proposal'),picked=prop.body.files.flatMap(g=>g.items).map(i=>i.path).filter(p=>p!=='dist/big model.glb');
  const done=await call('/api/commit',{files:picked,message:'Hub v2 V3: Commit page with Undo, and Push as its own button\n\nA grouped file list, a message box, and a separate Push card.',hash:prop.body.hash});
  if(done.status!==200)throw new Error('commit: '+JSON.stringify(done.body));
  await snap('46-commit-done-push-card-1400','?menu=open#commit',{w:1400,h:1300});
  await call('/api/jobs/start',{job:'release'});
  await snap('47-commit-busy-800','?menu=closed#commit',{w:800,h:1300});
  await call('/api/jobs/stop',{id:jobs.list().running.id});
 }else console.log('skipped the Commit screenshots: GitHub Desktop\'s git was not found');
 // 16. Hub v2 V4: Assets. Three rows added by the master's RECORD: lines (with Undo in the chat), one more by the form's route, one move; new files with the closest row names; the page at 1400 and 800 px
 {
  await waitFor(()=>!jobs.active()&&!chat.working());
  env.HUB_FAKE_SCENARIO='master';
  env.HUB_FAKE_REPLY='Done. I added the oak and the bench and moved the closet along.\nRECORD: asset add name="Oak tree" kind=model stage=wanted source="https://example.com/oak-tree" licence="CC0"\nRECORD: asset add name="Park bench" kind=model stage=received licence="CC-BY 3.0"\nRECORD: asset stage quaternius-closet staged\nRECORD: asset stage no-such-row staged\nRECORD: asset add name="Laser" kind=weapon';
  const r=await call('/api/chat/send',{text:'We are adding assets: an oak tree, a park bench, and the closet is ready.'});if(r.status!==200)throw new Error('chat: '+JSON.stringify(r.body));
  await waitFor(()=>!chat.working());delete env.HUB_FAKE_REPLY;
  const rec=async(url,body)=>new Promise((ok,fail)=>{const d=JSON.stringify(body);const q=http.request(base+url,{method:'POST',headers:{Host:`127.0.0.1:${port}`,'Content-Type':'application/json','Content-Length':Buffer.byteLength(d),Origin:base,'X-Hub-Token':records.token}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,body:JSON.parse(t)}))});q.on('error',fail);q.end(d)});
  const a1=await rec('/api/assets/add',{name:'Street lamp',kind:'model',stage:'wanted',source:'https://kenney.nl/assets',licence:'CC0',note:'for Alder Center'});if(a1.status!==200)throw new Error('add: '+JSON.stringify(a1.body));
  await snap('50-chat-records-1400','?menu=open#chat',{w:1400,h:1100});
  await snap('51-assets-1400','?menu=open#assets',{w:1400,h:1500});
  await snap('52-assets-800','?menu=closed#assets',{w:800,h:1700});
  await snap('53-assets-narrow','?menu=closed#assets',{w:500,h:1700});
 }
 console.log(shots.join('\n'));
}finally{await jobs.shutdown();await chat.shutdown();await runs.shutdown();await srv.close();fs.rmSync(edgeProfile,{recursive:true,force:true});if(gitRoot)fs.rmSync(gitRoot,{recursive:true,force:true})}
