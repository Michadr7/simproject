import assert from 'node:assert/strict';
import {pileSlot,pileStacks,pilePlanks,topStack,pileBounds,slotRect,PILE_SLOTS,PILE_STACKS_NEEDED,PILE_BOX,ROOF_CLEAR,LAYER_H,DECK_Y,PLANK_PITCH,
 logSlot,logPile,logBounds,LOG_SLOTS,LOGS_NEEDED,LOG_RADIUS,LOG_LENGTH} from '../dist/sawmill-pile.js';
import {YARD_MAX_PLANKS,YARD_MAX_LOGS,PLANKS_PER_STACK,freshYard,feed,tick,takeStack} from '../dist/sawmill-yard.js';
import {PLANK_REST} from '../dist/carry.js';

// The yard's planks are piled inside the sawmill shed (owner request 2026-11-17): every plank is drawn, the cap fits, nothing overlaps or pokes out.
assert.equal(PILE_STACKS_NEEDED,40);assert(PILE_SLOTS>=PILE_STACKS_NEEDED,`the shed holds ${PILE_SLOTS} stacks, the cap needs ${PILE_STACKS_NEEDED}`);
assert.equal(LOGS_NEEDED,YARD_MAX_LOGS);assert(LOG_SLOTS>=YARD_MAX_LOGS,`${LOG_SLOTS} log places for ${YARD_MAX_LOGS} logs`);

// Slots: inside the floor area, under the lowest beam, deterministic, and no two stacks share space (same layer: floor rectangles apart; a stack above rests on stacks fully below it).
const slots=Array.from({length:PILE_SLOTS},(_,i)=>pileSlot(i));
assert.equal(pileSlot(PILE_SLOTS),null);assert.equal(pileSlot(-1),null);assert.equal(pileSlot(1.5),null);assert.deepEqual(pileSlot(7),pileSlot(7));
const eps=1e-9,inside=(r,b)=>r.x0>=b.x0-eps&&r.x1<=b.x1+eps&&r.z0>=b.z0-eps&&r.z1<=b.z1+eps,apart=(a,b)=>a.x1<=b.x0+eps||b.x1<=a.x0+eps||a.z1<=b.z0+eps||b.z1<=a.z0+eps;
for(const s of slots){assert(inside(slotRect(s),PILE_BOX),'slot inside the pile area '+JSON.stringify(s));assert(s.y+LAYER_H<ROOF_CLEAR,'under the beams');assert(Math.abs(s.y-(DECK_Y+s.layer*LAYER_H))<eps)}
for(let i=0;i<slots.length;i++)for(let j=i+1;j<slots.length;j++)if(slots[i].layer===slots[j].layer)assert(apart(slotRect(slots[i]),slotRect(slots[j])),`slots ${i} and ${j} overlap`);
// Layers fill in order and every stack above layer 0 is carried: its footprint lies inside the union of the layer below.
for(let i=1;i<slots.length;i++)assert(slots[i].layer>=slots[i-1].layer,'layers fill bottom first');
for(const s of slots.filter(s=>s.layer>0)){const below=slots.filter(b=>b.layer===s.layer-1).map(slotRect),r=slotRect(s);
 const ux0=Math.min(...below.map(b=>b.x0)),ux1=Math.max(...below.map(b=>b.x1)),uz0=Math.min(...below.map(b=>b.z0)),uz1=Math.max(...below.map(b=>b.z1));
 assert(r.x0>=ux0-eps&&r.x1<=ux1+eps&&r.z0>=uz0-eps&&r.z1<=uz1+eps,'a stack rests on the layer below')}
assert.notEqual(slots.find(s=>s.layer===1).rot,slots[0].rot,'the layers cross');

