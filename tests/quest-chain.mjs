// Quest rework: fell, buck, feed_saw, mill, haul; landing retired; no timber cash sale
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {worldLayout} from '../dist/world.js';
import {hire,careerOf} from '../dist/careers.js';
import {clockIn,clockOut,TASKS,PIECE_PAY,COUNTS_AS,dailyTasks,normalizeShift,recordPiece,shiftPay} from '../dist/shift.js';
import {equipTool} from '../dist/inventory.js';
import {MAP} from '../dist/map-definition.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {treeFelled,trunkBucked,sawFed,slabMilled,planksMilled,deliverPlanks,deliverSlabs,logGathered,isMarked,markedTrees} from '../dist/forest.js';
import {chopTree,normalizeLogs} from '../dist/grid.js';
import {PAY,TIMBER_PAY,OLD_PAY} from '../dist/plank-economy.js';
import * as ECON from '../dist/plank-economy.js';
import {trackerItems} from '../dist/tracker.js';

const E=MAP.employers.find(e=>e.id==='ridgeline'),DAY=3,trees=worldLayout().cuttable;
const marked=markedTrees(trees,DAY)[0],unmarked=trees.find(t=>!isMarked(t,DAY));
assert(marked&&unmarked,'one marked and one unmarked pine on day '+DAY);
const base=hire(freshProgress(),'ridgeline').state;
const onShift=(tasks)=>{const s=clockIn({...base,housing:{...base.housing,day:DAY},routine:{...base.routine,minutes:600}},'ridgeline').state;return {...s,shift:{...s.shift,tasks:tasks||[]}}};
const task=(kind,target=9,done=0)=>({kind,piece:TASKS[kind].piece,target,done});
const piece=(p)=>shiftPay(p).piecePay;

// 1. the task list and the labels ----------------------------------------------------------------------------------------------
assert.deepEqual(E.ranks[0].tasks,['fell','buck','gather']);assert.deepEqual(E.ranks[1].tasks,['feed_saw','mill','stumps']);assert.deepEqual(E.ranks[2].tasks,['haul','load']);
assert(!E.ranks.some(r=>r.tasks.includes('landing')),'the landing task is retired: no rank offers it');
for(let rank=1;rank<=6;rank++)for(let d=1;d<40;d++)for(let sh=0;sh<4;sh++)assert(!dailyTasks(E,rank,sh,d).some(t=>t.kind==='landing'),'landing is never handed out');
assert.equal(TASKS.landing.retired,true,'kept (hidden) so a shift saved before the rework still loads');
assert.equal(TASKS.fell.label(4),'Fell 4 marked pines');assert.equal(TASKS.buck.label(3),'Cut 3 trunks into logs');assert.equal(TASKS.gather.label(6),'Pick up 6 trunks');assert.equal(TASKS.gather.label(1),'Pick up 1 trunk');
assert.equal(TASKS.feed_saw.label(6),'Bring 6 logs or trunks to the sawmill');assert.equal(TASKS.mill.label(20),'Saw 20 boards or slabs');assert.equal(TASKS.haul.label(12),'Deliver 12 boards or slabs to the lumberyard');
assert.equal(dailyTasks(E,1,0,1).length,2);assert(dailyTasks(E,2,3,4).some(t=>t.kind==='feed_saw'||t.kind==='mill'),'a Feller gets sawmill work');
assert(!/log/i.test(TASKS.gather.label(6)),'gather no longer talks about logs');

// 2. the pay table ---------------------------------------------------------------------------------------------------------------
assert.deepEqual([PIECE_PAY.trees,PIECE_PAY.stray,PIECE_PAY.bucked,PIECE_PAY.logsFed,PIECE_PAY.trunksFed,PIECE_PAY.planks,PIECE_PAY.slabs,PIECE_PAY.delivered,PIECE_PAY.slabsDelivered],[300,75,100,120,150,25,40,730,1400]);
assert.equal(PIECE_PAY.delivered,PAY.plankDelivered);assert.equal(PIECE_PAY.slabsDelivered,TIMBER_PAY.slabDelivered);assert.equal(OLD_PAY.lumberyardPlank,100,'the legacy number stays recorded');assert.equal(PIECE_PAY.fed,0,'fed only counts');

