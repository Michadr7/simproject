// The drivable vehicles in the world (0.33, DESIGN 4.13 D): their meshes, who sits where, enter and exit, the chase camera numbers and the saved poses. The rules live in vehicle.js (pure);
// game.js feeds the keys and the world in. A vehicle stays exactly where it was left. y is never stored: the body follows the ground footing under it (smoothed), with a little visual pitch and roll.
// Doors: the driver's door (the vehicle's left) puts you in the driver's seat; the passenger's door (the right) in the passenger seat, where you ride along and cannot steer (nobody else can drive yet).
// Vehicles never dissolve when the camera looks through them (the sightline fade would show their empty insides): they are built with a fade that does nothing.
// Wheels (models converted with splitWheels, the Worktruck) are real meshes that spin with the distance travelled and, at the front, steer.
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {createProp} from './props.js';
import {CLASSES,freshVehicle,stepVehicle,poseFree,findSafePose,exitPoint,doorPoint,seatPoint,insideHull,vehiclesToSave,toWorld,PLAYER_RADIUS} from './vehicle.js';
import {normalizeFuelMgal,burnMgal} from './fuel.js';

const clamp=THREE.MathUtils.clamp;
// The filler cap marker (0.35): a glowing disc on the cap and a ring on the ground beside it, in the colour of the fuel the vehicle takes (the pumps' colours: gas red, diesel yellow). Shown only while a nozzle is in your hand.
export const FUEL_COLOURS=Object.freeze({gas:'#e0442f',diesel:'#f2c230'});
function fillerMarker(fuel){
 const side=Math.sign(fuel.port.x)||1,group=new THREE.Group();group.name='filler-marker';group.visible=false;
 const make=geometry=>new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:FUEL_COLOURS[fuel.type],transparent:true,opacity:.9,side:THREE.DoubleSide,fog:false}));
 const cap=make(new THREE.CircleGeometry(.14,20));cap.name='filler-cap';cap.position.set(fuel.port.x+side*.04,.95,fuel.port.z);cap.rotation.y=side*Math.PI/2;
 const halo=make(new THREE.RingGeometry(.17,.24,24));halo.name='filler-halo';halo.position.copy(cap.position);halo.rotation.y=cap.rotation.y;
 const ring=make(new THREE.RingGeometry(.3,.45,32));ring.name='filler-ground';ring.rotation.x=-Math.PI/2;ring.position.set(fuel.port.x+side*.95,.06,fuel.port.z);
 group.add(cap,halo,ring);return group;
}
const SOLID={apply:material=>material}; // no sightline fade for vehicles
export const STEER_ANGLE=.5; // radians of wheel turn at full lock (visual)

