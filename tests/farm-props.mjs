// The Quaternius farm set (CC0): the Farm Buildings Bundle (10 models) and the Farm Animal Pack (7 models) as props. Six buildings were shipped in 0.29 under their old ids; the rest are the 'farm.*' ids.
// Nothing here is placed in the map: sizes, ground, footprint, boxes, materials, draw calls and the animal clips only.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS} from '../dist/props-assets.js';
import {propInfo,propGeometry,createProp} from '../dist/props.js';
const fade={apply:m=>m};
// id: [source file, triangles, width range, depth range, height range, distinct colours, max collision boxes]
const BUILDINGS={
 barn:['Barn.glb',2910,[10,14],[10,13],[8,11],4,40],'small-barn':['Small Barn.glb',2176,[8,11],[8,11],[6,9],4,40],'open-barn':['Open Barn.glb',1612,[8,10],[9,11],[6,9],5,40],'silo-house':['Silo House.glb',2880,[7,10],[5,7],[13,15],7,40],coop:['ChickenCoop.glb',948,[3,4],[3,4],[2,3.5],5,40],windmill:['Tower Windmill.glb',4070,[9,11],[6,8],[13,16],7,40],
 'farm.big-barn':['Big Barn.glb',4220,[10,14],[11,14],[11,14],4,40],'farm.silo':['Silo.glb',1592,[5,6.5],[5,6.5],[13,15],5,40],
 'farm.fence-a':['Fence-e02PFKKhbr.glb',188,[5.7,6.1],[.1,.3],[1,1.3],1,1],'farm.fence-b':['Fence.glb',324,[5.7,6.1],[.1,.3],[1,1.3],1,1]};
// animals: [file, triangles, height range (m), length range, clips]
const ANIMALS={'farm.cow':['Cow.glb',796,[1.3,1.5],[2.2,2.8],6],'farm.horse':['Horse.glb',690,[1.6,1.8],[2,2.5],6],'farm.llama':['Llama.glb',661,[1.5,1.9],[1.2,1.7],2],'farm.pig':['Pig.glb',562,[.7,1],[1.5,2.1],2],'farm.pug':['Pug.glb',644,[.25,.45],[.35,.6],2],'farm.sheep':['Sheep.glb',610,[.8,1.1],[1,1.5],2],'farm.zebra':['Zebra.glb',1354,[1.3,1.6],[1.6,2.2],6]};
let triangles=0,calls=0;const rows=[];
const colours=g=>{const c=g.attributes.color,s=new Set();for(let k=0;k<c.count;k++)s.add([0,1,2].map(i=>c.array[k*3+i].toFixed(3)).join());return s.size};
const check=(id,[file,tris,w,d,h,cols,maxBoxes],animal)=>{
 const info=propInfo(id),g=propGeometry(id),pos=g.attributes.position,box=new THREE.Box3().setFromBufferAttribute(pos);
 assert.equal(info.triangles,tris,`${id}: ${file} keeps every triangle`);assert.equal(g.index.count/3,tris);assert(pos.array.every(Number.isFinite)&&g.attributes.normal.array.every(Number.isFinite),`${id}: finite`);
 assert(info.width>=w[0]&&info.width<=w[1],`${id}: ${info.width} m wide`);assert(info.depth>=d[0]&&info.depth<=d[1],`${id}: ${info.depth} m deep`);assert(info.height>=h[0]&&info.height<=h[1],`${id}: ${info.height} m tall`);
 assert(Math.abs(box.min.y)<.06,`${id}: the lowest point is on the ground (${box.min.y.toFixed(3)})`);assert(Math.abs(box.max.y-info.height)<.011);
 assert(Math.abs((box.min.x+box.max.x)/2)<.01&&Math.abs((box.min.z+box.max.z)/2)<.01,`${id}: footprint centred on the origin`);
 assert(Math.abs(info.footprint.x1-info.footprint.x0-info.width)<.02&&Math.abs(info.footprint.z1-info.footprint.z0-info.depth)<.02,`${id}: footprint recorded and matches the size`);
 assert(info.colliders.length>=1&&info.colliders.length<=maxBoxes,`${id}: ${info.colliders.length} collision boxes`);
 const tol=maxBoxes===1?.02:.51; // grid boxes (0.5 m cells) may overhang the footprint by up to a cell; a single it box is exact
for(const c of info.colliders)assert(c.hx>0&&c.hz>0&&c.x-c.hx>=info.footprint.x0-tol&&c.x+c.hx<=info.footprint.x1+tol&&c.z-c.hz>=info.footprint.z0-tol&&c.z+c.hz<=info.footprint.z1+tol,`${id}: a box lies inside the footprint`);
 assert(info.col&&info.norQ&&!info.texture&&!info.uv&&info.door===null&&info.floor===null&&!info.glow,`${id}: flat colours baked to vertex colours, no texture, no door, no deck`);
 const n=colours(g);assert(n>=1&&n<=cols,`${id}: ${n} flat colours`);
 const mesh=createProp(id,fade);assert(!Array.isArray(mesh.material),`${id}: one material`);calls++;triangles+=tris;rows.push(`${id.padEnd(15)} ${info.width.toFixed(1)} x ${info.depth.toFixed(1)} x ${info.height.toFixed(1)} m  ${String(tris).padStart(5)} tris  ${n} colours  ${info.colliders.length} boxes`);
 if(animal)return info;
 return info};
