// Drivable vehicles, the pure part (0.33, DESIGN 4.13 D): classes, the arcade step, hull maths and the safe-pose search. No THREE, no DOM, no game state: everything the step needs
// from the world comes in through `env`, so the whole thing runs in a test (and, later, on a relay).
//
// A vehicle's state is {x, z, yaw, speed, steer} (y is never stored). Forward is the model's +z: (sin yaw, cos yaw). Yaw grows toward +x, which is the vehicle's LEFT when it faces +z,
// so steer > 0 turns left. The hull is an oriented box from the converted model's footprint; a pose is free when every hull sample point passes the game's own `blocked()`.
import {SURFACE} from './terrain.js';
import {speedFactor,gripOf,rollDragOf,sinkOf,FIRM_BELOW} from './surface-table.js';
import {normalizeFuelMgal} from './fuel.js';
import {validColour,defaultColour} from './paint.js';
import {normalizeCargo} from './cargo.js';

export const PLAYER_RADIUS=.33; // what blocked() adds around every solid box: the hull points are inset by it, so the inflation lands exactly on the hull edge
export const SAMPLE_GAP=.5; // metres between hull sample points (a 0.16 m sign post cannot slip between two: the gap must stay under 2 x 0.49 m)

// Placeholders, tuned by playing. hx/hz: half the footprint (checked against the converted model by tests/vehicle.mjs). door: the driver's door point, local, +x is the vehicle's left.
// seat: where the player's position sits while driving. camera: how far behind and above the chase camera stands, and how high it looks.
// A class's doors and seats: the driver's side is the vehicle's left (+x when it faces +z), the passenger's the right. The chase camera scales with the vehicle's length (a bigger vehicle gets a more distant view):
// 3 x its length behind, 1.2 x its length up (worktruck 6 m: 9 m back, 3.6 m up).
// exhaust: where the muffler tip is, local (the pipe points straight back, -z): the smoke leaves from here (smoke.js).
// Tiers (cheapest first): 'low' is the starter, 'mid', 'high' (none yet). Every class has a tier, a top speed (m/s) and an mpg. The map is tiny, so burn uses ARCADE_MILE_SCALE (8 mpg = 1 gal/mile):
// gallonsPerMile = ARCADE_MILE_SCALE / mpg. Top speed and mpg are tuned per class; auto-shop parts will change them later (DESIGN roadmap 0.40).
// A loaded vehicle (cargo.js loadOf, 0..1): up to 20% slower at the top and 35% slower off the mark when the bed is full. Burn grows by up to 30% (driving.js).
export const withLoad=(cls,load)=>load>0?{...cls,top:cls.top*(1-.2*load),accel:cls.accel*(1-.35*load)}:cls;
export const TIERS=Object.freeze(['low','mid','high']);export const ARCADE_MILE_SCALE=8;
// tough: damage per unit of crash energy (damage.js: points = tough x ...; HIGHER takes more damage; VD7a values explained there). hood: the engine bay's smoke point, local (default: centred, 0.6 m back from the nose).
function makeClass(c){const L=c.hz*2;return {...c,hood:c.hood||{x:0,y:.9,z:+(c.hz-.6).toFixed(3)},gallonsPerMile:+(ARCADE_MILE_SCALE/c.mpg).toFixed(4),door:{x:+(c.hx+.6).toFixed(3),z:c.doorZ},passengerDoor:{x:-+(c.hx+.6).toFixed(3),z:c.doorZ},seat:c.seat||{x:.45,z:c.doorZ},passengerSeat:{x:-.45,z:c.doorZ},camera:c.camera||{back:+(3*L/2).toFixed(2),up:+(1.2*L/2).toFixed(2)}}} // A4: c.camera overrides the length-scaled chase camera (the ATV's is too tight at 3 L/2)
export const CLASSES=Object.freeze({
 worktruck:makeClass({id:'worktruck',group:'road',tough:.5,tier:'low',mpg:8,name:'Worktruck',hx:1.09,hz:3,top:17.9,reverse:5,accel:3,brake:8,drag:.9,rMin:7,aLat:10,doorZ:.5,exhaust:{x:-.7,y:.35,z:-3.02}}), // the starter: about 40 mph, thirsty
 flatbed:makeClass({id:'flatbed',group:'heavy',tough:.4,tier:'low',mpg:6,name:'Tylan Flatbed',hx:1.45,hz:4.415,top:15.6,reverse:3.5,accel:1.6,brake:6,drag:.7,rMin:9,aLat:7,doorZ:1.765,exhaust:{x:-1.42,y:3.15,z:1,stack:true}}), // the timber truck (0.35): 35 mph, slow to get there, thirsty; the exhaust is the top of the stack
 shortbed:makeClass({id:'shortbed',group:'road',tough:.58,tier:'low',mpg:5,name:'Kasumuchi S70',hx:1.105,hz:2.757,top:29,reverse:4,accel:1.5,brake:7,drag:.8,rMin:7.5,aLat:9,doorZ:.9,exhaust:{x:-.6,y:.29,z:-2.7}}), // the cheap starter shortbed (0.35.8): 65 mph at the top but 19 s to get there, 5 mpg (1.6 gal/mi), a gas hog; the exhaust is the model's anchor_exhaust
 offroad:makeClass({id:'offroad',group:'offroad',tough:.68,tier:'mid',mpg:14.5,name:'Pevrolet Off Road Pickup',hx:1.255,hz:2.8,top:26.8,reverse:6,accel:3.5,brake:9,drag:1,rMin:6.5,aLat:14,doorZ:.5,rough:.35,exhaust:{x:-.75,y:.42,z:-2.95}}), // mid tier: about 60 mph, nearly twice the mileage; grass, fields, paths and dirt cost it 35 points less speed (rough)
 // A4 (notes/atv-handling-design.md): the ATV, the player's own model (group 'atv': surface-table.js). One rider on the seat anchor (seats:1: no passenger door; E within 1.5 m mounts), top 15.6 m/s = 35 mph, 0 to top in 3.9 s, 4 gal (tankMgal 4000 in the map slot) at 20 mpg = 0.4 gal/mile; hull = the model's footprint (1.22 x 2.07 m); exhaust = the muffler tip (anchor_exhaust moved in build-props); own chase camera (4.2 m back, 1.9 m up). tough .6 is a first guess (A8).
 atv:makeClass({id:'atv',group:'atv',tough:.6,tier:'low',mpg:20,name:'Eden Trail ATV',hx:.61,hz:1.035,top:15.6,reverse:4,accel:4,brake:9,drag:1.2,rMin:4,aLat:9,doorZ:-.3,seat:{x:0,z:-.3},seats:1,hood:{x:0,y:.7,z:.55},camera:{back:4.2,up:1.9},exhaust:{x:-.28,y:.49,z:-1.035}}),
 // FV1 (notes/farm-vehicles-design.md section 1): the two farm tractors, group 'tractor' (slow, walk through soft ground: surface-table.js). The model origin is the HULL CENTRE (axleZ: where the rear axle is from it, for the hitch and the wheels); one seat on the centre line (seats:1: no passenger door); the exhaust is a vertical stack (the model's anchor_exhaust); hitchRear = anchor_hitch_rear. Top speeds 6.3 and 7.2 m/s (14 and 16 mph): 0 to top in 3.5 s and 4.5 s.
 tractor_juff:makeClass({id:'tractor_juff',group:'tractor',tough:.35,tier:'low',mpg:6,name:'Hustler Compact',hx:.93,hz:1.575,top:6.3,reverse:3,accel:1.8,brake:6,drag:1.4,rMin:4.2,aLat:6,doorZ:-.6045,seat:{x:0,z:-.6045},seats:1,axleZ:-.935,hitchRear:{x:0,y:.576,z:-1.4545},exhaust:{x:-.319,y:2.296,z:.716,stack:true}}),
 tractor_kidbi:makeClass({id:'tractor_kidbi',group:'tractor',tough:.3,tier:'mid',mpg:5,name:'Husky R75 Tractor',hx:.99,hz:1.54,top:7.2,reverse:3,accel:1.6,brake:6,drag:1.4,rMin:4.8,aLat:6,doorZ:-.9239,seat:{x:0,z:-.9239},seats:1,axleZ:-.68,hitchRear:{x:.007,y:.262,z:-1.5145},exhaust:{x:.296,y:1.884,z:.769,stack:true}})
});

