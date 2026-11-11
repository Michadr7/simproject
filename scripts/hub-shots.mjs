// Mikkadr Hub P5 R4: screenshots of the Runs page and the run items in Waiting for you, driven by the FAKE Claude CLI (tests/fixtures/fake-claude.mjs). No model call, no real claude.exe.
//   node scripts/hub-shots.mjs <outDir>
// It builds a throw-away hub folder in the temp directory (a copy of hub/web, its own plans/ and .hub/), runs the hub on a random port, plays the fake runs through the real HTTP routes, and
// photographs each state with headless Edge. Edge is started asynchronously: a synchronous call would freeze this process, and with it the server Edge is loading from.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sendPlan,savePlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';
import {createRuns} from '../hub/runs.js';
import {createChat} from '../hub/chat.js';
import {readRun} from '../hub/run-store.mjs';
import {createHubServer} from '../hub/server.js';

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
const chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env});
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0,busy:()=>chat.working()});
const srv=createHubServer({root,runs,chat}),port=await srv.listen(),base=`http://127.0.0.1:${port}`;
const edgeProfile=fs.mkdtempSync(path.join(os.tmpdir(),'hub-shots-edge-'));

function makePlan(title,model,size){
 const text=`# ${title}\n\nA short plan used for a screenshot.\n\n## Run\nmodel: ${model}\nwhy: ${model==='opus'?'design work':'builds against tests'}\nsize: ${size}\nneeds: npm test\n`;
 let {plan}=sendPlan(path.join(root,'plans'),{source:title.toLowerCase().replace(/\W+/g,'-')+'.md',title,from:'master',text,now:Date.now()});
 plan=answerPlan(plan,{verdict:'approved',note:'go',revision:1,now:Date.now()}).plan;savePlan(path.join(root,'plans'),plan);return plan}
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
 const p1=makePlan('Minimap in the corner','sonnet','M');
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
 const p3=makePlan('Warehouse racks','sonnet','S');id=await start(p3,'sonnet','pause');await settle(id);
 fs.appendFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now()+1,source:'shots',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:58,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n'); // pretend the 5-hour window reset
 // 5. hit its cap
 const p4=makePlan('Walking animations','sonnet','S');const cappedId=id=await start(p4,'sonnet','overcap');await waitFor(()=>status(id)==='capped');
 // 6. finished with flagged files
 const p5=makePlan('Hub chat tweaks','sonnet','S');const doneId=id=await start(p5,'sonnet','flagged');await settle(id);
 // 7. ended without a result
 const p6=makePlan('Save format change','sonnet','S');id=await start(p6,'sonnet','crash');await settle(id);
 // plans that are ready, one of them Opus
 makePlan('Incident log','sonnet','S');makePlan('Netcode review','opus','S');
 await snap('04-waiting-for-you','?menu=open#waiting',{h:1100});
 await snap('05-run-finished-with-flagged-files',`?menu=open#runs/${doneId}`,{h:1000});
 await snap('06-run-hit-its-cap',`?menu=open#runs/${cappedId}`);
 // 8. a question
 for(const r of runs.list().runs)if(['paused','interrupted','failed','done','capped','stopped'].includes(r.status))runs.close(r.id);
 const p7=makePlan('Minimap shape','sonnet','S');id=await start(p7,'sonnet','question');await waitFor(()=>status(id)==='waiting-answer');
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
 console.log(shots.join('\n'));
}finally{await chat.shutdown();await runs.shutdown();await srv.close();fs.rmSync(edgeProfile,{recursive:true,force:true})}
