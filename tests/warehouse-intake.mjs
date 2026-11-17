// P-C (notes/planks-economy-design.md): pure warehouse intake rules, cell-fill pay, pallet-truth mirror sum, stock conservation, garbage safety.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as W from '../dist/warehouse-intake.js';
import * as P from '../dist/plank-economy.js';
import * as Y from '../dist/sawmill-yard.js';
import {RACK_CAP} from '../dist/forest.js';
import {PALLET_CAP,totalPlanks,racksMap} from '../dist/pallets.js';
import {RACK_IDS} from '../dist/warehouse-layout.js';
import {PALLET_LINK} from '../dist/world-goods.js';
import {normalizeWorld} from '../dist/world-state.js';
import {runWorldDay} from '../dist/world-tick.js';
import {freshProgress} from '../dist/jobs.js';
import {MAP} from '../dist/map-definition.js';

// 1. Constants cross-checked against plank-economy.js, forest.js, and pallets.js.
assert.equal(W.RACK_CELL_PLANKS,P.RACK_CELL_PLANKS);
assert.equal(W.RACK_CELL_PLANKS,RACK_CAP);
assert.equal(W.RACK_CELL_PLANKS,PALLET_CAP);
assert.equal(W.PLANKS_PER_STACK,P.PLANKS_PER_STACK);
assert.equal(W.RACK_CELL_PAY,P.PAY.rackCell);
assert.equal(W.DELIVERED_PLANK_PAY,P.PAY.plankDelivered);
assert.equal(W.TOTAL_RACK_CELLS,120);
assert.equal(W.HAND_RACK_IDS.length,40);

// 2. Partial cell pays nothing until it fills; a full cell pays once; multiple cells pay once each.
const p1=W.intakePlan({},36);
assert.equal(p1.stored,36);assert.equal(p1.left,0);
assert.equal(p1.fullCellsBefore,0);assert.equal(p1.fullCells,0);assert.equal(p1.newlyFilled,0);
assert.equal(W.payFor(p1),0,'partial cell pays nothing');
assert.equal(W.payFor(p1.stored,p1.fullCellsBefore,p1.fullCells),0);

const p2=W.intakePlan(p1.cells,4);
assert.equal(p2.stored,4);assert.equal(p2.left,0);
assert.equal(p2.fullCellsBefore,0);assert.equal(p2.fullCells,1);assert.equal(p2.newlyFilled,1);
assert.equal(W.payFor(p2),W.RACK_CELL_PAY,'filling the remaining 4 planks pays once');

const p2Noop=W.intakePlan(p2.cells,0);
assert.equal(W.payFor(p2Noop),0,'0 stored pays nothing even if cell is full');
assert.equal(W.payFor(0,0,1),0,'never pays when stored === 0');

// Two full cells at once -> 2 * RACK_CELL_PAY.
const p80=W.intakePlan({},80);
assert.equal(p80.stored,80);assert.equal(p80.fullCells,2);assert.equal(p80.newlyFilled,2);
assert.equal(W.payFor(p80),2*W.RACK_CELL_PAY);

// 3. Conservation: stored + left === offered, cell sum rises by exactly stored; yard-to-rack helper conserves total planks.
for(const offer of [1,4,39,40,44,125]){
 const r=W.intakePlan(p1.cells,offer);
 assert.equal(r.stored+r.left,offer,`conservation offered=${offer}`);
 assert.equal(W.cellPlanks(r.cells)-W.cellPlanks(p1.cells),r.stored,`cell sum delta === stored (${offer})`);
}
const yard0=Y.trickle(Y.feed(Y.freshYard(),2).state,1); // 6 planks from trickle + saw 2 logs = 14 total after tick
const yard1=Y.tick(yard0,2*Y.SAW_MIN_PER_LOG);
assert.equal(yard1.planks,14);
const flow=W.intakeFromYard(yard1,{},3); // 3 stacks = 12 planks moved
assert.equal(flow.taken,12);assert.equal(flow.stored,12);assert.equal(flow.left,0);
assert.equal(flow.yard.planks+W.cellPlanks(flow.cells),yard1.planks,'yard + cells conserves all planks');

// 4. Full racks leave everything with the player; near-full stores only free space.
const allFull=Object.fromEntries(RACK_IDS.map(id=>[id,W.RACK_CELL_PLANKS]));
const overFull=W.intakePlan(allFull,12);
assert.equal(overFull.stored,0);assert.equal(overFull.left,12);
assert.deepEqual(overFull.cells,W.normalizeCells(allFull));
assert.equal(W.payFor(overFull),0);

