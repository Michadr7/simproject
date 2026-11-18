// W3 in the packaged game (notes/workforce-design.md): the Ridgeline fellers and the sawyer are drawn working (pool characters, no new SkinnedMesh), the crew's day runs in the 05:00 tick (yard, racks, stumps),
// the crew's supply comes from the lumberyard and the sawmill yard only, and an untouched order is slowly staged by the crew for $0. Plus: the rules repeated to dodge a module cycle agree with workforce-tick.js.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {markedBlocks} from '../dist/forest.js';
import {townPopulation} from '../dist/population.js';
import {workforcePose,HAUL_WAYPOINTS,BLOCK_TREES} from '../dist/workforce-pose.js';
import {normalizeWorkforce,supplyFromStocks,WORKFORCE_TICKET_GRACE_MIN} from '../dist/workforce-tick.js';
import {normalizeWorkforce as careersWorkforce,normalizeCompanies,hire,promote,careerOf} from '../dist/careers.js';
import {supplyFromStocks as supplyRule} from '../dist/supply.js';
import {normalizeYard} from '../dist/sawmill-yard.js';
import {totalPlanks} from '../dist/pallets.js';
import {ticketsOf} from '../dist/tickets.js';

// 0. the repeated rules agree (careers.js and supply.js cannot import workforce-tick.js: forest -> shift -> careers would close a cycle)
for(const v of [null,5,'x',[],{},{lastMin:-1},{lastMin:1.5},{lastMin:4000},{lastMin:2e9}])assert.deepEqual(careersWorkforce(v),normalizeWorkforce(v),JSON.stringify(v));
assert.deepEqual(normalizeCompanies({ridgeline:{workforce:{lastMin:4000}}}).ridgeline,{workforce:{lastMin:4000}},'saved');assert.equal(normalizeCompanies({ridgeline:{workforce:{lastMin:'x'}}}).ridgeline,undefined,'idle: omitted');
for(const [co,y,n] of [[{},{planks:20},12],[{stock:{logs:2,planks:5}},{planks:20},12],[{stock:{logs:0,planks:50}},{planks:0},40],[{},{planks:0},40],[{pallets:Array.from({length:120},(_,i)=>({id:i+1,product:'planks',count:40,at:{rack:['A','B','C','D','E'][Math.floor(i/24)]+(Math.floor((i%24)/3)+1)+'-'+((i%3)+1)}}))},{planks:30},12]]){
 const a=supplyRule(co,normalizeYard(y),n),b=supplyFromStocks(co,normalizeYard(y),n);assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),'supplyFromStocks agrees: '+JSON.stringify([co.stock,y,n]))}

// a day whose morning block is near the sawmill, so one spot sees all three workers
const NEAR=['C1','D1','C2','D2'],DAY=[...Array(60).keys()].map(i=>i+3).find(d=>NEAR.includes(markedBlocks(d)[0])),SPOT=HAUL_WAYPOINTS.hub;
const people={cutter:'ridgeline-fellers#1',hauler:'ridgeline-fellers#2',sawyer:'ridgeline-sawyer'};
const skinned=s=>s.children.filter(c=>{let k=false;c.traverse(o=>{if(o.isSkinnedMesh)k=true});return k}).length; // characters in the scene (an outfit change may swap a character's part meshes; the number of characters is what must not grow)
// the first minute from 10:00 the cutter is chopping (crew-speed fix: the slots last as long as their walks, so 10:00 itself may fall on a carry)
const CUTTER=townPopulation().people.find(q=>q.post===people.cutter),CHOP_MIN=(()=>{for(let m=600;m<715;m+=.05)if(workforcePose({},CUTTER,DAY,m,{seed:MAP.seed}).phase==='chop')return m+.3;throw new Error('no chop before noon')})();
const shown=o=>{for(let x=o;x;x=x.parent)if(!x.visible)return false;return !!o.parent};

