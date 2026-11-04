// Drivable vehicles, the pure part (0.33, DESIGN 4.13 D): classes, the arcade step, hull maths and the safe-pose search. No THREE, no DOM, no game state: everything the step needs
// from the world comes in through `env`, so the whole thing runs in a test (and, later, on a relay).
//
// A vehicle's state is {x, z, yaw, speed, steer} (y is never stored). Forward is the model's +z: (sin yaw, cos yaw). Yaw grows toward +x, which is the vehicle's LEFT when it faces +z,
// so steer > 0 turns left. The hull is an oriented box from the converted model's footprint; a pose is free when every hull sample point passes the game's own `blocked()`.
import {SURFACE} from './terrain.js';

export const PLAYER_RADIUS=.33; // what blocked() adds around every solid box: the hull points are inset by it, so the inflation lands exactly on the hull edge
export const SAMPLE_GAP=.5; // metres between hull sample points (a 0.16 m sign post cannot slip between two: the gap must stay under 2 x 0.49 m)

// Placeholders, tuned by playing. hx/hz: half the footprint (checked against the converted model by tests/vehicle.mjs). door: the driver's door point, local, +x is the vehicle's left.
// seat: where the player's position sits while driving. camera: how far behind and above the chase camera stands, and how high it looks.
// A class's doors and seats: the driver's side is the vehicle's left (+x when it faces +z), the passenger's the right. The chase camera scales with the vehicle's length (a bigger vehicle gets a more distant view):
// 3 x its length behind, 1.2 x its length up (worktruck 6 m: 9 m back, 3.6 m up).
function makeClass(c){const L=c.hz*2;return {...c,door:{x:+(c.hx+.6).toFixed(3),z:c.doorZ},passengerDoor:{x:-+(c.hx+.6).toFixed(3),z:c.doorZ},seat:{x:.45,z:c.doorZ},passengerSeat:{x:-.45,z:c.doorZ},camera:{back:+(3*L/2).toFixed(2),up:+(1.2*L/2).toFixed(2)}}}
export const CLASSES=Object.freeze({
 worktruck:makeClass({id:'worktruck',name:'Worktruck',hx:1.09,hz:3,top:10,reverse:3.5,accel:2.4,brake:6,drag:.9,rMin:7,aLat:4.5,doorZ:.5}),
 offroad:makeClass({id:'offroad',name:'Pevrolet Off Road Pickup',hx:1.255,hz:2.8,top:8.5,reverse:3.5,accel:2.2,brake:6.5,drag:1,rMin:6.5,aLat:5,doorZ:.5,rough:.35}) // slower on the road, but grass, fields, paths and dirt cost it 35 points less speed (rough)
});

