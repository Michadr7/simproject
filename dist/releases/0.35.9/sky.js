// The sky and the day and night rig on three.js (notes/visual-overhaul-design.md). The numbers come from daynight.js (pure, tested); this file only applies them:
// the ONE directional light is the sun by day and the moon by night (the light count never changes, so nothing recompiles at dusk), the hemisphere light and the
// fog follow the clock, a sky dome draws the gradient with the sun and the moon (+1 draw call), the stars are one Points object (+1 draw call, night only), and the
// colour grade replaces three.js's empty CustomToneMapping so every material gets it with no extra pass (Low quality too).
import * as THREE from './vendor/three.module.js';
import {skyAt,gradeGLSL,NIGHT_FLOOR,clampNightFloor,clampExposureScale,wrapMinutes} from './daynight.js';

export const INDOOR_EXPOSURE=1.12; // interiors, the character preview and the menu keep the exposure the game always had (they stay day-bright for now)
export const STAR_COUNT=600,SUN_DISTANCE=60;
const EMPTY=/vec3 CustomToneMapping\( vec3 color \) \{[^}]*\}/;

// Puts the grade into three.js's tone-mapping chunk. Call before the first frame; calling again changes nothing. False if this three.js has no CustomToneMapping to replace.
export function installGrade(){
 const chunk=THREE.ShaderChunk.tonemapping_pars_fragment,glsl=gradeGLSL();
 if(chunk.includes(glsl))return true;
 if(!EMPTY.test(chunk))return false;
 THREE.ShaderChunk.tonemapping_pars_fragment=chunk.replace(EMPTY,glsl);return true;
}

const DOME_VERTEX=`varying vec3 vDir;
void main(){vDir=position;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=vec4(p.xy,0.0,p.w);}`; // rotation only: the dome is always centred on whichever camera draws it
const DOME_FRAGMENT=`uniform vec3 uTop,uHorizon,uSunDir,uSunColor,uMoonDir,uMoonColor;uniform float uSunDisc,uMoonDisc,uSunGlow;varying vec3 vDir;
void main(){
 vec3 d=normalize(vDir);float up=max(d.y,0.0),low=1.0-up;
 vec3 col=mix(uTop,uHorizon,low*low*low);                                  // a smooth gradient: the horizon colour is the fog colour, so the land fades into it
 float s=max(dot(d,uSunDir),0.0),m=max(dot(d,uMoonDir),0.0),above=smoothstep(-0.01,0.02,d.y);
 col+=uSunColor*pow(s,6.0)*low*low*uSunGlow*0.45;                           // the warm lobe along the horizon around the sun at dawn and dusk
 col+=uSunColor*(smoothstep(0.9993,0.9996,s)*6.0+pow(s,220.0)*0.6)*uSunDisc*above;
 col+=uMoonColor*(smoothstep(0.99955,0.9998,m)*1.4+pow(m,900.0)*0.15)*uMoonDisc*above;
 gl_FragColor=vec4(col,1.0);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const STAR_VERTEX=`attribute float aBright;uniform float uSize;varying float vBright;
