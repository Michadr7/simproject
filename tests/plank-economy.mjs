// P-A (notes/planks-economy-design.md): the planks chain's numbers, the wage rule against the real job tables, cycle time sums, the Prices screen data, determinism, garbage input, frozen constants.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from '../dist/plank-economy.js';
import {MAP} from '../dist/map-definition.js';
import {PIECE_PAY} from '../dist/shift.js';
import {capacity} from '../dist/cargo.js';
import {HANDS_SPEED,PLANKS_PER_STACK} from '../dist/carry.js';
import {CLASSES} from '../dist/vehicle.js';
import {LUMBERYARD,RACK_CAP} from '../dist/forest.js';
import {GOODS,PLACES} from '../dist/world-goods.js';
import {normalizeWorld,priceOf,PRICE_BAND_PCT} from '../dist/world-state.js';
import {WALK_M_PER_GAME_MIN} from '../dist/gig-pay.js';

// 1. Every MEASURED copy matches the real file.
assert.equal(P.PLANK_BASE_CENTS,900);assert.equal(P.PLANK_BASE_CENTS,GOODS.planks.baseCents);
assert.equal(P.OLD_SAWMILL_RATE,24);assert.equal(PLACES['property:sawmill'].goods.planks.rate,undefined,'P-B wiring: the world sawmill mints nothing (the yard trickle is the only free supply)');assert.equal(PLACES['property:sawmill'].goods.planks.start,0,'a fresh sawmill yard is empty');
assert.equal(P.OLD_PAY.fellTree,PIECE_PAY.trees);assert.equal(P.OLD_PAY.landingLog,PIECE_PAY.logs);assert.equal(P.OLD_PAY.gatheredLog,PIECE_PAY.gathered);assert.equal(P.OLD_PAY.lumberyardPlank,100,'the LEGACY lumberyard pay stays recorded: 100 c');assert.equal(PIECE_PAY.delivered,P.PAY.plankDelivered,'quest rework: the live hand-in pay IS the chain rate (730 c)');assert.equal(PIECE_PAY.delivered,730);assert.equal(PIECE_PAY.planks,P.PAY.plankOffBelt);assert.equal(PIECE_PAY.slabs,P.TIMBER_PAY.slabOffBelt);assert.equal(PIECE_PAY.slabsDelivered,P.TIMBER_PAY.slabDelivered);assert.equal(PIECE_PAY.bucked,P.TIMBER_PAY.buckTrunk);assert.equal(PIECE_PAY.logsFed,P.PAY.logToSaw);assert.equal(PIECE_PAY.trunksFed,P.TIMBER_PAY.trunkToSaw);assert.equal(P.OLD_PAY.rackCell,PIECE_PAY.racks);assert.equal(P.OLD_PAY.orderDelivery,2500);assert.equal(PIECE_PAY.deliveries,0,'the flat delivery piece is retired: P-D pays by plank price');assert.equal(P.OLD_PAY.orderPick,PIECE_PAY.orders);
assert.equal(P.PLANKS_PER_STACK,PLANKS_PER_STACK);assert.equal(P.LOGS_TO_PLANKS,PLANKS_PER_STACK,'1 log = 4 planks = one belt stack');
assert.equal(P.LOG_CARRY_FACTOR,HANDS_SPEED.log);assert.equal(P.PLANK_CARRY_FACTOR,HANDS_SPEED.planks);assert.equal(P.WALK_M_MIN,WALK_M_PER_GAME_MIN);
assert.equal(P.RACK_CELL_PLANKS,RACK_CAP);
assert.deepEqual(P.LUMBERYARD_POS,{x:(LUMBERYARD.x0+LUMBERYARD.x1)/2,z:(LUMBERYARD.z0+LUMBERYARD.z1)/2});
for(const m of Object.keys(P.BED_PLANKS))assert.equal(P.BED_PLANKS[m],capacity(m,'planks'),'bed '+m);
for(const m of Object.keys(P.TOP_SPEED))assert.equal(P.TOP_SPEED[m],CLASSES[m].top,'top speed '+m);
const lm=MAP.landmarks.find(l=>l.id==='sawmill'),off=MAP.offices.find(o=>o.id==='ridgeline-warehouse');
assert.ok(lm&&off);assert.equal(P.SAWMILL_POS.x,lm.x);assert.equal(P.SAWMILL_POS.z,lm.z);assert.equal(P.WAREHOUSE_POS.x,off.door.x);assert.equal(P.WAREHOUSE_POS.z,off.door.z);
const ridge=MAP.employers.find(e=>e.id==='ridgeline');assert.deepEqual(P.RIDGELINE_RANKS.map(r=>[r.id,r.level,r.wage]),ridge.ranks.map(r=>[r.id,r.needs.level,r.wage]));
{const src=fs.readFileSync(new URL('../dist/cafe-job.js',import.meta.url),'utf8');assert.ok(src.includes('cash:s.cash+2400'),'cafe pays 2400');assert.equal(P.CAFE.pay,2400);assert.equal(P.CAFE.minutes,90,'2 customers x (10+10+10+15) min')}
assert.equal(P.ROAD_M,Math.ceil(Math.hypot(104-166.9,-278-31.5)*1.3));assert.ok(P.ROAD_M>400&&P.ROAD_M<430);

