import * as THREE from './vendor/three.module.js';
import {MAP,zoneById,zoneAtPoint,roadRects,riverPath,riverDistance} from './map-definition.js';
import {PINES,BROADLEAVES,modelInfo,modelGeometry,createNatureMaterials} from './nature.js';
import {terrain,SURFACE,roadCenterline} from './terrain.js';
import {lampSpots,BENCHES} from './streetfurniture.js';
import {propInfo,createProp} from './props.js';

// ─── Layout (pure data, safe to import from rules and tests) ──────────────────
// The city keeps its original footprint. Oak Farms lies west of it, Alder Woods east.
// +x is east and -z is north (the default camera looks north up Oak Street).

// Everything here is derived from map-definition.js (zones, roads, fields, scenery parameters).
export const WORLD_SEED=MAP.seed;
export const ZONES=Object.fromEntries(MAP.zones.map(z=>[z.id,Object.freeze({id:z.id,name:z.name,label:z.label,subtitle:z.subtitle,color:z.color})]));
ZONES.open=Object.freeze({...MAP.openCountry}); // the name for ground outside every zone
const cityZone=zoneById('city');
export const CITY_WEST=cityZone.bounds.x0,CITY_EAST=cityZone.bounds.x1;
export const WALKABLE=Object.freeze(MAP.zones.map(z=>Object.freeze({zone:z.id,grid:z.grid,...z.bounds})));
// Visual extent of the ground (beyond the walkable area, scenery fades into fog).
export const GROUND=MAP.ground;

// The zone a point is in. Edges belong to the first zone that claims them; outside every zone it is the open country.
export function zoneAt(x,z){
 const zone=zoneAtPoint(x,z??0);
 return ZONES[zone?zone.id:'open'];
}
// Walking and footing come from the terrain mask (terrain.js), built from the map at first use.
export function isWalkable(x,z){return terrain().walkable(x,z)}
export function footingAt(x,z){return terrain().footingAt(x,z)}

// ─── Grid: 1 world unit = 1 plot. Cell (ix,iz) covers [ix,ix+1) × [iz,iz+1). ──
export const cellOf=(x,z)=>({ix:Math.floor(x),iz:Math.floor(z)});
export const cellKey=(ix,iz)=>ix+','+iz;
export const cellCenter=(ix,iz)=>({x:ix+.5,z:iz+.5});
export function parseCellKey(key){
 const m=typeof key==='string'&&/^(-?\d{1,4}),(-?\d{1,4})$/.exec(key);
 return m?{ix:Number(m[1]),iz:Number(m[2])}:null;
}
// Only whole cells inside the farm or forest walkable areas belong to the grid.
export function gridZoneAt(ix,iz){
 const r=WALKABLE.find(r=>r.grid&&ix>=r.x0&&ix+1<=r.x1&&iz>=r.z0&&iz+1<=r.z1);
 return r?r.zone:null;
}

// Dirt roads: the dirt edges of the map's road graph, each tagged with the zone it mostly lies in.
export const DIRT_ROADS=Object.freeze(roadRects('dirt').map(r=>Object.freeze({zone:zoneAtPoint((r.x0+r.x1)/2,(r.z0+r.z1)/2).id,x0:r.x0,x1:r.x1,z0:r.z0,z1:r.z1})));
const distanceToRect=(x,z,r)=>Math.hypot(Math.max(r.x0-x,0,x-r.x1),Math.max(r.z0-z,0,z-r.z1));
export const nearDirtRoad=(x,z,margin=0)=>DIRT_ROADS.some(r=>distanceToRect(x,z,r)<=margin);
// Near any street, road or bridge (straight or curved): the terrain mask is searched in a ring of `margin` metres.
export const nearAsphalt=(x,z,margin=0)=>{const t=terrain(),step=Math.max(.75,margin/4);
 for(let dx=-margin;dx<=margin+1e-9;dx+=step)for(let dz=-margin;dz<=margin+1e-9;dz+=step){if(dx*dx+dz*dz>margin*margin+1e-9)continue;const k=t.surfaceAt(x+dx,z+dz);if(k===SURFACE.STREET||k===SURFACE.ROAD||k===SURFACE.BRIDGE)return true}return false};
// Within `margin` metres of the water itself (not counting its muddy banks).
export const inRiver=(x,z,margin=0)=>MAP.water.rivers.some(r=>riverDistance(x,z,r)<=r.width/2+margin);
const nearBuilding=(x,z,margin=0)=>MAP.buildings.some(b=>Math.abs(x-b.x)<b.w/2+margin&&Math.abs(z-b.z)<b.d/2+margin);
// Pine Ridge's side of the world: decor trees here are pines, everywhere else broadleaf.
export const forestSide=(x,z)=>x>-24&&z<-200;

// Fenced farm plots (from the map), in whole cells, each with a 3-cell gate facing the main farm road.
export const FIELDS=Object.freeze(MAP.fields.map(f=>Object.freeze({...f})));
export const fieldAt=(ix,iz)=>FIELDS.find(f=>ix>=f.x0&&ix<f.x1&&iz>=f.z0&&iz<f.z1)||null;
export function fenceSegments(){
 // Only the farm's outer edge is fenced (to mark the zone); the fields inside are open for vehicles. A dirt road that crosses the edge opens a
 // gap as wide as the road plus a metre on each side.
 const farm=zoneById('farm').bounds,segments=[];
 const edges=[{fixed:farm.z0,a:farm.x0,b:farm.x1,along:'x'},{fixed:farm.z1,a:farm.x0,b:farm.x1,along:'x'},{fixed:farm.x0,a:farm.z0,b:farm.z1,along:'z'},{fixed:farm.x1,a:farm.z0,b:farm.z1,along:'z'}];
 for(const e of edges){
  const gaps=DIRT_ROADS.filter(r=>e.along==='x'?(r.z0<=e.fixed&&r.z1>=e.fixed&&r.x1>e.a&&r.x0<e.b):(r.x0<=e.fixed&&r.x1>=e.fixed&&r.z1>e.a&&r.z0<e.b))
   .map(r=>e.along==='x'?[r.x0-1,r.x1+1]:[r.z0-1,r.z1+1]).sort((p,q)=>p[0]-q[0]);
  const run=(from,to)=>{for(let t=from;t<to-1e-6;t+=2){const end=Math.min(t+2,to);segments.push(e.along==='x'?{x0:t,z0:e.fixed,x1:end,z1:e.fixed}:{x0:e.fixed,z0:t,x1:e.fixed,z1:end})}};
  let at=e.a;for(const [g0,g1] of gaps){run(at,Math.max(at,g0));at=Math.max(at,g1)}run(at,e.b);
 }
 return segments;
}

