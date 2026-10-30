// The terrain mask: the map (map-definition.js) rasterised at load into 0.5 m cells, so walking, footing heights and the minimap are lookups instead of geometry,
// and roads and zones can take any shape (a road can be a curved ribbon along a centreline, which a rectangle never could). Each cell has:
//   walk     1 if the player may stand there
//   surface  what the ground is (SURFACE below), which sets the footing height and the minimap colour
//   zone     which zone the cell belongs to (index into map.zones, plus one; 0 for none)
// A cell counts as inside a shape when its centre is. Shapes painted later win, in this order: zones, roads, fields, pavements, the river and its banks,
// bridges. Water is never walkable; a bridge deck is walkable wherever it lies in a zone.
import {MAP,roadRect,riverPath} from './map-definition.js';

export const SURFACE=Object.freeze({GRASS:1,STREET:2,ROAD:3,DIRT:4,PAVEMENT:5,WATER:6,BANK:7,BRIDGE:8,WHEAT:9,PLOWED:10,GREEN:11});
// How high the player's feet sit on each surface (the city's streets and pavements are raised meshes; the County Road is a plane on the grass).
export const FOOTING=Object.freeze({1:-.095,2:.01,3:-.035,4:-.095,5:.165,6:-.095,7:-.095,8:-.01,9:-.095,10:-.095,11:-.095});
export const MINIMAP_COLOUR=Object.freeze({2:'#45494b',3:'#45494b',4:'#9c8462',5:'#8d9294',6:'#3f7ea3',7:'#5b6448',8:'#6f5b43',9:'#d4b45a',10:'#6b4f3a',11:'#82a653'});
const FIELD_SURFACE={wheat:SURFACE.WHEAT,plowed:SURFACE.PLOWED,green:SURFACE.GREEN};

// The centreline of a road edge: its two nodes with any `path` points between them, smoothed into a curve when `curve` is set.
export function roadCenterline(edge,map=MAP){
 const a=map.roads.nodes[edge.from],b=map.roads.nodes[edge.to];
 if(edge.closed)return smoothClosed([[a.x,a.z],...(edge.path||[])],2);
 const points=[[a.x,a.z],...(edge.path||[]),[b.x,b.z]];
 return edge.curve&&points.length>2?riverPath({points},2).map(p=>[p.x,p.z]):points;
}
// A smooth closed curve through the points (Catmull-Rom with wrap-around neighbours), sampled about every `step` metres; the last point repeats the first.
function smoothClosed(p,step){
 const out=[],count=p.length;
 for(let i=0;i<count;i++){
  const [p0,p1,p2,p3]=[p[(i+count-1)%count],p[i],p[(i+1)%count],p[(i+2)%count]],len=Math.hypot(p2[0]-p1[0],p2[1]-p1[1]),k=Math.max(1,Math.ceil(len/step));
  for(let s=0;s<k;s++){const u=s/k,u2=u*u,u3=u2*u,c=j=>.5*((2*p1[j])+(-p0[j]+p2[j])*u+(2*p0[j]-5*p1[j]+4*p2[j]-p3[j])*u2+(-p0[j]+3*p1[j]-3*p2[j]+p3[j])*u3);out.push([c(0),c(1)])}
 }
 out.push(out[0]);return out;
}

