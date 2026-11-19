// P-E (notes/planks-economy-design.md): town plank demand needs in dist/plank-needs.js, pure.
import assert from 'node:assert/strict';
import {normalizeWorld,priceOf} from '../dist/world-state.js';
import {PALLET_LINK} from '../dist/world-goods.js';
import {plankNeedsFrom,qtyFor,plankPriceCents,payOf,DEMAND,SUPPLIER,SAWMILL,PLANKS_PER_STACK,MAX_NEW_PER_CALL} from '../dist/plank-needs.js';

const mk=(sup,yard=80)=>{const w=normalizeWorld({},7,3);w.stock[SUPPLIER].planks=sup;w.stock[SAWMILL].planks=yard;return w};
const ids=l=>l.map(n=>n.id);

// 1 threshold opens a need (supplier target 30: below 9 is low)
{const l=plankNeedsFrom(mk(8),3);assert.equal(l.length,1);const n=l[0];assert.equal(n.place,SUPPLIER);assert.equal(n.kind,'restock');assert.equal(n.good,'planks');assert.equal(n.status,'open');assert.equal(n.origin,SAWMILL);assert(n.dueDay>3&&n.dueDay<=3+3)}
// 2 above threshold: none
assert.deepEqual(plankNeedsFrom(mk(9),3),[]);assert.deepEqual(plankNeedsFrom(mk(30),3),[]);
// 3 stack rounding: whole stacks, refill to 70% (21): from 8, want 13 -> 4 stacks = 16
{const n=plankNeedsFrom(mk(8),3)[0];assert.equal(n.qty%PLANKS_PER_STACK,0);assert.equal(n.qty,16);
 assert.equal(qtyFor({target:30,max:100},0),24);assert.equal(qtyFor({target:30,max:100},8,6),4);assert.equal(qtyFor({target:30,max:100},8,3),0)} // sawmill yard under a stack: no need
// 4 price follows stock and pays the world price
{const lo=plankNeedsFrom(mk(0),3)[0],hi=plankNeedsFrom(mk(8),3)[0];assert.equal(lo.unitCents,priceOf(mk(0),SUPPLIER,'planks'));assert(lo.unitCents>=hi.unitCents);assert.equal(lo.unitCents,1125);assert.equal(payOf(lo),lo.qty*1125);assert.equal(plankPriceCents(null),900)}
// 5 bakery and houses via opts.stock; at most MAX_NEW_PER_CALL; no duplicate ids across calls
{const w=mk(30);const stock={'property:alder-bakery':0,'property:house-r1':0,'property:house-r2':1,'property:house-r3':0};
 const a=plankNeedsFrom(w,3,{stock});assert.equal(a.length,MAX_NEW_PER_CALL);assert(a.every(n=>n.place in DEMAND));assert.equal(new Set(ids(a)).size,a.length);
 const b=plankNeedsFrom(w,3,{stock,needs:a});assert(!b.some(n=>ids(a).includes(n.id)));assert(!b.some(n=>a.some(x=>x.place===n.place)));
 const c=plankNeedsFrom(w,4,{stock,needs:a});assert(!c.some(n=>a.some(x=>x.place===n.place))); // still open: no second need on a later day
 const closed=a.map(n=>({...n,status:'filled',closedDay:3}));assert(!plankNeedsFrom(w,3,{stock,needs:closed}).some(n=>closed.some(x=>x.place===n.place))); // hysteresis
 assert(plankNeedsFrom(w,4,{stock,needs:closed}).some(n=>n.place===a[0].place))}
// 6 the pallet-link place is never asked
{const demand={[PALLET_LINK.place]:{target:60,max:200}};const w=mk(30);w.stock[PALLET_LINK.place][PALLET_LINK.good]=0;assert.deepEqual(plankNeedsFrom(w,3,{demand}),[])}
// 7 garbage is safe
for(const bad of [null,undefined,{},[],'x',{stock:5},{stock:{}}])for(const day of [NaN,-1,null,'q',1.5]){const l=plankNeedsFrom(bad,day,{needs:'nope',stock:'x',demand:7});assert(Array.isArray(l))}
assert.deepEqual(plankNeedsFrom(null,3,{stock:{'property:alder-bakery':'many'}}),[]);
assert(Array.isArray(plankNeedsFrom(mk(8),3,null)));assert(plankNeedsFrom(mk(8),3,{needs:[null,5,'x']}).length===1);
// 8 deterministic and the input is not changed
{const w=mk(0),snap=JSON.stringify(w),stock={'property:house-r4':0};const a=plankNeedsFrom(w,5,{stock}),b=plankNeedsFrom(w,5,{stock});assert.deepEqual(a,b);assert.equal(JSON.stringify(w),snap)}
console.log('PASS plank-needs: threshold, stacks, price, ids, pallet guard, garbage, determinism');
