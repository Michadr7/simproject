// GD5 ground cover view (notes/ground-detail-design.md 2b, 2c, 4): per chunk, one InstancedMesh per cover kind (grass, ferns, flowers, rocks ... from the Quaternius MegaKit baked in cover-assets.js; reeds and crop code-made) placed by ground-cover-rules.js coverFor() with the real sampler of cover-sampler.js.
// One material per kind, ONE shader program (customProgramCacheKey 'gd-cover'): the vertex shader fades each instance by its distance to the camera (shrink, then thin by rank, nothing past the fog), bends it in the shared wind (wind.js numbers) and leans its normals up so tufts shade like the ground. No per-frame CPU work except the wind uniform.
// Chunk lifetime: world.js tells the view when a chunk's mask is live (onChunk) or gone (onChunkGone); update() builds at most one stage (placement, then meshes) per call for the nearest chunk within reach, and drops chunks that are far.
import {coverFor,coverJob,COVER_RULES,coverReach,tierOf} from './ground-cover-rules.js';
import {WIND_KIND_MUL,WIND_BASE,windUniform} from './wind.js';
import {makeCoverSampler} from './cover-sampler.js';
import {kindModel,kindRuns,packRun,kindUniform,COVER_BOUND_PAD} from './cover-pack.js';
export const COVER_BUILD_DIST=62; // metres from the player to a chunk's nearest edge: closer than this and its cover is built
export const COVER_DROP_DIST=95; // beyond this its cover is disposed (hysteresis: no building and dropping at the border)
export const COVER_CHECK_S=.25; // how often update() looks at which chunks need cover
export const COVER_UP=Object.freeze({grass:.7,tallgrass:.6,clover:.7,fern:.5,flower:.6,bush:.35,pebble:0,rock:0,mushroom:.2,reed:.6,crop:.6}); // how far each kind's normals lean toward up (0 = its own normals)
export const COVER_ALPHA_TEST=.35;
const VERT_COMMON='#include <common>\nattribute vec2 aInst;uniform vec4 uKind;uniform float uUp;uniform vec4 uWind;uniform float uWindT;\n';
const VERT_NORMAL='vec3 objectNormal=normalize(mix(vec3(normal),vec3(0.,1.,0.),uUp));\n';
// distance fade (rank thinning + shrink) and wind bend, in model space; cvM is the push in metres along the wind, applied in world space in project_vertex below
const VERT_BEGIN='vec3 transformed=vec3(position);\nvec3 cvRoot=instanceMatrix[3].xyz;\nfloat cvKeep=1.-smoothstep(uKind.x,uKind.y,distance(cvRoot.xz,cameraPosition.xz));\ntransformed*=(cvKeep>aInst.x?1.:0.)*min(1.,cvKeep*2.);\n'
 +'float cvB=clamp(position.y*uKind.w,0.,1.);cvB*=cvB;\nfloat cvM=cvB*(.03*uWind.w+(.02+.04*uWind.w)*sin(uWindT*1.7-(cvRoot.x*uWind.x+cvRoot.z*uWind.y)*.54+aInst.y*.35))*uWind.z*uKind.z/.85;\n';
const VERT_PROJECT='vec4 mvPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nmvPosition=instanceMatrix*mvPosition;\n#endif\nmvPosition.xz+=uWind.xy*cvM;\nmvPosition=modelViewMatrix*mvPosition;\ngl_Position=projectionMatrix*mvPosition;\n';
// The three shader edits as one function so a test can run it on plain strings.
export function patchCoverShader(vertexShader,fragmentShader,frontFacingChunk){
 let v=vertexShader.replace('#include <common>',VERT_COMMON).replace('#include <beginnormal_vertex>',VERT_NORMAL).replace('#include <begin_vertex>',VERT_BEGIN).replace('#include <project_vertex>',VERT_PROJECT);
 let f=fragmentShader;if(frontFacingChunk&&frontFacingChunk.includes('gl_FrontFacing ? 1.0 : - 1.0'))f=f.replace('#include <normal_fragment_begin>',frontFacingChunk.replace('gl_FrontFacing ? 1.0 : - 1.0','1.0')); // double-sided leaves keep their (up-leaning) normal on the back: no black undersides
 return {vertexShader:v,fragmentShader:f}}
