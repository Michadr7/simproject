// Mikkadr Hub P5 R4: the Runs page and the run items in Waiting for you. The rules both share (buttons by status, the request a button sends, feed rows as names and counts, the cap bar),
// the Waiting items for each run state, the "ready to run" list, and the live routes against the fake Claude CLI. No model call; the real claude.exe is never looked up.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {sendPlan,savePlan} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';
import {createRuns} from '../hub/runs.js';
import {readRun,saveRun} from '../hub/run-store.mjs';
import {createHubServer,waitingOf} from '../hub/server.js';
import {buildWaiting} from '../hub/waiting.js';
import {actionsFor,callFor,feedRow,capClass,secondsLeft,EXTRAS,STATUS_LABEL,modelName,startModels,draftStore} from '../hub/web/run-actions.js';
import {MASTER_RULES} from '../hub/chat.js';
// the Start card's model picker: the plan's model or Fable, never a third one; the request carries the pick; the master knows where the picker is
assert.deepEqual(startModels('sonnet'),['sonnet','fable']);assert.deepEqual(startModels('opus'),['opus','fable']);assert.deepEqual(startModels('fable'),['fable']);
assert.equal(callFor('start',{plan:'p',revision:2,model:'fable'}).body.model,'fable');
assert.ok(MASTER_RULES.includes('model picker')&&MASTER_RULES.includes('never write fable in a Run block'));
// a kept draft: without browser storage (as here, in Node) it reads empty and never throws
{const d=draftStore('hub.test');assert.equal(d.get(),'');d.set('words');d.set('')}

const HERE=path.dirname(fileURLToPath(import.meta.url)),FAKE=path.join(HERE,'fixtures','fake-claude.mjs'),WEB=path.join(HERE,'..','hub','web');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};

// ── buttons by status
const R=(status,over={})=>({id:'run-20261111-140211-ab12',planId:'p',planTitle:'Minimap',revision:2,model:'sonnet',size:'M',capTokens:1500000,tokens:300000,capPct:20,status,reason:'',turn:1,needs:[],files:[],flagged:[],question:null,resultText:'',pending:null,confirmUntil:null,createdAt:1,updatedAt:2,...over});
const ops=s=>actionsFor(R(s)).map(a=>a.op);
assert.deepEqual(ops('running'),['stop']);assert.equal(actionsFor(R('running'))[0].danger,true);
assert.deepEqual(ops('confirming'),['confirm','stop']);assert.equal(actionsFor(R('confirming',{model:'opus'}))[0].label,'Yes, run on Opus 5.5');
assert.equal(actionsFor(R('confirming',{model:'opus',pending:{kind:'more',extra:1}}))[0].label,'Yes, continue on Opus 5.5');
assert.deepEqual(ops('waiting-answer'),['answer','close']);
assert.deepEqual(ops('capped'),['continue','close']);assert.deepEqual(actionsFor(R('capped'))[0].extras,EXTRAS);assert.ok(EXTRAS.every(n=>n>=100000&&n<=3000000));
for(const s of ['paused','interrupted','guard-stopped','failed','stopped'])assert.deepEqual(ops(s),['resume','close'],s);
assert.deepEqual(ops('done'),['close']);assert.deepEqual(ops('closed'),[]);
for(const s of ['running','confirming','waiting-answer','capped','paused','interrupted','guard-stopped','stopped','failed','done','closed'])assert.ok(STATUS_LABEL[s],'a label for '+s);

// ── the request a button sends
const id='run-20261111-140211-ab12';
assert.deepEqual(callFor('start',{plan:'p',revision:2,model:'opus'}),{url:'/api/runs/start',body:{plan:'p',revision:2,model:'opus'}});
for(const op of ['stop','confirm','resume','close'])assert.deepEqual(callFor(op,{id}),{url:`/api/runs/${id}/${op}`,body:{}});
assert.deepEqual(callFor('continue',{id,extra:300000}),{url:`/api/runs/${id}/continue`,body:{extra:300000}});
assert.deepEqual(callFor('answer',{id,question:2,text:'round'}),{url:`/api/runs/${id}/answer`,body:{question:2,text:'round'}});
assert.equal(callFor('rm',{id}),null);assert.equal(callFor('stop',{}),null,'no id, no request');

