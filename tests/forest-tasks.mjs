import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {worldLayout} from '../dist/world.js';
import {hire} from '../dist/careers.js';
import {clockIn,TASKS,PIECE_PAY,dailyTasks,normalizeShift} from '../dist/shift.js';
import {equipTool} from '../dist/inventory.js';
import {MAP} from '../dist/map-definition.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {logGathered,stumpCleared,saplingPlanted,markedTrees} from '../dist/forest.js';
import {clearStump,plantSapling,regrowTrees,treeStage,felledStages,normalizePlots,SAPLING_AFTER,MATURE_AFTER,CLEARED_HOLD} from '../dist/grid.js';
import {trackerItems} from '../dist/tracker.js';

// The new Ridgeline tasks (0.35): gather fallen logs, dig out stumps, plant saplings in the cleared ground.
const trees=worldLayout().cuttable,DAY=3,tree=markedTrees(trees,DAY)[0],key=tree.key;
assert(TASKS.gather&&TASKS.stumps&&TASKS.replant,'the three kinds exist');assert(PIECE_PAY.gathered>0&&PIECE_PAY.stumps>0&&PIECE_PAY.saplings>0,'and each piece pays');
assert(MAP.employers[0].ranks[0].tasks.includes('gather'),'trainees gather logs');assert(MAP.employers[0].ranks[1].tasks.includes('stumps'),'fellers dig out stumps');assert(MAP.employers[0].ranks[4].tasks.includes('replant'),'sawyers replant');

// pure rules ------------------------------------------------------------------------------------------------------------
const base=hire(freshProgress(),'ridgeline').state,onShift=equipTool(clockIn({...base,housing:{...base.housing,day:DAY},routine:{...base.routine,minutes:600}},'ridgeline').state,'axe').state;
{ // gathered: once per log per shift
 const none=logGathered(base,7);assert.equal(none.counted,false,'off shift nothing counts');
 const a=logGathered({...onShift,shift:{...onShift.shift,tasks:[{kind:'gather',piece:'gathered',target:2,done:0}]}},7);assert.equal(a.counted,true);assert.equal(a.state.shift.pieces.gathered,1);assert.deepEqual(a.state.shift.gathered,[7]);
 const again=logGathered(a.state,7);assert.equal(again.counted,false,'the same log counts once (put down and picked up again pays nothing)');assert.equal(again.state.shift.pieces.gathered,1);
 const b=logGathered(a.state,8);assert.equal(b.state.shift.tasks[0].done,2,'another log counts');assert(/Task done/.test(b.message),b.message);
 assert.deepEqual(normalizeShift(a.state.shift,a.state.careers).gathered,[7],'the list is saved');assert.equal(normalizeShift({...a.state.shift,gathered:['x',-1,3.5]},a.state.careers).gathered,undefined,'junk is dropped');
}
{ // a stump: dug out with the axe in hand, only when fresh
 const felled={...onShift,plots:{[key]:{type:'forest',tree:null,hits:0,felledAt:600}}};
 assert(/axe/i.test(clearStump({...felled,equipped:null},key).error),'needs the axe in hand');
 assert(/no stump/i.test(clearStump(onShift,key).error),'a standing pine is not a stump');
 assert(/Move closer/.test(clearStump(felled,key,{x:tree.x+50,z:tree.z}).error));
 const r=clearStump(felled,key,{x:tree.x-1,z:tree.z});assert(!r.error&&r.state.plots[key].clearedAt===600+(felled.routine.minutes-600)+((felled.housing.day-1)*1440),'cleared at the game time');assert.equal(treeStage(r.state.plots[key],5000),'cleared');
 assert(/already cleared/.test(clearStump(r.state,key).error));
 const old={...felled,plots:{[key]:{type:'forest',tree:null,hits:0,felledAt:0}},housing:{...felled.housing,day:9}};assert(/growing back/.test(clearStump(old,key).error),'a sapling cannot be dug out');
 assert.equal(stumpCleared(r.state).state.shift.pieces.stumps,1);
 // planting: only in cleared ground, it is a sapling at once and a pine after four more days
 assert(/cleared ground/i.test(plantSapling(felled,key).error));
 const pl=plantSapling(r.state,key,{x:tree.x-1,z:tree.z});assert(!pl.error);const now=(r.state.housing.day-1)*1440+r.state.routine.minutes;assert.equal(treeStage(pl.state.plots[key],now),'sapling');assert.equal(treeStage(pl.state.plots[key],now+MATURE_AFTER-SAPLING_AFTER),'mature','a pine again after four days');assert.equal(pl.state.plots[key].clearedAt,undefined);
 assert.equal(saplingPlanted(pl.state).state.shift.pieces.saplings,1);
 // cleared ground left alone: nothing grows for three days, then nature seeds it; the replant task is how you beat it
 const left=regrowTrees(r.state,now+CLEARED_HOLD-1);assert.equal(left.state.plots[key].clearedAt!==undefined,true,'still bare');
 const seeded=regrowTrees(r.state,now+CLEARED_HOLD);assert.equal(seeded.state.plots[key].clearedAt,undefined);assert.equal(treeStage(seeded.state.plots[key],now+CLEARED_HOLD),'sapling','seeded by nature');
 // saved plots keep clearedAt
 assert.equal(normalizePlots(r.state.plots)[key].clearedAt,r.state.plots[key].clearedAt);assert.deepEqual(felledStages(r.state,now).find(([k])=>k===key),[key,'cleared']);
}
{ // the tracker points at them
 const pr={...onShift,shift:{...onShift.shift,tasks:[{kind:'gather',piece:'gathered',target:6,done:0},{kind:'stumps',piece:'stumps',target:3,done:0},{kind:'replant',piece:'saplings',target:6,done:0}]},logs:[{id:1,x:100,z:-250,rot:0,t:0}],plots:{[key]:{type:'forest',tree:null,hits:0,felledAt:600}}};
 const items=trackerItems(pr,{x:0,z:0});assert.deepEqual(items.map(i=>i.id),['task:gather','task:stumps','task:replant']);assert.deepEqual(items[0].pos,{x:100,z:-250},'gather points at the nearest log');
 assert(Math.abs(items[1].pos.x-(Math.floor(tree.x)+.5))<1.01,'stumps point at the stump');assert.equal(items[2].title,'Plant 6 saplings in a cleared block');
}