export function buildTerrain(map=MAP,{cell=.5}={}){
 const g=map.ground,cols=Math.ceil((g.x1-g.x0)/cell),rows=Math.ceil((g.z1-g.z0)/cell),n=cols*rows;
 const walk=new Uint8Array(n),surface=new Uint8Array(n).fill(SURFACE.GRASS),zone=new Uint8Array(n);
 const centreX=i=>g.x0+(i+.5)*cell,centreZ=j=>g.z0+(j+.5)*cell;
 function rect(r,paint){
  const i0=Math.max(0,Math.ceil((r.x0-g.x0)/cell-.5)),i1=Math.min(cols-1,Math.floor((r.x1-g.x0)/cell-.5)),j0=Math.max(0,Math.ceil((r.z0-g.z0)/cell-.5)),j1=Math.min(rows-1,Math.floor((r.z1-g.z0)/cell-.5));
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)paint(j*cols+i);
 }
 // every cell whose centre lies within `half` of the polyline
 function ribbon(points,half,paint){
  for(let s=0;s<points.length-1;s++){const [ax,az]=points[s],[bx,bz]=points[s+1],dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz||1;
   const i0=Math.max(0,Math.floor((Math.min(ax,bx)-half-g.x0)/cell)),i1=Math.min(cols-1,Math.ceil((Math.max(ax,bx)+half-g.x0)/cell)),j0=Math.max(0,Math.floor((Math.min(az,bz)-half-g.z0)/cell)),j1=Math.min(rows-1,Math.ceil((Math.max(az,bz)+half-g.z0)/cell));
   for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const x=centreX(i),z=centreZ(j),t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/len2));if(Math.hypot(x-ax-dx*t,z-az-dz*t)<=half)paint(j*cols+i)}}
 }
 // 1. zones (the first zone in the list wins where two touch, as zoneAtPoint does)
 for(let k=map.zones.length-1;k>=0;k--)rect(map.zones[k].bounds,c=>{walk[c]=1;zone[c]=k+1});
 // 2. roads: straight axis-aligned edges are their rectangle; edges with a path are ribbons. `walkable` roads also make their ground walkable.
 for(const edge of map.roads.edges){
  const kind=edge.surface==='dirt'?SURFACE.DIRT:edge.level==='rural'?SURFACE.ROAD:SURFACE.STREET,named=edge.zone?map.zones.findIndex(z=>z.id===edge.zone)+1:0,
   paint=c=>{surface[c]=kind;if(edge.walkable){walk[c]=1;if(named)zone[c]=named}};
  if(edge.path)ribbon(roadCenterline(edge,map),edge.width/2,paint);else rect(roadRect(edge,map),paint);
 }
 // 3. fields and 4. pavements
 for(const f of map.fields)rect(f,c=>{surface[c]=FIELD_SURFACE[f.surface]||SURFACE.GRASS});
 for(const p of map.pavements||[])rect(p,c=>{surface[c]=SURFACE.PAVEMENT});
 // 5. the river: banks, then water; neither is walkable
 for(const river of map.water?.rivers||[]){const line=riverPath(river,2).map(p=>[p.x,p.z]);
  ribbon(line,river.width/2+river.bank,c=>{surface[c]=SURFACE.BANK;walk[c]=0});ribbon(line,river.width/2,c=>{surface[c]=SURFACE.WATER;walk[c]=0})}
 // 6. bridge decks: walkable where they lie in a zone
 for(const bridge of map.water?.bridges||[])rect(bridge,c=>{surface[c]=SURFACE.BRIDGE;walk[c]=zone[c]?1:0});

 const index=(x,z)=>{const i=Math.floor((x-g.x0)/cell),j=Math.floor((z-g.z0)/cell);return i<0||j<0||i>=cols||j>=rows?-1:j*cols+i};
 return {
  cell,cols,rows,x0:g.x0,z0:g.z0,walk,surface,zone,index,
  walkable(x,z){const c=index(x,z);return c>=0&&walk[c]===1},
  surfaceAt(x,z){const c=index(x,z);return c<0?0:surface[c]},
  footingAt(x,z){const c=index(x,z);return c<0?FOOTING[SURFACE.GRASS]:FOOTING[surface[c]]},
  zoneAt(x,z){const c=index(x,z);return c<0||!zone[c]?null:map.zones[zone[c]-1]},
  // Flood fill over walkable cells from a point; returns a Uint8Array of reached cells.
  reach(x,z){const seen=new Uint8Array(n),start=index(x,z);if(start<0||!walk[start])return seen;const stack=[start];seen[start]=1;
   while(stack.length){const c=stack.pop(),i=c%cols,j=(c-i)/cols;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=cols||b>=rows)continue;const d=b*cols+a;if(!seen[d]&&walk[d]){seen[d]=1;stack.push(d)}}}
   return seen}
 };
}

// Problems with the terrain (empty when it is sound): every zone can be reached on foot from the spawn point, and no walkable cell is water.
export function validateTerrain(terrain,map=MAP){
 const problems=[],reached=terrain.reach(map.spawn.x,map.spawn.z),cells=new Map();
 for(let c=0;c<terrain.walk.length;c++){if(!terrain.walk[c])continue;const z=terrain.zone[c];if(!cells.has(z))cells.set(z,[0,0]);const t=cells.get(z);t[0]++;if(reached[c])t[1]++;
  if(terrain.surface[c]===SURFACE.WATER||terrain.surface[c]===SURFACE.BANK)problems.push('walkable water at cell '+c)}
 map.zones.forEach((zone,k)=>{const [all,ok]=cells.get(k+1)||[0,0];if(!all)problems.push(`zone ${zone.id} has no walkable ground`);else if(ok<all)problems.push(`zone ${zone.id}: ${all-ok} of ${all} walkable cells cannot be reached from the spawn point`)});
 return problems.slice(0,20);
}

let shared=null;
// The terrain for the shipped map, built once on first use (about 0.9 M cells; tens of milliseconds).
export const terrain=()=>shared||(shared=buildTerrain(MAP));
