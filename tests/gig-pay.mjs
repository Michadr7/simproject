// G-A: gig pay rules (notes/gig-overhaul-design.md): par, fair wage, fatigue, tip cap, too-fast, integer cents, determinism.
import assert from 'node:assert/strict';
import {parMetres,meetsMinPar,centsPerMetre,basePay,fatigueFactor,canTakeMore,minElapsed,tipFor,payFor,
 MIN_PAR_M,PAR_SLACK,TARGET_C_PER_GAME_MIN,HANDLING_C,WALK_M_PER_GAME_MIN,FASTEST_M_PER_GAME_MIN,TIP_CAP_PCT,MAX_GIGS_PER_DAY}from '../dist/gig-pay.js';

// pin the game constants the pay depends on (UNVERIFIED in the design): 0.5 game min per real second, walk 4.5 m/s
assert.equal(WALK_M_PER_GAME_MIN,9);
// par: straight 100 m with slack, ordered path adds legs, 15 m is below the minimum
assert.equal(parMetres([{x:0,z:0},{x:100,z:0}]),Math.ceil(100*PAR_SLACK));
assert.equal(parMetres([{x:0,z:0},{x:30,z:40},{x:30,z:90}]),Math.ceil(100*PAR_SLACK));
assert.equal(parMetres([]),0);
assert.ok(parMetres([{x:0,z:0},{x:15,z:0}])<MIN_PAR_M.walk&&!meetsMinPar(parMetres([{x:0,z:0},{x:15,z:0}]),'walk'));
assert.equal(MIN_PAR_M.walk,300);assert.ok(!meetsMinPar(150,'walk')&&!meetsMinPar(299,'walk')&&meetsMinPar(300,'walk')&&!meetsMinPar(499,'vehicle')&&meetsMinPar(500,'vehicle'));
assert.equal(FASTEST_M_PER_GAME_MIN.vehicle,58,'fastest vehicle 29 m/s (vehicle.js:30 shortbed top)');
// rates
assert.ok(Math.abs(centsPerMetre('walk')*WALK_M_PER_GAME_MIN-TARGET_C_PER_GAME_MIN.walk)<1e-9);
assert.ok(basePay(null,'walk',150)>HANDLING_C.walk&&basePay(null,'vehicle',500)>HANDLING_C.vehicle);
// fair wage: back-to-back full-pay walking gigs at the minimum distance for a game hour stay inside the rank 1-3 job range (800-1800 c/h)
{const m=MIN_PAR_M.walk,t=m/WALK_M_PER_GAME_MIN,n=60/t,one=payFor({mode:'walk',parM:m,quality:100,repMul:1,doneToday:0,generosity:0,onTime:true,elapsedMin:t});
 const perHour=one.pay*n;assert.ok(perHour<=1800&&perHour>=800,`walk wage ${perHour}`);
 // long routes converge to the target (20 c per game minute = 1200 c/h) plus handling
 const far=2000,tf=far/WALK_M_PER_GAME_MIN,pf=payFor({mode:'walk',parM:far,quality:100,doneToday:0}).pay;assert.ok(pf/tf*60<1500)}
// fatigue tiers and the hard stop
const f=Array.from({length:12},(_,i)=>fatigueFactor(i));
assert.deepEqual(f,[1,1,1,1,1,.7,.7,.7,.4,.4,0,0]);
assert.ok(canTakeMore(9)&&!canTakeMore(MAX_GIGS_PER_DAY)&&!canTakeMore(11));
assert.equal(payFor({mode:'walk',parM:300,doneToday:10}).pay,0);
assert.ok(payFor({mode:'walk',parM:300,doneToday:5}).pay<payFor({mode:'walk',parM:300,doneToday:4}).pay);
// tip: needs on time, generosity x band, cap 25%
assert.equal(tipFor(1000,3,100,false),0);
assert.equal(tipFor(1000,0,100,true),0);
assert.equal(tipFor(1000,1,100,true),100);
assert.equal(tipFor(1000,1,75,true),50);
assert.equal(tipFor(1000,3,60,true),0);
assert.equal(tipFor(1000,3,100,true),250);
for(let g=0;g<=9;g++)for(const q of [0,69,70,89,90,100])assert.ok(tipFor(777,g,q,true)<=Math.floor(777*TIP_CAP_PCT/100));
// too fast (a 400 m route finished in 5 game minutes): handling only, no tip
{const parM=400,slow=payFor({mode:'walk',parM,quality:100,doneToday:0,generosity:3,onTime:true,elapsedMin:minElapsed(parM,'walk')+1}),
 fast=payFor({mode:'walk',parM,quality:100,doneToday:0,generosity:3,onTime:true,elapsedMin:5});
 assert.ok(minElapsed(parM,'walk')>5&&!slow.tooFast&&fast.tooFast);assert.equal(fast.pay,HANDLING_C.walk);assert.equal(fast.tip,0);assert.ok(slow.total>fast.total)}
// integer cents everywhere, deterministic
const seen=[];
for(const mode of ['walk','vehicle'])for(const parM of [0,151,333,777,1500])for(const q of [0,55,83,100])for(const d of [0,5,8,10])for(const rep of [1,1.15,1.4]){
 const o={mode,parM,quality:q,repMul:rep,doneToday:d,generosity:2,onTime:true,elapsedMin:1e6},a=payFor(o),b=payFor({...o});
 assert.deepEqual(a,b);for(const k of ['base','pay','tip','total'])assert.ok(Number.isSafeInteger(a[k])&&a[k]>=0,`${k} ${a[k]}`);assert.equal(a.total,a.pay+a.tip);seen.push(a.total)}
assert.ok(seen.length>100);
console.log('PASS gig-pay: par, wage, fatigue, tip cap, too-fast, integer cents');
