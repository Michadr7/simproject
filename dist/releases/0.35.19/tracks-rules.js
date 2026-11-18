// TR5 tyre tracks, the pure rules (notes/terrain-vehicle-design.md section 3): which ground keeps a track, for how long, how it fades, how far apart segments are laid, how wide a track is per class,
// and the 'mud carried' meter (a per-vehicle number of metres). tracks.js is the one pooled mesh that draws them; driving.js feeds both. Nothing here touches three.js or the clock.
import {SURFACE} from './terrain.js';
const S=SURFACE;
export const TRACK_MAX=1024; // segments in the one pool (a ring: the oldest is overwritten)
export const TRACK_STEP=.6,TRACK_MIN_SPEED=.5,TRACK_JUMP_M=4.8; // metres between segments; slower than this lays nothing; a bigger jump in one frame (relocate, tow) starts a new ribbon
export const TRACK_FADE_FROM=.7; // full strength for the first 70% of the life, then linear to 0 (the last 30%)
export const TRACK_LIFT=.012; // metres above the ground footing (polygon offset does the rest)
export const TRACK_DRAW_NEAR=70,TRACK_DRAW_FAR=90; // fully drawn inside 70 m of the camera, gone at 90 m
export const TRACK_CARRY_M=30,TRACK_CARRY_ALPHA=.5,TRACK_CARRY_LIFE_S=120,TRACK_CARRY_COLOUR='#4a3524'; // after mud or plowed ground the tyres lay brown tracks on any surface for 30 m, alpha .5 down to 0
export const CARRY_SOURCES=Object.freeze([S.MUD,S.PLOWED]);
// life in REAL seconds (12 game hours = 24 real minutes: 600 s is 5 game hours), colour, alpha. Roads, pavement, bridge and driveway are absent: no track of their own.
export const TRACK_SURFACE=Object.freeze({
 [S.MUD]:{life:600,colour:'#3e2f22',alpha:.75},
 [S.PLOWED]:{life:300,colour:'#4a3a2a',alpha:.6},
 [S.WHEAT]:{life:240,colour:'#5a6a30',alpha:.5},
 [S.GREEN]:{life:240,colour:'#5a6a30',alpha:.5},
 [S.DIRT]:{life:180,colour:'#6b5638',alpha:.45},
 [S.PATH]:{life:180,colour:'#6b5638',alpha:.45},
 [S.GRASS]:{life:90,colour:'#4b6233',alpha:.35},
 [S.GRAVEL]:{life:60,colour:'#6f6a5e',alpha:.35}}); // gravel: a sensible default (short and pale)
// Width of one wheel strip per class id (the flatbed's dual rears count as one wide strip). No entry (the forklift) means no tracks.
export const TRACK_WIDTH=Object.freeze({shortbed:.2,worktruck:.24,offroad:.3,flatbed:.55,atv:.25,tractor_juff:.35,tractor_kidbi:.38}); // FV1: lugged tractor tyres, 0.348 and 0.366 m wide (the rear tyres lay the track)
export const widthOf=id=>TRACK_WIDTH[id]??0;
export const trackOf=surface=>TRACK_SURFACE[surface]||null;
// The mud carried on the tyres: metres of brown track still to lay. Full on mud or plowed ground, then it wears off by the distance driven.
export const carryAfter=(carry,surface,dist)=>CARRY_SOURCES.includes(surface)?TRACK_CARRY_M:Math.max(0,(carry||0)-Math.max(0,dist||0));
// What to lay at a point: its own ground's track, or the carried brown one where that is stronger (it is the only one on roads). Returns {life, colour, alpha} or null.
export function trackAt(surface,carry=0){const own=trackOf(surface),c=carry>0?{life:TRACK_CARRY_LIFE_S,colour:TRACK_CARRY_COLOUR,alpha:TRACK_CARRY_ALPHA*Math.min(1,carry/TRACK_CARRY_M)}:null;
 if(c&&(!own||c.alpha>own.alpha))return c;return own}
// Strength 0..1 over a life: 1 until 70%, then linear to 0 at the end. The shader (tracks.js) does the same sum on the graphics card from the spawn time and a time uniform.
export const fadeOf=(age,life)=>{if(!(life>0)||age<0)return 0;const t=age/life;return t>=1?0:t<=TRACK_FADE_FROM?1:(1-t)/(1-TRACK_FADE_FROM)};
export const drawFactor=d=>d<=TRACK_DRAW_NEAR?1:d>=TRACK_DRAW_FAR?0:(TRACK_DRAW_FAR-d)/(TRACK_DRAW_FAR-TRACK_DRAW_NEAR);
export const alphaOf=(base,age,life,dist=0)=>base*fadeOf(age,life)*drawFactor(dist);
export const freshWheel=()=>({has:false,x:0,z:0});
// One wheel for one frame: where it is now, and whether the vehicle moves faster than TRACK_MIN_SPEED with the wheel on the ground. Returns the segments to lay [{x0,z0,x1,z1}], each TRACK_STEP long along the
// path since the last one, so the result does not depend on the frame rate (the remainder carries to the next frame). A wheel in the air, or a stopped one, ends the ribbon.
export function stepWheel(w,x,z,moving){
 if(!moving){w.has=false;return []}
 if(!w.has){w.has=true;w.x=x;w.z=z;return []}
 const dx=x-w.x,dz=z-w.z,dist=Math.hypot(dx,dz);
 if(dist>TRACK_JUMP_M){w.x=x;w.z=z;return []}
 const out=[],n=Math.floor(dist/TRACK_STEP);
 for(let i=0;i<n;i++){const x0=w.x,z0=w.z;w.x+=dx/dist*TRACK_STEP;w.z+=dz/dist*TRACK_STEP;out.push({x0,z0,x1:w.x,z1:w.z})}
 return out;
}
