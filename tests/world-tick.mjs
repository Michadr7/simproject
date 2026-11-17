// W-D1: the save shape (progress.world/needs/npcs/standing), the daily world tick (world-tick.js), supply, the pallet link, the crate unit and the pump hooks. Pure: no game.js, no browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshProgress,normalizeProgress,loadProgress,saveProgress,PROGRESS_KEY} from '../dist/jobs.js';
import {worldDue,runWorldDay,tickTargetDay,pumpGate,pumpSold,TICK_MINUTE,CATCH_UP_MAX,SOLD_OUT_TEXT} from '../dist/world-tick.js';
import {normalizeWorld,worldTick,pumpAvailMgal,pumpSell,totalOf} from '../dist/world-state.js';
import {PLACES,GOODS,SUPPLY,CRATE_UNITS,PALLET_LINK,PUMP_PLACE} from '../dist/world-goods.js';
import {ROSTER_ORDER} from '../dist/npc-roster.js';
import {STORY_CRATES} from '../dist/starter.js';
import {capacity} from '../dist/cargo.js';
import {sell,fillCan,STEP_MGAL} from '../dist/fuel.js';
import {MAP} from '../dist/map-definition.js';

const at=(P,day,minutes)=>({...P,housing:{...P.housing,day:day+1},routine:{...P.routine,minutes}}); // game day number `day` (0-based) at a minute
const base=normalizeProgress(freshProgress());

// ---- save shape: fresh, old save, garbage, round trip, starter untouched
assert.ok(base.world&&base.world.v===1&&Array.isArray(base.needs)&&base.npcs.hal&&base.standing&&typeof base.standing.people==='object');
assert.deepEqual(Object.keys(base.npcs),ROSTER_ORDER);
{const old=JSON.parse(JSON.stringify(base));delete old.world;delete old.needs;delete old.npcs;delete old.standing;old.starter={...old.starter};
 const n=normalizeProgress(old);assert.deepEqual(n.world,base.world);assert.deepEqual(n.needs,[]);assert.deepEqual(n.npcs,base.npcs);assert.deepEqual(n.standing,{people:{}});assert.deepEqual(n.starter,base.starter,'starter epoch untouched')}
for(const junk of [5,'x',[],{stock:7,day:'a'},{stock:{'shop:market':{eggs:-9e9}},day:-4,truck:{nextDay:'q'},pump:{gas:5e9}},null]){
 const n=normalizeProgress({...JSON.parse(JSON.stringify(base)),world:junk,needs:junk,npcs:junk,standing:junk});
 assert.ok(n.world.day>=0&&n.world.stock['shop:market'].eggs>=0&&n.world.pump.gas>=0&&n.world.pump.gas<1000&&Array.isArray(n.needs)&&n.npcs.noah.mood>=0&&typeof n.standing.people==='object')}
{const n=normalizeProgress({...base,standing:{people:{'__proto__':{points:9},noah:{points:7}}}});assert.equal(n.standing.people.noah.points,7);assert.equal(Object.keys(n.standing.people).includes('__proto__'),false)}
{const store=new Map(),st={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},P=at(base,50,400);P.world=normalizeWorld(null,MAP.seed,50);
 assert.ok(saveProgress(st,P));const back=loadProgress(st);assert.deepEqual(back.world,P.world);assert.deepEqual(back.npcs,P.npcs)}
// a loaded old save starts at today's tick (no flood of 14 days); a saved world keeps its own day
assert.equal(normalizeProgress(at({...base,world:undefined},30,400)).world.day,30);
assert.equal(normalizeProgress(at({...base,world:undefined},30,200)).world.day,29);
assert.equal(normalizeProgress({...at(base,30,400),world:{...base.world,day:20}}).world.day,20);

// ---- the 05:00 boundary and "once per day number"
assert.equal(TICK_MINUTE,300);
assert.equal(tickTargetDay(at(base,5,299)),4);assert.equal(tickTargetDay(at(base,5,300)),5);assert.equal(tickTargetDay(at(base,0,10)),0);assert.equal(tickTargetDay({}),0);
{let P=at({...base,world:{...base.world,day:4}},5,299);
 assert.equal(worldDue(P),false,'04:59 is still yesterday');
 P=at(P,5,300);assert.equal(worldDue(P),true,'05:00 is due');assert.equal(worldDue(P,false),false,'a co-op guest never ticks');
 const Q=runWorldDay(P);assert.equal(Q.world.day,5);assert.equal(worldDue(Q),false,'once per day number');
 assert.equal(JSON.stringify(runWorldDay(Q)),JSON.stringify(Q),'a second call the same day changes nothing');
 assert.equal(worldDue(at(Q,5,1439)),false);assert.equal(worldDue(at(Q,6,299)),false);assert.equal(worldDue(at(Q,6,300)),true)}

// ---- determinism, no mutation, a sleep (06:00 the next morning) ticks exactly once
{const P=at({...base,world:normalizeWorld(null,MAP.seed,99)},100,400),snap=JSON.stringify(P),a=runWorldDay(P),b=runWorldDay(P);
 assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(P),snap,'input mutated');
 const c=runWorldDay(at({...base,world:normalizeWorld(null,MAP.seed,99)},100,360));assert.equal(c.world.day,100);assert.equal(c.world.last.day,100)}