// Top speed and acceleration multiplier by terrain surface. Water, banks and everything off the map are never driven on (blocked() refuses them as well).
export const SURFACE_SPEED=Object.freeze({[SURFACE.GRASS]:.5,[SURFACE.STREET]:1,[SURFACE.ROAD]:1,[SURFACE.DIRT]:.8,[SURFACE.PAVEMENT]:.5,[SURFACE.WATER]:0,[SURFACE.BANK]:0,[SURFACE.BRIDGE]:1,[SURFACE.WHEAT]:.5,[SURFACE.PLOWED]:.5,[SURFACE.GREEN]:.5,[SURFACE.DRIVEWAY]:1,[SURFACE.PATH]:.5,[SURFACE.MUD]:.3,[SURFACE.GRAVEL]:.9});
// cls.rough (an off-road vehicle) lifts the rough-ground multipliers (grass 0.5, dirt 0.8 ...) by that much, never above 1; water and banks stay 0.
// What the ground is called on the vehicle panel (grouped: a road, a track, rough ground, a pavement)
export const SURFACE_LABEL=Object.freeze({[SURFACE.STREET]:'Road',[SURFACE.ROAD]:'Road',[SURFACE.BRIDGE]:'Road',[SURFACE.DRIVEWAY]:'Road',[SURFACE.DIRT]:'Dirt track',[SURFACE.PAVEMENT]:'Pavement',[SURFACE.PATH]:'Path',[SURFACE.GRASS]:'Grass',[SURFACE.WHEAT]:'Crop field',[SURFACE.PLOWED]:'Crop field',[SURFACE.GREEN]:'Crop field',[SURFACE.WATER]:'Water',[SURFACE.BANK]:'Mud bank',[SURFACE.MUD]:'Mud',[SURFACE.GRAVEL]:'Gravel'});
// TR2: a class with a `group` reads the per-group table (surface-table.js); a bare or custom class keeps the old road numbers (+ cls.rough lift).
export const surfaceSpeed=(surface,cls)=>{if(cls?.group)return speedFactor(surface,cls.group);const base=SURFACE_SPEED[surface]??0;return base>0&&base<1&&cls?.rough?Math.min(1,base+cls.rough):base};

