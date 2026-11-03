import assert from 'node:assert/strict';
import {BELT_SLOTS,PLANKS_PER_STACK,MAX_PLANK_DROPS,normalizeCarry,normalizeBelt,normalizePlankDrops,beltFull,shoulderLog,putDownLog,feedLog,takePlanks,putDownPlanks,pickUpPlanks} from '../dist/carry.js';
import {freshProgress,normalizeProgress,saveProgress,loadProgress} from '../dist/jobs.js';
import {countItem} from '../dist/inventory.js';

// Carrying: a log on the shoulder (never the bag), planks in the hands, one thing at a time; the belt takes a log only while the saw is on and there is room.
const log={id:7,x:100,z:-250,rot:1,t:5};
const ground={...freshProgress(),logs:[log,{...log,id:8,x:101}],nextLogId:9};
// 1. Picking up a log.
let s=shoulderLog(ground,7);assert.deepEqual(s.state.carry,{kind:'log'});assert.equal(countItem(s.state,'wood-log'),0,'not in the bag');assert.deepEqual(s.state.logs.map(l=>l.id),[8]);assert.equal(s.state.stats.logsCollected,1);
assert.match(shoulderLog(s.state,8).error,/hands are full/);assert.match(shoulderLog(ground,99).error,/gone/);assert.equal(ground.carry,null,'the old state is not changed');
// 2. Putting it down: it goes back on the ground as a normal log (and can be picked up again).
const down=putDownLog(s.state,{x:102,z:-251,rot:.5});assert.equal(down.state.carry,null);assert.deepEqual(down.state.logs.map(l=>l.id),[8,9]);assert.equal(down.state.nextLogId,10);assert.deepEqual(down.state.logs[1],{id:9,x:102,z:-251,rot:.5,t:540},'stamped with the game time (so it expires like any log)');
assert.match(putDownLog(ground,{x:0,z:0}).error,/not carrying/);assert.deepEqual(shoulderLog(down.state,9).state.carry,{kind:'log'});
// 3. Feeding the saw: needs a log, the saw on and room on the belt; the stack counts at once.
assert.match(feedLog(ground,true).error,/log on your shoulder/);assert.match(feedLog(s.state,false).error,/Switch the saw on first/);
let f=feedLog(s.state,true);assert.equal(f.state.carry,null);assert.equal(f.state.belt,1);assert.equal(s.state.belt,0);
const nearlyFull={...s.state,belt:BELT_SLOTS-1};assert.equal(feedLog(nearlyFull,true).state.belt,BELT_SLOTS);
const full={...s.state,belt:BELT_SLOTS};assert(beltFull(full));assert.match(feedLog(full,true).error,/belt is full/);assert.deepEqual(full.carry,{kind:'log'},'a refused log stays on the shoulder');
// 4. Taking planks: one stack of 4 per trip, only with free hands, only from a belt that has one.
assert.match(takePlanks(freshProgress()).error,/empty/);assert.match(takePlanks({...full,belt:2}).error,/hands are full/);
let t=takePlanks({...full,carry:null});assert.deepEqual(t.state.carry,{kind:'planks',count:PLANKS_PER_STACK});assert.equal(t.state.belt,BELT_SLOTS-1);assert(!beltFull(t.state),'taking one stack makes room again');assert.equal(PLANKS_PER_STACK,4);
assert.match(takePlanks(t.state).error,/hands are full/,'cannot take a second stack');assert.match(feedLog(t.state,true).error,/log on your shoulder/,'planks are not a log');
// 5. Planks put down and picked up again; at most 8 stacks.
let p=putDownPlanks(t.state,{x:104,z:-260});assert.equal(p.state.carry,null);assert.deepEqual(p.state.plankDrops,[{id:1,x:104,z:-260,count:4}]);assert.match(putDownPlanks(p.state,{x:0,z:0}).error,/not carrying/);
let back=pickUpPlanks(p.state,1);assert.deepEqual(back.state.carry,{kind:'planks',count:4});assert.deepEqual(back.state.plankDrops,[]);assert.match(pickUpPlanks(p.state,5).error,/gone/);assert.match(pickUpPlanks(t.state,1).error,/hands are full/);
let many=freshProgress();for(let i=0;i<MAX_PLANK_DROPS;i++)many=putDownPlanks({...many,carry:{kind:'planks',count:4}},{x:100+i,z:-260}).state;assert.equal(many.plankDrops.length,MAX_PLANK_DROPS);assert.deepEqual(many.plankDrops.map(d=>d.id),[1,2,3,4,5,6,7,8]);
assert.match(putDownPlanks({...many,carry:{kind:'planks',count:4}},{x:0,z:0}).error,/no room/);
// 6. The belt loop: four logs fill it, the fifth is refused, one stack out makes room.
{const log1=x=>({...x,carry:{kind:'log'}});let g=freshProgress();for(let i=0;i<BELT_SLOTS;i++)g=feedLog(log1(g),true).state;assert.equal(g.belt,BELT_SLOTS,'four logs fill the belt');assert.match(feedLog(log1(g),true).error,/belt is full/,'the fifth is refused');
 g=takePlanks(g).state;assert.equal(g.belt,BELT_SLOTS-1);const again=feedLog(log1(g),true);assert.equal(again.state.belt,BELT_SLOTS,'one stack taken: there is room for one more log')}
