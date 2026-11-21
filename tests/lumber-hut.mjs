// Timber storage (owner 2026-11-18, prompts/opus-timber-storage.md): boards and slabs are kept ONLY in the lumber hut. Pure checks: the stacks fit the hut's deck (inside the
// rails and posts, under the eaves, none overlapping), the caps fit exactly, taking lifts the top stack, storing respects the caps, X in the timber yard never leaves them on the ground,
// and putting boards back takes back the Mill piece they paid (no take/store loop).
import assert from 'node:assert/strict';
import {HUT,HUT_FLOOR_Y,HUT_DECK,HUT_EAVES_Y,BOARD_SLOTS,boardSlot,hutStacks,hutPlanks,hutTopStack,boardRect,HUT_SLAB_SLOTS,hutSlabSlot,hutSlabs,slabRect,hutWorld,hutRect,nearHut,putDownRule,inTimberYard,BOARD_HALF,SLAB_HALF} from '../dist/lumber-hut.js';
import {YARD_MAX_PLANKS,YARD_MAX_SLABS,PLANKS_PER_STACK,freshYard,normalizeYard,storeInYard,takeStack,takeSlab} from '../dist/sawmill-yard.js';
import {PLANK_PITCH,SLAB_THICK} from '../dist/sawmill-pile.js';
import {MAP} from '../dist/map-definition.js';
import {hire} from '../dist/careers.js';
import {clockIn,recordPiece,unrecordPiece} from '../dist/shift.js';
import {freshProgress} from '../dist/jobs.js';

const eps=1e-9,inside=(r,b)=>r.x0>=b.x0-eps&&r.x1<=b.x1+eps&&r.z0>=b.z0-eps&&r.z1<=b.z1+eps,apart=(a,b)=>a.x1<=b.x0+eps||b.x1<=a.x0+eps||a.z1<=b.z0+eps||b.z1<=a.z0+eps;
assert.equal(HUT.prop,'hut');assert.ok(!MAP.landmarks.some(l=>/^yard-log-/.test(l.id)),'the three decor logs beside the hut are gone');
// capacity: exactly the yard caps
assert.equal(BOARD_SLOTS*PLANKS_PER_STACK,YARD_MAX_PLANKS);assert.equal(HUT_SLAB_SLOTS,YARD_MAX_SLABS);
// boards: east half, inside the deck, under the eaves, no overlap within a layer, every upper stack carried by the one below
const boards=Array.from({length:BOARD_SLOTS},(_,i)=>boardSlot(i));assert.equal(boardSlot(BOARD_SLOTS),null);assert.equal(boardSlot(-1),null);
for(const s of boards){assert.ok(inside(boardRect(s),BOARD_HALF)&&inside(boardRect(s),HUT_DECK),'board slot on the deck: '+JSON.stringify(s));assert.ok(s.y+PLANKS_PER_STACK*PLANK_PITCH<HUT_EAVES_Y,'under the eaves')}
for(let i=0;i<boards.length;i++)for(let j=i+1;j<boards.length;j++)if(boards[i].layer===boards[j].layer)assert.ok(apart(boardRect(boards[i]),boardRect(boards[j])),`board slots ${i}/${j} overlap`);
for(const s of boards.filter(s=>s.layer>0))assert.ok(boards.some(b=>b.layer===s.layer-1&&b.x===s.x&&b.z===s.z),'a stack rests on the one below');
// count mapping (sawmill-pile.js pileStacks): every board drawn, the odd ones in slot 0, the top stack is the one taken
for(let p=0;p<=YARD_MAX_PLANKS;p++){const st=hutStacks(p);assert.equal(st.reduce((a,s)=>a+s.count,0),p);assert.equal(hutPlanks(p).length,p);assert.deepEqual(hutTopStack(p),p?st.at(-1):null)}
for(const p of [4,8,40,160]){const after=hutStacks(takeStack({...freshYard(),planks:p}).state.planks);assert.deepEqual(after,hutStacks(p).slice(0,-1),'taking lifts the top stack: '+p)}
assert.ok(Math.abs(hutPlanks(1)[0].y-(HUT_FLOOR_Y+.06))<eps,'the first board lies on the hut floor');
// slabs: west half, inside, under the eaves, no overlap within a layer
const slabs=hutSlabs(YARD_MAX_SLABS);assert.equal(slabs.length,YARD_MAX_SLABS);assert.equal(hutSlabs(999).length,HUT_SLAB_SLOTS);assert.equal(hutSlabs(-2).length,0);assert.equal(hutSlabSlot(HUT_SLAB_SLOTS),null);
for(const s of slabs){assert.ok(inside(slabRect(s),SLAB_HALF)&&inside(slabRect(s),HUT_DECK),'slab on the deck');assert.ok(s.y+SLAB_THICK/2<HUT_EAVES_Y)}
for(let i=0;i<slabs.length;i++)for(let j=i+1;j<slabs.length;j++)if(slabs[i].layer===slabs[j].layer)assert.ok(apart(slabRect(slabs[i]),slabRect(slabs[j])),`slabs ${i}/${j} overlap`);
assert.ok(boards.every(b=>slabs.every(s=>apart(boardRect(b),slabRect(s)))),'boards and slabs keep to their own halves');
// world placement: the deck centre is the hut's position (yaw 0)
assert.deepEqual(hutWorld(0,0),{x:HUT.x,z:HUT.z});{const r=hutRect(HUT_DECK);assert.ok(Math.abs(r.hx-2.05)<1e-6&&Math.abs(r.hz-3.1)<1e-6)}
// storing: up to the caps, the rest stays in the hands
{let y=normalizeYard({planks:YARD_MAX_PLANKS-2,slabs:YARD_MAX_SLABS-1});const r=storeInYard(y,4,'planks');assert.deepEqual([r.stored,r.left,r.state.planks],[2,2,YARD_MAX_PLANKS]);
 const s1=storeInYard(y,1,'slab');assert.deepEqual([s1.stored,s1.left,s1.state.slabs],[1,0,YARD_MAX_SLABS]);const s2=storeInYard(s1.state,1,'slab');assert.deepEqual([s2.stored,s2.left],[0,1]);assert.deepEqual(s2.state,s1.state,'a full hut changes nothing');
 assert.equal(storeInYard(y,'x').stored,0);const back=takeSlab(storeInYard(freshYard(),1,'slab').state);assert.equal(back.slabs,1)}
