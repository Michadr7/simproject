// The terrain elevation (Stage 4 of 0.33, relief in 0.34): heightAt(x, z) is how high the bare ground is at a point: 0 everywhere except the outer hills (MAP.relief).
// Pure and free of the world, so the terrain mesh, tree layout, saves and tests can call it before the world exists. What stands on the ground adds its own surface footing
// (world.standHeight = heightAt + the deck or the footing) and decks are measured from the ground under them. setHeightFunction is for tests only.
import {MAP,riverPath} from './map-definition.js';
// The relief itself, pure: the sum of the map's hills (each a cosine-falloff ellipse: its height h at the centre, 0 at the edge).
export function reliefHeight(relief,x,z){let y=0;for(const h of relief?.hills||[]){const t=Math.hypot((x-h.x)/h.rx,(z-h.z)/h.rz);if(t<1)y+=h.h*(1+Math.cos(Math.PI*t))/2}return y}
// The river valley (0.34): the river runs in a channel below the ground, and nothing in it has a hard edge. Across the water the bed is flat, RIVER_DEPTH below the ground; the muddy bank
// (the river's own `bank` width, the cells nobody can walk on) climbs in a smooth cosine to a shoulder RIVER_SHOULDER below the ground, and the shoulder (RIVER_SLOPE m wide, walkable) eases up
// to the ground, again as a cosine. The channel fades out at the two ends of the map (outside the playable area), so it does not end in a wall. The water lies at RIVER_WATER_Y.
export const RIVER_DEPTH=1.4,RIVER_SHOULDER=.35,RIVER_SLOPE=6,RIVER_WATER_Y=-.95,RIVER_FADE_X=[-262,-252,292,302]; // fade in from -262 to -252, out from 292 to 302
const RIVERS=(MAP.water?.rivers||[]).map(river=>({half:river.width/2,bank:river.bank,lip:river.width/2+river.bank+RIVER_SLOPE,path:riverPath(river,2)}));const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
export const valleyFade=x=>smooth((x-RIVER_FADE_X[0])/(RIVER_FADE_X[1]-RIVER_FADE_X[0]))*smooth((RIVER_FADE_X[3]-x)/(RIVER_FADE_X[3]-RIVER_FADE_X[2]));
// distance to a river's centreline (the path runs west to east: find the nearest sample by x, then look a few either side)
export function distanceToRiver(R,x,z){
 const P=R.path;let lo=0,hi=P.length-1;while(lo<hi){const m=(lo+hi)>>1;if(P[m].x<x)lo=m+1;else hi=m}
 let best=Infinity;for(let i=Math.max(1,lo-10);i<=Math.min(P.length-1,lo+10);i++){const a=P[i-1],b=P[i],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1,u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)),d=Math.hypot(x-a.x-dx*u,z-a.z-dz*u);if(d<best)best=d}
 return best;
}
// how far below the ground the channel makes the ground at (x, z): 0 outside the valley, negative inside
export function valleyAt(x,z){
 let y=0;const f=valleyFade(x);if(f<=0)return 0;
 for(const R of RIVERS){const d=distanceToRiver(R,x,z);if(d>=R.lip)continue;y-=d<=R.half?RIVER_DEPTH:d<=R.half+R.bank?RIVER_SHOULDER+(RIVER_DEPTH-RIVER_SHOULDER)*(1+Math.cos(Math.PI*(d-R.half)/R.bank))/2:RIVER_SHOULDER*(1+Math.cos(Math.PI*(d-R.half-R.bank)/RIVER_SLOPE))/2}
 return y*f;
}
export const RIVER_PATHS=RIVERS;
// bridges rise over the river: the deck is an arch (a cosine, flat where it meets the road), BRIDGE_RISE m above the ground at its crown; bridges run north-south
export const BRIDGE_RISE=1.0;
export const bridgeRise=(b,z)=>{const t=(z-b.z0)/(b.z1-b.z0);return t<=0||t>=1?0:BRIDGE_RISE*(1-Math.cos(2*Math.PI*t))/2};
// the deck's height at (x, z) if it is on a bridge (absolute, the deck's own surface line), else null
export function deckAt(x,z){for(const b of MAP.water?.bridges||[])if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1)return bridgeRise(b,z);return null}
let elevation=(x,z)=>reliefHeight(MAP.relief,x,z)+valleyAt(x,z);
export const heightAt=(x,z)=>elevation(x,z);
export function setHeightFunction(fn){elevation=typeof fn==='function'?fn:(x,z)=>reliefHeight(MAP.relief,x,z)+valleyAt(x,z)}