// ── feed rows: names and counts only
const at=new Date(2026,10,11,14,3,41).getTime();
assert.deepEqual(feedRow({at,kind:'tool',tool:'Edit',target:'minimap.js'}),{t:'14:03:41',k:'tool',text:'Editing minimap.js',n:'',cls:''});
assert.equal(feedRow({at,kind:'tokens',total:412300}).text,'Tokens used so far: 412,300');assert.equal(feedRow({at,kind:'turn',n:2,resumed:true}).k,'answer');
assert.equal(feedRow({at,kind:'question'}).cls,'q');assert.equal(feedRow({at,kind:'cap-stop',capPct:101}).cls,'bad');assert.equal(feedRow({at,kind:'gauges',weekly:12.4,fiveHour:61}).text,'Usage check: 12% of this week, 61% of these 5 hours');
assert.deepEqual(feedRow({at,kind:'weird',secret:'SECRET'}),{t:'14:03:41',k:'weird',text:'',n:'',cls:''},'an unknown event shows only its kind');
assert.equal(capClass(20),'ok');assert.equal(capClass(79.9),'ok');assert.equal(capClass(80),'warn');assert.equal(capClass(100),'full');assert.equal(capClass(null),'ok');
assert.equal(secondsLeft(R('confirming',{confirmUntil:10500}),10000),1);assert.equal(secondsLeft(R('confirming',{confirmUntil:5000}),10000),0);assert.equal(secondsLeft(R('running',{confirmUntil:99999}),10000),0);
assert.equal(modelName('opus'),'Opus 5.5');assert.equal(modelName('nope'),'nope');

// ── Waiting items for each state
const NOW=Date.UTC(2026,10,11,12);
const ready={planId:'minimap',title:'Minimap',revision:2,model:'sonnet',size:'M',capTokens:1500000,why:'builds against tests',secondYes:false,canStart:true,reasons:[],at:NOW-1000};
let w=buildWaiting({ready:[ready],now:NOW});
assert.equal(w.items.length,1);assert.equal(w.items[0].title,'Ready to run: Minimap (revision 2)');assert.match(w.items[0].detail,/Sonnet 5\.5 · size M · up to 1,500,000 tokens/);
assert.deepEqual(w.items[0].actions[0],{type:'run',op:'start',plan:'minimap',revision:2,model:'sonnet',label:'Start',primary:true});
assert.equal(buildWaiting({ready:[{...ready,model:'opus',secondYes:true}],now:NOW}).items[0].actions[0].label,'Start on Opus 5.5');
const blocked=buildWaiting({ready:[{...ready,canStart:false,reasons:['A run or a chat turn is already active.']}],now:NOW}).items[0];
assert.ok(!blocked.actions.some(a=>a.op==='start'));assert.match(blocked.detail,/cannot start now: A run or a chat turn is already active\./);
const run=(status,over)=>R(status,{updatedAt:NOW-5000,...over});
const one=(status,over)=>buildWaiting({runs:[run(status,over)],now:NOW}).items;
let it=one('waiting-answer',{question:{id:2,text:'SECRET-MODEL-WORDS round or square?'}});
assert.equal(it.length,1);assert.equal(it[0].title,'Question from the run: Minimap');assert.equal(it[0].actions[0].href,'#runs/'+id);assert.ok(!JSON.stringify(it).includes('SECRET'),'the question text stays on the Runs page');
assert.notEqual(one('waiting-answer',{question:{id:3,text:'x'}})[0].id,it[0].id,'a newer question is a new item');
it=one('done',{files:['a.js','b.js'],flagged:['hub/x.js','package.json'],resultText:'SECRET-MODEL-WORDS'});
assert.equal(it[0].title,'Run finished: Minimap');assert.match(it[0].detail,/2 files changed · 2 to look at first: hub\/x\.js, package\.json/);assert.deepEqual(it[0].actions.map(a=>a.label),['Read the result','Close']);assert.ok(!JSON.stringify(it).includes('SECRET'));
it=one('capped',{tokens:1520000});
assert.equal(it[0].title,'Run hit its cap: Minimap');assert.match(it[0].detail,/1,520,000 of 1,500,000/);assert.deepEqual(it[0].actions.map(a=>a.label),['Continue with more','Close']);assert.deepEqual(it[0].actions[0].extras,EXTRAS);assert.equal(it[0].actions[0].id,id);
assert.equal(one('interrupted')[0].title,'Run interrupted when the hub stopped: Minimap');assert.deepEqual(one('interrupted')[0].actions.map(a=>a.label),['Resume','Close']);
assert.equal(one('paused',{reason:'The 5-hour limit is reached. Resume after it resets.'})[0].title,'Run paused: Minimap');
assert.equal(one('failed',{reason:'The run ended without a result.'})[0].title,'Run ended without a result: Minimap');
assert.equal(one('guard-stopped',{reason:'The weekly guard stopped the run (97%).'})[0].title,'Run stopped by the weekly guard: Minimap');
assert.deepEqual(one('confirming',{model:'opus',pending:{kind:'start'}})[0].actions.map(a=>a.label),['Yes, run on Opus 5.5','Cancel']);
for(const s of ['running','stopped','closed'])assert.equal(one(s).length,0,s+' is not a Waiting item (the Runs page shows it)');
w=buildWaiting({runs:[run('capped'),run('done',{id:'run-20261111-140212-ab13'})],ready:[ready],now:NOW});assert.equal(w.counts.runs,3);assert.equal(w.counts.waiting,3);assert.ok(w.items.every(i=>i.severity==='plan'?false:i.severity==='run'));

