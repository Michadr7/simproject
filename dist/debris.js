// Crash debris (VD7a): chips, glass and sparks thrown from the contact point of a counted crash. One pooled THREE.Points object (a second pool, not the smoke pool: debris needs gravity, a floor and
// small hard pieces, the smoke is soft round puffs that rise), DEBRIS_MAX = 150 points, ONE draw call and only while a piece is alive, a colour per point, no shadows, no textures. It uses the
// sawdust pool (sawdust.js: createParticles, spawn) with its own step (gravity and a bounce on the ground). The pieces scale with the hit (damage.js debrisOf).
// VD7b: the points are no longer squares. One patched PointsMaterial draws each kind in the fragment shader from gl_PointCoord: a spark is a soft additive blob that stretches into a streak along its screen velocity and fades white-yellow, orange, dark; a chip is a ragged dark round; glass is a tilted diamond. Premultiplied blending (one, one-minus-src-alpha): a spark writes alpha 0 (adds), the others write alpha (cover).
import * as THREE from './vendor/three.module.js';
import {createParticles,spawn,PARKED} from './sawdust.js';
import {debrisOf} from './damage.js';

export const DEBRIS_MAX=150,GRAVITY=-9,DRAG=.8,BOUNCE=.35;
const KIND={chip:0,glass:1,spark:2};
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
 const vel=new THREE.BufferAttribute(P.vel,3),kinds=new Float32Array(max),kind=new THREE.BufferAttribute(kinds,1),frac=new Float32Array(max),fracAttr=new THREE.BufferAttribute(frac,1);vel.setUsage(THREE.DynamicDrawUsage);fracAttr.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aVel',vel);geometry.setAttribute('aKind',kind);geometry.setAttribute('aT',fracAttr);
 const material=new THREE.PointsMaterial({color:'#ffffff',vertexColors:true,size:.16,sizeAttenuation:true,transparent:true,opacity:1,depthWrite:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor});
 material.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aVel;attribute float aKind;attribute float aT;varying float vKind;varying float vSeed;varying float vT;varying vec2 vDir;varying float vStreak;')
  .replace('#include <fog_vertex>',`#include <fog_vertex>
 float k=floor(aKind);vKind=k;vSeed=fract(aKind);vT=aT;vec4 pa=projectionMatrix*(modelViewMatrix*vec4(position+aVel*.04,1.));vec2 dd=pa.xy/pa.w-gl_Position.xy/gl_Position.w;dd.x*=projectionMatrix[1][1]/projectionMatrix[0][0];float dl=length(dd);vDir=dl>1e-5?dd/dl:vec2(1.,0.);
 float st=k>1.5?smoothstep(1.,6.,length(aVel)):0.;vStreak=st;gl_PointSize=min(gl_PointSize*(k>1.5?.8+st*3.4:(k>.5?1.15:.9)),72.);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vKind;varying float vSeed;varying float vT;varying vec2 vDir;varying float vStreak;')
  .replace('#include <opaque_fragment>',`vec2 uv=gl_PointCoord*2.-1.;uv.y=-uv.y;
 if(vKind>1.5){vec2 d=vDir;float al=dot(uv,d),pe=dot(uv,vec2(-d.y,d.x)),pw=mix(.9,.07,vStreak),r2=al*al/.9+pe*pe/(pw*pw);float k=exp(-r2*3.2)*mix(1.,.25+.75*smoothstep(-1.,.9,al),vStreak)*(1.-smoothstep(.6,1.,vT));if(k<.01)discard;
  vec3 hot=vT<.35?mix(vec3(1.,.95,.7),vec3(1.,.55,.12),vT/.35):mix(vec3(1.,.55,.12),vec3(.3,.07,.02),clamp((vT-.35)/.65,0.,1.));gl_FragColor=vec4(hot*k*(2.-vT),0.);}
 else{float c=cos(vSeed*6.2832),s=sin(vSeed*6.2832);vec2 p=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);float a;vec3 col=diffuseColor.rgb;
  if(vKind>.5){a=1.-smoothstep(.6,.72,abs(p.x)*1.15+abs(p.y)*.65);col=mix(col,vec3(1.),.35*(.5+.5*p.x));}
  else{float r=length(p*vec2(1.,.82))+.1*sin(atan(p.y,p.x)*3.+vSeed*20.);a=1.-smoothstep(.55,.8,r);col*=.8;}
  a*=1.-smoothstep(.75,1.,vT);if(a<.02)discard;gl_FragColor=vec4(col*a,a);}`)};
 material.customProgramCacheKey=()=>'crash-debris';
 const points=new THREE.Points(geometry,material);
 points.name='crash-debris';points.frustumCulled=false;points.visible=false;points.castShadow=false;parent.add(points);
 let floor=0;const tmp=new THREE.Color(),pick=a=>a[Math.floor(random()*a.length)%a.length];
 const piece=(x,y,z,dx,dz,kind,speed,life)=>{tmp.set(pick(DEBRIS_COLOURS[kind]));tmp.toArray(col,P.next*3);kinds[P.next]=KIND[kind]+random()*.9;frac[P.next]=0;spawn(P,x+(random()-.5)*.5,y+random()*.3,z+(random()-.5)*.5,dx*speed*.35+(random()-.5)*speed,1.5+random()*speed*.6,dz*speed*.35+(random()-.5)*speed,life*(.7+random()*.6))};
 return {points,particles:P,
  // The contact point {x, y, z} and the way the vehicle was heading {dx, dz} (unit): pieces fly out ahead and sideways. `points`: the crash points (debrisOf). Returns how many were thrown.
  burst(at,dir,points,groundY=at.y-.4){const d=debrisOf(points);floor=groundY;
   for(let i=0;i<d.chips;i++)piece(at.x,at.y,at.z,dir.dx,dir.dz,'chip',3+random()*4,1.1);
   for(let i=0;i<d.glass;i++)piece(at.x,at.y+.3,at.z,dir.dx,dir.dz,'glass',3+random()*5,1.3);
   for(let i=0;i<d.sparks;i++)piece(at.x,at.y,at.z,dir.dx,dir.dz,'spark',4+random()*6,.5);
   colour.needsUpdate=true;kind.needsUpdate=true;return d.chips+d.glass+d.sparks},
  update(dt,visible=true){const alive=stepDebris(P,dt,floor);position.needsUpdate=true;vel.needsUpdate=true;for(let i=0;i<max;i++)frac[i]=P.life[i]>0?Math.min(1,P.age[i]/P.life[i]):1;fracAttr.needsUpdate=true;points.visible=visible&&alive>0;return alive},
  dispose(){points.removeFromParent();geometry.dispose();points.material.dispose()}};
}
