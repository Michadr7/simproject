// Hub 2.10/2.11: the Work lanes and the one-path queue (hub/web/lanes.js): lane of each status, area chips, newest first, the new dot, the Do next strip, file checks and notes kept apart.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {laneOf,buttonText,areaOf,areaLabel,isNew,ageShort,laneCards,byLane,areaChips,doNext,sideItems,queueOf,ledeOf,thenOf,LANES,NEW_MS} from '../hub/web/lanes.js';
import {buildWork} from '../hub/work.js';

assert.deepEqual(LANES.map(l=>l[1]),['Approve','Start','Working','Read result','Done']);
const L={waiting:'approve',approved:'start',blocked:'start',working:'work',question:'read',finished:'read',stopped:'read',done:'done'};
for(const [st,lane] of Object.entries(L))assert.equal(laneOf({status:st}),lane,st);
assert.equal(laneOf({status:'stopped',denied:true}),'done','a denied plan is done');
assert.equal(buttonText({status:'waiting'}),'Approve');assert.equal(buttonText({status:'approved'}),'Start');assert.equal(buttonText({status:'question'}),'Answer');assert.equal(buttonText({status:'blocked'}),'Open');

for(const [p,a] of [['UI','ui'],['Scene editor','scene'],['People','people'],['Hub v2','hub'],['Mikkadr Hub','hub'],['Hub','hub'],['Other','other'],['Hubble','other'],['',"other"],[null,'other'],['Game systems','game']])assert.equal(areaOf(p),a,String(p));
assert.equal(areaLabel('scene'),'Scene editor');assert.equal(areaLabel('zzz'),'Other');

const NOW=10*3600*1000;
assert.equal(isNew(NOW-59*60000,NOW),true);assert.equal(isNew(NOW-NEW_MS,NOW),false);assert.equal(isNew(0,NOW),false);assert.equal(isNew(NOW+5,NOW),false,'the future is not new');
assert.equal(ageShort(NOW-4*60000,NOW),'4 min');assert.equal(ageShort(NOW-3*3600000,NOW),'3 h');assert.equal(ageShort(0,NOW),'');assert.equal(ageShort(NOW,NOW),'now');

const plan=(id,title,status,at,over)=>({id,title,status,revision:1,sentAt:at,run:{model:'sonnet',size:'M'},runProblem:null,note:'',...over});
const tree=buildWork({
 plans:[plan('u1','UI: Menu','waiting',500),plan('u2','UI: Old menu','waiting',100),plan('s4','Scene editor E4: Library','approved',300),plan('w1','Warehouse K1: Docks','approved',400),plan('h1','Hub v2 V1: tree','approved',50),plan('x','Random idea','waiting',900,{run:null})],
 runs:[{id:'run-1',planId:'s4',planTitle:'t',revision:1,model:'sonnet',size:'M',capTokens:1,tokens:1,status:'done',turn:1,files:[],flagged:[],pending:null,createdAt:1,updatedAt:350}],
 ready:[{planId:'w1',revision:1,model:'sonnet',size:'M',capTokens:1,canStart:true,reasons:[],secondYes:false}],
 waiting:[{id:'asset:a',group:'asset',title:'crate unused',detail:'',at:5,actions:[]},{id:'filecheck:b',group:'filecheck',title:'man.glb has no skeleton',detail:'',at:6,actions:[]},{id:'tokens:stale',group:'note',title:'old reading',detail:'',at:7,actions:[]}],
 found:[{hash:'0123456789abcdef',path:'x-plan.md',title:'Loose',bytes:1,modifiedAt:9}],enabled:true});

const all=laneCards(tree);
assert.equal(all.length,6);
assert.deepEqual(all.map(c=>c.step.at),[...all.map(c=>c.step.at)].sort((a,b)=>b-a),'newest first');
const lanes=byLane(all);
assert.deepEqual(lanes.approve.map(c=>c.step.planId),['x','u1','u2'],'waiting plans, newest first');
assert.deepEqual(lanes.start.map(c=>c.step.planId).sort(),['h1','w1']);
assert.deepEqual(lanes.read.map(c=>c.step.planId),['s4'],'a finished run is in Read result');
assert.equal(lanes.work.length+lanes.done.length,0);
assert.deepEqual(laneCards(tree,'ui').map(c=>c.step.planId),['u1','u2'],'a chip filters');
assert.equal(laneCards(tree,'hub').length,1);assert.equal(laneCards(tree,'other').length,1);assert.equal(laneCards(tree,'people').length,0);
assert.deepEqual(areaChips(tree).map(c=>c[0]),['ui','scene','warehouse','hub','other'],'only areas that have a step, in the fixed order');
// an approved plan that gets its approval moves lanes by itself
const t2=buildWork({plans:[plan('u1','UI: Menu','approved',500)],ready:[{planId:'u1',revision:1,model:'sonnet',size:'M',capTokens:1,canStart:true,reasons:[],secondYes:false}]});
assert.equal(laneCards(t2)[0].lane,'start');