export const freshVehicle=(home)=>({x:home.x,z:home.z,yaw:home.yaw,speed:0,steer:0});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const cos=Math.cos,sin=Math.sin;

// Hull sample points (local, +z forward), every SAMPLE_GAP along the perimeter of the footprint inset by PLAYER_RADIUS, plus the centre. Cached per class.
const sampleCache=new Map();
export function hullSamples(cls){
 if(sampleCache.has(cls.id))return sampleCache.get(cls.id);
 const hx=cls.hx-PLAYER_RADIUS,hz=cls.hz-PLAYER_RADIUS,pts=[{x:0,z:0}],edge=(x0,z0,x1,z1)=>{const n=Math.max(1,Math.ceil(Math.hypot(x1-x0,z1-z0)/SAMPLE_GAP));for(let i=0;i<n;i++)pts.push({x:x0+(x1-x0)*i/n,z:z0+(z1-z0)*i/n})};
 edge(-hx,-hz,hx,-hz);edge(hx,-hz,hx,hz);edge(hx,hz,-hx,hz);edge(-hx,hz,-hx,-hz);
 sampleCache.set(cls.id,pts);return pts;
}
// local -> world and back (the same rotation the game uses for collider boxes: x + lx cos + lz sin, z - lx sin + lz cos)
export const toWorld=(s,lx,lz)=>({x:s.x+lx*cos(s.yaw)+lz*sin(s.yaw),z:s.z-lx*sin(s.yaw)+lz*cos(s.yaw)});
export const toLocal=(s,x,z)=>{const dx=x-s.x,dz=z-s.z;return {x:dx*cos(s.yaw)-dz*sin(s.yaw),z:dx*sin(s.yaw)+dz*cos(s.yaw)}};
export const doorPoint=(s,cls,side='driver')=>{const d=side==='driver'?cls.door:cls.passengerDoor;return toWorld(s,d.x,d.z)};
export const seatPoint=(s,cls,side='driver')=>{const d=side==='driver'?cls.seat:cls.passengerSeat;return toWorld(s,d.x,d.z)};
// Is the point inside the oriented hull, inflated by `margin` (the player's 0.33 m for a walker)?
export const insideHull=(s,cls,x,z,margin=0)=>{const l=toLocal(s,x,z);return Math.abs(l.x)<cls.hx+margin&&Math.abs(l.z)<cls.hz+margin};
// Two hulls overlap (separating-axis test on the full footprints).
export function hullsOverlap(a,ca,b,cb,gap=0){
 const corners=(s,c)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,j])=>toWorld(s,i*(c.hx+gap/2),j*(c.hz+gap/2)));
 const A=corners(a,ca),B=corners(b,cb);
 for(const s of [a,b]){const axes=[{x:cos(s.yaw),z:-sin(s.yaw)},{x:sin(s.yaw),z:cos(s.yaw)}];
  for(const ax of axes){const pa=A.map(p=>p.x*ax.x+p.z*ax.z),pb=B.map(p=>p.x*ax.x+p.z*ax.z);if(Math.max(...pa)<=Math.min(...pb)||Math.max(...pb)<=Math.min(...pa))return false}}
 return true;
}
// A circle (a pedestrian) touching the hull: distance from its centre to the oriented box.
export const circleTouchesHull=(s,cls,c)=>{const l=toLocal(s,c.x,c.z);return Math.hypot(Math.max(Math.abs(l.x)-cls.hx,0),Math.max(Math.abs(l.z)-cls.hz,0))<c.r};

