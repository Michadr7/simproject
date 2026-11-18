// P-B (notes/planks-economy-design.md): player-fed sawmill yard pure rules, frame-rate independence, trickle idempotence, clamps, garbage safety, normalization.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Y from '../dist/sawmill-yard.js';
import {LOGS_TO_PLANKS,PLANKS_PER_STACK as ECON_STACK,TRICKLE_PER_DAY,SAW_MIN_PER_LOG} from '../dist/plank-economy.js';
import {PLANKS_PER_STACK as CARRY_STACK} from '../dist/carry.js';
import {PLACES} from '../dist/world-goods.js';

// 1. Constants cross-checked against plank-economy.js, carry.js, and world-goods.js.
assert.equal(Y.LOGS_TO_PLANKS,LOGS_TO_PLANKS);
assert.equal(Y.LOGS_TO_PLANKS,4);
assert.equal(Y.PLANKS_PER_STACK,ECON_STACK);
assert.equal(Y.PLANKS_PER_STACK,CARRY_STACK);
assert.equal(Y.TRICKLE_PER_DAY,TRICKLE_PER_DAY);
assert.equal(Y.TRICKLE_PER_DAY,6);
assert.equal(Y.SAW_MIN_PER_LOG,SAW_MIN_PER_LOG);
assert.equal(Y.YARD_MAX_PLANKS,PLACES['property:sawmill'].goods.planks.max);
assert.equal(Y.YARD_CAPACITY,Y.YARD_MAX_PLANKS);
assert.equal(Y.YARD_VERSION,2);

// 2. 1 log = 4 planks; multiple logs work across tick.
const y0=Y.freshYard();
assert.deepEqual(y0,{v:2,trunks:0,logs:0,trunksSawn:0,logsSawn:0,planks:0,slabs:0,cutMin:0,cutKind:null,on:false,lastTrickleDay:0});
const f1=Y.feed(y0,1);
assert.equal(f1.accepted,1);assert.equal(f1.refused,0);assert.equal(f1.state.logs,1);assert.equal(f1.state.on,true);
const s1=Y.tick(f1.state,Y.SAW_MIN_PER_LOG);
assert.equal(s1.logs,0);assert.equal(s1.logsSawn,1);assert.equal(s1.planks,4);assert.equal(s1.cutMin,0);assert.equal(s1.on,false);

const f3=Y.feed(y0,3);
const s3=Y.tick(f3.state,3*Y.SAW_MIN_PER_LOG);
assert.equal(s3.logs,0);assert.equal(s3.logsSawn,3);assert.equal(s3.planks,12);assert.equal(s3.cutMin,0);assert.equal(s3.on,false);

// Switch toggle: off pauses tick, on resumes it.
const paused=Y.switchSaw(f3.state,false);
assert.equal(paused.on,false);
assert.deepEqual(Y.tick(paused,Y.SAW_MIN_PER_LOG),paused);
const resumed=Y.switchSaw(paused);
assert.equal(resumed.on,true);
assert.equal(Y.tick(resumed,Y.SAW_MIN_PER_LOG).logsSawn,1);

// 3. Time-based sawing is frame-rate independent (30, 60, and 144 steps per second).
const runSteps=(logs,durationMin,hz)=>{
 let st=Y.feed(Y.freshYard(),logs).state;
 const steps=Math.round(durationMin*hz),dt=1/hz;
 for(let i=0;i<steps;i++)st=Y.tick(st,dt);
 return st;
};
for(const durationMin of [Y.SAW_MIN_PER_LOG*1.5,Y.SAW_MIN_PER_LOG*3]){
 const r30=runSteps(3,durationMin,30);
 const r60=runSteps(3,durationMin,60);
 const r144=runSteps(3,durationMin,144);
 assert.deepEqual(r30,r60,`30 Hz vs 60 Hz at ${durationMin} min`);
 assert.deepEqual(r60,r144,`60 Hz vs 144 Hz at ${durationMin} min`);
}
const partial144=runSteps(3,Y.SAW_MIN_PER_LOG*1.5,144);
assert.equal(partial144.logs,2);assert.equal(partial144.logsSawn,1);assert.equal(partial144.planks,4);assert.equal(partial144.cutMin,Y.SAW_MIN_PER_LOG*0.5);
const done144=runSteps(3,Y.SAW_MIN_PER_LOG*3,144);
assert.equal(done144.logs,0);assert.equal(done144.logsSawn,3);assert.equal(done144.planks,12);assert.equal(done144.cutMin,0);

// 4. Daily trickle: 6 a day, idempotent for the same day, skips day <= 0.
const t0=Y.trickle(y0,0);
assert.deepEqual(t0,y0,'day 0 changes nothing');
const t1=Y.trickle(y0,1);
assert.equal(t1.planks,6);assert.equal(t1.lastTrickleDay,1);
assert.deepEqual(Y.trickle(t1,1),t1,'same day trickle is idempotent');
assert.deepEqual(Y.trickle(t1,0),t1,'earlier day trickle changes nothing');
const t2=Y.trickle(t1,2);
assert.equal(t2.planks,12);assert.equal(t2.lastTrickleDay,2);

