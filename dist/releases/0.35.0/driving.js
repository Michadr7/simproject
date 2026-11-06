// The drivable vehicles in the world (0.33, DESIGN 4.13 D): their meshes, who sits where, enter and exit, the chase camera numbers and the saved poses. The rules live in vehicle.js (pure);
// game.js feeds the keys and the world in. A vehicle stays exactly where it was left. y is never stored: the body follows the ground footing under it (smoothed), with a little visual pitch and roll.
// Doors: the driver's door (the vehicle's left) puts you in the driver's seat; the passenger's door (the right) in the passenger seat, where you ride along and cannot steer (nobody else can drive yet).
// Vehicles never dissolve when the camera looks through them (the sightline fade would show their empty insides): they are built with a fade that does nothing.
// Wheels (models converted with splitWheels, the Worktruck) are real meshes that spin with the distance travelled and, at the front, steer.
import {heightAt,deckAt} from './height.js';
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {createProp} from './props.js';
import {CLASSES,freshVehicle,stepVehicle,poseFree,findSafePose,exitPoint,doorPoint,seatPoint,insideHull,vehiclesToSave,toWorld,PLAYER_RADIUS} from './vehicle.js';
import {normalizeFuelMgal,burnMgal} from './fuel.js';
import {defaultColour} from './paint.js';
import {applyPaint} from './paint-shader.js';
import {normalizeCargo,loadOf,loadPoints,LOAD_REACH,hasBed,BEDS} from './cargo.js';
import {createCargoView} from './cargo-view.js';
import {withLoad} from './vehicle.js';
import {TAILGATE_OPEN} from './flatbed.js';

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
 // The fleet: the dealership's display vehicles (MAP.vehicles with a display slot, sale dealership or both: the lot's slots, never drivable, they show what is for sale) and the vehicles you own (progress.vehicles, made on demand: add and sync).
 const build=(spec,colour,display)=>{
  const cls=CLASSES[spec.model],mesh=createProp(spec.model,SOLID);mesh.name='vehicle-'+spec.id;mesh.rotation.order='YXZ';scene.add(mesh);
  const marker=spec.fuel?fillerMarker(spec.fuel):null;if(marker)mesh.add(marker);
  const f={spec,cls,mesh,marker,wheels:mesh.userData.wheels||[],state:freshVehicle(spec.home),y:footing(spec.home.x,spec.home.z),pitch:0,roll:0,spin:0,lastSpeed:0,present:true,display:!!display,colour:null,fuelMgal:spec.fuel?spec.fuel.tankMgal:0,burn:0};
  f.colour=colour||defaultColour(spec.model);applyPaint(mesh,spec.model,f.colour);
  f.cargo=null;f.gate=0;f.view=createCargoView(spec.model);mesh.add(f.view.group); // cargo (cargo.js): what lies on the bed, drawn on it
  return f;
 };
 const fleet=MAP.vehicles.filter(v=>v.sale!=='online').map(spec=>build(spec,defaultColour(spec.model),true));
 const byId=new Map(fleet.map(f=>[f.spec.id,f])),others=skip=>fleet.filter(f=>f!==skip&&f.present).map(f=>({state:f.state,cls:f.cls}));
 const envFor=(f,people)=>({blocked:baseBlocked,surface,others:others(f),people});
 let devCount=0,driven=null,side='driver',lastHit=false,pulse=0,walker=null;
 const nearPoint=(f,p,side,reach)=>loadPoints(f.spec.model).some(pt=>pt.side===side&&(()=>{const w=toWorld(f.state,pt.x,pt.z);return Math.hypot(w.x-p.x,w.z-p.z)<=reach})());
 // An owned vehicle comes into the world at its saved pose (or, if that has become blocked, the nearest clear one: never stuck, never lost). A display vehicle standing where it is (you bought it there) is taken off the lot.
 const slotOf=model=>MAP.vehicles.find(v=>v.model===model);
 function add(entry){
  if(byId.has(entry.uid))return byId.get(entry.uid);
  const slot=slotOf(entry.model);if(!slot)return null;
  const spec={id:entry.uid,model:entry.model,name:slot.name,home:{x:entry.x,z:entry.z,yaw:entry.yaw},fuel:slot.fuel},f=build(spec,entry.colour,false);
  for(const d of fleet)if(d.display&&Math.hypot(d.state.x-entry.x,d.state.z-entry.z)<3.2)d.present=false;
  fleet.push(f);byId.set(spec.id,f);
  const pose={x:entry.x,z:entry.z,yaw:entry.yaw},env=envFor(f),ok=poseFree(pose,f.cls,env)?pose:findSafePose(pose,f.cls,env);
  if(spec.fuel)f.fuelMgal=normalizeFuelMgal(entry.fuelMgal,spec.fuel.tankMgal);
  f.cargo=normalizeCargo(entry.cargo,spec.model);f.view.set(f.cargo);
  if(ok){f.state=freshVehicle(ok);f.y=footing(ok.x,ok.z)}
  f.mesh.visible=f.present;return f;
 }
 for(const e of saved)add(e); const place=f=>{f.mesh.position.set(f.state.x,f.y,f.state.z);f.mesh.rotation.order='YXZ';f.mesh.rotation.set(f.pitch,f.state.yaw,f.roll)}; // yaw first, then tilt about the vehicle's own axes
