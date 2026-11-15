// Crash debris (VD7a): chips, glass and sparks thrown from the contact point of a counted crash. One pooled THREE.Points object (a second pool, not the smoke pool: debris needs gravity, a floor and
// small hard pieces, the smoke is soft round puffs that rise), DEBRIS_MAX = 150 points, ONE draw call and only while a piece is alive, a colour per point, no shadows, no textures. It uses the
// sawdust pool (sawdust.js: createParticles, spawn) with its own step (gravity and a bounce on the ground). The pieces scale with the hit (damage.js debrisOf).
// VD7b: the points are no longer squares. One patched PointsMaterial draws each kind in the fragment shader from gl_PointCoord: a spark is a soft additive blob that stretches into a streak along its screen velocity and fades white-yellow, orange, dark; a chip is a ragged dark round; glass is a tilted diamond. Premultiplied blending (one, one-minus-src-alpha): a spark writes alpha 0 (adds), the others write alpha (cover).
import * as THREE from './vendor/three.module.js';
import {createParticles,spawn,PARKED} from './sawdust.js';
import {debrisOf} from './damage.js';
import {SURFACE} from './terrain.js';

export const DEBRIS_MAX=220,GRAVITY=-9,DRAG=.8,BOUNCE=.35; // TR6: 150 for crashes + 70 for the wheel spray (one pool, one Points object, one draw call)
const KIND={chip:0,glass:1,spark:2,dust:3,mud:4,drop:5};
export const DEBRIS_COLOURS=Object.freeze({chip:['#5d5a54','#8a867c','#3b3935'],glass:['#d6eef5','#b9dbe6'],spark:['#ffb23a','#ffd27a','#ff8a22'],dust:['#b9a582','#d6c7a6'],mud:['#3e2f22','#4a3a2a'],drop:['#5a4632','#6b5638']});
// TR6 wheel spray, the pure rules (notes/terrain-vehicle-design.md section 4). Per rear wheel, per second. Dust: pale, drifting, on dirt, path, gravel and dry grass at speed. Mud spray: dark chunks flicked back from a wheel on mud, plowed and crops
// (a quarter of the pieces are small droplets). None on roads, pavement, bridges, driveways or water. High quality gets the full rate, Low a quarter of the dust and no mud; prefers-reduced-motion halves everything.
export const DUST_RATE=14,MUD_RATE=20,DROP_SHARE=.25,DUST_MIN_SPEED=4,GRASS_DUST_MIN_SPEED=6,MUD_MIN_SPEED=1.5,SPIN_SPEED=3,SPIN_THROTTLE=.5,CALM_RATE=.5,MUD_LIFE=1,DUST_LIFE=1.2,DROP_LIFE=.7;
export const QUALITY_RATE=Object.freeze({high:{dust:1,mud:1},low:{dust:.25,mud:0}});
const SP=SURFACE;
export const SPRAY_SURFACE=Object.freeze({[SP.DIRT]:{dust:1,colour:'#b9a582'},[SP.PATH]:{dust:.8,colour:'#b9a582'},[SP.GRAVEL]:{dust:.8,colour:'#c4bdae'},[SP.GRASS]:{dust:.3,minSpeed:GRASS_DUST_MIN_SPEED,colour:'#b3ad86'},
 [SP.MUD]:{mud:1,colour:'#3e2f22'},[SP.PLOWED]:{mud:.6,colour:'#4a3a2a'},[SP.WHEAT]:{mud:.25,colour:'#5a4a2e'},[SP.GREEN]:{mud:.25,colour:'#5a4a2e'}});
