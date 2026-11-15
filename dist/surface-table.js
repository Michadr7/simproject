// TR2 (notes/terrain-vehicle-design.md section 1): what each kind of ground does to each vehicle group. Pure data and three lookups; vehicle.js reads it.
// Road and off-road columns reproduce the old SURFACE_SPEED (+ cls.rough) numbers exactly. Later stages (bog, tracks, fuel) add their own tables here.
import {SURFACE} from './terrain.js';
const S=SURFACE;
export const GROUPS=Object.freeze(['road','offroad','heavy','atv','fork']);
// Top-speed multiplier (it also scales acceleration, floor .35 in vehicle.js). Order of columns: road, offroad, heavy, atv, fork.
const col=(road,offroad,heavy,atv,fork)=>Object.freeze({road,offroad,heavy,atv,fork});
const HARD=col(1,1,1,1,1),NONE=col(0,0,0,0,0);
export const SURFACE_SPEED_BY_GROUP=Object.freeze({
 [S.STREET]:HARD,[S.ROAD]:HARD,[S.BRIDGE]:HARD,[S.DRIVEWAY]:HARD,
 [S.PAVEMENT]:col(.5,.85,.5,.9,.8),
 [S.DIRT]:col(.8,1,.75,1,.4),
 [S.PATH]:col(.5,.85,.45,1,.5),
 [S.GRASS]:col(.5,.85,.45,.95,.3),
 [S.GREEN]:col(.5,.85,.45,.9,.3),
 [S.WHEAT]:col(.5,.85,.45,.85,.25),
 [S.PLOWED]:col(.5,.85,.4,.85,.2),
 [S.GRAVEL]:col(.9,1,.85,1,.6), // TR3: between dirt and road
 [S.MUD]:col(.3,.6,.25,.7,.15),
 [S.WATER]:NONE,[S.BANK]:NONE});
// Grip 0..1 by surface: multiplies aLat (wider turns), brake (longer stopping) and accel. No slide model.
export const GRIP=Object.freeze({[S.STREET]:1,[S.ROAD]:1,[S.BRIDGE]:1,[S.DRIVEWAY]:1,[S.PAVEMENT]:.95,[S.PATH]:.8,[S.GRAVEL]:.85,[S.DIRT]:.75,[S.GRASS]:.65,[S.GREEN]:.6,[S.WHEAT]:.6,[S.PLOWED]:.5,[S.MUD]:.35});
export const GRIP_BONUS=Object.freeze({road:0,offroad:.15,heavy:-.05,atv:.2,fork:0}); // tyres; the fork's solid tyres are a x.7 factor instead (GRIP_FORK_FACTOR)
export const GRIP_FORK_FACTOR=.7;
export const GRIP_MIN=.3,GRIP_WET=.25; // floor; env.wet 0..1 (no weather yet, default 0) takes up to 25% off
// Extra coasting drag (m/s2), added to cls.drag when no throttle and no brake; off-road and ATV tyres take the x.6 factor.
export const ROLL_DRAG=Object.freeze({[S.STREET]:0,[S.ROAD]:0,[S.BRIDGE]:0,[S.DRIVEWAY]:0,[S.PAVEMENT]:.2,[S.GRAVEL]:.2,[S.DIRT]:.4,[S.PATH]:.4,[S.GRASS]:.8,[S.GREEN]:1,[S.WHEAT]:1,[S.PLOWED]:1.4,[S.MUD]:2.5});
export const ROLL_DRAG_GROUP=Object.freeze({road:1,offroad:.6,heavy:1,atv:.6,fork:1});
const groupOf=g=>GROUPS.includes(g)?g:'road';
export const speedFactor=(surface,group)=>SURFACE_SPEED_BY_GROUP[surface]?.[groupOf(group)]??0;
export const gripOf=(surface,group,wet=0)=>{const g=groupOf(group),base=GRIP[surface];if(base==null)return 1; // water, banks, off the map: never driven on
 const tyre=base>=1?base:g==='fork'?base*GRIP_FORK_FACTOR:Math.min(1,base+GRIP_BONUS[g]); // full grip (tarmac) stays 1 for everyone: the tyre bonus only matters on loose ground, so road driving is unchanged
 return Math.max(GRIP_MIN,Math.min(1,tyre*(1-GRIP_WET*Math.max(0,Math.min(1,wet)))))};
export const rollDragOf=(surface,group)=>(ROLL_DRAG[surface]??0)*ROLL_DRAG_GROUP[groupOf(group)];

