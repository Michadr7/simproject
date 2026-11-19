// What a vehicle's cargo looks like (0.35): logs and plank stacks on its bed, drawn as two InstancedMeshes per vehicle (added only to vehicles with a bed; empty beds draw nothing).
// The positions come from cargo.js slotPositions, so the rules and the picture agree. A stack of planks is drawn as its boards, one instance each (up to four a stack, with a hair of gap, a slight wobble and a few wood tones), so it looks like a pile of boards and not one block; a part stack just has fewer boards.
import * as THREE from './vendor/three.module.js';
import {BEDS,CARGO_KINDS,slotPositions,capacity,spaceOf} from './cargo.js';
import {createProp} from './props.js';

// G3b: crates (prop.crate-bin, 156 triangles, one 256 px texture) are ONE InstancedMesh per vehicle that takes crates = one draw call however many, made on the first crate and sharing one geometry and material
let crateProto=null;const crateParts=()=>crateProto||(crateProto=createProp('prop.crate-bin',{apply:m=>m}));
let boxProto=null;const boxParts=()=>boxProto||(boxProto=createProp('prop.carton-medium',{apply:m=>m})),BOX_H=.3; // audit #8: a box on a bed (C-B) is the medium carton, ONE InstancedMesh per vehicle like the crates; BOX_H: its drawn height (cargo.js PIECE_H.box), the model's origin is the middle of its base
// T-E: trunks and slabs are the owner's timber GLBs (dist/assets/timber, loaded by game.js with GLTFLoader): game.js hands their {geometry, material} over with setTimberParts; until then (or if a model fails to load) they are not drawn.
// One InstancedMesh per kind per vehicle, made on the first trunk or slab (one draw call each, however many). The models lie along x with their origin at the bottom middle.
const timberParts={},views=new Set();
export function setTimberParts(parts){for(const k of ['trunk','slab'])if(parts?.[k]?.geometry)timberParts[k]=parts[k];for(const v of views)v.refresh()}

const BOARD={w:.22,t:.088,l:1.2,gap:.004},TONES=['#c99f63','#bf9358','#d3ab6e','#b78a50'].map(c=>new THREE.Color(c));
const geometries={log:new THREE.CylinderGeometry(.12,.12,1.15,8).rotateX(Math.PI/2),planks:new THREE.BoxGeometry(BOARD.w,BOARD.t,BOARD.l)};
const materials={log:new THREE.MeshStandardMaterial({color:'#8a6240',roughness:1}),planks:new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.9})}; // the boards are coloured one by one (setColorAt)
const LONG=new Set(['crate','trunk','slab']); // made on demand, not up front
export function createCargoView(model){
 const group=new THREE.Group();group.name='cargo';if(!BEDS[model])return {group,set(){},refresh(){},count:()=>0};
 const meshes={};for(const kind of Object.keys(CARGO_KINDS)){if(LONG.has(kind))continue;const m=new THREE.InstancedMesh(geometries[kind],materials[kind],Math.max(1,capacity(model,kind)));m.name='cargo-'+kind;m.count=0;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;group.add(m);meshes[kind]=m}
 const crateMax=capacity(model,'crate'),mat=new THREE.Matrix4(),q=new THREE.Quaternion(),p=new THREE.Vector3(),s=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);let shown='',stacks=0,last=null;
 const timberMesh=kind=>{if(meshes[kind])return meshes[kind];const pr=timberParts[kind],max=capacity(model,kind);if(!pr||!max)return null;const m=new THREE.InstancedMesh(pr.geometry,pr.material,max);m.name='cargo-'+kind;m.count=0;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;group.add(m);meshes[kind]=m;return m};
 const view={group,
  set(cargo){last=cargo;const key=JSON.stringify(cargo||[]);if(key===shown)return;shown=key;const spots=slotPositions(model,cargo),n={log:0,planks:0,crate:0,box:0,trunk:0,slab:0};stacks=0;
   spots.forEach((sp,i)=>{if(sp.kind==='crate'){if(crateMax&&!meshes.crate){const pr=crateParts(),m=new THREE.InstancedMesh(pr.geometry,pr.material,crateMax);m.name='cargo-crate';m.count=0;m.castShadow=m.receiveShadow=true;m.frustumCulled=false;group.add(m);meshes.crate=m}
    if(meshes.crate&&n.crate<crateMax){q.setFromAxisAngle(up,sp.yaw);mat.compose(p.set(sp.x,sp.y-CARGO_KINDS.crate.h/2,sp.z),q,s.set(1,1,1));meshes.crate.setMatrixAt(n.crate++,mat)}return} // the crate model's base is at y 0
    if(sp.kind==='trunk'||sp.kind==='slab'){const tm=timberMesh(sp.kind);if(tm&&n[sp.kind]<tm.instanceMatrix.count){q.setFromAxisAngle(up,sp.yaw+Math.PI/2);mat.compose(p.set(sp.x,sp.y-CARGO_KINDS[sp.kind].h/2,sp.z),q,s.set(1,1,1));tm.setMatrixAt(n[sp.kind]++,mat)}return} // T-E: the model lies along x: a quarter turn lays it lengthwise along the bed (yaw 0 = along z)
    const m=meshes[sp.kind],piece=cargo[i];
    if(sp.kind==='log'){q.setFromAxisAngle(up,sp.yaw);mat.compose(p.set(sp.x,sp.y,sp.z),q,s.set(1,1,1));m.setMatrixAt(n.log++,mat);return}
    if(sp.kind==='box'){if(!meshes.box){const pr=boxParts(),bm=new THREE.InstancedMesh(pr.geometry,pr.material,Math.max(1,spaceOf(model)));bm.name='cargo-box';bm.count=0;bm.castShadow=bm.receiveShadow=true;bm.frustumCulled=false;group.add(bm);meshes.box=bm}
     q.setFromAxisAngle(up,sp.yaw);mat.compose(p.set(sp.x,sp.y-BOX_H/2,sp.z),q,s.set(1,1,1));meshes.box.setMatrixAt(n.box++,mat);return} // audit #8: a box is the medium carton (the one in the hands), made on the first box
    if(sp.kind!=='planks')return; // audit #8: the gig parcel is game.js's own mesh (syncParcel); anything else is never a plank stack
    stacks++;const base=sp.y-CARGO_KINDS.planks.h/2;
    for(let j=0;j<piece.n;j++){const a=(i*7+j*3)%5-2; // -2..2: the same wobble every time, so a board never jumps when the list changes elsewhere
     q.setFromAxisAngle(up,sp.yaw+a*.006);mat.compose(p.set(sp.x+a*.004,base+BOARD.t/2+j*(BOARD.t+BOARD.gap),sp.z+(j%2?-.03:.02)),q,s.set(1,1,1));m.setMatrixAt(n.planks,mat);m.setColorAt(n.planks++,TONES[(i+j)%TONES.length])}});
   for(const [kind,m] of Object.entries(meshes)){m.count=n[kind];m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true}},
  refresh(){shown='';view.set(last)}, // T-E: the timber models arrived: draw what is already on the bed
  count:kind=>kind==='planks'?stacks:meshes[kind]?.count||0, // planks: the number of stacks (pieces); boards() is the number of boards drawn
  boards:()=>meshes.planks?.count||0};
 views.add(view);return view;
}
