// The Kasumuchi S70 shortbed truck (0.35.8): the converted model's parts, anchors and pivots, wheels that sit on the ground, steering to 35 degrees, suspension from the rest height, doors and steering wheel,
// the paint (one material for the body and both doors), the class (65 mph, slow off the mark, 5 mpg, gasoline), the lot slot, the $500 price, and that nothing hangs below the ground.
import assert from 'node:assert/strict';
import {SHORTBED} from '../dist/shortbed-assets.js';
import {buildShortbed,SHORTBED_INFO,SHORTBED_STEER,SHORTBED_DOOR_OPEN,SHORTBED_GRIP} from '../dist/shortbed.js';
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
assert(SHORTBED.triangles<=8000,`within the 8,000-triangle budget (7,000 for the truck, 764 for the interior) (${SHORTBED.triangles})`);assert.equal(SHORTBED.triangles,7758);
assert.deepEqual(Object.keys(SHORTBED.parts).sort(),['body','door-l','door-l-glass','door-l-paint','door-r','door-r-glass','door-r-paint','glass','interior','lights','paint','steer-wheel','wheel-fl','wheel-fr','wheel-rl','wheel-rr']);
for(const a of ['door_driver','door_passenger','driver_seat','exhaust','fuel_port','engine_sound','headlight_L','headlight_R','taillight_L','taillight_R','tailgate_hinge','cargo_0','cargo_3','load_rear'])assert(SHORTBED.anchors[a],`anchor ${a}`);
assert.deepEqual(SHORTBED.anchors.fuel_port,[.98,.86,-.25]);assert.deepEqual(SHORTBED.anchors.driver_seat,[.45,1.3,.9]);assert.deepEqual(SHORTBED.pivots['door-l'],[.96,1.35,2.479]);
// nothing below the ground: the real extent (parts back in their rest places) starts at the tyres' bottom, not at -0.577 (that is a door mesh in its pivot's frame)
assert(SHORTBED.bounds.min[1]>=0&&SHORTBED.bounds.min[1]<.02,`tyres touch the ground (${SHORTBED.bounds.min[1]})`);assert(Math.abs(SHORTBED.bounds.max[1]-2.41)<.01,'V7: the roof is 2.41 m up (0.21 m above V6)');assert.equal(SHORTBED_INFO.height,2.41);
assert(Math.abs(SHORTBED.bounds.max[2]-SHORTBED.bounds.min[2]-5.513)<.01&&Math.abs(SHORTBED.bounds.max[0]*2-2.21)<.01,'5.513 x 2.21 m with the mirrors');
assert.equal(propInfo('shortbed'),SHORTBED_INFO);assert.equal(SHORTBED_INFO.depth,5.514);
// V7: the seated 1.95 m player (character.js: head top 1.927 m above the group origin with the hips 0.95 m up, leaning 0.25 rad) fits under the roof with 0.1 m or more; the lamp lenses face out on BOTH sides; the interior stays inside the shell
{const head=SHORTBED.anchors.driver_seat[1]-.95+1.927;assert(SHORTBED.bounds.max[1]-head>=.1,`head clearance ${(SHORTBED.bounds.max[1]-head).toFixed(3)} m (at least 0.1)`)}
assert.deepEqual({hips:SHORTBED_GRIP.hips,lean:SHORTBED_GRIP.lean},{hips:.35,lean:.25},'the seated pose: hips well forward, leaning in, so the short arms reach the rim');assert(SHORTBED_GRIP.radius>.17&&SHORTBED_GRIP.radius<.25&&Math.abs(SHORTBED_GRIP.angle-Math.PI/4)<1e-9);
{const u16=s=>new Uint16Array(Uint8Array.from(Buffer.from(s,'base64')).buffer),f32=s=>new Float32Array(Uint8Array.from(Buffer.from(s,'base64')).buffer);
 const L=SHORTBED.parts.lights,pos=f32(L.positions),nor=f32(L.normals),idx=u16(L.indices),face={left:0,right:0};
 for(let t=0;t<idx.length;t+=3){const [a,b,c]=[idx[t],idx[t+1],idx[t+2]],A=[0,1,2].map(k=>pos[a*3+k]),B=[0,1,2].map(k=>pos[b*3+k]),C=[0,1,2].map(k=>pos[c*3+k]),u=B.map((v,k)=>v-A[k]),v=C.map((x,k)=>x-A[k]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(A[2]>2.69&&nor[a*3+2]>.99){assert(n[2]>0,'a headlight lens front face winds towards +z (it is drawn, not culled)');face[A[0]>0?'left':'right']++}}
 assert(face.left>=1&&face.left===face.right,`the same number of forward-facing lens faces on both sides (${face.left}, ${face.right})`);
 const I=SHORTBED.parts.interior,ip=f32(I.positions);for(let i=0;i<ip.length;i+=3){const x=Math.abs(ip[i]),z=ip[i+2],cap=.84+(.78-.84)*Math.min(1,Math.max(0,(z-1.9)/.4));assert(x<=cap+1e-4,`interior vertex inside the shell (|x| ${x.toFixed(3)} at z ${z.toFixed(2)})`)}}// the built truck
const mesh=createProp('shortbed',{apply:m=>m});const w=mesh.userData.wheels;assert.equal(w.length,4);assert.deepEqual(w.map(x=>x.front),[true,true,false,false]);
for(const x of w)assert(Math.abs(x.pivot.position.y-.405)<1e-6&&x.radius===.401,'axle .405 above the ground, radius .401: the tyre bottom is .004 m off the ground');
assert(w[0].pivot.position.z>1.6&&w[2].pivot.position.z<-1.2&&Math.abs(w[0].pivot.position.z-w[2].pivot.position.z-3)<1e-6,'wheelbase 3.0 m');assert(Math.abs(w[0].pivot.position.x-w[1].pivot.position.x-1.66)<1e-6,'track 1.66 m');
assert(Math.abs(w[0].max-35*Math.PI/180)<1e-9&&w[2].max===0&&SHORTBED_STEER===w[0].max);
// one geometry per part, shared by every truck; the paint material is one object on the body and both doors
{const m2=createProp('shortbed',{apply:m=>m});const geo=[];mesh.traverse(o=>{if(o.isMesh)geo.push(o)});const geo2=[];m2.traverse(o=>{if(o.isMesh)geo2.push(o)});assert.equal(geo.length,16,'16 draw calls per truck: 13 + two door windows + the interior');assert(geo.every((o,i)=>o.geometry===geo2[i].geometry),'geometry shared between trucks');
 const paints=new Set(geo.filter(o=>o.name.endsWith('paint')).map(o=>o.material));assert.equal(paints.size,1,'one paint material');assert.equal(paints.values().next().value,mesh.userData.paint);assert.equal(new Set(geo.map(o=>o.material)).size,4,'four materials: body (wheels, doors, steering wheel and interior share it), paint, glass (body and both door windows), lights')}
// paint: six colours set on the one material (so the doors change with the body)
assert(PAINT.shortbed.direct);assert.equal(coloursOf('shortbed').length,6);assert.equal(defaultColour('shortbed'),'white');
{const m=buildShortbed();applyPaint(m,'shortbed','red');const hex='#'+m.userData.paint.color.getHexString();assert.equal(hex,'#a8322b');let n=0;m.traverse(o=>{if(o.isMesh&&o.name.endsWith('paint')){n++;assert.equal('#'+o.material.color.getHexString(),hex,'body and doors have the one colour')}});assert.equal(n,3)}
// the doors: closed at rest, left -70 degrees about y, right +70 (relative to the rest transform), 0.875 s
{const d=mesh.userData.doors;assert.equal(d.driver.pivot.rotation.y,0);d.driver.pivot.rotation.y=d.driver.sign*SHORTBED_DOOR_OPEN;d.passenger.pivot.rotation.y=d.passenger.sign*SHORTBED_DOOR_OPEN;mesh.updateMatrixWorld(true);
 assert(Math.abs(d.driver.pivot.rotation.y+70*Math.PI/180)<1e-9&&Math.abs(d.passenger.pivot.rotation.y-70*Math.PI/180)<1e-9);assert.equal(SHORTBED.spec.doorSeconds,.875);
 // an open driver's door swings outward (+x) and forward of its hinge's z
 const door=d.driver.pivot.children[0];door.geometry.computeBoundingBox();const b=door.geometry.boundingBox.clone().applyMatrix4(door.matrixWorld);assert(b.max.x>1.6,`the open driver door reaches out (${b.max.x})`);d.driver.pivot.rotation.y=0;d.passenger.pivot.rotation.y=0}
assert(mesh.userData.steeringWheel&&Math.abs(mesh.userData.steeringWheel.position.x-.42)<1e-6);
// 0.35.10: the cab is one-sided in the model (you saw out through its rear wall from inside): body and paint draw both sides (the same materials, the shadow still back faces only); the glass stays single-sided
assert.equal(mesh.userData.paint.side,THREE.DoubleSide);{const bodyMat=mesh.children.find(o=>o.name==='shortbed-body').material,glassMat=mesh.children.find(o=>o.name==='shortbed-glass').material;assert.equal(bodyMat.side,THREE.DoubleSide);assert.equal(bodyMat.shadowSide,THREE.BackSide);assert.equal(mesh.userData.paint.shadowSide,THREE.BackSide);assert.notEqual(glassMat.side,THREE.DoubleSide,'the glass stays front-side only')}
// 0.35.10: the seated driver's hands (game.js updateCabPose: the rim points at +-45 degrees, turned by the wheel's rotation, which is -steer * 1.6 rad, 0.10 m behind the rim) stay 0.15 m or more from every other part of the truck (dash, binnacle, door, windows) at full lock left and right
{const f32=s=>new Float32Array(Uint8Array.from(Buffer.from(s,'base64')).buffer),sw=SHORTBED.pivots['steer-wheel'],verts=[];for(const part of ['body','paint','glass','interior','door-l','door-l-paint','door-l-glass']){const p=f32(SHORTBED.parts[part].positions),o=part.startsWith('door-l')?SHORTBED.pivots['door-l']:[0,0,0];for(let i=0;i<p.length;i+=3)verts.push([p[i]+o[0],p[i+1]+o[1],p[i+2]+o[2]])}
 let nearest=9;for(const steer of [-1,-.5,0,.5,1])for(const k of [-1,1]){const rz=-steer*1.6,x=Math.sin(k*SHORTBED_GRIP.angle)*SHORTBED_GRIP.radius,y=Math.cos(k*SHORTBED_GRIP.angle)*SHORTBED_GRIP.radius,h=[sw[0]+x*Math.cos(rz)-y*Math.sin(rz),sw[1]+x*Math.sin(rz)+y*Math.cos(rz),sw[2]-SHORTBED_GRIP.back];for(const q of verts)nearest=Math.min(nearest,Math.hypot(q[0]-h[0],q[1]-h[1],q[2]-h[2]))}
 assert(nearest>=.15,`the hands stay clear of the dash, door and glass at any steering angle (${nearest.toFixed(3)} m)`)}// the class: 65 mph, slow to get there, 5 mpg (1.6 gal per arcade mile), low tier, a short hull
{const c=CLASSES.shortbed;assert.equal(Math.round(mph(c.top)),65);assert.equal(c.tier,'low');assert.equal(c.mpg,5);assert.equal(c.gallonsPerMile,1.6);assert(c.top/c.accel>15,`takes a while to reach top speed (${(c.top/c.accel).toFixed(1)} s)`);
 assert(c.accel<CLASSES.worktruck.accel,'slower off the mark than the Worktruck');assert(c.gallonsPerMile>CLASSES.worktruck.gallonsPerMile,'thirstier than the Worktruck');assert.equal(+(c.hz*2).toFixed(2),5.51);assert.equal(c.exhaust.z,-2.7);assert(c.seat.z===.9&&c.door.z===.9)}
// lamps sit at the centres of the model's own lamp lenses (its lights part: the headlight lens spans x .588 to .846, y .85 to 1.035, front face z 2.695; the taillight x .805 to .979, y .96 to 1.11, back face z -2.636), mirrored exactly
{const l=lampPoints('shortbed',{});assert.deepEqual(l.front[1],[.717,.94,2.695]);assert.deepEqual(l.rear[1],[.89,1.035,-2.636]);assert.deepEqual(l.front[0],[-.717,.94,2.695]);assert.deepEqual(l.rear[0],[-.89,1.035,-2.636])}
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
 // doors first (doorThen): the door opens, THEN you are put in the seat, then it shuts; leaving the same
 {let got=null,f2=f;assert(!d.active);assert(d.doorThen(f2.spec.id,'driver',()=>{got=door('driver')}));assert(d.doorThen(f2.spec.id,'driver',()=>{throw new Error('a second call must not queue another')}));
  for(let i=0;i<15;i++)d.update(1/30);assert.equal(got,null,'half a second in: nobody is in yet');assert(door('driver')<0&&door('driver')>-SHORTBED_DOOR_OPEN,'the door is mid-swing');assert(!d.active,'still outside while the door opens');
  for(let i=0;i<20;i++)d.update(1/30);assert.equal(got,-SHORTBED_DOOR_OPEN,`the callback ran with the door fully open (${got})`);
  assert(d.enter(f2.spec.id,'driver'));for(let i=0;i<15;i++)d.update(1/30);assert(Math.abs(door('driver')+SHORTBED_DOOR_OPEN)<1e-6,'the door is still open while you sit down');for(let i=0;i<60;i++)d.update(1/30);assert.equal(door('driver'),0,'then it shuts');
  assert(d.seatedAt()&&d.seatedAt().driver&&Math.abs(d.seatedAt().y-(f2.y+1.3))<.1,'seated at the seat anchor height');
  let out=false;assert(d.doorThen(null,'driver',()=>{out=!!door('driver')}));for(let i=0;i<35;i++)d.update(1/30);assert(out&&d.active,'leaving: the door was open when the callback ran, you are still in until then');assert(d.leave(()=>true));
  assert(d.doorThen(null,'driver',()=>{})===false,'nothing to do when not in a vehicle');}
}console.log('PASS shortbed.mjs: the Kasumuchi S70: 7,758 triangles in 16 parts (764 of them the interior) with its anchors, tyres on the ground (nothing below y 0), wheels on pivots (steer 35 degrees), doors swinging 70 degrees, one paint material in six colours, 65 mph and 19 s to reach it, 5 mpg on gasoline, the first car bay, $500.');
