// Timber redesign T-E wiring (notes/timber-redesign-design.md): the pure parts game.js now calls: trunks and slabs on vehicle beds (lengthwise over two cells), loading two logs, the ATV refusing a trunk,
// putting down two logs, a trunk and a slab, no cash timber sale (quest rework), the chainsaw at Rank 3, and old saves loading unchanged (tests/fixtures/save-0.35.18-talk.json).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BEDS,CARGO_KINDS,slotPositions,loadCarry,fits,capacity,unloadOne} from '../dist/cargo.js';
import {putDownLog,putDownSlab,pickUpSlab,normalizeSlabDrops,MAX_SLAB_DROPS,shoulderLog} from '../dist/carry.js';
import {GOODS} from '../dist/world-goods.js';
import {itemById} from '../dist/items.js';
import {MAP} from '../dist/map-definition.js';
import {SAWS} from '../dist/tools.js';
import {normalizeProgress,freshProgress} from '../dist/jobs.js';
import {normalizeLogs} from '../dist/grid.js';
import {createCargoView,setTimberParts} from '../dist/cargo-view.js';
import * as THREE from '../dist/vendor/three.module.js';

// ── Beds: a trunk lies lengthwise over two cells, never across; logs, planks and crates keep their old places ──
const trunks=n=>Array.from({length:n},()=>({k:'trunk'}));
for(const model of ['flatbed','shortbed']){
 const bed=BEDS[model],spots=slotPositions(model,trunks(capacity(model,'trunk')));
 assert.equal(spots.length,capacity(model,'trunk'));assert(fits(model,trunks(capacity(model,'trunk'))),model+': a full load of trunks fits under MAX_HEIGHT');
 for(const s of spots){assert.equal(s.yaw,0,model+': lengthwise (yaw 0 = along the bed)');
  assert(s.z-CARGO_KINDS.trunk.l/2>=bed.z0-1e-6&&s.z+CARGO_KINDS.trunk.l/2<=bed.z1+1e-6,`${model}: the 2.25 m trunk stays on the ${(bed.z1-bed.z0).toFixed(2)} m bed (z ${s.z})`);
  assert(s.x-.18>=bed.x0-1e-6&&s.x+.18<=bed.x1+1e-6,model+': inside the sides')}
 const seen=new Set(spots.map(s=>`${s.x},${s.y},${s.z}`));assert.equal(seen.size,spots.length,model+': no two trunks in one place');
}
assert(BEDS.shortbed.x1-BEDS.shortbed.x0<CARGO_KINDS.trunk.l,'the shortbed (1.8 m wide) could never take a trunk across');
{const s=slotPositions('flatbed',[{k:'trunk'}])[0];assert(Math.abs(s.z-(BEDS.flatbed.z1-1.25))<1e-6,'the first trunk spans the front two 1.25 m cells');}
{const slabs=Array.from({length:capacity('flatbed','slab')},()=>({k:'slab'}));assert(fits('flatbed',slabs),'60 slabs fit the flatbed');assert(fits('shortbed',slabs.slice(0,capacity('shortbed','slab'))),'22 the shortbed');
 const top=slotPositions('flatbed',slabs).reduce((a,s)=>Math.max(a,s.y),0);assert(top-BEDS.flatbed.y<=1.25,'stacked flat, under the height cap')}
// logs, planks and crates: exactly the old cell walk (the old function, inlined here, for the pieces it knew)
const oldSlots=(model,c)=>{const bed=BEDS[model],CELL={w:.26,l:1.25},cw=bed.across?CELL.l:CELL.w,cl=bed.across?CELL.w:CELL.l,yaw=bed.across?Math.PI/2:0,cols=Math.max(1,Math.floor((bed.x1-bed.x0)/cw)),rows=Math.max(1,Math.floor((bed.z1-bed.z0)/cl)),tops=new Array(cols*rows).fill(0),out=[],x0=(bed.x0+bed.x1)/2-(cols*cw)/2+cw/2,z0=bed.z1-cl/2;
 for(const p of c){const kind=p.k==='log'?'log':'planks',h=CARGO_KINDS[kind].h;let best=0;for(let i=1;i<tops.length;i++)if(tops[i]<tops[best]-1e-9)best=i;const row=Math.floor(best/cols),col=best%cols;out.push({kind,x:+(x0+col*cw).toFixed(3),y:+(bed.y+tops[best]+h/2).toFixed(3),z:+(z0-row*cl).toFixed(3),yaw});tops[best]+=h}return out};
