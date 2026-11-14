// The Kasumuchi S70 shortbed truck (0.35.8): the converted model's parts, anchors and pivots, wheels that sit on the ground, steering to 35 degrees, suspension from the rest height, doors and steering wheel,
// the paint (one material for the body and both doors), the class (65 mph, slow off the mark, 5 mpg, gasoline), the lot slot, the $500 price, and that nothing hangs below the ground.
import assert from 'node:assert/strict';
import {SHORTBED} from '../dist/shortbed-assets.js';
import {buildShortbed,SHORTBED_INFO,SHORTBED_STEER,SHORTBED_DOOR_OPEN} from '../dist/shortbed.js';
import {createProp,propInfo} from '../dist/props.js';
import {CLASSES,hullSamples,toWorld} from '../dist/vehicle.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import {VEHICLE_PRICE,buyVehicle,vehicleLock} from '../dist/orders.js';
import {coloursOf,defaultColour,PAINT} from '../dist/paint.js';
import {applyPaint} from '../dist/paint-shader.js';
import {freshProgress} from '../dist/jobs.js';
import {mph} from '../dist/fuel.js';
import {lampPoints} from '../dist/night-lights-rules.js';
import * as THREE from '../dist/vendor/three.module.js';

// the model
assert(SHORTBED.triangles<=7000,`within the 7,000-triangle budget (${SHORTBED.triangles})`);assert.equal(SHORTBED.triangles,6994);
assert.deepEqual(Object.keys(SHORTBED.parts).sort(),['body','door-l','door-l-paint','door-r','door-r-paint','glass','lights','paint','steer-wheel','wheel-fl','wheel-fr','wheel-rl','wheel-rr']);
for(const a of ['door_driver','door_passenger','driver_seat','exhaust','fuel_port','engine_sound','headlight_L','headlight_R','taillight_L','taillight_R','tailgate_hinge','cargo_0','cargo_3','load_rear'])assert(SHORTBED.anchors[a],`anchor ${a}`);
assert.deepEqual(SHORTBED.anchors.fuel_port,[.98,.86,-.25]);assert.deepEqual(SHORTBED.anchors.driver_seat,[.45,1.3,.9]);assert.deepEqual(SHORTBED.pivots['door-l'],[.96,1.35,2.479]);
// nothing below the ground: the real extent (parts back in their rest places) starts at the tyres' bottom, not at -0.577 (that is a door mesh in its pivot's frame)
assert(SHORTBED.bounds.min[1]>=0&&SHORTBED.bounds.min[1]<.02,`tyres touch the ground (${SHORTBED.bounds.min[1]})`);assert(Math.abs(SHORTBED.bounds.max[1]-2.2)<.01);
assert(Math.abs(SHORTBED.bounds.max[2]-SHORTBED.bounds.min[2]-5.513)<.01&&Math.abs(SHORTBED.bounds.max[0]*2-2.21)<.01,'5.513 x 2.21 m with the mirrors');
assert.equal(propInfo('shortbed'),SHORTBED_INFO);assert.equal(SHORTBED_INFO.depth,5.514);
// the built truck
const mesh=createProp('shortbed',{apply:m=>m});const w=mesh.userData.wheels;assert.equal(w.length,4);assert.deepEqual(w.map(x=>x.front),[true,true,false,false]);
for(const x of w)assert(Math.abs(x.pivot.position.y-.405)<1e-6&&x.radius===.401,'axle .405 above the ground, radius .401: the tyre bottom is .004 m off the ground');
assert(w[0].pivot.position.z>1.6&&w[2].pivot.position.z<-1.2&&Math.abs(w[0].pivot.position.z-w[2].pivot.position.z-3)<1e-6,'wheelbase 3.0 m');assert(Math.abs(w[0].pivot.position.x-w[1].pivot.position.x-1.66)<1e-6,'track 1.66 m');
assert(Math.abs(w[0].max-35*Math.PI/180)<1e-9&&w[2].max===0&&SHORTBED_STEER===w[0].max);
// one geometry per part, shared by every truck; the paint material is one object on the body and both doors
{const m2=createProp('shortbed',{apply:m=>m});const geo=[];mesh.traverse(o=>{if(o.isMesh)geo.push(o)});const geo2=[];m2.traverse(o=>{if(o.isMesh)geo2.push(o)});assert.equal(geo.length,13,'13 draw calls per truck');assert(geo.every((o,i)=>o.geometry===geo2[i].geometry),'geometry shared between trucks');
 const paints=new Set(geo.filter(o=>o.name.endsWith('paint')).map(o=>o.material));assert.equal(paints.size,1,'one paint material');assert.equal(paints.values().next().value,mesh.userData.paint);assert.equal(new Set(geo.map(o=>o.material)).size,4,'four materials: body (wheels, doors and steering wheel share it), paint, glass, lights')}
