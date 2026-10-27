import * as THREE from './vendor/three.module.js';

// ─── Layout (pure data, safe to import from rules and tests) ──────────────────
// The city keeps its original footprint. Oak Farms lies west of it, Alder Woods east.
// +x is east and -z is north (the default camera looks north up Oak Street).

// Changing the seed moves every generated tree, which orphans saved forest plots.
export const WORLD_SEED=7301;
export const ZONES=Object.freeze({
 city:Object.freeze({id:'city',name:'Westside',label:'WESTSIDE',subtitle:'Oak & Alder',color:'#8d9294'}),
 farm:Object.freeze({id:'farm',name:'Oak Farms',label:'OAK FARMS',subtitle:'Fields & plots',color:'#c9ae63'}),
 forest:Object.freeze({id:'forest',name:'Alder Woods',label:'ALDER WOODS',subtitle:'Timber & trails',color:'#3f6a3c'})
});
// Zone seams sit on the old city edge, so every existing city coordinate stays in the city.
export const CITY_WEST=-61,CITY_EAST=58;
export const WALKABLE=Object.freeze([
 Object.freeze({zone:'city',x0:CITY_WEST,x1:CITY_EAST,z0:-48,z1:48}),
 Object.freeze({zone:'farm',x0:-168,x1:CITY_WEST,z0:-56,z1:56}),
 Object.freeze({zone:'forest',x0:CITY_EAST,x1:168,z0:-56,z1:56})
]);
// Visual extent of the ground (beyond the walkable area, scenery fades into fog).
export const GROUND=Object.freeze({x0:-190,x1:190,z0:-90,z1:90});

export function zoneAt(x){return x<CITY_WEST?ZONES.farm:x>CITY_EAST?ZONES.forest:ZONES.city}
export function isWalkable(x,z){return WALKABLE.some(r=>x>=r.x0&&x<=r.x1&&z>=r.z0&&z<=r.z1)}

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
 const r=WALKABLE.find(r=>r.zone!=='city'&&ix>=r.x0&&ix+1<=r.x1&&iz>=r.z0&&iz+1<=r.z1);
 return r?r.zone:null;
}

// Dirt roads continue Oak Street into both zones, plus one north–south lane in each.
export const DIRT_ROADS=Object.freeze([
 {zone:'farm',x0:-168,x1:-55,z0:2.5,z1:9.5},
 {zone:'farm',x0:-112,x1:-108,z0:-56,z1:56},
 {zone:'forest',x0:55,x1:168,z0:2.5,z1:9.5},
 {zone:'forest',x0:111,x1:116,z0:-56,z1:56}
].map(Object.freeze));
const distanceToRect=(x,z,r)=>Math.hypot(Math.max(r.x0-x,0,x-r.x1),Math.max(r.z0-z,0,z-r.z1));
export const nearDirtRoad=(x,z,margin=0)=>DIRT_ROADS.some(r=>distanceToRect(x,z,r)<=margin);

// Fenced farm plots, in whole cells, each with a 3-cell gate facing the main farm road.
export const FIELDS=Object.freeze([[-156,-138],[-132,-114],[-104,-86],[-82,-66]].flatMap(([x0,x1])=>
 [[-15,-2],[12,25]].map(([z0,z1],i)=>Object.freeze({id:`field-${x0}-${z0}`,x0,x1,z0,z1,gateSide:i===0?'south-of-road':'north-of-road'}))));
export const fieldAt=(ix,iz)=>FIELDS.find(f=>ix>=f.x0&&ix<f.x1&&iz>=f.z0&&iz<f.z1)||null;
export function fenceSegments(){
 const segments=[];
 const run=(x0,x1,z)=>{for(let x=x0;x<x1;x+=2)segments.push({x0:x,z0:z,x1:Math.min(x+2,x1),z1:z})};
 for(const f of FIELDS){
  // A 3-cell gate gap, cell-aligned, in the middle of the side facing the farm road.
  const gateZ=f.gateSide==='south-of-road'?f.z1:f.z0,gate0=Math.floor((f.x0+f.x1)/2)-1,gate1=gate0+3;
  for(const z of [f.z0,f.z1]){if(z===gateZ){run(f.x0,gate0,z);run(gate1,f.x1,z)}else run(f.x0,f.x1,z)}
  for(const x of [f.x0,f.x1])for(let z=f.z0;z<f.z1;z+=2)segments.push({x0:x,z0:z,x1:x,z1:Math.min(z+2,f.z1)});
 }
 return segments;
}

