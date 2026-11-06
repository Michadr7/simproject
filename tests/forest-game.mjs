import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {worldLayout} from '../dist/world.js';
import {hire,careerOf} from '../dist/careers.js';
import {clockIn,clockOut,shiftPay} from '../dist/shift.js';
import {equipTool} from '../dist/inventory.js';
import {isMarked,markedTrees,LANDING} from '../dist/forest.js';

// Step 4 in the packaged game: on shift the day's marked pines wear a band (one InstancedMesh), a marked pine felled with the axe counts as a tree, an unmarked one costs
// reputation, a log stacked at the landing counts and pays; off shift the forest is closed and the marks are gone.
const trees=worldLayout().cuttable,DAY=3,marked=markedTrees(trees,DAY)[0],unmarked=trees.find(t=>!isMarked(t,DAY)&&Math.hypot(t.x-marked.x,t.z-marked.z)>30);
const g=await bootGame({position:{x:marked.x-1.4,z:marked.z}});
try{
 const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const prompt=()=>ids.get('prompt').querySelector('span').textContent,marks=()=>scene().getObjectByName('tree-marks'),ring=()=>scene().getObjectByName('landing-ring');
 const setClock=(day,minutes)=>{GameState.progress={...p(),housing:{...p().housing,day},routine:{...p().routine,minutes}}};
 const stand=t=>{me().x=t.x-1.4;me().z=t.z};
 const chop=seconds=>{send('keydown','KeyE');pump(seconds);send('keyup','KeyE');pump(.5)};
 // hired, but not clocked in: no marks, no ring, the forest is closed
 setClock(DAY,540);GameState.progress=equipTool(hire(p(),'ridgeline').state,'axe').state;pump(1);
 assert.equal(marks().visible,false,'no marks off shift');assert.equal(ring().visible,false,'no landing ring off shift');
 stand(marked);pump(.6);assert(/clock in to work it/i.test(prompt()),'the pine says the forest is closed: '+prompt());
 chop(2);assert.equal(p().plots[marked.key],undefined,'nothing is chopped off shift');
 // on shift: the band and the ring appear on the day's marked pines
 GameState.progress=clockIn(p(),'ridgeline').state;pump(1);
 const want=markedTrees(trees,DAY).length;assert.equal(marks().visible,true);assert.equal(marks().count,want,`${want} marked pines wear a band`);assert.equal(ring().visible,true);assert.equal(g.scene().getObjectByName('tree-mark-rings').count,want);
 // a marked pine: four swings with the starter axe; it counts as a tree
 stand(marked);pump(.6);assert(/Chop pine/.test(prompt()),'the pine can be chopped: '+prompt());
 chop(7);assert.equal(p().plots[marked.key].tree,null,'the marked pine was felled');assert.equal(p().shift.pieces.trees,1,'and counted');assert(/marked pine: \$3\.00|Task done/.test(ids.get('jobToast').textContent),'the toast says so: '+ids.get('jobToast').textContent);
 pump(1);assert.equal(marks().count,want-1,'its band is gone');
 // an unmarked pine: no count, and the foreman hears of it
 const rep=careerOf(p(),'ridgeline').rep;stand(unmarked);pump(.6);chop(7);
 assert.equal(p().plots[unmarked.key].tree,null,'the unmarked pine was felled too');assert.equal(p().shift.pieces.trees,1,'it did not count as a marked tree');assert.equal(p().shift.pieces.stray,1,'it paid as an unmarked one');assert.equal(careerOf(p(),'ridgeline').rep,rep,'no reputation lost');assert(/pays \$0\.75/.test(ids.get('jobToast').textContent),ids.get('jobToast').textContent);
 // a log on the shoulder, stacked at the landing
 GameState.progress={...p(),carry:{kind:'log'}};me().x=LANDING.x+.8;me().z=LANDING.z;pump(.6);assert(/Stack the log at the landing/.test(prompt()),'the landing offers it: '+prompt());
 send('keydown','KeyE');send('keyup','KeyE');pump(1.5);assert.equal(p().carry,null,'the log left the shoulder');assert.equal(p().shift.pieces.logs,1,'and counted');
 // pay: the log is $1.00
 assert(shiftPay(p()).piecePay>=100,'a log pays $1.00 at the landing: '+shiftPay(p()).piecePay);
 // clock out: marks vanish again, and the landing refuses
 const out=clockOut(p());GameState.progress=out.state;pump(1);assert.equal(marks().visible,false,'no marks after clocking out');assert.equal(ring().visible,false);
 GameState.progress={...p(),carry:{kind:'log'}};pump(.6);assert(!/Stack the log/.test(prompt()),'off shift the landing offers nothing: '+prompt());
 console.log('PASS forest-game.mjs: on shift the marked pines wear a band (one InstancedMesh), a marked pine felled counts, an unmarked one pays less, a log stacked at the landing counts and pays; off shift the forest is closed and the marks are gone.');
}finally{await g.done()}
