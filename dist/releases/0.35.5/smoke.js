// Exhaust smoke (0.35): a small pool of soft grey puffs that leave a vehicle's muffler when its engine starts and while it runs. The rules are pure (exhaustRate, tested): how many puffs a
// second at a speed and throttle; the pool is the sawdust pool's (sawdust.js: plain arrays, one THREE.Points object, one draw call, nothing drawn while no puff is alive), with no gravity
// (smoke rises) and a longer life. Cost: at most SMOKE_MAX = 90 points, one draw call, about 0.05 ms of CPU a frame; no shadows, no textures.
import * as THREE from './vendor/three.module.js';
import {createParticles,spawn,PARKED} from './sawdust.js';

export const SMOKE_MAX=90,RISE=.55,DRAG=1.1;
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
  p.vel[i*3]*=k;p.vel[i*3+2]*=k;p.vel[i*3+1]+=(RISE-p.vel[i*3+1])*Math.min(1,2*dt);
  p.pos[i*3]+=p.vel[i*3]*dt;p.pos[i*3+1]+=p.vel[i*3+1]*dt;p.pos[i*3+2]+=p.vel[i*3+2]*dt;alive++;
 }
 p.alive=alive;return alive;
}

// A soft round dot (a radial gradient on a 32 px canvas), so the puffs are round, not square. Without a DOM (a test) the points stay square.
function softDot(){if(typeof document==='undefined'||!document.createElement)return null;const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');if(!g||!g.createRadialGradient)return null;const r=g.createRadialGradient(16,16,0,16,16,16);if(!r||!r.addColorStop)return null;r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.5,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}

// parent: where the points live (world coordinates).
export function createSmoke(parent,{max=SMOKE_MAX,random=Math.random}={}){
 const P=createParticles(max),geometry=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(P.pos,3);position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',position);
 const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#9a9c9e',size:.55,sizeAttenuation:true,transparent:true,opacity:.34,depthWrite:false,map:softDot(),alphaTest:.01}));
 points.name='exhaust-smoke';points.frustumCulled=false;points.visible=false;points.castShadow=false;parent.add(points);
 const carry=new Map(); // fractional puffs owed to each emitter id
 // one puff at (x, y, z), drifting back along (dx, dz) (the direction the exhaust points, world) at a little speed, 0.9 to 1.5 s of life
 const puff=(x,y,z,dx,dz,speed=.5)=>spawn(P,x+(random()-.5)*.06,y+(random()-.5)*.04,z+(random()-.5)*.06,dx*speed+(random()-.5)*.25,.2+random()*.3,dz*speed+(random()-.5)*.25,.9+random()*.6);
 return {points,particles:P,
  // Every frame for each running vehicle: id, the muffler tip in the world {x, y, z}, dx/dz the way the pipe points, and the rate from exhaustRate.
  emit(id,dt,tip,rate){let owed=(carry.get(id)||0)+rate*dt;while(owed>=1){puff(tip.x,tip.y,tip.z,tip.dx,tip.dz,.4+random()*.5);owed--}carry.set(id,owed)},
  // The key turn: a short burst of puffs.
  burst(tip,n){for(let i=0;i<n;i++)puff(tip.x,tip.y,tip.z,tip.dx,tip.dz,.6+random()*.9)},
  update(dt,visible=true){const alive=stepSmoke(P,dt);position.needsUpdate=true;points.visible=visible&&alive>0;return alive},
  dispose(){points.removeFromParent();geometry.dispose();points.material.dispose()}};
}
