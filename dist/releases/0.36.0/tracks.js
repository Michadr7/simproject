// TR5 tyre tracks, the one pooled mesh (rules: tracks-rules.js). TRACK_MAX = 1024 quads in ONE BufferGeometry and ONE draw call, vertex colour only (no texture), one shared program ('tyre-tracks').
// A lay() writes one slot of a ring (the oldest is overwritten). The fade and the distance cull run on the graphics card from a spawn-time attribute (aInfo = birth, life, alpha, side) and the uniform uTime, so a frame costs
// nothing on the CPU unless a segment is laid. Same style as debris.js. Not saved.
import * as THREE from './vendor/three.module.js';
import {TRACK_MAX,TRACK_FADE_FROM,TRACK_DRAW_NEAR,TRACK_DRAW_FAR} from './tracks-rules.js';import {tslKit} from './render-backend.js';import {createTracksMaterialTSL} from './tsl-tracks.js';
const num=n=>Number.isInteger(n)?n+'.':String(n);
export function createTracks(parent,{max=TRACK_MAX}={}){
 const pos=new Float32Array(max*12),col=new Float32Array(max*12),info=new Float32Array(max*16),index=new Uint16Array(max*6);
 for(let i=0;i<max;i++)index.set([i*4,i*4+1,i*4+2,i*4+1,i*4+3,i*4+2],i*6);
 const geometry=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(pos,3),colour=new THREE.BufferAttribute(col,3),aInfo=new THREE.BufferAttribute(info,4);
 for(const a of [position,colour,aInfo])a.setUsage(THREE.DynamicDrawUsage);
 geometry.setAttribute('position',position);geometry.setAttribute('color',colour);geometry.setAttribute('aInfo',aInfo);geometry.setIndex(new THREE.BufferAttribute(index,1));
 const K=tslKit('tracks'),T=K?createTracksMaterialTSL({THREE,TSL:K.TSL,MeshBasicNodeMaterial:K.MeshBasicNodeMaterial}):null; // WebGPU T5: the TSL twin behind ?webgpu=1 (same uTime)
 const uTime=T?T.uniforms.uTime:{value:0},material=T?T.material:new THREE.MeshBasicMaterial({color:'#ffffff',vertexColors:true,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 if(!T)material.onBeforeCompile=sh=>{sh.uniforms.uTime=uTime;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 aInfo;uniform float uTime;varying float vA;varying float vSide;')
   .replace('#include <fog_vertex>',`#include <fog_vertex>
 float age=uTime-aInfo.x;float t=aInfo.y>0.?age/aInfo.y:2.;float fd=age<0.||t>=1.?0.:(t<=${num(TRACK_FADE_FROM)}?1.:(1.-t)/${num(1-TRACK_FADE_FROM)});
 float cd=distance((modelMatrix*vec4(transformed,1.)).xyz,cameraPosition);vA=aInfo.z*fd*(1.-smoothstep(${num(TRACK_DRAW_NEAR)},${num(TRACK_DRAW_FAR)},cd));vSide=aInfo.w;
 if(vA<.004)gl_Position=vec4(3.,3.,3.,1.);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vA;varying float vSide;')
   .replace('#include <opaque_fragment>','diffuseColor.a*=vA*(1.-smoothstep(.55,1.,abs(vSide)));if(diffuseColor.a<.01)discard;\n#include <opaque_fragment>')};
 if(!T)material.customProgramCacheKey=()=>'tyre-tracks';
 const mesh=new THREE.Mesh(geometry,material);mesh.name='tyre-tracks';mesh.frustumCulled=false;mesh.visible=false;mesh.castShadow=false;mesh.receiveShadow=false;parent.add(mesh);
 let next=0,count=0,clock=0,lastDeath=0;const tmp=new THREE.Color(),cache=new Map(),rgb=hex=>{let c=cache.get(hex);if(!c){tmp.set(hex);c=[tmp.r,tmp.g,tmp.b];cache.set(hex,c)}return c};
 return {mesh,max,uTime,
  get count(){return count},get next(){return next},get clock(){return clock},
  // One segment from (x0,y0,z0) to (x1,y1,z1), `width` metres wide, born now. life in seconds. Returns its slot. A segment of no length is skipped (null).
  lay({x0,y0,z0,x1,y1,z1,width,colour:hex,alpha,life}){
   const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz);if(!(len>1e-6)||!(life>0))return null;const hw=width/2,px=-dz/len*hw,pz=dx/len*hw,s=next,c=rgb(hex);
   const v=[[x0-px,y0,z0-pz,-1],[x0+px,y0,z0+pz,1],[x1-px,y1,z1-pz,-1],[x1+px,y1,z1+pz,1]];
   for(let k=0;k<4;k++){const j=s*4+k;pos[j*3]=v[k][0];pos[j*3+1]=v[k][1];pos[j*3+2]=v[k][2];col[j*3]=c[0];col[j*3+1]=c[1];col[j*3+2]=c[2];info[j*4]=clock;info[j*4+1]=life;info[j*4+2]=alpha;info[j*4+3]=v[k][3]}
   next=(s+1)%max;count=Math.min(max,count+1);lastDeath=Math.max(lastDeath,clock+life);position.needsUpdate=colour.needsUpdate=aInfo.needsUpdate=true;mesh.visible=true;return s},
  // The clock is real time (it does not run while the game is paused: the frame passes dt 0). The mesh hides itself when every segment has died, so an idle game draws nothing.
  update(dt){clock+=Math.max(0,Math.min(dt||0,.25));uTime.value=clock;mesh.visible=count>0&&clock<lastDeath;return mesh.visible},
  // Slots with something left to show right now (alive by the clock; the distance cull is on the graphics card).
  alive(){let n=0;for(let i=0;i<count;i++){const b=info[i*16],l=info[i*16+1];if(clock>=b&&clock-b<l)n++}return n},
  slot(i){const j=i*4;return {birth:info[j*4],life:info[j*4+1],alpha:info[j*4+2],colour:[col[j*3],col[j*3+1],col[j*3+2]],x:pos[j*3],z:pos[j*3+2],y:pos[j*3+1]}},
  clear(){info.fill(0);count=0;next=0;lastDeath=0;aInfo.needsUpdate=true;mesh.visible=false},
  dispose(){mesh.removeFromParent();geometry.dispose();material.dispose()}};
}
