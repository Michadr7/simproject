// Ridgeline's cut blocks and what work counts for (0.35 step 4, forest.js): which blocks are marked on a day, marked trees count and unmarked ones cost reputation,
// logs stacked at the landing, planks milled; all only on a Ridgeline shift.
import assert from 'node:assert/strict';
import {worldLayout,isWalkable} from '../dist/world.js';
import {freshProgress} from '../dist/jobs.js';
import {hire,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {BLOCK_IDS,blockOf,blockCentre,markedBlocks,isMarked,markedTrees,LANDING,atLanding,treeFelled,stackLog,planksMilled,stockOf,takeLogFromPile,deliverPlanks,inLumberyard,LUMBERYARD} from '../dist/forest.js';
import {PIECE_PAY,shiftPay} from '../dist/shift.js';
import {normalizeProgress} from '../dist/jobs.js';
import {MAX_MARKS} from '../dist/marks.js';
import {zoneById} from '../dist/map-definition.js';

const trees=worldLayout().cuttable,F=zoneById('forest').bounds;
// ten blocks over Pine Ridge, ids A1..E2, every tree in exactly one
assert.deepEqual(BLOCK_IDS,['A1','B1','C1','D1','E1','A2','B2','C2','D2','E2']);
for(const t of trees)assert(BLOCK_IDS.includes(blockOf(t.x,t.z)),`tree ${t.key} is in a block`);
assert.equal(blockOf(F.x0-1,F.z0+1),null);assert.equal(blockOf(F.x0+1,F.z0+1),'A1');assert.equal(blockOf(F.x1-1,F.z1-1),'E2');
for(const id of BLOCK_IDS){const c=blockCentre(id);assert.equal(blockOf(c.x,c.z),id,`${id}: its centre is inside it`)}
// the marks: two different blocks a day, by the day number alone, every block comes round, and the count fits the one InstancedMesh
const seen=new Set();for(let d=1;d<=30;d++){const [a,b]=markedBlocks(d);assert.notEqual(a,b,`day ${d}: two different blocks`);assert.deepEqual(markedBlocks(d),[a,b],'the same day gives the same marks');seen.add(a);seen.add(b);
 const n=markedTrees(trees,d).length;assert(n>=40&&n<=MAX_MARKS,`day ${d}: ${n} marked pines`)}
assert.equal(seen.size,10,'all ten blocks are marked within thirty days');
assert.notDeepEqual(markedBlocks(1),markedBlocks(2),'the marks move from day to day');
// the landing is open ground in Pine Ridge
assert(isWalkable(LANDING.x,LANDING.z)&&LANDING.x>F.x0&&LANDING.x<F.x1&&LANDING.z>F.z0&&LANDING.z<F.z1,'the landing is walkable ground inside Pine Ridge');
assert(atLanding({x:LANDING.x+1,z:LANDING.z})&&!atLanding({x:LANDING.x+6,z:LANDING.z})&&!atLanding(null));

// on shift
const at=(p,day,minutes)=>({...p,housing:{...p.housing,day},routine:{...p.routine,minutes}});
let p=at(hire(freshProgress(),'ridgeline').state,3,540);const off=p;p=clockIn(p,'ridgeline').state;
const marked=markedTrees(trees,3)[0],unmarked=trees.find(t=>!isMarked(t,3));assert(marked&&unmarked);
// a marked tree counts as a tree (and finishes the Fell task once enough have been felled); off shift nothing counts
assert.equal(treeFelled(off,marked).counted,false,'off shift a felled tree counts for nothing');assert.equal(treeFelled(off,marked).state,off);
{let s=p;const fell=s.shift.tasks.find(t=>t.kind==='fell');assert(fell,'a Trainee has a Fell task');let done=null;
 for(let i=0;i<fell.target;i++){const r=treeFelled(s,marked);assert(r.counted&&r.marked);s=r.state;if(r.finished?.length)done=r.finished[0]}
 assert.equal(s.shift.pieces.trees,fell.target);assert(/Fell \d+ marked pines/.test(done||''),'the last one finishes the task: '+done)}
// an unmarked one pays less ($0.75 against $3.00) and counts for no task; reputation is untouched
{const r=treeFelled(p,unmarked);assert.equal(r.counted,false);assert.equal(r.state.careers.ridgeline.rep,careerOf(p,'ridgeline').rep,'no reputation penalty');assert.equal(r.state.shift.pieces.trees,undefined);assert.equal(r.state.shift.pieces.stray,1);assert(/pays \$0\.75/.test(r.message));assert.equal(PIECE_PAY.trees,300);assert.equal(PIECE_PAY.stray,75)}
// stock: logs stacked join the company pile (saved on the company), can be taken back off it, and planks delivered to the lumberyard join the stock and pay $1.00 each
{let s=stackLog({...p,carry:{kind:'log'}},LANDING).state;s=stackLog({...s,carry:{kind:'log'}},LANDING).state;assert.deepEqual(stockOf(s),{logs:2,planks:0},'two logs in the pile');assert.equal(PIECE_PAY.logs,25);
 assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(s))).companies.ridgeline.stock,{logs:2,planks:0},'the stock is saved');
 assert.match(takeLogFromPile({...s,carry:{kind:'log'}},LANDING).error,/hands are full/);assert.match(takeLogFromPile(s,{x:0,z:0}).error,/landing/);assert.match(takeLogFromPile(off,LANDING).error,/Clock in/);
 const t1=takeLogFromPile(s,LANDING);assert.deepEqual(t1.state.carry,{kind:'log'});assert.equal(stockOf(t1.state).logs,1);
 const t2=takeLogFromPile({...t1.state,carry:null},LANDING);assert.equal(stockOf(t2.state).logs,0);assert.match(takeLogFromPile({...t2.state,carry:null},LANDING).error,/empty/);
 const d=deliverPlanks(s,8);assert.equal(stockOf(d.state).planks,8);assert.equal(d.state.shift.pieces.delivered,8);assert.equal(shiftPay(d.state).piecePay-shiftPay(s).piecePay,800,'eight planks pay $8.00');assert.match(deliverPlanks(off,4).error,/Clock in/);assert.match(deliverPlanks(s,0).error,/no planks/);
 assert(inLumberyard({x:87,z:50})&&!inLumberyard({x:70,z:50})&&inLumberyard({x:LUMBERYARD.sign.x,z:LUMBERYARD.sign.z}));assert.equal(PIECE_PAY.planks,0,'milling counts but pays on delivery')}
