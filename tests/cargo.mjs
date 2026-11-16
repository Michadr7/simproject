// Cargo on vehicle beds (0.35, flatbed step 2): the beds and their space, MIXED loads (logs and planks together, the last piece on is the first off), where each piece lies,
// the load slowing the vehicle, the save (and the first build's {kind, count}), the drawn cargo, and the flatbed's tailgate opening for someone standing behind it.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {BEDS,capacity,spaceOf,usedSpace,countOf,slotPositions,normalizeCargo,loadCarry,unloadOne,takeAll,loadOf,loadPoints,cargoText} from '../dist/cargo.js';
import {CLASSES,withLoad,normalizeVehicles,freshVehicle,stepVehicle} from '../dist/vehicle.js';
import {SURFACE} from '../dist/terrain.js';
import {createDriving} from '../dist/driving.js';
import {MAP} from '../dist/map-definition.js';
import {TAILGATE_OPEN} from '../dist/flatbed.js';

const L={k:'log'},P=n=>({k:'planks',n});
assert.deepEqual(Object.keys(BEDS).sort(),['flatbed','offroad','shortbed','worktruck']);
assert.equal(spaceOf('flatbed'),120);assert.equal(capacity('flatbed','planks'),120);assert.equal(capacity('flatbed','log'),24);assert.equal(capacity('worktruck','log'),6);assert.equal(capacity('car','log'),0);
// a full bed of each kind, and a mixed one, lie inside the bed and never too high
for(const [model,bed] of Object.entries(BEDS)){assert(bed.x0>-CLASSES[model].hx&&bed.x1<CLASSES[model].hx&&bed.z0>-CLASSES[model].hz&&bed.z1<CLASSES[model].hz,`${model}: the bed is inside the body`);
 const loads=[Array(capacity(model,'log')).fill(L),Array(capacity(model,'planks')/4).fill(P(4)),[...Array(Math.floor(capacity(model,'log')/2)).fill(L),...Array(Math.floor(spaceOf(model)/2/4)).fill(P(4))]];
 for(const load of loads){let c=null;for(const piece of load){const r=loadCarry(piece.k==='log'?{kind:'log'}:{kind:'planks',count:piece.n},c,model);assert(!r.error,`${model}: ${r.error}`);c=r.cargo}
  const spots=slotPositions(model,c);assert.equal(spots.length,c.length);for(const s of spots){assert(s.x>=bed.x0&&s.x<=bed.x1&&s.z>=bed.z0&&s.z<=bed.z1,`${model}: (${s.x}, ${s.z}) on the bed`);assert(s.y>bed.y&&s.y<bed.y+1.5,`${model}: not piled too high (${s.y})`)}}}
// loading: mixed, last on first off, full is full
let c=null;for(const carry of [{kind:'log'},{kind:'planks',count:4},{kind:'log'},{kind:'planks',count:3}]){const r=loadCarry(carry,c,'flatbed');assert(!r.error,r.error);assert.equal(r.carry,null);c=r.cargo}
assert.deepEqual(c,[L,P(4),L,P(3)],'logs and planks together, in the order they went on');assert.equal(countOf(c,'log'),2);assert.equal(countOf(c,'planks'),7);assert.equal(usedSpace(c),17);assert.equal(cargoText(c),'2 logs, 7 planks');
{const r=unloadOne(null,c,'flatbed');assert.deepEqual(r.carry,{kind:'planks',count:3},'the last piece on comes off first');assert.deepEqual(r.cargo,[L,P(4),L]);const r2=unloadOne(null,r.cargo,'flatbed');assert.deepEqual(r2.carry,{kind:'log'})}
assert.match(unloadOne({kind:'log'},c,'flatbed').error,/hands are full/);assert.match(unloadOne(null,null,'flatbed').error,/empty/);assert.match(loadCarry(null,c,'flatbed').error,/Carry/);assert.match(loadCarry({kind:'log'},null,'car').error,/no bed/);
{const six=Array(6).fill(L);assert(!loadCarry({kind:'planks',count:2},six,'worktruck').error,'six logs (30 of 32) leave room for two planks');assert.match(loadCarry({kind:'planks',count:3},six,'worktruck').error,/full/,'but not three');assert.match(loadCarry({kind:'log'},six,'worktruck').error,/full/,'nor a seventh log')}
{const r=takeAll([L,P(4),L,P(2)],'planks');assert.deepEqual(r.cargo,[L,L]);assert.equal(r.count,6);assert.equal(takeAll([P(4)],'planks').cargo,null)}
assert.equal(cargoText(null),'empty');assert.equal(cargoText([P(1)]),'1 plank');
// normalising: the list, and the first build's {kind, count}; bad pieces dropped; clamped to the space
assert.deepEqual(normalizeCargo([L,P(4),{k:'gold'},P(9),null],'flatbed'),[L,P(4)]);assert.equal(normalizeCargo([],'flatbed'),null);assert.equal(normalizeCargo([L],'car'),null);
assert.deepEqual(normalizeCargo({kind:'planks',count:10},'flatbed'),[P(4),P(4),P(2)],'the old {kind, count}');assert.equal(normalizeCargo({kind:'log',count:99},'worktruck').length,6,'clamped to the space');
// a load slows the vehicle
{const full=withLoad(CLASSES.flatbed,loadOf('flatbed',Array(30).fill(P(4))));assert(Math.abs(full.top-CLASSES.flatbed.top*.8)<1e-9);assert(full.accel<CLASSES.flatbed.accel);assert.equal(withLoad(CLASSES.flatbed,0),CLASSES.flatbed);
 const open={blocked:()=>false,surface:()=>SURFACE.ROAD},run=cls=>{let s=freshVehicle({x:0,z:0,yaw:0});for(let i=0;i<60*20;i++)s=stepVehicle(s,{throttle:1},1/60,cls,open).state;return s.speed};
 assert(run(full)<run(CLASSES.flatbed)-1,`a full flatbed is slower after 20 s (${run(full).toFixed(1)} against ${run(CLASSES.flatbed).toFixed(1)} m/s)`)}
