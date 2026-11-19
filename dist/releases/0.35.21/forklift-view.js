// The forklift's drawing (0.35 step 5, DESIGN 4.16 D): three meshes made from forklift-assets.js (about 14,000 triangles, drawn only inside the warehouse, where the outdoor scene is not drawn):
// the body, the mast (stretches as the forks rise) and the carriage (forks, back plate: lifts), plus the pallet of planks on the forks. game.js imports this file only when the warehouse is first entered.
import * as THREE from './vendor/three.module.js';
import {FORKLIFT} from './forklift-assets.js';
import {PALLET,PALLET_CAP} from './pallets.js';
import {CARRY_Z,CARRY_DROP,heightOf} from './fork-pallets.js';
import {palletGeometry,BOARD,TONES,boardAt} from './pallet-geometry.js';

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
 // the pallet on the forks: the wooden pallet and its planks board by board (pallet-geometry.js), in one group that sits at the pallet's base
 const pallet=new THREE.Group();pallet.name='forklift-load';pallet.visible=false;group.add(pallet);
 const slab=new THREE.Mesh(palletGeometry(),new THREE.MeshStandardMaterial({color:'#8a6a40',roughness:.9}));slab.name='forklift-load-pallet';pallet.add(slab);
 const boards=new THREE.InstancedMesh(new THREE.BoxGeometry(BOARD.w,BOARD.t,BOARD.l),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9}),PALLET_CAP);boards.name='forklift-load-planks';boards.count=0;boards.frustumCulled=false;pallet.add(boards);
 const m4=new THREE.Matrix4(),at=new THREE.Vector3(),q0=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1);let shownLoad=-1;
 const mastHeight=FORKLIFT.mastTop-FORKLIFT.mastBase;
 const view={group,body,mast,carriage,pallet,boards,wheels,topY:0,triangles:FORKLIFT.triangles,
  // state {x, z, yaw, lift, steer, roll}; load: planks on the forks (0 = none). Rear-wheel steering: the rear wheels turn against the turn (forklift.js)
  set(s,load=0){group.position.set(s.x,0,s.z);group.rotation.y=s.yaw;for(const w of wheels){w.pivot.rotation.y=w.rear?-(s.steer||0):0;w.mesh.rotation.x=(s.roll||0)/w.radius}
   carriage.position.y=s.lift-FORKLIFT.tineTop;mast.scale.y=Math.max(1,(s.lift+.6-FORKLIFT.mastBase)/mastHeight);
   pallet.visible=load>0;view.topY=s.lift-CARRY_DROP+heightOf(load);
   if(load>0){pallet.position.set(0,s.lift-CARRY_DROP,CARRY_Z);if(load!==shownLoad){shownLoad=load;for(let i=0;i<load;i++){const b=boardAt(i);m4.compose(at.set(b.x,PALLET.h+b.y,0),q0,one);boards.setMatrixAt(i,m4);boards.setColorAt(i,TONES[i%TONES.length])}boards.count=load;boards.instanceMatrix.needsUpdate=true;if(boards.instanceColor)boards.instanceColor.needsUpdate=true}}else shownLoad=-1}};
 return view;
}
