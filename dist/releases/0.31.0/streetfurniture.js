// Street lamps along the new roads and benches on Alder Center's square: where they stand, as data worked out from the map. world.js builds them (instanced) and gives them collision.
import {MAP} from './map-definition.js';
import {roadCenterline,terrain,SURFACE} from './terrain.js';
import {propInfo} from './props.js';

const LAMP_ROADS=['oak-east','cedar-loop','cedar-link','freight-south'],SPACING=26; // Alder Center's streets and the old city's get their lamps from the pavement rows (town.js)
// The rotated footprint of a placed landmark.
const footprint=l=>{const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),pts=[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]].map(([x,z])=>[l.x+x*c+z*s,l.z-x*s+z*c]);
 return {x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),z0:Math.min(...pts.map(p=>p[1])),z1:Math.max(...pts.map(p=>p[1]))}};
let cache=null;
// Lamps: one every 26 m along each lit road, alternating sides, 1.3 m off the road's edge, only where the ground is plain grass, clear of buildings and parked cars.
export function lampSpots(){
 if(cache)return cache;
 const T=terrain(),blockers=MAP.landmarks.map(footprint),spots=[];
 for(const id of LAMP_ROADS){
  const edge=MAP.roads.edges.find(e=>e.id===id),line=roadCenterline(edge);let carried=SPACING/2,n=0;
  for(let i=1;i<line.length;i++){const [ax,az]=line[i-1],[bx,bz]=line[i],len=Math.hypot(bx-ax,bz-az);if(!len)continue;const tx=(bx-ax)/len,tz=(bz-az)/len;
   let at=SPACING-carried;if(carried===SPACING/2)at=SPACING/2;
   while(at<=len){const px=ax+tx*at,pz=az+tz*at,off=edge.width/2+1.3;
    for(const side of [n%2?1:-1,n%2?-1:1]){const x=px-tz*off*side,z=pz+tx*off*side;
     const ok=T.surfaceAt(x,z)===SURFACE.GRASS&&T.zoneAt(x,z)?.id!=='city'&&!blockers.some(b=>x>b.x0-1.2&&x<b.x1+1.2&&z>b.z0-1.2&&z<b.z1+1.2)&&T.surfaceAt(x-tz*1.5*side,z+tx*1.5*side)!==SURFACE.WATER;
     if(ok){spots.push({x:+x.toFixed(2),z:+z.toFixed(2),dx:+(tz*side).toFixed(3),dz:+(-tx*side).toFixed(3),road:id});break}}
    n++;at+=SPACING}
   carried=len-(at-SPACING)}}
 return cache=spots;
}