for(const model of Object.keys(BEDS)){const mix=[{k:'log'},{k:'planks',n:4},{k:'log'},{k:'planks',n:2},{k:'log'},{k:'log'}].slice(0,BEDS[model].maxPieces||6);assert.deepEqual(slotPositions(model,mix),oldSlots(model,mix),model+': logs and planks unchanged')}

// ── The bed view: trunks and slabs drawn from the timber parts game.js hands over (one InstancedMesh per kind, made on the first piece; a view made before the parts arrive draws them once they do) ──
{const before=createCargoView('flatbed');before.set([{k:'trunk'},{k:'slab'},{k:'slab'},{k:'log'}]);assert.equal(before.count('trunk'),0,'no model yet: not drawn');
 setTimberParts({trunk:{geometry:new THREE.BoxGeometry(2.3,.35,.35),material:new THREE.MeshStandardMaterial()},slab:{geometry:new THREE.BoxGeometry(2.3,.06,.36),material:new THREE.MeshStandardMaterial()}});
 assert.deepEqual([before.count('trunk'),before.count('slab'),before.count('log')],[1,2,1],'the waiting view draws them when the parts arrive');
 const v=createCargoView('shortbed');v.set(trunks(4));assert.equal(v.count('trunk'),4);const m=v.group.getObjectByName('cargo-trunk'),e=new THREE.Matrix4(),q=new THREE.Quaternion(),pos=new THREE.Vector3(),sc=new THREE.Vector3();m.getMatrixAt(0,e);e.decompose(pos,q,sc);
 const along=new THREE.Vector3(1,0,0).applyQuaternion(q);assert(Math.abs(along.z)>.99,'the model (along x) is turned to lie along the bed');assert.equal(createCargoView('atv').count('trunk'),0)}

// ── Loading: two logs go on as two pieces (one if only one fits), the ATV refuses a trunk ──
{let r=loadCarry({kind:'log',count:2},null,'flatbed');assert.deepEqual(r.cargo,[{k:'log'},{k:'log'}]);assert.equal(r.carry,null);
 r=loadCarry({kind:'log',count:2},Array.from({length:23},()=>({k:'log'})),'flatbed');assert.equal(r.cargo.length,24);assert.deepEqual(r.carry,{kind:'log'},'the bed had room for one: the other stays on the shoulder');
 assert.equal(loadCarry({kind:'trunk'},null,'atv').error,'Trunks do not go on this bed.');assert.deepEqual(loadCarry({kind:'slab'},null,'atv').cargo,[{k:'slab'}],'one slab rides on the ATV rack');
 r=loadCarry({kind:'trunk'},null,'shortbed');assert.deepEqual(r.cargo,[{k:'trunk'}]);assert.match(r.message,/1 trunk/);
 const off=unloadOne(null,r.cargo,'shortbed');assert.deepEqual(off.carry,{kind:'trunk'});assert.match(off.message,/Took a trunk off/);
 assert.match(loadCarry({kind:'trunk'},[{k:'crate'}],'shortbed').error,/do not mix/)}

// ── Hands: two logs, a trunk and a slab put down ──
{const base={...freshProgress(),logs:[{id:4,x:100,z:-250,rot:0,t:0}],nextLogId:5};
 const two=putDownLog({...base,carry:{kind:'log',count:2}},{x:101,z:-251,rot:0});assert.equal(two.state.carry,null);assert.equal(two.state.logs.length,3);assert.deepEqual(two.state.logs.slice(1).map(l=>l.id),[5,6]);assert(two.state.logs.slice(1).every(l=>!l.kind));assert.equal(two.message,'You put the logs down.');
 assert(Math.abs(two.state.logs[1].z-two.state.logs[2].z)>.2,'side by side');
 const t=putDownLog({...base,carry:{kind:'trunk'}},{x:101,z:-251,rot:1});assert.equal(t.state.logs.at(-1).kind,'trunk');assert.equal(t.message,'You put the trunk down.');
 const back=shoulderLog(t.state,t.state.logs.at(-1).id);assert.deepEqual(back.state.carry,{kind:'trunk'});assert.match(shoulderLog({...t.state,carry:{kind:'log'}},t.state.logs.at(-1).id).error,/hands are full/,'a trunk needs empty hands');
 let s={...base,carry:{kind:'slab'}};const d=putDownSlab(s,{x:101,z:-251,q:5});assert.deepEqual(d.state.slabDrops,[{id:1,x:101,z:-251,q:1}]);assert.equal(d.state.carry,null);
 const up=pickUpSlab(d.state,1);assert.deepEqual(up.state.carry,{kind:'slab'});assert.deepEqual(up.state.slabDrops,[]);assert.match(pickUpSlab(up.state,1).error,/hands are full/);
 for(let i=0;i<MAX_SLAB_DROPS+2;i++)s=putDownSlab({...s,carry:{kind:'slab'}},{x:101,z:-251}).state;assert.equal(s.slabDrops.length,MAX_SLAB_DROPS,'a put-down always works: the oldest goes at the limit');
 assert.deepEqual(normalizeSlabDrops([{id:1,x:101,z:-251,q:2},{id:1,x:101,z:-251},{id:2,x:9000,z:0},null]),[{id:1,x:101,z:-251,q:2}])}