// Count mapping: planks -> stacks; the odd planks are a short stack in slot 0, every other stack is full; every plank is drawn; the top stack is the last laid.
for(let p=0;p<=YARD_MAX_PLANKS;p++){const st=pileStacks(p),total=st.reduce((a,s)=>a+s.count,0);assert.equal(total,p,'every plank shown: '+p);
 assert.equal(st.length,Math.ceil(p/PLANKS_PER_STACK));assert.equal(pilePlanks(p).length,p);
 st.forEach((s,i)=>{assert.equal(s.slot,i);assert.equal(s.count,i===0&&p%PLANKS_PER_STACK?p%PLANKS_PER_STACK:PLANKS_PER_STACK)});
 assert.deepEqual(topStack(p),p?st[st.length-1]:null);if(!p)assert.equal(pileBounds(p),null)}
assert.equal(pileStacks(6).length,2);assert.deepEqual(pileStacks(6).map(s=>s.count),[2,4]);assert.deepEqual(pileStacks(160).map(s=>s.count).filter(c=>c!==4),[]);
assert.equal(pileStacks(-3).length,0);assert.equal(pileStacks(NaN).length,0);assert.equal(pileStacks(4.9).length,1);
{const pl=pilePlanks(8);assert.deepEqual(pl.map(q=>q.k),[0,1,2,3,0,1,2,3]);assert(Math.abs(pl[1].y-(DECK_Y+PLANK_REST+PLANK_PITCH))<eps)}
{const b=pileBounds(YARD_MAX_PLANKS);assert(inside(b,PILE_BOX));const b1=pileBounds(4);assert.deepEqual(b1,slotRect(pileSlot(0)))}

// Taking a stack from the yard (takeStack) lifts exactly the top stack off the drawn pile; sawing adds a stack on top. Frame/clock independent: tick in one step or many, the pile is the same.
{let y=freshYard();y=feed(y,10).state;const one=tick(y,40),many=Array.from({length:400}).reduce(s=>tick(s,.1),y);assert.equal(one.planks,many.planks);assert.deepEqual(pileStacks(one.planks),pileStacks(many.planks));
 for(const p of [4,6,40,41,160]){const before=pileStacks(p),after=pileStacks(takeStack({...freshYard(),planks:p}).state.planks);
  if(p%PLANKS_PER_STACK===0||p<PLANKS_PER_STACK)assert.deepEqual(after,before.slice(0,-1),'the top stack disappears: '+p);else{assert.equal(after.length,before.length-1);assert.deepEqual(after.slice(1),before.slice(1,-1))}}}

// Logs: a nested log deck on the ground at the feed end, clear of the main deck (x > -4.3), the static log pile (z > 0.1) and each other; low.
const logs=Array.from({length:LOG_SLOTS},(_,i)=>logSlot(i));assert.equal(logSlot(LOG_SLOTS),null);
for(const s of logs){assert(s.x+LOG_LENGTH/2< -4.3,'beside the deck, not on it');assert(s.z+LOG_RADIUS<.1&&s.z-LOG_RADIUS>-3.72,'clear of the static pile, inside the roof line');assert(s.y+LOG_RADIUS<1)}
for(let i=0;i<logs.length;i++)for(let j=i+1;j<logs.length;j++){const a=logs[i],b=logs[j];assert(Math.hypot(a.y-b.y,a.z-b.z)>=2*LOG_RADIUS-eps,`logs ${i} and ${j} overlap`)}
for(const s of logs.filter(s=>s.layer>0)){const under=logs.filter(b=>b.layer===s.layer-1&&Math.abs(Math.hypot(b.y-s.y,b.z-s.z)-.25)<1e-6);assert.equal(under.length,2,'a nested log rests on two below')}
assert.equal(logPile(YARD_MAX_LOGS).length,YARD_MAX_LOGS);assert.equal(logPile(99).length,LOG_SLOTS);assert.equal(logPile(0).length,0);assert.equal(logBounds(0),null);
assert(logBounds(YARD_MAX_LOGS).x1< -4.3);

console.log(`PASS sawmill-pile: ${PILE_SLOTS} stack slots in the shed (cap needs ${PILE_STACKS_NEEDED}), 3 crossed layers, none overlap, all under the beams; every plank 0..${YARD_MAX_PLANKS} drawn, odd planks in slot 0, taking lifts the top stack; ${LOG_SLOTS} log places for ${YARD_MAX_LOGS} logs`);