// paint: six colours set on the one material (so the doors change with the body)
assert(PAINT.shortbed.direct);assert.equal(coloursOf('shortbed').length,6);assert.equal(defaultColour('shortbed'),'white');
{const m=buildShortbed();applyPaint(m,'shortbed','red');const hex='#'+m.userData.paint.color.getHexString();assert.equal(hex,'#a8322b');let n=0;m.traverse(o=>{if(o.isMesh&&o.name.endsWith('paint')){n++;assert.equal('#'+o.material.color.getHexString(),hex,'body and doors have the one colour')}});assert.equal(n,3)}
// the doors: closed at rest, left -70 degrees about y, right +70 (relative to the rest transform), 0.875 s
{const d=mesh.userData.doors;assert.equal(d.driver.pivot.rotation.y,0);d.driver.pivot.rotation.y=d.driver.sign*SHORTBED_DOOR_OPEN;d.passenger.pivot.rotation.y=d.passenger.sign*SHORTBED_DOOR_OPEN;mesh.updateMatrixWorld(true);
 assert(Math.abs(d.driver.pivot.rotation.y+70*Math.PI/180)<1e-9&&Math.abs(d.passenger.pivot.rotation.y-70*Math.PI/180)<1e-9);assert.equal(SHORTBED.spec.doorSeconds,.875);
 // an open driver's door swings outward (+x) and forward of its hinge's z
 const door=d.driver.pivot.children[0];door.geometry.computeBoundingBox();const b=door.geometry.boundingBox.clone().applyMatrix4(door.matrixWorld);assert(b.max.x>1.6,`the open driver door reaches out (${b.max.x})`);d.driver.pivot.rotation.y=0;d.passenger.pivot.rotation.y=0}
assert(mesh.userData.steeringWheel&&Math.abs(mesh.userData.steeringWheel.position.x-.42)<1e-6);
// the class: 65 mph, slow to get there, 5 mpg (1.6 gal per arcade mile), low tier, a short hull
{const c=CLASSES.shortbed;assert.equal(Math.round(mph(c.top)),65);assert.equal(c.tier,'low');assert.equal(c.mpg,5);assert.equal(c.gallonsPerMile,1.6);assert(c.top/c.accel>15,`takes a while to reach top speed (${(c.top/c.accel).toFixed(1)} s)`);
 assert(c.accel<CLASSES.worktruck.accel,'slower off the mark than the Worktruck');assert(c.gallonsPerMile>CLASSES.worktruck.gallonsPerMile,'thirstier than the Worktruck');assert.equal(+(c.hz*2).toFixed(2),5.51);assert.equal(c.exhaust.z,-2.7);assert(c.seat.z===.9&&c.door.z===.9)}
// lamps come from the model's headlight and taillight anchors
{const l=lampPoints('shortbed',{});assert.deepEqual(l.front[1],[.72,.97,2.681]);assert.deepEqual(l.rear[1],[.819,1.035,-2.602])}
// the lot, the price and gasoline
{const spec=MAP.vehicles.find(v=>v.model==='shortbed');assert.equal(spec.id,'eastbank-shortbed');assert.equal(spec.sale,'both');assert.equal(spec.fuel.type,'gas');assert.equal(spec.requires,undefined,'no lock');assert.deepEqual(spec.fuel.port,{x:.98,y:.86,z:-.25});
 const bay=MAP.bayRows.find(r=>r.id==='depot-car-bays');assert(spec.home.x>bay.x0&&spec.home.x<bay.x0+bay.width,'the first car bay');assert(spec.home.z-CLASSES.shortbed.hz>=bay.z0-.01,'inside the bay line');assert.deepEqual(validateMap(MAP),[],'the map is valid')}