// the save keeps the cargo of an owned vehicle
{const list=normalizeVehicles([{uid:'v1',model:'flatbed',colour:'blue',x:100,z:10,yaw:0,cargo:[L,P(4)]},{uid:'v2',model:'worktruck',x:110,z:10,yaw:0,cargo:{kind:'log',count:50}}],MAP.vehicles,MAP.playable);
 assert.deepEqual(list[0].cargo,[L,P(4)]);assert.equal(list[1].cargo.length,6,'clamped to what the bed holds')}
// in the driving module
{const real={blocked:()=>false,surface:()=>SURFACE.ROAD},d=createDriving({scene:new THREE.Scene(),surface:real.surface,footing:()=>0,baseBlocked:real.blocked,saved:[{uid:'v1',model:'flatbed',colour:'orange',x:150,z:30,yaw:0,cargo:[L,L,P(4)]},{uid:'v2',model:'worktruck',colour:'olive',x:170,z:30,yaw:0}]});
 const f=d.byId.get('v1');assert.equal(f.view.count('log'),2,'two logs drawn');assert.equal(f.view.count('planks'),1,'and a stack of planks');
 const rear=loadPoints('flatbed').find(p=>p.side==='rear');assert.equal(d.bedsNear(150+rear.x,30+rear.z).map(b=>b.id).join(),'v1','standing behind the flatbed reaches its bed');assert.equal(d.bedsNear(150,50).length,0,'not from far away');
 assert.equal(d.bedsNear(MAP.vehicles[2].home.x,MAP.vehicles[2].home.z-6).length,0,'a display vehicle on the lot is not loaded');
 d.setCargo('v1',[P(4),P(4),P(1)]);assert.equal(f.view.count('planks'),3);assert.equal(f.view.count('log'),0);
 assert.deepEqual(d.save().find(v=>v.uid==='v1').cargo,[P(4),P(4),P(1)],'the cargo is saved');assert.equal(d.save().find(v=>v.uid==='v2').cargo,undefined,'an empty bed saves nothing');
 const tg=f.mesh.userData.tailgate;assert.equal(tg.rotation.x,0,'the tailgate starts shut');d.setWalker({x:150+rear.x,z:30+rear.z});for(let i=0;i<40;i++)d.update(1/30);assert(Math.abs(tg.rotation.x)<1e-9,'standing behind it does not open it: it is opened by hand');assert.equal(d.toggleGate('v1'),true);for(let i=0;i<40;i++)d.update(1/30);assert(Math.abs(tg.rotation.x-TAILGATE_OPEN)<1e-6,'toggleGate opens it and it stays open');assert.equal(d.bedsNear(150+rear.x,30+rear.z)[0].gateOpen,true);
 d.setWalker({x:150,z:60});for(let i=0;i<40;i++)d.update(1/30);assert(Math.abs(tg.rotation.x-TAILGATE_OPEN)<1e-6,'walking away leaves it open');assert.equal(d.toggleGate('v1'),false);for(let i=0;i<40;i++)d.update(1/30);assert(Math.abs(tg.rotation.x)<1e-9,'and toggling again shuts it')}
