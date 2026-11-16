// The drivable vehicles in the world (0.33, DESIGN 4.13 D): their meshes, who sits where, enter and exit, the chase camera numbers and the saved poses. The rules live in vehicle.js (pure);
// game.js feeds the keys and the world in. A vehicle stays exactly where it was left. y is never stored: the body follows the ground footing under it (smoothed), with a little visual pitch and roll.
// Doors: the driver's door (the vehicle's left) puts you in the driver's seat; the passenger's door (the right) in the passenger seat, where you ride along and cannot steer (nobody else can drive yet).
// Vehicles never dissolve when the camera looks through them (the sightline fade would show their empty insides): they are built with a fade that does nothing.
// Wheels (models converted with splitWheels, the Worktruck) are real meshes that spin with the distance travelled and, at the front, steer.
import {heightAt,deckAt} from './height.js';
import * as THREE from './vendor/three.module.js';
import {MAP} from './map-definition.js';
import {createProp} from './props.js';
import {CLASSES,freshVehicle,stepVehicle,poseFree,findSafePose,findFirmPose,exitPoint,doorPoint,seatPoint,insideHull,vehiclesToSave,toWorld,PLAYER_RADIUS} from './vehicle.js';
import {normalizeFuelMgal,burnMgal} from './fuel.js';
import {defaultColour} from './paint.js';
import {applyPaint,applyLook} from './paint-shader.js';
import {normalizeCargo,loadOf,loadPoints,LOAD_REACH,hasBed,BEDS} from './cargo.js';
import {createCargoView} from './cargo-view.js';
import {withLoad} from './vehicle.js';
import {stepBog,freshBog,topFactor,sinkOf,gripOf,BOG_WARN,FIRM_BELOW} from './surface-table.js';import {sprayOf,SPIN_SPEED,SPIN_THROTTLE} from './debris.js';import {slipOf} from './vehicle-sounds.js'; // TR6: wheel spray and tyre sounds
import {createTracks} from './tracks.js';import {widthOf,trackAt,carryAfter,stepWheel,freshWheel,TRACK_MIN_SPEED,TRACK_LIFT} from './tracks-rules.js';import {SURFACE} from './terrain.js'; // TR5: tyre tracks
import {lookOf,withDamage,crashPoints,registerCrash,freshCrashState,applyPoints,addHit,sidesOf,hitLook,noHit,HIT_PROBE,bandOf,pullSide,pulledSteer,freshEngine,engineStep,percent} from './damage.js';
import {TAILGATE_OPEN} from './flatbed.js';
import {SHORTBED_DOOR_OPEN,SHORTBED_DOOR_SECONDS} from './shortbed.js';

