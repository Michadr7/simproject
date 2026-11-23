// BZ3 Freight Exchange & BZ7 harbor gigs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshProgress} from '../dist/jobs.js';
import {normalizeSkills} from '../dist/skills.js';
import {
 BRUCE_FEE_RATE,FREIGHT_REACH,FREIGHT_HUBS,HARBOR_GIGS,
 freightOffers,normalizeFreight,acceptFreight,loadFreight,deliverFreight,cancelFreight,
 startHarborGig,stepHarborGig,cancelHarborGig
} from '../dist/freight.js';

const prog=(extra={})=>({...freshProgress(),...extra});

// 1. Constants & FREIGHT_HUBS
assert.equal(BRUCE_FEE_RATE,0.12);
assert.equal(FREIGHT_REACH,14);
assert.deepEqual(Object.keys(FREIGHT_HUBS),['eden-industries','kaspian-harbor','eastbank-exchange','ridgeline-timber','husky-ranch','ironwood-shops']);
assert.equal(FREIGHT_HUBS['eden-industries'].bruce,true);
assert.equal(FREIGHT_HUBS['kaspian-harbor'].bruce,true);
for(const id of ['eastbank-exchange','ridgeline-timber','husky-ranch','ironwood-shops'])assert.equal(FREIGHT_HUBS[id].bruce,false);

// 2. Deterministic freightOffers + Bruce 12% fee vs 0% fee
const d1a=freightOffers(1),d1b=freightOffers(),d2=freightOffers(2);
assert.equal(d1a.length,4);
assert.deepEqual(d1a,d1b,'freightOffers(1) matches default and is deterministic');
assert.notDeepEqual(d1a,d2,'different days rotate contracts');
for(const offers of [d1a,d2,freightOffers(3),freightOffers(4)]){
 assert.equal(offers.length,4);
 const bruce=offers.filter(o=>FREIGHT_HUBS[o.fromHub].bruce||FREIGHT_HUBS[o.toHub].bruce);
 const free=offers.filter(o=>!FREIGHT_HUBS[o.fromHub].bruce&&!FREIGHT_HUBS[o.toHub].bruce);
 assert(bruce.length>=1&&free.length>=1,'every day covers both Bruce-fee and non-Bruce hauls');
 assert(bruce.some(o=>o.fromHub==='eden-industries'||o.toHub==='eden-industries'),'covers Eden Industries');
 assert(bruce.some(o=>o.fromHub==='kaspian-harbor'||o.toHub==='kaspian-harbor'),'covers Kaspian Harbor');
 for(const o of offers){
  assert.notEqual(o.fromHub,o.toHub);
  assert(Number.isSafeInteger(o.distanceM)&&o.distanceM>0);
  const expectedFee=FREIGHT_HUBS[o.fromHub].bruce||FREIGHT_HUBS[o.toHub].bruce?Math.round(o.payCents*BRUCE_FEE_RATE):0;
  assert.equal(o.bruceFeeCents,expectedFee);
  assert.equal(o.netPayCents,o.payCents-expectedFee);
  assert(Number.isSafeInteger(o.xp)&&o.xp>0);
 }
}
assert.deepEqual(freightOffers(0),d1a,'invalid day falls back to day 1');

