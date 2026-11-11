// Mikkadr Hub P4 S5: the Waiting for you list: the four sources, the order (stop or critical tokens, plans, high tokens, assets, notes; oldest first), hiding by content hash,
// the counts, what npm run assets writes for it, and the live route with its hide write.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {buildWaiting,PROBE_COMMAND,STALE_MINUTES} from '../hub/waiting.js';
import {attentionItems} from '../hub/assets-page.js';
import {createHubServer,waitingOf,hideAsset,readHidden} from '../hub/server.js';
import {sendPlan} from '../hub/plans-store.mjs';
import {signature} from '../hub/web/home.js';

const NOW=Date.UTC(2026,10,11,12),H=3600000;
const gauge=(over={})=>({weekly:{known:true,pct:12},fiveHour:{known:true,pct:30},ageMin:5,stale:false,warnings:[],...over});
const att=(items,generatedAt=NOW-H)=>({generatedAt,items});
const A=(id,kind,hash,extra={})=>({id,name:id.toUpperCase(),kind,text:'text of '+id,viewable:true,hash,...extra});
const hx=n=>String(n).repeat(16).slice(0,16);
const P=(id,status,sentAt,rev=1)=>({id,title:'Plan '+id,from:'opus session',status,revision:rev,sentAt});

// nothing waiting
assert.deepEqual(buildWaiting({gauges:gauge(),now:NOW}),{items:[],counts:{waiting:0,plans:0,assets:0,tokens:0}});
assert.deepEqual(buildWaiting({now:NOW}).items,[],'no sources at all is an empty list, not an error');

// plans: only waiting ones, one item each with the newest revision, oldest first
let w=buildWaiting({plans:[P('b','waiting',NOW-H,2),P('a','waiting',NOW-5*H),P('c','approved',NOW-9*H),P('d','denied',NOW-9*H)],now:NOW});
assert.deepEqual(w.items.map(i=>i.id),['plan:a','plan:b']);assert.equal(w.items[1].title,'Plan: Plan b (revision 2)');assert.equal(w.items[1].detail,'From opus session');
assert.deepEqual(w.items[0].actions,[{type:'link',label:'Read and answer',href:'#plans/a',primary:true}]);assert.equal(w.counts.plans,2);

// found plan files: one grouped note
w=buildWaiting({found:[{path:'a-plan.md',modifiedAt:NOW-3*H},{path:'docs/b-plan.md',modifiedAt:NOW-H},{path:'c/PLAN.md',modifiedAt:NOW},{path:'d/plan.md',modifiedAt:NOW}],now:NOW});
assert.equal(w.items.length,1);assert.equal(w.items[0].group,'note');assert.equal(w.items[0].title,'4 plan files found that were never sent');assert.match(w.items[0].detail,/a-plan\.md, docs\/b-plan\.md, c\/PLAN\.md, and 1 more/);assert.equal(w.items[0].at,NOW-3*H);
assert.equal(buildWaiting({found:[{path:'x/plan.md',modifiedAt:NOW}],now:NOW}).items[0].title,'1 plan file found that was never sent');

// assets: titles, Open in 3D only for models, Hide by hash, hidden ones leave and a changed hash comes back
const asset=att([A('pump','unused',hx(1)),A('old','outdated',hx(2),{viewable:false}),A('pic','picture',hx(3)),A('odd','credit',hx(4)),A('z','override',hx(5))]);
w=buildWaiting({attention:asset,now:NOW});
assert.deepEqual(w.items.map(i=>i.title),['OLD: the register row is outdated','PIC: the picture could not be drawn','PUMP is not used anywhere in the game'],'credit and override rows never appear; same age so by name');
const pump=w.items.find(i=>i.id==='asset:'+hx(1));assert.deepEqual(pump.actions.map(a=>a.label),['Open in 3D','Hide until it changes']);assert.equal(pump.actions[0].href,'/viewer.html#pump');assert.equal(pump.actions[0].external,true);
assert.deepEqual(w.items.find(i=>i.id==='asset:'+hx(2)).actions.map(a=>a.label),['Hide until it changes'],'no 3D link without a model');
assert.equal(pump.actions[1].hash,hx(1));assert.match(pump.detail,/^Assets · text of pump/);
assert.deepEqual(buildWaiting({attention:asset,hidden:[hx(1),hx(3)],now:NOW}).items.map(i=>i.id),['asset:'+hx(2)],'hidden by hash');
assert.equal(buildWaiting({attention:att([A('pump','unused',hx(9))]),hidden:[hx(1)],now:NOW}).items.length,1,'the asset changed (new hash): it shows again');
assert.equal(buildWaiting({attention:asset,now:NOW}).counts.assets,3);assert.equal(buildWaiting({attention:null,now:NOW}).items.length,0,'no attention file yet');
assert.equal(buildWaiting({attention:{items:[{id:'x',name:'X',kind:'weird',hash:hx(1)}]},now:NOW}).items.length,0,'unknown kinds are ignored');
assert.ok(buildWaiting({attention:att([A('long','unused',hx(1),{name:'n'.repeat(300),text:'t'.repeat(500)})]),now:NOW}).items[0].title.length<100,'long names are cut');

