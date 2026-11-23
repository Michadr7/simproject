// Unit tests for dist/npc-relations.js (unified standing, gifting, discounts, and personal favors).
import assert from 'node:assert/strict';
import {GIFT_ITEMS,FAVOR_TEMPLATES,normalizeCrowdLife,npcStandingOf,npcTierOf,discountFor,giftReaction,giveNpcGift,chatCrowdNpc,offerFavor,completeFavor,venuePatrons} from '../dist/npc-relations.js';
import {normalizeProgress} from '../dist/jobs.js';
import {addItem} from '../dist/inventory.js';
import {townPopulation} from '../dist/population.js';

let p=normalizeProgress({cash:5000});
assert.equal(GIFT_ITEMS.length,10);
assert.equal(FAVOR_TEMPLATES.length,6);
assert.equal(discountFor(0),1);
assert.equal(discountFor(5),.95);
assert.equal(discountFor(20),.9);
assert.equal(discountFor(50),.85);

// Crowd chat builds standing once per day
const c1=chatCrowdNpc(p,'npc-clara',2);
assert.equal(c1.gained,1);assert.equal(npcStandingOf(c1.state,'npc-clara'),1);
const c2=chatCrowdNpc(c1.state,'npc-clara',2);
assert.equal(c2.gained,0);assert.equal(npcStandingOf(c2.state,'npc-clara'),1);
p=c2.state;

// Gifting deducts item, boosts standing & mood, and uses trait/role reaction
p=addItem(p,'bouquet').state;
const beforeCash=p.cash;
const g1=giveNpcGift(p,{id:'npc-clara',role:'Librarian'},'bouquet',2);
assert.equal(g1.delta,5);
assert.equal(npcStandingOf(g1.state,'npc-clara'),6);
assert.equal(npcTierOf(g1.state,'npc-clara'),'acquaintance');
assert.equal(g1.state.cash,beforeCash);
assert(giveNpcGift(g1.state,{id:'npc-clara'},'bouquet',2).error,'cannot gift item not in bag');

// Personal favor offer + completion
const off=offerFavor(g1.state,{id:'npc-hank',role:'Sales clerk'},3);
assert(off.favor,'favor offered');
assert.match(completeFavor(off.state,{id:'npc-hank'},3).error,/Need 1/);
p=addItem(off.state,off.favor.item).state;
const done=completeFavor(p,{id:'npc-hank'},3);
assert.equal(done.reward,off.favor.reward);
assert.equal(done.state.cash,p.cash+off.favor.reward);
assert.equal(npcStandingOf(done.state,'npc-hank'),off.favor.standing);
assert.deepEqual(normalizeCrowdLife(null),{});
const pop=townPopulation().people;
const patrons=venuePatrons({propertyId:'ironwood-arcade',day:1,minute:1140,people:pop,planOf:()=>[{from:0,to:1440,act:'home',place:'dwelling:oak-apartments'}],max:2});
assert(patrons.length<=2,'venuePatrons respects cap');
console.log('PASS npc-relations: unified standing, discounts, gifting, personal favors, and venuePatrons verified');