// TR4 (section 2): bogging. A pure meter per driven vehicle; driving.js feeds it and scales the top speed by topFactor. Never saved, never a hard lock.
export const SINK=Object.freeze({[S.MUD]:1,[S.PLOWED]:.4,[S.WHEAT]:.15,[S.GREEN]:.15,[S.GRASS]:.05}); // 0..1 per surface; every other surface 0
export const BOG_RESIST=Object.freeze({road:1,offroad:.35,heavy:1.3,atv:.2,fork:1.5}); // multiplier on the rise rate (heavy also x (1 + load))
export const BOG_RISE=.25,BOG_SPEED=2,BOG_WET=2; // per second at SINK 1 and resist 1 (road truck in mud: 4 s); wheels spin only below 2 m/s; wet ground sinks x(1+2 wet)
export const STUCK_AT=1,UNSTICK_AT=.6,STUCK_TOP=.08,STUCK_EASE_S=.8; // Stuck at 1, free below .6, top speed x.08, eased in and out over .8 s (no hard stop)
export const BOG_FALL_FIRM=.5,BOG_FALL_IDLE=.08; // per second: on firm ground; on soft ground with the throttle released (it settles: .4 takes 5 s)
export const ROCK_WINDOW=1.2,ROCK_STEP=.15,STUCK_MAX_S=45,BOG_WARN=.4; // a throttle reversal within 1.2 s of the last change takes .15 off; 45 s Stuck clears itself; the panel warns from .4
export const FIRM_BELOW=.1,BOG_PULL_CENTS=4000,BOG_PULL_HOURS=.5; // firm ground: SINK under .1; 'Pull me out': $40 and half a game hour
export const sinkOf=surface=>SINK[surface]??0;
export const bogRate=(surface,group,load=0,wet=0)=>BOG_RISE*sinkOf(surface)*(BOG_RESIST[group]??1)*(group==='heavy'?1+Math.max(0,load):1)*(1+BOG_WET*Math.max(0,Math.min(1,wet)));
export const freshBog=()=>({bog:0,stuck:false,stuckT:0,mix:0,dir:0,dirT:99});
export const topFactor=b=>1-(1-STUCK_TOP)*(b?.mix||0); // multiplies top speed and reverse speed
// One step. in: {throttle (-1..1), speed (m/s, before the step), surface, group, load (0..1), wet (0..1), dt}. Returns {...state, event: 'stuck'|'free'|null}.
export function stepBog(s,{throttle=0,speed=0,surface,group='road',load=0,wet=0,dt}){
 let {bog,stuck,stuckT,mix,dir,dirT}=s;const sink=sinkOf(surface),want=throttle>.1?1:throttle<-.1?-1:0;dirT+=dt;
 if(want!==0&&want!==dir){if(dir!==0&&dirT<=ROCK_WINDOW)bog=Math.max(0,bog-ROCK_STEP);dir=want;dirT=0} // rocking: W then S (or S then W), each phase within the window
 if(stuck){ // held at the top: only rocking, waiting (throttle released), firm ground and the safety net let it go
  if(sink===0)bog-=BOG_FALL_FIRM*dt;else if(want===0)bog-=BOG_FALL_IDLE*dt;
  stuckT+=dt;if(stuckT>=STUCK_MAX_S)bog=Math.min(bog,UNSTICK_AT-.01);
 }else if(sink>0&&want!==0&&Math.abs(speed)<BOG_SPEED)bog+=bogRate(surface,group,load,wet)*dt; // wheels spinning on soft ground
 else if(sink===0)bog-=BOG_FALL_FIRM*dt;else if(want===0)bog-=BOG_FALL_IDLE*dt; // above 2 m/s you plough through: neither rises nor falls
 bog=Math.max(0,Math.min(1,bog));let event=null;
 if(!stuck&&bog>=STUCK_AT){stuck=true;stuckT=0;event='stuck'}else if(stuck&&bog<UNSTICK_AT){stuck=false;stuckT=0;event='free'}
 mix=Math.max(0,Math.min(1,mix+(stuck?1:-1)*dt/STUCK_EASE_S));
 return {bog,stuck,stuckT,mix,dir,dirT:Math.min(dirT,99),event};
}
// 'Pull me out' is offered only while you drive a vehicle that is Stuck or on soft ground (the phone's busy-line rule covers being on foot).
export const pullOutAvailable=({inVehicle=false,stuck=false,soft=false}={})=>!!inVehicle&&(!!stuck||!!soft);
