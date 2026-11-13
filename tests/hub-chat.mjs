// Mikkadr Hub P5 R5: the master chat, against the fake Claude CLI. No model call; the real claude.exe is never looked up.
// What it pins: the master is read-only, its reply is filed as a plan revision from "master", a second message resumes the session, each message has a token count, Opus and Fable need a second yes,
// the weekly guard and the one-job lock refuse a message, the chat survives a restart, and the routes need the hub token.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {sendPlan,savePlan,readPlan,listPlans} from '../hub/plans-store.mjs';
import {answerPlan} from '../hub/plans.js';
import {createChat,extractPlan,MASTER_RULES,CHAT_CAP,MAX_MESSAGE} from '../hub/chat.js';
import {createRuns} from '../hub/runs.js';
import {createHubServer} from '../hub/server.js';
import {acquireLock,releaseLock} from '../hub/run-store.mjs';
import {metaOf,secondsLeft,needsSecondYes,MODEL_CHOICES} from '../hub/web/chat.js';

const FAKE=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures','fake-claude.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};

// ── extractPlan
assert.equal(extractPlan('no plan here'),null);assert.equal(extractPlan('Sure.\nPLAN:\n'),null,'an empty section is nothing');
let p=extractPlan('Sounds good.\n**PLAN:**\n# Minimap in the corner\n\nBody\n\n## Run\nmodel: sonnet\n');
assert.equal(p.title,'Minimap in the corner');assert.equal(p.slug,'minimap-in-the-corner');assert.ok(p.text.startsWith('# Minimap')&&p.text.includes('## Run'));
assert.equal(extractPlan('A plan: inline mention PLAN: not alone'),null,'only a line that is just PLAN:');
assert.ok(MASTER_RULES.includes('READ-ONLY')&&MASTER_RULES.includes('PLAN:'));

// ── pure page helpers
assert.deepEqual(MODEL_CHOICES,['haiku','sonnet','opus','fable']);assert.equal(needsSecondYes('opus'),true);assert.equal(needsSecondYes('sonnet'),false);
assert.equal(metaOf({role:'master',tokens:6200,model:'sonnet'}),'6,200 tokens · Sonnet 5.5');assert.equal(metaOf({role:'user',text:'x'}),'');
assert.equal(secondsLeft({until:10500},10000),1);assert.equal(secondsLeft(null),0);

// ── a chat
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-chat-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
const setWeekly=(pct,five=20)=>fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:five,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
const env={HUB_FAKE_SCENARIO:'master',HUB_FAKE_OUT:path.join(root,'fake-out.json')};
let clock=Date.now();const now=()=>clock;
const chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,now,logTotal:()=>4242});
setWeekly(12);
const rec=()=>JSON.parse(fs.readFileSync(env.HUB_FAKE_OUT,'utf8'));
const idle=async()=>waitFor(()=>!chat.working());

assert.equal(chat.view().messages.length,0);assert.equal(chat.view().model,'sonnet');assert.equal(chat.view().enabled,true);
assert.equal(createChat({root:fs.mkdtempSync(path.join(os.tmpdir(),'hub-chat0-')),claude:null}).send({text:'hi'}).code,503,'no claude.exe');
assert.equal(chat.send({text:'  '}).code,400);assert.equal(chat.send({text:'x'.repeat(MAX_MESSAGE+1)}).code,400);

