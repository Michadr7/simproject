// Sawdust: a small pool of short-lived points thrown up where the blade bites the log. The simulation is plain arrays (createParticles/spawn/step, tested without a renderer);
// createSawdust adds one THREE.Points object (one draw call, no shadows) that is only drawn while a particle is alive.
import * as THREE from './vendor/three.module.js';

export const SAWDUST_MAX=300,GRAVITY=-6,DRAG=1.6,PARKED=-100;
export const createParticles=max=>({max,pos:new Float32Array(max*3).fill(0).map((_,i)=>i%3===1?PARKED:0),vel:new Float32Array(max*3),age:new Float32Array(max),life:new Float32Array(max),next:0,alive:0});
// Puts a particle in the next slot of the ring (the oldest one is replaced when the pool is full).
export function spawn(p,x,y,z,vx,vy,vz,life){
 const i=p.next;p.next=(i+1)%p.max;
 p.pos[i*3]=x;p.pos[i*3+1]=y;p.pos[i*3+2]=z;p.vel[i*3]=vx;p.vel[i*3+1]=vy;p.vel[i*3+2]=vz;p.age[i]=0;p.life[i]=life;
}
// One step: gravity, a little drag, and a particle dies when its life is up or it reaches the floor. Dead ones are parked below the ground. Returns how many are alive.
export function step(p,dt,floorY=0){
 let alive=0;const k=Math.max(0,1-DRAG*dt);
 for(let i=0;i<p.max;i++){
  if(p.life[i]<=0)continue;
  p.age[i]+=dt;
  if(p.age[i]>=p.life[i]){p.life[i]=0;p.pos[i*3+1]=PARKED;continue}
  p.vel[i*3+1]+=GRAVITY*dt;p.vel[i*3]*=k;p.vel[i*3+1]*=k;p.vel[i*3+2]*=k;
  p.pos[i*3]+=p.vel[i*3]*dt;p.pos[i*3+1]+=p.vel[i*3+1]*dt;p.pos[i*3+2]+=p.vel[i*3+2]*dt;
  if(p.pos[i*3+1]<floorY){p.life[i]=0;p.pos[i*3+1]=PARKED;continue}
  alive++;
 }
 p.alive=alive;return alive;
}

// parent: where the points live (world coordinates). origin: {x,y,z} in the world; yaw: the model's yaw, so the spray leaves along the log's way (model +x); floorY: the deck's height.
export function createSawdust(parent,{origin,yaw,floorY,max=SAWDUST_MAX,random=Math.random}){
 const P=createParticles(max),geometry=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(P.pos,3);position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',position);
 const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#d9b47c',size:.075,sizeAttenuation:true,transparent:true,opacity:.85,depthWrite:false}));
 points.name='sawdust';points.frustumCulled=false;points.visible=false;points.castShadow=false;parent.add(points);
 const c=Math.round(Math.cos(yaw)),s=Math.round(Math.sin(yaw));
 return {points,particles:P,
  // n new particles at the blade: up and out along the feed direction, with a little sideways scatter, 0.4 to 0.9 s of life.
  emit(n){for(let k=0;k<n;k++){const lx=.6+random()*2.2,ly=1.3+random()*2.2,lz=(random()-.5)*1.8;
   spawn(P,origin.x+(random()-.5)*.1,origin.y+(random()-.5)*.04,origin.z+(random()-.5)*.1,lx*c+lz*s,ly,-lx*s+lz*c,.4+random()*.5)}},
  update(dt,visible=true){const alive=step(P,dt,floorY);position.needsUpdate=true;points.visible=visible&&alive>0;return alive},
  dispose(){points.removeFromParent();geometry.dispose();points.material.dispose()}};
}
