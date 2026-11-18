import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BEDS,addPlanks,spaceOf,CRATE_MIX} from '../dist/cargo.js';
import {BED_PLANKS,PLANK_BASE_CENTS,PAY,priceTable,PLANK_PLACES} from '../dist/plank-economy.js';
import {DELIVERED_PLANK_PAY} from '../dist/warehouse-intake.js';
import {normalizeWorld} from '../dist/world-state.js';
import {MAP} from '../dist/map-definition.js';
import {SIZES} from '../dist/tickets.js';
import {
 BASE_PLANK_CENTS,DELIVERY_PAY_PER_PLANK,OLD_DELIVERY_PAY,DELIVERY_PRICE_RATIO,DOLLAR_CENTS,
 BED_RUN_PLANKS,BED_FIT_PLANKS,REFUSAL,bedCapacity,remainingBedPlanks,plankPriceOf,runSize,deliveryPay,refusalReason,planDelivery
} from '../dist/plank-delivery.js';

// 1. Constants cross-checked with cargo.js, plank-economy.js, warehouse-intake.js
assert.equal(BASE_PLANK_CENTS,PLANK_BASE_CENTS);
assert.equal(DELIVERY_PAY_PER_PLANK,PAY.plankDelivered);
assert.equal(DELIVERY_PAY_PER_PLANK,DELIVERED_PLANK_PAY);
assert.equal(OLD_DELIVERY_PAY,2500);
assert.equal(DOLLAR_CENTS,100);
assert.equal(Math.round(BASE_PLANK_CENTS*DELIVERY_PRICE_RATIO),DELIVERY_PAY_PER_PLANK);

// 2. Every vehicle in cargo.js BEDS: run size, fit capacity, addPlanks parity
const vehicles=Object.keys(BEDS);
assert.deepEqual(vehicles.sort(),['atv','flatbed','offroad','shortbed','worktruck']);
for(const model of vehicles){
 assert.equal(BED_RUN_PLANKS[model],BED_PLANKS[model],`${model} BED_RUN_PLANKS matches plank-economy BED_PLANKS`);
 assert.equal(BED_RUN_PLANKS[model],spaceOf(model),`${model} spaceOf matches`);
 const fit=bedCapacity(model);
 assert.equal(fit,BED_FIT_PLANKS[model]);
 assert.equal(runSize(model),fit,`${model} runSize without order equals empty fit capacity`);
 assert.equal(addPlanks([],model,fit).error,undefined,`${model} accepts fit capacity (${fit}) via cargo.addPlanks`);
 assert.ok(addPlanks([],model,fit+1).error,`${model} rejects fit+1 (${fit+1}) via cargo.addPlanks`);
 const fullPlan=planDelivery(model,PLANK_BASE_CENTS,{planks:fit,status:'staged'});
 assert.equal(fullPlan.ok,true);
 assert.equal(fullPlan.runSize,fit);
 assert.equal(fullPlan.moved,fit);
 assert.equal(fullPlan.trips,1);
 assert.equal(fullPlan.payCents%100,0,'pay rounded in whole dollars');
 assert.equal(fullPlan.payCents,fullPlan.payDollars*100);
 const overPlan=planDelivery(model,PLANK_BASE_CENTS,{planks:fit+1,status:'staged'});
 assert.equal(overPlan.ok,false);
 assert.equal(overPlan.reason,REFUSAL.OVERFULL);
 assert.equal(overPlan.moved,0);
 assert.equal(overPlan.payCents,0,'refused overfull load pays 0');
}
assert.deepEqual(BED_FIT_PLANKS,{flatbed:120,worktruck:32,offroad:32,atv:4,shortbed:44});

// Bed spec objects and vehicle objects with existing cargo
assert.equal(bedCapacity({space:20}),20);
assert.equal(bedCapacity({model:'worktruck'}),32);
{
 const leftOnBed=remainingBedPlanks('worktruck',[{k:'log'}]);
 assert.equal(leftOnBed,27);
 assert.equal(addPlanks([{k:'log'}],'worktruck',leftOnBed).error,undefined);
 assert.ok(addPlanks([{k:'log'}],'worktruck',leftOnBed+1).error);
}

// 3. Refusal reasons: missing bed, crate mix, zero order, unstaged/no stock, full bed, overfull load
assert.equal(refusalReason(null,{planks:12}),REFUSAL.NO_BED);
assert.equal(refusalReason('sedan',{planks:12}),REFUSAL.NO_BED);
assert.equal(refusalReason({model:'van'},{planks:12}),REFUSAL.NO_BED);
assert.equal(refusalReason('worktruck',{planks:12},[{k:'crate'}]),REFUSAL.CRATE_MIX);
assert.equal(refusalReason('worktruck',{planks:12,kind:'crate'}),REFUSAL.CRATE_MIX);
assert.equal(CRATE_MIX,REFUSAL.CRATE_MIX);
assert.equal(refusalReason('worktruck',{planks:0}),REFUSAL.ZERO_ORDER);
assert.equal(refusalReason('worktruck',{planks:-8}),REFUSAL.ZERO_ORDER);
assert.equal(refusalReason('worktruck',{planks:24,staged:0,status:'taken'}),REFUSAL.NO_STOCK);
assert.equal(refusalReason('worktruck',{planks:12},Array.from({length:8},()=>({k:'planks',n:4}))),REFUSAL.BED_FULL);
assert.equal(refusalReason('atv',{planks:5,status:'staged'}),REFUSAL.OVERFULL,'atv refuses 5 planks because maxPieces=1 fits 4');
assert.equal(refusalReason('worktruck',{planks:40,status:'staged'}),REFUSAL.OVERFULL,'worktruck refuses 40-plank ticket in one load');

