// The town's markings and street furniture (0.31), worked out from the map data: crosswalk stripes, stop lines and parking-bay lines as bars, and hydrants, bins, benches, parking meters,
// lamps and trees placed along the pavement rows in MAP.frontages. Everything is pure data (no three.js); world.js draws it, tests/town.mjs checks it.
import {MAP} from './map-definition.js';
import {terrain,SURFACE} from './terrain.js';
import {propInfo} from './props.js';

// ── Markings: white bars {x, z, w, d} (centre and size, metres) ────────────────────────────────────────────────────────────
export function markingBars(){
 const bars=[];
 for(const c of MAP.crossings){ // a crosswalk: stripes 3 m long along the road, 0.5 m wide, one every metre across it
  for(let k=0;k<c.span;k++){const o=-c.span/2+.5+k;bars.push(c.road==='z'?{x:c.x+o,z:c.z,w:.5,d:3}:{x:c.x,z:c.z+o,w:3,d:.5})}}
 for(const s of MAP.stopLines)bars.push(s.along==='x'?{x:s.x,z:s.z,w:s.w,d:.4}:{x:s.x,z:s.z,w:.4,d:s.w});
 for(const lane of MAP.parking){ // the lane's edge line, and a tick at every bay boundary
  bars.push({x:(lane.x0+lane.x1)/2,z:lane.edge,w:lane.x1-lane.x0,d:.15});
  for(let x=lane.x0;x<=lane.x1+.01;x+=lane.bay)bars.push({x,z:lane.z,w:.15,d:2.3})}
 for(const lot of MAP.lots){const b=lot.bays; // the bay lines of a lot: one every bay width, 5 m deep, and the line along the back
  for(let i=0;i<=b.count;i++)bars.push({x:b.x0+i*b.width,z:b.z0+b.depth/2,w:.12,d:b.depth});
  bars.push({x:b.x0+b.count*b.width/2,z:b.z0,w:b.count*b.width,d:.12});bars.push({x:b.x0+b.count*b.width/2,z:b.z0+b.depth,w:b.count*b.width,d:.12})}
 return bars;
}
// The bays themselves (for parked cars): parallel bays on the cross street and the lot's bays: centre and the way a car's nose points.
export function parkingBays(){
 const bays=[];
 for(const lane of MAP.parking){const n=Math.round((lane.x1-lane.x0)/lane.bay);for(let i=0;i<n;i++)bays.push({id:`${lane.id}-${i}`,x:lane.x0+(i+.5)*lane.bay,z:lane.z,w:lane.bay,d:2.3,face:lane.face})}
 for(const lot of MAP.lots){const b=lot.bays;for(let i=0;i<b.count;i++)bays.push({id:`${lot.id}-${i}`,x:b.x0+(i+.5)*b.width,z:b.z0+b.depth/2,w:b.width,d:b.depth,face:'north'})}
 return bays;
}

// ── Street furniture along the frontages ───────────────────────────────────────────────────────────────────────────────────
const ORDER=['lamp','hydrant','bin','meter','bench','tree'],MIN_GAP=1.5;
const rotatedFootprint=l=>{const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),xs=[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>l.x+x*c+z*s)),zs=[f.x0,f.x1].flatMap(x=>[f.z0,f.z1].map(z=>l.z-x*s+z*c));
 return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs),cx:l.x,cz:l.z}};
// Every building: the placed landmarks that are not yard decor, and the city's hand-built ones.
export const buildingRects=()=>[...MAP.landmarks.filter(l=>!l.decor).map(rotatedFootprint),...MAP.buildings.map(b=>({x0:b.x-b.w/2,x1:b.x+b.w/2,z0:b.z-b.d/2,z1:b.z+b.d/2,cx:b.x,cz:b.z}))];
export const crossingRects=()=>MAP.crossings.map(c=>({x0:c.x-(c.road==='z'?c.span/2:1.5)-.8,x1:c.x+(c.road==='z'?c.span/2:1.5)+.8,z0:c.z-(c.road==='z'?1.5:c.span/2)-.8,z1:c.z+(c.road==='z'?1.5:c.span/2)+.8}));
let cache=null;
export function townSpots(){
 if(cache)return cache;
 const T=terrain(),buildings=buildingRects(),crossings=crossingRects(),out={lamp:[],hydrant:[],bin:[],meter:[],bench:[],tree:[]},placed=[];
 const candidates=[];
 for(const kind of ORDER)for(const f of MAP.frontages){const every=f[kind];if(!every)continue;const [ax,az]=f.a,[bx,bz]=f.b,len=Math.hypot(bx-ax,bz-az),tx=(bx-ax)/len,tz=(bz-az)/len;
  for(let d=f[kind+'At']??every/2;d<=len+1e-6;d+=every)candidates.push({kind,x:+(ax+tx*d).toFixed(2),z:+(az+tz*d).toFixed(2),face:f.face,frontage:f.id})}
 const why=globalThis.process?.env?.DEBUG_TOWN?{}:null,drop=(c,r)=>{if(why){const k=c.kind+':'+c.frontage+':'+r;why[k]=(why[k]||0)+1}};
 for(const c of candidates){
  if(T.surfaceAt(c.x,c.z)!==SURFACE.PAVEMENT){drop(c,'not-pavement@'+c.x+','+c.z);continue}
  if(crossings.some(r=>c.x>r.x0&&c.x<r.x1&&c.z>r.z0&&c.z<r.z1)){drop(c,'crossing');continue}
  if(buildings.some(b=>c.x>b.x0-(c.kind==='bench'?0:.4)&&c.x<b.x1+(c.kind==='bench'?0:.4)&&c.z>b.z0-(c.kind==='bench'?0:.4)&&c.z<b.z1+(c.kind==='bench'?0:.4))){drop(c,'building');continue}
  if(c.kind!=='lamp'&&c.kind!=='tree'&&buildings.some(b=>Math.abs(c.x-b.cx)<1.8&&c.z>b.z0-2.2&&c.z<b.z1+2.2)){drop(c,'door');continue} // not in front of a door (assumed near a building's middle)
  if(placed.some(p=>Math.hypot(p.x-c.x,p.z-c.z)<MIN_GAP)){drop(c,'gap');continue}
  placed.push(c);const [fx,fz]=c.face;out[c.kind].push({x:c.x,z:c.z,dx:fx,dz:fz,yaw:Math.atan2(fx,fz),frontage:c.frontage});
 }
 // the town square
 for(const plaza of MAP.plazas){
  out.planter=(out.planter||[]).concat(plaza.planters.map(([x,z])=>({x,z})));
  out.tree.push(...plaza.trees.map(([x,z])=>({x,z,dx:0,dz:1,yaw:0,frontage:plaza.id})));
  out.bench.push(...plaza.benches.map(b=>({x:b.x,z:b.z,dx:Math.sin(b.yaw),dz:Math.cos(b.yaw),yaw:b.yaw,frontage:plaza.id})));
  const bol=[];for(let x=plaza.bollards.x0;x<=plaza.bollards.x1+.01;x+=plaza.bollards.every)bol.push({x,z:plaza.bollards.z});out.bollard=(out.bollard||[]).concat(bol);
 }
 if(why)console.log(JSON.stringify(why));
 return cache=out;
}
export const FOUNTAIN=MAP.plazas[0].fountain,BUS_STOP=MAP.busStop;