// 3. Accept -> Load -> Deliver with range gates, 12% Bruce fee vs 0% fee, driving XP, standing & routine.earned
{
 const bruceOffer=d1a.find(o=>o.bruceFeeCents>0);
 const freeOffer=d1a.find(o=>o.bruceFeeCents===0);
 assert(bruceOffer&&freeOffer);

 const p0=prog({cash:500});
 assert(loadFreight(p0,{x:0,z:0}).error,'cannot load without contract');
 assert(deliverFreight(p0,{x:0,z:0}).error,'cannot deliver without contract');
 assert(acceptFreight(p0,'nonexistent').error,'rejects unknown offer');

 const a1=acceptFreight(p0,bruceOffer.id);
 assert(!a1.error,a1.error);
 assert.equal(p0.freight,undefined,'input progress not mutated');
 assert(acceptFreight(a1.state,freeOffer.id).error,'blocks accepting second active contract');
 assert(deliverFreight(a1.state,FREIGHT_HUBS[bruceOffer.toHub]).error,'cannot deliver before loading');

 const from=FREIGHT_HUBS[bruceOffer.fromHub],to=FREIGHT_HUBS[bruceOffer.toHub];
 assert(loadFreight(a1.state,{x:from.x+FREIGHT_REACH+0.1,z:from.z}).error,'load refuses outside FREIGHT_REACH');
 const l1=loadFreight(a1.state,{x:from.x+FREIGHT_REACH,z:from.z});
 assert(!l1.error,l1.error);
 assert.equal(l1.state.freight.active.loaded,true);
 assert(loadFreight(l1.state,from).error,'cannot load twice');

 assert(deliverFreight(l1.state,{x:to.x,z:to.z+FREIGHT_REACH+0.1}).error,'deliver refuses outside FREIGHT_REACH');
 const del1=deliverFreight(l1.state,{x:to.x,z:to.z-FREIGHT_REACH});
 assert(!del1.error,del1.error);
 assert.equal(del1.paid,bruceOffer.netPayCents);
 assert.equal(del1.bruceFeeCents,bruceOffer.bruceFeeCents);
 assert.equal(del1.state.cash,500+bruceOffer.netPayCents);
 assert.equal(del1.state.routine.earned,bruceOffer.netPayCents);
 assert.equal(del1.state.standing.town,1);
 assert.equal(del1.state.skills.driving.xp,bruceOffer.xp);
 assert.equal(normalizeSkills(del1.state.skills).driving.xp,bruceOffer.xp,'driving XP persists in normalizeSkills');
 assert.equal(del1.state.freight.active,null);
 assert.equal(del1.state.freight.doneCount,1);
 assert.deepEqual(del1.state.freight.completedIds,[bruceOffer.id]);
 assert(acceptFreight(del1.state,bruceOffer.id).error,'cannot repeat same offer on same day');

 // Non-Bruce haul pays 100% (0% fee)
 const a2=acceptFreight(del1.state,freeOffer.id);
 assert(!a2.error,a2.error);
 const l2=loadFreight(a2.state,FREIGHT_HUBS[freeOffer.fromHub]);
 const del2=deliverFreight(l2.state,FREIGHT_HUBS[freeOffer.toHub]);
 assert(!del2.error,del2.error);
 assert.equal(del2.bruceFeeCents,0);
 assert.equal(del2.paid,freeOffer.payCents);
 assert.equal(del2.state.cash,500+bruceOffer.netPayCents+freeOffer.payCents);
 assert.equal(del2.state.routine.earned,bruceOffer.netPayCents+freeOffer.payCents);
 assert.equal(del2.state.standing.town,2);
 assert.equal(del2.state.skills.driving.xp,bruceOffer.xp+freeOffer.xp);
 assert.equal(del2.state.freight.doneCount,2);

 // Day rollover clears completedIds while keeping doneCount
 const nextDay={...del2.state,housing:{...del2.state.housing,day:2}};
 const a3=acceptFreight(nextDay,d2[0].id);
 assert(!a3.error,a3.error);
 assert.deepEqual(a3.state.freight.completedIds,[]);
 assert.equal(a3.state.freight.doneCount,2);
 assert.equal(a3.state.freight.day,2);

 // Cancel resets active and frees offer when not completed
 const c0=acceptFreight(p0,freeOffer.id).state;
 const cancelled=cancelFreight(c0);
 assert(!cancelled.error);
 assert.equal(cancelled.state.freight,null,'cancelling with no history returns freight to null');
 assert(!acceptFreight(cancelled.state,freeOffer.id).error,'cancelled offer can be accepted again');
 assert(cancelFreight(p0).error,'cannot cancel without active contract');
}

// 4. All 5 BZ7 HARBOR_GIGS & dawn hours enforcement
assert.deepEqual(HARBOR_GIGS.map(g=>g.id),['ferry-deckhand','fish-porter','boat-recovery','bay-tour','container-spotter']);
const fishGig=HARBOR_GIGS.find(g=>g.id==='fish-porter');
assert.deepEqual(fishGig.hours,[300,720]);