const clamp=THREE.MathUtils.clamp;
// The filler cap marker (0.35): a glowing disc on the cap and a ring on the ground beside it, in the colour of the fuel the vehicle takes (the pumps' colours: gas red, diesel yellow). Shown only while a nozzle is in your hand.
export const FUEL_COLOURS=Object.freeze({gas:'#e0442f',diesel:'#f2c230'});
function fillerMarker(fuel){
 const side=Math.sign(fuel.port.x)||1,group=new THREE.Group();group.name='filler-marker';group.visible=false;
 const make=geometry=>new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:FUEL_COLOURS[fuel.type],transparent:true,opacity:.9,side:THREE.DoubleSide,fog:false}));
 const cap=make(new THREE.CircleGeometry(.14,20));cap.name='filler-cap';cap.position.set(fuel.port.x+side*.04,fuel.port.y??.95,fuel.port.z);cap.rotation.y=side*Math.PI/2;
 const halo=make(new THREE.RingGeometry(.17,.24,24));halo.name='filler-halo';halo.position.copy(cap.position);halo.rotation.y=cap.rotation.y;
 const ring=make(new THREE.RingGeometry(.3,.45,32));ring.name='filler-ground';ring.rotation.x=-Math.PI/2;ring.position.set(fuel.port.x+side*.95,.06,fuel.port.z);
 group.add(cap,halo,ring);return group;
}
const SOLID={apply:material=>material}; // no sightline fade for vehicles
export const STEER_ANGLE=.5; // radians of wheel turn at full lock (visual)
// A5 (notes/atv-handling-design.md): the rider seat for models that carry anchors but not the shortbed's own seats/grip (the ATV now; the tractors, FV2, by adding a RIDER_GRIPS entry for their class group). The seat is the model's anchor_driver_seat (hip joint a little under the cushion top: `sit`), the hands go to anchor_hands_L/R (rotated about the node `pivot` with the steering, since the handlebar is merged into the body), `lean` tips the spine forward, `jiggle` is the rider's bounce in metres at top speed, `bar` the handlebar's turn at full lock.
export const RIDER_GRIPS=Object.freeze({atv:Object.freeze({hips:0,sit:.03,lean:.2,jiggle:.012,bar:.5,pivot:'handlebar'}),tractor:Object.freeze({hips:0,sit:.03,lean:.15,jiggle:.015,bar:.8,pivot:'steering_wheel'})}); // FV2: both tractors (group 'tractor') use the model's anchor_driver_seat/anchor_hands_L/R; the steering wheel is merged into the body (no own mesh), so the hands swing about the steering_wheel node by steer*.8 rad (the R75 wheel is .58 m ahead of the hips: a bigger swing would overreach) instead
export const riderSeats=(anchors,grip)=>anchors?.anchor_driver_seat&&grip?{driver:[anchors.anchor_driver_seat[0],anchors.anchor_driver_seat[1]-grip.sit,anchors.anchor_driver_seat[2]]}:null;
// A hand's target in the player's own frame (origin: the feet, hipsHeight under the hips; the same frame as the shortbed's steering wheel targets): the anchor turned about the handlebar pivot by the steering.
export function riderHand(hand,pivot,steer,grip,seat,hipsHeight){const a=steer*grip.bar,c=Math.cos(a),s=Math.sin(a),dx=hand[0]-pivot[0],dz=hand[2]-pivot[2];return {x:pivot[0]+dx*c+dz*s-seat[0],y:hand[1]-(seat[1]-hipsHeight),z:pivot[2]-dx*s+dz*c-(seat[2]+grip.hips)}}
export const riderJiggle=(speed,top,t,grip)=>grip.jiggle*Math.min(1,Math.abs(speed)/top)*(Math.sin(t*23)*.6+Math.sin(t*37.7)*.4); // frame-rate independent: a function of the clock

