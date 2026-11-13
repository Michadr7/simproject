// Mikkadr Hub P5 R7b step 1: the chat's live feed and "what is the hub doing now" (for the corner bot). Fake Claude CLI only; no model call.
// What it pins: a chat turn leaves a feed of names and counts (never the reply text), a new message starts the feed over, the pure activity builder picks the right mood and line, and the two GET routes answer.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createChat} from '../hub/chat.js';
import {createRuns} from '../hub/runs.js';
import {createHubServer,resolveRoute,activityOf} from '../hub/server.js';
import {buildActivity,doing,feedRunOf,MOODS,MAX_ITEMS} from '../hub/activity.js';
import {feedRow} from '../hub/web/run-actions.js';

const FAKE=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures','fake-claude.mjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const waitFor=async(fn,ms=8000)=>{const t=Date.now();while(Date.now()-t<ms){const v=await fn();if(v)return v;await sleep(40)}throw new Error('timed out waiting')};

// ── the pure builder
assert.deepEqual(MOODS,['idle','working','question','stopped']);
let a=buildActivity();assert.equal(a.mood,'idle');assert.equal(a.line,'Nothing is running.');assert.deepEqual(a.items,[]);
const tool=(t,target)=>({at:0,kind:'tool',tool:t,target});
assert.equal(doing([]),'thinking');assert.equal(doing([tool('Read','game.js')]),'reading game.js');assert.equal(doing([tool('Grep','1 pattern')]),'searching');
assert.equal(doing([tool('Edit','a.js'),{kind:'tokens',total:5}]),'editing a.js','token lines are skipped');assert.equal(doing([tool('Read','a.js'),{kind:'turn',n:2}]),'thinking','a new turn starts over');
assert.equal(doing([tool('Shell','npm test')]),'running npm test');assert.equal(doing([tool('WebFetch','')]),'using WebFetch');
const run=(status,extra={})=>({id:'run-20261111-000000-aaaa',status,model:'sonnet',tokens:120000,capTokens:600000,...extra});
a=buildActivity({chat:{working:true,model:'sonnet',cap:200000},chatFeed:{events:[{kind:'turn',n:1},tool('Read','PROJECT-BRIEF.md'),{kind:'tokens',total:6350}]},runs:[run('capped')]});
assert.equal(a.mood,'working');assert.equal(a.source,'chat');assert.equal(a.line,'The master (Sonnet 5.5) is reading PROJECT-BRIEF.md.');assert.equal(a.tokens,6350);assert.equal(a.cap,200000);
assert.ok(a.items.every(i=>i.k!=='tokens'),'the short list leaves the token lines out');
a=buildActivity({runs:[run('done',{id:'run-20261111-000000-bbbb'}),run('running')],runFeed:[tool('Edit','game.js')]});
assert.equal(a.mood,'working');assert.equal(a.source,'run');assert.equal(a.runId,'run-20261111-000000-aaaa');assert.equal(a.line,'A Sonnet 5.5 run is editing game.js. Tokens used so far: 120,000 of 600,000.');
assert.equal(buildActivity({runs:[run('waiting-answer')]}).mood,'question');assert.match(buildActivity({runs:[run('confirming',{model:'opus'})]}).line,/Press again to confirm Opus 5\.5 \(expensive model\)/);
a=buildActivity({chat:{working:false,model:'sonnet',pending:{model:'fable',until:1}}});assert.equal(a.mood,'question');assert.match(a.line,/Fable 5\.2/);
for(const s of ['capped','paused','interrupted','guard-stopped','failed','stopped']){const x=buildActivity({runs:[run(s)]});assert.equal(x.mood,'stopped',s);assert.ok(x.line.length>5)}
assert.equal(buildActivity({runs:[run('done')]}).mood,'idle');assert.match(buildActivity({runs:[run('done')]}).line,/finished/);
assert.equal(buildActivity({runs:[run('closed')]}).line,'Nothing is running.');
assert.equal(buildActivity({chat:{working:false,model:'sonnet'},chatFeed:{events:[{kind:'end',end:'result',tokens:10}]}}).mood,'idle');
a=buildActivity({chat:{working:false,model:'sonnet'},chatFeed:{events:[{kind:'end',end:'capped',tokens:10}]}});assert.equal(a.mood,'idle','an unanswered message waits on nothing');assert.match(a.line,/no answer/);
assert.equal(buildActivity({runs:[run('running')],runFeed:Array.from({length:30},(_,i)=>tool('Read','f'+i))}).items.length,MAX_ITEMS);
assert.equal(feedRunOf([run('done',{id:'d'}),run('capped',{id:'c'})]),'c');assert.equal(feedRunOf([]),null);
assert.equal(feedRow({kind:'end',end:'result',tokens:6350}).text,'Answered');assert.equal(feedRow({kind:'end',end:'capped'}).cls,'bad');assert.equal(feedRow({kind:'end',end:'stopped'}).text,'Stopped by you');

