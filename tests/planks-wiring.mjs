// P-B/P-C wiring (notes/planks-economy-design.md): ONE plank source at the sawmill (the player-fed yard; the world sawmill mints nothing; the trickle of 6 a day is the only free supply and the supply run to the Eastbank supplier takes from the yard), the saved yard (old saves load), and hand stacking at the rack cell pay (PAY.rackCell, once per cell per shift, leftovers stay in the hands).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {freshProgress,normalizeProgress,loadProgress,saveProgress} from '../dist/jobs.js';
import {runWorldDay,yardOf,SAWMILL_PLACE} from '../dist/world-tick.js';
import {normalizeWorld,totalOf} from '../dist/world-state.js';
import {PLACES,SUPPLY} from '../dist/world-goods.js';
import {MAP} from '../dist/map-definition.js';
import {TRICKLE_PER_DAY,PAY} from '../dist/plank-economy.js';
import {feed,tick,takeStack,normalizeYard,YARD_MAX_PLANKS} from '../dist/sawmill-yard.js';
import {BELT_SLOTS} from '../dist/carry.js';
import {hire} from '../dist/careers.js';
import {clockIn,PIECE_PAY} from '../dist/shift.js';
import {stackPlanks,racksOf,RACK_CAP} from '../dist/forest.js';
import {RACK_CELL_PAY} from '../dist/warehouse-intake.js';

const at=(P,day,minutes)=>({...P,housing:{...P.housing,day:day+1},routine:{...P.routine,minutes}});
const base=normalizeProgress(freshProgress());

// 1. one source: the world's sawmill has no rate, a fresh yard is empty, the supply still runs from the sawmill
assert.equal(PLACES[SAWMILL_PLACE].goods.planks.rate,undefined);assert.equal(PLACES[SAWMILL_PLACE].goods.planks.start,0);assert.equal(TRICKLE_PER_DAY,6);
assert.ok(SUPPLY.some(s=>s.from===SAWMILL_PLACE&&s.to==='property:eastbank-supply'&&s.perDay===6),'the town supply to the supplier is kept');
assert.deepEqual({planks:base.sawmillYard.planks,logs:base.sawmillYard.logs,on:base.sawmillYard.on},{planks:0,logs:0,on:false});assert.equal(base.belt,0);

// 2. save: an old save (no yard) keeps its world sawmill planks and its belt stacks in the yard, once (normalising again does not add them twice)
{const w=normalizeWorld(null,MAP.seed,10);w.stock[SAWMILL_PLACE].planks=100;
 const old={...JSON.parse(JSON.stringify(base)),world:w,belt:3};delete old.sawmillYard;
 const n=normalizeProgress(old);assert.equal(n.sawmillYard.planks,112,'100 world planks + 3 belt stacks of 4');assert.equal(n.belt,BELT_SLOTS,'the belt shows up to 4 of the yard stacks');
 const again=normalizeProgress(JSON.parse(JSON.stringify(n)));assert.equal(again.sawmillYard.planks,112,'no double count on the next normalise');assert.equal(again.belt,BELT_SLOTS);
 const store=new Map(),st={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};assert.ok(saveProgress(st,n));const back=loadProgress(st);assert.deepEqual(back.sawmillYard,n.sawmillYard,'round trip');
 const full=normalizeProgress({...old,belt:4,world:{...w,stock:{...w.stock,[SAWMILL_PLACE]:{planks:160}}}});assert.equal(full.sawmillYard.planks,YARD_MAX_PLANKS,'clamped to the yard size')}
// a save from before the sawmill and the world: an empty yard; junk yards load as valid yards; a saved yard wins over the old belt field
assert.equal(normalizeProgress({cash:500}).sawmillYard.planks,0);
for(const junk of ['x',[],5,{logs:-5,planks:'q',on:'yes'},{planks:1e9,logs:1e9}]){const n=normalizeProgress({...base,sawmillYard:junk});assert.ok(n.sawmillYard.planks>=0&&n.sawmillYard.planks<=YARD_MAX_PLANKS&&n.sawmillYard.logs>=0&&typeof n.sawmillYard.on==='boolean');assert.equal(n.belt,Math.min(BELT_SLOTS,Math.floor(n.sawmillYard.planks/4)))}
{const n=normalizeProgress({...base,sawmillYard:{planks:8,logs:2,on:true},belt:4});assert.equal(n.belt,2);assert.equal(n.sawmillYard.logs,2);assert.equal(n.sawmillYard.on,true)}

