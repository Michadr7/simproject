// Diner D-A tests: shift loop, seeded arrivals, step, fail, and save.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {recipeById,MIN_TIP_CENTS,MAX_TIP_CENTS} from '../dist/diner-recipes.js';
import {
 DINER_BONUS_PER_RANK,DINER_FAIL_REP,TABLES,MAX_CARRY,PATIENCE_MIN,EAT_MIN,NPC_PREP_MIN,ARRIVAL_MIN,
 arrivalFor,freshDinerShift,normalizeDinerShift,step,takeOrder,pickupOrder,serveOrder,failOrder,busTable,shiftBonus,shiftSummary
} from '../dist/diner-job.js';

// 1. Tables match shops.js (4 tables at x +/-3.8, z -0.7 / 2.0).
assert.equal(TABLES.length,4);
assert.deepEqual(TABLES.map(t=>[t.x,t.z]),[[-3.8,-0.7],[-3.8,2],[3.8,-0.7],[3.8,2]]);

// 2. Deterministic seeded arrivals by (day, slot) with injected seed.
{const a1=arrivalFor(1,0,{seed:42,rank:1}),a2=arrivalFor(1,0,{seed:42,rank:1});
 assert.deepEqual(a1,a2,'same day, slot, seed -> identical arrival');
 const b=arrivalFor(1,0,{seed:999,rank:1}),c=arrivalFor(2,0,{seed:42,rank:1}),d=arrivalFor(1,3,{seed:42,rank:1});
 assert(a1.customerName!==b.customerName||a1.recipeId!==b.recipeId||a1.tableHint!==b.tableHint,'different seed changes arrival');
 assert(a1.customerName!==c.customerName||a1.recipeId!==c.recipeId,'different day changes arrival');
 assert(a1.customerName!==d.customerName||a1.recipeId!==d.recipeId,'different slot changes arrival');
 for(let s=0;s<30;s++){const r1=arrivalFor(1,s,{seed:123,rank:1});assert.equal(recipeById(r1.recipeId).minRank,2,'Rank 1 customers only order starter menu')}
 const seenR3=Array.from({length:40},(_,s)=>recipeById(arrivalFor(1,s,{seed:123,rank:3}).recipeId).minRank);
 assert(seenR3.includes(3),'Rank 3 unlocks Rank 3 items in customer orders');
}

// 3. Frame-rate independence: one big step vs 0.1 / (1/60) / (1/165) small steps give identical discrete state.
{const run=(dt,total)=>{
  let st=freshDinerShift({day:3,rank:1,seed:7301}),evAll=[];
  const n=Math.round(total/dt);
  for(let i=0;i<n;i++){const r=step(st,dt);st=r.state;evAll.push(...r.events)}
  return {st,evAll};
 };
 // Step across slot 0 (0), slot 1 (15), slot 2 (30), and seat expiry (100) -> total 105 game min.
 const big=run(105,105);
 for(const dt of [0.5,0.1,1/60]){
  const small=run(dt,105);
  assert(Math.abs(small.st.elapsedMin-big.st.elapsedMin)<1e-9,`elapsedMin matches at dt=${dt}`);
  assert.deepEqual(small.st.tables,big.st.tables,`tables match at dt=${dt}`);
  assert.deepEqual(small.st.tickets,big.st.tickets,`tickets match at dt=${dt}`);
  assert.equal(small.st.repDelta,big.st.repDelta,`repDelta matches at dt=${dt}`);
  assert.equal(small.st.failedOrders,big.st.failedOrders,`failedOrders matches at dt=${dt}`);
  assert.equal(small.st.nextSlot,big.st.nextSlot,`nextSlot matches at dt=${dt}`);
  assert.equal(small.evAll.length,big.evAll.length,`event count matches at dt=${dt}`);
 }
 // Also test mid-shift with active tickets (NPC prep at +6, eating done at +25).
 let s0=step(freshDinerShift({day:1,rank:1,seed:55}),1).state;
 const seatedTb=s0.tables.find(t=>t.status==='seated');assert(seatedTb,'slot 0 seats a customer');
 s0=takeOrder(s0,seatedTb.id).state;
 const oneBig=step(s0,10).state;
 let many=s0;for(let i=0;i<600;i++)many=step(many,10/600).state;
 assert.deepEqual(many.tickets,oneBig.tickets,'NPC ready state identical across 1 vs 600 steps');
 assert.deepEqual(many.tables,oneBig.tables,'table state identical across 1 vs 600 steps');
}

// 4. Waiter loop (Rank 1): arrive -> takeOrder -> NPC prep -> pickupOrder (cap 2) -> serveOrder -> eat -> busTable.
{let s=step(freshDinerShift({day:1,rank:1,seed:101}),1).state;
 const tb=s.tables.find(t=>t.status==='seated');assert(tb);
 const o=takeOrder(s,tb.id);assert.equal(o.ok,true);assert.equal(o.piece,'ordersTaken');s=o.state;
 assert(serveOrder(s,o.ticket.id).error,'cannot serve queued order before NPC finishes');
 s=step(s,NPC_PREP_MIN).state;
 assert.equal(s.tickets[0].stage,'ready');
 const pk=pickupOrder(s,o.ticket.id);assert.equal(pk.ok,true);s=pk.state;
 assert.equal(s.carried.length,1);
 const sv=serveOrder(s,o.ticket.id);
 assert.equal(sv.ok,true);assert.equal(sv.failed,false);assert.equal(sv.piece,'platesServed');
 assert(sv.tipCents>=MIN_TIP_CENTS&&sv.tipCents<=MAX_TIP_CENTS,'tip inside bounds');
 s=sv.state;
 assert.equal(s.tipsCents,sv.tipCents);assert.equal(s.servedOrders,1);assert.equal(s.tables[tb.id].status,'eating');
 s=step(s,EAT_MIN).state;
 assert.equal(s.tables[tb.id].status,'dirty');
 const bs=busTable(s,tb.id);assert.equal(bs.ok,true);assert.equal(bs.piece,'tablesBused');s=bs.state;
 assert.equal(s.tables[tb.id].status,'free');assert.equal(s.busedTables,1);
}