// ── the chat's feed
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-activity-'));fs.mkdirSync(path.join(root,'plans'));fs.mkdirSync(path.join(root,'.hub'));
fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:Date.now(),source:'t',weekly:{pct:12,resetsAt:Math.floor(Date.now()/1000)+86400},fiveHour:{pct:20,resetsAt:Math.floor(Date.now()/1000)+3600}})+'\n');
const SECRET='ZEBRA-REPLY-WORDS';
const env={HUB_FAKE_SCENARIO:'master',HUB_FAKE_OUT:path.join(root,'fake-out.json'),HUB_FAKE_REPLY:'The answer is '+SECRET};
const chat=createChat({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env});
const idle=()=>waitFor(()=>!chat.working());
assert.deepEqual(chat.feed(0),{turn:0,working:false,events:[],last:0});
chat.send({text:'Where are we? '+SECRET});assert.equal(chat.feed(0).working,true);assert.equal(chat.feed(0).events[0].kind,'turn');assert.equal(chat.feed(0).events[0].resumed,false);
await idle();
let f=chat.feed(0);const kinds=f.events.map(e=>e.kind);
assert.equal(f.turn,chat.view().messages[0].id);assert.equal(f.working,false);assert.equal(f.last,f.events.length);
for(const k of ['turn','started','gauges','tool','tokens','result','end'])assert.ok(kinds.includes(k),'the feed has '+k+': '+kinds.join(','));
assert.deepEqual(f.events.map(e=>e.n),f.events.map((_,i)=>i+1));assert.equal(f.events.at(-1).end,'result');assert.equal(f.events.at(-1).tokens,6350);
assert.equal(f.events.find(e=>e.kind==='tool').target,'PROJECT-BRIEF.md');
assert.ok(!JSON.stringify(f).includes(SECRET),'names and counts only: neither your words nor the reply are in the feed');
assert.equal(chat.feed(f.last).events.length,0);assert.equal(chat.feed(2).events[0].n,3);assert.equal(chat.feed(-5).events.length,f.last);
chat.send({text:'again'});await idle();
const g=chat.feed(0);assert.notEqual(g.turn,f.turn,'a new message starts the feed over');assert.equal(g.events[0].resumed,true);assert.equal(g.events[0].n,2,'on a turn line n is the turn number, as in a run feed');assert.equal(g.events[1].n,2,'the other lines count from 1');
// a stopped turn ends the feed with how it ended
env.HUB_FAKE_SCENARIO='masterhang';chat.send({text:'think'});await sleep(250);
const runs=createRuns({root,claude:{path:process.execPath,prefix:[FAKE]},extraEnv:env,saveEveryMs:0,busy:()=>chat.working()});
a=activityOf(runs,chat);assert.equal(a.mood,'working');assert.equal(a.source,'chat');assert.match(a.line,/^The master \(Sonnet 5\.5\) is thinking\.$/);
await chat.stop();assert.equal(chat.feed(0).events.at(-1).end,'stopped');
a=activityOf(runs,chat);assert.equal(a.mood,'idle');assert.match(a.line,/no answer/);assert.ok(!JSON.stringify(a).includes(SECRET));
assert.equal(activityOf(null,null).mood,'idle','runs off: idle');
env.HUB_FAKE_SCENARIO='master';

