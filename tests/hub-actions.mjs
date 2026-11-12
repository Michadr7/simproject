// Mikkadr Hub P5 R7c: action buttons the master proposes in a chat reply (Approve, Start, Resume, Close). Fake Claude CLI only; no model call.
// What it pins: only exact ACTION lines with well-formed ids become proposals, the master is told the possible actions with their ids, a filed plan gets its Approve button from the hub,
// a button is switched off when it is stale, and a click is the same request as the Plans and Runs buttons, through the same gates (same origin, hub token, stale revision, the plans lock, the start checks).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {parseActionLine,withoutActions,chatActionState,chatActionCall,callFor,CHAT_OPS,MAX_CHAT_ACTIONS} from '../hub/web/run-actions.js';
import {createChat,extractActions,MASTER_RULES} from '../hub/chat.js';
import {createRuns} from '../hub/runs.js';
import {createHubServer} from '../hub/server.js';
import {buildStatus,possibleActions,statusText,MAX_ACTIONS,MAX_STATUS} from '../hub/status.js';
import {sendPlan,savePlan,readPlan,listPlans} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';

const FAKE=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures','fake-claude.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};
const RUN='run-20261111-160310-66c6';

// ── the line
assert.deepEqual(CHAT_OPS,['approve','start','resume','close','test','release','check','index','dev-start','dev-stop','restart','commit','push']);
assert.deepEqual(parseActionLine('ACTION: approve minimap-plan 2'),{op:'approve',plan:'minimap-plan',revision:2});
assert.deepEqual(parseActionLine('  **ACTION:** Start `minimap-plan` 1  '),{op:'start',plan:'minimap-plan',revision:1});
assert.deepEqual(parseActionLine(`ACTION: resume ${RUN}`),{op:'resume',run:RUN});assert.deepEqual(parseActionLine(`ACTION: close ${RUN}`),{op:'close',run:RUN});
for(const bad of ['ACTION: approve minimap-plan','ACTION: approve ../x 1','ACTION: approve Minimap 1','ACTION: start minimap-plan 0','ACTION: resume minimap-plan','ACTION: close '+RUN+' 2','ACTION: delete '+RUN,'ACTION: commit everything','please ACTION: approve a 1','ACTION: approve a 1 and push',`ACTION: approve ${RUN} 1`,'ACTION: stop '+RUN,''])
 assert.equal(parseActionLine(bad),null,bad);
assert.equal(withoutActions('Do this.\nACTION: approve a 1\n\n\nThen that.'),'Do this.\n\nThen that.');assert.equal(withoutActions('ACTION: approve a 1'),'');
// ── extractActions: above PLAN: only, no repeats, at most four
assert.deepEqual(extractActions('Approve it.\nACTION: approve a 1\nACTION: approve a 1\nPLAN:\n# T\nACTION: start a 1\n'),[{op:'approve',plan:'a',revision:1}]);
assert.equal(extractActions(Array.from({length:9},(_,i)=>`ACTION: approve p${i} 1`).join('\n')).length,MAX_CHAT_ACTIONS);assert.deepEqual(extractActions('nothing'),[]);
assert.ok(MASTER_RULES.includes('ACTION: approve <plan id> <revision>')&&MASTER_RULES.includes('nothing happens until the owner clicks'));