// 2. Prices and rates: the trickle is smaller than the old rate and than the town's use; the player fills the gap.
assert.ok(P.TRICKLE_PER_DAY>0&&P.TRICKLE_PER_DAY<P.OLD_SAWMILL_RATE);assert.equal(P.TOWN_USE_PER_DAY,16);assert.equal(P.PLAYER_SHARE_PER_DAY,P.TOWN_USE_PER_DAY-P.TRICKLE_PER_DAY);assert.ok(P.PLAYER_SHARE_PER_DAY>0,'the town cannot live on the trickle alone');

// 3. Cycle time sums and the starter truck.
const c1=P.cycleEarnings(1,'worktruck');
assert.equal(c1.planks,32);assert.equal(c1.logs,8);assert.equal(c1.trees,4,'level 1: 2 logs a tree');
assert.deepEqual(c1.steps.map(s=>s.id),['fell','logs','saw','belt','drive','unload']);
assert.ok(Math.abs(c1.steps.reduce((t,s)=>t+s.minutes,0)-c1.minutes)<.051,'minutes are the sum of the steps');
assert.equal(c1.steps.reduce((t,s)=>t+s.cents,0),c1.cents,'cents are the sum of the steps');
assert.equal(c1.centsPerHour,Math.round(c1.cents*60/c1.minutes));
assert.equal(c1.steps.find(s=>s.id==='fell').cents,4*300);assert.equal(c1.steps.find(s=>s.id==='unload').cents,32*P.PAY.plankDelivered);
assert.ok(c1.minutes>120&&c1.minutes<260,'a full load by hand is a few game hours: '+c1.minutes);
assert.ok(P.cycleEarnings(3,'worktruck').trees<c1.trees||P.cycleEarnings(3,'worktruck').trees===Math.ceil(8/3),'level 3 gives 3 logs a tree');
assert.ok(P.cycleEarnings(1,'flatbed').planks===120&&P.cycleEarnings(1,'flatbed').cents>c1.cents,'a bigger bed carries and earns more per trip');
assert.ok(P.cycleEarnings(1,'atv').planks===5);
const drive=c1.steps.find(s=>s.id==='drive').minutes;assert.ok(drive>30&&drive<45,'2 x 411 m at 24 m per game minute + fiddling: '+drive);
assert.ok(P.truckMetresPerMin('shortbed')<=24&&P.truckMetresPerMin('flatbed')<P.truckMetresPerMin('worktruck'));

// 4. THE WAGE RULE: the by-hand cycle is at least WAGE_MARGIN_PCT above the best existing hands-on job at level 1 with the starter truck; fails if any job overtakes it.
const jobs1=P.existingJobs(1),rule1=jobs1.filter(j=>j.inRule),need=Math.ceil(Math.max(...rule1.map(j=>j.centsPerHour))*(100+P.WAGE_MARGIN_PCT)/100);
assert.ok(rule1.length>=4,'cafe, two gig modes, felling and landing are all compared');
for(const j of rule1)assert.ok(c1.centsPerHour>=Math.ceil(j.centsPerHour*(100+P.WAGE_MARGIN_PCT)/100),'job '+j.id+' ('+j.centsPerHour+' c/h) overtakes the planks cycle ('+c1.centsPerHour+' c/h)');
assert.ok(c1.centsPerHour>=need);
for(const lv of P.WAGE_LEVELS_REQUIRED){const r=P.wageRule(lv,'worktruck');assert.ok(r.ok,'wage rule at level '+lv+' '+JSON.stringify(r))}
const r1=P.wageRule(1,'worktruck');assert.equal(r1.bestId,'ridgeline-fell');assert.ok(r1.marginPct>=P.WAGE_MARGIN_PCT);
assert.equal(P.hourlyWage(1,'worktruck'),c1.centsPerHour);
// the excluded errand is documented, and still listed
const errand=jobs1.find(j=>j.id==='market-errand');assert.ok(errand&&!errand.inRule&&P.EXCLUDED_FROM_RULE['market-errand'].length>40);
assert.deepEqual(rule1.map(j=>j.id).sort(),['cafe','gig-vehicle','gig-walk','ridgeline-fell','ridgeline-landing']);
// sane for the economy: the chain pays less than the plank is worth, and the pay shares are tiny next to the final delivery
assert.ok(c1.centsPerPlank<=P.PLANK_BASE_CENTS*P.PAY_PER_PLANK_AT_PRICE_PCT/100,'chain pay per plank '+c1.centsPerPlank+' c vs price '+P.PLANK_BASE_CENTS);
assert.ok(P.PAY.plankDelivered<P.PLANK_BASE_CENTS&&P.PAY.logToSaw<P.LOG_BASE_CENTS);
assert.ok(P.PAY.plankDelivered>P.OLD_PAY.lumberyardPlank,'a delivered plank pays more than the old $1');
// higher levels: printed for the report (the old felling job speeds up and overtakes the chain; documented, not asserted)
const lv=[1,3,5,7,10].map(l=>{const r=P.wageRule(l,'worktruck');return l+':'+(r.marginPct>=0?'+':'')+r.marginPct+'%'}).join(' ');