// in the packaged game -----------------------------------------------------------------------------------------------------
const g=await bootGame({position:{x:tree.x-1.4,z:tree.z}});
try{
 const {GameState,pump,send,ids}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent;
 const hold=seconds=>{send('keydown','KeyE');pump(seconds);send('keyup','KeyE');pump(.5)};
 GameState.progress={...equipTool(hire(p(),'ridgeline').state,'axe').state,housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:600}};
 GameState.progress={...clockIn(p(),'ridgeline').state,};
 GameState.progress={...p(),shift:{...p().shift,tasks:[{kind:'gather',piece:'gathered',target:2,done:0},{kind:'stumps',piece:'stumps',target:1,done:0},{kind:'replant',piece:'saplings',target:1,done:0}]}};pump(1);
 hold(7);assert.equal(p().plots[key].tree,null,'the pine was felled');pump(2);
 // gather: pick a log off the ground
 const log=p().logs[0];assert(log,'the felled pine left logs');me().x=log.x;me().z=log.z;pump(.6);assert(/Pick up wood log/.test(prompt()),prompt());hold(.2);pump(1.5);
 assert.equal(p().shift.pieces.gathered,1,'the log counted as gathered');assert(p().carry,'and is on the shoulder');
 // the stump: dig it out
 me().x=tree.x-1.4;me().z=tree.z;GameState.progress={...p(),carry:null};pump(.8);
 assert(/Dig out the stump|equip your axe/.test(prompt()),'the stump offers itself: '+prompt());
 if(!/Dig out the stump/.test(prompt())){const eq=equipTool(p(),'axe');GameState.progress=eq.state;pump(.8)}
 assert(/Dig out the stump/.test(prompt()),prompt());hold(2.5);
 assert(p().plots[key].clearedAt!=null,'the stump is dug out');assert.equal(p().shift.pieces.stumps,1,'and counted');
 // the bare ground takes a sapling
 pump(.6);assert(/Plant a sapling/.test(prompt()),'the bare ground offers a sapling: '+prompt());hold(.2);pump(.5);
 assert.equal(p().plots[key].clearedAt,undefined);assert.equal(treeStage(p().plots[key],(p().housing.day-1)*1440+p().routine.minutes),'sapling');assert.equal(p().shift.pieces.saplings,1,'and counted');
 console.log('Forest tasks: gathering counts a log once a shift, a fresh stump is dug out with the axe (bare ground, three days to seed), a sapling goes in the bare ground (a pine again after four days), the tracker points at logs, stumps and bare ground, and the whole run works in the game.');
}finally{g.close?.()}