// Deterministic per-block random numbers: the same block always makes the same trees.
function random(seed){return ()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const blockSeed=(a,b,salt)=>(Math.imul(a,73856093)^Math.imul(b,19349663)^Math.imul(salt,83492791))|0;

let cachedLayout=null;
// Generates every tree once. Cuttable trees sit on cell centres and are keyed by cell.
export function worldLayout(){
 if(cachedLayout)return cachedLayout;
 const cuttable=[],decor=[];
 const forest=WALKABLE[2],farm=WALKABLE[1];
 // Alder Woods interior: 4×4-cell blocks, at most one cuttable pine per block (no touching trunks).
 for(let bx=Math.ceil((forest.x0+2)/4);bx*4+4<=forest.x1-1;bx++)for(let bz=Math.ceil((forest.z0+1)/4);bz*4+4<=forest.z1-1;bz++){
  const r=random(blockSeed(bx,bz,WORLD_SEED));
  const density=.62+.22*Math.sin(bx*.71)*Math.cos(bz*.93);
  const ix=bx*4+1+Math.floor(r()*2),iz=bz*4+1+Math.floor(r()*2),c=cellCenter(ix,iz);
  const clearing=c.x<66||nearDirtRoad(c.x,c.z,2.2);
  if(!clearing&&r()<density){cuttable.push(Object.freeze({key:cellKey(ix,iz),ix,iz,x:c.x,z:c.z,kind:'pine',scale:.85+r()*.35,rot:r()*Math.PI*2}));continue}
  // Blocks without a pine sometimes get a broadleaf decor tree between cell centres.
  const x=bx*4+.5+r()*3,z=bz*4+.5+r()*3;
  if(!clearing&&!nearDirtRoad(x,z,2.4)&&r()<.38)decor.push({x,z,scale:.8+r()*.45,rot:r()*Math.PI*2,tone:Math.floor(r()*4)});
 }
 // Dense scenery belts outside the walkable edges hide the end of the world.
 const belt=(x0,x1,z0,z1,spacing,chance,salt)=>{for(let x=x0;x<x1;x+=spacing)for(let z=z0;z<z1;z+=spacing){
  const r=random(blockSeed(Math.round(x*10),Math.round(z*10),salt));if(r()>chance)continue;
  const tx=x+r()*spacing*.8,tz=z+r()*spacing*.8;if(isWalkable(tx,tz)||nearDirtRoad(tx,tz,1.5))continue;
  decor.push({x:tx,z:tz,scale:.9+r()*.5,rot:r()*Math.PI*2,tone:Math.floor(r()*4)})}};
 belt(forest.x0,186,forest.z1+1.5,80,3.2,.85,11);belt(forest.x0,186,-80,forest.z0-1.5,3.2,.85,12);belt(forest.x1+1.5,186,-56,57,3.2,.9,13);
 belt(-186,farm.x1,farm.z1+2.5,74,4.2,.75,21);belt(-186,farm.x1,-74,farm.z0-2.5,4.2,.75,22);belt(-186,farm.x0-2,-56,57,4,.8,23);
 // A few shade trees between the farm fields.
 for(let i=0;i<34;i++){const r=random(blockSeed(i,7,WORLD_SEED+1)),x=farm.x0+4+r()*(farm.x1-farm.x0-10),z=farm.z0+3+r()*(farm.z1-farm.z0-6),c=cellOf(x,z);
  if(nearDirtRoad(x,z,2.5)||FIELDS.some(f=>x>f.x0-2&&x<f.x1+2&&z>f.z0-2&&z<f.z1+2)||x>CITY_WEST-5)continue;
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
 const base={farm:'#7d9a52',forest:'#4b663c',dirt:'#8a7152',field:'#86a057'}[kind];
 ctx.fillStyle=base;ctx.fillRect(0,0,256,256);
 const specks=kind==='dirt'?['#00000014','#ffffff12','#5f4a3322']:kind==='forest'?['#00000016','#6d7d3a22','#7a5c3a24','#ffffff08']:['#00000010','#ffffff10','#9fb86522'];
 for(let i=0;i<7000;i++){ctx.fillStyle=specks[i%specks.length];const s=kind==='dirt'?1+r()*2.5:1+r()*1.5;ctx.fillRect(r()*256,r()*256,s,kind==='dirt'?s:s*2.2)}
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
export function createWorld(scene,{label}={}){
 const layout=worldLayout(),colliders=createColliders(),fade=createSightlineFade();
 const group=new THREE.Group();group.name='world-zones';scene.add(group);

 // Ground: one plane per zone, each with its own material.
 const textures={farm:groundTexture('farm'),forest:groundTexture('forest'),dirt:groundTexture('dirt'),field:groundTexture('field')};
 function plane(x0,x1,z0,z1,y,material,name){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0),material);mesh.rotation.x=-Math.PI/2;
  mesh.position.set((x0+x1)/2,y,(z0+z1)/2);mesh.receiveShadow=true;mesh.name=name;group.add(mesh);return mesh;
 }
 function textured(tex,w,h,scale,color='#ffffff'){const map=tex.clone();map.needsUpdate=true;map.repeat.set(w/scale,h/scale);return new THREE.MeshStandardMaterial({map,color,roughness:1})}
 const gw=GROUND.z1-GROUND.z0;
 plane(CITY_WEST,CITY_EAST,GROUND.z0,GROUND.z1,-.075,new THREE.MeshStandardMaterial({color:'#8a9a7c',roughness:.95}),'ground-city');
 plane(GROUND.x0,CITY_WEST,GROUND.z0,GROUND.z1,-.075,textured(textures.farm,CITY_WEST-GROUND.x0,gw,7),'ground-farm');
 plane(CITY_EAST,GROUND.x1,GROUND.z0,GROUND.z1,-.075,textured(textures.forest,GROUND.x1-CITY_EAST,gw,6),'ground-forest');
 for(const r of DIRT_ROADS)plane(r.x0,r.x1,r.z0,r.z1,-.066,textured(textures.dirt,r.x1-r.x0,r.z1-r.z0,5),'dirt-road');
 // Field interiors: a slightly richer grass so the plots read from a distance.
 for(const f of FIELDS)plane(f.x0,f.x1,f.z0,f.z1,-.069,textured(textures.field,f.x1-f.x0,f.z1-f.z0,6),'field-'+f.id);

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

 // Decor trees: broadleaf, instanced, solid trunks, never cuttable.
 const canopyGeometry=new THREE.IcosahedronGeometry(1.35,1);
 {const p=canopyGeometry.attributes.position;for(let j=0;j<p.count;j++){const x=p.getX(j),y=p.getY(j),z=p.getZ(j),f=1+.13*Math.sin(x*4+z*3);p.setXYZ(j,x*f,y*1.1*(1+.07*Math.cos(z*5)),z*f)}canopyGeometry.computeVertexNormals();canopyGeometry.translate(0,4.7,0)}
 const decorTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.16,.24,3.9,6).translate(0,1.95,0),fade.apply(new THREE.MeshStandardMaterial({color:'#6f5f4c',roughness:1})),layout.decor.length);
 const decorCanopies=new THREE.InstancedMesh(canopyGeometry,fade.apply(new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.95})),layout.decor.length);
 const tones=['#617e58','#6d8559','#58774e','#4c6a43'].map(c=>new THREE.Color(c));
 layout.decor.forEach((t,i)=>{
  m4.compose(v.set(t.x,0,t.z),q.setFromAxisAngle(yAxis,t.rot),s.setScalar(t.scale));
  decorTrunks.setMatrixAt(i,m4);decorCanopies.setMatrixAt(i,m4);decorCanopies.setColorAt(i,tones[t.tone]);
  colliders.circle(t.x,t.z,.24*t.scale);
 });
 decorTrunks.castShadow=decorCanopies.castShadow=true;decorTrunks.name='decor-tree-trunks';decorCanopies.name='decor-tree-canopies';
 group.add(decorTrunks,decorCanopies);

 // Cuttable trees: pines on cell centres (two cone tiers + trunk), plus hidden stumps.
 const n=layout.cuttable.length;
 const pineTrunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.13,.21,2.7,7).translate(0,1.35,0),fade.apply(new THREE.MeshStandardMaterial({color:'#6a523b',roughness:1})),n);
 const pineMaterial=fade.apply(new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9,flatShading:true}));
 const pineLow=new THREE.InstancedMesh(new THREE.ConeGeometry(1.3,2.7,8).translate(0,3,0),pineMaterial,n);
 const pineTop=new THREE.InstancedMesh(new THREE.ConeGeometry(.9,2.1,8).translate(0,4.45,0),pineMaterial,n);
 const stumps=new THREE.InstancedMesh(new THREE.CylinderGeometry(.21,.26,.34,8).translate(0,.17,0),new THREE.MeshStandardMaterial({color:'#7b6247',roughness:1}),n);
 pineTrunks.name='pine-trunks';pineLow.name='pine-canopy-low';pineTop.name='pine-canopy-top';stumps.name='pine-stumps';
 for(const m of [pineTrunks,pineLow,pineTop,stumps]){m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(m)}
 const pineTones=['#3b6a45','#467550','#355f3e'].map(c=>new THREE.Color(c));
 const hidden=new THREE.Matrix4().makeScale(0,0,0);
 const trees=new Map();
 const tilt=new THREE.Quaternion(),yaw=new THREE.Quaternion(),axis=new THREE.Vector3();
 layout.cuttable.forEach((t,i)=>{
  const tone=pineTones[i%3];pineLow.setColorAt(i,tone);pineTop.setColorAt(i,tone);
  const state={...t,index:i,standing:true,stage:'mature',collider:colliders.circle(t.x,t.z,.21*t.scale+.04,t.key),anim:null};
  trees.set(t.key,state);poseTree(state);stumps.setMatrixAt(i,hidden);
 });
 // Writes one pine's transforms. fall = 0..1 tips it over; shake wobbles it.
 function poseTree(t,{fall=0,shake=0,dirX=0,dirZ=1,shrink=1}={}){
  yaw.setFromAxisAngle(yAxis,t.rot);
  axis.set(dirZ,0,-dirX).normalize();
  tilt.setFromAxisAngle(axis.lengthSq()?axis:v.set(1,0,0),fall*Math.PI*.47+shake);
  m4.compose(v.set(t.x,0,t.z),tilt.multiply(yaw),s.setScalar(t.scale*shrink));
  pineTrunks.setMatrixAt(t.index,m4);pineLow.setMatrixAt(t.index,m4);pineTop.setMatrixAt(t.index,m4);
 }
 function hideTree(t){for(const m of [pineTrunks,pineLow,pineTop])m.setMatrixAt(t.index,hidden);
  stumps.setMatrixAt(t.index,m4.compose(v.set(t.x,0,t.z),yaw.setFromAxisAngle(yAxis,t.rot),s.set(t.scale,1,t.scale)))}
 function touch(){for(const m of [pineTrunks,pineLow,pineTop,stumps])m.instanceMatrix.needsUpdate=true}

 // Zone entrance signs beside the dirt road, facing travellers leaving the city.
 for(const [x,rot,text,bg,fg] of [[-57.5,Math.PI/2,'OAK FARMS','#5a4a2c','#f1e6c4'],[55.5,-Math.PI/2,'ALDER WOODS','#2f4a33','#e3edd2']]){
  const post=new THREE.Mesh(new THREE.BoxGeometry(.14,2.3,.14),wood);post.position.set(x,1.15,11.4);post.castShadow=true;group.add(post);
  colliders.box(x,11.4,.07,.07);
  if(label)label(text,x+(rot>0?.09:-.09),2.05,11.4,2.4,rot,bg,fg,.48);
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
 const logMesh=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.12,1.15,8).rotateZ(Math.PI/2),new THREE.MeshStandardMaterial({color:'#8a6a45',roughness:1}),MAX_LOG_INSTANCES);
 logMesh.count=0;logMesh.castShadow=logMesh.receiveShadow=true;logMesh.frustumCulled=false;logMesh.name='ground-logs';group.add(logMesh);
 let clock=0;
 return {
  group,layout,trees,fade,
  blocked:(x,z)=>colliders.blocked(x,z),
  // Standing cuttable trees within range of a point.
  cuttableNear(x,z,range=2.2){const out=[];for(const t of trees.values())if(t.standing&&Math.abs(t.x-x)<=range&&Math.abs(t.z-z)<=range&&Math.hypot(t.x-x,t.z-z)<=range)out.push(t);return out},
  // Instantly reflect a saved felled tree (no animation): a stump.
  setFelled(key){const t=trees.get(key);if(!t||!t.standing)return false;t.standing=false;t.stage='stump';t.collider.active=false;t.anim=null;hideTree(t);touch();return true},
  // A felled tree growing back: 'stump' (nothing but the stump), 'sapling' (a small pine, still not choppable).
  setStage(key,stage){
   const t=trees.get(key);if(!t||t.standing||t.anim||t.stage===stage)return false;
   t.stage=stage;
   if(stage==='sapling'){for(const m of [pineTrunks,pineLow,pineTop])m.setMatrixAt(t.index,hidden);stumps.setMatrixAt(t.index,hidden);poseTree(t,{shrink:.3});stumps.setMatrixAt(t.index,m4.compose(v.set(t.x,0,t.z),yaw.setFromAxisAngle(yAxis,t.rot),s.set(t.scale*.8,.5,t.scale*.8)))}
   else hideTree(t);
   touch();return true;
  },
  // A fully regrown tree: standing, solid and choppable again.
  setRegrown(key){const t=trees.get(key);if(!t||t.standing)return false;t.standing=true;t.stage='mature';t.collider.active=true;t.anim=null;stumps.setMatrixAt(t.index,hidden);poseTree(t);touch();return true},
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
   fade.update(camera,fadeTarget);
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