const twoLeft={...allFull,[W.INTAKE_ORDER[0]]:W.RACK_CELL_PLANKS-2};
const near=W.intakePlan(twoLeft,12);
assert.equal(near.stored,2);assert.equal(near.left,10);
assert.equal(W.cellPlanks(near.cells)-W.cellPlanks(twoLeft),2);
assert.equal(W.payFor(near),W.RACK_CELL_PAY);

// 5. Spreads across several cells in stable order (INTAKE_ORDER), topping up partial cells first.
const spread=W.intakePlan({},92);
assert.deepEqual(spread.touched,W.INTAKE_ORDER.slice(0,3));
assert.equal(spread.cells[W.INTAKE_ORDER[0]],40);
assert.equal(spread.cells[W.INTAKE_ORDER[1]],40);
assert.equal(spread.cells[W.INTAKE_ORDER[2]],12);
assert.equal(racksMap(W.toCompany(spread.cells))[W.INTAKE_ORDER[1]],40);
const handOnly=W.intakePlan({},W.HAND_RACK_MAX_PLANKS+8,{handOnly:true});
assert.equal(handOnly.stored,W.HAND_RACK_MAX_PLANKS);assert.equal(handOnly.left,8);

// 6. Mirror sum equals pallets.totalPlanks and world-tick mirrorPallets on the same cells.
for(const cellsSample of [{},{[W.INTAKE_ORDER[0]]:16,[W.INTAKE_ORDER[1]]:40},spread.cells,allFull]){
 const co=W.toCompany(cellsSample);
 assert.equal(W.cellPlanks(cellsSample),totalPlanks(co),'cellPlanks matches pallets.totalPlanks');
 const base=freshProgress();
 const prog={...base,world:normalizeWorld({day:0,use:{}},MAP.seed,0),companies:{[PALLET_LINK.company]:co}};
 const ticked=runWorldDay(prog,1,{seed:MAP.seed});
 assert.equal(W.mirrorPlankSum(cellsSample),ticked.world.stock[PALLET_LINK.place][PALLET_LINK.good],'mirrorPlankSum matches world-tick mirrorPallets');
}

// 7. summarize & normalizeCells round-trip with pallets company shape.
const sum=W.summarize(spread.cells);
assert.equal(sum.planks,92);assert.equal(sum.mirroredPlanks,92);
assert.equal(sum.usedCells,3);assert.equal(sum.fullCells,2);assert.equal(sum.partialCells,1);
assert.equal(sum.freeCells,117);assert.equal(sum.freePlankSpace,W.MAX_RACK_PLANKS-92);
assert.deepEqual(W.normalizeCells(W.toCompany(spread.cells)),spread.cells);

// 8. Garbage safety, input immutability, determinism, and source purity.
const frozenCells=W.normalizeCells({[W.INTAKE_ORDER[0]]:16});
const beforeSnap=structuredClone(frozenCells);
for(const bad of [undefined,null,NaN,Infinity,-Infinity,-5,0,'x','40',{},[],{A1:-5,bogus:999}]){
 const nc=W.normalizeCells(bad);
 assert.ok(Object.isFrozen(nc));
 const ip=W.intakePlan(frozenCells,bad,bad);
 assert.ok(Object.isFrozen(ip)&&Object.isFrozen(ip.cells)&&Object.isFrozen(ip.touched));
 assert.equal(ip.stored+ip.left,Number.isFinite(bad)&&bad>0?Math.floor(bad):0);
 assert.ok(Number.isSafeInteger(W.payFor(bad,bad,bad))&&W.payFor(bad,bad,bad)>=0);
 assert.ok(Object.isFrozen(W.summarize(bad)));
 assert.ok(Number.isSafeInteger(W.mirrorPlankSum(bad,bad)));
 assert.ok(Object.isFrozen(W.intakeFromYard(bad,bad,bad,bad)));
}
assert.deepEqual(frozenCells,beforeSnap,'input cells never mutated');
assert.deepEqual(W.intakePlan(frozenCells,48),W.intakePlan(frozenCells,48),'deterministic intakePlan');
assert.equal(W.payFor(48,0,1),W.payFor(48,0,1),'deterministic payFor');

{
 const src=fs.readFileSync(new URL('../dist/warehouse-intake.js',import.meta.url),'utf8');
 const first=src.split('\n')[0];
 assert.ok(first.startsWith('// warehouse-intake.js:')&&first.includes('planks-economy-design.md stage P-C'),'header comment on line 1');
 const body=src.replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three','localStorage'])assert.ok(!body.includes(bad),'impure: '+bad);
}

console.log('PASS warehouse-intake: cell-fill pay '+W.RACK_CELL_PAY+' c once per '+W.RACK_CELL_PLANKS+'-plank cell, strict conservation, full-rack overflow kept, stable INTAKE_ORDER, mirrorPlankSum === world-tick mirrorPallets, garbage/immutability/purity');