function random(seed){return ()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const blockSeed=(a,b,salt)=>(Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(salt,83492791))|0;

let cachedLayout=null;
// Generates every tree once. Cuttable trees sit on cell centres and are keyed by cell.
// Ground that belongs to something other than open country: a zone, a road, a pavement, a field, the river or a bridge. Scenery belts keep off it.
const CLAIMED=new Set([SURFACE.STREET,SURFACE.ROAD,SURFACE.DIRT,SURFACE.PAVEMENT,SURFACE.WATER,SURFACE.BANK,SURFACE.BRIDGE,SURFACE.WHEAT,SURFACE.PLOWED,SURFACE.GREEN,SURFACE.DRIVEWAY,SURFACE.PATH]);
function claimed(x,z){const t=terrain(),c=t.index(x,z);return c<0||t.zone[c]!==0||CLAIMED.has(t.surface[c])}
export function worldLayout(){
 if(cachedLayout)return cachedLayout;
 const cuttable=[],decor=[],scenery=MAP.scenery,forestRules=scenery.forest;
 const forest=zoneById('forest').bounds,farm=zoneById('farm').bounds;
 const inClearing=(x,z)=>forestRules.clearings.some(c=>((x-c.x)/c.rx)**2+((z-c.z)/c.rz)**2<1);
 // Pine Ridge: 4×4-cell blocks, at most one cuttable pine per block (no touching trunks), thinned by `density`, with wide clearings.
 for(let bx=Math.ceil((forest.x0+2)/4);bx*4+4<=forest.x1-1;bx++)for(let bz=Math.ceil((forest.z0+1)/4);bz*4+4<=forest.z1-1;bz++){
  const r=random(blockSeed(bx,bz,WORLD_SEED));
  const density=forestRules.density+forestRules.wobble*Math.sin(bx*.71)*Math.cos(bz*.93);
  const ix=bx*4+1+Math.floor(r()*2),iz=bz*4+1+Math.floor(r()*2),c=cellCenter(ix,iz);
  const open=inClearing(c.x,c.z)||nearDirtRoad(c.x,c.z,forestRules.roadMargin)||nearAsphalt(c.x,c.z,forestRules.roadMargin);
  if(!open&&r()<density){cuttable.push(Object.freeze({key:cellKey(ix,iz),ix,iz,x:c.x,z:c.z,kind:'pine',scale:.85+r()*.35,rot:r()*Math.PI*2}));continue}
  // Blocks without a pine sometimes get a decor pine between cell centres.
  const x=bx*4+.5+r()*3,z=bz*4+.5+r()*3;
  if(!inClearing(x,z)&&!nearDirtRoad(x,z,forestRules.roadMargin+.2)&&!nearAsphalt(x,z,forestRules.roadMargin+.2)&&r()<forestRules.decorChance)decor.push({x,z,scale:.8+r()*.45,rot:r()*Math.PI*2,tone:Math.floor(r()*4)});
 }
 // Dense scenery outside the walkable zones hides the end of the world (never on roads, in the river or on a building).
 const belt=(x0,x1,z0,z1,spacing,chance,salt)=>{for(let x=x0;x<x1;x+=spacing)for(let z=z0;z<z1;z+=spacing){
  const r=random(blockSeed(Math.round(x*10),Math.round(z*10),salt));if(r()>chance)continue;
  const tx=x+r()*spacing*.8,tz=z+r()*spacing*.8;if(claimed(tx,tz)||nearDirtRoad(tx,tz,1.5)||nearAsphalt(tx,tz,3.5)||inRiver(tx,tz,4)||nearBuilding(tx,tz,3))continue;
  decor.push({x:tx,z:tz,scale:.9+r()*.5,rot:r()*Math.PI*2,tone:Math.floor(r()*4)})}};
 for(const spec of scenery.belts)belt(...spec);
 // A few shade trees between the farm fields.
 for(let i=0;i<scenery.farmShade.count;i++){const r=random(blockSeed(i,7,WORLD_SEED+1)),x=farm.x0+4+r()*(farm.x1-farm.x0-10),z=farm.z0+3+r()*(farm.z1-farm.z0-6),c=cellOf(x,z);
  if(nearDirtRoad(x,z,2.5)||FIELDS.some(f=>x>f.x0-2&&x<f.x1+2&&z>f.z0-2&&z<f.z1+2)||x>farm.x1-scenery.farmShade.clearOfRoad)continue;
  decor.push({x:c.ix+.5,z:c.iz+.5,scale:.9+r()*.4,rot:r()*Math.PI*2,tone:Math.floor(r()*4)})}
 cachedLayout=Object.freeze({cuttable:Object.freeze(cuttable),decor:Object.freeze(decor.map(Object.freeze)),
  cuttableByKey:new Map(cuttable.map(t=>[t.key,t]))});
 return cachedLayout;
}
export const cuttableTreeAt=key=>worldLayout().cuttableByKey.get(key)||null;

// ─── Collisions: spatial hash of trunks and fence rails ───────────────────────
const BUCKET=4,PLAYER_RADIUS=.33;
function createColliders(){
 const buckets=new Map(),keyOf=(bx,bz)=>bx+':'+bz;
 function insert(c,x0,z0,x1,z1){for(let bx=Math.floor(x0/BUCKET);bx<=Math.floor(x1/BUCKET);bx++)for(let bz=Math.floor(z0/BUCKET);bz<=Math.floor(z1/BUCKET);bz++){const k=keyOf(bx,bz);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(c)}}
 return {
  circle(x,z,r,id=null){const c={circle:true,x,z,r,id,active:true};insert(c,x-r,z-r,x+r,z+r);return c},
  box(x,z,hx,hz){const c={circle:false,x,z,hx,hz,active:true};insert(c,x-hx,z-hz,x+hx,z+hz);return c},
  blocked(x,z){
   const bx=Math.floor(x/BUCKET),bz=Math.floor(z/BUCKET);
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const c of buckets.get(keyOf(bx+dx,bz+dz))||[]){
    if(!c.active)continue;
    if(c.circle?Math.hypot(x-c.x,z-c.z)<c.r+PLAYER_RADIUS:Math.abs(x-c.x)<c.hx+PLAYER_RADIUS&&Math.abs(z-c.z)<c.hz+PLAYER_RADIUS)return true;
   }
   return false;
  }
 };
}