// 3. the daily tick: the trickle goes into the yard, the supply takes from it, nothing else is made (conservation over 10 days)
{let P=at({...base,world:normalizeWorld(null,MAP.seed,100),sawmillYard:normalizeYard({planks:20})},100,400);
 const T=Q=>Q.sawmillYard.planks+totalOf(Q.world,'planks')-Q.world.stock[SAWMILL_PLACE].planks; // the world's sawmill IS the yard: count it once
 let t0=T(P),made=0,used=0,moved=0,sawn=0;
 for(let d=101;d<=110;d++){const logs0=totalOf(P.world,'logs');P=runWorldDay(at(P,d,400));const L=P.world.last;assert.equal(L.produced.planks,undefined,'the world sawmill makes no planks');
  const fed=logs0+(L.produced.logs||0)-(L.consumed.logs||0)-totalOf(P.world,'logs');assert.ok(fed>=0&&fed<=4,'W3: the crew saws at most 4 real forest logs a day: '+fed); // logs live only in the forest: what left it went to the saw
  assert.equal(P.world.stock[SAWMILL_PLACE].planks,P.sawmillYard.planks,'the world sawmill shows the yard');made+=TRICKLE_PER_DAY;sawn+=fed*4;used+=L.consumed.planks||0;moved+=L.supplied.planks||0}
 assert.equal(T(P),t0+made+sawn-used,'planks in = the trickle + 4 per real log sawn; out = what the town used');assert.ok(sawn>0,'the crew sawed logs');assert.ok(moved>0,'the supplier was still supplied from the yard');assert.equal(P.sawmillYard.lastTrickleDay,110)}
// a second call the same day changes nothing; a catch-up trickles once per ticked day (14 at most, like the world)
{const P=at({...base,world:normalizeWorld(null,MAP.seed,100),sawmillYard:normalizeYard({planks:0})},100,400),Q=runWorldDay(at(P,101,400));assert.equal(JSON.stringify(runWorldDay(Q)),JSON.stringify(Q));
 const far=runWorldDay(at({...base,world:{...normalizeWorld(null,MAP.seed,0),stock:{...normalizeWorld(null,MAP.seed,0).stock,'property:eastbank-supply':{planks:100}}},sawmillYard:normalizeYard({planks:0})},40,400));
 assert.ok(far.sawmillYard.planks>0&&far.sawmillYard.planks<48+TRICKLE_PER_DAY+16,'14 days of trickle and crew sawing (paused at 48) less the crew\'s haul to the warehouse: '+far.sawmillYard.planks);assert.equal(far.sawmillYard.lastTrickleDay,40)}
// a progress without a yard (never normalised): the world's sawmill planks become the yard, nothing lost
{const w=normalizeWorld(null,MAP.seed,100);w.stock[SAWMILL_PLACE].planks=30;w.stock['property:eastbank-supply'].planks=100;const P={...at({...base,world:w},101,400)};delete P.sawmillYard;
 assert.equal(yardOf(P,w).planks,30);assert.equal(runWorldDay(P).sawmillYard.planks,48,'30 + the trickle 6 + 3 real logs sawn (12): the crew stops at 48')}

// 4. the saw: a fed log becomes 4 planks after 4 game minutes at any frame rate; a stack of 4 comes off
{let y=feed(normalizeYard({}),1).state;assert.equal(y.on,true);for(let i=0;i<240;i++)y=tick(y,1/60);assert.equal(y.planks,4);assert.equal(y.logs,0);assert.equal(y.on,false);
 const t=takeStack(y);assert.equal(t.planks,4);assert.equal(t.state.planks,0)}

// 5. warehouse: a full cell pays PAY.rackCell once per cell per shift, what does not fit stays in the hands
assert.equal(PIECE_PAY.racks,PAY.rackCell);assert.equal(RACK_CELL_PAY,PAY.rackCell);
{const h=hire(freshProgress(),'ridgeline').state,s=clockIn({...h,housing:{...h.housing,day:3},routine:{...h.routine,minutes:600}},'ridgeline').state;
 const racked=(map,extra={})=>({...s,shift:{...s.shift,tasks:[]},companies:{...s.companies,ridgeline:{...s.companies.ridgeline,racks:map}},...extra});
 const r=stackPlanks(racked({'C1-1':38},{carry:{kind:'planks',count:4}}),'C1-1');assert.equal(r.put,2);assert.deepEqual(r.state.carry,{kind:'planks',count:2},'leftovers stay in the hands');assert.equal(racksOf(r.state)['C1-1'],RACK_CAP);assert.equal(racksOf(r.state)['C1-2']||0,0,'nothing spills into another cell');
 assert.equal(r.state.shift.pieces.racks,1);assert.ok(r.message.includes('$'+(PAY.rackCell/100).toFixed(2)),r.message);
 const again=stackPlanks(racked({'C1-1':38},{carry:{kind:'planks',count:2},shift:r.state.shift}),'C1-1');assert.ok(!again.error&&again.filled,'refilled');assert.equal(again.state.shift.pieces.racks,1,'the same cell pays once a shift')}

// 6. game.js uses the yard (source checks: no browser here)
{const g=fs.readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
 for(const s of ['tickSawYard();syncSawmill();','feedYard(p.sawmillYard,want,k)','takeStack(p.sawmillYard)','switchSaw(y,want)','yardSummary(y)'])assert.ok(g.includes(s),'game.js: '+s);
 assert.ok(!/nameTagsTick|name-tag/.test(g),'the floating name tags are gone (owner 2026-11-17)');assert.ok(!g.includes('feedLog(GameState.progress'),'the old belt feed is not used')}
console.log('PASS planks-wiring: one plank source (world sawmill rate gone, trickle '+TRICKLE_PER_DAY+'/day into the yard, supply to the supplier from the yard, 10-day conservation), old saves move world planks + belt into the yard once, junk yards load, 1 log = 4 planks in 4 game min, rack cell pays $'+(PAY.rackCell/100).toFixed(2)+' once per shift with leftovers in the hands, game.js wired, name tags removed');