// scene: the world's scene; surface(x, z): terrain surface id; footing(x, z): ground height under a point; baseBlocked(x, z): the game's blocked() WITHOUT the vehicles
// (so a vehicle never collides with itself); saved: progress.vehicles (already normalized).
export function createDriving({scene,surface,footing,baseBlocked,saved=[]}){
 // The fleet: the dealership's display vehicles (MAP.vehicles with a display slot, sale dealership or both: the lot's slots, never drivable, they show what is for sale) and the vehicles you own (progress.vehicles, made on demand: add and sync).
 const build=(spec,colour,display)=>{
  const cls=CLASSES[spec.model],mesh=createProp(spec.model,SOLID);mesh.name='vehicle-'+spec.id;mesh.rotation.order='YXZ';scene.add(mesh);
  const marker=spec.fuel?fillerMarker(spec.fuel):null;if(marker)mesh.add(marker);
  const f={spec,cls,mesh,marker,wheels:mesh.userData.wheels||[],state:freshVehicle(spec.home),y:footing(spec.home.x,spec.home.z),pitch:0,roll:0,spin:0,lastSpeed:0,present:true,display:!!display,colour:null,fuelMgal:spec.fuel?spec.fuel.tankMgal:0,burn:0,cond:1000,hit:noHit(),crash:freshCrashState(),engine:freshEngine(1000,0),pullSide:pullSide(spec.id),bog:freshBog()}; // cond: 0..1000 (damage.js, saved when below 1000); crash: the debounce window; engine: run / crank / off
  {const g=RIDER_GRIPS[cls.group],rs=!mesh.userData.seats&&riderSeats(mesh.userData.anchors,g);if(rs){mesh.userData.seats=rs;mesh.userData.grip=g;mesh.userData.riderHands=true}if(cls.steerMax)for(const w of f.wheels)w.max=cls.steerMax} f.colour=colour||defaultColour(spec.model);applyPaint(mesh,spec.model,f.colour);
  f.cargo=null;f.gate=0;f.view=createCargoView(spec.model);mesh.add(f.view.group); // cargo (cargo.js): what lies on the bed, drawn on it
  return f;
 };
 const fleet=MAP.vehicles.filter(v=>v.sale!=='online').map(spec=>build(spec,defaultColour(spec.model),true));
 const byId=new Map(fleet.map(f=>[f.spec.id,f])),others=skip=>fleet.filter(f=>f!==skip&&f.present).map(f=>({state:f.state,cls:f.cls}));
 const slopeEnv=f=>{if(!f.cls.slope)return null;const s=f.state,sy=Math.sin(s.yaw),cy=Math.cos(s.yaw),at=(lx,lz)=>{const x=s.x+lx*cy+lz*sy,z=s.z-lx*sy+lz*cy,d=deckAt(x,z);return d!==null?d:heightAt(x,z)},L=f.cls.hz,W=f.cls.hx;return {grade:Math.atan2(at(0,L)-at(0,-L),2*L)*180/Math.PI,side:Math.atan2(at(-W,0)-at(W,0),2*W)*180/Math.PI}}; // A2 (slope-rules.js): grade = uphill along the heading, side = ground falling to the left, both in degrees; only for classes with slope:true
  const envFor=(f,people)=>({blocked:baseBlocked,surface,others:others(f),people,...slopeEnv(f)});
 let devCount=0,clock=0,events=[],driven=null,side='driver',lastHit=false,pulse=0,walker=null,pending=null,seatVec=new THREE.Vector3();
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
  if(spec.fuel)f.fuelMgal=normalizeFuelMgal(entry.fuelMgal,spec.fuel.tankMgal);f.cond=Number.isInteger(entry.cond)?entry.cond:1000;f.hit=Array.isArray(entry.hit)&&f.cond<1000?entry.hit.map(v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0):noHit();
  f.cargo=normalizeCargo(entry.cargo,spec.model);f.view.set(f.cargo);
  if(ok){f.state=freshVehicle(ok);f.y=footing(ok.x,ok.z)}
  f.mesh.visible=f.present;return f;
 }
 for(const e of saved)add(e); const place=f=>{f.mesh.position.set(f.state.x,f.y,f.state.z);f.mesh.rotation.order='YXZ';f.mesh.rotation.set(f.pitch,f.state.yaw,f.roll)}; // yaw first, then tilt about the vehicle's own axes