// 5. Fail / ruined order: tip lost, rep -2, remake allowed, NEVER reduces wages.
{let s=step(freshDinerShift({day:2,rank:2,seed:202}),1).state;
 const tb=s.tables.find(t=>t.status==='seated'),tk=takeOrder(s,tb.id);s=tk.state;
 const recipe=recipeById(tk.ticket.recipeId);
 const beforeSummary=shiftSummary(s,{rank:2,paidMinutes:60,allTasksDone:true});
 const bad=serveOrder(s,tk.ticket.id,{madeParts:recipe.parts.map(p=>p.id),cookSecs:recipe.burnSec+2});
 assert.equal(bad.ok,false);assert.equal(bad.failed,true);assert.equal(bad.remake,true);
 assert.equal(bad.tipCents,0);assert.equal(bad.repDelta,DINER_FAIL_REP);assert.equal(bad.wageDelta,0);
 s=bad.state;assert.equal(s.repDelta,-2);assert.equal(s.failedOrders,1);
 // Remake succeeds to clear table, but tip for this failed order stays 0.
 const remake=serveOrder(s,tk.ticket.id,{madeParts:recipe.parts.map(p=>p.id),cookSecs:recipe.cookSec});
 assert.equal(remake.ok,true);assert.equal(remake.tipCents,0,'remade order keeps lost tip at 0');
 s=remake.state;
 const afterSummary=shiftSummary(s,{rank:2,paidMinutes:60,allTasksDone:true});
 assert.equal(afterSummary.wageCents,beforeSummary.wageCents,'failed order never docks wages');
 assert.equal(afterSummary.bonusCents,2000,'Rank 2 bonus is $20');
 // Explicit failOrder & patience expiry.
 s=step(s,ARRIVAL_MIN).state;
 const tb2=s.tables.find(t=>t.status==='seated');assert(tb2);
 const tk2=takeOrder(s,tb2.id);s=tk2.state;
 const f=failOrder(s,tk2.ticket.id,'dropped');
 assert.equal(f.tipCents,0);assert.equal(f.repDelta,-2);assert.equal(f.wageDelta,0);
 assert.equal(f.state.tables[tb2.id].status,'free');
 const sExp=step(tk2.state,PATIENCE_MIN+1);
 assert(sExp.events.some(e=>e.type==='order-expired'&&e.repDelta===-2),'patience expiry fires order-expired');
 assert.equal(shiftSummary(sExp.state,{rank:2,paidMinutes:60}).wageCents,beforeSummary.wageCents,'expired order never docks wages');
}

// 6. Shift bonus ($10 x rank) and pay summary.
assert.equal(DINER_BONUS_PER_RANK,1000);
assert.equal(shiftBonus(1,true),1000);assert.equal(shiftBonus(2,true),2000);
assert.equal(shiftBonus(3,true),3000);assert.equal(shiftBonus(4,true),4000);
assert.equal(shiftBonus(3,false),0);
{const st=normalizeDinerShift({...freshDinerShift({rank:2}),tipsCents:450});
 const sum=shiftSummary(st,{rank:2,paidMinutes:60,allTasksDone:true,pieces:{ordersTaken:2,platesServed:2,drinksBrewed:1}});
 assert.equal(sum.wageCents,1100);assert.equal(sum.piecePayCents,100+200+120);
 assert.equal(sum.tipsCents,450);assert.equal(sum.bonusCents,2000);
 assert.equal(sum.totalCents,1100+420+450+2000);
}

// 7. JSON round trip & normalizeDinerShift surviving garbage.
{let s=step(freshDinerShift({day:4,rank:2,seed:888}),1).state;
 s=takeOrder(s,s.tables.find(t=>t.status==='seated').id).state;
 const rt=normalizeDinerShift(JSON.parse(JSON.stringify(s)));
 assert.deepEqual(rt,s,'JSON round trip preserves shift state');
 for(const bad of [null,undefined,123,'junk',[],{tables:'bad',tickets:[null,{id:-1}],tipsCents:-99,repDelta:NaN,seed:Infinity}]){
  const n=normalizeDinerShift(bad);
  assert.equal(n.tables.length,4);assert(Array.isArray(n.tickets));assert(Number.isSafeInteger(n.tipsCents)&&n.tipsCents>=0);
 }
}

// 8. Purity & no BOM.
{const raw=fs.readFileSync(new URL('../dist/diner-job.js',import.meta.url),'utf8');
 assert(!raw.startsWith('\uFEFF'),'no UTF-8 BOM');
 const src=raw.replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three','shops.js'])assert(!src.includes(bad),'must not use '+bad);
}
console.log('diner-job: PASS (4 tables, seeded arrivals, frame-rate independence, fail never docks wages, $10*rank bonus, JSON/garbage norm, purity)');