// -- Quest rework: NO raw cash sale of a trunk or a slab at the lumberyard (owner 2026-11-18); a slab is delivered at the piece rate (tests/quest-chain.mjs) --
import * as ECON from '../dist/plank-economy.js';
assert.equal(ECON.sellTimber,undefined);assert.equal(ECON.TIMBER_SALE_CENTS,undefined);assert.equal(GOODS.trunks.baseCents,2800);assert.equal(GOODS.slabs.baseCents,1800)

// ── The basic chainsaw: Rank 3 Hauler, level 5, $350; the logging chainsaw unchanged ──
assert.deepEqual([itemById('chainsaw').price,itemById('chainsaw').requires.level,SAWS.chainsaw.level],[35000,5,5]);assert.deepEqual([itemById('logging-chainsaw').price,itemById('logging-chainsaw').requires.level],[150000,20]);
{const E=MAP.employers.find(e=>e.id==='ridgeline');assert.equal(E.ranks[2].id,'hauler');assert.deepEqual(E.store,[{item:'chainsaw',rank:3},{item:'logging-chainsaw',rank:6}])}

// ── Saves: an old save loads unchanged; the new fields survive a round trip ──
{const old=JSON.parse(readFileSync('tests/fixtures/save-0.35.18-talk.json','utf8')).progress,a=normalizeProgress(old);
 assert.equal(a.slabDrops,undefined,'no slabDrops field on an old save');assert.deepEqual(a.logs,[]);assert.equal(a.carry,null);assert.equal(a.sawmillYard.v,2);assert.deepEqual([a.sawmillYard.trunks,a.sawmillYard.slabs,a.sawmillYard.logs,a.sawmillYard.planks],[0,0,0,0]);
 assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(a))),a,'normalising twice changes nothing');
 const withOld={...old,logs:[{id:1,x:100,z:-250,rot:0,t:5}],nextLogId:2,carry:{kind:'log'},sawmillYard:{v:1,logs:3,planks:8,on:true,cutMin:1}},b=normalizeProgress(withOld);
 assert.deepEqual(b.logs,[{id:1,x:100,z:-250,rot:0,t:5}],'an old log stays a log (no kind added)');assert.deepEqual(b.carry,{kind:'log'});assert.deepEqual([b.sawmillYard.logs,b.sawmillYard.planks,b.sawmillYard.trunks],[3,8,0]);
 const c=normalizeProgress({...old,logs:[{id:1,x:100,z:-250,rot:0,t:5,kind:'trunk'},{id:2,x:100,z:-251,kind:'plank'}],carry:{kind:'log',count:2},slabDrops:[{id:3,x:101,z:-251,q:1}],sawmillYard:{v:2,trunks:4,slabs:6,logs:1,planks:0,cutKind:'trunk',cutMin:2,on:true}});
 assert.deepEqual(c.logs.map(l=>l.kind),['trunk',undefined],'a trunk stays a trunk; a bad kind is a log');assert.deepEqual(c.carry,{kind:'log',count:2});assert.deepEqual(c.slabDrops,[{id:3,x:101,z:-251,q:1}]);assert.deepEqual([c.sawmillYard.trunks,c.sawmillYard.slabs],[4,6]);
 assert.deepEqual(normalizeProgress({...old,carry:{kind:'trunk'}}).carry,{kind:'trunk'});assert.deepEqual(normalizeProgress({...old,carry:{kind:'slab'}}).carry,{kind:'slab'});
 assert.deepEqual(normalizeLogs([{id:9,x:100,z:-250,kind:'trunk'}])[0].kind,'trunk')}
console.log('PASS timber-wiring.mjs: trunks and slabs lie lengthwise on the flatbed and shortbed (two cells, never across), logs/planks keep their old bed places, two logs load as two, the ATV refuses a trunk, two logs/trunk/slab put down and picked up, the lumberyard has no cash sale of trunks or slabs, the chainsaw at Rank 3 level 5 $350, old saves load unchanged.');
