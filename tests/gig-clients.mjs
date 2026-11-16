// G-C: gig clients (notes/gig-overhaul-design.md): profile, complications, regulars, tiers, save normalizing.
import assert from 'node:assert/strict';
import {clientProfile,complicationFor,normalizeStats,regularState,nextRequestDue,recordGig,regularRequests,regularPayMul,tierOfRep,allowedTypes,
 COMPLICATION_RATE,REGULAR_AFTER,REQUEST_EVERY_DAYS,DAY_MINUTES,HAL_ID,REGULAR_PAY_MUL,NOT_HOME_PAY_MUL,SIGNATURE_MINUTE}from '../dist/gig-clients.js';

// profile: deterministic, 0-3, Hal fixed generous, all four levels occur
for(let i=0;i<50;i++){const a=clientProfile('c'+i,7),b=clientProfile('c'+i,7);assert.deepEqual(a,b);assert.ok(a.generosity>=0&&a.generosity<=3&&typeof a.mood==='string'&&a.mood.length>0)}
assert.equal(clientProfile(HAL_ID,1).generosity,3);assert.equal(clientProfile(HAL_ID,999).generosity,3);
assert.equal(new Set(Array.from({length:200},(_,i)=>clientProfile('c'+i,3).generosity)).size,4);
// complications: deterministic, rate in a sane band, starters never, kinds and fields
let hits=0;const kinds={};
for(let i=0;i<2000;i++){
 const a=complicationFor('g'+i,3,'parcel',11),b=complicationFor('g'+i,3,'parcel',11);assert.deepEqual(a,b);
 assert.equal(complicationFor('g'+i,3,'parcel',11,true),null);
 if(a){hits++;kinds[a.kind]=(kinds[a.kind]||0)+1;assert.ok(typeof a.text==='string'&&a.text.length>0&&Number.isFinite(a.payMul));
  if(a.kind==='not-home'){assert.equal(a.payMul,NOT_HOME_PAY_MUL);assert.ok(a.extraStop)}
  if(a.kind==='wrong-item')assert.ok(a.returnToPickup&&a.payMul===1);
  if(a.kind==='signature')assert.equal(a.earliestMinute,3*DAY_MINUTES+SIGNATURE_MINUTE)}
}
assert.ok(hits>=2000*COMPLICATION_RATE*.8&&hits<=2000*COMPLICATION_RATE*1.2,`rate ${hits}/2000`);
assert.deepEqual(Object.keys(kinds).sort(),['not-home','signature','wrong-item']);
// regulars: 3 good gigs, not 2; quality 79 does not count; no mutation
const s0=Object.freeze({});
let s=recordGig(s0,'amy',90,100);s=recordGig(s,'amy',80,200);
assert.ok(!regularState(s).amy.regular);
const snap=JSON.stringify(s),s3=recordGig(s,'amy',95,300);
assert.equal(JSON.stringify(s),snap);assert.notEqual(s3,s);assert.deepEqual(s0,{});
assert.ok(regularState(s3).amy.regular&&s3.amy.good===REGULAR_AFTER);
assert.equal(recordGig(s,'amy',79,300).amy.good,2);
assert.equal(recordGig(s,'amy',79,300).amy.last,300);
// request every 3 days
assert.ok(!nextRequestDue(s.amy,1e6)); // not regular
assert.ok(!nextRequestDue(s3.amy,300+REQUEST_EVERY_DAYS*DAY_MINUTES-1)&&nextRequestDue(s3.amy,300+REQUEST_EVERY_DAYS*DAY_MINUTES));
assert.deepEqual(regularRequests(s3,300+REQUEST_EVERY_DAYS*DAY_MINUTES),['amy']);
assert.deepEqual(regularRequests(s3,400),[]);
// Hal: offered once the starter is done, not before
assert.deepEqual(regularRequests({},0,{starterDone:false}),[]);
assert.deepEqual(regularRequests({},0,{starterDone:true}),[HAL_ID]);
assert.equal(regularRequests(recordGig({},HAL_ID,90,1000),1001,{starterDone:true}).length,0);
assert.equal(regularPayMul(s3,'amy'),REGULAR_PAY_MUL);assert.equal(regularPayMul(s,'amy'),1);assert.equal(regularPayMul({},HAL_ID,{starterDone:true}),REGULAR_PAY_MUL);
// tiers
for(const [r,t] of [[0,'newcomer'],[9,'newcomer'],[10,'known'],[24,'known'],[25,'trusted'],[39,'trusted'],[40,'regular'],[100,'regular'],[-5,'newcomer'],[NaN,'newcomer'],[undefined,'newcomer']])assert.equal(tierOfRep(r),t,`rep ${r}`);
assert.deepEqual(allowedTypes('newcomer'),['grocery','parcel']);
assert.ok(allowedTypes('known').includes('round')&&allowedTypes('known').includes('cafe')&&allowedTypes('known').includes('laundry')&&!allowedTypes('known').includes('chain'));
assert.ok(allowedTypes('trusted').includes('chain')&&allowedTypes('trusted').includes('round'));
assert.deepEqual(allowedTypes('regular'),allowedTypes('trusted'));
assert.deepEqual(allowedTypes('nonsense'),['grocery','parcel']);
// saves normalize garbage
for(const bad of [null,undefined,5,'x',[],[1,2],true])assert.deepEqual(normalizeStats(bad),{});
const n=normalizeStats({a:{good:'7',last:-4},b:{good:2.9,last:50.7},c:null,d:5,'':{good:1},__proto__:{x:1},e:{good:1e12,last:1e12}});
assert.deepEqual(n.a,{good:0,last:0});assert.deepEqual(n.b,{good:2,last:50});assert.equal(n.c,undefined);assert.equal(n.d,undefined);assert.equal(n.e.good,1e6);assert.equal(n.e.last,1e9);
assert.equal(Object.keys(normalizeStats(Object.fromEntries(Array.from({length:200},(_,i)=>['k'+i,{good:1,last:1}])))).length,60);
assert.deepEqual(normalizeStats(JSON.parse(JSON.stringify(s3))),s3);
assert.deepEqual(recordGig('junk','bob',100,5),{bob:{good:1,last:5}});
console.log('PASS gig-clients: profile, complications, regulars, tiers, save normalizing');