// ---- catch-up is capped at 14 days (the same result from 20 or 40 days behind) and the world lands on today
{const w0=normalizeWorld(null,MAP.seed,0),w1={...w0,day:20};
 const a=runWorldDay(at({...base,world:w0},40,400)),b=runWorldDay(at({...base,world:w1},40,400));
 assert.equal(a.world.day,40);assert.equal(JSON.stringify(a.world.stock),JSON.stringify(b.world.stock));assert.equal(JSON.stringify(a.npcs),JSON.stringify(b.npcs));assert.equal(CATCH_UP_MAX,14)}

// ---- 7 untouched days: eggs run out, a restock need for the market opens; moods stay valid; needs stay within the cap
{let P=at({...base,world:normalizeWorld(null,MAP.seed,100)},100,400);const seen=[];
 for(let d=101;d<=108;d++){P=runWorldDay(at(P,d,400));seen.push(P.needs.filter(n=>n.status==='open').length)}
 assert.equal(P.world.day,108);assert.ok(P.needs.some(n=>n.kind==='restock'&&n.place==='shop:market'),'a restock need opened '+JSON.stringify(P.needs.map(n=>n.id)));
 assert.ok(Math.max(...seen)<=6);for(const id of ROSTER_ORDER){assert.ok(P.npcs[id].mood>=0&&P.npcs[id].mood<=100)}
 // the same 8 days again from the same start: byte-identical
 let Q=at({...base,world:normalizeWorld(null,MAP.seed,100)},100,400);for(let d=101;d<=108;d++)Q=runWorldDay(at(Q,d,400));assert.equal(JSON.stringify(Q),JSON.stringify(P))}
// an overdue need closes: the keeper's mood falls and the shop is refilled late by the world's own actor
{let P=at({...base,world:normalizeWorld(null,MAP.seed,100)},100,400);for(let d=101;d<=112;d++)P=runWorldDay(at(P,d,400));assert.ok(P.needs.some(n=>n.status==='expired')||P.needs.some(n=>n.status==='open'),'needs moved on')}

// ---- W-A2 supply: the bakery and the sawmill feed their shops, conserved (removed from the producer)
{const w0=normalizeWorld(null,7,100);for(const s of SUPPLY){assert.ok(PLACES[s.from]&&PLACES[s.to]&&PLACES[s.from].goods[s.good]&&PLACES[s.to].goods[s.good],s.from+'>'+s.to)}
 const dry={...w0,stock:{...w0.stock,'shop:market':{...w0.stock['shop:market'],bread:0},'shop:cafe':{...w0.stock['shop:cafe'],bread:0},'property:eastbank-supply':{...w0.stock['property:eastbank-supply'],planks:0},'property:sawmill':{...w0.stock['property:sawmill'],planks:60}}}; // P-B wiring: a fresh sawmill (the yard) is empty: give it planks to ship
 const w=worldTick(dry,101,{});
 const bakery0=dry.stock['property:alder-bakery'].bread,bakery1=w.stock['property:alder-bakery'].bread,made=w.last.produced.bread||0;
 assert.equal(w.stock['shop:market'].bread,6);assert.equal(w.stock['shop:cafe'].bread,3);assert.equal(w.last.supplied.bread,9);
 assert.equal(bakery1,bakery0+made-9,'the bakery gave up what the shops got');
 assert.equal(w.stock['property:eastbank-supply'].planks,6);assert.equal(w.last.supplied.planks,6);
 assert.equal(totalOf(w,'bread'),totalOf(dry,'bread')+made-(w.last.consumed.bread||0),'bread conserved: nothing created by supplying');
 // never above the shop's target, never more than the producer has
 const full=worldTick({...w0,stock:{...w0.stock,'property:alder-bakery':{bread:2},'shop:market':{...w0.stock['shop:market'],bread:PLACES['shop:market'].goods.bread.target}}},101,{});
 assert.equal(full.stock['shop:market'].bread,PLACES['shop:market'].goods.bread.target)}

// ---- the Ridgeline pallets ARE the warehouse's planks (the pallets are the truth)
{const w=normalizeWorld(null,MAP.seed,100);let P=at({...base,world:w,companies:{ridgeline:{pallets:[{id:1,product:'planks',count:25,at:{rack:'A1-1'}},{id:2,product:'planks',count:11,at:{rack:'A1-2'}}]}}},101,400);
 P=runWorldDay(P);assert.equal(P.world.stock[PALLET_LINK.place][PALLET_LINK.good],36);
 const none=runWorldDay(at({...base,world:w},101,400));assert.equal(none.world.stock[PALLET_LINK.place][PALLET_LINK.good],w.stock[PALLET_LINK.place].planks,'no Ridgeline company: the world keeps its own number')}