// ─── 3D construction ──────────────────────────────────────────────────────────
// Ground textures are small generated canvases (no external art), like visuals.js.
function groundTexture(kind){
 const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
 const r=random(kind.length*977);
 const base={farm:'#7d9a52',forest:'#4b663c',dirt:'#8a7152',field:'#86a057',plowed:'#5d4532',wheat:'#c7a249',green:'#6f9a45'}[kind];
 ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
 const specks=kind==='dirt'?['#00000014','#ffffff12','#5f4a3322']:kind==='forest'?['#00000016','#6d7d3a22','#7a5c3a24','#ffffff08']:['#00000010','#ffffff10','#9fb86522'];
 for(let i=0;i<7000;i++){ctx.fillStyle=specks[i%specks.length];const s=kind==='dirt'?1+r()*2.5:1+r()*1.5;ctx.fillRect(r()*256,r()*256,s,kind==='dirt'?s:s*2.2)}
 // Field rows: furrows of plowed soil, standing wheat, and rows of young crops.
 if(kind==='plowed')for(let y=0;y<256;y+=16){ctx.fillStyle='#3f2c1d88';ctx.fillRect(0,y,256,5);ctx.fillStyle='#7d5d4440';ctx.fillRect(0,y+6,256,3)}
 if(kind==='wheat')for(let x=0;x<256;x+=6){ctx.fillStyle=x%12?'#e2c46a55':'#a9873a55';ctx.fillRect(x,0,3,256)}
 if(kind==='green')for(let y=0;y<256;y+=12){ctx.fillStyle='#5a8a3a99';ctx.fillRect(0,y,256,4);ctx.fillStyle='#8db25c55';ctx.fillRect(0,y+5,256,3)}
 if(kind==='forest')for(let i=0;i<90;i++){ctx.fillStyle=i%3?'#3a522f55':'#7b603c40';ctx.fillRect(r()*256,r()*256,6+r()*14,4+r()*9)}
 const tex=new THREE.CanvasTexture(c);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
 return tex;
}

// Trees between the camera and the player dissolve with a dither pattern instead of
// blocking the view. Works with instancing; the CPU only updates two vectors per frame.
export function createSightlineFade(){
 const uniforms={uFadeCamera:{value:new THREE.Vector3()},uFadeTarget:{value:new THREE.Vector3()},uFadeRadius:{value:1.9},uFadeEnabled:{value:1}};
 function apply(material){
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,uniforms);
   shader.vertexShader='varying vec3 vFadeWorld;\n'+shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
 vec4 fadeWorld=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 fadeWorld=instanceMatrix*fadeWorld;
 #endif
 vFadeWorld=(modelMatrix*fadeWorld).xyz;`);
   shader.fragmentShader=`varying vec3 vFadeWorld;
uniform vec3 uFadeCamera;uniform vec3 uFadeTarget;uniform float uFadeRadius;uniform float uFadeEnabled;
float fadeBayer(vec2 p){ivec2 i=ivec2(mod(p,4.0));int n=i.x+i.y*4;
 float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return (m[n]+.5)/16.;}
`+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 {vec3 seg=uFadeTarget-uFadeCamera;float t=clamp(dot(vFadeWorld-uFadeCamera,seg)/max(dot(seg,seg),1e-4),0.,1.);
  float d=distance(vFadeWorld,uFadeCamera+seg*t);
  float fade=(1.-smoothstep(uFadeRadius*.45,uFadeRadius,d))*step(.02,t)*(1.-smoothstep(.86,.97,t))*uFadeEnabled;
  if(fade*.88>fadeBayer(gl_FragCoord.xy))discard;}`);
  };
  material.customProgramCacheKey=()=>'city-sightline-fade';
  return material;
 }
 return {uniforms,apply,update(camera,target){uniforms.uFadeCamera.value.copy(camera.position);uniforms.uFadeTarget.value.copy(target)}};
}