// ── routes: read-only, no token needed (they carry names and counts), and never a write
assert.deepEqual(resolveRoute(root,'/api/activity','127.0.0.1:1',1),{api:'activity'});assert.deepEqual(resolveRoute(root,'/api/chat/feed','127.0.0.1:1',1),{api:'chatfeed'});
const srv=createHubServer({root,runs,chat}),port=await srv.listen();
const get=(url,method='GET')=>new Promise((ok,fail)=>{const req=http.request({host:'127.0.0.1',port,method,path:url,headers:{Host:`127.0.0.1:${port}`}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok({status:res.statusCode,json:()=>JSON.parse(t)}))});req.on('error',fail);req.end()});
try{
 const act=(await get('/api/activity')).json();assert.ok(MOODS.includes(act.mood));assert.equal(typeof act.line,'string');assert.ok(Array.isArray(act.items));
 const cf=(await get('/api/chat/feed?after=1')).json();assert.equal(cf.events[0].n,2);assert.equal(cf.last,chat.feed(0).last);
 assert.equal((await get('/api/chat/feed?after=zz')).json().events.length,cf.last,'a bad "after" reads from the start');
 assert.equal((await get('/api/activity','POST')).status,405);assert.equal((await get('/api/chat/feed','POST')).status,405);
 chat.newChat();assert.equal((await get('/api/chat/feed')).json().last,0,'a new chat clears the feed');
 const bare=createHubServer({root}),p2=await bare.listen();
 const off=await new Promise(ok=>http.get({host:'127.0.0.1',port:p2,path:'/api/activity',headers:{Host:`127.0.0.1:${p2}`}},res=>{let t='';res.on('data',c=>t+=c);res.on('end',()=>ok(JSON.parse(t)))}));
 assert.equal(off.mood,'idle');await bare.close();
}finally{await chat.shutdown();await runs.shutdown();await srv.close()}
// a tool job that runs is work: the bot and the panda must agree with the Commit and Tools pages
{const {buildActivity}=await import('../hub/activity.js');
 let a=buildActivity({job:{key:'test',label:'Run the tests'}});assert.equal(a.mood,'working');assert.equal(a.source,'job');assert.equal(a.line,'Run the tests is running.');assert.equal(a.scene,'test');assert.equal(a.facts.cmd,'Run the tests');
 a=buildActivity({job:{key:'release',label:'Make a release'}});assert.equal(a.scene,'write');assert.equal(a.mood,'working');
 a=buildActivity({job:{key:'check',label:'Check'}});assert.equal(a.scene,'test');
 assert.equal(buildActivity({runs:[{id:'r',model:'sonnet',status:'running',tokens:1,capTokens:2}],job:{key:'test',label:'x'}}).source,'run','a run on show wins over a job');
 assert.equal(buildActivity({}).mood,'idle');
 const act=activityOf(null,null,{jobs:{list:()=>({running:{key:'test',label:'Run the tests'}})}});assert.equal(act.jobRunning,true)}
