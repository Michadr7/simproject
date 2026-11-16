import assert from 'node:assert/strict';
import {DOOR_STYLES,doorStyle,doorTip,doorHint,doorChoices,GIG_TYPES,payFor,parRoute,normalizeGigs,boardFor,acceptGig,tickGig,completeGig,failGig,gigDone,freshGigs,qualityFor,gameMinutes,marketBoard,doneTodayOf,bumpDone,dayKey,noMoreWork,NO_MORE_WORK,starterBoard,pickUpGig,pickedUp,atPickup,onTimeLimit,limitFloor,STARTER_MIN_PAY_C,WORLD_SEED,normalizeActive,routeOf,repMulFor} from '../dist/gigs.js';
import {payFor as payGig,minElapsed,fatigueFactor,MIN_PAR_M,HANDLING_C,MAX_GIGS_PER_DAY,basePay} from '../dist/gig-pay.js';
import {acceptContract,availableContracts} from '../dist/gig-bridge.js';
import {freshProgress} from '../dist/jobs.js';
// payFor wrapper (typeId,quality,doneToday,rep,tip,large,parM): no parM = an old gig, the old flat base clamped to 3000; daily fatigue replaces the repeat steps; rep gives x1.4 only for large gigs
assert.equal(payFor('fragile',85,0,20),2550);assert.equal(payFor('bulk',100,0,0),3000,'old flat base is clamped');
assert.equal(payFor('grocery',100,0,0),1200);assert.equal(payFor('grocery',0,0,0),0);
assert.deepEqual([0,4,5,7,8,9,10,11].map(d=>payFor('grocery',100,d,0)),[1200,1200,840,840,480,480,0,0]);
assert.equal(payFor('grocery',100,0,60),payFor('grocery',100,0,100));assert.equal(payFor('grocery',100,0,60),1200,'no rep bonus any more');
assert.equal(payFor('grocery',100,0,60,0,true),1680,'large gigs keep x1.4');assert.equal(repMulFor(39,true),1);assert.equal(repMulFor(40,true),1.4);assert.equal(repMulFor(90,false),1);
assert.equal(payFor('grocery',100,0,0,0,false,400),Math.floor(basePay(null,'walk',400)),'with a par: gig-pay');assert.equal(payFor('grocery',100,5,0,0,false,400),Math.floor(basePay(null,'walk',400)*.7));
assert.equal(payFor('parcel',100,0,0,500),1500);assert.equal(payFor('parcel',100,0,0,99999),1800);assert.equal(payFor('parcel',100,0,0,0),1000);
assert(Number.isInteger(payFor('bulk',77,3,13)));assert.equal(payFor('nope',100,0,0),0);
assert.equal(qualityFor('fragile',{knocks:2}),70);assert.equal(qualityFor('fragile',{knocks:9}),40);assert.equal(qualityFor('rush',{late:true}),0);assert.equal(qualityFor('round',{overPct:25}),80);
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
// the accepted gig carries origin, ordered points, par, mode and the accept time (G-B)
const act=a.state.gigs.active;assert.deepEqual({x:act.origin.x,z:act.origin.z},{x:slot.origin.x,z:slot.origin.z});assert.equal(act.parM,slot.parM);assert(act.parM>=MIN_PAR_M.walk);assert.equal(act.acceptedAt,600);assert.equal(act.onTimeMin,onTimeLimit(act.parM));assert.equal(act.mode,'walk');assert.equal(act.pickedAt,null);assert.equal(act.points.length,1);assert(!pickedUp(act));
const okAt=600+Math.ceil(minElapsed(act.parM,'walk'))+1,expect=payGig({mode:'walk',parM:act.parM,quality:100,repMul:1,doneToday:0,generosity:0,onTime:true,elapsedMin:okAt-600});
const done=completeGig(s,okAt);assert(!done.tooFast);assert.equal(done.paid,expect.total);assert(done.paid>HANDLING_C.walk);assert.equal(done.state.cash,done.paid);assert.equal(done.state.gigs.rep,2);assert.equal(done.state.gigs.completed,1);assert.equal(done.state.gigs.doneToday,1);assert.equal(doneTodayOf(done.state.gigs,okAt),1);assert.equal(done.state.gigs.active,null);assert.equal(done.state.gigs.recent.length,1);
assert(slot.client in done.state.gigs.clientsSeen);
// finished at once (a teleport or an accept at the door): the handling fee only
const fast=completeGig(s,601);assert(fast.tooFast);assert.equal(fast.paid,HANDLING_C.walk);
// late grocery is quality 60 and pays no tip
const late=completeGig(s,700),lateExp=payGig({mode:'walk',parM:act.parM,quality:60,repMul:1,doneToday:0,onTime:false,elapsedMin:100});assert.equal(late.paid,lateExp.total);assert.equal(late.tip,0);
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
// ---- G-B: daily fatigue, hard stop, old saves, short routes, shared board, starter gigs, pickup ----
const mkActive=(o={})=>normalizeActive({id:5,type:'grocery',client:'cx',places:[{id:'h1',x:300,z:0}],visited:[true],stage:1,startedAt:0,acceptedAt:0,origin:{id:'o1',x:0,z:0},parM:400,points:[{x:300,z:0}],mode:'walk',onTimeMin:onTimeLimit(400),...o});
const NOON=720,DAY1=300; // game minute 720 = 12:00 on day 1; the game day starts at 05:00
// daily tiers through the real completeGig: 1st-5th full, 6th-8th 70%, 9th-10th 40%; each completion counts one
{let q={...p,gigs:{...p.gigs,active:null}};const paid=[];
 for(let n=0;n<MAX_GIGS_PER_DAY;n++){const now=NOON+100*n,r=completeGig({...q,gigs:{...q.gigs,active:mkActive({acceptedAt:now-60,startedAt:now-60})}},now);assert(!r.error&&!r.tooFast);paid.push(r.paid);q=r.state;assert.equal(doneTodayOf(q.gigs,now),n+1)}
 const full=paid[0],f=[1,1,1,1,1,.7,.7,.7,.4,.4];assert.deepEqual(paid,f.map(x=>Math.floor(basePay(null,'walk',400)*x)));assert(paid[5]<full&&paid[8]<paid[5]);
 // the hard stop at 10: no accept, no board, the bridge says so too
 const stop=NOON+1000;assert.equal(doneTodayOf(q.gigs,stop),10);assert(noMoreWork(q,stop));assert.deepEqual(boardFor(q,stop),[]);assert.deepEqual(availableContracts({...q,activeJob:null}),[]);
 assert.deepEqual(acceptGig(q,0,stop),{error:NO_MORE_WORK});assert.equal(NO_MORE_WORK,'No more work today.');
 // sleeping does not reset it; the game day key flips at 05:00 the next day, not at midnight
 assert.equal(dayKey(1440+299),0);assert.equal(dayKey(1440+300),1);assert.equal(doneTodayOf(q.gigs,1440+299),doneTodayOf(q.gigs,NOON+1000));assert.equal(doneTodayOf(q.gigs,1440+300),0);assert(!noMoreWork(q,1440+300));
 assert(boardFor(q,1440+400).length>0,'a new day: work again');
 // an unrelated old count (another day) is read as 0, and bumpDone starts again at 1
 assert.deepEqual(bumpDone({doneDay:0,doneToday:9},1440+400),{doneDay:1,doneToday:1});}
