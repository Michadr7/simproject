// The forklift's drawing (0.35 step 5, DESIGN 4.16 D): three meshes made from forklift-assets.js (about 14,000 triangles, drawn only inside the warehouse, where the outdoor scene is not drawn):
// the body, the mast (stretches as the forks rise) and the carriage (forks, back plate: lifts), plus the pallet of planks on the forks. game.js imports this file only when the warehouse is first entered.
import * as THREE from './vendor/three.module.js';
import {FORKLIFT} from './forklift-assets.js';
import {PALLET} from './pallets.js';
import {CARRY_Z,CARRY_DROP,heightOf} from './fork-pallets.js';

const fromBase64=(text,Type)=>{const bytes=typeof Buffer!=='undefined'?Uint8Array.from(Buffer.from(text,'base64')):Uint8Array.from(atob(text),c=>c.charCodeAt(0));return new Type(bytes.buffer)};
const linear=c=>{const s=c/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)};
function geometry(part){
 const p=FORKLIFT.parts[part],g=new THREE.BufferGeometry(),rgb=fromBase64(p.colors,Uint8Array),c=new Float32Array(rgb.length);for(let i=0;i<rgb.length;i++)c[i]=linear(rgb[i]);
 g.setAttribute('position',new THREE.BufferAttribute(fromBase64(p.positions,Float32Array),3));g.setAttribute('normal',new THREE.BufferAttribute(fromBase64(p.normals,Float32Array),3));g.setAttribute('color',new THREE.BufferAttribute(c,3));
 g.setIndex(new THREE.BufferAttribute(fromBase64(p.indices,Uint16Array),1));g.computeBoundingSphere();return g;
}
// the pallet on the forks: its base 9 cm under the tine tops, its middle CARRY_Z ahead of the body, as high as its planks (fork-pallets.js heightOf)
export function buildForklift(){
 const group=new THREE.Group();group.name='forklift';
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7,metalness:.15});
 const part=(id,name)=>{const m=new THREE.Mesh(geometry(id),material);m.name=name;m.castShadow=false;m.receiveShadow=false;m.frustumCulled=false;group.add(m);return m};
 const body=part('body','forklift-body'),mast=part('mast','forklift-mast'),carriage=part('carriage','forklift-carriage');
 mast.position.y=FORKLIFT.mastBase;
 // the wheels: each in a pivot at its axle; the pivot steers (rear only), the wheel spins about its axle
 const wheels=Object.entries(FORKLIFT.wheels).map(([id,w])=>{const pivot=new THREE.Group();pivot.position.set(...w.at);group.add(pivot);const m=new THREE.Mesh(geometry(id),material);m.name='forklift-'+id;m.frustumCulled=false;pivot.add(m);return {pivot,mesh:m,rear:id[5]==='R',radius:w.radius}});
 const pallet=new THREE.Mesh(new THREE.BoxGeometry(PALLET.w,1,PALLET.d),new THREE.MeshStandardMaterial({color:'#c79a5b',roughness:.85}));pallet.name='forklift-load';pallet.visible=false;group.add(pallet);
 const mastHeight=FORKLIFT.mastTop-FORKLIFT.mastBase;
 return {group,body,mast,carriage,pallet,wheels,triangles:FORKLIFT.triangles,
  // state {x, z, yaw, lift, steer, roll}; load: planks on the forks (0 = none). Rear-wheel steering: the rear wheels turn against the turn (forklift.js)
  set(s,load=0){group.position.set(s.x,0,s.z);group.rotation.y=s.yaw;for(const w of wheels){w.pivot.rotation.y=w.rear?-(s.steer||0):0;w.mesh.rotation.x=(s.roll||0)/w.radius}
   carriage.position.y=s.lift-FORKLIFT.tineTop;mast.scale.y=Math.max(1,(s.lift+.6-FORKLIFT.mastBase)/mastHeight);
   pallet.visible=load>0;if(load>0){const h=heightOf(load);pallet.scale.y=h;pallet.position.set(0,s.lift-CARRY_DROP+h/2,CARRY_Z)}}};
}