// scene: the world's scene; surface(x, z): terrain surface id; footing(x, z): ground height under a point; baseBlocked(x, z): the game's blocked() WITHOUT the vehicles
// (so a vehicle never collides with itself); saved: progress.vehicles (already normalized).
export function createDriving({scene,surface,footing,baseBlocked,saved=[]}){
 const fleet=MAP.vehicles.map(spec=>{
  const cls=CLASSES[spec.model],mesh=createProp(spec.model,SOLID);mesh.name='vehicle-'+spec.id;mesh.rotation.order='YXZ';scene.add(mesh);
  const marker=spec.fuel?fillerMarker(spec.fuel):null;if(marker)mesh.add(marker);
  return {spec,cls,mesh,marker,wheels:mesh.userData.wheels||[],state:freshVehicle(spec.home),y:footing(spec.home.x,spec.home.z),pitch:0,roll:0,spin:0,lastSpeed:0,present:true,fuelMgal:spec.fuel?spec.fuel.tankMgal:0,burn:0};
 });
 const byId=new Map(fleet.map(f=>[f.spec.id,f])),others=skip=>fleet.filter(f=>f!==skip&&f.present).map(f=>({state:f.state,cls:f.cls}));
 const envFor=(f,people)=>({blocked:baseBlocked,surface,others:others(f),people});
 let driven=null,side='driver',lastHit=false,pulse=0;
 // Saved poses: a pose that has become blocked (a prop placed later, a rule change) moves to the nearest clear one, else the vehicle goes home (never stuck, never lost).
 for(const f of fleet){
  const s=saved.find(v=>v.uid===f.spec.id);if(!s)continue;
  const pose={x:s.x,z:s.z,yaw:s.yaw},env=envFor(f);
  const ok=poseFree(pose,f.cls,env)?pose:findSafePose(pose,f.cls,env);
  if(f.spec.fuel)f.fuelMgal=normalizeFuelMgal(s.fuelMgal,f.spec.fuel.tankMgal); // a saved tank (missing: full)
  if(ok)f.state=freshVehicle(ok);
 }
 const place=f=>{f.mesh.position.set(f.state.x,f.y,f.state.z);f.mesh.rotation.set(f.pitch,f.state.yaw,f.roll)};
 fleet.forEach(place);
 return {
  fleet,byId,
  get active(){return driven},
  get seatSide(){return driven?side:null},
  get driving(){return !!driven&&side==='driver'},
  get speed(){return driven?Math.abs(driven.state.speed):0},
  get yaw(){return driven?driven.state.yaw:0},
  get hit(){return lastHit},
  // The chase camera for the occupied vehicle: distance and pitch from its class (behind and above; bigger vehicles are viewed from further away, vehicle.js).
  cameraZoom(f=driven){return f?Math.hypot(f.cls.camera.back,f.cls.camera.up):7},
  cameraPitch(f=driven){return f?Math.atan2(f.cls.camera.up,f.cls.camera.back):.38},
  // The doors that can be used (none while you sit in a vehicle): [{id, seat: 'driver'|'passenger', name, x, z}]
  doors(){return driven?[]:fleet.filter(f=>f.present).flatMap(f=>['driver','passenger'].map(seat=>({id:f.spec.id,seat,name:f.spec.name,...doorPoint(f.state,f.cls,seat)})))},
  seat(){return driven?seatPoint(driven.state,driven.cls,side):null},
  door(){return driven?doorPoint(driven.state,driven.cls,side):null},
  enter(id,seat='driver'){const f=byId.get(id);if(!f||driven)return false;driven=f;side=seat;f.lastSpeed=f.state.speed=0;f.state.steer=0;return true},
  // Get out: your own door, else the other side, behind, in front (`free(x, z)` is the game's blocked() inverted). Returns the point, or null (the caller then uses its safe-spot search).
  leave(free){if(!driven)return null;const f=driven,p=exitPoint(f.state,f.cls,free,side);driven=null;f.state.speed=0;f.state.steer=0;return p},
  // One slice of driving (dt <= 1/30 s). input: {throttle, steer, brake}; people: [{x, z, r}] pedestrians. A passenger does not steer: the vehicle stands still.
  step(dt,input,people=[]){if(!driven||side!=='driver')return null;const f=driven,fuelled=!!f.spec.fuel,inp=fuelled&&f.fuelMgal<=0?{...input,throttle:0}:input; // an empty tank: no throttle, the vehicle coasts to a stop
   const before=f.state,r=stepVehicle(f.state,inp,dt,f.cls,envFor(f,people));f.state=r.state;lastHit=r.hit;
   if(fuelled){f.burn+=burnMgal(Math.hypot(r.state.x-before.x,r.state.z-before.z),f.cls.gallonsPerMile);const whole=Math.floor(f.burn);f.burn-=whole;f.fuelMgal=Math.max(0,f.fuelMgal-whole)}
   return r},
  // Meshes follow the states (every frame; a parked vehicle just stays where it is).
  // Shows the filler markers (while a nozzle is in your hand): every present vehicle's cap pulses in its own fuel colour, bright if the nozzle in hand is the right fuel and dim if it is not.
  showFillers(show,nozzleFuel=null){for(const f of fleet){if(!f.marker)continue;f.marker.visible=!!show&&f.present&&f!==driven;f.markerBright=nozzleFuel===null||nozzleFuel===f.spec.fuel.type}},
  update(dt){pulse+=dt;for(const f of fleet){f.mesh.visible=f.present;if(f.marker&&f.marker.visible){const k=(f.markerBright?.8:.3)*(.6+.4*Math.sin(pulse*6));for(const part of f.marker.children)part.material.opacity=k}
   const s=f.state,accel=dt>0?(s.speed-f.lastSpeed)/dt:0,lateral=s.speed*(Math.abs(s.speed)<.01?0:s.steer*s.speed/Math.max(f.cls.rMin,s.speed*s.speed/f.cls.aLat));f.lastSpeed=s.speed;
   const k=1-Math.exp(-dt*8);f.pitch+=(clamp(-.01*accel,-.04,.04)-f.pitch)*k;f.roll+=(clamp(.012*lateral,-.05,.05)-f.roll)*k;
   f.y+=(footing(s.x,s.z)-f.y)*(1-Math.exp(-dt*10));place(f);
   // wheels: roll with the distance travelled (angle = distance / radius, forward is +z so a positive turn about x), the front pair steers
   f.spin+=s.speed*dt;for(const w of f.wheels){w.spin.rotation.x=f.spin/w.radius;if(w.front)w.pivot.rotation.y=s.steer*STEER_ANGLE}}},
  // Can a walker stand here? false inside any vehicle's hull inflated by the player radius (blocked() adds this).
  blocksWalker(x,z){for(const f of fleet){if(!f.present)continue;if(Math.abs(x-f.state.x)>f.cls.hz+PLAYER_RADIUS+.1||Math.abs(z-f.state.z)>f.cls.hz+PLAYER_RADIUS+.1)continue;if(insideHull(f.state,f.cls,x,z,PLAYER_RADIUS))return true}return false},
  // The poses to save (vehicles away from home).
  save(){return vehiclesToSave(MAP.vehicles,Object.fromEntries(fleet.filter(f=>f.present).map(f=>[f.spec.id,{...f.state,fuelMgal:f.fuelMgal}])))},
  // Dev tools: bring a vehicle to a pose (the nearest free one if that is blocked) and show it, or take it out of the world (not while you are in it). A removed vehicle is not saved and comes back at its saved pose or its bay next time the game loads.
  place(id,pose){const f=byId.get(id);if(!f||f===driven)return null;f.present=false;const env=envFor(f),ok=poseFree(pose,f.cls,env)?pose:findSafePose(pose,f.cls,env);if(!ok){f.present=true;return null}f.state=freshVehicle(ok);f.present=true;f.mesh.visible=true;f.lastSpeed=0;f.spin=0;return ok},
  setPresent(id,present){const f=byId.get(id);if(!f||f===driven)return false;f.present=!!present;f.mesh.visible=f.present;return true},
  present(id){return !!byId.get(id)?.present},
  // Fuel (0.35): the tank of a drivable vehicle (null for a vehicle without one), who can take fuel now, and setting the tank after a sale
  fuelOf(id){const f=byId.get(id);return f&&f.spec.fuel?{mgal:f.fuelMgal,capacityMgal:f.spec.fuel.tankMgal,type:f.spec.fuel.type}:null},
  // the vehicle whose filler cap is within radius of (x, z), if it can take fuel now: present, empty-handed of a driver, and stopped; else null
  fillerNear(x,z,radius){for(const f of fleet){if(!f.spec.fuel||!f.present||f===driven||Math.abs(f.state.speed)>.05)continue;const p=toWorld(f.state,f.spec.fuel.port.x,f.spec.fuel.port.z);if(Math.hypot(p.x-x,p.z-z)<=radius)return f.spec.id}return null},
  // where a vehicle's filler cap is on the ground (for the prompt and the glow)
  fillerPoint(id){const f=byId.get(id);return f&&f.spec.fuel?toWorld(f.state,f.spec.fuel.port.x,f.spec.fuel.port.z):null},
  setFuel(id,mgal){const f=byId.get(id);if(f&&f.spec.fuel)f.fuelMgal=Math.max(0,Math.min(f.spec.fuel.tankMgal,Math.round(mgal)))},  // Put a vehicle back in its bay (a debug aid and the last resort).
  sendHome(id){const f=byId.get(id);if(f&&f!==driven)f.state=freshVehicle(f.spec.home)}
 };
}