// Hub 2.6: the panda's scene and facts, worked out from the feed (names and counts only)
{const {sceneOfEvents,gaugeOf,STOP_SIGN,SCENES}=await import('../hub/activity.js');const {createReducer}=await import('../hub/runner.js');
 const tool=(t,target)=>({kind:'tool',tool:t,target}),T={kind:'tokens',total:5};
 assert.equal(sceneOfEvents([{kind:'turn'}]),'think');assert.equal(sceneOfEvents([{kind:'turn'},tool('Read','a.js'),T]),'read');assert.equal(sceneOfEvents([tool('Grep','1 pattern')]),'read');
 assert.equal(sceneOfEvents([tool('Read','a.js'),tool('Edit','b.js')]),'write');assert.equal(sceneOfEvents([tool('Shell','npm test')]),'test');assert.equal(sceneOfEvents([tool('Shell','command')]),'write');assert.equal(sceneOfEvents([tool('WebFetch','')]),'think');
 assert.equal(sceneOfEvents([tool('Shell','npm test'),{kind:'shell',target:'npm test',ok:true}]),'pass');assert.equal(sceneOfEvents([tool('Shell','npm test'),{kind:'shell',target:'npm test',ok:false},T]),'fail','tokens do not end the result');
 assert.equal(sceneOfEvents([{kind:'shell',target:'npm test',ok:false},tool('Edit','a.js')]),'write','the next event ends it');
 const run={id:'run-1',model:'sonnet',status:'running',tokens:300000,capTokens:1500000};
 let a=buildActivity({runs:[run],runFeed:[{kind:'started'},tool('Read','PROJECT-BRIEF.md'),tool('Edit','game.js'),T],gauge:70});
 assert.equal(a.scene,'write');assert.equal(a.facts.file,'game.js');assert.equal(a.facts.used,300000);assert.equal(a.facts.cap,1500000);assert.equal(a.facts.gauge,70);assert.equal(a.facts.asks,0);assert.equal(a.facts.reason,null);
 a=buildActivity({runs:[run],runFeed:[tool('Shell','npm test'),{kind:'shell',target:'npm test',ok:true}]});assert.equal(a.scene,'pass');assert.equal(a.facts.result,'passed');assert.equal(a.facts.resultOf,'npm test');
 assert.equal(buildActivity({runs:[{...run,status:'waiting-answer'}],runFeed:[]}).scene,'wait');assert.equal(buildActivity({runs:[{...run,status:'waiting-answer'},{...run,id:'r2',status:'confirming'}]}).facts.asks,2);assert.equal(buildActivity({chat:{pending:{model:'opus'}}}).facts.asks,1);
 for(const st of Object.keys(STOP_SIGN)){a=buildActivity({runs:[{...run,status:st}]});assert.equal(a.scene,'stopped',st);assert.equal(a.facts.reason,st);assert.equal(a.facts.sign,STOP_SIGN[st])}
 assert.equal(Object.keys(STOP_SIGN).length,6,'all six stop reasons have a sign');
 assert.equal(buildActivity({runs:[{...run,status:'done'}]}).scene,'done');a=buildActivity({});assert.equal(a.scene,'idle');assert.equal(a.facts.cacheMin,null);assert.equal(a.facts.gauge,null);assert.ok(SCENES.includes(a.scene));
 assert.equal(buildActivity({chat:{working:true,model:'sonnet'},chatFeed:{events:[{kind:'turn'}]}}).scene,'think');
 // the cup: minutes since the last reply; "cold" only when the lifetime is sure
 const now=1e12,min=60000,sure={sure:true,longestHitMs:4*min,shortestMissMs:9*min,hits:3,misses:1};
 a=buildActivity({runs:[{...run,cache:{at:now-12*min}}],now,life:null,runFeed:[]});assert.equal(a.facts.cacheMin,12);assert.equal(a.facts.cache,'unknown','never cold without a measured lifetime');
 assert.equal(buildActivity({runs:[{...run,cache:{at:now-12*min}}],now,life:sure}).facts.cache,'cold');assert.equal(buildActivity({runs:[{...run,cache:{at:now-2*min}}],now,life:sure}).facts.cache,'warm');
 assert.equal(gaugeOf({weekly:{known:true,pct:46},fiveHour:{known:false,pct:99}}),46,'an unknown gauge is ignored');assert.equal(gaugeOf({weekly:{known:true,pct:46},fiveHour:{known:true,pct:92}}),92);assert.equal(gaugeOf({}),null);
 // the runner: a hub script's exit result becomes a feed event by the tool's own error flag; other commands and unknown ids give nothing
 const red=createReducer({tools:['Bash']}),L=o=>JSON.stringify(o),use=(id,command)=>L({type:'assistant',message:{id:'m'+id,content:[{type:'tool_use',id,name:'Bash',input:{command}}],usage:{input_tokens:1}}}),res=(id,err)=>L({type:'user',message:{content:[{type:'tool_result',tool_use_id:id,is_error:err,content:'SECRET OUTPUT'}]}});
 red.take(use('t1','npm test'));red.take(use('t2','node secret.js'));
 let r=red.take(res('t1',false));assert.deepEqual(r.events,[{kind:'shell',target:'npm test',ok:true}]);assert.ok(!JSON.stringify(r).includes('SECRET OUTPUT'));
 assert.deepEqual(red.take(res('t2',true)).events,[],'a command that is not a hub script has no result event');assert.deepEqual(red.take(res('nope',true)).events,[]);assert.deepEqual(red.take(res('t1',true)).events,[],'each result once');
 red.take(use('t3','npm test -- foo'));assert.deepEqual(red.take(res('t3',true)).events,[{kind:'shell',target:'npm test',ok:false}]);
 assert.equal(feedRow({kind:'shell',target:'npm test',ok:false}).text,'npm test failed');assert.equal(feedRow({kind:'shell',target:'npm test',ok:true}).cls,'')}
console.log('hub-activity: the chat feed (names and counts, starts over per message, ends with how the turn ended), the activity builder (idle, working, question, stopped) and the two GET routes passed.');