// ── the button's state, from the hub's own data (never from the master's words)
const plans=[{id:'a',title:'Minimap',status:'waiting',revision:2},{id:'b',title:'Fuel',status:'approved',revision:1}];
const ready=[{planId:'b',revision:1,title:'Fuel',model:'opus',size:'S',capTokens:400000,secondYes:true,canStart:true,reasons:[]}];
const runs=[{id:RUN,planId:'c',revision:1,planTitle:'Racks',status:'capped',model:'sonnet'}];
let s=chatActionState({op:'approve',plan:'a',revision:2},{plans});assert.deepEqual(s,{label:'Approve: Minimap (revision 2)',enabled:true,why:'',primary:true});
s=chatActionState({op:'approve',plan:'a',revision:1},{plans});assert.equal(s.enabled,false);assert.match(s.why,/newer revision \(2\)/);
assert.match(chatActionState({op:'approve',plan:'b',revision:1},{plans}).why,/Already approved/);assert.equal(chatActionState({op:'approve',plan:'zz',revision:1},{plans}).enabled,false);
s=chatActionState({op:'start',plan:'b',revision:1},{plans,ready});assert.equal(s.label,'Start on Opus 5.5: Fuel');assert.equal(s.enabled,true);assert.match(s.why,/400,000 tokens · asks for a second press/);
s=chatActionState({op:'start',plan:'b',revision:1},{plans,ready:[{...ready[0],canStart:false,reasons:['A run is already active.']}]});assert.equal(s.enabled,false);assert.equal(s.why,'A run is already active.');
assert.match(chatActionState({op:'start',plan:'a',revision:2},{plans,ready}).why,/Approve this revision first/);assert.match(chatActionState({op:'start',plan:'b',revision:1},{plans,ready:[]}).why,/no usable "## Run" block/);
assert.match(chatActionState({op:'start',plan:'c',revision:1},{plans,runs,ready:[]}).why,/Already started \(Stopped: it used its whole allowance\)/);
assert.equal(chatActionState({op:'close',run:RUN},{runs}).label,'Close: Racks');assert.equal(chatActionState({op:'close',run:RUN},{runs}).enabled,true);
s=chatActionState({op:'resume',run:RUN},{runs});assert.equal(s.enabled,false,'a capped run is continued, not resumed');assert.equal(chatActionState({op:'resume',run:RUN},{runs:[{...runs[0],status:'stopped'}]}).enabled,true);
assert.equal(chatActionState({op:'close',run:RUN},{runs:[]}).enabled,false);assert.equal(chatActionState({op:'push'},{}).enabled,false);
// the call: the same requests as the Plans and Runs buttons; Start takes the model from the plan's own Run block
assert.deepEqual(chatActionCall({op:'start',plan:'b',revision:1},{ready}),{op:'start',args:{plan:'b',revision:1,model:'opus'}});assert.equal(chatActionCall({op:'start',plan:'b',revision:1},{ready:[]}),null);
assert.deepEqual(callFor('approve',{plan:'a',revision:2}),{url:'/api/plans/a/answer',body:{verdict:'approved',note:'Approved from the chat.',revision:2}});
assert.deepEqual(callFor('close',chatActionCall({op:'close',run:RUN}).args),{url:`/api/runs/${RUN}/close`,body:{}});

// ── a hub with a chat, runs and plans
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-actions-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:20,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
const dir=path.join(root,'plans'),RUNBLOCK='\n\n## Run\nmodel: sonnet\nwhy: t\nsize: S\nneeds: npm test\n';
const waiting=sendPlan(dir,{source:'w.md',title:'Incident log',from:'x',text:'# Incident log'+RUNBLOCK,now:Date.now()}).plan;
const env={HUB_FAKE_SCENARIO:'master',HUB_FAKE_OUT:path.join(root,'fake-out.json')};
let chat;const runsC=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0,busy:()=>chat.working()});
chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,contextFn:()=>statusText({root,runs:runsC,chat})});
const idle=()=>waitFor(()=>!chat.working());
// the status block lists the possible clicks with their ids
let acts=possibleActions({plans:listPlans(dir).map(p=>readPlan(dir,p.id)),runs:[],ready:[]});assert.deepEqual(acts,[`ACTION: approve ${waiting.id} 1 (plan "Incident log")`]);
assert.match(buildStatus({plans:[readPlan(dir,waiting.id)]}),/Possible actions .*ACTION: approve /);assert.ok(!/Possible actions/.test(buildStatus({})));
assert.deepEqual(possibleActions({runs:[{id:RUN,planTitle:'Racks',status:'stopped',model:'sonnet'}]}),[`ACTION: resume ${RUN} ("Racks", stopped)`,`ACTION: close ${RUN} ("Racks", stopped)`]);
assert.equal(possibleActions({runs:[{id:RUN,planTitle:'Racks',status:'running',model:'sonnet'}]}).length,0,'Stop is never offered to the master');
assert.equal(possibleActions({ready:Array.from({length:20},(_,i)=>({planId:'p'+i,revision:1,title:'T',model:'sonnet',canStart:true}))}).length,MAX_ACTIONS);
assert.ok(buildStatus({plans:Array.from({length:40},()=>readPlan(dir,waiting.id))}).length<=MAX_STATUS);