// ---- G3b: the crate piece (one InstancedMesh, never carried by hand, never mixed with timber, not on the timber flatbed)
{const C=await import('../dist/cargo.js'),{createCargoView}=await import('../dist/cargo-view.js');
 assert.deepEqual(Object.keys(C.CARGO_KINDS).sort(),['crate','log','planks'],'three kinds');
 assert.deepEqual(Object.entries(BEDS).filter(([,b])=>b.crates).map(([m])=>m).sort(),['offroad','shortbed','worktruck'],'the pickups take crates');assert(!BEDS.flatbed.crates&&!C.acceptsCrates('flatbed')&&C.acceptsCrates('shortbed'),'the timber flatbed refuses them');
 assert.equal(capacity('shortbed','crate'),22,'22 crates on the Shortbed (2 units each of 44)');assert.equal(capacity('flatbed','crate'),0);assert.equal(capacity('worktruck','crate'),16);
 const four=C.addCrates(null,'shortbed',4);assert.equal(four.error,undefined);assert.equal(four.cargo.length,4);assert.equal(C.countOf(four.cargo,'crate'),4);assert.equal(C.usedSpace(four.cargo),8);assert.equal(C.cargoText(four.cargo),'4 crates');assert.equal(C.cargoText(C.addCrates(null,'shortbed',1).cargo),'1 crate');
 assert(C.addCrates(null,'flatbed',1).error,'no crates on the flatbed');assert(C.addCrates(null,'shortbed',23).error,'23 do not fit');assert.equal(C.addCrates(null,'shortbed',22).cargo.length,22);assert(C.addCrates([{k:'log'}],'shortbed',1).error,'timber on the bed: refused');assert(C.addCrates(null,'tow_tank',1).error,'no bed');
 assert(C.addPlanks(four.cargo,'shortbed',4).error,'planks onto a crate bed: refused');assert.equal(C.loadCarry({kind:'log'},four.cargo,'shortbed').error,C.CRATE_MIX);assert.equal(C.unloadOne(null,four.cargo,'shortbed').error,C.CRATE_HANDS,'never carried by hand');assert.equal(C.unloadKind(null,four.cargo,'shortbed','crate').error,C.CRATE_HANDS);assert.equal(C.takeAll(four.cargo,'planks').cargo.length,4);
 const norm=C.normalizeCargo([{k:'crate'},{k:'crate'}],'shortbed');assert.equal(norm.length,2,'a save keeps crates');assert.equal(C.normalizeCargo([{k:'crate'}],'flatbed'),null,'crates dropped on a bed that refuses them');assert.deepEqual(C.normalizeCargo([{k:'log'},{k:'crate'}],'shortbed'),[{k:'log'}],'timber wins over crates in a bad save');assert.equal(C.normalizeCargo(Array.from({length:30},()=>({k:'crate'})),'shortbed').length,22,'a save over the space is cut');
 const slots=slotPositions('shortbed',C.addCrates(null,'shortbed',22).cargo),bed=BEDS.shortbed;assert.equal(slots.length,22);assert(slots.every(s=>s.kind==='crate'&&s.x-.29>=bed.x0-.01&&s.x+.29<=bed.x1+.01&&s.z+.19<=bed.z1+.01&&s.z-.19>=bed.z0-.01),'every crate lies inside the deck');
 assert.equal(new Set(slots.filter(s=>s.y<1.3).map(s=>s.x)).size,3,'three across');assert(slots.some(s=>Math.abs(s.y-1.66)<.01)&&slots.every(s=>s.y<=1.7),'stacked two high at most');assert(C.fits('shortbed',C.addCrates(null,'shortbed',22).cargo));
 assert.equal(slotPositions('shortbed',four.cargo).filter(s=>Math.abs(s.y-1.66)<.01).length,0,'four crates are one layer');
 const gone=C.removeCrates(four.cargo,3);assert.equal(gone.count,3);assert.equal(gone.cargo.length,1);assert.equal(C.removeCrates(four.cargo).cargo,null);assert.equal(C.removeCrates(null).count,0);
 // the picture: ONE instanced mesh for all the crates, made on the first one, zero instances when empty
 const v=createCargoView('shortbed');assert.equal(v.group.children.filter(m=>m.name==='cargo-crate').length,0,'no crate mesh before the first crate');v.set(four.cargo);const cm=v.group.children.find(m=>m.name==='cargo-crate');assert(cm&&cm.isInstancedMesh,'one InstancedMesh');assert.equal(cm.count,4);assert.equal(v.count('crate'),4);assert(!Array.isArray(cm.material),'one material');
 const v2=createCargoView('shortbed');v2.set(C.addCrates(null,'shortbed',22).cargo);assert.equal(v2.group.children.filter(m=>m.name==='cargo-crate').length,1,'22 crates are still one draw call');assert.equal(v2.group.children.find(m=>m.name==='cargo-crate').count,22);assert.equal(v2.group.children.find(m=>m.name==='cargo-crate').material,cm.material,'the material is shared between vehicles');
 v.set(null);assert.equal(cm.count,0,'hidden when empty');v.set(C.addCrates(null,'shortbed',2).cargo);assert.equal(cm.count,2);assert.equal(createCargoView('flatbed').group.children.some(m=>m.name==='cargo-crate'),false,'the flatbed never builds one');}
console.log('PASS cargo.mjs: three beds (the flatbed 120 units: 24 logs or 120 planks or any mix; the pickups 32), mixed loads with the last piece on first off, every piece on its bed, a load slows the vehicle, the save keeps it (and reads the first build\'s format), the drawn cargo follows it, owned vehicles only, and the flatbed\'s tailgate opens for someone behind it.');
