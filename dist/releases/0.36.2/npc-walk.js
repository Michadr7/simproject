// NPC walking maths (0.35.11, DESIGN 4.20 A2). Pure: no three.js, no DOM, no clock, no randomness. A person's position is a function of their plan block and the time, so it is the same whatever the frame rate and whoever looks.
// findRoute: grid A* between two points (2 m cells) with an injected `blocked` and `cost`, then shortened; walkDistance and routePoint: how far along a route someone is at a moment (they walk to the end and stop, never back);
// personPose: where a person is and what they are doing from schedule.js's plan, with no allocation (it fills `out`).
import {WALK_SPEED,GAME_MINUTES_PER_SECOND,placeKind} from './population.js';
import {isOutdoorWork,workerRoleOf,workforcePose} from './workforce-pose.js'; // W3: the Ridgeline fellers and the sawyer work in the open (notes/workforce-design.md)

export const SECONDS_PER_MINUTE=1/GAME_MINUTES_PER_SECOND; // real seconds per game minute (2)
export const CELL=2;
export const MAX_NODES=15000;   // an A* search gives up after this many cells and the route is a straight line
export const DOOR_CLEAR=1.5;    // within this of a route's two ends the ground counts as free (a door point can sit inside a wall's margin)
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

// ── Routes ───────────────────────────────────────────────────────────────────
// A route is {xs, zs, cum, length, direct}: points, the distance along the route at each point, and the total.
export function makeRoute(points,direct=false){
 const xs=[],zs=[],cum=[];let len=0;
 points.forEach((p,i)=>{if(i){const d=Math.hypot(p.x-xs[i-1],p.z-zs[i-1]);len+=d}xs.push(p.x);zs.push(p.z);cum.push(len)});
 return {xs,zs,cum,length:len,direct};
}
// Grid A* from a to b ({x,z}). opts: blocked(x,z)->bool, cost(x,z)->number>=1 (1 on pavement, more on grass and road), bounds {x0,x1,z0,z1}, cell, maxNodes.
// Never throws and never returns null: if no way is found the route is the straight line (direct: true).
export function findRoute(a,b,opts){
 const {blocked,cost=null,bounds,cell=CELL,maxNodes=MAX_NODES}=opts;
 const straight=()=>makeRoute([{x:a.x,z:a.z},{x:b.x,z:b.z}],true);
 if(!bounds||!blocked)return straight();
 const x0=bounds.x0,z0=bounds.z0,w=Math.floor((bounds.x1-x0)/cell)+1,h=Math.floor((bounds.z1-z0)/cell)+1;
 const nearEnd=(x,z)=>Math.hypot(x-a.x,z-a.z)<DOOR_CLEAR||Math.hypot(x-b.x,z-b.z)<DOOR_CLEAR;
 const isBlocked=(x,z)=>!nearEnd(x,z)&&blocked(x,z);
 const state=new Int8Array(w*h),price=new Float32Array(w*h); // state 0 unknown, 1 free, 2 blocked
 const cx=ix=>x0+ix*cell,cz=iz=>z0+iz*cell;
 const free=(ix,iz)=>{if(ix<0||iz<0||ix>=w||iz>=h)return false;const k=iz*w+ix;if(!state[k]){const x=cx(ix),z=cz(iz);state[k]=isBlocked(x,z)?2:1;price[k]=state[k]===1&&cost?Math.max(1,cost(x,z)):1}return state[k]===1};
 const snap=p=>{const ix=clamp(Math.round((p.x-x0)/cell),0,w-1),iz=clamp(Math.round((p.z-z0)/cell),0,h-1);
  for(let r=0;r<=4;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)if(Math.max(Math.abs(dx),Math.abs(dz))===r&&free(ix+dx,iz+dz)&&!blocked(cx(ix+dx),cz(iz+dz)))return (iz+dz)*w+ix+dx;return -1};
 const s=snap(a),g=snap(b);if(s<0||g<0)return straight();
 const N=w*h,gs=new Float32Array(N).fill(Infinity),from=new Int32Array(N).fill(-1),done=new Uint8Array(N),heap=[],fs=new Float32Array(N);
 const gx=g%w,gz=(g-gx)/w,hOf=(ix,iz)=>{const dx=Math.abs(ix-gx),dz=Math.abs(iz-gz);return (dx+dz+(Math.SQRT2-2)*Math.min(dx,dz))*cell};
 const push=k=>{heap.push(k);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(fs[heap[p]]<=fs[heap[i]])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p}};
 const pop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&fs[heap[l]]<fs[heap[m]])m=l;if(r<heap.length&&fs[heap[r]]<fs[heap[m]])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m}}return top};
 gs[s]=0;fs[s]=hOf(s%w,Math.floor(s/w));push(s);let expanded=0,found=false;
 while(heap.length){const k=pop();if(done[k])continue;done[k]=1;if(k===g){found=true;break}if(++expanded>maxNodes)break;
  const ix=k%w,iz=(k-ix)/w;
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dz)continue;const nx=ix+dx,nz=iz+dz;if(!free(nx,nz))continue;
   if(dx&&dz&&(!free(ix+dx,iz)||!free(ix,iz+dz)))continue; // no cutting a corner
   const mx=(cx(ix)+cx(nx))/2,mz=(cz(iz)+cz(nz))/2;
   if(isBlocked(mx,mz))continue; // the middle of the step must be clear too
   if(dx&&dz&&(isBlocked((cx(ix)+mx)/2,(cz(iz)+mz)/2)||isBlocked((mx+cx(nx))/2,(mz+cz(nz))/2)))continue;
   const n=nz*w+nx;if(done[n])continue;const step=cell*(dx&&dz?Math.SQRT2:1)*(price[n]+price[k])/2,t=gs[k]+step;
   if(t<gs[n]){gs[n]=t;from[n]=k;fs[n]=t+hOf(nx,nz);push(n)}}}
 if(!found)return straight();
 const cells=[];for(let k=g;k>=0;k=from[k])cells.push(k);cells.reverse();
 const pts=[{x:a.x,z:a.z}];for(const k of cells){const ix=k%w;pts.push({x:cx(ix),z:cz((k-ix)/w)})}pts.push({x:b.x,z:b.z});
 // shorten: from each point jump to the furthest later point that can be reached along a clear line that is not dearer than the cells it replaces
 const px=pts.map(p=>p.x),pz=pts.map(p=>p.z),pc=pts.map((p,i)=>i&&i<pts.length-1?price[cells[i-1]]:1);
 const clear=(i,j)=>{const dx=px[j]-px[i],dz=pz[j]-pz[i],len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/.1));let sum=0;
  for(let q=0;q<=n;q++){const x=px[i]+dx*q/n,z=pz[i]+dz*q/n;if(isBlocked(x,z))return false;if(cost)sum+=Math.max(1,cost(x,z))}
  if(!cost)return true;let around=0;for(let q=i;q<=j;q++)around+=pc[q];return sum/(n+1)<=1.1*around/(j-i+1)};
 const keep=[0];let i=0;
 while(i<pts.length-1){let j=pts.length-1;while(j>i+1&&!clear(i,j))j--;keep.push(j);i=j}
 return makeRoute(keep.map(k=>({x:px[k],z:pz[k]})),false);
}

