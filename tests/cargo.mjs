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
assert.deepEqual(Object.keys(BEDS).sort(),['flatbed','offroad','worktruck']);
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
console.log('PASS cargo.mjs: three beds (the flatbed 120 units: 24 logs or 120 planks or any mix; the pickups 32), mixed loads with the last piece on first off, every piece on its bed, a load slows the vehicle, the save keeps it (and reads the first build\'s format), the drawn cargo follows it, owned vehicles only, and the flatbed\'s tailgate opens for someone behind it.');