// Do next: approve first (oldest waiting first), then start, then read result; at most 3
const dn=doNext(tree);assert.equal(dn.length,3);assert.deepEqual(dn.map(c=>c.step.planId),['u2','u1','x']);
assert.equal(doNext(tree,5).length,5);assert.ok(doNext(tree,5).some(c=>c.lane==='start'));
const noStart=buildWork({plans:[plan('a','UI: A','approved',1)],ready:[{planId:'a',revision:1,model:'sonnet',size:'M',capTokens:1,canStart:false,reasons:['x'],secondYes:false}]});
assert.equal(doNext(noStart).length,0,'a plan that cannot start is not offered as Start');

// file checks, notes and never-sent plan files are kept apart from the lanes
const side=sideItems(tree);
assert.equal(side.files.length,2);assert.equal(side.found.length,1);assert.deepEqual(side.notes.map(i=>i.kind),['tokens']);
assert.deepEqual(sideItems({projects:[]}),{files:[],found:[],notes:[]});
// 2.11 the queue: Running, Up next (the Do next order, all of them), cannot-start with a reason, the rest folded
assert.equal(doNext(tree,Infinity).length,5);assert.deepEqual(doNext(tree,Infinity,'ui').map(c=>c.step.planId),['u2','u1'],'doNext takes an area');
const qu=queueOf(tree);assert.deepEqual(qu.next.map(c=>c.step.planId),['u2','u1','x','w1','s4'].filter(id=>doNext(tree,Infinity).some(c=>c.step.planId===id)),'Up next keeps the Do next order');
assert.equal(qu.next.length,5);assert.deepEqual(qu.blocked.map(c=>c.step.planId),['h1'],'an approved plan that cannot start is listed with its reason, apart from Up next');
assert.equal(qu.running.length,0);assert.equal(qu.rest.length,0);
assert.equal(queueOf(noStart).next.length,0);assert.equal(queueOf(noStart).blocked.length,1);
const tw=buildWork({plans:[plan('r','UI: R','approved',5),plan('d','UI: D','approved',6)],runs:[{id:'run-r',planId:'r',planTitle:'t',revision:1,model:'sonnet',size:'M',capTokens:1,tokens:1,status:'running',turn:1,files:[],flagged:[],pending:null,createdAt:1,updatedAt:9},{id:'run-d',planId:'d',planTitle:'t',revision:1,model:'sonnet',size:'M',capTokens:1,tokens:1,status:'closed',turn:1,files:[],flagged:[],pending:null,createdAt:1,updatedAt:8}]});
const qw=queueOf(tw);assert.deepEqual(qw.running.map(c=>c.step.planId),['r']);assert.deepEqual(qw.rest.map(c=>c.step.planId),['d'],'a done step is under Everything else');assert.equal(qw.next.length,0);
assert.match(ledeOf({status:'waiting'}),/Approving does not start anything or cost tokens/);assert.match(ledeOf({status:'approved',canStart:false}),/cannot start/);assert.ok(ledeOf({status:'done'}).length>5);
assert.deepEqual(thenOf({status:'waiting',next:'Read the plan and press Approve. After that, Start runs it on Sonnet 5.5 (allowed up to 1,500,000 tokens).'}),{label:'Then:',text:'Start runs it on Sonnet 5.5 (allowed up to 1,500,000 tokens).'});
assert.equal(thenOf({status:'approved',next:'Press Start.'}).text,'Press Start.');
// the page file: one path, none of the old strips
const wj=fs.readFileSync(new URL('../hub/web/work.js',import.meta.url),'utf8');
assert.ok(!/NEXT STEP|donext|drawStrip|statusLine|class:'chips'|class:'chip'/.test(wj),'no banner, no Do next strip, no status line, no area chips');
assert.ok(wj.includes("'Area'")&&wj.includes('Assets: ')&&wj.includes('Hub notes: ')&&wj.includes('Open Assets'),'one quiet bottom line');
console.log('hub-lanes ok');