// ── Moving along a route ─────────────────────────────────────────────────────
// How far along (metres) someone is `elapsed` seconds after setting out, in a trip that has `duration` seconds to run. They walk at `speed`; if the route is longer than the time allows
// (the schedule's estimate was short) they walk faster, never slower, so they are always there when the block ends. Arrived means distance = length: they stop, they never turn back.
export function walkDistance(length,elapsed,duration,speed=WALK_SPEED){
 if(!(length>0)||elapsed<=0)return 0;
 const v=Math.max(speed,duration>0?length/duration:speed);
 return Math.min(length,v*elapsed);
}
// The point `d` metres along the route, written into out (x, z, yaw = the heading of the segment, the way three.js rotation.y turns a model that faces +z). No allocation.
export function routePoint(route,d,out){
 const {xs,zs,cum}=route,n=xs.length;
 if(n===1){out.x=xs[0];out.z=zs[0];out.yaw=0;return out}
 const dd=clamp(d,0,route.length);let i=1;while(i<n-1&&cum[i]<dd)i++;
 const a=i-1,seg=cum[i]-cum[a],t=seg>0?(dd-cum[a])/seg:1;
 out.x=xs[a]+(xs[i]-xs[a])*t;out.z=zs[a]+(zs[i]-zs[a])*t;out.yaw=Math.atan2(xs[i]-xs[a],zs[i]-zs[a]);return out;
}