// logs at the landing: a log on the shoulder, standing there, on shift
{const carrying={...p,carry:{kind:'log'}};
 assert(/Clock in/.test(stackLog({...off,carry:{kind:'log'}},{x:LANDING.x,z:LANDING.z}).error),'off shift: no');assert(/Carry a log/.test(stackLog(p,{x:LANDING.x,z:LANDING.z}).error),'nothing on the shoulder');assert(/landing/.test(stackLog(carrying,{x:LANDING.x+9,z:LANDING.z}).error),'too far away');
 const r=stackLog(carrying,{x:LANDING.x+.5,z:LANDING.z});assert(!r.error);assert.equal(r.state.carry,null,'the log leaves your shoulder');assert.equal(r.state.shift.pieces.logs,1);
 const stacks=p.shift.tasks.find(t=>t.kind==='landing');assert(stacks,'a Trainee has a landing task');let s={...p,carry:{kind:'log'}};
 for(let i=0;i<stacks.target;i++){const x=stackLog({...s,carry:{kind:'log'}},LANDING);s=x.state}
 assert.equal(s.shift.tasks.find(t=>t.kind==='landing').done,stacks.target)}
// planks taken off the belt count as milled
{const r=planksMilled(p,4);assert.equal(r.state.shift.pieces.planks,4);assert.equal(planksMilled(off,4).state,off,'off shift: nothing')}
console.log('PASS forest.mjs: ten cut blocks, two marked a day by the day number (all come round, 40 to 400 marked pines), the landing on open ground, a marked tree pays $3.00 and an unmarked one $0.75 (no reputation lost), logs stacked at the landing join the company pile (saved, and can be taken back), planks delivered to the lumberyard join the stock and pay $1.00 each; all only on a Ridgeline shift.');
