// The terrain elevation (Stage 4 of 0.33, relief in 0.34): heightAt(x, z) is how high the bare ground is at a point: 0 everywhere except the outer hills (MAP.relief).
// Pure and free of the world, so the terrain mesh, tree layout, saves and tests can call it before the world exists. What stands on the ground adds its own surface footing
// (world.standHeight = heightAt + the deck or the footing) and decks are measured from the ground under them. setHeightFunction is for tests only.
import {MAP,riverPath,riverIsLegacy,riverBank,nearestOnRiver,riverDepthAt,RIVER_PROFILE,seaLineZ,cosEase,polyDistance,inPolygon} from './map-definition.js';
// The relief itself, pure: the sum of the map's hills (each a cosine-falloff ellipse: its height h at the centre, 0 at the edge).
export function reliefHeight(relief,x,z){let y=0;for(const h of relief?.hills||[]){const t=Math.hypot((x-h.x)/h.rx,(z-h.z)/h.rz);if(t<1)y+=h.h*(1+Math.cos(Math.PI*t))/2}return y}
// The river valley (0.34): the river runs in a channel below the ground, and nothing in it has a hard edge. Across the water the bed is flat, RIVER_DEPTH below the ground; the muddy bank
// (the river's own `bank` width, the cells nobody can walk on) climbs in a smooth cosine to a shoulder RIVER_SHOULDER below the ground, and the shoulder (RIVER_SLOPE m wide, walkable) eases up
// to the ground, again as a cosine. The channel fades out at the two ends of the map (outside the playable area), so it does not end in a wall. The water lies at RIVER_WATER_Y.
export const RIVER_DEPTH=1.4,RIVER_SHOULDER=.35,RIVER_SLOPE=6,RIVER_WATER_Y=-.95,RIVER_FADE_X=[-262,-252,292,302]; // fade in from -262 to -252, out from 292 to 302
const legacyRivers=map=>(map.water?.rivers||[]).filter(riverIsLegacy).map(river=>({half:river.width/2,bank:river.bank,lip:river.width/2+river.bank+RIVER_SLOPE,path:riverPath(river,2)}));const RIVERS=legacyRivers(MAP);const smooth=t=>t<=0?0:t>=1?1:t*t*(3-2*t);
export const valleyFade=x=>smooth((x-RIVER_FADE_X[0])/(RIVER_FADE_X[1]-RIVER_FADE_X[0]))*smooth((RIVER_FADE_X[3]-x)/(RIVER_FADE_X[3]-RIVER_FADE_X[2]));
// distance to a river's centreline (the path runs west to east: find the nearest sample by x, then look a few either side)
export function distanceToRiver(R,x,z){
 const P=R.path;let lo=0,hi=P.length-1;while(lo<hi){const m=(lo+hi)>>1;if(P[m].x<x)lo=m+1;else hi=m}
 let best=Infinity;for(let i=Math.max(1,lo-10);i<=Math.min(P.length-1,lo+10);i++){const a=P[i-1],b=P[i],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz||1,u=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l2)),d=Math.hypot(x-a.x-dx*u,z-a.z-dz*u);if(d<best)best=d}
 return best;
}
// how far below the ground the channel makes the ground at (x, z): 0 outside the valley, negative inside
function legacyValley(rivers,x,z){
 let y=0;const f=valleyFade(x);if(f<=0)return 0;
 for(const R of rivers){const d=distanceToRiver(R,x,z);if(d>=R.lip)continue;y-=d<=R.half?RIVER_DEPTH:d<=R.half+R.bank?RIVER_SHOULDER+(RIVER_DEPTH-RIVER_SHOULDER)*(1+Math.cos(Math.PI*(d-R.half)/R.bank))/2:RIVER_SHOULDER*(1+Math.cos(Math.PI*(d-R.half-R.bank)/RIVER_SLOPE))/2}
 return y*f;
}
// W2 (notes/water-design.md): digging from the water contract. The ground is y 0; the numbers below are absolute heights. Old-form (legacy) rivers keep the channel above (flat bed, fades at the map ends).
// New-form rivers: the nearest point of the polyline in any direction gives width, water y and depth; the bed across the water is y - depth x RIVER_PROFILE (deepest in the centre, the waterline at the edge),
// the bank climbs from the waterline to a shoulder RIVER_SHOULDER below the ground (the river's own `bank` width), then eases up to the ground over RIVER_SLOPE m. Lakes: bed y - depth x cosEase(distance in / shore) inside the outline,
// a LAKE_BANK-wide cosine up to the ground outside it. Sea: bed y - depth x cosEase(offshore / beach) south of the shoreline (0 at the line, -2.6 m with the defaults), and the land rises from the waterline to the ground over SEA_BANK m north of it.
// Fords raise the river bed (riverDepthAt). Falls are not dug yet. Where basins and channels overlap the deepest one wins.
export const LAKE_BANK=6,SEA_BANK=20;
const dug=new WeakMap();
const compileMap=map=>{let c=dug.get(map);if(!c){const rivers=(map.water?.rivers||[]).filter(r=>!riverIsLegacy(r)&&r.points?.length>=2).map(river=>({river,reach:Math.max(...river.points.map(p=>p.w))/2+riverBank(river)+RIVER_SLOPE}));
 c={legacy:map===MAP?RIVERS:legacyRivers(map),rivers,lakes:(map.water?.lakes||[]).map(l=>({l,x0:Math.min(...l.outline.map(p=>p[0]))-LAKE_BANK,x1:Math.max(...l.outline.map(p=>p[0]))+LAKE_BANK,z0:Math.min(...l.outline.map(p=>p[1]))-LAKE_BANK,z1:Math.max(...l.outline.map(p=>p[1]))+LAKE_BANK})),sea:map.water?.sea?.shoreline?.length>=2?map.water.sea:null};
 c.any=!!(rivers.length||c.lakes.length||c.sea);dug.set(map,c)}return c};