// ── What a block means for the drawing ───────────────────────────────────────
export const INDOOR_KINDS=['shop','office','property','dwelling']; // acts at these places happen inside: the person is not drawn
// 'walk' (on foot: walking until they arrive), 'stand' (outdoors at their place), 'hidden' (indoors, in a car, or off the map)
export function presenceOf(block){
 if(block.act==='travel')return block.mode==='drive'?'hidden':'walk';
 if(block.act==='outside'||block.act==='pause')return 'stand'; // out in the open (schedule.js 'outside' or walk-legs.js 'pause'), even at a shop or a front door
 if(block.act==='sleep'||block.act==='home'||block.act==='away')return 'hidden';
 return INDOOR_KINDS.includes(placeKind(block.place))&&!isOutdoorWork(block)?'hidden':'stand'; // W3: work at the sawmill (an open-sided yard) is outdoors
}
// The index of the plan block a minute falls in (the plan covers 0 to 1440; blockAt in schedule.js builds an object, this does not).
export function blockIndex(plan,minute){
 const m=minute>=0&&minute<1440?minute:((minute%1440)+1440)%1440; // no +1440 for an in-range time: it rounds 910.9999999999998 up to 911 and picks the next block
 for(let i=0;i<plan.length;i++)if(m>=plan[i].from&&m<plan[i].to)return i;return plan.length-1;
}
// Someone out in the open (act 'outside') does not freeze: a slow pace along the street, a few steps one way, a wait, back again (a pure function of the time; each person has their own timing and direction).
// Cycle of PACE_CYCLE seconds: wait, walk PACE_STEP m, wait, walk back, wait. Writes the offset into out.x and out.z and sets moving and yaw while a step is taken.
export const PACE_CYCLE=14,PACE_STEP=2.4;
function pace(out,b,minute,ctx){
 let h=b.from*31;for(let i=0;i<b.place.length;i++)h=(h*33+b.place.charCodeAt(i))%9973;
 const e=(minute-b.from)*SECONDS_PER_MINUTE-(h%5),left=(b.to-minute)*SECONDS_PER_MINUTE,dir=h%2?1:-1,s=e<0?0:e%PACE_CYCLE,leg=PACE_STEP/WALK_SPEED; // leg: seconds a step takes; they start (and, easing in the last 3 s, end) at the block's own point so nobody jumps
 const reach=ctx&&ctx.paceReach?ctx.paceReach(b.place,out.x,out.z,dir):PACE_STEP; // audit B8: how far the street is clear that way (a wall or a parked vehicle stops the step short; 0 = stay put)
 if(!(reach>.05)){return}
 let at=0,going=0; // at: 0..1 of the way to the far end; going: +1 out, -1 back, 0 waiting
 if(s<4)at=0;else if(s<4+leg){going=1;at=(s-4)/leg}else if(s<8+leg)at=1;else if(s<8+2*leg){going=-1;at=1-(s-8-leg)/leg}else at=0;
 out.x+=dir*Math.min(reach,PACE_STEP)*at*Math.min(1,left/3);
 if(going&&left>3){out.moving=true;out.yaw=going*dir>0?Math.PI/2:-Math.PI/2}
}
// How far (metres, at most max) a person can walk from (x,z) along (dx,dz) (a unit vector) before the first blocked sample (every step m). 0 when the start itself is blocked. Pure, no allocation.
export function freeReach(blocked,x,z,dx,dz,max,step=.4){if(!blocked)return max;if(blocked(x,z))return 0;let d=0;while(d<max){const n=Math.min(max,d+step);if(blocked(x+dx*n,z+dz*n))return d;d=n}return max}
// True when (x,z) lies on any crosswalk in `crossings` (with `margin` m kerb overlap so 2 m A* cells step cleanly from pavement to crossing). Pure, zero allocation.
export function isCrossing(x,z,crossings,margin=1){
 if(!crossings)return false;
 for(let i=0;i<crossings.length;i++){const c=crossings[i],hw=(c.road==='z'?c.span/2:1.5)+margin,hd=(c.road==='z'?1.5:c.span/2)+margin;if(Math.abs(x-c.x)<=hw&&Math.abs(z-c.z)<=hd)return true}
 return false;
}
// Where a person is: fills out {state, x, z, yaw, moving, walked}. ctx: point(place)->{x,z}|null, route(from,to)->route|null (null: not worked out yet, or no such trip), both injected.
// yaw is NaN when they stand (keep the last heading). state 'hidden' leaves x and z alone.
// W3: with ctx.person (and ctx.day, ctx.seed) a Ridgeline feller or sawyer at work gets workforce-pose.js's pose instead (phase chop/carry/bend/walk/saw, prop axe/log/planks, speed):
// a pure function of (person, day, minute, seed), so every co-op client draws the same swing. Everyone else gets phase = prop = null.
export function personPose(out,plan,minute,ctx){
 const b=plan[blockIndex(plan,minute)],kind=presenceOf(b);out.moving=false;out.yaw=NaN;out.state='hidden';if(out.phase)out.phase=out.prop=null;
 if(kind==='hidden')return out;
 if(kind==='stand'&&b.act==='work'&&ctx?.person&&workerRoleOf(ctx.person)&&isOutdoorWork(b,ctx.person)){return workforcePose(out,ctx.person,ctx.day??1,minute,ctx)}
 if(kind==='stand'){const p=ctx.point(b.place);if(p){out.state='stand';out.x=p.x;out.z=p.z;if(b.act==='outside')pace(out,b,minute,ctx)}return out}
 const route=ctx.route(b.origin,b.place);if(!route)return out;
 const m=minute>=0&&minute<1440?minute:((minute%1440)+1440)%1440,elapsed=(m-b.from)*SECONDS_PER_MINUTE,duration=(b.to-b.from)*SECONDS_PER_MINUTE,d=walkDistance(route.length,elapsed,duration);
 routePoint(route,d,out);out.state='walk';out.moving=d<route.length;out.walked=d;if(!out.moving)out.yaw=NaN;return out;
}