// tokens: critical and stop first, high after plans, watch and stale as notes
const warn=(level,text='Weekly use is 63%.')=>({level,text});
w=buildWaiting({gauges:gauge({warnings:[warn('watch')]}),now:NOW});assert.equal(w.items[0].group,'note');assert.deepEqual(w.items[0].actions.map(a=>a.label),['Open Tokens','Copy command']);assert.equal(w.items[0].actions[1].text,PROBE_COMMAND);assert.equal(w.counts.tokens,1);
assert.equal(buildWaiting({gauges:gauge({warnings:[warn('info','The newest reading is 20 minutes old.')]}),now:NOW}).items.length,0,'a 20-minute-old reading is not a warning here');
for(const [min,shows] of [[STALE_MINUTES-1,false],[STALE_MINUTES,true],[3*60,true]])assert.equal(buildWaiting({gauges:gauge({ageMin:min,stale:true}),now:NOW}).items.some(i=>i.id==='tokens:stale'),shows,`reading ${min} min old`);
w=buildWaiting({gauges:gauge({ageMin:180}),now:NOW});assert.equal(w.items[0].title,'The token reading is 3 h old');assert.match(w.items[0].detail,/npm run watcher -- --probe/);assert.equal(w.items[0].actions[1].primary,true);
assert.equal(buildWaiting({gauges:gauge({ageMin:null}),now:NOW}).items[0].title,'There is no token reading yet');
assert.equal(buildWaiting({gauges:gauge({ageMin:3*1440}),now:NOW}).items[0].title,'The token reading is 3 days old');

// the whole order: critical tokens, plans, high tokens, assets, notes; oldest first inside a group
w=buildWaiting({
 plans:[P('new','waiting',NOW-H),P('old','waiting',NOW-4*H)],found:[{path:'x/plan.md',modifiedAt:NOW-2*H}],attention:asset,
 gauges:gauge({ageMin:200,warnings:[warn('high','5-hour use is 80%.'),warn('critical','Weekly use is 92%.'),warn('watch','Weekly use is 63%.')]}),now:NOW});
assert.deepEqual(w.items.map(i=>i.group),['tokens-critical','plan','plan','tokens-high','asset','asset','asset','note','note','note']);
assert.deepEqual(w.items.filter(i=>i.group==='plan').map(i=>i.id),['plan:old','plan:new'],'oldest plan first');
assert.deepEqual(w.items.filter(i=>i.group==='note').map(i=>i.at),[NOW-200*60000,NOW-200*60000,NOW-2*H].sort((a,b)=>a-b),'notes oldest first');
assert.deepEqual(w.counts,{waiting:10,plans:2,assets:3,tokens:4});
assert.ok(w.items.every(i=>i.severity&&Number.isInteger(i.rank)&&Array.isArray(i.actions)&&i.actions.length));
assert.equal(signature(w),signature(JSON.parse(JSON.stringify(w))),'the page redraws only when the list changed');assert.notEqual(signature(w),signature({items:[]}));

// what npm run assets writes: only the three kinds, a hash that changes with the asset's content
const assets=[{id:'a',name:'A',kind:'model',origin:'module',stage:'converted',hash:'h1',hasCredit:true},{id:'b',name:'B',kind:'model',origin:'register',stage:'received',files:['x/b.glb'],shippedAs:'a',shippedName:'A',licence:'CC-BY 4.0'},{id:'c',name:'C',kind:'model',origin:'module',stage:'in game',hasCredit:false,evidence:'override: tested'},{id:'d',name:'D',kind:'sound',origin:'register',stage:'wanted'}];
const items=attentionItems(assets,{d:{error:'Edge crashed'}});
assert.deepEqual(items.map(i=>[i.id,i.kind]).sort(),[['a','unused'],['b','outdated'],['d','picture']].sort(),'credit, licence and override rows are left out');
assert.deepEqual(items.map(i=>i.viewable).sort(),[false,true,true],'only models are viewable');assert.ok(items.every(i=>/^[a-f0-9]{16}$/.test(i.hash)));
assert.notEqual(attentionItems([{...assets[0],hash:'h2'}])[0].hash,items.find(i=>i.id==='a').hash,'a content change gives a new hash');
assert.equal(attentionItems([{...assets[0]}])[0].hash,items.find(i=>i.id==='a').hash,'the same content keeps its hash');

