// Exhaust smoke (0.35): a small pool of soft grey puffs that leave a vehicle's muffler when its engine starts and while it runs. The rules are pure (exhaustRate, tested): how many puffs a
// second at a speed and throttle; the pool is the sawdust pool's (sawdust.js: plain arrays, one THREE.Points object, one draw call, nothing drawn while no puff is alive), with no gravity
// (smoke rises) and a longer life. Cost: at most SMOKE_MAX = 150 points (VD3: a per-point colour for the damage tiers), one draw call, about 0.05 ms of CPU a frame; no shadows, no textures.
import * as THREE from './vendor/three.module.js';
import {createParticles,spawn,PARKED} from './sawdust.js';

export const SMOKE_MAX=150,RISE=.8,DRAG=1.1,WIND=.35,GROW=1.6; // 150 (VD3: 90 + the hood smoke of a damaged vehicle); the tiers: 0 grey (as before), 1 dark, 2 black
export const SMOKE_COLOURS=Object.freeze(['#9a9c9e','#4a4c4e','#1e1e20']); // VD7a: darker damage tiers
export const SMOKE_SIZE=Object.freeze([.8,1.25,1.5]),SMOKE_ALPHA=.6,SMOKE_LIFE=Object.freeze([1,1.9,2.1]); // VD7a: world size at birth per tier (a puff grows by GROW x its age share), the shared opacity, and the life factor: a damaged plume is bigger, denser and lives about twice as long
const TIER_PUFF={low:1,mid:.6,high:.35}; // cheaper engines smoke more
// Puffs per second: a thin idle wisp, more under throttle, a little more at speed. Zero when the engine is off. A key-turn burst is separate (START_PUFFS).
export const START_PUFFS={low:9,mid:6,high:4};
export function exhaustRate({running=true,throttle=0,speed=0,top=10,tier='low'}={}){
 if(!running)return 0;const k=TIER_PUFF[tier]??1,ratio=Math.max(0,Math.min(1,Math.abs(speed)/Math.max(.1,top)));
 return k*(2.2+4.5*Math.max(0,Math.min(1,throttle))+2*ratio);
}
// One step: each puff rises, slows down with the air, and fades out by the end of its life (alpha is the shared opacity; the size is the material's).
export function stepSmoke(p,dt){
 let alive=0;const k=Math.max(0,1-DRAG*dt);
 for(let i=0;i<p.max;i++){
  if(p.life[i]<=0)continue;p.age[i]+=dt;
  if(p.age[i]>=p.life[i]){p.life[i]=0;p.pos[i*3+1]=PARKED;continue}
  p.vel[i*3]*=k;p.vel[i*3+2]*=k;p.vel[i*3]+=WIND*dt;p.vel[i*3+1]+=(RISE-p.vel[i*3+1])*Math.min(1,2*dt);
  p.pos[i*3]+=p.vel[i*3]*dt;p.pos[i*3+1]+=p.vel[i*3+1]*dt;p.pos[i*3+2]+=p.vel[i*3+2]*dt;alive++;
 }
 p.alive=alive;return alive;
}

// A soft round dot (a radial gradient on a 32 px canvas), so the puffs are round, not square. Without a DOM (a test) the points stay square.
function softDot(){if(typeof document==='undefined'||!document.createElement)return null;const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');if(!g||!g.createRadialGradient)return null;const r=g.createRadialGradient(16,16,0,16,16,16);if(!r||!r.addColorStop)return null;r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.5,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

// parent: where the points live (world coordinates).
export function createSmoke(parent,{max=SMOKE_MAX,random=Math.random}={}){
 const P=createParticles(max),geometry=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(P.pos,3);position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',position);
 const col=new Float32Array(max*3),tiers=SMOKE_COLOURS.map(c=>new THREE.Color(c)),colour=new THREE.BufferAttribute(col,3);colour.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('color',colour);for(let i=0;i<max;i++)tiers[0].toArray(col,i*3);
 const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffffff',vertexColors:true,size:1,sizeAttenuation:true,transparent:true,opacity:SMOKE_ALPHA,depthWrite:false,map:softDot(),alphaTest:.01}));
 points.name='exhaust-smoke';points.frustumCulled=false;points.visible=false;points.castShadow=false;parent.add(points);
 const base=new Float32Array(max).fill(.8),size=new Float32Array(max).fill(.8),fade=new Float32Array(max),aSize=new THREE.BufferAttribute(size,1),aFade=new THREE.BufferAttribute(fade,1);aSize.setUsage(THREE.DynamicDrawUsage);aFade.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aSize',aSize);geometry.setAttribute('aFade',aFade);
 points.material.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <common>','attribute float aSize;attribute float aFade;varying float vFade;\n#include <common>').replace('gl_PointSize = size;','gl_PointSize = size * aSize;vFade = aFade;');s.fragmentShader=s.fragmentShader.replace('#include <common>','varying float vFade;\n#include <common>').replace('#include <alphatest_fragment>','diffuseColor.a *= vFade;\n#include <alphatest_fragment>')}; // VD7a: a size and a fade per puff (one program, one draw call)
 const carry=new Map(); // fractional puffs owed to each emitter id
 // one puff at (x, y, z), drifting back along (dx, dz) (the direction the exhaust points, world) at a little speed, 0.9 to 1.5 s of life
 const puff=(x,y,z,dx,dz,speed=.5,tier=0,boost=0)=>{const slot=P.next;tiers[tier]?.toArray(col,slot*3);colour.needsUpdate=true;base[slot]=(SMOKE_SIZE[tier]??.8)*(.85+random()*.3)*(1+boost*.25);spawn(P,x+(random()-.5)*.06,y+(random()-.5)*.04,z+(random()-.5)*.06,dx*speed+(random()-.5)*.25,.2+random()*.3+boost,dz*speed+(random()-.5)*.25,(.9+random()*.6)*(1+boost*.6)*(SMOKE_LIFE[tier]??1))}; // boost: a hood plume leaves with a push up and lasts longer (it must clear the cab to be seen from behind)
 return {points,particles:P,
  // Every frame for each running vehicle: id, the muffler tip in the world {x, y, z}, dx/dz the way the pipe points, and the rate from exhaustRate.
  emit(id,dt,tip,rate,tier=0){let owed=(carry.get(id)||0)+rate*dt;while(owed>=1){puff(tip.x,tip.y,tip.z,tip.dx,tip.dz,.4+random()*.5,tier,tip.boost||0);owed--}carry.set(id,owed)}, // tier: the colour (0 grey, 1 dark, 2 black)
  // The key turn: a short burst of puffs.
  burst(tip,n,tier=0){for(let i=0;i<n;i++)puff(tip.x,tip.y,tip.z,tip.dx,tip.dz,.6+random()*.9,tier,tip.boost||0)},
  update(dt,visible=true){const alive=stepSmoke(P,dt);for(let i=0;i<max;i++){const a=P.life[i]>0?P.age[i]/P.life[i]:1;size[i]=base[i]*(1+GROW*a);fade[i]=a>=1?0:Math.min(1,a*8)*(1-a)}aSize.needsUpdate=true;aFade.needsUpdate=true;position.needsUpdate=true;points.visible=visible&&alive>0;return alive},
  dispose(){points.removeFromParent();geometry.dispose();points.material.dispose()}};
}