// env: {blocked(x, z) -> bool (the game's own blocked(): walls, trees, buildings, props, water, the map edge), surface(x, z) -> terrain surface id,
//       others?: [{state, cls}] (other drivable vehicles), people?: [{x, z, r}] (pedestrians)}
// Is the pose free?
export function poseFree(pose,cls,env){
 for(const p of hullSamples(cls)){const w=toWorld(pose,p.x,p.z);if(env.blocked(w.x,w.z))return false}
 for(const o of env.others||[])if(hullsOverlap(pose,cls,o.state,o.cls))return false;
 for(const c of env.people||[])if(circleTouchesHull(pose,cls,c))return false;
 return true;
}

// The input: {throttle: -1..1 (W = 1, S = -1), steer: -1..1 (A = 1 left, D = -1 right), brake: bool (Space), }. dt must be small (the game's slices are at most 1/30 s).
// Returns {state, hit} (a new state; hit is true when the hull met something and the pose was refused or slid).
export const OFFROAD_DECEL=6; // m/s squared: how hard rough ground drags a vehicle that is faster than the ground allows
export function stepVehicle(s,input,dt,cls,env){
 const ground=env.surface(s.x,s.z),surface=surfaceSpeed(ground,cls),group=cls.group||'road',grip=gripOf(ground,group,env.wet||0); // grip: 1 on tarmac; loose ground widens turns, lengthens braking and softens the launch (never a slide)
 const top=cls.top*surface,rev=cls.reverse*surface,accel=cls.accel*Math.max(.35,surface)*grip,brake=cls.brake*grip;
 let v=s.speed;
 const throttle=clamp(input.throttle||0,-1,1);
 if(input.brake)v=toward(v,0,brake*1.5*dt);
 else if(throttle>0){v=v<-.3?toward(v,0,brake*dt):toward(v,top,accel*dt*(v<top?1:3))}
 else if(throttle<0){v=v>.3?toward(v,0,brake*dt):toward(v,-rev,accel*dt*(v>-rev?1:3))}
 else v=toward(v,0,(cls.drag+rollDragOf(ground,group))*dt); // coasting: rolling drag of the ground on top of the vehicle's own
 if(v>top)v=toward(v,top,OFFROAD_DECEL*dt); // leaving the road: rougher ground slows you down, firmly, to its own top speed
 if(v<-rev)v=toward(v,-rev,OFFROAD_DECEL*dt);
 // steering ramps to full in 0.4 s and back to centre in 0.3 s
 const want=clamp(input.steer||0,-1,1),rate=(want===0?1/.3:1/.4)*dt;let steer=toward(s.steer,want,rate);
 // R(v) = max(Rmin, v^2 / aLat): fast corners are wider; yaw rate = steer x v / R (the sign of v makes reversing steer the right way round)
 const radius=Math.max(cls.rMin,v*v/(cls.aLat*grip)),yawRate=Math.abs(v)<.01?0:steer*v/radius;
 const yaw=s.yaw+yawRate*dt,mid=s.yaw+yawRate*dt/2,nx=s.x+sin(mid)*v*dt,nz=s.z+cos(mid)*v*dt;
 const next={x:nx,z:nz,yaw,speed:v,steer};
 if(poseFree(next,cls,env))return {state:next,hit:false,impact:0,hitKind:null};
 // Blocked (C1, collision feel): go as far as the hull can, then slide along whatever is there; never a gap over a few millimetres and no sticking.
 const L=Math.hypot(nx-s.x,nz-s.z),stop={state:{x:s.x,z:s.z,yaw:s.yaw,speed:0,steer},hit:true,impact:Math.abs(v),hitKind:hitKindOf(next,cls,env)};
 let from={x:s.x,z:s.z,yaw:s.yaw};
 if(!poseFree(from,cls,env)){const out=pushOut(from,cls,env,Math.atan2(nx-s.x,nz-s.z));if(!out)return stop;from=out} // already inside something (a prop placed later): ease out of it first
 const t=reach(from,next,cls,env),cur=lerpPose(from,next,t),rest=(1-t)*L,dir=Math.atan2(nx-s.x,nz-s.z),first=(input.steer||0)>=0?1:-1;
 const done=(x,z,yy,k)=>({state:{x,z,yaw:yy,speed:v*(1-.5*dt*Math.sin(k*SLIDE_STEP)),steer},hit:true,impact:Math.abs(v)*Math.sin(k*SLIDE_STEP),hitKind:stop.hitKind});
 // slide: turn the intended direction away from the obstacle (the smallest turn that lets the hull fit, found by halving between 0 and 80 degrees: about 10 hull checks, and 4 when it is a head-on stop); the slide is as long as the part of the step along that direction
 const tryTurn=(k,sg)=>{const a=dir+sg*k*SLIDE_STEP,len=rest*cos(k*SLIDE_STEP),x=cur.x+sin(a)*len,z=cur.z+cos(a)*len;for(const yy of [yaw,cur.yaw])if(poseFree({x,z,yaw:yy},cls,env))return {x,z,yy,k};return null};
 let slide=null;
 if(L>1e-9)for(const sg of [first,-first]){let hi=tryTurn(SLIDE_MAX,sg);if(!hi)continue;let lo=0;while(hi.k-lo>1){const m=(lo+hi.k)>>1,r=tryTurn(m,sg);if(r)hi=r;else lo=m}if(!slide||hi.k<slide.k)slide=hi}
 if(slide)return done(slide.x,slide.z,slide.yy,slide.k);
 // nothing to slide along (head on): stop at the contact; if the wheel is turned and the throttle held, the nose may still swing along the obstacle at walking pace
 const creep=(input.steer||0)&&throttle?cur.yaw+clamp(s.steer,-1,1)*1.5*Math.sign(throttle)/cls.rMin*dt:cur.yaw;
 const yc=creep!==cur.yaw&&poseFree({x:cur.x,z:cur.z,yaw:creep},cls,env)?creep:cur.yaw;
 return {state:{x:cur.x,z:cur.z,yaw:yc,speed:0,steer},hit:true,impact:Math.abs(v),hitKind:stop.hitKind};
}
const SLIDE_STEP=Math.PI/36,SLIDE_MAX=16; // the slide search: 5 degree turns up to 80 degrees (square on to a flat face, within 10 degrees, is a head-on stop: a steeper turn would drift sideways for ever)
const lerpPose=(a,b,t)=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:a.yaw+(b.yaw-a.yaw)*t});
// The furthest free pose on the way from the free pose `a` to `b` (bisection, 7 rounds: the last gap is under 1 % of the step, a few millimetres). Returns the fraction.
function reach(a,b,cls,env){let lo=0,hi=1;for(let i=0;i<7;i++){const m=(lo+hi)/2;if(poseFree(lerpPose(a,b,m),cls,env))lo=m;else hi=m}return lo}
// What the blocked pose ran into: another vehicle, a person, or the world (walls, props, trees, water). For the damage build (notes/vehicle-damage-design.md).
function hitKindOf(pose,cls,env){if((env.others||[]).some(o=>hullsOverlap(pose,cls,o.state,o.cls)))return 'vehicle';if((env.people||[]).some(c=>circleTouchesHull(pose,cls,c)))return 'person';return 'world'}
// A pose that is already blocked: the nearest free one within 0.4 m (rings of 16 directions), the way the vehicle was heading last.
function pushOut(p,cls,env,heading){for(const r of [.03,.06,.1,.16,.25,.4])for(let i=0;i<16;i++){const a=heading+Math.PI+i*Math.PI/8,q={x:p.x+sin(a)*r,z:p.z+cos(a)*r,yaw:p.yaw};if(poseFree(q,cls,env))return q}return null}
const toward=(v,target,step)=>v<target?Math.min(target,v+step):Math.max(target,v-step);