// 4. Zero / overfull loads and strict no-free-planks conservation
for(const bad of [0,-5,NaN,Infinity,null,undefined,'12']){
 const p=deliveryPay(bad,PLANK_BASE_CENTS);
 assert.equal(p.planks,0);assert.equal(p.payCents,0);assert.equal(p.payDollars,0);
}
const cappedByStock=planDelivery('worktruck',PLANK_BASE_CENTS,{planks:24,status:'staged'},{availablePlanks:8});
assert.equal(cappedByStock.ok,true);
assert.equal(cappedByStock.moved,8,'cannot pay for more planks than actually available/moved');
assert.equal(cappedByStock.payCents,Math.round(8*DELIVERY_PAY_PER_PLANK/100)*100);
assert.equal(deliveryPay(20,PLANK_BASE_CENTS,{availablePlanks:0}).payCents,0,'0 available planks pays $0');

// Partial multi-trip planning allowed when opts.partial = true
const multi=planDelivery('worktruck',PLANK_BASE_CENTS,{planks:40,status:'staged'},{partial:true});
assert.equal(multi.ok,true);
assert.equal(multi.runSize,32);
assert.equal(multi.moved,32);
assert.equal(multi.left,8);
assert.equal(multi.trips,2);

// 5. Plank-price scaling via plank-economy priceTable and whole-dollar rounding
const wBase=normalizeWorld({day:1,use:{}},MAP.seed,1);
const wLow=normalizeWorld({day:1,stock:{[PLANK_PLACES.warehouse]:{planks:0}},use:{}},MAP.seed,1);
const wHigh=normalizeWorld({day:1,stock:{[PLANK_PLACES.warehouse]:{planks:200}},use:{}},MAP.seed,1);
const ptBase=priceTable(wBase,1,720),ptLow=priceTable(wLow,1,720),ptHigh=priceTable(wHigh,1,720);
assert.ok(plankPriceOf(ptLow,'warehouse')>plankPriceOf(ptBase,'warehouse'));
assert.ok(plankPriceOf(ptHigh,'warehouse')<plankPriceOf(ptBase,'warehouse'));
for(const sz of SIZES){
 const pLo=planDelivery('flatbed',ptLow,{planks:sz,status:'staged'});
 const pBase=planDelivery('flatbed',ptBase,{planks:sz,status:'staged'});
 const pHi=planDelivery('flatbed',ptHigh,{planks:sz,status:'staged'});
 assert.ok(pLo.payCents>pBase.payCents&&pBase.payCents>pHi.payCents,`size ${sz} tracks warehouse price`);
 assert.equal(pLo.payCents%100,0);assert.equal(pBase.payCents%100,0);assert.equal(pHi.payCents%100,0);
 assert.ok(pBase.payCents>OLD_DELIVERY_PAY,`size ${sz} base delivery ($${pBase.payDollars}) exceeds old flat $25`);
}
// Half-dollar rounding verification: 2 planks @ $9.00 world price -> 2 * 730 = 1460 c -> $15 (1500 c); 1 plank -> 730 c -> $7 (700 c)
assert.equal(deliveryPay(1,PLANK_BASE_CENTS).payCents,700);
assert.equal(deliveryPay(2,PLANK_BASE_CENTS).payCents,1500);
assert.equal(deliveryPay(32,PLANK_BASE_CENTS).payCents,23400);

// 6. Determinism, frozen outputs, input immutability, garbage safety, source purity
const sampleOrder={id:7,kind:'delivery',planks:24,status:'staged'};
const snap=structuredClone(sampleOrder);
const r1=planDelivery('worktruck',ptBase,sampleOrder);
const r2=planDelivery('worktruck',ptBase,sampleOrder);
assert.deepEqual(r1,r2,'deterministic planDelivery');
assert.deepEqual(sampleOrder,snap,'order not mutated');
assert.ok(Object.isFrozen(r1)&&Object.isFrozen(BED_RUN_PLANKS)&&Object.isFrozen(BED_FIT_PLANKS)&&Object.isFrozen(REFUSAL));
for(const bad of [undefined,null,NaN,-1,{},[]]){
 assert.ok(Number.isSafeInteger(runSize(bad,bad)));
 assert.ok(Number.isSafeInteger(deliveryPay(bad,bad).payCents));
 const rp=planDelivery(bad,bad,bad,bad);
 assert.equal(rp.ok,false);assert.equal(rp.payCents,0);
}
const src=fs.readFileSync(new URL('../dist/plank-delivery.js',import.meta.url),'utf8');
const firstLine=src.split(/\r?\n/)[0];
assert.ok(firstLine.length<90&&firstLine.includes('planks-economy-design P-D'),`short header <90 chars: ${firstLine}`);
assert.ok(!/document|window|three\.module|Date\.now|Math\.random/.test(src),'pure source');

console.log(`PASS plank-delivery.mjs: all 5 BEDS verified (flatbed 120, shortbed 44, worktruck 32, offroad 32, atv 4), whole-dollar rounding & priceTable scaling, zero free planks, refusals, deterministic, pure.`);