export function createCoverView({THREE,heightAt,seed=0,rects=[],tier='high'}){
 const wind={uWind:{value:new THREE.Vector4(WIND_BASE.dx,WIND_BASE.dz,.85,.5)},uWindT:{value:0}},windArr=[0,0,0,0];
 let assets=null,atlas=null,models=null,cur=tierOf(tier);
 const materials=new Map(),geos=new Map(),ready=new Map(),built=new Map(),queue=[],stat={chunks:0,instances:0,draws:0,lastPlaceMs:0,lastMeshMs:0,builtTotal:0,droppedTotal:0,placeMsTotal:0,maxPlaceMs:0,maxFrameMs:0};
 let sinceCheck=1e9,pos={x:0,z:0},pending=null,work=null;
 const rectDist=(b,x,z)=>Math.hypot(Math.max(b.x0-x,0,x-b.x1),Math.max(b.z0-z,0,z-b.z1));
 function makeAtlas(a){const img=new Image();const t=new THREE.Texture(img);t.flipY=false;t.colorSpace=THREE.SRGBColorSpace;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;img.onload=()=>{t.needsUpdate=true};img.src=a.png;return t}
 function materialFor(kind){let m=materials.get(kind);if(m)return m;
  const r=coverReach(kind,cur),mdl=models.get(kind),u=kindUniform(kind,r,WIND_KIND_MUL[kind]??1,mdl.height);
  const uniforms={uKind:{value:new THREE.Vector4(u[0],u[1],u[2],u[3])},uUp:{value:COVER_UP[kind]??.5},uWind:wind.uWind,uWindT:wind.uWindT};
  m=new THREE.MeshStandardMaterial({map:atlas,vertexColors:true,alphaTest:COVER_ALPHA_TEST,side:THREE.DoubleSide,roughness:1,metalness:0});m.name='cover-'+kind;
  m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);const p=patchCoverShader(shader.vertexShader,shader.fragmentShader,THREE.ShaderChunk.normal_fragment_begin);shader.vertexShader=p.vertexShader;shader.fragmentShader=p.fragmentShader};
  m.customProgramCacheKey=()=>'gd-cover';m.userData.uniforms=uniforms;materials.set(kind,m);return m}
 function geoFor(kind){let g=geos.get(kind);if(g)return g;const d=models.get(kind);g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(d.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(d.nrm,3));g.setAttribute('uv',new THREE.BufferAttribute(d.uv,2));g.setAttribute('color',new THREE.BufferAttribute(d.col,3));g.setIndex(new THREE.BufferAttribute(d.idx,1));geos.set(kind,g);return g}
 function applyTierUniforms(){for(const [kind,m] of materials){const r=coverReach(kind,cur),u=m.userData.uniforms.uKind.value;u.x=r.near;u.y=r.far}}
 function disposeGroup(group){group.removeFromParent();for(const m of group.children){m.geometry.dispose();m.dispose()}}
 function dropPending(){if(pending?.group)disposeGroup(pending.group);pending=null}
 function disposeChunk(key){const b=built.get(key);if(!b)return;built.delete(key);if(!b.group)return;disposeGroup(b.group);stat.chunks--;stat.instances-=b.instances;stat.draws-=b.draws;stat.droppedTotal++} // b.group null = a chunk that placed nothing (kept so it is not placed again every check)
 function stageA(c,ctx){const t0=performance.now(),s=makeCoverSampler({bounds:c.bounds,surfaceAt:ctx.surfaceAt,heightAt,biomeAt:ctx.biomeAt,rects});
  const list=coverFor(c.i,c.j,seed,s,{tier:cur,bounds:c.bounds}),ms=performance.now()-t0;stat.lastPlaceMs=ms;stat.placeMsTotal+=ms;if(ms>stat.maxPlaceMs)stat.maxPlaceMs=ms;return {list,ms}}
 function meshRun(c,list,run,ctx,group){const kind=run.kind;if(!models.has(kind))return 0;const n=run.to-run.from,I=new Float32Array(n*2),g=geoFor(kind).clone();g.setAttribute('aInst',new THREE.InstancedBufferAttribute(I,2));
   const mesh=new THREE.InstancedMesh(g,materialFor(kind),n);mesh.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(n*3),3);
   const box=packRun(list,run.from,run.to,heightAt,ctx.surfaceAt,{matrix:mesh.instanceMatrix.array,color:mesh.instanceColor.array,inst:I});mesh.instanceMatrix.needsUpdate=true;
   const cx=(box.minX+box.maxX)/2,cy=(box.minY+box.maxY)/2,cz=(box.minZ+box.maxZ)/2;mesh.boundingSphere=new THREE.Sphere(new THREE.Vector3(cx,cy,cz),Math.hypot(box.maxX-box.minX,box.maxY-box.minY+2,box.maxZ-box.minZ)/2+COVER_BOUND_PAD);
   mesh.castShadow=false;mesh.receiveShadow=true;mesh.name='cover-'+c.key+'-'+kind;mesh.matrixAutoUpdate=false;group.add(mesh);return n}
 function stageB(c,list,ctx,group){const t0=performance.now();let instances=0,draws=0;for(const run of kindRuns(list)){const n=meshRun(c,list,run,ctx,group);if(n){instances+=n;draws++}}stat.lastMeshMs=performance.now()-t0;return {instances,draws}}
 const view={
  // The chunk's mask is live: remember it (cover is built later, when the player is near).
  onChunk(c,ctx){ready.set(c.key,{key:c.key,i:c.i,j:c.j,bounds:c.bounds,ctx})},
  onChunkGone(key){ready.delete(key);disposeChunk(key);if(pending&&pending.c.key===key)dropPending();if(work&&work.c.key===key)work=null;const q=queue.findIndex(e=>e.key===key);if(q>=0)queue.splice(q,1)},
  setAssets(a){assets=a;atlas=makeAtlas(a.atlas);models=new Map();for(const kind of Object.keys(COVER_RULES)){const m=kindModel(kind,{white:a.atlas.white,models:a.models});if(m)models.set(kind,m)};sinceCheck=1e9},
  get hasAssets(){return !!models},
  setTier(t){t=tierOf(t);if(t===cur)return;cur=t;for(const key of [...built.keys()])disposeChunk(key);queue.length=0;dropPending();work=null;applyTierUniforms();sinceCheck=1e9},
  get tier(){return cur},
  // The wind of this frame: a windSample result {dx,dz,strength,gust,t}.
  setWind(w){windUniform(w,windArr);wind.uWind.value.set(windArr[0],windArr[1],windArr[2],windArr[3]);wind.uWindT.value=w.t},
  // Called every frame with the player position and the time step; `parent` is the scene group the cover goes into.
  update(x,z,dt,parent){const t0=performance.now();view._step(x,z,dt,parent);const ms=performance.now()-t0;if(ms>stat.maxFrameMs)stat.maxFrameMs=ms}, // maxFrameMs = the longest whole update() call (audit C2: maxPlaceMs alone missed the sampler and mesh stages)
  _step(x,z,dt,parent){if(!models)return;pos.x=x;pos.z=z;sinceCheck+=dt;
   if(sinceCheck>=COVER_CHECK_S){sinceCheck=0;queue.length=0;
    for(const c of ready.values()){const d=rectDist(c.bounds,x,z),has=built.has(c.key);if(has&&d>COVER_DROP_DIST)disposeChunk(c.key);else if(!has&&d<COVER_BUILD_DIST&&!(pending&&pending.c.key===c.key)&&!(work&&work.c.key===c.key))queue.push({key:c.key,d,c})}
    queue.sort((a,b)=>a.d-b.d);
    if(work&&rectDist(work.c.bounds,x,z)>=COVER_BUILD_DIST+10)work=null;if(pending&&rectDist(pending.c.bounds,x,z)>=COVER_BUILD_DIST+10)dropPending()} // a teleport: a job for a chunk that is now far is cancelled (audit C5)
   if(pending){const pd=pending;if(!ready.has(pd.c.key)||built.has(pd.c.key)){dropPending();return}
    if(!pd.group){pd.group=new THREE.Group();pd.group.name='cover-'+pd.c.key}
    const t0=performance.now();if(pd.i<pd.runs.length){const n=meshRun(pd.c,pd.list,pd.runs[pd.i++],pd.c.ctx,pd.group);if(n){pd.instances+=n;pd.draws++}}pd.ms+=performance.now()-t0; // meshes are built one cover kind per call too
    if(pd.i>=pd.runs.length){pending=null;stat.lastMeshMs=pd.ms;if(pd.draws){pd.group.matrixAutoUpdate=false;parent.add(pd.group);built.set(pd.c.key,{group:pd.group,instances:pd.instances,draws:pd.draws});stat.chunks++;stat.instances+=pd.instances;stat.draws+=pd.draws;stat.builtTotal++}else built.set(pd.c.key,{group:null,instances:0,draws:0})}return}
   // COVER-FIX: placement is spread over frames, one cover kind per call (a whole chunk in one frame was the stutter when turning); maxPlaceMs is now the longest single piece
   if(work){const t0=performance.now();work.job.step();const ms=performance.now()-t0;work.ms+=ms;if(ms>stat.maxPlaceMs)stat.maxPlaceMs=ms;
    if(work.job.done){const w=work;work=null;if(ready.has(w.c.key)&&!built.has(w.c.key)){const t1=performance.now(),list=w.job.result();w.ms+=performance.now()-t1;stat.lastPlaceMs=w.ms;stat.placeMsTotal+=w.ms;pending={c:w.c,list,runs:kindRuns(list),i:0,group:null,instances:0,draws:0,ms:0}}}return}
   if(queue.length){const e=queue.shift(),c=ready.get(e.key);if(c&&!built.has(c.key)){const t0=performance.now(),s=makeCoverSampler({bounds:c.bounds,surfaceAt:c.ctx.surfaceAt,heightAt,biomeAt:c.ctx.biomeAt,rects});work={c,ms:performance.now()-t0,job:coverJob(c.i,c.j,seed,s,{tier:cur,bounds:c.bounds})}}}},
  // Build everything within reach of a point right now (tests, teleports behind a loading screen).
  buildNear(x,z,parent){if(!models)return 0;let n=0;for(const c of ready.values()){if(built.has(c.key)||rectDist(c.bounds,x,z)>=COVER_BUILD_DIST)continue;const a=stageA(c,c.ctx),group=new THREE.Group();group.name='cover-'+c.key;const r=stageB(c,a.list,c.ctx,group);
    if(r.draws){group.matrixAutoUpdate=false;parent.add(group);built.set(c.key,{group,instances:r.instances,draws:r.draws});stat.chunks++;stat.instances+=r.instances;stat.draws+=r.draws;stat.builtTotal++;n++}}return n},
  disposeAll(){for(const key of [...built.keys()])disposeChunk(key);ready.clear();queue.length=0;dropPending();work=null},
  stats(){return {...stat,tier:cur,ready:ready.size,builtChunks:built.size,queued:queue.length,materials:materials.size,programKey:'gd-cover'}},
  materials,models:()=>models
 };
 return view;
}
