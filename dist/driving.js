// The drivable vehicles in the world (0.33, DESIGN 4.13 D): their meshes, who is driving, enter and exit, the chase camera numbers and the saved poses. The rules live in vehicle.js (pure);
// game.js feeds the keys and the world in. A vehicle stays exactly where it was left. y is never stored: the body follows the ground footing under it (smoothed), with a little visual pitch and roll.
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {createProp} from './props.js';
import {WHEELS} from './vehicle-parts.js';
import {CLASSES,freshVehicle,stepVehicle,poseFree,findSafePose,exitPoint,doorPoint,seatPoint,insideHull,vehiclesToSave,PLAYER_RADIUS} from './vehicle.js';

const UP=new THREE.Vector3(0,1,0),clamp=THREE.MathUtils.clamp;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// scene: the world's scene; fade: the sightline fade (props need it); surface(x, z): terrain surface id; footing(x, z): ground height under a point; baseBlocked(x, z): the game's blocked() WITHOUT the vehicles
// (so a vehicle never collides with itself); saved: progress.vehicles (already normalized).
export function createDriving({scene,fade,surface,footing,baseBlocked,saved=[]}){
 const fleet=MAP.vehicles.map(spec=>{
  const cls=CLASSES[spec.model],mesh=createProp(spec.model,fade);mesh.name='vehicle-'+spec.id;mesh.rotation.order='YXZ';scene.add(mesh);
  const front=spec.model==='flatbed'?{tyres:mesh.getObjectByName('wheels-tyres'),hubs:mesh.getObjectByName('wheels-hubs')}:null; // the generated wheels: the front pair steers (a prop whose wheels are baked in cannot)
  return {spec,cls,mesh,state:freshVehicle(spec.home),y:footing(spec.home.x,spec.home.z),pitch:0,roll:0,wheelAngle:0,lastSpeed:0,front};
 });
 const byId=new Map(fleet.map(f=>[f.spec.id,f])),others=skip=>fleet.filter(f=>f!==skip).map(f=>({state:f.state,cls:f.cls}));
 const envFor=(f,people)=>({blocked:baseBlocked,surface,others:others(f),people});
 let driven=null,lastHit=false;
 // Saved poses: a pose that has become blocked (a prop placed later, a rule change) moves to the nearest clear one, else the vehicle goes home (never stuck, never lost).
 for(const f of fleet){
  const s=saved.find(v=>v.uid===f.spec.id);if(!s)continue;
  const pose={x:s.x,z:s.z,yaw:s.yaw},env=envFor(f);
  const ok=poseFree(pose,f.cls,env)?pose:findSafePose(pose,f.cls,env);
  if(ok)f.state=freshVehicle(ok);
 }
 const place=f=>{f.mesh.position.set(f.state.x,f.y,f.state.z);f.mesh.rotation.set(f.pitch,f.state.yaw,f.roll)};
 fleet.forEach(place);
 const setFront=(f,angle)=>{ // steer the front wheel pair of the flatbed: instances 4 and 5 (the last pair of addWheels)
  if(!f.front||!f.front.tyres||Math.abs(angle-f.wheelAngle)<.005)return;f.wheelAngle=angle;
  const spec=WHEELS.flatbed,z=spec.z[spec.z.length-1],q=new THREE.Quaternion().setFromAxisAngle(UP,angle),m=new THREE.Matrix4(),p=new THREE.Vector3(),s=new THREE.Vector3();
  let i=(spec.z.length-1)*2;for(const side of [-1,1]){
   f.front.tyres.setMatrixAt(i,m.compose(p.set(side*spec.x,spec.radius,z),q,s.set(spec.width,spec.radius,spec.radius)));
   f.front.hubs.setMatrixAt(i,m.compose(p.set(side*(spec.x+.02),spec.radius,z),q,s.set(spec.width+.04,spec.radius*.52,spec.radius*.52)));i++}
  f.front.tyres.instanceMatrix.needsUpdate=f.front.hubs.instanceMatrix.needsUpdate=true;
 };
 return {
  fleet,byId,
  get active(){return driven},
  get speed(){return driven?Math.abs(driven.state.speed):0},
  get yaw(){return driven?driven.state.yaw:0},
  get hit(){return lastHit},
  // The chase camera for the driven vehicle: distance and pitch from its class (behind and above, DESIGN D).
  cameraZoom(f=driven){return f?Math.hypot(f.cls.camera.back,f.cls.camera.up):7},
  cameraPitch(f=driven){return f?Math.atan2(f.cls.camera.up,f.cls.camera.back):.38},
  // Door points of the vehicles that can be entered (not while driving): [{id, name, x, z}]
  doors(){return driven?[]:fleet.map(f=>({id:f.spec.id,name:f.spec.name,...doorPoint(f.state,f.cls)}))},
  seat(){return driven?seatPoint(driven.state,driven.cls):null},
  door(){return driven?doorPoint(driven.state,driven.cls):null},
  enter(id){const f=byId.get(id);if(!f||driven)return false;driven=f;f.lastSpeed=f.state.speed=0;return true},
  // Get out: the driver's door point, else the passenger side, behind, in front (`free(x, z)` is the game's blocked() inverted). Returns the point, or null (the caller then uses its safe-spot search).
  leave(free){if(!driven)return null;const f=driven,p=exitPoint(f.state,f.cls,free);driven=null;f.state.speed=0;f.state.steer=0;return p},
  // One slice of driving (dt <= 1/30 s). input: {throttle, steer, brake}; people: [{x, z, r}] pedestrians.
  step(dt,input,people=[]){if(!driven)return null;const r=stepVehicle(driven.state,input,dt,driven.cls,envFor(driven,people));driven.state=r.state;lastHit=r.hit;return r},
  // Meshes follow the states (every frame; a parked vehicle just stays where it is).
  update(dt){for(const f of fleet){
   const s=f.state,accel=dt>0?(s.speed-f.lastSpeed)/dt:0,lateral=s.speed*(Math.abs(s.speed)<.01?0:s.steer*s.speed/Math.max(f.cls.rMin,s.speed*s.speed/f.cls.aLat));f.lastSpeed=s.speed;
   const k=1-Math.exp(-dt*8);f.pitch+=(clamp(-.01*accel,-.04,.04)-f.pitch)*k;f.roll+=(clamp(.012*lateral,-.05,.05)-f.roll)*k;
   f.y+=(footing(s.x,s.z)-f.y)*(1-Math.exp(-dt*10));setFront(f,s.steer*.5);place(f)}},
  // Can a walker stand here? false inside any vehicle's hull inflated by the player radius (blocked() adds this).
  blocksWalker(x,z){for(const f of fleet){if(Math.abs(x-f.state.x)>f.cls.hz+PLAYER_RADIUS+.1||Math.abs(z-f.state.z)>f.cls.hz+PLAYER_RADIUS+.1)continue;if(insideHull(f.state,f.cls,x,z,PLAYER_RADIUS))return true}return false},
  // The poses to save (vehicles away from home).
  save(){return vehiclesToSave(MAP.vehicles,Object.fromEntries(fleet.map(f=>[f.spec.id,f.state])))},
  // Put every vehicle back in its bay (a debug aid and the last resort).
  sendHome(id){const f=byId.get(id);if(f&&f!==driven)f.state=freshVehicle(f.spec.home)}
 };
}