{
 const beforeDawn=prog({routine:{minutes:299,earned:0,shiftStep:0,shiftDay:0}});
 const atClose=prog({routine:{minutes:720,earned:0,shiftStep:0,shiftDay:0}});
 assert(startHarborGig(beforeDawn,'fish-porter').error,'fish-porter refuses at 4:59 AM');
 assert(startHarborGig(atClose,'fish-porter').error,'fish-porter refuses at 12:00 PM');
 assert(startHarborGig(beforeDawn,'unknown-gig').error,'rejects unknown harbor gig');

 for(const gig of HARBOR_GIGS){
  let p=prog({cash:100,routine:{minutes:360,earned:0,shiftStep:0,shiftDay:0},life:{food:100,thirst:100,energy:100,groceries:0}});
  const s=startHarborGig(p,gig.id);
  assert(!s.error,`${gig.id} starts at 6:00 AM`);
  p=s.state;
  assert(startHarborGig(p,'ferry-deckhand').error,'blocks starting second harbor gig while active');

  for(let step=1;step<=gig.steps;step++){
   const prevMin=p.routine.minutes,prevEnergy=p.life.energy,prevCash=p.cash,prevEarned=p.routine.earned;
   const r=stepHarborGig(p);
   assert(!r.error,`${gig.id} step ${step} succeeds`);
   p=r.state;
   const isLast=step===gig.steps;
   const expectedPay=gig.payPerStep+(isLast?gig.bonusCents:0);
   assert.equal(r.paid,expectedPay);
   assert.equal(r.completed,isLast);
   assert.equal(p.cash,prevCash+expectedPay);
   assert.equal(p.routine.earned,prevEarned+expectedPay);
   assert.equal(p.routine.minutes,prevMin+15,'+15 min per step');
   assert.equal(p.life.energy,Math.max(0,prevEnergy-5),'-5 energy per step');
   assert.equal(p.skills[gig.xpSkill].xp,step*gig.xpPerStep);
   assert.equal(normalizeSkills(p.skills)[gig.xpSkill].xp,step*gig.xpPerStep,'xpSkill persists in normalizeSkills');
   if(!isLast){
    assert.equal(p.freight.harborGig.step,step);
    assert.equal(p.standing.town,undefined);
   }else{
    assert.equal(p.freight,null,'cleared on completion when no freight history');
    assert.equal(p.standing.town,1,'+1 town standing on completion');
   }
  }
 }

 // Energy clamps >= 0 and cancelHarborGig works cleanly
 let low=startHarborGig(prog({routine:{minutes:360,earned:0,shiftStep:0,shiftDay:0},life:{food:100,thirst:100,energy:2,groceries:0}}),'boat-recovery').state;
 low=stepHarborGig(low).state;
 assert.equal(low.life.energy,0,'energy clamped >= 0');
 const ch=cancelHarborGig(low);
 assert(!ch.error);
 assert.equal(ch.state.freight,null);
 assert(cancelHarborGig(ch.state).error,'cannot cancel when no active harbor gig');
}

// 5. normalizeFreight validation & JSON round-trip
{
 for(const empty of [null,undefined,[],'str',42,{},{active:null,completedIds:[],day:1,doneCount:0,harborGig:null},{doneCount:-1},{doneCount:1.5},{doneCount:'2'}]){
  assert.equal(normalizeFreight(empty),null,`empty/bad returns null: ${JSON.stringify(empty)}`);
 }
 // Corrupt active or harborGig dropped
 const badFee={...d1a[0],bruceFeeCents:0,netPayCents:d1a[0].payCents}; // Bruce haul with tampered 0 fee
 assert.equal(normalizeFreight({active:badFee,day:1,doneCount:0}),null,'tampered Bruce fee rejected');
 assert.equal(normalizeFreight({active:{...d1a[0],fromHub:'nowhere'},day:1}),null,'unknown hub rejected');
 assert.equal(normalizeFreight({active:{...d1a[0],toHub:d1a[0].fromHub},day:1}),null,'same hub rejected');
 assert.equal(normalizeFreight({harborGig:{id:'ferry-deckhand',step:4},day:1}),null,'out-of-range harbor step rejected');
 assert.equal(normalizeFreight({harborGig:{id:'ferry-deckhand',step:1.5},day:1}),null,'non-integer harbor step rejected');
 assert.equal(normalizeFreight({harborGig:{id:'nope',step:0},day:1}),null,'unknown harbor gig rejected');

 // Valid JSON round-trip preserves active freight, harbor gig, completedIds, doneCount
 let p=acceptFreight(prog(),d1a[0].id).state;
 p=loadFreight(p,FREIGHT_HUBS[d1a[0].fromHub]).state;
 p=startHarborGig(p,'bay-tour').state;
 p=stepHarborGig(p).state;
 const cloned=JSON.parse(JSON.stringify(p.freight));
 assert.deepEqual(normalizeFreight(cloned),p.freight,'full state survives JSON round-trip');
}

// 6. Purity check (no DOM, clock, random, or UI/game imports)
{
 const src=fs.readFileSync(new URL('../dist/freight.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'freight.js must not use '+bad);
 assert(!/from '\.\/(game|driving|phone)/.test(src));
}

console.log(`PASS freight: ${Object.keys(FREIGHT_HUBS).length} hubs, 4 daily contracts (Bruce ${Math.round(BRUCE_FEE_RATE*100)}% vs 0% fee), ${FREIGHT_REACH} m reach, ${HARBOR_GIGS.length} harbor gigs (dawn fish-porter ${fishGig.hours[0]}-${fishGig.hours[1]}), normalizeFreight & purity.`);