// the live server: reads the files, hides by hash, refuses anything else
const root=fs.mkdtempSync(path.join(os.tmpdir(),'hub-waiting-'));
try{
 fs.mkdirSync(path.join(root,'.hub'),{recursive:true});
 const now=Date.now();
 fs.writeFileSync(path.join(root,'.hub','usage.jsonl'),JSON.stringify({at:now-60000,weekly:{pct:63,resetsAt:Math.floor(now/1000)+86400},fiveHour:{pct:55,resetsAt:Math.floor(now/1000)+3600}})+'\n');
 fs.writeFileSync(path.join(root,'.hub','attention.json'),JSON.stringify({generatedAt:now-H,items:[A('pump','unused',hx(1)),A('old','outdated',hx(2)),{id:'bad',hash:'zz'},null]}));
 sendPlan(path.join(root,'plans'),{source:'a.md',title:'Alpha',from:'claude',text:'# Alpha\nx',now:now-2*H});
 fs.writeFileSync(path.join(root,'my-plan.md'),'# My plan\nz');
 const direct=waitingOf(root,now);
 assert.deepEqual(direct.items.map(i=>i.group),['plan','asset','asset','note','note','note'],'a plan, two assets (the bad rows are dropped), then three notes: the found file, weekly 63% and 5-hour 55%');
 assert.equal(direct.counts.tokens,2);
}finally{}
try{
 const srv=createHubServer({root}),port=await srv.listen(),O=`http://127.0.0.1:${port}`;
 const call=(method,url,headers={},body)=>new Promise((res,rej)=>{const r=http.request({host:'127.0.0.1',port,method,path:url,headers:Object.fromEntries(Object.entries(headers).filter(([,v])=>v!==undefined))},x=>{let s='';x.on('data',c=>s+=c);x.on('end',()=>res({status:x.statusCode,body:s}))});r.on('error',rej);r.end(body)});
 const post=(body,h={})=>call('POST','/api/waiting/hide',{'Content-Type':'application/json',Origin:O,...h},JSON.stringify(body));
 try{
  const g=JSON.parse((await call('GET','/api/waiting')).body);assert.equal(g.counts.plans,1);assert.equal(g.counts.assets,2);assert.ok(g.counts.waiting>=5);
  assert.ok(!JSON.stringify(g).includes('usage.jsonl')&&!JSON.stringify(g).includes('costUsd'),'no raw fields');
  assert.equal((await call('GET','/api/waiting',{Host:'evil.example'})).status,403);
  assert.equal((await call('GET','/api/waiting/hide')).status,405,'hide is POST only');
  assert.equal((await post({hash:hx(1)},{Origin:undefined})).status,403,'no Origin');assert.equal((await post({hash:hx(1)},{Origin:'http://evil.example'})).status,403);assert.equal((await post({hash:hx(1)},{'Content-Type':'text/plain'})).status,415);
  assert.equal((await post({hash:'nope'})).status,400);assert.equal((await post({hash:hx(7)})).status,404,'a hash that is not on the list');assert.equal((await post({hash:hx(1),extra:'../x'})).status,200,'extra fields are ignored');
  const after=JSON.parse((await post({hash:hx(2)})).body);assert.equal(after.counts.assets,0,'both hidden now');assert.deepEqual(readHidden(root).sort(),[hx(1),hx(2)].sort());
  assert.equal((await post({hash:hx(2)})).status,200,'hiding twice is fine');assert.equal(readHidden(root).length,2,'and keeps one entry');
  fs.writeFileSync(path.join(root,'.hub','attention.json'),JSON.stringify({generatedAt:Date.now(),items:[A('pump','unused',hx(8))]}));
  assert.equal(JSON.parse((await call('GET','/api/waiting')).body).counts.assets,1,'a changed asset (new hash) shows again');
  assert.equal(hideAsset(root,hx(1)),false,'an old hash is not on the list any more');
  fs.rmSync(path.join(root,'.hub','attention.json'));assert.equal(JSON.parse((await call('GET','/api/waiting')).body).counts.assets,0,'no attention file: no asset items');
 }finally{await srv.close()}
}finally{fs.rmSync(root,{recursive:true,force:true})}
console.log('hub-waiting ok');