// RV1 (user 2026-11-15, the saw-tooth water edge): the bank no longer leaves the waterline flat. BANK_LIFT is the share of the bank that rises in a straight line (the rest is the old cosine), so the ground has a real slope where it meets the water (0.115 on the old reach) and a 1 m mesh puts the waterline within about 0.2 m of the true one; SHOULDER_LIFT does the same softly where the bank meets the shoulder.
export const BANK_LIFT=.5,SHOULDER_LIFT=.2;
function riverBed(map,R,x,z){
 const q=nearestOnRiver(R.river,x,z,R.reach);if(!q)return 0;const s=q.s,half=s.w/2,bank=riverBank(R.river),d=q.d,hs=Math.min(0,Math.max(s.y,-RIVER_SHOULDER));
 if(d<=half)return s.y-riverDepthAt(map,R.river,q,x,z);
 if(d<=half+bank){const u=(d-half)/bank;return s.y+(hs-s.y)*(BANK_LIFT*u+(1-BANK_LIFT)*(1-Math.cos(Math.PI*u))/2)};
 if(d<half+bank+RIVER_SLOPE){const v=(d-half-bank)/RIVER_SLOPE;return hs*(1-(SHOULDER_LIFT*v+(1-SHOULDER_LIFT)*(1-Math.cos(Math.PI*v))/2))}
 return 0;
}
export function valleyIn(map,x,z){
 const c=compileMap(map);let y=legacyValley(c.legacy,x,z);if(!c.any)return y;
 for(const R of c.rivers)y=Math.min(y,riverBed(map,R,x,z));
 for(const L of c.lakes){const l=L.l;if(x<L.x0||x>L.x1||z<L.z0||z>L.z1)continue;const d=polyDistance(l.outline,x,z);
  if(inPolygon(l.outline,x,z))y=Math.min(y,l.y-l.depth*cosEase(d/l.shore));else if(d<LAKE_BANK)y=Math.min(y,l.y*(1+Math.cos(Math.PI*d/LAKE_BANK))/2)}
 if(c.sea){const S=c.sea,dz=z-seaLineZ(S,x);if(dz>0)y=Math.min(y,S.y-(S.depth??.6)*cosEase(dz/S.beach));else if(-dz<SEA_BANK)y=Math.min(y,S.y*(1+Math.cos(Math.PI*-dz/SEA_BANK))/2)}
 return y;
}
export const valleyAt=(x,z)=>valleyIn(MAP,x,z);
export const heightIn=(map,x,z)=>reliefHeight(map.relief,x,z)+valleyIn(map,x,z);
export const RIVER_PATHS=RIVERS;
// bridges rise over the river: the deck is an arch (a cosine, flat where it meets the road), BRIDGE_RISE m above the ground at its crown; a bridge runs north-south unless its `axis` is 'x' (then west-east, the rise follows x; bridgeRise(b,z,x))
export const BRIDGE_RISE=1.0;
export const bridgeRise=(b,z,x=0)=>{const t=b.axis==='x'?(x-b.x0)/(b.x1-b.x0):(z-b.z0)/(b.z1-b.z0);return t<=0||t>=1?0:BRIDGE_RISE*(1-Math.cos(2*Math.PI*t))/2};
// the deck's height at (x, z) if it is on a bridge (absolute, the deck's own surface line), else null
export function deckAt(x,z){for(const b of MAP.water?.bridges||[])if(x>=b.x0&&x<=b.x1&&z>=b.z0&&z<=b.z1)return bridgeRise(b,z,x);return null}
let elevation=(x,z)=>reliefHeight(MAP.relief,x,z)+valleyAt(x,z);
export const heightAt=(x,z)=>elevation(x,z);
export function setHeightFunction(fn){elevation=typeof fn==='function'?fn:(x,z)=>reliefHeight(MAP.relief,x,z)+valleyAt(x,z)}