// Top speed and acceleration multiplier by terrain surface. Water, banks and everything off the map are never driven on (blocked() refuses them as well).
export const SURFACE_SPEED=Object.freeze({[SURFACE.GRASS]:.5,[SURFACE.STREET]:1,[SURFACE.ROAD]:1,[SURFACE.DIRT]:.8,[SURFACE.PAVEMENT]:.5,[SURFACE.WATER]:0,[SURFACE.BANK]:0,[SURFACE.BRIDGE]:1,[SURFACE.WHEAT]:.5,[SURFACE.PLOWED]:.5,[SURFACE.GREEN]:.5,[SURFACE.DRIVEWAY]:1,[SURFACE.PATH]:.5});
// cls.rough (an off-road vehicle) lifts the rough-ground multipliers (grass 0.5, dirt 0.8 ...) by that much, never above 1; water and banks stay 0.
export const surfaceSpeed=(surface,cls)=>{const base=SURFACE_SPEED[surface]??0;return base>0&&base<1&&cls?.rough?Math.min(1,base+cls.rough):base};

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
export function stepVehicle(s,input,dt,cls,env){
 const surface=surfaceSpeed(env.surface(s.x,s.z),cls);
 const top=cls.top*surface,rev=cls.reverse*surface,accel=cls.accel*Math.max(.35,surface);
 let v=s.speed;
 const throttle=clamp(input.throttle||0,-1,1);
 if(input.brake)v=toward(v,0,cls.brake*1.5*dt);
 else if(throttle>0){v=v<-.3?toward(v,0,cls.brake*dt):toward(v,top,accel*dt*(v<top?1:3))}
 else if(throttle<0){v=v>.3?toward(v,0,cls.brake*dt):toward(v,-rev,accel*dt*(v>-rev?1:3))}
 else v=toward(v,0,cls.drag*dt);
 if(v>top)v=toward(v,top,6*dt); // rougher ground slows you down to its own top speed
 if(v<-rev)v=toward(v,-rev,6*dt);
 // steering ramps to full in 0.4 s and back to centre in 0.3 s
 const want=clamp(input.steer||0,-1,1),rate=(want===0?1/.3:1/.4)*dt;let steer=toward(s.steer,want,rate);
 // R(v) = max(Rmin, v^2 / aLat): fast corners are wider; yaw rate = steer x v / R (the sign of v makes reversing steer the right way round)
 const radius=Math.max(cls.rMin,v*v/cls.aLat),yawRate=Math.abs(v)<.01?0:steer*v/radius;
 const yaw=s.yaw+yawRate*dt,mid=s.yaw+yawRate*dt/2,nx=s.x+sin(mid)*v*dt,nz=s.z+cos(mid)*v*dt;
 const next={x:nx,z:nz,yaw,speed:v,steer};
 if(poseFree(next,cls,env))return {state:next,hit:false};
 // blocked: slide along the obstacle (x only, then z only), keeping the new heading; then turn on the spot; else stay put and stop (and refuse the yaw change too)
 // (a slide must keep at least a fifth of the intended step, or head-on contact would "slide" a hair sideways for ever and never stop)
 const step=Math.hypot(nx-s.x,nz-s.z);
 for(const [x,z] of [[nx,s.z],[s.x,nz]]){const p={x,z,yaw,speed:v*(1-2.5*dt),steer};if(Math.hypot(x-s.x,z-s.z)>=.2*step&&poseFree(p,cls,env))return {state:p,hit:true}}
 return {state:{x:s.x,z:s.z,yaw:s.yaw,speed:0,steer},hit:true};
}
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

// Where the player steps out: the driver's door point; if that is blocked, the passenger side, then behind, then in front. `free(x, z)` is the game's blocked() inverted (and not inside any hull).
export function exitPoint(s,cls,free,side='driver'){
 const own=side==='driver'?1:-1,x=cls.door.x,z=cls.door.z; // your own door first, then the other side, behind, in front, then a little further out on each side
 const tries=[[own*x,z],[-own*x,z],[0,-(cls.hz+.9)],[0,cls.hz+.9],[own*(x+.8),z],[-own*(x+.8),z]];
 for(const [lx,lz] of tries){const w=toWorld(s,lx,lz);if(free(w.x,w.z))return w}
 return null;
}

// The saved list: one entry per MAP.vehicles id that has left its home bay. Unknown ids, unknown models and bad numbers are dropped; positions must be inside the playable rectangle.
export function normalizeVehicles(value,known,playable){
 if(!Array.isArray(value))return [];
 const out=[],seen=new Set();
 for(const v of value){
  if(!v||typeof v!=='object'||seen.has(v.uid))continue;
  const spec=known.find(k=>k.id===v.uid);if(!spec||v.model!==spec.model||!CLASSES[v.model])continue;
  if(![v.x,v.z,v.yaw].every(Number.isFinite))continue;
  if(playable&&(v.x<playable.x0||v.x>playable.x1||v.z<playable.z0||v.z>playable.z1))continue;
  seen.add(v.uid);out.push({uid:v.uid,model:v.model,x:+v.x.toFixed(2),z:+v.z.toFixed(2),yaw:+v.yaw.toFixed(3)});
 }
 return out;
}
// What to save: vehicles that are not at home (a vehicle back in its exact home pose has no entry).
export function vehiclesToSave(specs,states){
 const out=[];for(const spec of specs){const s=states[spec.id];if(!s)continue;
  if(Math.hypot(s.x-spec.home.x,s.z-spec.home.z)<.05&&Math.abs(Math.atan2(sin(s.yaw-spec.home.yaw),cos(s.yaw-spec.home.yaw)))<.01)continue;
  out.push({uid:spec.id,model:spec.model,x:+s.x.toFixed(2),z:+s.z.toFixed(2),yaw:+s.yaw.toFixed(3)})}
 return out;
}