// The ground's tilt under a vehicle (from heightAt, or the deck on a bridge; not the footing: a kerb is not a hill): nose-up is negative pitch; the +x side up is positive roll.
const tilt=f=>{const s=f.state,sy=Math.sin(s.yaw),cy=Math.cos(s.yaw),at=(lx,lz)=>{const x=s.x+lx*cy+lz*sy,z=s.z-lx*sy+lz*cy,d=deckAt(x,z);return d!==null?d:heightAt(x,z)};return {pitch:-Math.atan2(at(0,f.cls.hz)-at(0,-f.cls.hz),2*f.cls.hz),roll:Math.atan2(at(f.cls.hx,0)-at(-f.cls.hx,0),2*f.cls.hx)}};
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
  doors(){return driven?[]:fleet.filter(f=>f.present).flatMap(f=>['driver','passenger'].map(seat=>({id:f.spec.id,seat,name:f.spec.name,model:f.spec.model,display:f.display,colour:f.colour,...doorPoint(f.state,f.cls,seat)})))},
  seat(){return driven?seatPoint(driven.state,driven.cls,side):null},
  // The muffler tip of a vehicle in the world (x, y, z) and the way the pipe points (dx, dz: straight back), for the smoke.
  exhaust(f=driven){if(!f||!f.cls.exhaust)return null;const e=f.cls.exhaust,w=toWorld(f.state,e.x,e.z);return e.stack?{x:w.x,y:f.y+e.y,z:w.z,dx:0,dz:0,up:true}:{x:w.x,y:f.y+e.y,z:w.z,dx:-Math.sin(f.state.yaw),dz:-Math.cos(f.state.yaw)}}, // a stack (the flatbed) points up
  door(){return driven?doorPoint(driven.state,driven.cls,side):null},
  enter(id,seat='driver'){const f=byId.get(id);if(!f||driven)return false;driven=f;side=seat;f.lastSpeed=f.state.speed=0;f.state.steer=0;return true},
  // Get out: your own door, else the other side, behind, in front (`free(x, z)` is the game's blocked() inverted). Returns the point, or null (the caller then uses its safe-spot search).
  leave(free){if(!driven)return null;const f=driven,p=exitPoint(f.state,f.cls,free,side);driven=null;f.state.speed=0;f.state.steer=0;return p},
  // One slice of driving (dt <= 1/30 s). input: {throttle, steer, brake}; people: [{x, z, r}] pedestrians. A passenger does not steer: the vehicle stands still.
  step(dt,input,people=[]){if(!driven||side!=='driver')return null;const f=driven,fuelled=!!f.spec.fuel,inp=fuelled&&f.fuelMgal<=0?{...input,throttle:0}:input; // an empty tank: no throttle, the vehicle coasts to a stop
   const load=loadOf(f.spec.model,f.cargo),before=f.state,r=stepVehicle(f.state,inp,dt,withLoad(f.cls,load),envFor(f,people));f.state=r.state;lastHit=r.hit;
   if(fuelled){f.burn+=burnMgal(Math.hypot(r.state.x-before.x,r.state.z-before.z),f.cls.gallonsPerMile*(1+.3*load));const whole=Math.floor(f.burn);f.burn-=whole;f.fuelMgal=Math.max(0,f.fuelMgal-whole)}
   return r},
  // Meshes follow the states (every frame; a parked vehicle just stays where it is).
  // Shows the filler markers (while a nozzle is in your hand): every present vehicle's cap pulses in its own fuel colour, bright if the nozzle in hand is the right fuel and dim if it is not.
  showFillers(show,nozzleFuel=null){for(const f of fleet){if(!f.marker)continue;f.marker.visible=!!show&&f.present&&f!==driven;f.markerBright=nozzleFuel===null||nozzleFuel===f.spec.fuel.type}},
  update(dt){pulse+=dt;for(const f of fleet){f.mesh.visible=f.present;if(f.marker&&f.marker.visible){const k=(f.markerBright?.8:.3)*(.6+.4*Math.sin(pulse*6));for(const part of f.marker.children)part.material.opacity=k}
   const s=f.state,accel=dt>0?(s.speed-f.lastSpeed)/dt:0,lateral=s.speed*(Math.abs(s.speed)<.01?0:s.steer*s.speed/Math.max(f.cls.rMin,s.speed*s.speed/f.cls.aLat));f.lastSpeed=s.speed;
   const k=1-Math.exp(-dt*8);const g=tilt(f);f.pitch+=(clamp(-.01*accel,-.04,.04)+g.pitch-f.pitch)*k;f.roll+=(clamp(.012*lateral,-.05,.05)+g.roll-f.roll)*k;
   f.y+=(footing(s.x,s.z)-f.y)*(1-Math.exp(-dt*10));place(f);
   // wheels: roll with the distance travelled (angle = distance / radius, forward is +z so a positive turn about x), the front pair steers
   f.spin+=s.speed*dt;for(const w of f.wheels){w.spin.rotation.x=f.spin/w.radius;if(w.front)w.pivot.rotation.y=s.steer*STEER_ANGLE}
   // the tailgate (the flatbed): opened and closed by hand (toggleGate); it swings shut by itself when the vehicle moves or is driven; a quarter turn in about half a second
   const tg=f.mesh.userData.tailgate;if(tg){if(f===driven||Math.abs(s.speed)>=.05)f.gateOpen=false;const want=!f.display&&f.gateOpen?1:0;f.gate+=Math.sign(want-f.gate)*Math.min(Math.abs(want-f.gate),dt*2);tg.rotation.x=TAILGATE_OPEN*f.gate}}},
  // where the walking player is (null while driving): the flatbed's tailgate opens for them
  setWalker(p){walker=p?{x:p.x,z:p.z}:null},
  // Cargo (cargo.js): the beds you can load or unload from where you stand (owned vehicles only, stopped, nobody driving), and the bed's contents.
  bedsNear(x,z){return fleet.filter(f=>f.present&&!f.display&&f!==driven&&hasBed(f.spec.model)&&Math.abs(f.state.speed)<.05).map(f=>{const pts=loadPoints(f.spec.model).map(pt=>({...pt,...toWorld(f.state,pt.x,pt.z)}));const near=pts.find(pt=>Math.hypot(pt.x-x,pt.z-z)<=LOAD_REACH);return near?{id:f.spec.id,model:f.spec.model,name:f.spec.name,cargo:f.cargo,point:near,x:f.state.x,z:f.state.z,hasGate:!!f.mesh.userData.tailgate,gateOpen:!!f.gateOpen}:null}).filter(Boolean)},
  bedsWithin(x,z,r){return fleet.filter(f=>f.present&&!f.display&&f!==driven&&hasBed(f.spec.model)&&Math.abs(f.state.speed)<.05&&Math.hypot(f.state.x-x,f.state.z-z)<=r).map(f=>({id:f.spec.id,model:f.spec.model,name:f.spec.name,cargo:f.cargo,x:f.state.x,z:f.state.z})).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))}, // stopped vehicles with a bed within r of a point (a delivery is loaded onto one parked outside the loading door)
  cargoOf(id){return byId.get(id)?.cargo||null},
  setCargo(id,cargo){const f=byId.get(id);if(!f)return false;f.cargo=normalizeCargo(cargo,f.spec.model);f.view.set(f.cargo);return true},
  gateOf(id){return byId.get(id)?.gate||0},
  toggleGate(id){const f=byId.get(id);if(!f||f.display||f===driven||!f.mesh.userData.tailgate)return null;f.gateOpen=!f.gateOpen;return f.gateOpen},
  // Can a walker stand here? false inside any vehicle's hull inflated by the player radius (blocked() adds this).
  blocksWalker(x,z){for(const f of fleet){if(!f.present)continue;if(Math.abs(x-f.state.x)>f.cls.hz+PLAYER_RADIUS+.1||Math.abs(z-f.state.z)>f.cls.hz+PLAYER_RADIUS+.1)continue;if(insideHull(f.state,f.cls,x,z,PLAYER_RADIUS))return true}return false},
  // The vehicles you own (progress.vehicles): where each stands, its paint and its tank. Display vehicles are never saved.
  save(){const owned=fleet.filter(f=>!f.display&&!f.dev);return vehiclesToSave(owned.map(f=>({...f.spec,colour:f.colour})),Object.fromEntries(owned.map(f=>[f.spec.id,{...f.state,fuelMgal:f.fuelMgal,cargo:f.cargo}])))},
  // Bring every owned vehicle in the list into the world (the game calls this after a purchase or a delivery); ones already here are left alone.
  sync(list){for(const e of list)add(e)},
  // Dev panel vehicles: a free copy that ignores ownership, room at home, stock, price and skill locks, and is never saved. Null if no clear spot.
  addDev(model,colour,pose){const slot=slotOf(model);if(!slot)return null;
   const spec={id:'dev'+(++devCount),model,name:slot.name,home:{x:pose.x,z:pose.z,yaw:pose.yaw},fuel:slot.fuel},f=build(spec,colour||defaultColour(model),false);f.dev=true;if(spec.fuel)f.fuelMgal=spec.fuel.tankMgal;
   const env=envFor(f),ok=poseFree(pose,f.cls,env)?pose:findSafePose(pose,f.cls,env);if(!ok){scene.remove(f.mesh);return null}
   fleet.push(f);byId.set(spec.id,f);f.state=freshVehicle(ok);f.y=footing(ok.x,ok.z);f.mesh.visible=true;return {id:spec.id,pose:ok}},
  devIds(){return fleet.filter(f=>f.dev).map(f=>f.spec.id)},
  removeDev(id){const f=byId.get(id);if(!f||!f.dev||f===driven)return false;scene.remove(f.mesh);fleet.splice(fleet.indexOf(f),1);byId.delete(id);return true},
  // The lot's display vehicles show what is for sale: a colour (in stock) or nothing (sold out, or the bought one stands in its place).
  setDisplay(id,colour){const f=byId.get(id);if(!f||!f.display)return false;if(colour){if(f.colour!==colour){f.colour=colour;applyPaint(f.mesh,f.spec.model,colour)}f.present=true}else f.present=false;f.mesh.visible=f.present;return true},
  displayColour(id){const f=byId.get(id);return f&&f.display&&f.present?f.colour:null},
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