// The nearest free pose to a pose that has become blocked (a saved game, a rule change, a prop placed later): a spiral outward, the saved yaw first, then a quarter turn at a time.
// Event-driven (a load, a spawn), never per frame. Returns {x, z, yaw} or null.
export function findSafePose(pose,cls,env,{maxRadius=40,step=1}={}){
 const yaws=[0,Math.PI/2,Math.PI,-Math.PI/2].map(d=>pose.yaw+d);
 for(let r=0;r<=maxRadius;r+=step){
  const n=r===0?1:Math.max(8,Math.ceil(2*Math.PI*r/step));
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=pose.x+Math.cos(a)*r,z=pose.z+Math.sin(a)*r;for(const yaw of yaws)if(poseFree({x,z,yaw},cls,env))return {x,z,yaw}}}
 return null;
}

// TR4 'Pull me out': the nearest FIRM free pose (every hull point, and a 1 m margin around it, on ground that does not sink: sinkOf < FIRM_BELOW, and drivable), never a blocked one. A spiral outward from the pose; the vehicle faces the way it was moved (away
// from the soft ground), else its own yaw, else a quarter turn. Event-driven, never per frame. env.surface(x, z) is the terrain surface id. Returns {x, z, yaw} or null.
export function findFirmPose(pose,cls,env,{maxRadius=40,step=1}={}){
 const wide={...cls,id:cls.id+'+firm',hx:cls.hx+1,hz:cls.hz+1},firm=(x,z,yaw)=>hullSamples(wide).every(p=>{const w=toWorld({x,z,yaw},p.x,p.z),g=env.surface(w.x,w.z);return sinkOf(g)<FIRM_BELOW&&speedFactor(g,cls.group||'road')>0});
 for(const turned of [false,true])for(let r=1;r<=maxRadius;r+=step){ // first pass: never turn the vehicle on the spot (the way it was moved, else its own heading); only if that fails anywhere, a quarter or half turn
  const n=Math.max(8,Math.ceil(2*Math.PI*r/step));
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,x=pose.x+Math.cos(a)*r,z=pose.z+Math.sin(a)*r,heading=Math.atan2(x-pose.x,z-pose.z);
   for(const yaw of turned?[pose.yaw+Math.PI/2,pose.yaw-Math.PI/2,pose.yaw+Math.PI]:[heading,pose.yaw])if(poseFree({x,z,yaw},cls,env)&&firm(x,z,yaw))return {x,z,yaw}}}
 return null;
}