// 7. Saves: additive fields with defaults; old saves load; garbage is dropped.
{const fresh=freshProgress();assert.deepEqual([fresh.carry,fresh.belt,fresh.plankDrops],[null,0,[]]);
 const old=normalizeProgress({cash:500});assert.deepEqual([old.carry,old.belt,old.plankDrops],[null,0,[]],'a save from before the sawmill loads');
 const n=normalizeProgress({carry:{kind:'planks',count:3},belt:3,plankDrops:[{id:2,x:104,z:-260,count:2}]});assert.deepEqual([n.carry,n.belt,n.plankDrops],[{kind:'planks',count:3},3,[{id:2,x:104,z:-260,count:2}]]);
 assert.equal(normalizeProgress({belt:9}).belt,BELT_SLOTS,'capped');assert.equal(normalizeProgress({belt:-1}).belt,0);assert.equal(normalizeProgress({belt:1.5}).belt,0);assert.equal(normalizeProgress({belt:'3'}).belt,0);
 assert.equal(normalizeCarry({kind:'planks',count:5}),null);assert.equal(normalizeCarry({kind:'planks',count:0}),null);assert.equal(normalizeCarry({kind:'stone'}),null);assert.deepEqual(normalizeCarry({kind:'log',extra:1}),{kind:'log'});assert.equal(normalizeCarry('log'),null);
 assert.deepEqual(normalizePlankDrops([{id:1,x:104,z:-260,count:4},{id:1,x:105,z:-260,count:4},{id:2,x:9999,z:0,count:4},{id:3,x:104,z:-261,count:9},{id:0,x:104,z:-262,count:1},null,'x']),[{id:1,x:104,z:-260,count:4}]);
 assert.deepEqual(normalizePlankDrops('nope'),[]);assert.equal(normalizePlankDrops(Array.from({length:20},(_,i)=>({id:i+1,x:100+i*.5,z:-260,count:1}))).length,MAX_PLANK_DROPS);
 let raw;const storage={getItem:()=>raw,setItem:(k,v)=>raw=v};saveProgress(storage,{...freshProgress(),carry:{kind:'log'},belt:4,plankDrops:p.state.plankDrops});const loaded=loadProgress(storage);assert.deepEqual([loaded.carry,loaded.belt,loaded.plankDrops],[{kind:'log'},4,[{id:1,x:104,z:-260,count:4}]],'survives a save and load');
 assert.equal(normalizeBelt(0),0)}
console.log('Carry: a log on the shoulder (not the bag), planks in the hands, one thing at a time; the saw takes a log only while on and with room; four stacks fill the belt and one taken makes room; planks can be put down (8 stacks); the three fields save additively and old saves load.');