// ── hub/web: text only, and the one write helper sends the token
for(const f of ['runs.js','home.js','runs-api.js','run-actions.js']){const code=fs.readFileSync(path.join(WEB,f),'utf8');assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(/.test(code),f+' sets text only')}
assert.match(fs.readFileSync(path.join(WEB,'runs-api.js'),'utf8'),/'X-Hub-Token':tk/);

// ── live: ready list, the routes, the fake CLI
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-runs-page-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
const setWeekly=(pct,five=20)=>fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:five,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
let planN=0;
function makePlan(model,size,{approve=true,block=true}={}){
 const name=`plan-${++planN}`,text=`# ${name}\n\n${block?`## Run\nmodel: ${model}\nwhy: test\nsize: ${size}\nneeds: npm test\n`:'No run block here.\n'}`;
 let {plan}=sendPlan(path.join(root,'plans'),{source:name+'.md',title:name,from:'master',text,now:Date.now()});
 if(approve)plan=answerPlan(plan,{verdict:'approved',note:'go',revision:1,now:Date.now()}).plan;
 savePlan(path.join(root,'plans'),plan);return plan}
const env={HUB_FAKE_SCENARIO:'normal',HUB_FAKE_OUT:path.join(root,'fake-out.json')};
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0});
setWeekly(12);
const status=rid=>readRun(root,rid).status;
const done=async rid=>waitFor(()=>status(rid)!=='running'&&readRun(root,rid));

const sonnet=makePlan('sonnet','S'),opus=makePlan('opus','S'),waiting=makePlan('sonnet','S',{approve:false}),noBlock=makePlan('sonnet','S',{block:false});
let rl=runs.ready();
assert.deepEqual(rl.map(p=>p.planId).sort(),[sonnet.id,opus.id].sort(),'only approved plans with a valid Run block');
const rs=rl.find(p=>p.planId===sonnet.id),ro=rl.find(p=>p.planId===opus.id);
assert.equal(rs.canStart,true);assert.equal(rs.capTokens,600000);assert.equal(rs.secondYes,false);assert.equal(ro.secondYes,true);assert.equal(ro.model,'opus');
assert.equal(runs.list().ready.length,2);
assert.equal(createRuns({root,claude:null}).ready()[0].canStart,false,'no claude.exe: shown, but not startable');
setWeekly(96);assert.equal(runs.ready().every(p=>!p.canStart),true,'over the guard: nothing can start');assert.match(runs.ready()[0].reasons.join(' '),/./);setWeekly(12);

