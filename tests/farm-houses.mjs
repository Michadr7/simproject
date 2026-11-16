// The two sr90 farmhouses (stage SR2): House_Brick and House_Red, baked from the pack's textures to vertex colours (scripts/farm-sr90-bake.py) and simplified to about 8,000 triangles. Data only: nothing is placed in the map.
// Checks: ids and source, about 8,000 triangles, a plausible house size, ground at y = 0, footprint centred, wall boxes, front (door side) toward +z, flat colours in one mesh and one draw call, credit.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS as CORE} from '../dist/props-assets.js';
import {propInfo,propGeometry,createProp,ensureFarmProps} from '../dist/props.js';
import {FARM_PROPS} from '../dist/props-assets-farm.js';
import {creditFor} from '../dist/credits.js';
await ensureFarmProps();
const fade={apply:m=>m};
assert(!CORE['farm.house-brick']&&!CORE['farm.house-red'],'the houses live in the lazy farm module');
// id: [source, width range, depth range, height range, min distinct colours]
const HOUSES={'farm.house-brick':['Farm/sr90/house_brick.glb',[12,16],[13,17],[9,13],12],'farm.house-red':['Farm/sr90/house_red.glb',[14,18],[9,13],[6.5,10],10]};
const colours=g=>{const c=g.attributes.color,s=new Set();for(let k=0;k<c.count;k++)s.add([0,1,2].map(i=>c.array[k*3+i].toFixed(3)).join());return s.size};
let tris=0;
for(const [id,[source,w,d,h,minCols]] of Object.entries(HOUSES)){
 assert(FARM_PROPS[id],id+' is in props-assets-farm.js');const info=propInfo(id),g=propGeometry(id),pos=g.attributes.position,box=new THREE.Box3().setFromBufferAttribute(pos);
 assert.equal(info.source,source);assert(info.triangles>=7500&&info.triangles<=8100&&g.index.count/3===info.triangles,`${id}: about 8,000 triangles (${info.triangles})`);
 assert(pos.array.every(Number.isFinite)&&g.attributes.normal.array.every(Number.isFinite),id+': finite');
 assert(info.width>=w[0]&&info.width<=w[1]&&info.depth>=d[0]&&info.depth<=d[1]&&info.height>=h[0]&&info.height<=h[1],`${id}: ${info.width} x ${info.depth} x ${info.height} m is a house`);
 assert(Math.abs(box.min.y)<.03,`${id}: ground at y = 0 (${box.min.y.toFixed(3)})`);assert(Math.abs(box.max.y-info.height)<.011);
 assert(Math.abs((box.min.x+box.max.x)/2)<.01&&Math.abs((box.min.z+box.max.z)/2)<.01,id+': footprint centred on the origin');
 assert(Math.abs(info.footprint.x1-info.footprint.x0-info.width)<.02&&Math.abs(info.footprint.z1-info.footprint.z0-info.depth)<.02,id+': footprint matches the size');
 assert(info.colliders.length>=8&&info.colliders.length<=80,`${id}: ${info.colliders.length} wall boxes`);
 for(const c of info.colliders)assert(c.hx>0&&c.hz>0&&c.x-c.hx>=info.footprint.x0-.51&&c.x+c.hx<=info.footprint.x1+.51&&c.z-c.hz>=info.footprint.z0-.51&&c.z+c.hz<=info.footprint.z1+.51,id+': a box lies inside the footprint');
 assert(info.col&&info.norQ&&!info.texture&&!info.uv&&!info.glow&&!info.parts&&!info.nodes,id+': flat colours baked to vertex colours, no texture, no moving parts');
 const n=colours(g);assert(n>=minCols&&n<=40,`${id}: ${n} baked colours`);
 const mesh=createProp(id,fade);assert(mesh instanceof THREE.Mesh&&!Array.isArray(mesh.material),id+': one mesh, one material, one draw call');tris+=info.triangles;
 // the front is +z: the porch roof and door stand on the +z end (measured: brick 4.2 m there against 3.2 m at the back; red 4.2 m against 0.5 m, the back being a low stone terrace)
 let fy=0,by=0;for(let i=0;i<pos.count;i++){const z=pos.getZ(i);if(z>info.footprint.z1-1.2)fy=Math.max(fy,pos.getY(i));if(z<info.footprint.z0+1.2)by=Math.max(by,pos.getY(i))}
 assert(fy>3.5&&fy>by+.5,`${id}: the porch is on the +z end (front ${fy.toFixed(2)} m, back ${by.toFixed(2)} m)`);
}
assert(creditFor('Farm/sr90/house_brick.glb')&&creditFor('Farm/sr90/house_red.glb'),'the sr90 credit covers the houses');
console.log(`Farm houses: PASS (${Object.keys(HOUSES).length} ids, ${tris} triangles, ~8,000 each, one mesh and one draw call each, real size, lazy module)`);
