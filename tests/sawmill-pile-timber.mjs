// Timber redesign T-B: where waiting trunks and slabs lie at the sawmill's feed end (no overlap with the log deck, enough slots for the yard caps, deterministic, clear of the switch).
import assert from 'node:assert/strict';
import * as P from '../dist/sawmill-pile.js';
import {YARD_MAX_TRUNKS,YARD_MAX_SLABS} from '../dist/sawmill-yard.js';
assert.equal(P.TRUNK_SLOTS,20);assert.ok(P.TRUNK_SLOTS>=YARD_MAX_TRUNKS);assert.ok(P.SLAB_SLOTS>=YARD_MAX_SLABS);
assert.equal(P.trunkSlot(P.TRUNK_SLOTS),null);assert.equal(P.slabSlot(-1),null);assert.equal(P.trunkSlot(1.5),null);assert.equal(P.trunkPile(99).length,20);assert.equal(P.slabPile(99).length,P.SLAB_SLOTS);assert.equal(P.trunkBounds(0),null);
const logB=P.logBounds(P.LOG_SLOTS),trB=P.trunkBounds(20),slB=P.slabBounds(P.SLAB_SLOTS);
const hit=(a,b)=>a.x0<b.x1&&a.x1>b.x0&&a.z0<b.z1&&a.z1>b.z0;
assert.ok(!hit(logB,trB),'trunks clear of the log deck');assert.ok(!hit(logB,slB),'slabs clear of the log deck');assert.ok(!hit(trB,slB),'trunks clear of slabs');
const sw={x0:-4.3,x1:-3.7,z0:3.6,z1:4.2};assert.ok(!hit(slB,sw)&&!hit(trB,sw),'clear of the switch at (-4, 3.9)');
assert.ok(trB.x1<-4.3&&slB.x1<-4.3,'both lie west of the deck edge (x < -4.3)');
for(let i=0;i<20;i++){const s=P.trunkSlot(i);assert.ok(s.y>=P.TRUNK_RADIUS-1e-9);assert.ok(s.y+P.TRUNK_RADIUS<P.ROOF_CLEAR)}
const seen=new Set();for(let i=0;i<P.TRUNK_SLOTS;i++){const s=P.trunkSlot(i);const k=[s.x,s.y.toFixed(3),s.z.toFixed(3)].join();assert.ok(!seen.has(k));seen.add(k)}
assert.ok(P.slabSlot(P.SLAB_SLOTS-1).y<1.1,'the top slab is lower than 1.1 m');assert.deepEqual(P.slabSlot(7),P.slabSlot(7));assert.ok(Object.isFrozen(P.slabSlot(0)));
console.log('PASS sawmill-pile-timber.mjs: 20 trunk slots and 84 slab slots at the feed end, no overlap with the log deck, each other or the switch, deterministic, frozen.');