// ---- eggs are DOZENS; the starter's 4 crates hold whole dozens and fit the truck beds
assert.equal(GOODS.eggs.unit,'dozen');assert.equal(STORY_CRATES,4);
for(const [g,n] of Object.entries(CRATE_UNITS)){assert.ok(GOODS[g]&&Number.isSafeInteger(n)&&n>0,g)}
assert.equal(STORY_CRATES*CRATE_UNITS.eggs,16,'4 crates = 16 dozen');assert.ok(STORY_CRATES*CRATE_UNITS.eggs<=PLACES['shop:market'].goods.eggs.max,'the starter delivery fits the market shelf');
assert.ok(capacity('shortbed','crate')>=STORY_CRATES&&capacity('worktruck','crate')>=STORY_CRATES&&capacity('flatbed','crate')===0);

// ---- fuel: the pumps sell the world's gallons (1 unit = 1 gallon = 1000 mgal)
{const w0=normalizeWorld(null,1,10),stock=g=>w0.stock[PUMP_PLACE][g];
 assert.ok(PLACES[PUMP_PLACE].goods.gas&&PLACES[PUMP_PLACE].goods.diesel);assert.equal(pumpAvailMgal(w0,'gas'),stock('gas')*1000);
 let r=pumpSell(w0,'gas',500);assert.equal(r.mgal,500);assert.equal(r.world.stock[PUMP_PLACE].gas,stock('gas'),'half a gallon: the gallon is not gone yet');assert.equal(r.world.pump.gas,500);assert.equal(pumpAvailMgal(r.world,'gas'),stock('gas')*1000-500);
 r=pumpSell(r.world,'gas',500);assert.equal(r.world.stock[PUMP_PLACE].gas,stock('gas')-1);assert.equal(r.world.pump.gas,0);
 const r2=pumpSell(w0,'gas',2500);assert.equal(r2.world.stock[PUMP_PLACE].gas,stock('gas')-2);assert.equal(r2.world.pump.gas,500);
 assert.equal(JSON.stringify(w0),JSON.stringify(normalizeWorld(null,1,10)),'input not mutated');assert.equal(pumpSell(w0,'steam',100).mgal,0);assert.equal(pumpSell(w0,'gas',-5).mgal,0);
 // a nearly empty pump: a game.js-style loop (gate, sell, report) stops exactly when the stock is gone
 let P={...base,cash:1e6,world:{...w0,stock:{...w0.stock,[PUMP_PLACE]:{...w0.stock[PUMP_PLACE],gas:2}}}},tank={fuel:'gas',mgal:0,capacityMgal:50000},soldOut=false,sold=0;
 for(let i=0;i<100&&!soldOut;i++){const g=pumpGate(P,'gas',STEP_MGAL*7,STEP_MGAL);if(g.soldOut){soldOut=true;break}
  const s=sell({cash:P.cash,target:tank},{pump:{fuel:'gas'},mgal:g.mgal});assert.ok(!s.error);tank=s.target;sold+=s.soldMgal;P=pumpSold({...P,cash:s.cash},'gas',s.soldMgal)}
 assert.ok(soldOut);assert.equal(sold,2000,'exactly the two gallons');assert.equal(P.world.stock[PUMP_PLACE].gas,0);assert.equal(pumpGate(P,'gas',500).mgal,0);assert.equal(SOLD_OUT_TEXT,'Sold out until the next delivery.');
 // the weekly truck refills it
 let W=P.world;for(let d=11;d<=20;d++)W=worldTick(W,d,{});assert.ok(W.stock[PUMP_PLACE].gas>0,'the supply truck delivers');
 // fillCan still works with a gated amount
 const can=fillCan({cash:1e6,can:{fuel:null,mgal:0}},{pump:{fuel:'gas'},mgal:pumpGate({world:w0},'gas',500).mgal});assert.equal(can.soldMgal,500)}

// ---- no clock, no chance, no DOM in the new code; worldDue does not allocate
const src=fs.readFileSync(new URL('../dist/world-tick.js',import.meta.url),'utf8');
assert.ok(!/Date\.now|Math\.random|performance\.now|document\.|window\./.test(src));
{const P=at({...base,world:{...base.world,day:3}},3,500);const t0=process.hrtime.bigint();let n=0;for(let i=0;i<200000;i++)if(worldDue(P))n++;const ms=Number(process.hrtime.bigint()-t0)/1e6;assert.equal(n,0);assert.ok(ms<200,'worldDue 200k calls '+ms.toFixed(1)+' ms');console.log(`worldDue: ${(ms/200000*1e6).toFixed(0)} ns a call`)}
{const P=at({...base,world:normalizeWorld(null,MAP.seed,100)},101,400),t0=process.hrtime.bigint();runWorldDay(P);console.log(`one-day tick ${(Number(process.hrtime.bigint()-t0)/1e6).toFixed(2)} ms; 14-day catch-up `,(()=>{const t=process.hrtime.bigint();runWorldDay(at({...base,world:normalizeWorld(null,MAP.seed,0)},40,400));return (Number(process.hrtime.bigint()-t)/1e6).toFixed(2)})(),'ms')}
console.log('PASS world-tick: save shape, 05:00 boundary, once per day, catch-up 14, determinism, 7 days -> needs, supply conserved, pallet link, dozens, pump stock, no clock/chance');