// the master proposes Approve; the reply keeps the proposal, and the model was told the ids
env.HUB_FAKE_REPLY=`The incident log plan is ready for you.\nACTION: approve ${waiting.id} 1\nACTION: approve ../../etc 1\nACTION: close ${RUN}`;
chat.send({text:'What next?'});await idle();
let m=chat.view().messages.at(-1);assert.deepEqual(m.actions,[{op:'approve',plan:waiting.id,revision:1},{op:'close',run:RUN}]);
assert.match(JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8')).stdin,new RegExp(`ACTION: approve ${waiting.id} 1 \\(plan "Incident log"\\)`));
assert.equal(readPlan(dir,waiting.id).status,'waiting','a proposal changes nothing by itself');
// a plan filed by the master gets its Approve button from the hub
delete env.HUB_FAKE_REPLY;chat.send({text:'Plan a minimap.'});await idle();
m=chat.view().messages.at(-1);assert.equal(m.actions.length,1);assert.deepEqual(m.actions[0],{op:'approve',plan:m.plan.id,revision:1});
// an error reply or a note carries no actions
env.HUB_FAKE_SCENARIO='crash';chat.send({text:'x'});await idle();assert.equal(chat.view().messages.at(-1).actions,undefined);env.HUB_FAKE_SCENARIO='master';

// ── the clicks, over HTTP, exactly as the page sends them
const srv=createHubServer({root,runs:runsC,chat}),port=await srv.listen();
const call=(url,body,headers={})=>new Promise((ok,fail)=>{const data=body===undefined?null:JSON.stringify(body);const req=http.request({host:'127.0.0.1',port,method:data?'POST':'GET',path:url,headers:{Host:`127.0.0.1:${port}`,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),Origin:`http://127.0.0.1:${port}`}:{}),...headers}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,json:()=>JSON.parse(t)}))});req.on('error',fail);if(data)req.write(data);req.end()});
const click=async a=>{const ctx={plans:(await call('/api/plans')).json().plans,...(await call('/api/runs')).json()},st=chatActionState(a,ctx),c=chatActionCall(a,ctx);if(!st.enabled||!c)return {state:st,res:null};const q=callFor(c.op,c.args);return {state:st,res:await call(q.url,q.body,{'X-Hub-Token':runsC.token})}};
try{
 const approve={op:'approve',plan:waiting.id,revision:1},start={op:'start',plan:waiting.id,revision:1};
 assert.equal((await click(start)).state.enabled,false,'Start is off until the plan is approved');
 assert.equal((await call(`/api/plans/${waiting.id}/answer`,callFor('approve',{plan:waiting.id,revision:1}).body,{Origin:'http://evil.example'})).status,403,'another site cannot click');
 let r=await click(approve);assert.equal(r.res.status,200);assert.equal(readPlan(dir,waiting.id).status,'approved');assert.equal(readPlan(dir,waiting.id).answers.at(-1).note,'Approved from the chat.');
 r=await click(approve);assert.equal(r.state.enabled,false,'the same button is now switched off');assert.match(r.state.why,/Already approved/);
 assert.equal((await call(`/api/plans/${waiting.id}/answer`,callFor('approve',{plan:waiting.id,revision:1}).body)).status,409,'and the server refuses a second answer anyway');
 // Start: the hub token is needed, the model comes from the Run block
 const q=callFor('start',{plan:waiting.id,revision:1,model:'sonnet'});assert.equal((await call(q.url,q.body)).status,403,'no token, no start');
 env.HUB_FAKE_SCENARIO='question';r=await click(start);assert.equal(r.state.label,'Start on Sonnet 5.5: Incident log');assert.equal(r.res.status,200);const id=r.res.json().run.id;
 await waitFor(()=>runsC.get(id).status==='waiting-answer');
 assert.equal((await click(start)).state.enabled,false,'not twice');assert.match((await click(start)).state.why,/Already started/);
 // while that run holds the slot the other plan cannot be started, and Resume is not possible for it
 assert.equal((await click({op:'resume',run:id})).state.enabled,false);
 r=await click({op:'close',run:id});assert.equal(r.res.status,200);assert.equal(runsC.get(id).status,'closed');
 assert.equal((await click({op:'close',run:id})).state.enabled,false);
 // a stale revision: the master's own plan gets a second revision, the old Approve is off and the server says 409
 const mine=chat.view().messages.find(x=>x.plan).plan.id;
 sendPlan(dir,{source:readPlan(dir,mine).source,title:'Minimap in the corner',from:'master',text:'# Minimap in the corner\n\nSquare.'+RUNBLOCK,now:Date.now()});
 r=await click({op:'approve',plan:mine,revision:1});assert.equal(r.state.enabled,false);assert.match(r.state.why,/newer revision \(2\)/);
 assert.equal((await call(`/api/plans/${mine}/answer`,callFor('approve',{plan:mine,revision:1}).body)).status,409);
 assert.equal((await click({op:'approve',plan:mine,revision:2})).res.status,200);
}finally{await chat.shutdown();await runsC.shutdown();await srv.close()}
const page=fs.readFileSync(path.join(path.dirname(FAKE),'..','..','hub','web','chat.js'),'utf8');
assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(/.test(page)&&page.includes('chatActionState')&&page.includes('withoutActions'),'the chat page draws the buttons with text only');
console.log('hub-actions: ACTION lines parsed strictly, the possible actions sent to the master with their ids, the hub-made Approve for a filed plan, stale buttons switched off, and Approve, Start and Close clicked through the real routes and gates passed.');
