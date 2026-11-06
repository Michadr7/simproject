// The warehouse forklift (0.35 step 5, DESIGN 4.16 D). Pure: how it drives inside the hall, where its forks are, and which rack bay, staging pallet or pile they are at.
// Room-local metres, front +z when yaw is 0, forward = (sin yaw, cos yaw). It never leaves the warehouse and has no tyres on the road: a small arcade step of its own.
//   state = {x, z, yaw, speed, lift}   lift is the top of the fork tines above the floor, LIFT_MIN..LIFT_MAX
import {RACK_SLOTS,LEVEL_Y,WAREHOUSE_PILE,WAREHOUSE_STAGING} from './warehouse-layout.js';

export const TOP=3,REVERSE_TOP=2,ACCEL=4,BRAKE=8,TURN=1.5,LIFT_MIN=.2,LIFT_MAX=3.05,LIFT_SPEED=.7;
export const BAY={x:-13.5,z:5,yaw:Math.PI/2}; // the painted parking bay (warehouse.js): nose to the east, aisle side clear
export const TIP=1.55; // from the middle of the body to the end of the fork tines
export const SEAT={x:0,z:-.15}; // where the driver sits (local), for the camera and for getting off
// Points that must be clear: along the middle and the two sides (the room's own blocked() already keeps .32 m off walls and shelving)
const HULL=[-1.5,-.5,.5,TIP].flatMap(z=>[-.24,.24].map(x=>({x,z}))).concat([{x:0,z:0}]);
export const fresh=(pose=BAY)=>({x:pose.x,z:pose.z,yaw:pose.yaw,speed:0,lift:LIFT_MIN});
const fwd=s=>({x:Math.sin(s.yaw),z:Math.cos(s.yaw)}),right=s=>({x:Math.cos(s.yaw),z:-Math.sin(s.yaw)});
export const toWorld=(s,lx,lz)=>({x:s.x+right(s).x*lx+fwd(s).x*lz,z:s.z+right(s).z*lx+fwd(s).z*lz});
export const tipOf=s=>toWorld(s,0,TIP);
export const seatOf=s=>toWorld(s,SEAT.x,SEAT.z);
export const clear=(s,blocked)=>!HULL.some(p=>{const w=toWorld(s,p.x,p.z);return blocked(w.x,w.z)});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// One step. input {throttle -1..1 (W/S), steer -1..1 (A is +1, left), raise -1..1 (R up, F down)}, blocked(x, z) from the room. Returns a new state.
export function step(s,input,dt,blocked){
 const throttle=clamp(input.throttle||0,-1,1),steer=clamp(input.steer||0,-1,1),raise=clamp(input.raise||0,-1,1);
 let v=s.speed;
 if(throttle&&Math.sign(throttle)===Math.sign(v||throttle))v=clamp(v+throttle*ACCEL*dt,-REVERSE_TOP,TOP);
 else if(throttle)v=v+throttle*BRAKE*dt; // pressing the other way brakes first
 else v=Math.abs(v)<=BRAKE*.5*dt?0:v-Math.sign(v)*BRAKE*.5*dt;
 const turn=steer*TURN*clamp(v/1.2,-1,1),yaw=s.yaw+turn*dt,lift=clamp(s.lift+raise*LIFT_SPEED*dt,LIFT_MIN,LIFT_MAX);
 let next={...s,yaw,speed:v,lift};
 // move along the heading in 0.1 m pieces so a fast step cannot jump a wall
 const dist=v*dt,n=Math.max(1,Math.ceil(Math.abs(dist)/.1)),f=fwd(next);
 for(let i=0;i<n;i++){const dx=f.x*dist/n,dz=f.z*dist/n;
  if(clear({...next,x:next.x+dx,z:next.z+dz},blocked)){next={...next,x:next.x+dx,z:next.z+dz}}
  else if(clear({...next,x:next.x+dx},blocked))next={...next,x:next.x+dx,speed:v*.5}
  else if(clear({...next,z:next.z+dz},blocked))next={...next,z:next.z+dz,speed:v*.5}
  else{next={...next,speed:0};break}}
 if(!clear(next,blocked)){ // turned into something: undo the turn
  const back={...next,yaw:s.yaw};next=clear(back,blocked)?{...back,speed:v*.3}:{...s,lift,speed:0}}
 return next;
}

// What the forks are at. A bay, pallet or pile counts when it is straight ahead of the tine tips (within `across` to the side, `along` ahead) and the fork height matches its level.
const REACH={along:[.3,1.7],across:.8,height:.35,facing:.9};
function ahead(s,x,z){const t=tipOf(s),dx=x-t.x,dz=z-t.z,d=Math.hypot(dx,dz)||1e-6,f=fwd(s),r=right(s);
 return {along:dx*f.x+dz*f.z,across:dx*r.x+dz*r.z,facing:(dx*f.x+dz*f.z)/d,d}}
const inReach=a=>a.along>=REACH.along[0]&&a.along<=REACH.along[1]&&Math.abs(a.across)<=REACH.across&&a.facing>=REACH.facing;
// the rack bay (a slot id) the forks are level with, or null
export function slotAt(s){let best=null;for(const k of RACK_SLOTS){if(Math.abs(s.lift-LEVEL_Y[k.level-1])>REACH.height)continue;const a=ahead(s,k.x,k.z);if(inReach(a)&&(!best||a.d<best.d))best={id:k.id,d:a.d}}return best?best.id:null}
// the staging pallet (0, 1, 2) the forks are at, with the forks near the floor, or -1
export function stagingAt(s){if(s.lift>LEVEL_Y[0]+REACH.height)return -1;let best=-1,bd=1e9;WAREHOUSE_STAGING.forEach((p,i)=>{const a=ahead(s,p.x,p.z);if(inReach({...a,along:a.along+.6})&&a.d<bd){bd=a.d;best=i}});return best}
// the delivery pile, with the forks near the floor
export function pileAt(s){if(s.lift>LEVEL_Y[0]+REACH.height)return false;const a=ahead(s,WAREHOUSE_PILE.x,WAREHOUSE_PILE.z);return inReach({...a,along:a.along+.6})}
export const nearBay=(s,p=BAY)=>Math.hypot(s.x-p.x,s.z-p.z)<2.5;