// 1. Pine Ridge at 10:00: the cutter swings an axe at a marked pine, the hauler carries a log (or walks back for one), the sawyer works the shed; the same skinned meshes as at 03:00
{const g=await bootGame({position:{x:SPOT.x,z:SPOT.z}});
 try{const {GameState,pump,scene}=g,p=()=>GameState.progress;
  const setClock=(day,minutes)=>{GameState.progress={...p(),housing:{...p().housing,day},routine:{...p().routine,minutes}}};
  setClock(DAY,180);GameState.me.position.x=SPOT.x;GameState.me.position.z=SPOT.z;pump(1.5);const night=skinned(scene());
  setClock(DAY,CHOP_MIN-.5);GameState.me.position.x=SPOT.x;GameState.me.position.z=SPOT.z;pump(2);
  assert.equal(skinned(scene()),night,'no new skinned mesh for the workers ('+night+')');
  const m=p().routine.minutes,d=p().housing.day,pose=post=>workforcePose({},townPopulation().people.find(q=>q.post===post),d,m,{seed:MAP.seed}); // the real resident holding the post (the pose hashes the person's id)
  const axe=scene().getObjectByName('worker-cutter-axe');assert.ok(axe&&shown(axe),'the cutter holds an axe');
  {const c=pose(people.cutter),w=axe.getWorldPosition(new axe.position.constructor());assert.ok(['chop','buck','carry','walk','bend'].includes(c.phase));if(c.prop==='axe')assert.ok(Math.hypot(w.x-c.x,w.z-c.z)<3,'the axe is in the cutter\'s hands at the pose ('+c.phase+'): '+[w.x,w.z,c.x,c.z].map(v=>v.toFixed(1))); /* W4: both fellers run the whole cycle, so the cutter also carries a log at times */
   assert.ok(BLOCK_TREES[markedBlocks(d)[0]].some(t=>Math.hypot(t.x-c.x,t.z-c.z)<12),'in today\'s marked block')}
  {const h=pose(people.hauler),log=scene().getObjectByName('worker-hauler-log');assert.equal(!!log&&shown(log),h.prop==='log','the hauler\'s log follows the pose ('+h.phase+', '+h.prop+')')}
  {const s=pose(people.sawyer),ok=s.prop?(()=>{const o=scene().getObjectByName('worker-sawyer-'+s.prop);return !!o&&shown(o)||s.prop==='planks'})():true;assert.ok(ok,'the sawyer carries what the pose says ('+s.phase+', '+s.prop+')');assert.ok(Math.hypot(s.x-104,s.z+278)<12,'the sawyer works at the shed')}
  // a co-op guest with the same clock computes the same pose (no frame state): run it again
  assert.deepEqual(pose(people.cutter),pose(people.cutter));
  // 2. the next 05:00 tick: the crew's day (trickle once, logs sawn, planks hauled), at most 2 stumps in yesterday's first marked block
  const y0=p().sawmillYard,logs0=p().world.stock['zone:forest'].logs,felled0=Object.keys(p().plots||{}).length;
  setClock(DAY+1,301);pump(1.2);
  assert.equal(p().world.day,DAY,'the tick ran');assert.equal(p().sawmillYard.lastTrickleDay,DAY,'the trickle ran once for the day');
  assert.ok(p().world.stock['zone:forest'].logs<logs0+16,'the crew took real logs from the forest');
  const stumps=Object.entries(p().plots||{}).filter(([,q])=>q.type==='forest'&&q.tree===null&&q.felledAt===DAY*1440+300);
  assert.ok(stumps.length>=1&&stumps.length<=2,'one or two crew stumps: '+stumps.length);assert.ok(Object.keys(p().plots).length-felled0<=2);
  for(const [key] of stumps){const [ix,iz]=key.split(',').map(Number);assert.ok(BLOCK_TREES[markedBlocks(DAY)[0]].some(t=>Math.floor(t.tx)===ix&&Math.floor(t.tz)===iz),'in yesterday\'s block: '+key)}
  assert.notEqual(p().sawmillYard,y0);
 }finally{await g.done()}}

// 3. supply from the yard (no free planks) and the crew staging an untouched order for $0
{const W=MAP.offices.find(o=>o.kind==='warehouse'),D=4;
 const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
 try{const {GameState,pump}=g,p=()=>GameState.progress;
  GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<5)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
  GameState.progress={...p(),housing:{...p().housing,day:D},routine:{...p().routine,minutes:700},sawmillYard:normalizeYard({planks:20}),world:{...p().world,day:D-1}}; // today's 05:00 tick already ran
  const now=(D-1)*1440+700;
  GameState.progress={...p(),companies:{...p().companies,ridgeline:{supply:{at:now-1,planks:40}}}};pump(1.2);
  const co=p().companies.ridgeline;assert.equal(totalPlanks(co),20,'the crew brought what the yard had: '+totalPlanks(co));assert.equal(p().sawmillYard.planks,0,'out of the yard');assert.equal(co.supply,undefined);
  const cash=p().cash,rep=careerOf(p(),'ridgeline').rep;
  const tk={nextId:2,day:D,released:[0,1,2,3],list:[{id:1,customer:'Greenway Builders',kind:'pickup',planks:12,issuedAt:now-WORKFORCE_TICKET_GRACE_MIN-40,dueAt:(D-1)*1440+1440+1080,status:'open',staged:0}]};
  GameState.progress={...p(),companies:{...p().companies,ridgeline:{...p().companies.ridgeline,tickets:tk}}};pump(1.5);
  const k=ticketsOf(p().companies.ridgeline).list.find(t=>t.id===1);assert.ok(k.staged>=4,'the crew staged planks on the untouched order: '+k.staged);
  assert.equal(totalPlanks(p().companies.ridgeline)+k.staged,20,'planks moved from the racks onto the order pallet, none made');
  assert.equal(p().cash,cash,'no pay');assert.equal(careerOf(p(),'ridgeline').rep,rep,'no reputation');
 }finally{await g.done()}}
console.log('PASS workforce-game.mjs: day '+DAY+' at 10:00 the cutter holds the axe at a marked pine, the hauler\'s log and the sawyer at the shed follow the pure pose, no new skinned mesh; the 05:00 tick runs the crew\'s day (trickle once, real logs, at most 2 stumps in yesterday\'s block); the crew\'s supply comes out of the yard; an order untouched for 3 h is staged by the crew for $0; the repeated rules agree.');