// options.label(text,x,y,z,width,rot,bg,fg,height) draws a sign (game.js's label helper).
export function createWorld(scene,{label,cullRadius}={}){
 const layout=worldLayout(),colliders=createColliders(),fade=createSightlineFade();
 const group=new THREE.Group();group.name='world-zones';scene.add(group);


 // Ground: one base plane for the whole map, the farm's and forest's own ground over their zones, then dirt roads, field interiors, the river and the bridge.
 const textures={farm:groundTexture('farm'),forest:groundTexture('forest'),dirt:groundTexture('dirt'),field:groundTexture('field'),plowed:groundTexture('plowed'),wheat:groundTexture('wheat'),green:groundTexture('green')};
 function plane(x0,x1,z0,z1,y,material,name){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),material);mesh.rotation.x=-Math.PI/2;
  mesh.position.set((x0+x1)/2,y,(z0+z1)/2);mesh.receiveShadow=true;mesh.name=name;group.add(mesh);return mesh;
 }
 function textured(tex,w,h,scale,color='#ffffff'){const map=tex.clone();map.needsUpdate=true;map.repeat.set(w/scale,h/scale);return new THREE.MeshStandardMaterial({map,color,roughness:1})}
 const farmZone=zoneById('farm').bounds,forestZone=zoneById('forest').bounds;
 plane(GROUND.x0-700,GROUND.x1+700,GROUND.z0-700,GROUND.z1+700,-.077,new THREE.MeshStandardMaterial({color:'#8a9a7c',roughness:.95}),'ground-far'); // far beyond the fog, so the world never seems to end at the map's edge
 plane(GROUND.x0,GROUND.x1,GROUND.z0,GROUND.z1,-.075,new THREE.MeshStandardMaterial({color:'#8a9a7c',roughness:.95}),'ground-base');
 {const f={x0:farmZone.x0-14,x1:farmZone.x1,z0:farmZone.z0-14,z1:farmZone.z1+7};plane(f.x0,f.x1,f.z0,f.z1,-.074,textured(textures.farm,f.x1-f.x0,f.z1-f.z0,7),'ground-farm')}
 {const f={x0:forestZone.x0,x1:forestZone.x1+14,z0:forestZone.z0-14,z1:forestZone.z1+7};plane(f.x0,f.x1,f.z0,f.z1,-.074,textured(textures.forest,f.x1-f.x0,f.z1-f.z0,6),'ground-forest')}
 for(const r of DIRT_ROADS)plane(r.x0,r.x1,r.z0,r.z1,-.066,textured(textures.dirt,r.x1-r.x0,r.z1-r.z0,5),'dirt-road');
 // Fields: plowed soil, wheat and young crops, each its own ground, open to vehicles.
 for(const f of FIELDS)plane(f.x0,f.x1,f.z0,f.z1,-.069,textured(textures[f.surface],f.x1-f.x0,f.z1-f.z0,6),'field-'+f.id);

 // Every rural asphalt road (the County Road, Alder Center's streets, Oak Street East, Cedar Heights' loop, the Freight Road) is a ribbon along its centreline with a dashed
 // line down the middle. The city's own streets are built in game.js.
 const asphalt=new THREE.MeshStandardMaterial({color:'#585d60',roughness:.95}),lineMaterial=new THREE.MeshStandardMaterial({color:'#e8e2c8',roughness:.9}),upAxis=new THREE.Vector3(0,1,0);
 const densify=(points,max=6)=>{const out=[points[0]];for(let i=1;i<points.length;i++){const [ax,az]=points[i-1],[bx,bz]=points[i],k=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/max));for(let s=1;s<=k;s++)out.push([ax+(bx-ax)*s/k,az+(bz-az)*s/k])}return out};
 const toPath=points=>points.map((p,i)=>{const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)],l=Math.hypot(b[0]-a[0],b[1]-a[1])||1;return {x:p[0],z:p[1],tx:(b[0]-a[0])/l,tz:(b[1]-a[1])/l}});
 for(const edge of MAP.roads.edges){
  if(edge.surface!=='asphalt'||edge.level!=='rural')continue;
  const line=densify(roadCenterline(edge));ribbon(toPath(line),edge.width/2,-.045,asphalt,'road-'+edge.id);
  const dashes=[];let carried=0;for(let i=1;i<line.length;i++){const [ax,az]=line[i-1],[bx,bz]=line[i],len=Math.hypot(bx-ax,bz-az);let at=6-carried;while(at<=len){dashes.push({x:ax+(bx-ax)*at/len,z:az+(bz-az)*at/len,yaw:Math.atan2(bx-ax,bz-az)});at+=6}carried=len-(at-6)}
  if(!dashes.length)continue;
  const marks=new THREE.InstancedMesh(new THREE.BoxGeometry(.18,.02,2.2),lineMaterial,dashes.length),mat=new THREE.Matrix4(),at=new THREE.Vector3(),turn=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1);
  dashes.forEach((d,i)=>{const bridge=MAP.water.bridges.some(b=>d.x>=b.x0&&d.x<=b.x1&&d.z>b.z0&&d.z<b.z1);marks.setMatrixAt(i,mat.compose(at.set(d.x,bridge?-.005:-.032,d.z),turn.setFromAxisAngle(upAxis,d.yaw),one))});
  marks.name='road-line-'+edge.id;group.add(marks);
 }
 // The river: flat water between two muddy banks, outside every zone (a hard barrier). The bridge is the only way across.
 const water=new THREE.MeshStandardMaterial({color:'#4a86a6',roughness:.2,metalness:.1,transparent:true,opacity:.94,side:THREE.DoubleSide,depthWrite:false}),mud=new THREE.MeshStandardMaterial({color:'#7d7352',roughness:1,side:THREE.DoubleSide});

 function ribbon(path,half,y,material,name){
  const position=[],uv=[],index=[];let along=0;
  path.forEach((p,i)=>{if(i)along+=Math.hypot(p.x-path[i-1].x,p.z-path[i-1].z);
   position.push(p.x-p.tz*half,y,p.z+p.tx*half,p.x+p.tz*half,y,p.z-p.tx*half);uv.push(0,along/12,1,along/12);
   if(i){const a=(i-1)*2;index.push(a,a+2,a+1,a+1,a+2,a+3)}});
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(index);geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh;
 }
 for(const r of MAP.water.rivers){const path=riverPath(r,3);ribbon(path,r.width/2+r.bank,-.068,mud,'river-bank');ribbon(path,r.width/2,-.058,water,'river')}
 const stone=new THREE.MeshStandardMaterial({color:'#8b8f8c',roughness:1}),timber=new THREE.MeshStandardMaterial({color:'#6f5b43',roughness:1});
 for(const b of MAP.water.bridges){
  const len=b.z1-b.z0,cx=(b.x0+b.x1)/2,cz=(b.z0+b.z1)/2,width=b.x1-b.x0;
  const part=(w,h,d,x,y,z,material,name)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;group.add(mesh);return mesh};
  part(width,.3,len,cx,-.17,cz,asphalt,'bridge-deck'); // top at y = -0.02, level with the road
  for(const side of [-1,1]){ // low parapets along both sides, solid so nobody walks off the deck
   const x=cx+side*(width/2-.25);part(.5,.7,len,x,.33,cz,stone,'bridge-parapet');part(.62,.12,len,x,.72,cz,timber,'bridge-cap');colliders.box(x,cz,.25,len/2);
  }
  for(const dz of [-len*.22,len*.22])for(const side of [-1,1])part(.9,1.4,.9,cx+side*(width/2-.8),-.7,cz+dz,stone,'bridge-pier');
 }

 // Fences (instanced posts and rails, solid for walking).
 const segments=fenceSegments(),wood=new THREE.MeshStandardMaterial({color:'#8b6d4b',roughness:.95});
 const posts=new THREE.InstancedMesh(new THREE.BoxGeometry(.14,1.1,.14).translate(0,.55,0),wood,segments.length*2);
 const rails=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.09,.06),wood,segments.length*2);
 posts.castShadow=rails.castShadow=true;posts.name='fence-posts';rails.name='fence-rails';
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),v=new THREE.Vector3(),s=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0);
 segments.forEach((g,i)=>{
  const len=Math.hypot(g.x1-g.x0,g.z1-g.z0),angle=Math.atan2(g.z1-g.z0,g.x1-g.x0);
  posts.setMatrixAt(i*2,m4.makeTranslation(g.x0,0,g.z0));posts.setMatrixAt(i*2+1,m4.makeTranslation(g.x1,0,g.z1));
  q.setFromAxisAngle(yAxis,-angle);
  for(const [k,h] of [[0,.45],[1,.85]])rails.setMatrixAt(i*2+k,m4.compose(v.set((g.x0+g.x1)/2,h,(g.z0+g.z1)/2),q,s.set(len,1,1)));
  colliders.box((g.x0+g.x1)/2,(g.z0+g.z1)/2,Math.abs(g.x1-g.x0)/2+.07,Math.abs(g.z1-g.z0)/2+.07);
 });
 group.add(posts,rails);

 // ── Trees: the Quaternius models (nature.js). One InstancedMesh per model per material (bark and leaves): 16 draw calls for the whole forest.
 // Which trees are *in* those meshes changes as you move (see rebuild): only trees within the fog distance are drawn, scenery well behind the
 // camera is skipped and felled trees are not drawn at all, so the cost follows what is near you, not how many trees exist. Which model a tree
 // gets is a hash of its position (it does not use the layout's random numbers, so no tree has moved). Collisions never depend on what is drawn.
 const nature=createNatureMaterials(fade);
 const variantHash=(x,z)=>{const h=Math.sin(x*12.9898+z*78.233)*43758.5453;return h-Math.floor(h)};
 const pick=(list,x,z)=>list[Math.min(list.length-1,Math.floor(variantHash(x,z)*list.length))];
 const tints=['#ffffff','#f3f7e8','#e9f2da','#dfeccf'].map(c=>new THREE.Color(c));
 const viewDistance=cullRadius??MAP.scenery.view.distance,view2=viewDistance*viewDistance,useCone=Number.isFinite(viewDistance);
 const groups=[],cutMeshes=[]; // groups: {id, info, meshes:[bark, leaves], entries, dynamic}; cutMeshes: the meshes whose instances animate
 function treeGroup(id,count,name,dynamic){
  const info=modelInfo(id),leafMaterial=id.startsWith('pine')?nature.pineLeaves:nature.broadleafLeaves,capacity=Math.max(1,count);
  const bark=new THREE.InstancedMesh(modelGeometry(id,'bark'),nature.bark,capacity),leaves=new THREE.InstancedMesh(modelGeometry(id,'leaves'),leafMaterial,capacity);
  leaves.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);leaves.instanceColor.setUsage(THREE.DynamicDrawUsage);
  bark.name=`${name}-${id}-bark`;leaves.name=`${name}-${id}-leaves`;
  for(const mesh of [bark,leaves]){
   mesh.count=0;mesh.castShadow=dynamic; // scenery trees cast no shadow: that halves the shadow pass
   mesh.receiveShadow=true;mesh.frustumCulled=false; // the instances are culled by rebuild(), so the mesh's own bounds would be stale
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);if(dynamic)cutMeshes.push(mesh);group.add(mesh);
  }
  const g={id,info,meshes:[bark,leaves],entries:[],dynamic};groups.push(g);return g;
 }
 const addEntry=(g,t,tint)=>{m4.compose(v.set(t.x,0,t.z),q.setFromAxisAngle(yAxis,t.rot),s.setScalar(t.scale));const entry={x:t.x,z:t.z,matrix:Float32Array.from(m4.elements),tint,off:false,slot:-1};g.entries.push(entry);return entry};
 // Decor trees (never cuttable, solid trunks): pines on Pine Ridge's side, broadleaf everywhere else.
 const decorModels=layout.decor.map(t=>pick(forestSide(t.x,t.z)?PINES:BROADLEAVES,t.x,t.z));
 const decorGroups=new Map([...new Set(decorModels)].map(id=>[id,treeGroup(id,decorModels.filter(m=>m===id).length,'decor',false)]));
 layout.decor.forEach((t,i)=>{const g=decorGroups.get(decorModels[i]);addEntry(g,t,tints[t.tone]);colliders.circle(t.x,t.z,g.info.trunkRadius*t.scale*.85)});

 // Cuttable trees: pines on cell centres, plus hidden stumps.
 const n=layout.cuttable.length,cutModels=layout.cuttable.map(t=>pick(PINES,t.x,t.z));
 const cutGroups=new Map(PINES.map(id=>[id,treeGroup(id,cutModels.filter(m=>m===id).length,'pine',true)]));
 const stumps=new THREE.InstancedMesh(new THREE.CylinderGeometry(.21,.26,.34,8).translate(0,.17,0),new THREE.MeshStandardMaterial({map:nature.logBark,color:'#d8b88c',roughness:1}),n);
 stumps.name='pine-stumps';stumps.castShadow=stumps.receiveShadow=true;stumps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(stumps);
 const hidden=new THREE.Matrix4().makeScale(0,0,0);
 const trees=new Map();
 const tilt=new THREE.Quaternion(),yaw=new THREE.Quaternion(),axis=new THREE.Vector3();
 layout.cuttable.forEach((t,i)=>{
  const g=cutGroups.get(cutModels[i]),entry=addEntry(g,t,tints[i%4]);
  const state={...t,index:i,model:g.id,meshes:g.meshes,entry,get slot(){return entry.slot},standing:true,stage:'mature',collider:colliders.circle(t.x,t.z,g.info.trunkRadius*t.scale+.04,t.key),anim:null};
  trees.set(t.key,state);poseTree(state);stumps.setMatrixAt(i,hidden);
 });
 // Which trees are in the meshes: those within the view distance of the player; trees farther than 30 m (choppable pines: 70 m) also have to be in front
 // of the camera (within about 110 degrees of where it looks). Felled trees (off) are not drawn. Rebuilt when you move 3 m, turn about 14 degrees or a tree changes.
 const view={x:0,z:0,fx:0,fz:-1,ready:false},dir=new THREE.Vector3();let dirty=true;
 function rebuild(){
  for(const g of groups){
   const [bark,leaves]=g.meshes,bm=bark.instanceMatrix.array,lm=leaves.instanceMatrix.array,lc=leaves.instanceColor.array;let k=0;
   for(const e of g.entries){
    e.slot=-1;if(e.off)continue;
    const dx=e.x-view.x,dz=e.z-view.z,d2=dx*dx+dz*dz;if(d2>view2)continue;
    if(useCone&&d2>(g.dynamic?4900:900)&&dx*view.fx+dz*view.fz<-.35*Math.sqrt(d2))continue; // far behind the camera (scenery after 30 m, choppable pines after 70 m: their shadows only matter near you)
    bm.set(e.matrix,k*16);lm.set(e.matrix,k*16);lc[k*3]=e.tint.r;lc[k*3+1]=e.tint.g;lc[k*3+2]=e.tint.b;e.slot=k++;
   }
   bark.count=leaves.count=k;bark.instanceMatrix.needsUpdate=leaves.instanceMatrix.needsUpdate=leaves.instanceColor.needsUpdate=true;
  }
  dirty=false;
 }
 function refreshView(camera,target){
  camera.getWorldDirection(dir);const l=Math.hypot(dir.x,dir.z)||1,fx=dir.x/l,fz=dir.z/l;
  if(!view.ready||dirty||Math.hypot(target.x-view.x,target.z-view.z)>3||fx*view.fx+fz*view.fz<.97){view.x=target.x;view.z=target.z;view.fx=fx;view.fz=fz;view.ready=true;rebuild()}
 }
 // Writes one pine's transforms. fall = 0..1 tips it over; shake wobbles it.
 function poseTree(t,{fall=0,shake=0,dirX=0,dirZ=1,shrink=1}={}){
  yaw.setFromAxisAngle(yAxis,t.rot);
  axis.set(dirZ,0,-dirX).normalize();
  tilt.setFromAxisAngle(axis.lengthSq()?axis:v.set(1,0,0),fall*Math.PI*.47+shake);
  m4.compose(v.set(t.x,0,t.z),tilt.multiply(yaw),s.setScalar(t.scale*shrink));
  t.entry.matrix.set(m4.elements);if(t.entry.slot>=0)for(const mesh of t.meshes)mesh.setMatrixAt(t.entry.slot,m4);
 }
 function hideTree(t){t.entry.off=true;dirty=true; // a felled tree leaves the draw lists altogether
  stumps.setMatrixAt(t.index,m4.compose(v.set(t.x,0,t.z),yaw.setFromAxisAngle(yAxis,t.rot),s.set(t.scale,1,t.scale)))}
 function touch(){if(dirty)rebuild();for(const mesh of cutMeshes)mesh.instanceMatrix.needsUpdate=true;stumps.instanceMatrix.needsUpdate=true}
 rebuild();

 // ── Landmarks (the farmyard, the sawmill) placed from the map, solid where their walls are, and the fork's signpost ──────────────────────────────────
 const landmarks=MAP.landmarks.map(l=>{
  const info=propInfo(l.prop),mesh=createProp(l.prop,fade);mesh.position.set(l.x,0,l.z);mesh.rotation.y=l.yaw;group.add(mesh);
  const cos=Math.round(Math.cos(l.yaw)),sin=Math.round(Math.sin(l.yaw)),turned=sin!==0;
  for(const b of info.colliders)colliders.box(l.x+b.x*cos+b.z*sin,l.z-b.x*sin+b.z*cos,turned?b.hz:b.hx,turned?b.hx:b.hz);
  return {id:l.id,mesh,x:l.x,z:l.z,yaw:l.yaw,floor:info.floor||null,radius:Math.hypot(info.width,info.depth)/2};
 });
 for(const sign of MAP.signs){
  const post=new THREE.Mesh(new THREE.BoxGeometry(.18,3.4,.18),timber);post.position.set(sign.x,1.7,sign.z);post.castShadow=true;post.name='sign-post';group.add(post);colliders.circle(sign.x,sign.z,.16);
  if(label)for(const board of sign.boards)label(board.text,sign.x,board.y,sign.z+.12,4.4,sign.yaw,'#3a2f22','#f1ebd9',.62);
 }
 // Driveways and front paths: flat concrete and paving just above the grass and just under the road they join.
 {const concrete=new THREE.MeshStandardMaterial({color:'#8f9396',roughness:.95}),paving=new THREE.MeshStandardMaterial({color:'#b9b3a4',roughness:.9});
  for(const plot of MAP.reserved){if(plot.driveway)plane(plot.driveway.x0,plot.driveway.x1,plot.driveway.z0,plot.driveway.z1,-.05,concrete,'driveway-'+plot.id);if(plot.path)plane(plot.path.x0,plot.path.x1,plot.path.z0,plot.path.z1,-.049,paving,'path-'+plot.id)}}
 // Street lamps (instanced poles and heads, solid) and the town square's benches.
 {const spots=lampSpots(),metal=new THREE.MeshStandardMaterial({color:'#3b4247',roughness:.7,metalness:.3}),glow=new THREE.MeshStandardMaterial({color:'#f4ecd2',emissive:'#ffe9a8',emissiveIntensity:.55,roughness:.5});
  const poles=new THREE.InstancedMesh(new THREE.CylinderGeometry(.07,.1,4.6,8),metal,spots.length),heads=new THREE.InstancedMesh(new THREE.BoxGeometry(.75,.14,.3),glow,spots.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1),at=new THREE.Vector3();
  spots.forEach((s,i)=>{poles.setMatrixAt(i,m.compose(at.set(s.x,2.3,s.z),q.identity(),one));q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(s.dx,s.dz)+Math.PI/2);heads.setMatrixAt(i,m.compose(at.set(s.x+s.dx*.35,4.6,s.z+s.dz*.35),q,one));colliders.circle(s.x,s.z,.22)});
  poles.name='street-lamp-poles';heads.name='street-lamp-heads';poles.castShadow=true;group.add(poles,heads);
  const wood=new THREE.MeshStandardMaterial({color:'#8a6a47',roughness:.9}),frame=new THREE.MeshStandardMaterial({color:'#3b4247',roughness:.7});
  for(const b of BENCHES){const bench=new THREE.Group();bench.name='bench';const seat=new THREE.Mesh(new THREE.BoxGeometry(1.7,.08,.5),wood);seat.position.y=.46;const back=new THREE.Mesh(new THREE.BoxGeometry(1.7,.45,.06),wood);back.position.set(0,.75,-.22);
   for(const sx of [-.75,.75]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.06,.46,.46),frame);leg.position.set(sx,.23,0);bench.add(leg)}bench.add(seat,back);bench.position.set(b.x,0,b.z);bench.rotation.y=b.yaw;bench.traverse(o=>{o.castShadow=true});group.add(bench);
   const c=Math.round(Math.cos(b.yaw)),s=Math.round(Math.sin(b.yaw));colliders.box(b.x,b.z,Math.abs(c)*.85+Math.abs(s)*.3,Math.abs(c)*.3+Math.abs(s)*.85)}}
 // The edge of the world: a ring of low hills far beyond the fog (they ignore it), so the map ends at a horizon, not at nothing.
 {const fogColor=new THREE.Color(scene.fog?scene.fog.color:'#b9cbd0'),top=fogColor.clone().lerp(new THREE.Color('#5f7686'),.5),mid=fogColor.clone().lerp(new THREE.Color('#5f7686'),.28),N=96,cx=20,cz=-140,pos=[],col=[],idx=[];
  const h=a=>.5+.5*Math.sin(a*3+1.3)*Math.cos(a*5+.4)+.25*Math.sin(a*11+2.1);
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2,r=520+Math.sin(a*4)*30,ridge=18+Math.max(0,h(a))*52;for(const [rr,y,c] of [[r+60,-12,fogColor],[r,ridge*.45,mid],[r-35,ridge,top]]){pos.push(cx+Math.cos(a)*rr,y,cz+Math.sin(a)*rr);col.push(c.r,c.g,c.b)}}
  for(let i=0;i<N;i++){const j=(i+1)%N;for(let k=0;k<2;k++){const a=i*3+k,b=i*3+k+1,c=j*3+k,d=j*3+k+1;idx.push(a,c,b,b,c,d)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);
  const hills=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false,side:THREE.DoubleSide,depthWrite:false}));hills.name='distant-hills';hills.renderOrder=-1;hills.frustumCulled=false;group.add(hills)}
 // ── Reserved plots (O): a tinted patch, an outline and the plot's id on the ground, hidden until switched on ─────────────────────────────────────────
 const plotColour={residential:'#2fbf9f',commercial:'#b0529b',industrial:'#e0a02e'},plotOverlay=new THREE.Group();plotOverlay.name='plot-overlay';plotOverlay.visible=false;group.add(plotOverlay);
 for(const plot of MAP.reserved){
  const w=plot.x1-plot.x0,d=plot.z1-plot.z0,cx=(plot.x0+plot.x1)/2,cz=(plot.z0+plot.z1)/2,color=plotColour[plot.kind];
  const fill=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.24,depthWrite:false}));fill.rotation.x=-Math.PI/2;fill.position.set(cx,.06,cz);plotOverlay.add(fill);
  const outline=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[plot.x0,plot.z0],[plot.x1,plot.z0],[plot.x1,plot.z1],[plot.x0,plot.z1]].map(([x,z])=>new THREE.Vector3(x,.08,z))),new THREE.LineBasicMaterial({color}));plotOverlay.add(outline);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,256,128);ctx.fillStyle='#ffffffee';ctx.font='bold 84px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(plot.id,128,66);
  const tag=new THREE.Mesh(new THREE.PlaneGeometry(5,2.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false}));tag.rotation.x=-Math.PI/2;tag.position.set(cx,.09,cz);plotOverlay.add(tag);
 }
 // Faint grid overlay around the player, plus a brighter outline on the targeted cell.
 const RADIUS=11,maxSegments=(RADIUS*2+2)*(RADIUS*2+2)*2;
 const gridGeometry=new THREE.BufferGeometry();
 gridGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(maxSegments*6),3).setUsage(THREE.DynamicDrawUsage));
 gridGeometry.setAttribute('color',new THREE.BufferAttribute(new Float32Array(maxSegments*8),4).setUsage(THREE.DynamicDrawUsage));
 const gridLines=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthWrite:false}));
 gridLines.name='plot-grid';gridLines.frustumCulled=false;gridLines.visible=false;gridLines.renderOrder=2;group.add(gridLines);
 const cursor=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(1,0,0),new THREE.Vector3(1,0,1),new THREE.Vector3(0,0,1)]),
  new THREE.LineBasicMaterial({color:'#fff6c8',transparent:true,opacity:.75,depthWrite:false}));
 cursor.name='plot-cursor';cursor.visible=false;cursor.renderOrder=3;group.add(cursor);
 let gridCell=null;
 function rebuildGrid(cx,cz){
  const pos=gridGeometry.attributes.position.array,col=gridGeometry.attributes.color.array;let k=0;
  const y=-.045;
  const push=(x0,z0,x1,z1)=>{const mid=Math.hypot((x0+x1)/2-cx-.5,(z0+z1)/2-cz-.5),a=Math.max(0,1-mid/RADIUS)**1.4*.32;if(a<=.01)return;
   pos.set([x0,y,z0,x1,y,z1],k*6);col.set([.96,.95,.82,a,.96,.95,.82,a],k*8);k++};
  for(let ix=cx-RADIUS;ix<=cx+RADIUS;ix++)for(let iz=cz-RADIUS;iz<=cz+RADIUS;iz++){
   if(!gridZoneAt(ix,iz))continue;
   push(ix,iz,ix+1,iz);push(ix,iz,ix,iz+1);
   if(!gridZoneAt(ix+1,iz)||ix===cx+RADIUS)push(ix+1,iz,ix+1,iz+1);
   if(!gridZoneAt(ix,iz+1)||iz===cz+RADIUS)push(ix,iz+1,ix+1,iz+1);
  }
  gridGeometry.setDrawRange(0,k*2);gridGeometry.attributes.position.needsUpdate=true;gridGeometry.attributes.color.needsUpdate=true;
 }

 // Target ring and ground logs.
 const ring=new THREE.Mesh(new THREE.RingGeometry(.62,.76,40),new THREE.MeshBasicMaterial({color:'#fff6c8',transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide}));
 ring.rotation.x=-Math.PI/2;ring.visible=false;ring.renderOrder=4;ring.name='tree-target';group.add(ring);
 const MAX_LOG_INSTANCES=96;
 const logMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.12,1.15,8).rotateZ(Math.PI/2),new THREE.MeshStandardMaterial({map:nature.logBark,color:'#d2b080',roughness:1}),MAX_LOG_INSTANCES);
 logMesh.count=0;logMesh.castShadow=logMesh.receiveShadow=true;logMesh.frustumCulled=false;logMesh.name='ground-logs';group.add(logMesh);
 let clock=0;
 return {
  group,layout,trees,fade,
  blocked:(x,z)=>colliders.blocked(x,z),
  // The height of a deck or platform under the point (a building's raised floor), or null on open ground.
  floorAt(x,z){for(const l of landmarks){if(!l.floor)continue;const cos=Math.round(Math.cos(l.yaw)),sin=Math.round(Math.sin(l.yaw)),dx=x-l.x,dz=z-l.z,lx=dx*cos-dz*sin,lz=dx*sin+dz*cos,f=l.floor;if(lx>=f.x0&&lx<=f.x1&&lz>=f.z0&&lz<=f.z1)return f.y}return null},
  // What is drawn: trees in the draw lists and the triangles they cost (for tests and the debug hook). setViewer places the view without a camera.
  cullStats(){let drawn=0,total=0,triangles=0,all=0;for(const g of groups){const per=g.info.triangles;for(const e of g.entries){if(!e.off)total++;if(e.slot>=0)drawn++}triangles+=g.meshes[0].count*per;all+=g.entries.filter(e=>!e.off).length*per}return {radius:viewDistance,drawn,total,triangles,allTriangles:all}},
  setPlotOverlay(on){plotOverlay.visible=!!on},plotOverlayVisible(){return plotOverlay.visible},
  setViewer(x,z,fx=0,fz=-1){view.x=x;view.z=z;view.fx=fx;view.fz=fz;view.ready=true;rebuild()},
  // Standing cuttable trees within range of a point.
  cuttableNear(x,z,range=2.2){const out=[];for(const t of trees.values())if(t.standing&&Math.abs(t.x-x)<=range&&Math.abs(t.z-z)<=range&&Math.hypot(t.x-x,t.z-z)<=range)out.push(t);return out},
  // Instantly reflect a saved felled tree (no animation): a stump.
  setFelled(key){const t=trees.get(key);if(!t||!t.standing)return false;t.standing=false;t.stage='stump';t.collider.active=false;t.anim=null;hideTree(t);touch();return true},
  // A felled tree growing back: 'stump' (nothing but the stump), 'sapling' (a small pine, still not choppable).
  setStage(key,stage){
   const t=trees.get(key);if(!t||t.standing||t.anim||t.stage===stage)return false;
   t.stage=stage;
   if(stage==='sapling'){t.entry.off=false;dirty=true;stumps.setMatrixAt(t.index,hidden);poseTree(t,{shrink:.3});stumps.setMatrixAt(t.index,m4.compose(v.set(t.x,0,t.z),yaw.setFromAxisAngle(yAxis,t.rot),s.set(t.scale*.8,.5,t.scale*.8)))}
   else hideTree(t);
   touch();return true;
  },
  // A fully regrown tree: standing, solid and choppable again.
  setRegrown(key){const t=trees.get(key);if(!t||t.standing)return false;t.standing=true;t.stage='mature';t.collider.active=true;t.anim=null;t.entry.off=false;dirty=true;stumps.setMatrixAt(t.index,hidden);poseTree(t);touch();return true},
  // Visual feedback only; rules live in grid.js.
  hitTree(key,from){const t=trees.get(key);if(!t?.standing)return;const d=Math.hypot(t.x-from.x,t.z-from.z)||1;t.anim={type:'shake',time:0,dirX:(t.x-from.x)/d,dirZ:(t.z-from.z)/d}},
  // onDone runs once the trunk has finished falling (that is when the logs appear).
  fellTree(key,from,onDone){const t=trees.get(key);if(!t?.standing)return;const d=Math.hypot(t.x-from.x,t.z-from.z)||1;
   t.standing=false;t.stage='stump';t.collider.active=false;t.anim={type:'fall',time:0,dirX:(t.x-from.x)/d,dirZ:(t.z-from.z)/d,onDone}},
  // A ring on the ground under the tree the player is about to chop (null hides it).
  setTarget(tree){if(!tree){ring.visible=false;return}ring.visible=true;ring.position.set(tree.x,-.03,tree.z)},
  // Logs lying on the ground: [{x,z,rot}], drawn as instances.
  setLogs(list){
   const n=Math.min(list.length,MAX_LOG_INSTANCES);
   for(let i=0;i<n;i++)logMesh.setMatrixAt(i,m4.compose(v.set(list[i].x,.12,list[i].z),q.setFromAxisAngle(yAxis,list[i].rot),s.set(1,1,1)));
   logMesh.count=n;logMesh.instanceMatrix.needsUpdate=true;
  },
  // Grid overlay: show only in farm/forest. Returns the targeted cell (or null).
  updateGrid(position,heading,show){
   if(!show){gridLines.visible=cursor.visible=false;gridCell=null;return null}
   const c=cellOf(position.x,position.z);
   if(!gridCell||gridCell.ix!==c.ix||gridCell.iz!==c.iz){gridCell=c;rebuildGrid(c.ix,c.iz)}
   gridLines.visible=true;
   const t=cellOf(position.x+Math.sin(heading)*1.1,position.z+Math.cos(heading)*1.1),zone=gridZoneAt(t.ix,t.iz);
   cursor.visible=!!zone;if(zone)cursor.position.set(t.ix,-.04,t.iz);
   return zone?{...t,key:cellKey(t.ix,t.iz),zone}:null;
  },
  update(dt,camera,fadeTarget){
   fade.update(camera,fadeTarget);refreshView(camera,fadeTarget);
   for(const l of landmarks)l.mesh.visible=Math.hypot(fadeTarget.x-l.x,fadeTarget.z-l.z)<viewDistance+l.radius; // far buildings are not drawn
   clock+=dt;if(ring.visible)ring.scale.setScalar(1+.07*Math.sin(clock*6));
   let changed=false;
   for(const t of trees.values()){
    if(!t.anim)continue;changed=true;const a=t.anim;a.time+=dt;
    if(a.type==='shake'){const k=Math.max(0,1-a.time/.4);poseTree(t,{shake:Math.sin(a.time*38)*.07*k,dirX:a.dirX,dirZ:a.dirZ});if(k===0)t.anim=null}
    else{const fall=Math.min(1,a.time/1.1),eased=fall*fall;
     poseTree(t,{fall:eased,dirX:a.dirX,dirZ:a.dirZ,shrink:a.time<1.25?1:Math.max(.001,1-(a.time-1.25)/.35)});
     if(a.time>=1.6){t.anim=null;hideTree(t);a.onDone?.()}}
   }
   if(changed)touch();
  }
 };
}
