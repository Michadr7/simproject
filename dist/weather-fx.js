// Weather precipitation particles (rain, sleet, snow) as one instanced billboard batch.
import * as THREE from './vendor/three.module.js';

export const WEATHER_FX_MAX=240,WEATHER_FX_LOW=120;
const BOX_XZ=24,BOX_H=14,HALF_XZ=BOX_XZ/2,HALF_H=BOX_H/2;

export function createWeatherFx(scene){
 const positions=new Float32Array(WEATHER_FX_MAX*3);
 const seeds=new Float32Array(WEATHER_FX_MAX*2);
 let s=1337901;const rnd=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
 for(let i=0;i<WEATHER_FX_MAX;i++){
  positions[i*3]=(rnd()-.5)*BOX_XZ;
  positions[i*3+1]=(rnd()-.5)*BOX_H;
  positions[i*3+2]=(rnd()-.5)*BOX_XZ;
  seeds[i*2]=rnd()*Math.PI*2;
  seeds[i*2+1]=.8+rnd()*.4;
 }
 const geom=new THREE.PlaneGeometry(1,1);
 const mat=new THREE.MeshBasicMaterial({
  name:'weather-precip-mat',color:0xbfd4ee,transparent:true,opacity:.52,depthWrite:false,side:THREE.DoubleSide
 });
 const mesh=new THREE.InstancedMesh(geom,mat,WEATHER_FX_MAX);
 mesh.name='weather-precip';
 mesh.frustumCulled=false;
 mesh.renderOrder=5;
 mesh.count=0;
 mesh.visible=false;
 scene.add(mesh);

 const mtx=new THREE.Matrix4(),pos=new THREE.Vector3(),scl=new THREE.Vector3(1,1,1),quat=new THREE.Quaternion(),eul=new THREE.Euler(0,0,0,'YXZ');
 let clock=0,mode='none',sx=.028,sy=.38;
 function applyMode(kind){
  if(kind===mode)return;mode=kind;
  if(kind==='snow'){mat.color.setHex(0xf4f8ff);mat.opacity=.82;sx=.095;sy=.095}
  else if(kind==='sleet'){mat.color.setHex(0xdce6f2);mat.opacity=.62;sx=.055;sy=.18}
  else{mat.color.setHex(0xbfd4ee);mat.opacity=.52;sx=.028;sy=.38}
 }

 function update(dt,camera,localWeather,wind,{indoors=false,quality='high',reducedMotion=false}={}){
  const rate=localWeather?.precipRate||0,kind=localWeather?.precipKind||'none';
  if(indoors||!localWeather||kind==='none'||rate<=.02){mesh.count=0;mesh.visible=false;return}
  const d=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;
  clock+=d;
  const cap=quality!=='high'||reducedMotion?WEATHER_FX_LOW:WEATHER_FX_MAX;
  const count=Math.max(12,Math.min(cap,Math.round(cap*rate)));
  applyMode(kind);
  mesh.visible=true;
  mesh.count=count;

  const cx=camera?.position?.x||0,cy=camera?.position?.y||3,cz=camera?.position?.z||0;
  const minX=cx-HALF_XZ,maxX=cx+HALF_XZ,minY=Math.max(0,cy-3)-2,maxY=minY+BOX_H,minZ=cz-HALF_XZ,maxZ=cz+HALF_XZ;
  const fall=kind==='snow'?2.4:kind==='sleet'?11:18;
  const wx=(wind?.x||0)*(kind==='snow'?.45:kind==='sleet'?.9:1.1);
  const wz=(wind?.z||0)*(kind==='snow'?.45:kind==='sleet'?.9:1.1);
  const swirl=kind==='snow'?.65:0;
  const tilt=kind==='snow'?0:Math.max(-.45,Math.min(.45,-wx*.045));
  scl.set(sx,sy,1);

  for(let i=0;i<count;i++){
   const k=i*3,spd=seeds[i*2+1],ph=seeds[i*2];
   let x=positions[k]+(wx+swirl*Math.sin(clock*1.9+ph))*d;
   let y=positions[k+1]-fall*spd*d;
   let z=positions[k+2]+(wz+swirl*Math.cos(clock*1.6+ph))*d;
   if(y<minY)y=maxY-((minY-y)%BOX_H);else if(y>maxY)y=minY+((y-maxY)%BOX_H);
   if(x<minX)x=maxX-((minX-x)%BOX_XZ);else if(x>maxX)x=minX+((x-maxX)%BOX_XZ);
   if(z<minZ)z=maxZ-((minZ-z)%BOX_XZ);else if(z>maxZ)z=minZ+((z-maxZ)%BOX_XZ);
   positions[k]=x;positions[k+1]=y;positions[k+2]=z;
   eul.set(0,Math.atan2(cx-x,cz-z),tilt);
   quat.setFromEuler(eul);
   mtx.compose(pos.set(x,y,z),quat,scl);
   mesh.setMatrixAt(i,mtx);
  }
  mesh.instanceMatrix.needsUpdate=true;
 }

 function dispose(){geom.dispose();mat.dispose();scene.remove(mesh)}
 return {points:mesh,mesh,update,dispose};
}