const srv=createHubServer({root,runs}),port=await srv.listen();
const call=(method,url,body,headers={})=>new Promise((ok,fail)=>{const data=body===undefined?null:JSON.stringify(body);const req=http.request({host:'127.0.0.1',port,method,path:url,headers:{Host:`127.0.0.1:${port}`,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),Origin:`http://127.0.0.1:${port}`}:{}),...headers}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,json:()=>JSON.parse(t),text:t}))});req.on('error',fail);if(data)req.write(data);req.end()});
const post=(url,body)=>call('POST',url,body,{'X-Hub-Token':runs.token});
try{
 let g=(await call('GET','/api/waiting')).json();
 assert.equal(g.counts.runs,2);assert.deepEqual(g.items.filter(i=>i.group==='run').map(i=>i.title).sort(),[`Ready to run: ${opus.title} (revision 1)`,`Ready to run: ${sonnet.title} (revision 1)`].sort());
 // start the Sonnet plan, it works and keeps working, then Stop
 env.HUB_FAKE_SCENARIO='work';
 let s=await post('/api/runs/start',{plan:sonnet.id,revision:1,model:'sonnet'});assert.equal(s.status,200);const rid=s.json().run.id;
 await waitFor(()=>(runs.feed(rid,0).events.some(e=>e.kind==='tokens')));
 let lst=(await call('GET','/api/runs')).json();assert.equal(lst.holding,rid);assert.equal(lst.ready.every(p=>!p.canStart),true,'while a run works nothing else can start');assert.equal(lst.ready.some(p=>p.planId===sonnet.id),false,'a started plan leaves the ready list');
 const fd=(await call('GET',`/api/runs/${rid}/feed?after=0`)).json();assert.equal(fd.events[0].kind,'turn');assert.ok(!JSON.stringify(fd).includes('SECRET'),'the feed carries names and counts, not model words');
 assert.equal((await call('GET','/api/waiting')).json().items.some(i=>i.id.startsWith('run:')),false,'a running run is not a Waiting item');
 assert.equal((await post(`/api/runs/${rid}/stop`,{})).status,200);await done(rid);assert.equal(status(rid),'stopped');
 // a stopped run can be closed; its plan stays used
 assert.equal((await post(`/api/runs/${rid}/close`,{})).json().run.status,'closed');assert.equal(runs.ready().some(p=>p.planId===sonnet.id),false,'a plan that ran is not offered again');
 // a question: the item links to the page, the text never travels in the list
 env.HUB_FAKE_SCENARIO='question';const q=makePlan('sonnet','S');
 s=await post('/api/runs/start',{plan:q.id,revision:1,model:'sonnet'});const qid=s.json().run.id;await waitFor(()=>status(qid)==='waiting-answer');
 g=(await call('GET','/api/waiting')).json();const qi=g.items.find(i=>i.id.startsWith('run:'+qid));assert.ok(qi);assert.equal(qi.actions[0].href,'#runs/'+qid);assert.ok(!JSON.stringify(g).includes('minimap be round'),'question text stays out of the list');
 assert.match(JSON.stringify((await call('GET',`/api/runs/${qid}`)).json().run.question),/minimap be round or square/,'the Runs page reads it from the run');
 env.HUB_FAKE_SCENARIO='normal';
 const q1=readRun(root,qid).question.id;assert.equal((await post(`/api/runs/${qid}/answer`,{question:q1,text:'round'})).status,200);await done(qid);assert.equal(status(qid),'done');
 g=(await call('GET','/api/waiting')).json();const di=g.items.find(i=>i.id==='run:'+qid+':done');assert.ok(di);assert.ok(!JSON.stringify(g).includes('SECRET'),'the result text stays out of the list');
 assert.equal((await post(`/api/runs/${qid}/close`,{})).status,200);assert.equal((await call('GET','/api/waiting')).json().items.some(i=>i.id.startsWith('run:'+qid)),false,'Close removes it');
 // the Opus second yes: Start puts it in confirming (a Waiting item), Cancel returns it to nothing, the plan is ready again
 s=await post('/api/runs/start',{plan:opus.id,revision:1,model:'opus'});assert.equal(s.json().needsConfirm,true);const oid=s.json().run.id;
 g=(await call('GET','/api/waiting')).json();assert.ok(g.items.find(i=>i.id==='run:'+oid+':confirming'));
 assert.equal((await post(`/api/runs/${oid}/stop`,{})).json().run.status,'closed');assert.ok(runs.ready().some(p=>p.planId===opus.id),'cancelled before it started: ready again');
 // a capped run's "continue" second yes can be cancelled back to capped
 env.HUB_FAKE_SCENARIO='overcap';const big=makePlan('opus','S');
 s=await post('/api/runs/start',{plan:big.id,revision:1,model:'opus'});const bid=s.json().run.id;assert.equal((await post(`/api/runs/${bid}/confirm`,{})).status,200);await waitFor(()=>status(bid)==='capped');
 assert.ok((await call('GET','/api/waiting')).json().items.find(i=>i.id==='run:'+bid+':capped'));
 assert.equal((await post(`/api/runs/${bid}/continue`,{extra:300000})).json().needsConfirm,true);assert.equal(status(bid),'confirming');
 assert.equal((await post(`/api/runs/${bid}/stop`,{})).json().run.status,'capped','Cancel on a continue goes back to capped, not closed');
 assert.equal((await post(`/api/runs/${bid}/close`,{})).json().run.status,'closed');
}finally{await runs.shutdown();await srv.close()}
// the same list without runs switched on has no run items
assert.equal(waitingOf(root).counts.runs,0);
console.log('hub-runs-page: ok');
