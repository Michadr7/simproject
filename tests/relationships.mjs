// Regression tests for dist/relationships.js (Relationship Meter, Gemma Atkins, male-gated romance, and save normalization).
import assert from 'node:assert/strict';
import {
 FRIENDSHIP_MAX,ROMANCE_MAX,GEMMA_ID,GEMMA_PROFILE,ROMANCE_UNLOCK_FRIENDSHIP,DATE_REQ,PARTNER_REQ,
 normalizeRelationships,friendshipTierOf,romanceTierOf,canRomanceNpc,relationshipOf,
 meetRelationship,recordFriendlyChat,recordRelationshipGift,recordRomanticAction,recordShopPurchaseBond,
 gemmaGreeting,relationshipMeterSpec
} from '../dist/relationships.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {addItem} from '../dist/inventory.js';

// 1. Friendship tiers across 0-100
assert.equal(friendshipTierOf(0).label,'Stranger');
assert.equal(friendshipTierOf(5).label,'Acquaintance');
assert.equal(friendshipTierOf(20).label,'Friend');
assert.equal(friendshipTierOf(50).label,'Close Friend');
assert.equal(friendshipTierOf(80).label,'Best Friend');
assert.equal(friendshipTierOf(FRIENDSHIP_MAX).pct,100);

// 2. Gemma Atkins romance eligibility (male only) and unlock at Friend (20+)
assert.equal(GEMMA_PROFILE.name,'Gemma Atkins');
assert.equal(canRomanceNpc(GEMMA_ID,'male'),true);
assert.equal(canRomanceNpc(GEMMA_ID,'female'),false);

let p=freshProgress();
p={...p,cash:20000};
p=meetRelationship(p,GEMMA_ID,1);
let relM=relationshipOf(p,GEMMA_ID,'male',1);
let relF=relationshipOf(p,GEMMA_ID,'female',1);
assert.equal(relM.met,true);
assert.equal(relM.romanceEligible,true);
assert.equal(relM.romanceUnlocked,false,'Romance locked until Friend (20)');
assert.equal(relF.romanceEligible,false,'Female player stays strictly friendship');
assert.equal(relF.romanceUnlocked,false);

// 3. Female player can befriend Gemma to Best Friend, cannot trigger romantic actions
let pFem=p;
for(let i=0;i<5;i++){pFem=addItem(pFem,'bouquet').state;pFem=recordRelationshipGift(pFem,GEMMA_ID,'bouquet',i+1,'female').state}
const femRel=relationshipOf(pFem,GEMMA_ID,'female',10);
assert(femRel.points>=40,'Female player gains full friendship points with Gemma');
assert.equal(femRel.romanceUnlocked,false,'Female player never unlocks romance track');
assert.ok(recordRomanticAction(pFem,GEMMA_ID,'compliment',10,'female').error);

// 4. Male player progresses Gemma from Acquaintance -> Friend -> Dating -> Partner
let pm=p;
pm=addItem(pm,'bouquet').state;
pm=addItem(pm,'bouquet').state;
pm=addItem(pm,'coffee').state;
pm=addItem(pm,'flour-bag').state;
pm=addItem(pm,'apple').state;

// Chat daily cap (+2 once/day)
let chat1=recordFriendlyChat(pm,GEMMA_ID,1,'male');
assert.equal(chat1.gained,2);pm=chat1.state;
let chat2=recordFriendlyChat(pm,GEMMA_ID,1,'male');
assert.equal(chat2.gained,0,'Second chat same day gains 0 friendship');
pm=recordShopPurchaseBond(pm,GEMMA_ID,1).state;
assert.equal(relationshipOf(pm,GEMMA_ID,'male',1).points,3);

// Build across multiple days up to Dating and Partner
for(let day=2;day<=8;day++){
 pm=recordFriendlyChat(pm,GEMMA_ID,day,'male').state;
 pm=recordShopPurchaseBond(pm,GEMMA_ID,day).state;
 if(day<=6){
  const gId=day===2?'bouquet':day===3?'bouquet':day===4?'coffee':day===5?'flour-bag':'apple';
  const gr=recordRelationshipGift(pm,GEMMA_ID,gId,day,'male');
  assert(!gr.error,gr.error);pm=gr.state;
 }
 const rCheck=relationshipOf(pm,GEMMA_ID,'male',day);
 if(rCheck.romanceUnlocked){
  const c1=recordRomanticAction(pm,GEMMA_ID,'compliment',day,'male');
  if(!c1.error)pm=c1.state;
  const h1=recordRomanticAction(pm,GEMMA_ID,'hangout',day,'male');
  if(!h1.error)pm=h1.state;
 }
}
relM=relationshipOf(pm,GEMMA_ID,'male',8);
assert(relM.points>=DATE_REQ.friendship,'Reached Dating friendship threshold: '+relM.points);
assert(relM.romanceUnlocked===true&&relM.canAskDate===true,'Ready to ask Gemma on a date');
assert.ok(recordRomanticAction(pm,GEMMA_ID,'compliment',8,'male').error,'Daily compliment cap enforced');

const dated=recordRomanticAction(pm,GEMMA_ID,'ask-date',9,'male');
assert(!dated.error);pm=dated.state;
assert.equal(relationshipOf(pm,GEMMA_ID,'male',9).status,'dating');

for(let day=9;day<=12;day++){
 const c=recordRomanticAction(pm,GEMMA_ID,'compliment',day,'male');if(!c.error)pm=c.state;
 const h=recordRomanticAction(pm,GEMMA_ID,'hangout',day,'male');if(!h.error){assert.equal(h.costCents,0,'Dating hangout is free');pm=h.state}
}
relM=relationshipOf(pm,GEMMA_ID,'male',12);
assert(relM.points>=PARTNER_REQ.friendship&&relM.romance>=PARTNER_REQ.romance,'Ready for Partner milestone');
const partnered=recordRomanticAction(pm,GEMMA_ID,'ask-partner',13,'male');
assert(!partnered.error);pm=partnered.state;
relM=relationshipOf(pm,GEMMA_ID,'male',13);
assert.equal(relM.status,'partner');
assert.equal(relM.perkAvailable,true);
assert.match(gemmaGreeting(relM,'male'),/partner/i);

const perkRes=recordRomanticAction(pm,GEMMA_ID,'bakery-perk',13,'male');
assert(!perkRes.error&&perkRes.warmBoost>0);
assert.ok(recordRomanticAction(perkRes.state,GEMMA_ID,'bakery-perk',13,'male').error,'Partner daily treat 1/day');

// 5. Meter spec and save round-trip
const spec=relationshipMeterSpec(relM);
assert.equal(spec.romanceUnlocked,true);
assert(spec.friendPct>=50&&spec.romancePct>=70);
const saved=normalizeProgress(JSON.parse(JSON.stringify(pm)));
assert.equal(saved.relationships[GEMMA_ID].status,'partner');
assert.equal(saved.relationships[GEMMA_ID].points,relM.points);
assert.deepEqual(normalizeRelationships({__proto__:{bad:1},constructor:{bad:1}}),{});

console.log('PASS relationships: tiers, Gemma Atkins male romance gating/milestones/perks, daily caps, meter spec, and save round-trip.');
