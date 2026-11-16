import assert from 'node:assert/strict';
import {DOOR_STYLES,doorStyle,doorTip,doorHint,doorChoices,GIG_TYPES,payFor,repeatsToday,parRoute,normalizeGigs,boardFor,acceptGig,tickGig,completeGig,failGig,gigDone,freshGigs,qualityFor,gameMinutes,marketBoard} from '../dist/gigs.js';
import {freshProgress} from '../dist/jobs.js';
// payFor: the design's worked example, repeat steps, rep cap, tips
assert.equal(payFor('fragile',85,2,20),3076);
assert.equal(payFor('grocery',100,0,0),1200);assert.equal(payFor('grocery',0,0,0),720);
assert.deepEqual([0,1,2,3,4,9].map(r=>payFor('grocery',100,r,0)),[1200,1200,1020,840,660,660]);
assert.equal(payFor('grocery',100,0,60),payFor('grocery',100,0,100));assert.equal(payFor('grocery',100,0,60),1560);
assert.equal(payFor('parcel',100,0,0,500),1500);assert.equal(payFor('parcel',100,0,0,99999),1800);assert.equal(payFor('parcel',100,0,0,0),1000);
assert(Number.isInteger(payFor('bulk',77,3,13)));assert.equal(payFor('nope',100,0,0),0);
assert.equal(qualityFor('fragile',{knocks:2}),70);assert.equal(qualityFor('fragile',{knocks:9}),40);assert.equal(qualityFor('rush',{late:true}),0);assert.equal(qualityFor('round',{overPct:25}),80);
assert.equal(repeatsToday([{type:'a',at:10},{type:'a',at:2000},{type:'b',at:2000}],'a',2100),1);
// par route
const r=parRoute([{x:10,z:0},{x:1,z:0},{x:5,z:0}],{x:0,z:0});assert.deepEqual(r.order,[1,2,0]);assert.equal(r.length,10);
// normalise junk
assert.deepEqual(normalizeGigs(null),freshGigs());
const junk=normalizeGigs({rep:999,recent:[{type:'x',at:1},{type:'grocery',at:5},7],active:{type:'nope'},taken:{0:'a',1:3},clientsSeen:{a:-1,b:4},completed:-5,nextId:'x'});
assert.equal(junk.rep,100);assert.deepEqual(junk.recent,[{type:'grocery',at:5}]);assert.equal(junk.active,null);assert.deepEqual(junk.taken,{1:3});assert.deepEqual(junk.clientsSeen,{a:0,b:4});assert.equal(junk.completed,0);assert.equal(junk.nextId,1);
assert.equal(normalizeGigs({active:{type:'grocery',places:[{x:'a',z:1}]}}).active,null);
// board: repeatable, 4 slots, distinct types, unlock gates, staggered expiry
const p={...freshProgress(),gigs:freshGigs()};
const b1=boardFor(p,600),b2=boardFor(p,600);assert.deepEqual(b1,b2);assert.equal(b1.length,3);
assert.equal(new Set(b1.map(s=>s.type)).size,3);
for(let t=0;t<3000;t+=37){const b=boardFor(p,t);assert(b.every(s=>['grocery','parcel','rush'].includes(s.type)),'rep 0 types only: '+t);assert.equal(new Set(b.map(s=>s.type)).size,b.length);assert(b.every(s=>s.expiresAt>t&&s.expiresAt-t<=90));assert.equal(new Set(b.map(s=>s.client)).size,b.length)}
assert.equal(boardFor(p,600).length,3);// only 3 types at rep 0, so 3 slots
const exp=boardFor(p,600).map(s=>s.expiresAt);assert.equal(new Set(exp).size,exp.length);
const rich={...p,gigs:{...p.gigs,rep:30},vehicles:[{uid:'v1',model:'worktruck'}]};const types=new Set();for(let t=0;t<4000;t+=30)for(const s of boardFor(rich,t))types.add(s.type);assert.deepEqual([...types].sort(),GIG_TYPES.filter(t=>t.live!==false).map(t=>t.id).sort());
const mid={...p,gigs:{...p.gigs,rep:10}};const midT=new Set();for(let t=0;t<4000;t+=30)for(const s of boardFor(mid,t))midT.add(s.type);assert(midT.has('round')&&!midT.has('fuel')&&!midT.has('fragile')&&!midT.has('chain'));
assert(marketBoard(p,600).every(s=>s.type==='grocery'||s.type==='parcel'));
// the last finished type is not offered
const after={...p,gigs:{...p.gigs,recent:[{type:'grocery',at:590}]}};assert(boardFor(after,600).every(s=>s.type!=='grocery'));
// accept -> tick -> complete
const slot=boardFor(p,600).find(s=>s.type==='grocery');
let a=acceptGig(p,slot.slot,600);assert(a.state.gigs.active);assert.equal(a.state.gigs.active.dueAt,660);
assert(acceptGig(a.state,slot.slot,600).error);assert(acceptGig(p,9,600).error);
assert(!boardFor(a.state,601).some(s=>s.slot===slot.slot&&s.window===slot.window));
assert(completeGig(a.state,601).error);
let s=a.state;const pl=s.gigs.active.places[0];
s=tickGig(s,{position:{x:pl.x+50,z:pl.z},room:'street',now:601});assert(!gigDone(s));
s=tickGig(s,{position:{x:pl.x,z:pl.z},room:'street',now:620});assert(gigDone(s));
const done=completeGig(s,620);assert.equal(done.paid,1200);assert.equal(done.state.cash,1200);assert.equal(done.state.gigs.rep,2);assert.equal(done.state.gigs.completed,1);assert.equal(done.state.gigs.active,null);assert.equal(done.state.gigs.recent.length,1);
assert(slot.client in done.state.gigs.clientsSeen);
// late grocery is quality 60, so 84% of base
const late=completeGig(s,700);assert.equal(late.paid,1008);
// rush: hard limit fails with rep -2 and no pay
const rp={...rich,gigs:{...rich.gigs,rep:5}},rs=boardFor({...p,gigs:{...p.gigs,rep:5}},0).find(x=>x.type==='rush');
if(rs){let q=acceptGig({...p,gigs:{...p.gigs,rep:5}},rs.slot,0).state;q=tickGig(q,{position:{x:99999,z:0},now:50});assert.equal(q.gigs.active,null);assert.equal(q.gigs.rep,3)}
assert.equal(failGig({...p,gigs:{...p.gigs,rep:1}}).gigs.rep,1);assert.equal(failGig({...p,gigs:{...p.gigs,rep:1,active:a.state.gigs.active}}).gigs.rep,0);
// round of three: any order
const q3={...p,gigs:{...p.gigs,rep:10,active:normalizeGigs({active:{type:'round',places:[{x:0,z:0},{x:20,z:0},{x:40,z:0}]}}).active}};
let t3=tickGig(q3,{position:{x:40,z:0}});assert.deepEqual(t3.gigs.active.visited,[false,false,true]);t3=tickGig(t3,{position:{x:0,z:0}});t3=tickGig(t3,{position:{x:20,z:0}});assert(gigDone(t3));
// sequential type keeps order
const q2={...p,gigs:{...p.gigs,active:normalizeGigs({active:{type:'chain',places:[{x:0,z:0},{x:20,z:0}]}}).active}};
assert.deepEqual(tickGig(q2,{position:{x:20,z:0}}).gigs.active.visited,[false,false]);
// knocks lower fragile pay
const fr=normalizeGigs({active:{type:'fragile',places:[{x:0,z:0}],knocks:2}});let fs={...p,gigs:{...fr}};fs=tickGig(fs,{position:{x:0,z:0},knock:1});assert.equal(completeGig(fs,100).quality,55);
assert.equal(gameMinutes({housing:{day:2},routine:{minutes:30}}),1470);
// parcel door: three greetings, exactly one is the client's and tips 200..800 cents; the hint names it
for(const c of ['a','b','c','d','e','f','g']){const ch=doorChoices({type:'parcel',client:c,id:3});assert.equal(ch.length,3);assert.equal(ch.filter(x=>x.tip>0).length,1);const t=ch.find(x=>x.tip>0);assert(t.tip>=200&&t.tip<=800&&t.tip%100===0);assert.equal(t.id,doorStyle(c).id);assert(doorHint('parcel',c,'Rob').includes(doorStyle(c).hint))}
assert.equal(doorChoices({type:'grocery',client:'a',id:1}),null);assert.equal(doorHint('grocery','a','x'),'');assert.equal(new Set(['a','b','c','d','e','f','g','h','i','j'].map(c=>doorStyle(c).id)).size,3,'all three styles occur');
const pa={...p,gigs:{...p.gigs,active:normalizeGigs({active:{type:'parcel',client:'a',id:3,places:[{x:0,z:0}]}}).active}};
const pd=tickGig(pa,{position:{x:0,z:0}}),right=doorChoices(pd.gigs.active).find(x=>x.tip>0);
assert.equal(completeGig(pd,100).paid,1000);assert.equal(completeGig(pd,100,{tip:right.tip}).paid,1000+right.tip);
// round quality: par distance or better is 100, 25% over is 80 (acceptGig keeps where you started)
const rs0={x:0,z:0},ra=normalizeGigs({active:{type:'round',places:[{x:10,z:0},{x:20,z:0},{x:30,z:0}],start:rs0}}).active;assert.deepEqual({x:ra.start.x,z:ra.start.z},rs0);
let rp3={...p,gigs:{...p.gigs,rep:10,active:ra}};for(const x of [10,20,30])rp3=tickGig(rp3,{position:{x,z:0},metres:10});
const par=parRoute(ra.places,ra.start).length;assert.equal(par,30);assert.equal(completeGig(rp3,100,{par}).quality,100);
let rp4={...rp3,gigs:{...rp3.gigs,active:{...rp3.gigs.active,metres:60}}};assert.equal(completeGig(rp4,100,{par}).quality,0);rp4.gigs.active.metres=37.5;assert.equal(completeGig(rp4,100,{par}).quality,80);
assert.equal(completeGig(rp4,100).quality,100,'no par given: no penalty');
console.log('gigs ok');