for(const [id,spec] of Object.entries(BUILDINGS))check(id,spec,false);
// 'a barn about 10 to 14 m wide': the two barns; a fence segment is one rail 5.9 m long with ONE exact box
for(const id of ['barn','farm.big-barn'])assert(propInfo(id).width>=10&&propInfo(id).width<=14,id+' is 10 to 14 m wide');
for(const id of ['farm.fence-a','farm.fence-b']){const c=propInfo(id).colliders[0];assert(Math.abs(c.hx*2-5.89)<.02&&Math.abs(c.hz*2-.17)<.02&&c.x===0&&c.z===0,id+': one box around the rail')}
// the six buildings shipped in 0.29 are the same bundle (same triangle counts as the bundle's files), kept under their old ids
assert(PROPS.barn.source.endsWith('Barn.glb')&&PROPS['silo-house'].source.endsWith('Silo House.glb'));
// animals: static rest pose, facing +z (the head is forward), the clip names and lengths kept
for(const [id,[file,tris,h,len,clips]] of Object.entries(ANIMALS)){
 const info=check(id,[file,tris,[.1,.8],len,h,{'farm.cow':3,'farm.llama':3}[id]||2,1],true);
 assert.equal(info.colliders.length,1,id+': one footprint box');assert.equal(info.clips.length,clips,`${id}: ${clips} clips kept as data`);assert(info.clips.every(c=>c.name&&c.seconds>0)&&info.clips.some(c=>c.name==='Idle'),id+': named clips with lengths, including Idle');
 const pos=propGeometry(id).attributes.position;let top=-1,sumZ=0,n=0;for(let i=0;i<pos.count;i++)top=Math.max(top,pos.getY(i));for(let i=0;i<pos.count;i++)if(pos.getY(i)>top*.7){sumZ+=pos.getZ(i);n++}
 assert(n>0&&Number.isFinite(sumZ),id+': has an upper part');assert(info.depth>info.width,id+': longer than wide (stands along z)')}
// the cow and the horse: head and neck are forward (+z): the upper 30% of the body sits forward of the centre
for(const id of ['farm.cow','farm.horse','farm.zebra']){const pos=propGeometry(id).attributes.position;let top=0;for(let i=0;i<pos.count;i++)top=Math.max(top,pos.getY(i));let s=0,n=0;for(let i=0;i<pos.count;i++)if(pos.getY(i)>top*.8){s+=pos.getZ(i);n++}assert(s/n>0,id+': the head and neck are on +z')}
assert(Math.abs(propInfo('farm.cow').height-1.4)<.02,'a cow is 1.4 m tall');
assert.equal(calls,17,'17 farm props, one draw call each');
console.log(`Farm props: ${calls} models (${triangles} triangles in all, one mesh, one material, one draw call each; flat colours baked to vertex colours):\n`+rows.join('\n'));