assert.equal(VEHICLE_PRICE.shortbed,50000,'$500');assert(VEHICLE_PRICE.shortbed<Math.min(...Object.entries(VEHICLE_PRICE).filter(([k])=>k!=='shortbed').map(([,v])=>v)),'the cheapest vehicle');
{const rich={...freshProgress(),cash:2000000,housing:{...freshProgress().housing,rented:true}};assert.equal(vehicleLock(rich,'shortbed'),null);const r=buyVehicle(rich,'shortbed','white');assert(!r.error,r.error);assert.equal(r.state.cash,2000000-50000);assert.equal(r.vehicle.model,'shortbed')}
// in the game (driving.js): the wheels roll and the front pair steers to 35 degrees, the suspension stays within its travel, the steering wheel turns, the doors open when you walk up and shut when you get in
{const {createDriving}=await import('../dist/driving.js'),{SURFACE}=await import('../dist/terrain.js');
 globalThis.document=globalThis.document||{createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
 const d=createDriving({scene:new THREE.Scene(),surface:()=>SURFACE.STREET,footing:()=>0,baseBlocked:()=>false,saved:[]}),f=d.byId.get('eastbank-shortbed');assert(f&&f.present&&f.display,'a display truck on the lot');assert.equal(f.wheels.length,4);
 const ud=f.mesh.userData,door=side=>ud.doors[side].pivot.rotation.y+0;
 d.update(1/30);assert.equal(door('driver'),0,'doors closed at rest');
 const dp=d.doors().find(x=>x.id===f.spec.id&&x.seat==='driver');d.setWalker({x:dp.x+.6,z:dp.z});for(let i=0;i<40;i++)d.update(1/30);
 assert.equal(door('driver'),0,'walking up to the truck does not open the door');
 assert(d.enter(f.spec.id,'driver'));d.setWalker(null);for(let i=0;i<10;i++)d.update(1/30);assert(door('driver')<0&&door('driver')>-SHORTBED_DOOR_OPEN,'getting in: the door is mid-swing after a third of a second (0.875 s to open)');
 for(let i=0;i<18;i++)d.update(1/30);assert(Math.abs(door('driver')+SHORTBED_DOOR_OPEN)<1e-6,`the driver's door is open 70 degrees (${door('driver')})`);assert.equal(door('passenger'),0,'the other door stays shut');
 for(let i=0;i<60;i++)d.update(1/30);assert.equal(door('driver'),0,'the door shuts behind you');
 for(let i=0;i<30;i++){d.step(1/30,{throttle:1,steer:1,brake:false});d.update(1/30)}
 assert(f.state.speed>0&&f.state.steer>.99,'driving, full left lock');assert(Math.abs(f.wheels[0].pivot.rotation.y-35*Math.PI/180)<1e-6&&Math.abs(f.wheels[1].pivot.rotation.y-35*Math.PI/180)<1e-6,'front wheels at 35 degrees');assert.equal(f.wheels[2].pivot.rotation.y,0,'rear wheels do not steer');
 assert(f.wheels[2].spin.rotation.x>0,'wheels roll');assert(ud.steeringWheel.rotation.z<-1,'the steering wheel turned left');
 for(const w of f.wheels)assert(w.pivot.position.y>=w.rest-.06-1e-9&&w.pivot.position.y<=w.rest+.1+1e-9,'suspension within its travel');
 assert(CLASSES.shortbed.top>f.state.speed,'still accelerating');d.leave(()=>true);
}console.log('PASS shortbed.mjs: the Kasumuchi S70: 6,994 triangles in 13 parts with its anchors, tyres on the ground (nothing below y 0), wheels on pivots (steer 35 degrees), doors swinging 70 degrees, one paint material in six colours, 65 mph and 19 s to reach it, 5 mpg on gasoline, the first car bay, $500.');