// 5. takeStack gives 4 and never more than the stock.
const tk1=Y.takeStack(t1);
assert.equal(tk1.planks,4);assert.equal(tk1.state.planks,2);
const tk2=Y.takeStack(tk1.state);
assert.equal(tk2.planks,2);assert.equal(tk2.state.planks,0);
const tk3=Y.takeStack(tk2.state);
assert.equal(tk3.planks,0);assert.equal(tk3.state.planks,0);

// 6. Capacity clamp (logs bench, trickle, and sawing into near-full yard).
const over=Y.feed(y0,Y.YARD_MAX_LOGS+15);
assert.equal(over.accepted,Y.YARD_MAX_LOGS);assert.equal(over.refused,15);assert.equal(over.state.logs,Y.YARD_MAX_LOGS);
const overAgain=Y.feed(over.state,3);
assert.equal(overAgain.accepted,0);assert.equal(overAgain.refused,3);

const nearFull=Y.normalizeYard({logs:3,planks:Y.YARD_MAX_PLANKS-4,on:true});
assert.equal(Y.trickle(nearFull,5).planks,Y.YARD_MAX_PLANKS,'trickle clamps at YARD_MAX_PLANKS');
const sawStop=Y.tick(nearFull,Y.SAW_MIN_PER_LOG*5);
assert.equal(sawStop.planks,Y.YARD_MAX_PLANKS);assert.equal(sawStop.logsSawn,1);assert.equal(sawStop.logs,2);assert.equal(sawStop.on,false);assert.equal(sawStop.cutMin,0);

// 7. summarize matches current state.
const sum=Y.summarize(partial144);
assert.equal(sum.logsWaiting,2);assert.equal(sum.stacks,1);assert.equal(sum.loosePlanks,0);
assert.equal(sum.canTake,true);assert.equal(sum.canTakeStack,true);assert.equal(sum.canFeed,true);
assert.equal(sum.cutProgress,0.5);assert.equal(sum.minutesLeft,2*Y.SAW_MIN_PER_LOG-partial144.cutMin);

// 8. normalizeYard on null / {} / old version & garbage safety / immutability / determinism.
assert.deepEqual(Y.normalizeYard(null),y0);
assert.deepEqual(Y.normalizeYard({}),y0);
const oldSave=Y.normalizeYard({v:0,logsWaiting:2,logsSawn:5,stock:8,cutMin:1.5,lastTrickleDay:3});
assert.deepEqual(oldSave,{v:2,trunks:0,logs:2,trunksSawn:0,logsSawn:5,planks:8,slabs:0,cutMin:1.5,cutKind:'log',on:true,lastTrickleDay:3});

const frozenInput=Y.feed(y0,2).state;
const beforeSnap=structuredClone(frozenInput);
assert.ok(Object.isFrozen(frozenInput));
const gBad=[undefined,null,NaN,Infinity,-Infinity,-5,0,'x','4',{},[],{v:0,logs:-3,planks:'bad',cutMin:NaN,on:'yes',lastTrickleDay:-9}];
for(const bad of gBad){
 const ny=Y.normalizeYard(bad);
 assert.equal(ny.v,2);assert.ok(ny.logs>=0&&ny.logs<=Y.YARD_MAX_LOGS);assert.ok(ny.planks>=0&&ny.planks<=Y.YARD_MAX_PLANKS);
 assert.ok(Object.isFrozen(ny));
 assert.ok(Object.isFrozen(Y.feed(frozenInput,bad).state));
 assert.ok(Object.isFrozen(Y.tick(frozenInput,bad)));
 assert.ok(Object.isFrozen(Y.trickle(frozenInput,bad)));
 assert.ok(Object.isFrozen(Y.takeStack(bad).state));
 assert.ok(Object.isFrozen(Y.switchSaw(bad,bad)));
 assert.ok(Object.isFrozen(Y.summarize(bad)));
}
assert.deepEqual(frozenInput,beforeSnap,'input state never mutated');
assert.deepEqual(Y.tick(f3.state,Y.SAW_MIN_PER_LOG*1.5),Y.tick(f3.state,Y.SAW_MIN_PER_LOG*1.5),'deterministic tick');

// 9. Pure source checks.
{
 const src=fs.readFileSync(new URL('../dist/sawmill-yard.js',import.meta.url),'utf8');
 const first=src.split('\n')[0];
 assert.ok(first.startsWith('// sawmill-yard.js:')&&first.includes('planks-economy-design.md stage P-B'),'header comment on line 1');
 const body=src.replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three','localStorage'])assert.ok(!body.includes(bad),'impure: '+bad);
}

console.log('PASS sawmill-yard: 1 log = 4 planks, 30/60/144 Hz frame-rate independent sawing ('+Y.SAW_MIN_PER_LOG+' game min/log), trickle '+Y.TRICKLE_PER_DAY+'/day idempotent, clamp '+Y.YARD_MAX_LOGS+' logs / '+Y.YARD_MAX_PLANKS+' planks, takeStack max '+Y.PLANKS_PER_STACK+', normalizeYard/garbage safe, immutable, deterministic, pure');