// 3. gather: a trunk counts once a shift, by its id --------------------------------------------------------------------------------
{let p=onShift([task('gather',3)]);const a=logGathered(p,11);assert.equal(a.counted,true);assert.equal(a.state.shift.tasks[0].done,1);assert.equal(logGathered(a.state,11).counted,false,'the same trunk counts once');
 assert.equal(logGathered(base,11).counted,false,'off shift nothing counts');
 const src=readFileSync('dist/game.js','utf8');assert(/wasTrunk\?logGathered\(/.test(src),'game.js only gathers TRUNKS (a log lifted off the ground does not count)')}

// 4. the trunk remembers its pine -------------------------------------------------------------------------------------------------
const fell=(tree,p)=>{p={...p,inventory:equipTool(p,'axe').state.inventory,equipped:'axe'};let r;for(let i=0;i<60;i++){r=chopTree(p,tree.key);assert(!r.error,r.error);p=r.state;if(r.felled)break}assert(r.felled);return {state:p,ids:r.logs.map(l=>l.id)}};
{const a=onShift();const m=fell(marked,equipTool(a,'axe').state),tm=treeFelled(m.state,marked,m.ids);assert.equal(tm.state.logs.find(l=>l.kind==='trunk').unmarked,undefined,'a marked pine: no flag');assert.equal(tm.marked,true);
 const u=fell(unmarked,equipTool(a,'axe').state),tu=treeFelled(u.state,unmarked,u.ids);assert.equal(tu.state.logs.find(l=>l.kind==='trunk').unmarked,true,'an unmarked pine flags its trunk');assert.equal(tu.state.shift.pieces.stray,1,'and pays 75 c');assert.equal(tu.counted,false);
 const off=treeFelled({...u.state,shift:null},unmarked,u.ids);assert.equal(off.state.logs.find(l=>l.kind==='trunk').unmarked,true,'off shift the trunk is still flagged');assert.equal(off.counted,false);
 const kept=normalizeProgress(JSON.parse(JSON.stringify(tu.state)));assert.equal(kept.logs.find(l=>l.kind==='trunk')?.unmarked,true,'the flag survives a save round trip');
 assert.deepEqual(normalizeLogs([{id:1,x:100,z:-250,rot:0,t:0,kind:'trunk'}]).map(l=>l.unmarked),[undefined],'an old trunk has no flag: it counts as marked');
 assert.equal(normalizeLogs([{id:1,x:100,z:-250,rot:0,t:0,unmarked:true}])[0].unmarked,undefined,'a log never carries the flag');
 assert.equal(normalizeLogs([{id:1,x:100,z:-250,rot:0,t:0,kind:'trunk',unmarked:'yes'}])[0].unmarked,undefined,'junk is not a flag')}

// 5. buck: pays only on shift and only for a trunk from a marked pine --------------------------------------------------------------
{const p=onShift([task('buck',2)]);
 const a=trunkBucked(p,false);assert.equal(a.counted,true);assert.equal(a.state.shift.pieces.bucked,1);assert.equal(a.state.shift.tasks[0].done,1);assert.equal(piece(a.state),100,'100 c a trunk');assert.match(a.message,/\$1\.00/);
 const b=trunkBucked(a.state,false);assert.match(b.message,/Task done: Cut 2 trunks into logs/);
 const u=trunkBucked(p,true);assert.equal(u.counted,false);assert.equal(u.state,p,'an unmarked trunk pays nothing and counts for nothing');assert.match(u.message,/no cutting pay/);
 const off=trunkBucked(base,false);assert.equal(off.counted,false);assert.equal(off.state,base,'off shift: no pay');
 const src=readFileSync('dist/game.js','utf8');assert(/trunkBucked\(r\.state,!!was\?\.unmarked\)/.test(src),'game.js passes the trunk flag to the pay')}

// 6. feed the saw: 120 c a log, 150 c a trunk, both count for the Bring task ---------------------------------------------------------
{let p=onShift([task('feed_saw',4)]);p=sawFed(p,'log',2).state;assert.equal(p.shift.tasks[0].done,2);assert.equal(piece(p),240);
 p=sawFed(p,'trunk',1).state;assert.equal(p.shift.tasks[0].done,3);assert.equal(piece(p),240+150);assert.equal(p.shift.pieces.fed,undefined,'the counting piece itself is not stored');
 assert.equal(sawFed(base,'log',1).counted,false,'off shift nothing')}

// 7. mill: a board 25 c, a slab 40 c, both count -----------------------------------------------------------------------------------------
{let p=onShift([task('mill',5)]);p=planksMilled(p,4).state;assert.equal(p.shift.tasks[0].done,4);assert.equal(piece(p),100);
 const s=slabMilled(p);assert.equal(s.state.shift.tasks[0].done,5,'a slab counts for the Mill task');assert.equal(piece(s.state),100+40,'and pays 40 c');assert.equal(s.finished.length,1);
 assert.equal(slabMilled(base).counted,false);assert.equal(planksMilled(base,3).state,base,'off shift nothing is recorded')}

// 8. haul: 730 c a board, 1400 c a slab, no raw cash sale ---------------------------------------------------------------------------
{let p=onShift([task('haul',9)]);const cash=p.cash;p=deliverPlanks(p,2).state;assert.equal(p.shift.tasks[0].done,2);assert.equal(piece(p),1460);assert.match(deliverPlanks(onShift(),1).message,/\$7\.30/);
 const d=deliverSlabs(p,1);assert.equal(d.state.shift.tasks[0].done,3,'a slab delivered counts for Haul');assert.equal(piece(d.state),1460+1400);assert.match(d.message,/\$14\.00/);assert.equal(d.state.cash,cash,'nothing is paid in cash on the spot: it is piece pay, handed over at clock-out');
 assert.match(deliverSlabs(base,1).error,/Clock in/);assert.match(deliverSlabs(p,0).error,/no slabs/);
 const out=clockOut(d.state);assert.equal(out.stub.piecePay,1460+1400)}
assert.equal(ECON.sellTimber,undefined);assert.equal(ECON.TIMBER_SALE_CENTS,undefined,'the T-E cash sale is gone');
{const src=readFileSync('dist/game.js','utf8');assert(!/sellTimber|TIMBER_SALE_CENTS/.test(src),'game.js has no timber sale');assert(/deliverSlabs\(/.test(src))}
assert.deepEqual(Object.keys(COUNTS_AS).sort(),['logsFed','slabs','slabsDelivered','trunksFed']);

// 9. the tracker --------------------------------------------------------------------------------------------------------------------
{const p={...onShift([task('gather',4),task('buck',3),task('feed_saw',6)]),logs:[{id:1,x:100,z:-250,rot:0,t:0,kind:'trunk'},{id:2,x:10,z:-20,rot:0,t:0}]};const it=trackerItems(p,{x:0,z:0});
 assert.deepEqual(it.map(i=>i.title),['Pick up 4 trunks','Cut 3 trunks into logs','Bring 6 logs or trunks to the sawmill']);assert.deepEqual(it[0].pos,{x:100,z:-250});assert.deepEqual(it[1].pos,{x:100,z:-250});assert.equal(it[2].place,'Sawmill')}

// 10. old saves and old shifts load unchanged -----------------------------------------------------------------------------------------
{const old=JSON.parse(readFileSync('tests/fixtures/save-0.35.18-talk.json','utf8')).progress,a=normalizeProgress(old);assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(a))),a,'normalising twice changes nothing');
 const sh={employer:'ridgeline',day:3,startedAt:360,last:0,paidMinutes:30,offSiteMinutes:0,tasks:[{kind:'landing',piece:'logs',target:8,done:3},{kind:'gather',piece:'gathered',target:6,done:2},{kind:'mill',piece:'planks',target:20,done:5},{kind:'haul',piece:'delivered',target:12,done:4}],pieces:{logs:3,gathered:2,planks:5,delivered:4,trees:2},gathered:[4,5]};
 const n=normalizeShift(sh,onShift().careers);assert.equal(n.tasks.length,4,'the retired landing task is kept in an old shift');assert.deepEqual(n.tasks.map(t=>[t.kind,t.piece,t.done]),[['landing','logs',3],['gather','gathered',2],['mill','planks',5],['haul','delivered',4]]);assert.deepEqual(n.pieces,sh.pieces);assert.deepEqual(n.gathered,[4,5]);
 const r=recordPiece({...onShift(),shift:n},'logs',2);assert.equal(r.state.shift.tasks[0].done,5,'an old landing task still counts the logs stacked at the pile');
 const withShift=normalizeProgress({...old,careers:onShift().careers,shift:sh,housing:{...old.housing,day:3}});assert(withShift.shift===null||withShift.shift.tasks.length>=0,'a save with an old shift loads');
 assert.equal(normalizeLogs([{id:3,x:100,z:-250,rot:1,t:5}])[0].kind,undefined,'an old log stays a log')}
console.log('PASS quest-chain.mjs: landing retired (kept hidden for old shifts), gather counts trunks once, buck pays 100 c only on shift and only for marked pines (flag saved, old trunks count as marked), feeding pays 120/150, boards 25 and slabs 40 count for Mill, haul pays 730 per board and 1400 per slab, no cash sale, old saves and shifts load.');
