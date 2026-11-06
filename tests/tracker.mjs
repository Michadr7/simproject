import assert from 'node:assert/strict';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {trackerItems,focusedItem,nextFocus,distanceTo,taskPlace,normalizeFocus} from '../dist/tracker.js';
import {markedBlocks,blockCentre,LANDING} from '../dist/forest.js';
import {BAY} from '../dist/customers.js';

// The task tracker (0.35): one list of everything active, one focus, the places each task is done, the saved focus.
const task=(kind,piece,target,done)=>({kind,piece,target,done});
const base=freshProgress(),shift={employer:'ridgeline',day:3,startedAt:360,last:0,paidMinutes:0,offSiteMinutes:0,pieces:{},tasks:[task('fell','trees',6,2),task('haul','delivered',12,12),task('load','shipped',20,0),task('stack','racks',2,0)]};
const here={x:0,z:0},p={...base,shift,housing:{...base.housing,day:3}};

// nothing active, nothing listed; the story objective is not an item
assert.deepEqual(trackerItems(base,here),[],'a fresh save has no tasks');
assert.equal(focusedItem(base,[]),null);

const items=trackerItems(p,here);
assert.deepEqual(items.map(i=>i.id),['task:fell','task:haul','task:load','task:stack'],'every shift task is an item, in order');
assert.equal(items[0].title,'Fell 6 marked pines');assert.equal(items[0].detail,'2 of 6 done');assert.equal(items[1].done,true,'a finished task is marked done');
// places: the nearest marked block, the timber yard bay; the warehouse has no place yet
const blocks=markedBlocks(3).map(blockCentre),near=blocks.reduce((a,b)=>Math.hypot(a.x,a.z)<=Math.hypot(b.x,b.z)?a:b);
assert.deepEqual(items[0].pos,near,'felling points at the nearest marked block');assert.deepEqual(items[2].pos,{x:BAY.x,z:BAY.z});assert.deepEqual(items[3].pos,{x:166.9,z:30.2},'the stack task points at the warehouse door');assert.equal(trackerItems({...p,shift:{...shift,tasks:[{kind:'unknown',piece:'x',target:1,done:0}]}},here).length,0,'an unknown task kind is not listed');
assert.deepEqual(taskPlace('landing',p,here),{x:LANDING.x,z:LANDING.z});assert(taskPlace('mill',p,here)&&taskPlace('haul',p,here),'the sawmill and the lumberyard have points');
assert.equal(distanceTo(here,{x:3,z:4}),5);assert.equal(distanceTo(here,null),null);

// orders: one on the way (no place), listed
const q={...p,orders:{...p.orders,queue:[{id:7,home:'studio',items:[],vehicle:null,arrivesAt:3*1440}]}};
assert.equal(trackerItems(q,here).filter(i=>i.id==='order:7').length,1,'an order on the way is listed');

// focus: a saved id that exists and is open; a finished or missing one falls back to the story
assert.equal(focusedItem({...p,focus:'task:load'},items).id,'task:load');
assert.equal(focusedItem({...p,focus:'task:haul'},items),null,'a finished task cannot be the focus');assert.equal(focusedItem({...p,focus:'task:gone'},items),null);assert.equal(focusedItem(p,items),null,'no focus means the story objective');
// Y: story -> each open task -> story
let f=null;const seen=[];for(let i=0;i<5;i++){f=nextFocus({...p,focus:f},items);seen.push(f)}
assert.deepEqual(seen,['task:fell','task:load','task:stack',null,'task:fell'],'cycles through the open tasks and the story, skipping the finished one');
assert.equal(nextFocus(base,[]),null,'nothing to cycle');

// saving: the focus survives normalisation; junk does not
assert.equal(normalizeProgress({focus:'task:fell'}).focus,'task:fell');assert.equal(normalizeProgress({focus:'<script>'}).focus,null);assert.equal(normalizeProgress({focus:5}).focus,null);assert.equal(normalizeProgress(null).focus,null);assert.equal(normalizeFocus('a'.repeat(41)),null);
console.log('Tracker: every shift task and order is listed with its place and distance, the nearest marked block for felling, finished tasks cannot be focused, Y cycles story and open tasks, and the focus saves and rejects junk.');