// Where the player steps out: the driver's door point; if that is blocked, the passenger side, then behind, then in front. `free(x, z)` is the game's blocked() inverted (and not inside any hull).
export function exitPoint(s,cls,free,side='driver'){
 const own=side==='driver'?1:-1,x=cls.door.x,z=cls.door.z; // your own door first, then the other side, behind, in front, then a little further out on each side
 const tries=[[own*x,z],[-own*x,z],[0,-(cls.hz+.9)],[0,cls.hz+.9],[own*(x+.8),z],[-own*(x+.8),z]];
 for(const [lx,lz] of tries){const w=toWorld(s,lx,lz);if(free(w.x,w.z))return w}
 return null;
}

// The owned vehicles' saved list (0.34): one entry per vehicle you own, {uid, model, colour, x, z, yaw, fuelMgal, cond?}. A uid is "v" and a number, made when you buy or take delivery. Unknown models, bad uids and bad numbers
// are dropped; positions must be inside the playable rectangle; a missing or unknown colour is the model's first. `known` is MAP.vehicles (the dealership's display slots): the tank size comes from the slot with the same model.
// Fuel: normalizeFuelMgal (fuel.js) keeps a saved amount inside the tank; a missing one is a full tank.
export const MAX_OWNED=12;
export function normalizeVehicles(value,known,playable){
 if(!Array.isArray(value))return [];
 const out=[],seen=new Set();
 for(const v of value){
  if(!v||typeof v!=='object'||typeof v.uid!=='string'||!/^v\d{1,6}$/.test(v.uid)||seen.has(v.uid))continue;
  const spec=known.find(k=>k.model===v.model);if(!spec||!CLASSES[v.model])continue;
  if(![v.x,v.z,v.yaw].every(Number.isFinite))continue;
  if(playable&&(v.x<playable.x0||v.x>playable.x1||v.z<playable.z0||v.z>playable.z1))continue;
  seen.add(v.uid);
  const entry={uid:v.uid,model:v.model,colour:validColour(v.model,v.colour)?v.colour:defaultColour(v.model),x:+v.x.toFixed(2),z:+v.z.toFixed(2),yaw:+v.yaw.toFixed(3)};
  if(spec.fuel)entry.fuelMgal=normalizeFuelMgal(v.fuelMgal,spec.fuel.tankMgal);
  {const c=normalizeCargo(v.cargo,v.model);if(c)entry.cargo=c}
  if(Number.isInteger(v.cond)&&v.cond>=0&&v.cond<1000)entry.cond=v.cond; // damage (0..999); missing or 1000 or junk = a perfect vehicle, so old saves load Fine
  if(entry.cond!==undefined){const h=cleanHit(v.hit);if(h)entry.hit=h} // VD7b: where it was hit (front, rear, left, right 0..1), optional: old saves have none
  out.push(entry);if(out.length>=MAX_OWNED)break;
 }
 return out;
}
// What to save: every owned vehicle, where it stands. specs = [{id: uid, model, colour, fuel?}]; states[uid] = {x, z, yaw, fuelMgal?}.
// VD7b: the hit mask, four numbers 0..1 (front, rear, left, right); null when missing, junk or all zero.
const cleanHit=h=>Array.isArray(h)&&h.length===4&&h.every(Number.isFinite)&&h.some(v=>v>0)?h.map(v=>+Math.max(0,Math.min(1,v)).toFixed(2)):null;
export function vehiclesToSave(specs,states){
 const out=[];for(const spec of specs){const s=states[spec.id];if(!s)continue;
  const entry={uid:spec.id,model:spec.model,colour:spec.colour,x:+s.x.toFixed(2),z:+s.z.toFixed(2),yaw:+s.yaw.toFixed(3)};
  if(spec.fuel)entry.fuelMgal=normalizeFuelMgal(s.fuelMgal,spec.fuel.tankMgal);
  {const c=normalizeCargo(s.cargo,spec.model);if(c)entry.cargo=c}
  if(Number.isFinite(s.cond)){const c=Math.round(s.cond);if(c>=0&&c<1000){entry.cond=c;const h=cleanHit(s.hit);if(h)entry.hit=h}}
  out.push(entry)}
 return out;
}