// The ground's tilt under a vehicle (from heightAt, or the deck on a bridge; not the footing: a kerb is not a hill): nose-up is negative pitch; the +x side up is positive roll.
const tilt=f=>{const s=f.state,sy=Math.sin(s.yaw),cy=Math.cos(s.yaw),at=(lx,lz)=>{const x=s.x+lx*cy+lz*sy,z=s.z-lx*sy+lz*cy,d=deckAt(x,z);return d!==null?d:heightAt(x,z)};return {pitch:-Math.atan2(at(0,f.cls.hz)-at(0,-f.cls.hz),2*f.cls.hz),roll:Math.atan2(at(f.cls.hx,0)-at(-f.cls.hx,0),2*f.cls.hx)}};
 // A hit while driving: points from the impact (damage.js), the debounce, the new condition; one event per counted hit. A stall (250 points or more) or a Wrecked vehicle stops the engine.
 const crash=(f,r,was0=0)=>{const pts=crashPoints(r.impact,f.cls.tough,r.hitKind);if(!(pts>0))return;const c=registerCrash(f.crash,clock,pts);f.crash=c.state;if(c.points<=0&&!c.stall)return;
  const from=bandOf(f.cond).id,was=f.cond;f.cond=applyPoints(f.cond,c.points);const to=bandOf(f.cond).id;
  {const s=f.state,sy=Math.sin(s.yaw),cy=Math.cos(s.yaw),env=envFor(f,[]),probe=(lx,lz)=>!poseFree({...s,x:s.x+(lx*cy+lz*sy)*HIT_PROBE,z:s.z+(lz*cy-lx*sy)*HIT_PROBE},f.cls,env),sides=sidesOf([probe(0,1),probe(0,-1),probe(1,0),probe(-1,0)],was0);f.hit=addHit(f.hit,sides,c.points);var hitSides=sides} // VD7b: which sides touch (the hull moved 0.3 m each way), added to the mask
  if(c.stall||f.cond<=0)f.engine=engineStep(f.engine,{cond:f.cond,now:clock,stall:true}).engine;
  const dz=was0<0?-1:1,hit=toWorld(f.state,0,f.cls.hz*dz);events.push({type:'crash',id:f.spec.id,at:{x:hit.x,y:f.y+.55,z:hit.z},dir:{dx:Math.sin(f.state.yaw)*dz,dz:Math.cos(f.state.yaw)*dz},points:c.points,sides:hitSides,total:f.crash.best,impact:r.impact,kind:r.hitKind,was,cond:f.cond,pct:percent(f.cond),changed:from!==to,bandTo:to,stall:c.stall,first:f.crash.at===clock})};
 fleet.forEach(place);
 // TR5 tyre tracks: the rear wheels of a vehicle that moves faster than TRACK_MIN_SPEED lay a segment every TRACK_STEP metres of path (tracks-rules.js), into the one pooled mesh (tracks.js); f.carry is the mud carried on the tyres (metres left).
 const tracks=createTracks(scene),layTracks=f=>{if(f.display||!f.present)return;const s=f.state,width=widthOf(f.cls.id);if(!width)return;
  if(f.carry===undefined){f.carry=0;f.lastX=s.x;f.lastZ=s.z;f.lay=[]}
  const dist=Math.hypot(s.x-f.lastX,s.z-f.lastZ);f.lastX=s.x;f.lastZ=s.z;f.carry=carryAfter(f.carry,surface(s.x,s.z),dist);const moving=Math.abs(s.speed)>TRACK_MIN_SPEED;
  f.wheels.forEach((w,i)=>{if(w.front)return;const lw=f.lay[i]||(f.lay[i]=freshWheel()),p=toWorld(s,w.pivot.position.x,w.pivot.position.z),sf=surface(p.x,p.z);
   for(const g of stepWheel(lw,p.x,p.z,moving&&sf!==SURFACE.WATER&&sf!==SURFACE.BANK)){const t=trackAt(surface(g.x1,g.z1),f.carry);if(t)tracks.lay({x0:g.x0,y0:footing(g.x0,g.z0)+TRACK_LIFT,z0:g.z0,x1:g.x1,y1:footing(g.x1,g.z1)+TRACK_LIFT,z1:g.z1,width,colour:t.colour,alpha:t.alpha,life:t.life})}})};
 return {
  tracks,carryOf(id){const f=byId.get(id);return f?.carry??0},
  // TR6: dust and mud thrown from the rear wheels of the vehicle you drive (sink: a createDebris object; opts {throttle 0..1, quality 'high'|'low', calm}). Each wheel reads the ground under it (debris.js sprayOf); a dual-wheel rear shares the rate of one pair. Returns the pieces thrown.
  sprayWheels(sink,dt,{throttle=0,quality='high',calm=false}={}){const f=driven;if(!f||side!=='driver'||f.display||f.cls.group==='fork')return 0;const s=f.state,rear=f.wheels.filter(w=>!w.front);if(!rear.length)return 0;const k=2/rear.length,heading={dx:Math.sin(s.yaw),dz:Math.cos(s.yaw)};let n=0;
   rear.forEach((w,i)=>{const p=toWorld(s,w.pivot.position.x,w.pivot.position.z),sp=sprayOf({surface:surface(p.x,p.z),speed:s.speed,top:f.cls.top,throttle,stuck:f.bog.stuck,quality,calm});if(sp.dust>0||sp.mud>0)n+=sink.spray(f.spec.id+':'+i,dt,{x:p.x,y:footing(p.x,p.z)+.12,z:p.z},heading,s.speed,{dust:sp.dust*k,mud:sp.mud*k,drop:sp.drop*k,colour:sp.colour})});return n},
  // TR6: what the tyre sound needs, written into the reused object fx: surface under the vehicle, top speed, slip 0..1 and spin (the wheels turn on the spot: Stuck, or throttle held below 3 m/s).
  tyreFx(fx,throttle=0){const f=driven;if(!f||side!=='driver'||f.display||f.cls.group==='fork'){fx.surface=0;fx.slip=0;fx.spin=false;return fx}const s=f.state,sf=surface(s.x,s.z),gr=gripOf(sf,f.cls.group),spin=f.bog.stuck||(throttle>=SPIN_THROTTLE&&Math.abs(s.speed)<SPIN_SPEED&&gr<.8); // spin on the spot only on loose ground
   fx.surface=sf;fx.top=f.cls.top;fx.spin=spin;fx.slip=slipOf({speed:s.speed,top:f.cls.top,steer:s.steer,grip:gr,spin});return fx},
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
  doors(){return driven?[]:fleet.filter(f=>f.present).flatMap(f=>(f.cls.seats===1?['driver']:['driver','passenger']).map(seat=>({id:f.spec.id,seat,name:f.spec.name,model:f.spec.model,display:f.display,colour:f.colour,...doorPoint(f.state,f.cls,seat)})))},
  seat(){return driven?seatPoint(driven.state,driven.cls,side):null},
  // The muffler tip of a vehicle in the world (x, y, z) and the way the pipe points (dx, dz: straight back), for the smoke.
  exhaust(f=driven){if(!f||!f.cls.exhaust)return null;const e=f.cls.exhaust,w=toWorld(f.state,e.x,e.z);return e.stack?{x:w.x,y:f.y+e.y,z:w.z,dx:0,dz:0,up:true}:{x:w.x,y:f.y+e.y,z:w.z,dx:-Math.sin(f.state.yaw),dz:-Math.cos(f.state.yaw)}}, // a stack (the flatbed) points up
  door(){return driven?doorPoint(driven.state,driven.cls,side):null},
  enter(id,seat='driver'){const f=byId.get(id);if(!f||driven)return false;driven=f;side=seat;f.lastSpeed=f.state.speed=0;f.state.steer=0;f.engine=freshEngine(f.cond,clock);(f.doorHold=f.doorHold||{driver:0,passenger:0})[seat]=f.doorOpen?.[seat]>=1?.8:1.2;return true}, // the door stays open while you sit down, then shuts (already open from doorThen: 0.8 s more; called straight: it must swing open first)
  // Doors first (the shortbed): the door on that side opens, and 	hen runs when it is open (0.875 s plus a beat): you get in or out through an open door. False if the vehicle has no doors (the caller carries on at once); a second call while waiting does nothing.
  doorThen(id,seat,then){const f=id?byId.get(id):driven;if(!f||!f.mesh.userData.doors)return false;if(pending)return true;(f.doorHold=f.doorHold||{driver:0,passenger:0})[seat]=SHORTBED_DOOR_SECONDS+.5;pending={t:SHORTBED_DOOR_SECONDS+.1,then};return true},
  // Where the occupant's hips are (world x, y, z) and the heading, for a vehicle that shows you seated (the shortbed: its seats anchor); null otherwise.
  seatedAt(){const s=driven?.mesh.userData.seats?.[side];if(!s)return null;driven.mesh.updateMatrixWorld();seatVec.set(s[0],s[1],s[2]+(driven.mesh.userData.grip?.hips??.2)).applyMatrix4(driven.mesh.matrixWorld);return {x:seatVec.x,y:seatVec.y,z:seatVec.z,yaw:driven.state.yaw,driver:side==='driver'}},
  // DR1: where the seated occupant's feet go and how they are turned (the whole body tilts with the cab's pitch and roll, hips on the seat anchor; hipsDrop: hips to feet in metres): {x, y, z, rx, ry, rz} or null.
  seatPose(hipsDrop){const s=this.seatedAt();if(!s)return null;const m=driven.mesh,gr=m.userData.grip,jy=gr?.jiggle?riderJiggle(driven.state.speed,driven.cls.top,pulse,gr):0;seatVec.set(0,-1,0).applyQuaternion(m.quaternion);return {x:s.x+seatVec.x*hipsDrop,y:s.y+seatVec.y*hipsDrop+jy,z:s.z+seatVec.z*hipsDrop,rx:m.rotation.x,ry:m.rotation.y,rz:m.rotation.z}},
  // A5: hand targets (player frame) for a rider astride a vehicle with a merged handlebar: [['R',{x,y,z}],['L',{x,y,z}]] or null.
  riderHands(hipsHeight){const m=driven?.mesh.userData;if(!m?.riderHands||side!=='driver')return null;const an=m.anchors,g=m.grip,pv=m.nodes[g.pivot],st=driven.state.steer;return [['R',riderHand(an.anchor_hands_R,pv,st,g,m.seats.driver,hipsHeight)],['L',riderHand(an.anchor_hands_L,pv,st,g,m.seats.driver,hipsHeight)]]},
  // Get out: your own door, else the other side, behind, in front (`free(x, z)` is the game's blocked() inverted). Returns the point, or null (the caller then uses its safe-spot search).
  leave(free){if(!driven)return null;const f=driven,p=exitPoint(f.state,f.cls,free,side);(f.doorHold=f.doorHold||{driver:0,passenger:0})[side]=.9;driven=null;f.state.speed=0;f.state.steer=0;return p},
  // One slice of driving (dt <= 1/30 s). input: {throttle, steer, brake}; people: [{x, z, r}] pedestrians. A passenger does not steer: the vehicle stands still.
  step(dt,input,people=[]){if(!driven||side!=='driver')return null;const f=driven,fuelled=!!f.spec.fuel;clock+=dt;
   const eng=engineStep(f.engine,{cond:f.cond,throttle:input.throttle||0,now:clock});f.engine=eng.engine;if(eng.event)events.push({type:eng.event,id:f.spec.id,seconds:eng.event==='crank'?+(f.engine.readyAt-clock).toFixed(2):0}); // stalled, cranking or wrecked: no throttle (the vehicle coasts to a stop; E always gets you out)
   const run=f.engine.mode==='run',load=loadOf(f.spec.model,f.cargo),hurt=withDamage(withLoad(f.cls,load),f.cond),k=topFactor(f.bog),dmg=k<1?{...hurt,top:hurt.top*k,reverse:hurt.reverse*k}:hurt,cut=!run||(fuelled&&f.fuelMgal<=0), // an empty tank: no throttle too
    inp={...input,throttle:cut?0:input.throttle,steer:pulledSteer(input.steer,dmg.pull,f.pullSide,f.state.speed)},before=f.state,b=stepBog(f.bog,{throttle:inp.throttle,speed:f.state.speed,surface:surface(f.state.x,f.state.z),group:f.cls.group,load,dt,bogMul:f.cls.bogMul}),r=stepVehicle(f.state,inp,dt,dmg,envFor(f,people));f.bog=b;if(b.event)events.push({type:b.event==='stuck'?'bog':'unbog',id:f.spec.id});f.state=r.state;lastHit=r.hit; // TR4: the bog meter (surface-table.js) reads the state before the step; Stuck scales the top speed (eased) inside the step
   if(r.hit)crash(f,r,before.speed);
   if(fuelled){f.burn+=burnMgal(Math.hypot(r.state.x-before.x,r.state.z-before.z),f.cls.gallonsPerMile*(1+.3*load)*(run?dmg.burnMul??1:0));const whole=Math.floor(f.burn);f.burn-=whole;f.fuelMgal=Math.max(0,f.fuelMgal-whole)}
   return r},
  // Damage (damage.js): the events since the last call ({type: 'crash'|'crank'|'start'|'dead', id, ...}; a crash carries points, total, kind, changed (band), bandTo, cond, stall, first), the condition of a vehicle, and a dev/test setter.
  takeEvents(){const e=events;events=[];return e},
  damageOf(f=driven){return f?{model:f.spec.model,cond:f.cond,engine:f.engine.mode,crank:f.engine.mode==='crank'?+Math.max(0,f.engine.readyAt-clock).toFixed(2):0,sinceCrash:+(clock-f.crash.at).toFixed(2)}:null}, // crank: seconds of starter still to turn; sinceCrash: seconds since the last counted crash (Infinity: none)
  // The engine bay's smoke point in the world (hood of the class, local): {x, y, z, dx: 0, dz: 0} (the smoke just rises).
  hood(f=driven){if(!f||!f.cls.hood)return null;const w=toWorld(f.state,f.cls.hood.x,f.cls.hood.z);return {x:w.x,y:f.y+f.cls.hood.y+.25,z:w.z,dx:0,dz:0,boost:1}},
  // TR4: the bog meter of a vehicle: {bog 0..1, stuck, warn (sinking, not yet stuck), soft (the ground under it is mud or a field: SINK .1 or more; plain grass is firm)}, and 'Pull me out': the nearest firm free pose (null if none) and the move itself (driven vehicle only; speed 0, the meter cleared).
  bogOf(f=driven){return f?{bog:+f.bog.bog.toFixed(3),stuck:f.bog.stuck,warn:!f.bog.stuck&&f.bog.bog>=BOG_WARN,soft:sinkOf(surface(f.state.x,f.state.z))>=FIRM_BELOW}:null},
  firmSpot(f=driven){return f?findFirmPose({x:f.state.x,z:f.state.z,yaw:f.state.yaw},f.cls,envFor(f)):null},
  relocate(pose){const f=driven;if(!f||!pose)return false;f.state=freshVehicle(pose);f.y=footing(pose.x,pose.z);f.lastSpeed=0;f.spin=0;f.bog=freshBog();return true},
  setBog(id,value){const f=byId.get(id);if(!f)return false;f.bog={...freshBog(),bog:Math.max(0,Math.min(1,value)),stuck:value>=1,mix:value>=1?1:0};return true}, // dev and test setter
  condOf(id){return byId.get(id)?.cond??null},
  setCond(id,cond){const f=byId.get(id);if(f)f.cond=Math.max(0,Math.min(1000,Math.round(cond)))},
  hitOf(id){return byId.get(id)?.hit??null}, setHit(id,hit){const f=byId.get(id);if(f)f.hit=Array.isArray(hit)?hit.map(v=>Number.isFinite(v)?Math.max(0,Math.min(1,v)):0).slice(0,4):noHit()}, // VD7b: where it was hit [front, rear, left, right] 0..1 (a dev and test setter)
  // Meshes follow the states (every frame; a parked vehicle just stays where it is).
  // Shows the filler markers (while a nozzle is in your hand): every present vehicle's cap pulses in its own fuel colour, bright if the nozzle in hand is the right fuel and dim if it is not.
  showFillers(show,nozzleFuel=null){for(const f of fleet){if(!f.marker)continue;f.marker.visible=!!show&&f.present&&f!==driven;f.markerBright=nozzleFuel===null||nozzleFuel===f.spec.fuel.type}},
  update(dt){pulse+=dt;tracks.update(dt);if(pending){pending.t-=dt;if(pending.t<=0){const run=pending.then;pending=null;run()}}for(const f of fleet){f.mesh.visible=f.present;if(f.cond>=1000&&f.hit.some(v=>v>0))f.hit=noHit();if(f.present&&((f.lookCond??1000)!==f.cond||f.lookHit!==f.hit)){f.lookCond=f.cond;f.lookHit=f.hit;applyLook(f.mesh,{...lookOf(f.cond),hit:hitLook(f.hit,f.cond)},f.spec.model,[f.cls.hx,f.cls.hz])} /* VD3: wear and cracks follow the condition (uniforms only, on change) */ if(f.marker&&f.marker.visible){const k=(f.markerBright?.8:.3)*(.6+.4*Math.sin(pulse*6));for(const part of f.marker.children)part.material.opacity=k}
   const s=f.state,accel=dt>0?(s.speed-f.lastSpeed)/dt:0,lateral=s.speed*(Math.abs(s.speed)<.01?0:s.steer*s.speed/Math.max(f.cls.rMin,s.speed*s.speed/f.cls.aLat));f.lastSpeed=s.speed;
   const k=1-Math.exp(-dt*8);const g=tilt(f);f.pitch+=(clamp(-.01*accel,-.04,.04)+g.pitch-f.pitch)*k;f.roll+=(clamp(.012*lateral,-.05,.05)+g.roll-f.roll)*k;f.dynPitch=f.pitch-g.pitch;f.dynRoll=f.roll-g.roll;
   f.y+=(footing(s.x,s.z)-f.y)*(1-Math.exp(-dt*10));place(f);layTracks(f);
   // wheels: roll with the distance travelled (angle = distance / radius, forward is +z so a positive turn about x), the front pair steers
   f.spin+=s.speed*dt;for(const w of f.wheels){w.spin.rotation.x=f.spin/w.radius;if(w.front)w.pivot.rotation.y=s.steer*(w.max||STEER_ANGLE);if(w.rest!==undefined)w.pivot.position.y=w.rest+clamp(-(w.x*Math.sin(f.dynRoll||0)-w.z*Math.sin(f.dynPitch||0)),-.06,.1)} // a model with suspension (the shortbed): the wheel stays on the ground while the body pitches and rolls, up to the spec's 0.1 m of compression, from its rest height
   const sw=f.mesh.userData.steeringWheel;if(sw)sw.rotation.z=-s.steer*1.6; // the steering wheel turns with the steering (left is counter-clockwise for the driver)
   const dr=f.mesh.userData.doors;if(dr){f.doorOpen=f.doorOpen||{driver:0,passenger:0};f.doorHold=f.doorHold||{driver:0,passenger:0};for(const side of ['driver','passenger']){const want=f.doorHold[side]>0?1:0;f.doorHold[side]=Math.max(0,f.doorHold[side]-dt);const o=f.doorOpen[side]=f.doorOpen[side]+Math.sign(want-f.doorOpen[side])*Math.min(Math.abs(want-f.doorOpen[side]),dt/SHORTBED_DOOR_SECONDS);dr[side].pivot.rotation.y=dr[side].sign*SHORTBED_DOOR_OPEN*o}} // the doors (shortbed): the door on your side swings open (0.875 s, 70 degrees) when you get in or out (enter and leave set doorHold seconds) and shuts again
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
  save(){const owned=fleet.filter(f=>!f.display&&!f.dev);return vehiclesToSave(owned.map(f=>({...f.spec,colour:f.colour})),Object.fromEntries(owned.map(f=>[f.spec.id,{...f.state,fuelMgal:f.fuelMgal,cargo:f.cargo,cond:f.cond,hit:f.hit}])))},
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