const NO_SPRAY=Object.freeze({dust:0,mud:0,drop:0,colour:'#000000'});
// One wheel for one frame: {dust, mud, drop} pieces per second and the ground colour. Wheelspin (throttle held and slower than 3 m/s, or Stuck) throws mud at the full rate whatever the speed; otherwise mud needs 1.5 m/s and scales with speed / top.
export function sprayOf({surface,speed=0,top=10,throttle=0,stuck=false,quality='high',calm=false}={}){
 const s=SPRAY_SURFACE[surface];if(!s)return NO_SPRAY;
 const v=Math.abs(speed),ratio=Math.min(1,v/Math.max(.1,top)),spin=!!stuck||(throttle>=SPIN_THROTTLE&&v<SPIN_SPEED),q=QUALITY_RATE[quality]||QUALITY_RATE.high,m=calm?CALM_RATE:1;
 const dust=s.dust&&v>=(s.minSpeed||DUST_MIN_SPEED)?DUST_RATE*s.dust*ratio*q.dust*m:0,mud=s.mud&&(v>=MUD_MIN_SPEED||spin)?MUD_RATE*s.mud*(spin?1:Math.max(.25,ratio))*q.mud*m:0;
 return dust>0||mud>0?{dust,mud,drop:mud*DROP_SHARE,colour:s.colour}:NO_SPRAY;
}
// One step: gravity, a little drag, a bounce off the ground (the first bounce only), and a piece dies at the end of its life. Dead ones are parked below the world. Returns how many are alive.
export function stepDebris(p,dt,floorY=0){
 let alive=0;
 for(let i=0;i<p.max;i++){
  if(p.life[i]<=0)continue;p.age[i]+=dt;
  if(p.age[i]>=p.life[i]){p.life[i]=0;p.pos[i*3+1]=PARKED;continue}
  const k=Math.max(0,1-DRAG*(p.dr?p.dr[i]:1)*dt);p.vel[i*3+1]+=GRAVITY*(p.g?p.g[i]:1)*dt;p.vel[i*3]*=k;p.vel[i*3+2]*=k;if(p.dr)p.vel[i*3+1]*=p.dr[i]>1?k:1; // TR6: dust has little gravity and a lot of drag (arrays g, dr, bn are optional)
  p.pos[i*3]+=p.vel[i*3]*dt;p.pos[i*3+1]+=p.vel[i*3+1]*dt;p.pos[i*3+2]+=p.vel[i*3+2]*dt;
  if(p.pos[i*3+1]<floorY){p.pos[i*3+1]=floorY;if(p.vel[i*3+1]<-1.2&&p.age[i]<p.life[i]*.6){p.vel[i*3+1]*=-BOUNCE*(p.bn?p.bn[i]:1);p.vel[i*3]*=.6;p.vel[i*3+2]*=.6}else{p.vel[i*3]*=.2;p.vel[i*3+1]=0;p.vel[i*3+2]*=.2}}
  alive++;
 }
 p.alive=alive;return alive;
}
// parent: where the points live (world coordinates).
export function createDebris(parent,{max=DEBRIS_MAX,random=Math.random}={}){
 const P=createParticles(max);P.g=new Float32Array(max).fill(1);P.dr=new Float32Array(max).fill(1);P.bn=new Float32Array(max).fill(1);const geometry=new THREE.BufferGeometry(),position=new THREE.BufferAttribute(P.pos,3);position.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',position);
 const col=new Float32Array(max*3).fill(.5),colour=new THREE.BufferAttribute(col,3);colour.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('color',colour);
 const vel=new THREE.BufferAttribute(P.vel,3),kinds=new Float32Array(max),kind=new THREE.BufferAttribute(kinds,1),frac=new Float32Array(max),fracAttr=new THREE.BufferAttribute(frac,1);vel.setUsage(THREE.DynamicDrawUsage);fracAttr.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('aVel',vel);geometry.setAttribute('aKind',kind);geometry.setAttribute('aT',fracAttr);
 const material=new THREE.PointsMaterial({color:'#ffffff',vertexColors:true,size:.16,sizeAttenuation:true,transparent:true,opacity:1,depthWrite:false,blending:THREE.CustomBlending,blendEquation:THREE.AddEquation,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor});
 material.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 aVel;attribute float aKind;attribute float aT;varying float vKind;varying float vSeed;varying float vT;varying vec2 vDir;varying float vStreak;')
  .replace('#include <fog_vertex>',`#include <fog_vertex>
 float k=floor(aKind);vKind=k;vSeed=fract(aKind);vT=aT;vec4 pa=projectionMatrix*(modelViewMatrix*vec4(position+aVel*.04,1.));vec2 dd=pa.xy/pa.w-gl_Position.xy/gl_Position.w;dd.x*=projectionMatrix[1][1]/projectionMatrix[0][0];float dl=length(dd);vDir=dl>1e-5?dd/dl:vec2(1.,0.);
 float st=(k>1.5&&k<2.5)?smoothstep(1.,6.,length(aVel)):0.;vStreak=st;gl_PointSize=min(gl_PointSize*(k>4.5?.55:k>3.5?1.1:k>2.5?2.+4.*aT:k>1.5?.8+st*3.4:(k>.5?1.15:.9)),72.);`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vKind;varying float vSeed;varying float vT;varying vec2 vDir;varying float vStreak;')
  .replace('#include <opaque_fragment>',`vec2 uv=gl_PointCoord*2.-1.;uv.y=-uv.y;
 if(vKind>2.5&&vKind<3.5){float r=length(uv),a=(1.-smoothstep(.15,1.,r))*.5*(1.-vT)*smoothstep(0.,.1,vT);if(a<.01)discard;gl_FragColor=vec4(diffuseColor.rgb*a,a);}
 else if(vKind>4.5){float r=length(uv),a=(1.-smoothstep(.55,.85,r))*(1.-smoothstep(.8,1.,vT));if(a<.02)discard;gl_FragColor=vec4(diffuseColor.rgb*(.85+.3*(1.-r))*a,a);}
 else if(vKind>1.5&&vKind<2.5){vec2 d=vDir;float al=dot(uv,d),pe=dot(uv,vec2(-d.y,d.x)),pw=mix(.9,.07,vStreak),r2=al*al/.9+pe*pe/(pw*pw);float k=exp(-r2*3.2)*mix(1.,.25+.75*smoothstep(-1.,.9,al),vStreak)*(1.-smoothstep(.6,1.,vT));if(k<.01)discard;
  vec3 hot=vT<.35?mix(vec3(1.,.95,.7),vec3(1.,.55,.12),vT/.35):mix(vec3(1.,.55,.12),vec3(.3,.07,.02),clamp((vT-.35)/.65,0.,1.));gl_FragColor=vec4(hot*k*(2.-vT),0.);}
 else{float c=cos(vSeed*6.2832),s=sin(vSeed*6.2832);vec2 p=vec2(c*uv.x-s*uv.y,s*uv.x+c*uv.y);float a;vec3 col=diffuseColor.rgb;
  if(vKind>.5&&vKind<1.5){a=1.-smoothstep(.6,.72,abs(p.x)*1.15+abs(p.y)*.65);col=mix(col,vec3(1.),.35*(.5+.5*p.x));}
  else{float r=length(p*vec2(1.,.82))+.1*sin(atan(p.y,p.x)*3.+vSeed*20.);a=1.-smoothstep(.55,.8,r);col*=.8;}
  a*=1.-smoothstep(.75,1.,vT);if(a<.02)discard;gl_FragColor=vec4(col*a,a);}`)};
 material.customProgramCacheKey=()=>'crash-debris';
 const points=new THREE.Points(geometry,material);
 points.name='crash-debris';points.frustumCulled=false;points.visible=false;points.castShadow=false;parent.add(points);
 let floor=0;const tmp=new THREE.Color(),pick=a=>a[Math.floor(random()*a.length)%a.length];
 const piece=(x,y,z,dx,dz,kind,speed,life)=>{P.g[P.next]=1;P.dr[P.next]=1;P.bn[P.next]=1;tmp.set(pick(DEBRIS_COLOURS[kind]));tmp.toArray(col,P.next*3);kinds[P.next]=KIND[kind]+random()*.9;frac[P.next]=0;spawn(P,x+(random()-.5)*.5,y+random()*.3,z+(random()-.5)*.5,dx*speed*.35+(random()-.5)*speed,1.5+random()*speed*.6,dz*speed*.35+(random()-.5)*speed,life*(.7+random()*.6))};
 const owedMap=new Map(); // TR6: pieces owed to each wheel
 return {points,particles:P,
  // The contact point {x, y, z} and the way the vehicle was heading {dx, dz} (unit): pieces fly out ahead and sideways. `points`: the crash points (debrisOf). Returns how many were thrown.
  burst(at,dir,points,groundY=at.y-.4){const d=debrisOf(points);floor=groundY;
   for(let i=0;i<d.chips;i++)piece(at.x,at.y,at.z,dir.dx,dir.dz,'chip',3+random()*4,1.1);
   for(let i=0;i<d.glass;i++)piece(at.x,at.y+.3,at.z,dir.dx,dir.dz,'glass',3+random()*5,1.3);
   for(let i=0;i<d.sparks;i++)piece(at.x,at.y,at.z,dir.dx,dir.dz,'spark',4+random()*6,.5);
   colour.needsUpdate=true;kind.needsUpdate=true;return d.chips+d.glass+d.sparks},
  // TR6: the spray of one wheel for dt seconds. id: a key per wheel (the fractional pieces owed carry from frame to frame, so the count does not depend on the frame rate); at {x,y,z}: the wheel on the ground; heading {dx,dz} (unit, the way the vehicle points);
  // speed: m/s (signed; reversing throws the other way); rates: sprayOf(...) ({dust,mud,drop,colour}). Returns how many pieces were thrown.
  spray(id,dt,at,heading,speed,rates){let n=0;if(!rates||!(rates.dust>0||rates.mud>0))return 0;const back=speed<-.5?1:-1,hx=heading.dx*back,hz=heading.dz*back;
   const put=(kind,life,g,dr,bn,vx,vy,vz,spread)=>{const i=P.next;P.g[i]=g;P.dr[i]=dr;P.bn[i]=bn;tmp.set(rates.colour);tmp.offsetHSL(0,0,(random()-.5)*(kind==='dust'?.1:.06));tmp.toArray(col,i*3);kinds[i]=KIND[kind]+random()*.9;frac[i]=0;
    spawn(P,at.x+(random()-.5)*.25,at.y,at.z+(random()-.5)*.25,vx+(random()-.5)*spread,vy,vz+(random()-.5)*spread,life*(.7+random()*.6));n++};
   for(const [key,rate] of [['dust',rates.dust],['mud',rates.mud-rates.drop],['drop',rates.drop]]){if(!(rate>0))continue;const k=id+key;let owed=(owedMap.get(k)||0)+rate*dt;
    while(owed>=1){owed--;
     if(key==='dust')put('dust',DUST_LIFE,.05,2.5,0,hx*(.4+random()*.8)+heading.dx*speed*.15,.3+random()*.7,hz*(.4+random()*.8)+heading.dz*speed*.15,.8);
     else if(key==='mud'){const b=2+random()*2;put('mud',MUD_LIFE,1,1,0,heading.dx*speed*.7+hx*b,2+random()*2,heading.dz*speed*.7+hz*b,1.2)}
     else{const b=1+random()*2;put('drop',DROP_LIFE,1,1,0,heading.dx*speed*.7+hx*b,1.5+random()*2,heading.dz*speed*.7+hz*b,2)}}
    owedMap.set(k,owed)}
   if(n){colour.needsUpdate=true;kind.needsUpdate=true}return n},
  update(dt,visible=true){const alive=stepDebris(P,dt,floor);position.needsUpdate=true;vel.needsUpdate=true;for(let i=0;i<max;i++)frac[i]=P.life[i]>0?Math.min(1,P.age[i]/P.life[i]):1;fracAttr.needsUpdate=true;points.visible=visible&&alive>0;return alive},
  dispose(){points.removeFromParent();geometry.dispose();points.material.dispose()}};
}
