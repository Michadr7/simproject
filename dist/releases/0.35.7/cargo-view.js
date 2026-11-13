// What a vehicle's cargo looks like (0.35): logs and plank stacks on its bed, drawn as two InstancedMeshes per vehicle (added only to vehicles with a bed; empty beds draw nothing).
// The positions come from cargo.js slotPositions, so the rules and the picture agree. A stack of planks is drawn as its boards, one instance each (up to four a stack, with a hair of gap, a slight wobble and a few wood tones), so it looks like a pile of boards and not one block; a part stack just has fewer boards.
import * as THREE from './vendor/three.module.js';
import {BEDS,CARGO_KINDS,slotPositions,capacity} from './cargo.js';

const BOARD={w:.22,t:.088,l:1.2,gap:.004},TONES=['#c99f63','#bf9358','#d3ab6e','#b78a50'].map(c=>new THREE.Color(c));
const geometries={log:new THREE.CylinderGeometry(.12,.12,1.15,8).rotateX(Math.PI/2),planks:new THREE.BoxGeometry(BOARD.w,BOARD.t,BOARD.l)};
const materials={log:new THREE.MeshStandardMaterial({color:'#8a6240',roughness:1}),planks:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9})}; // the boards are coloured one by one (setColorAt)
export function createCargoView(model){
 const group=new THREE.Group();group.name='cargo';if(!BEDS[model])return {group,set(){},count:()=>0};
 const meshes={};for(const kind of Object.keys(CARGO_KINDS)){const m=new THREE.InstancedMesh(geometries[kind],materials[kind],Math.max(1,capacity(model,kind)));m.name='cargo-'+kind;m.count=0;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;group.add(m);meshes[kind]=m}
 const mat=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);let shown='',stacks=0;
 return {group,
  set(cargo){const key=JSON.stringify(cargo||[]);if(key===shown)return;shown=key;const spots=slotPositions(model,cargo),n={log:0,planks:0};stacks=0;
   spots.forEach((sp,i)=>{const m=meshes[sp.kind],piece=cargo[i];
    if(sp.kind==='log'){q.setFromAxisAngle(up,sp.yaw);mat.compose(p.set(sp.x,sp.y,sp.z),q,s.set(1,1,1));m.setMatrixAt(n.log++,mat);return}
    stacks++;const base=sp.y-CARGO_KINDS.planks.h/2;
    for(let j=0;j<piece.n;j++){const a=(i*7+j*3)%5-2; // -2..2: the same wobble every time, so a board never jumps when the list changes elsewhere
     q.setFromAxisAngle(up,sp.yaw+a*.006);mat.compose(p.set(sp.x+a*.004,base+BOARD.t/2+j*(BOARD.t+BOARD.gap),sp.z+(j%2?-.03:.02)),q,s.set(1,1,1));m.setMatrixAt(n.planks,mat);m.setColorAt(n.planks++,TONES[(i+j)%TONES.length])}});
   for(const [kind,m] of Object.entries(meshes)){m.count=n[kind];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}},  count:kind=>kind==='planks'?stacks:meshes[kind]?.count||0, // planks: the number of stacks (pieces); boards() is the number of boards drawn
  boards:()=>meshes.planks?.count||0};
}
