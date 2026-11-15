// Crash debris (VD7a): chips, glass and sparks thrown from the contact point of a counted crash. One pooled THREE.Points object (a second pool, not the smoke pool: debris needs gravity, a floor and
// small hard squares, the smoke is soft round puffs that rise), DEBRIS_MAX = 150 points, ONE draw call and only while a piece is alive, a colour per point, no shadows, no textures. It uses the
// sawdust pool (sawdust.js: createParticles, spawn) with its own step (gravity and a bounce on the ground). The pieces scale with the hit (damage.js debrisOf).
import * as THREE from './vendor/three.module.js';
import {createParticles,spawn,PARKED} from './sawdust.js';
import {debrisOf} from './damage.js';

export const DEBRIS_MAX=150,GRAVITY=-9,DRAG=.8,BOUNCE=.35;
export const DEBRIS_COLOURS=Object.freeze({chip:['#5d5a54','#8a867c','#3b3935'],glass:['#d6eef5','#b9dbe6'],spark:['#ffb23a','#ffd27a','#ff8a22']});
// One step: gravity, a little drag, a bounce off the ground (the first bounce only), and a piece dies at the end of its life. Dead ones are parked below the world. Returns how many are alive.
export function stepDebris(p,dt,floorY=0){
 let alive=0;const k=Math.max(0,1-DRAG*dt);
 for(let i=0;i<p.max;i++){
  if(p.life[i]<=0)continue;p.age[i]+=dt;
  if(p.age[i]>=p.life[i]){p.life[i]=0;p.pos[i*3+1]=PARKED;continue}
  p.vel[i*3+1]+=GRAVITY*dt;p.vel[i*3]*=k;p.vel[i*3+2]*=k;
  p.pos[i*3]+=p.vel[i*3]*dt;p.pos[i*3+1]+=p.vel[i*3+1]*dt;p.pos[i*3+2]+=p.vel[i*3+2]*dt;
  if(p.pos[i*3+1]<floorY){p.pos[i*3+1]=floorY;if(p.vel[i*3+1]<-1.2&&p.age[i]<p.life[i]*.6){p.vel[i*3+1]*=-BOUNCE;p.vel[i*3]*=.6;p.vel[i*3+2]*=.6}else{p.vel[i*3]*=.2;p.vel[i*3+1]=0;p.vel[i*3+2]*=.2}}
  alive++;
 }
 p.alive=alive;return alive;
}
// parent: where the points live (world coordinates).
export function createDebris(parent,{max=DEBRIS_MAX,random=Math.random}={}){
 const P=createParticles(max),geometry=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(P.pos,3);position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',position);
 const col=new Float32Array(max*3).fill(.5),colour=new THREE.BufferAttribute(col,3);colour.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('color',colour);
 const points=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffffff',vertexColors:true,size:.16,sizeAttenuation:true,transparent:true,opacity:1,depthWrite:false}));
 points.name='crash-debris';points.frustumCulled=false;points.visible=false;points.castShadow=false;parent.add(points);
 let floor=0;const tmp=new THREE.Color(),pick=a=>a[Math.floor(random()*a.length)%a.length];
 const piece=(x,y,z,dx,dz,kind,speed,life)=>{tmp.set(pick(DEBRIS_COLOURS[kind]));tmp.toArray(col,P.next*3);spawn(P,x+(random()-.5)*.5,y+random()*.3,z+(random()-.5)*.5,dx*speed*.35+(random()-.5)*speed,1.5+random()*speed*.6,dz*speed*.35+(random()-.5)*speed,life*(.7+random()*.6))};
 return {points,particles:P,
  // The contact point {x, y, z} and the way the vehicle was heading {dx, dz} (unit): pieces fly out ahead and sideways. `points`: the crash points (debrisOf). Returns how many were thrown.
  burst(at,dir,points,groundY=at.y-.4){const d=debrisOf(points);floor=groundY;
   for(let i=0;i<d.chips;i++)piece(at.x,at.y,at.z,dir.dx,dir.dz,'chip',3+random()*4,1.1);
   for(let i=0;i<d.glass;i++)piece(at.x,at.y+.3,at.z,dir.dx,dir.dz,'glass',3+random()*5,1.3);
   for(let i=0;i<d.sparks;i++)piece(at.x,at.y,at.z,dir.dx,dir.dz,'spark',4+random()*6,.45);
   colour.needsUpdate=true;return d.chips+d.glass+d.sparks},
  update(dt,visible=true){const alive=stepDebris(P,dt,floor);position.needsUpdate=true;points.visible=visible&&alive>0;return alive},
  dispose(){points.removeFromParent();geometry.dispose();points.material.dispose()}};
}