// fatigue values come from gig-pay itself
assert.deepEqual([0,5,8,10].map(fatigueFactor),[1,.7,.4,0]);
// old saves: no doneToday, no origin = picked up already, pays the old flat base (clamped), never "too fast"
{const g=normalizeGigs({rep:50,completed:7,active:{type:'bulk',client:'c',places:[{x:5,z:5}],startedAt:10,visited:[true],stage:1}});assert.equal(g.doneToday,0);assert.equal(g.doneDay,-2);assert.equal(doneTodayOf(g,NOON),0);assert.deepEqual(g.pairsSeen,{});
 assert.equal(g.active.origin,null);assert.equal(g.active.parM,null);assert(pickedUp(g.active));assert.equal(g.active.starter,false);assert.equal(g.active.acceptedAt,10);assert.equal(g.active.points.length,1);
 const r=completeGig({...p,gigs:g},11);assert.equal(r.paid,3000,'old bulk base 4500 clamped to 3000');assert(!r.tooFast);assert.equal(r.state.gigs.doneToday,1);
 const rt=JSON.parse(JSON.stringify(normalizeGigs({...g,doneToday:3,doneDay:2})));assert.equal(rt.doneToday,3);assert.equal(rt.doneDay,2);assert.deepEqual(normalizeGigs(rt),rt);
 assert.equal(normalizeGigs({doneToday:99999,doneDay:4}).doneToday,1000);assert.equal(normalizeGigs({doneToday:5}).doneToday,0,'a count with no day key is dropped');}
// the board drops routes shorter than MIN_PAR_M (walking 300 m) and keys on world data only
{let seen=0;for(let t=0;t<4000;t+=15)for(const s of boardFor(p,t)){seen++;assert(s.parM>=MIN_PAR_M.walk,'par '+s.parM);assert.equal(s.parM,routeOf(s.origin,s.places).parM);assert(s.origin&&s.points.length===s.places.length&&s.mode==='walk'&&s.starter===false)}assert(seen>50,'the board still has work: '+seen);
 const near={clients:[{id:'c1',name:'A',home:'h1'}],places:[{id:'h1',x:20,z:0,room:'street'},{id:'h2',x:40,z:0,room:'street'}],origins:[{id:'o',name:'O',x:0,z:0,room:'street'}]};
 assert.deepEqual(boardFor(p,600,near),[],'every route is short: nothing is offered');
 assert.equal(starterBoard(p,600,near).length>0,true,'starter gigs are exempt from the minimum');}