void main(){vBright=aBright*smoothstep(0.02,0.22,position.y);vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=vec4(p.xy,0.0,p.w);gl_PointSize=uSize*(0.6+aBright);}`;
const STAR_FRAGMENT=`uniform float uStars;varying float vBright;
void main(){float a=smoothstep(0.5,0.15,length(gl_PointCoord-0.5));gl_FragColor=vec4(vec3(0.85,0.9,1.0)*vBright*uStars*a,1.0);
 #include <colorspace_fragment>
}`;

// scene: the world scene (it has a Fog and a Color background). sun, hemi: the two lights that already exist. renderer: only toneMapping and toneMappingExposure are set.
export function createSky({scene,renderer,sun,hemi}){
 const graded=installGrade();if(graded)renderer.toneMapping=THREE.CustomToneMapping; // set once, before the first frame: the tone-mapping mode never changes afterwards
 const v3=()=>({value:new THREE.Vector3()}),c3=()=>({value:new THREE.Color()});
 const dome=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.ShaderMaterial({name:'sky-dome',vertexShader:DOME_VERTEX,fragmentShader:DOME_FRAGMENT,side:THREE.BackSide,depthTest:false,depthWrite:false,fog:false,
  uniforms:{uTop:c3(),uHorizon:c3(),uSunDir:v3(),uSunColor:c3(),uMoonDir:v3(),uMoonColor:{value:new THREE.Color('#dfe8ff')},uSunDisc:{value:0},uMoonDisc:{value:0},uSunGlow:{value:0}}}));
 dome.name='sky-dome';dome.renderOrder=-3;dome.frustumCulled=false;dome.matrixAutoUpdate=false; // drawn first, behind the distant hills (renderOrder -1) and everything else
 // Stars: fixed points on the upper half of the sky from a seeded generator, so every player sees the same sky.
 let seed=20261113;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const pos=new Float32Array(STAR_COUNT*3),bright=new Float32Array(STAR_COUNT);
 for(let i=0;i<STAR_COUNT;i++){const y=.03+rnd()*.97,r=Math.sqrt(1-y*y),a=rnd()*Math.PI*2,b=rnd();pos.set([Math.cos(a)*r,y,Math.sin(a)*r],i*3);bright[i]=.25+b*b*b*.75}
 const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.BufferAttribute(pos,3));starGeometry.setAttribute('aBright',new THREE.BufferAttribute(bright,1));
 const stars=new THREE.Points(starGeometry,new THREE.ShaderMaterial({name:'sky-stars',vertexShader:STAR_VERTEX,fragmentShader:STAR_FRAGMENT,blending:THREE.AdditiveBlending,depthTest:false,depthWrite:false,fog:false,toneMapped:false,uniforms:{uStars:{value:0},uSize:{value:2.2}}}));
 stars.name='sky-stars';stars.renderOrder=-2;stars.frustumCulled=false;stars.matrixAutoUpdate=false;stars.visible=false; // not transparent on purpose: it stays in the opaque list, so it is drawn right after the dome and never over the world
 scene.add(dome,stars);

 const DAY=skyAt(720),tuned={minutes:null,nightFloor:NIGHT_FLOOR,exposureScale:1},last={x:0,z:0};
 let hills=null,now=DAY;
 const U=dome.material.uniforms;
 // minutes: the game clock. target: where the player is ({x,z}; leave out to keep the last one). indoors: inside a shop, the office or the warehouse (rooms that live in the
 // world scene): the two lights keep their noon values there for now, while the sky and fog outside still follow the clock.
 function update(minutes,{target=null,indoors=false}={}){
  const s=now=skyAt(tuned.minutes??minutes,tuned),L=indoors?DAY:s;
  if(target){last.x=target.x;last.z=target.z}
  sun.color.setRGB(L.lightColor[0],L.lightColor[1],L.lightColor[2]);sun.intensity=L.lightStrength;
  sun.position.set(last.x+L.lightDir[0]*SUN_DISTANCE,L.lightDir[1]*SUN_DISTANCE,last.z+L.lightDir[2]*SUN_DISTANCE);sun.target.position.set(last.x,0,last.z);sun.target.updateMatrixWorld();
  hemi.color.setRGB(L.hemiSky[0],L.hemiSky[1],L.hemiSky[2]);hemi.groundColor.setRGB(L.hemiGround[0],L.hemiGround[1],L.hemiGround[2]);hemi.intensity=L.hemiStrength;
  if(scene.fog){scene.fog.color.setRGB(s.horizon[0],s.horizon[1],s.horizon[2]);scene.fog.near=s.fogNear;scene.fog.far=s.fogFar}
  if(scene.background?.isColor)scene.background.setRGB(s.horizon[0],s.horizon[1],s.horizon[2]); // only seen if the dome fails to draw: then the sky is flat, as it was
  renderer.toneMappingExposure=indoors?INDOOR_EXPOSURE:s.exposure;
  U.uTop.value.setRGB(s.top[0],s.top[1],s.top[2]);U.uHorizon.value.setRGB(s.horizon[0],s.horizon[1],s.horizon[2]);U.uSunDir.value.set(s.sunDir[0],s.sunDir[1],s.sunDir[2]);U.uMoonDir.value.set(s.moonDir[0],s.moonDir[1],s.moonDir[2]);
  {const k=1+(s.weights.dawn+s.weights.dusk)*.6,w=s.weights.day,a=DAY.lightColor,b=s.sunHeight>=0?s.lightColor:a;U.uSunColor.value.setRGB((a[0]*w+b[0]*(1-w))*k,(a[1]*w+b[1]*(1-w))*k*(1-.25*s.sunGlow),(a[2]*w+b[2]*(1-w))*k*(1-.55*s.sunGlow))} // the disc and its lobe go orange at dawn and dusk
  U.uSunDisc.value=s.sunDisc;U.uMoonDisc.value=s.moonDisc;U.uSunGlow.value=s.sunGlow;
  stars.visible=s.stars>.02;stars.material.uniforms.uStars.value=s.stars;stars.material.uniforms.uSize.value=2.2*(renderer.getPixelRatio?.()||1);
  // The distant hills (world.js, 'distant-hills') are unlit and baked in the day fog colour: tint them by how the horizon differs from day.
  if(!hills)hills=scene.getObjectByName('distant-hills')||null;
  if(hills)hills.material.color.setRGB(s.horizon[0]/DAY.horizon[0],s.horizon[1]/DAY.horizon[1],s.horizon[2]/DAY.horizon[2]);
  return s;
 }
 // The dev panel's sliders. minutes: a time for the picture only (null follows the clock; the save is never touched). nightFloor and exposureScale: null puts the default back.
 function tune(values={}){
  if('minutes' in values)tuned.minutes=values.minutes===null||!Number.isFinite(values.minutes)?null:wrapMinutes(values.minutes);
  if('nightFloor' in values)tuned.nightFloor=values.nightFloor===null?NIGHT_FLOOR:clampNightFloor(values.nightFloor);
  if('exposureScale' in values)tuned.exposureScale=values.exposureScale===null?1:clampExposureScale(values.exposureScale);
  return {...tuned};
 }
 update(720);
 return {dome,stars,graded,update,tune,tuning:()=>({...tuned}),state:()=>now};
}