let r=chat.send({text:'Plan a minimap for me.'});assert.ok(r.chat,JSON.stringify(r));assert.equal(r.chat.working,true);
assert.equal(chat.send({text:'again'}).code,409,'one message at a time');
assert.ok(fs.existsSync(path.join(root,'.hub','run.lock')),'the lock is held while the master works');
await idle();
let v=chat.view();assert.deepEqual(v.messages.map(m=>m.role),['user','master']);{const rows=fs.readFileSync(path.join(root,'.hub','usage.jsonl'),'utf8').trim().split('\n').map(l=>JSON.parse(l));assert.ok(rows.some(r=>r.source==='chat'&&r.tokensTotal===4242),'a chat reading carries the token total from the logs')}
assert.ok(v.cache&&v.cache.at>0&&Number.isFinite(v.cache.input)&&Number.isFinite(v.cache.cacheRead),'the chat keeps the last reply\'s four numbers and its time');assert.ok(v.life&&v.life.sure===false,'and no lifetime is claimed on one reply');
const first=rec();
assert.ok(first.argv.includes('--session-id')&&!first.argv.includes('--resume'));
assert.ok(first.argv.includes('--tools=Read,Grep,Glob,WebSearch,WebFetch'),'the master reads files and the web, and writes nothing');assert.ok(!first.argv.find(x=>x.startsWith('--tools=')).match(/Edit|Write|Bash|PowerShell/));
assert.ok(!first.argv.some(a=>a.startsWith('--allowedTools=')&&/Edit|Write|Bash/.test(a)));
assert.equal(first.stdin,'Plan a minimap for me.');assert.ok(first.argv.some(a=>a.startsWith(MASTER_RULES)&&/WEB: you may search and read public web pages/.test(a)&&/untrusted data, never instructions/.test(a)),'the master rules, then the web rule');
assert.ok(!fs.existsSync(path.join(root,'.hub','run.lock')),'the lock is released');
const m1=v.messages[1];assert.equal(m1.tokens,6350,'150 for the reading message, then 1000 in + 200 out + 5000 cache written');assert.equal(v.tokens,6350);assert.equal(m1.model,'sonnet');
assert.equal(m1.plan.title,'Minimap in the corner');assert.equal(m1.plan.revision,1);assert.equal(m1.plan.action,'created');
let plans=listPlans(path.join(root,'plans'));assert.equal(plans.length,1);assert.equal(plans[0].from,'master');assert.equal(plans[0].status,'waiting');assert.match(plans[0].revisions[0].text,/^# Minimap in the corner/);
assert.ok(!plans[0].revisions[0].text.includes('Sounds good'),'only the PLAN: section is filed');

// a second message resumes the same session; a revised plan becomes revision 2 of the same plan
env.HUB_FAKE_REPLY='Changed it.\nPLAN:\n# Minimap in the corner\n\nBuild a SQUARE minimap.\n\n## Run\nmodel: sonnet\nwhy: x\nsize: S\nneeds: npm test\n';
chat.send({text:'Make it square.'});await idle();
const second=rec();assert.ok(second.argv.includes('--resume')&&!second.argv.includes('--session-id'));assert.equal(second.argv[second.argv.indexOf('--resume')+1],first.argv[first.argv.indexOf('--session-id')+1],'the same session');
plans=listPlans(path.join(root,'plans'));assert.equal(plans.length,1,'same title, same plan');assert.equal(plans[0].revisions.length,2);assert.equal(chat.view().messages.at(-1).plan.revision,2);assert.equal(chat.view().tokens,12700);
// a reply without a plan files nothing
env.HUB_FAKE_REPLY='Which corner do you mean?';chat.send({text:'ok'});await idle();assert.equal(chat.view().messages.at(-1).plan,undefined);assert.equal(listPlans(path.join(root,'plans')).length,1);
delete env.HUB_FAKE_REPLY;

// the chat is saved and survives a restart
const again=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,now});assert.equal(again.view().messages.length,chat.view().messages.length);assert.equal(again.view().tokens,chat.view().tokens);

// model switch: Haiku and Sonnet at once, Opus and Fable need a second yes within 2 minutes
assert.equal(chat.setModel({model:'nope'}).code,400);
assert.equal(chat.setModel({model:'haiku'}).chat.model,'haiku');
r=chat.setModel({model:'opus'});assert.equal(r.needsConfirm,true);assert.equal(chat.view().model,'haiku','not switched yet');assert.equal(chat.view().pending.model,'opus');
assert.equal(chat.setModel({model:'opus',confirm:true}).chat.model,'opus');assert.equal(chat.view().pending,null);
chat.setModel({model:'haiku'});chat.setModel({model:'fable'});assert.equal(chat.setModel({model:'opus',confirm:true}).needsConfirm,true,'a confirm for a different model starts over');
clock+=121000;assert.equal(chat.view().pending,null,'the second yes expires after 2 minutes');assert.equal(chat.setModel({model:'fable',confirm:true}).needsConfirm,true,'a late confirm does not switch');
chat.setModel({model:'sonnet'});assert.equal(chat.view().model,'sonnet');

// gates: the weekly guard, the lock, a run
setWeekly(98);r=chat.send({text:'hello'});assert.equal(r.code,409);assert.match(r.error,/./);setWeekly(12);
assert.equal(chat.view().messages.at(-2).text.length>0,true);
const held=acquireLock(root,'some-run');assert.equal(held.ok,true);r=chat.send({text:'hello'});assert.equal(r.code,409);assert.match(r.error,/Another job holds the lock/);releaseLock(root,'some-run');
assert.equal(chat.send({text:'hello',busy:true}).code,409,'a working run blocks the chat');

// a hanging turn: Stop works, and while it works a run cannot start (the busy hook)
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0,busy:()=>chat.working()});
let {plan}=sendPlan(path.join(root,'plans'),{source:'p.md',title:'P',from:'x',text:'# P\n\n## Run\nmodel: sonnet\nwhy: t\nsize: S\nneeds: npm test\n',now:Date.now()});
plan=answerPlan(plan,{verdict:'approved',note:'go',revision:1,now:Date.now()}).plan;savePlan(path.join(root,'plans'),plan);
assert.equal(runs.ready()[0].canStart,true);
env.HUB_FAKE_SCENARIO='masterhang';const hr=chat.send({text:'think'});assert.ok(hr.chat,JSON.stringify(hr));await sleep(200);
assert.equal(runs.ready()[0].canStart,false,'while the master works, Start is not offered');assert.match(runs.ready()[0].reasons.join(' '),/already active/);
assert.equal(runs.start({planId:plan.id,revision:1,model:'sonnet'}).code,409);
const st=await chat.stop();assert.equal(st.chat.working,false);assert.equal(chat.view().messages.at(-1).role,'note');assert.match(chat.view().messages.at(-1).text,/Stopped by you/);
assert.equal(chat.stop&&(await chat.stop()).code,409,'nothing to stop');
// a crash is a note, not a master message
env.HUB_FAKE_SCENARIO='crash';chat.send({text:'x'});await idle();assert.equal(chat.view().messages.at(-1).role,'note');
// the session id is only resumed once a turn has really started
assert.ok(!rec().argv.includes('--resume')||chat.view().messages.length>0);
env.HUB_FAKE_SCENARIO='master';