// the board is the same for every player in the world: g.completed, rep-independent hash, same slots
for(let t=0;t<3000;t+=61){const A=boardFor({...p,gigs:{...p.gigs,completed:0}},t),B=boardFor({...p,gigs:{...p.gigs,completed:57}},t);assert.deepEqual(A,B,'board at '+t)}
assert.equal(typeof WORLD_SEED,'number');
// pair rest: a finished pickup-to-drop pair is off the board for the rest of that day; one gig of each type at most
{const s0=boardFor(p,600)[0],pk=s0.pair,q=completeGig({...p,gigs:{...p.gigs,active:mkActive({origin:s0.origin,places:s0.places,points:s0.points,parM:s0.parM,type:s0.type,acceptedAt:300,startedAt:300,client:'zz'})}},700).state;
 assert(q.gigs.pairsSeen[pk]===0);for(let t=700;t<1440;t+=20)assert(boardFor(q,t).every(s=>s.pair!==pk),'pair rests at '+t);
 for(let t=0;t<2000;t+=40){const b=boardFor(p,t);assert.equal(new Set(b.map(s=>s.type)).size,b.length)}}
// on-time limit and the sprint floor on the type limits
assert.equal(onTimeLimit(300),Math.ceil(300/9*2+10));assert.equal(onTimeLimit(0),10);assert(limitFloor(335)>20,'a rush limit cannot undercut a sprint over the route');
{const rb=boardFor({...p,gigs:{...p.gigs}},0).find(x=>x.type==='rush');if(rb){const ra=acceptGig(p,rb.slot,0).state.gigs.active;assert(ra.dueAt>=limitFloor(ra.parM)&&ra.dueAt>=20)}}
// pickup: the box is picked up at the origin; the clocks start there; stops tick only after pickup when the game asks for it
{const sl=boardFor(p,600).find(x=>x.type==='grocery'),acc=acceptGig(p,sl.slot,600).state,ac=acc.gigs.active;
 assert(atPickup(ac,{x:sl.origin.x+1,z:sl.origin.z},'street')&&!atPickup(ac,{x:sl.origin.x+9,z:sl.origin.z},'street'));
 const stop=ac.places[0],noPick=tickGig(acc,{position:{x:stop.x,z:stop.z},requirePickup:true,now:601});assert(!gigDone(noPick),'no pickup, no delivery');
 assert(gigDone(tickGig(acc,{position:{x:stop.x,z:stop.z},now:601})),'default stays as before (the game opts in)');
 const pk=pickUpGig(acc,650).state;assert.equal(pk.gigs.active.pickedAt,650);assert(pickedUp(pk.gigs.active));assert(pickUpGig(pk,651).error);assert(!atPickup(pk.gigs.active,sl.origin,'street'));
 const fin=tickGig(pk,{position:{x:stop.x,z:stop.z},requirePickup:true,now:651});assert(gigDone(fin));
 assert(completeGig(fin,651).tooFast,'accepted long ago but picked up one minute ago: too fast');assert(!completeGig(fin,650+Math.ceil(minElapsed(ac.parM,'walk'))+1).tooFast);
 assert(pickUpGig(p,1).error);}
// starter gigs: exempt from minimum par and fatigue (also at the hard stop), not counted, still pay sensibly (at least $25) and never "too fast"
{const stopped={...p,gigs:{...p.gigs,doneToday:10,doneDay:dayKey(600)}};assert(noMoreWork(stopped,600));
 const sb=starterBoard(stopped,600);assert(sb.length>=1&&sb.every(s=>s.starter&&['grocery','parcel'].includes(s.type)));
 assert(acceptGig(stopped,sb[0].slot,600).error,'a normal accept is refused at the stop');
 const ok=acceptGig(stopped,sb[0].slot,600,undefined,null,{starter:true});assert.equal(ok.error,undefined);assert.equal(ok.state.gigs.active.starter,true);
 let sst=ok.state;for(const pl of sst.gigs.active.places)sst=tickGig(sst,{position:{x:pl.x,z:pl.z},now:601});const fin=completeGig(sst,601);assert(!fin.tooFast);assert(fin.paid>=STARTER_MIN_PAY_C);assert.equal(fin.state.gigs.doneToday,10,'a starter gig does not count');assert.equal(fin.state.gigs.completed,1);
 const viaBridge=acceptContract(stopped,'slot-'+sb[0].slot,null,{starter:true});assert(viaBridge.state&&viaBridge.state.gigs.active.starter);assert.equal(acceptContract(stopped,'slot-0').error,NO_MORE_WORK);}
console.log('gigs ok');