// X: at the hut it stores, elsewhere in the timber yard it refuses, outside the yard boards go down as before; logs and crates are not affected
assert.equal(putDownRule('planks',HUT.x-3.6,HUT.z),'store');assert.equal(putDownRule('slab',HUT.x,HUT.z-4.3),'store');assert.ok(nearHut(HUT.x+3.6,HUT.z));
assert.equal(putDownRule('planks',108,-276),'ground');assert.equal(putDownRule('slab',100,-284),'ground');assert.ok(inTimberYard(104,-278));
assert.equal(putDownRule('planks',0,0),'ground');assert.equal(putDownRule('log',HUT.x-3.6,HUT.z),'ground');assert.equal(putDownRule('crate',108,-276),'ground');
// a board put back takes back its Mill piece (and the task count); never below zero; off shift nothing changes
{const h=hire(freshProgress(),'ridgeline').state,s=clockIn({...h,housing:{...h.housing,day:3},routine:{...h.routine,minutes:600}},'ridgeline').state;
 const st={...s,shift:{...s.shift,tasks:[{kind:'mill',piece:'planks',target:20,done:0}]}},paid=recordPiece(st,'planks',4).state;assert.equal(paid.shift.pieces.planks,4);
 const un=unrecordPiece(paid,'planks',4);assert.equal(un.removed,4);assert.equal(un.state.shift.pieces.planks,undefined);assert.equal(un.state.shift.tasks[0].done,0);
 const slab=recordPiece(st,'slabs',1).state;assert.equal(slab.shift.tasks[0].done,1,'a slab counts for Mill');const u2=unrecordPiece(slab,'slabs',3);assert.equal(u2.removed,1);assert.equal(u2.state.shift.tasks[0].done,0);
 assert.equal(unrecordPiece(st,'planks',4).state,st,'nothing paid: nothing taken back');assert.equal(unrecordPiece(h,'planks',4).state,h,'off shift: unchanged')}
console.log(`PASS lumber-hut.mjs: ${BOARD_SLOTS} board stacks (${YARD_MAX_PLANKS} boards) and ${HUT_SLAB_SLOTS} slabs fit the hut's deck in their own halves, under the eaves, none overlapping; taking lifts the top stack; storing stops at the caps (the rest stays in the hands); X stores at the hut, refuses elsewhere in the timber yard, is unchanged outside; a board put back takes back its Mill piece.`);
