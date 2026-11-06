// The warehouse forklift (0.35 step 5, DESIGN 4.16 D and I). Pure: how it drives inside the hall and how its forks move. What the forks can touch (pallets, shelving) is fork-pallets.js.
// Room-local metres, front +z when yaw is 0, forward = (sin yaw, cos yaw). It never leaves the warehouse and has no tyres on the road: a small arcade step of its own.
//   state = {x, z, yaw, speed, lift, steer, roll}   lift is the top of the fork tines above the floor, LIFT_MIN..LIFT_MAX

export const TOP=5,REVERSE_TOP=3,ACCEL=3,BRAKE=8,LIFT_MIN=.08,LIFT_MAX=3.05,LIFT_SPEED=.7,LIFT_FINE=.15; // LIFT_MIN: the tine tops rest at 8 cm, low enough to slide into a pallet on the floor (its pocket is 5 to 13 cm); LIFT_FINE: the slow lift (Shift) for lining up a pocket // 5 m/s is about 11 mph, a real forklift's top speed
// Steering is by the rear wheels (as on a real forklift): the body turns about the front axle, so the back swings out. STEER_MAX is the rear wheels' full lock (radians),
// STEER_RATE how fast they turn to it, TURN_MAX caps the turn rate at speed (rad/s). The axles and tyre radii come from the model (forklift-assets.js wheels).
export const FRONT_AXLE=.373,REAR_AXLE=-1.122,WHEELBASE=FRONT_AXLE-REAR_AXLE,STEER_MAX=1.0,STEER_RATE=2.4,TURN_MAX=2.4,WHEEL_R={front:.317,rear:.261};
export const SEAT_TOP=1.18; // the top of the seat cushion above the floor (the driver sits here)
export const BAY={x:-13.5,z:5,yaw:Math.PI/2}; // the painted parking bay (warehouse.js): nose to the east, aisle side clear
export const TIP=1.55; // from the middle of the body to the end of the fork tines
export const SEAT={x:0,z:-.62}; // where the driver's hips are (local): on the cushion against the backrest; the camera and getting off use it
// Points that must be clear: the body (the counterweight, the middle and the front of the chassis; the room's own blocked() keeps .32 m off walls and shelving), and the forks: the carriage corners and the tines.
// The forks go through ctx.forksClear when the caller has one (they may reach into a shelf cell and a pallet's pocket); otherwise they use blocked() like the body.
const HULL=[-1.5,-.5,.2].flatMap(z=>[-.24,.24].map(x=>({x,z}))).concat([{x:0,z:0}]);
export const FORK_POINTS=Object.freeze([[-.32,.8],[0,.8],[.32,.8],[-.22,1.2],[0,1.2],[.22,1.2],[-.22,TIP],[0,TIP],[.22,TIP]].map(([x,z])=>Object.freeze({x,z})));
export const fresh=(pose=BAY)=>({x:pose.x,z:pose.z,yaw:pose.yaw,speed:0,lift:LIFT_MIN,steer:0,roll:0}); // steer: the rear wheels' angle; roll: metres rolled (spins the wheels)
const fwd=s=>({x:Math.sin(s.yaw),z:Math.cos(s.yaw)}),right=s=>({x:Math.cos(s.yaw),z:-Math.sin(s.yaw)});
export const toWorld=(s,lx,lz)=>({x:s.x+right(s).x*lx+fwd(s).x*lz,z:s.z+right(s).z*lx+fwd(s).z*lz});
export const tipOf=s=>toWorld(s,0,TIP);
export const seatOf=s=>toWorld(s,SEAT.x,SEAT.z);
export const clear=(s,blocked,ctx={})=>!HULL.some(p=>{const w=toWorld(s,p.x,p.z);return blocked(w.x,w.z)})&&(ctx.forksClear?ctx.forksClear(s):!FORK_POINTS.some(p=>{const w=toWorld(s,p.x,p.z);return blocked(w.x,w.z)}));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// One step. input {throttle -1..1 (W/S), steer -1..1 (A is +1, left), raise -1..1 (R up, F down), fine (Shift: the slow lift)}, blocked(x, z) from the room.
// ctx (optional, fork-pallets.js): forksClear(state) says whether the carriage and tines are clear of the shelving and the pallets, and liftRange(state) -> [lo, hi] the lowest and highest the forks may be
// (a carried pallet cannot go below what it rests on; tines in a shelf cell stay under the beam above). Returns a new state.
// The rear wheels turn toward the steer at STEER_RATE even while stopped, but the body only turns while rolling. The front axle rolls straight along the heading and the body
// pivots about it (yaw rate = speed x tan(steer) / wheelbase, capped at TURN_MAX), so the tail swings wide: mind it in the aisles.
export function step(s,input,dt,blocked,ctx={}){
 const throttle=clamp(input.throttle||0,-1,1),steerIn=clamp(input.steer||0,-1,1),raise=clamp(input.raise||0,-1,1);
 let v=s.speed;
 if(throttle&&Math.sign(throttle)===Math.sign(v||throttle))v=clamp(v+throttle*ACCEL*dt,-REVERSE_TOP,TOP);
 else if(throttle)v=v+throttle*BRAKE*dt; // pressing the other way brakes first
 else v=Math.abs(v)<=BRAKE*.5*dt?0:v-Math.sign(v)*BRAKE*.5*dt;
 const want=steerIn*STEER_MAX,was=s.steer||0,steer=was+clamp(want-was,-STEER_RATE*dt,STEER_RATE*dt);
 const [lo,hi]=ctx.liftRange?ctx.liftRange(s):[LIFT_MIN,LIFT_MAX];
 let lift=clamp(s.lift+raise*(input.fine?LIFT_FINE:LIFT_SPEED)*dt,lo,hi);
 if(lift!==s.lift&&ctx.forksClear&&ctx.forksClear(s)&&!ctx.forksClear({...s,lift}))lift=s.lift; // the tines cannot be pushed up or down through a pallet or a shelf
 const omega=clamp(v*Math.tan(steer)/WHEELBASE,-TURN_MAX,TURN_MAX);
 let next={...s,speed:v,lift,steer},rolled=0;
 // move in pieces of at most 0.1 m so a fast step cannot jump a wall
 const n=Math.max(1,Math.ceil(Math.abs(v*dt)/.1)),h=dt/n;
 for(let i=0;i<n;i++){
  const f=fwd(next),ax=toWorld(next,0,FRONT_AXLE),yaw=next.yaw+omega*h,ax2={x:ax.x+f.x*v*h,z:ax.z+f.z*v*h},f2={x:Math.sin(yaw),z:Math.cos(yaw)};
  const turned={...next,yaw,x:ax2.x-f2.x*FRONT_AXLE,z:ax2.z-f2.z*FRONT_AXLE};
  const stuck=!clear(next,blocked,ctx); // already touching something (a state set by hand, a pallet set down in front): reversing is always allowed, so it can back out
  if(clear(turned,blocked,ctx)||(stuck&&v<=0)){next=turned;rolled+=v*h;continue}
  const dx=f.x*v*h,dz=f.z*v*h; // the turn would hit something: go straight, or slide along it
  if(clear({...next,x:next.x+dx,z:next.z+dz},blocked,ctx)){next={...next,x:next.x+dx,z:next.z+dz,speed:v*.3};rolled+=v*h}
  else if(clear({...next,x:next.x+dx},blocked,ctx)){next={...next,x:next.x+dx,speed:v*.5};rolled+=dx*f.x}
  else if(clear({...next,z:next.z+dz},blocked,ctx)){next={...next,z:next.z+dz,speed:v*.5};rolled+=dz*f.z}
  else{next={...next,speed:0};break}
  v=next.speed;
 }
 return {...next,roll:(s.roll||0)+rolled};
}
export const nearBay=(s,p=BAY)=>Math.hypot(s.x-p.x,s.z-p.z)<2.5;
