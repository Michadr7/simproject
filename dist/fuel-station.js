// The gas station in the world (0.35, DESIGN 4.13 I): each pump's nozzle in its holster, its hose (drawn always: a short sagging one to the holster when idle, a live one from the
// outlet to your hand while you hold the nozzle), and the nozzle you hold. The rules (prices, the sale, the hose limit) are in fuel.js.
// Holding the nozzle: it is kept at a fixed point in front of you at hand height, not in an arm pose yet (a later pass).
import * as THREE from './vendor/three.module.js';
import {FUEL_STATIONS} from './map-definition.js';
import {createProp,propInfo} from './props.js';
import {HOSE_MAX_M,priceLabel,fuelName} from './fuel.js';

export const HOSE_SEGMENTS=10,HOSE_SIDES=6,HOSE_RADIUS=.02,HOSE_SAG=.12; // a hose: 11 rings of 6 sides = 66 vertices, 120 triangles
const HOLD_FORWARD=.6,HOLD_HEIGHT=1.0; // where the held nozzle sits: 0.6 m in front of you, at hand height

// One tube, built once and rewritten in place (the live hose is the only one that changes).
export function hoseGeometry(){
 const rings=HOSE_SEGMENTS+1,pos=new Float32Array(rings*HOSE_SIDES*3),nor=new Float32Array(rings*HOSE_SIDES*3),idx=[];
 for(let r=0;r<HOSE_SEGMENTS;r++)for(let s=0;s<HOSE_SIDES;s++){const a=r*HOSE_SIDES+s,b=r*HOSE_SIDES+(s+1)%HOSE_SIDES,c=a+HOSE_SIDES,d=b+HOSE_SIDES;idx.push(a,c,b,b,c,d)}
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setIndex(idx);
 return g;
}
// The hose's centre line: a straight run from a to b that sags by HOSE_SAG of its length, and never goes below the ground (floor(x, z) + 3 cm).
export function hoseCurve(a,b,floor=()=>0){
 const len=a.distanceTo(b),sag=HOSE_SAG*len,pts=[];
 for(let i=0;i<=HOSE_SEGMENTS;i++){const t=i/HOSE_SEGMENTS,p=new THREE.Vector3().lerpVectors(a,b,t);p.y-=4*sag*t*(1-t);p.y=Math.max(p.y,floor(p.x,p.z)+.03);pts.push(p)}
 return pts;
}
const UP=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0),T=new THREE.Vector3(),N=new THREE.Vector3(),B=new THREE.Vector3(),O=new THREE.Vector3();
// Writes a centre line into a hose geometry (every ring round the line, the frame carried along the tangent).
export function writeHose(geometry,pts){
 const pos=geometry.attributes.position.array,nor=geometry.attributes.normal.array,n=pts.length;
 for(let r=0;r<n;r++){
  T.subVectors(pts[Math.min(r+1,n-1)],pts[Math.max(r-1,0)]).normalize();
  N.crossVectors(T,Math.abs(T.y)>.9?X:UP).normalize();B.crossVectors(T,N);
  for(let s=0;s<HOSE_SIDES;s++){const a=s/HOSE_SIDES*Math.PI*2,c=Math.cos(a),si=Math.sin(a);
   O.copy(N).multiplyScalar(c).addScaledVector(B,si);const k=(r*HOSE_SIDES+s)*3,p=pts[r];
   pos[k]=p.x+O.x*HOSE_RADIUS;pos[k+1]=p.y+O.y*HOSE_RADIUS;pos[k+2]=p.z+O.z*HOSE_RADIUS;nor[k]=O.x;nor[k+1]=O.y;nor[k+2]=O.z}
 }
 geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
}

// fade: the sightline fade (props); footing(x, z): the ground under a point (for the hose floor).
export function createFuelStation({scene,fade,footing=()=>0}){
 const root=new THREE.Group();root.name='fuel-station';scene.add(root);
 const hoseMaterial=new THREE.MeshStandardMaterial({color:'#1d1f22',roughness:.9,side:THREE.DoubleSide});
 const pumps=[];
 for(const st of FUEL_STATIONS){
  const info=propInfo(st.island.prop);if(st.island.yaw!==0)throw new Error(st.id+': only an island facing +z is placed for now (its anchors are not turned)');
  const at=(name)=>{const a=info.anchors[name];if(!a)throw new Error(`${st.id}: the island has no ${name}`);return new THREE.Vector3(st.island.x+a[0],a[1],st.island.z+a[2])};
  for(const p of st.pumps){
   const suffix=`_${p.n}`,nozzle=createProp(p.fuel==='diesel'?'prop.fuel-nozzle-diesel':'prop.fuel-nozzle',fade);nozzle.name=`nozzle-${st.id}-${p.n}`;
   const holster=at('anchor_nozzle_py'+suffix),outlet=at('anchor_hose_py'+suffix),use=at('anchor_use_py'+suffix);
   nozzle.position.copy(holster);root.add(nozzle);
   const idleGeo=hoseGeometry();writeHose(idleGeo,hoseCurve(outlet,holster,footing));
   const idleHose=new THREE.Mesh(idleGeo,hoseMaterial);idleHose.name=`hose-idle-${st.id}-${p.n}`;idleHose.castShadow=true;root.add(idleHose);
   pumps.push({id:`${st.id}:${p.n}`,fuel:p.fuel,label:fuelName(p.fuel),price:priceLabel(p.fuel),use,holster,outlet,nozzle,idleHose});
  }
 }
 const liveGeo=hoseGeometry(),live=new THREE.Mesh(liveGeo,hoseMaterial);live.name='hose-live';live.visible=false;live.castShadow=true;root.add(live);
 let held=null;
 const ctl={
  root,pumps,
  get held(){return held},
  // the pump whose use spot is within range of (x, z), nearest first
  pumpAt(x,z,range){let best=null,d=range;for(const p of pumps){const dd=Math.hypot(p.use.x-x,p.use.z-z);if(dd<=d){d=dd;best=p}}return best},
  // takes the nozzle from its holster; false if one is already out
  take(pump){if(held||!pump)return false;held=pump;pump.idleHose.visible=false;pump.nozzle.visible=true;return true},
  // puts the held nozzle back; returns the pump (or null if none was held)
  putBack(){if(!held)return null;const p=held;held=null;p.nozzle.position.copy(p.holster);p.nozzle.rotation.set(0,0,0);p.idleHose.visible=true;live.visible=false;return p},
  // each frame while held: the nozzle and the live hose follow your hand. Returns {limit: true} once the hose would be longer than HOSE_MAX_M (the caller then puts the nozzle back).
  update(player){
   if(!held)return null;
   const hand=new THREE.Vector3(player.x+Math.sin(player.yaw)*HOLD_FORWARD,HOLD_HEIGHT,player.z+Math.cos(player.yaw)*HOLD_FORWARD);
   held.nozzle.position.copy(hand);held.nozzle.rotation.set(0,player.yaw,0);
   const length=held.outlet.distanceTo(hand);
   live.visible=true;
   if(length>HOSE_MAX_M){live.visible=false;return {limit:true,length}}
   writeHose(liveGeo,hoseCurve(held.outlet,hand,footing));
   return {limit:false,length}
  },
 };
 return ctl;
}