// 5. The Prices screen: low stock, high price and the reverse.
const w0=normalizeWorld(null,5,3);
const t0=P.priceTable(w0,3);assert.equal(t0.length,3);assert.deepEqual(t0.map(r=>r.key),['sawmill','supplier','warehouse']);
for(const r of t0){assert.ok(r.priceCents>=Math.round(900*(1-PRICE_BAND_PCT/100))&&r.priceCents<=Math.round(900*(1+PRICE_BAND_PCT/100)));assert.equal(r.priceCents,priceOf(w0,r.place,'planks'));assert.ok(r.target>0&&Number.isInteger(r.stock)&&r.label.length>3)}
const low=structuredClone(w0);for(const k of Object.values(P.PLANK_PLACES))low.stock[k].planks=2;
const tl=P.priceTable(low,3);for(const r of tl){assert.equal(r.note,P.PRICE_NOTES.low);assert.equal(r.priceCents,1125,'a bare shelf is the full +25%')}
const high=structuredClone(w0);for(const k of Object.values(P.PLANK_PLACES))high.stock[k].planks=PLACES[k].goods.planks.max;
for(const r of P.priceTable(high,3)){assert.equal(r.note,P.PRICE_NOTES.high);assert.ok(r.priceCents<900)}
const mid=structuredClone(w0);for(const k of Object.values(P.PLANK_PLACES))mid.stock[k].planks=PLACES[k].goods.planks.target;
for(const r of P.priceTable(mid,3))assert.equal(r.note,P.PRICE_NOTES.normal);
const tm=P.priceTable(low,3,700);assert.equal(tm.length,3);

// 6. Determinism and garbage in.
assert.deepEqual(P.cycleEarnings(4,'shortbed'),P.cycleEarnings(4,'shortbed'));assert.deepEqual(P.priceTable(w0,3),P.priceTable(w0,3));assert.deepEqual(P.existingJobs(5),P.existingJobs(5));
for(const bad of [undefined,null,NaN,Infinity,-5,'x',{},[],0,1e9]){
 const c=P.cycleEarnings(bad,bad);assert.ok(Number.isFinite(c.cents)&&Number.isFinite(c.minutes)&&c.minutes>0&&c.level>=1&&c.level<=20&&c.truck==='worktruck','cycle '+String(bad));
 assert.ok(Number.isFinite(P.hourlyWage(bad,bad)));assert.ok(P.existingJobs(bad).length>=4);assert.ok(P.wageRule(bad,bad).neededCentsPerHour>0);
 const t=P.priceTable(bad,bad,bad);assert.equal(t.length,3);for(const r of t)assert.ok(Number.isInteger(r.priceCents)&&typeof r.note==='string');
}
assert.equal(P.cycleEarnings(1,'sedan').truck,'worktruck');assert.equal(P.cycleEarnings(1,'__proto__').truck,'worktruck');assert.equal(P.priceTable({stock:'x',town:5},-3)[0].place,'property:sawmill');

// 7. Constants are frozen; the module is pure.
for(const name of ['PLANK_PLACES','BED_PLANKS','TOP_SPEED','OLD_PAY','PAY','RIDGELINE_RANKS','CAFE','MARKET_ROUTES','EXCLUDED_FROM_RULE','UNMEASURED_JOBS','PRICE_NOTES','PRICE_LABELS','WAGE_LEVELS_REQUIRED','SAWMILL_POS','WAREHOUSE_POS','LUMBERYARD_POS'])assert.ok(Object.isFrozen(P[name]),name+' frozen');
assert.throws(()=>{'use strict';P.PAY.plankDelivered=1});assert.equal(P.PAY.plankDelivered,730);
{const src=fs.readFileSync(new URL('../dist/plank-economy.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');for(const bad of ['document','window','Date.now','Math.random','performance.now','three','localStorage'])assert.ok(!src.includes(bad),'impure: '+bad)}
{const first=fs.readFileSync(new URL('../dist/plank-economy.js',import.meta.url),'utf8').split('\n')[0];assert.ok(first.startsWith('// plank-economy.js:')&&first.includes('planks-economy-design.md stage P-A'))}

console.log('Plank economy: 1 log = 4 planks, trickle '+P.TRICKLE_PER_DAY+'/day vs old '+P.OLD_SAWMILL_RATE+', level 1 worktruck cycle '+c1.planks+' planks in '+c1.minutes+' game min = $'+(c1.cents/100).toFixed(2)+' ('+c1.centsPerHour+' c/h) beats the best existing job '+r1.bestId+' ('+r1.bestCentsPerHour+' c/h) by '+r1.marginPct+'%, levels '+lv+', Prices screen low/high/normal notes, garbage safe, frozen, pure');