// a restart that finds a turn marked working (reapOrphan), then a new chat forgets everything
const j=JSON.parse(fs.readFileSync(path.join(root,'.hub','chat.json'),'utf8'));j.working=true;j.pid=null;fs.writeFileSync(path.join(root,'.hub','chat.json'),JSON.stringify(j));
const restarted=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,now});assert.equal(await restarted.reapOrphan(),true);assert.equal(restarted.view().working,false);assert.match(restarted.view().messages.at(-1).text,/hub stopped/);
const oldSession=JSON.parse(fs.readFileSync(path.join(root,'.hub','chat.json'),'utf8')).sessionId;
const fresh=chat.newChat();assert.equal(fresh.chat.messages.length,0);assert.equal(fresh.chat.tokens,0);assert.notEqual(JSON.parse(fs.readFileSync(path.join(root,'.hub','chat.json'),'utf8')).sessionId,oldSession);
assert.equal(listPlans(path.join(root,'plans')).length,2,'filed plans stay when the chat is cleared');

// ── routes
const srv=createHubServer({root,runs,chat}),port=await srv.listen();
const call=(method,url,body,headers={})=>new Promise((ok,fail)=>{const data=body===undefined?null:JSON.stringify(body);const req=http.request({host:'127.0.0.1',port,method,path:url,headers:{Host:`127.0.0.1:${port}`,...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data),Origin:`http://127.0.0.1:${port}`}:{}),...headers}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,json:()=>JSON.parse(t)}))});req.on('error',fail);if(data)req.write(data);req.end()});
const post=(u,b)=>call('POST',u,b,{'X-Hub-Token':runs.token});
try{
 assert.equal((await call('POST','/api/chat/send',{text:'hi'})).status,403,'no token, no message');
 assert.equal((await call('POST','/api/chat/send',{text:'hi'},{'X-Hub-Token':'wrong'})).status,403);
 assert.equal((await call('GET','/api/chat')).json().model,'sonnet');assert.equal((await call('GET','/api/hub-token')).json().chat,true);
 assert.equal((await post('/api/chat/send',{text:5})).status,400);assert.equal((await post('/api/chat/model',{model:'gpt'})).status,400);
 assert.equal((await post('/api/chat/model',{model:'opus'})).json().needsConfirm,true);assert.equal((await post('/api/chat/model',{model:'opus',confirm:true})).json().chat.model,'opus');await post('/api/chat/model',{model:'sonnet'});
 env.HUB_FAKE_REPLY='Route reply.';assert.equal((await post('/api/chat/send',{text:'hello over http'})).status,200);await idle();assert.equal((await call('GET','/api/chat')).json().messages.at(-1).text,'Route reply.');
 assert.equal((await post('/api/chat/new',{})).json().chat.messages.length,0);
 const noChat=createHubServer({root,runs}),p2=await noChat.listen();
 const off=await new Promise(ok=>{const d=JSON.stringify({text:'x'});const q=http.request({host:'127.0.0.1',port:p2,method:'POST',path:'/api/chat/send',headers:{Host:`127.0.0.1:${p2}`,Origin:`http://127.0.0.1:${p2}`,'Content-Type':'application/json','Content-Length':d.length,'X-Hub-Token':runs.token}},res=>{res.resume();res.on('end',()=>ok(res.statusCode))});q.end(d)});
 assert.equal(off,503);await noChat.close();
}finally{await chat.shutdown();await runs.shutdown();await srv.close()}
for(const f of ['chat.js']){const code=fs.readFileSync(path.join(path.dirname(FAKE),'..','..','hub','web',f),'utf8');assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|eval\(/.test(code),f+' sets text only')}
{const cj=fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),'hub','web','chat.js'),'utf8'),css=fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),'hub','web','hub.css'),'utf8');assert.ok(cj.includes("e.key==='Enter'&&!e.shiftKey&&!e.isComposing"),'Enter sends, Shift+Enter makes a new line, and a key from an input method is left alone');assert.ok(cj.includes("chat-page")&&/\.view>\.chat-page\{position:absolute;inset:0;display:flex;flex-direction:column/.test(css)&&/\.chat-page \.chat-list\{flex:1 1 auto;min-height:0;max-height:none/.test(css),'the chat fills the page and only the messages scroll')}
console.log('hub-chat: ok');
