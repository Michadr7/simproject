import assert from 'node:assert/strict';
import {statSync,readFileSync} from 'node:fs';
import {PROPS} from '../dist/props-assets.js';
import {FARM_PROPS} from '../dist/props-assets-farm.js';
import {propInfo,propGeometry,createProp} from '../dist/props.js';
import {CARGO_KINDS} from '../dist/cargo.js';
// G3b: the shipping cartons (AssetsFactory 'Free Realistic Cardboard Boxes' v1.1, BaseColor only) and the two Cargo.glb crates (Fab): true size, one 256 px texture and ONE material each, in the startup module, small.
const SIZE={'prop.carton-small':[.3,.2,.15],'prop.carton-small-dirty':[.3,.2,.15],'prop.carton-small-crushed':[.35,.25,.09],'prop.carton-medium':[.4,.3,.3],'prop.carton-medium-dirty':[.4,.3,.31],'prop.carton-cube':[.35,.35,.35],'prop.crate-wood':[.76,.75,.49],'prop.crate-bin':[.58,.38,.44]};
const fade={apply:m=>m};
for(const [id,[w,d,h]] of Object.entries(SIZE)){
 assert(PROPS[id]&&!FARM_PROPS[id],id+' ships in the startup module (small), not the lazy farm one');
 const i=propInfo(id);assert(Math.abs(i.width-w)<.011&&Math.abs(i.depth-d)<.011&&Math.abs(i.height-h)<.011,`${id}: ${w} x ${d} x ${h} m, got ${i.width} x ${i.depth} x ${i.height}`);
 assert(i.texture.startsWith('data:image/jpeg;base64,')&&i.uv&&!i.col,id+': one jpeg texture');assert(i.texture.length<30e3,id+': texture under 30 KB ('+i.texture.length+')');
 assert.equal(i.colliders.length,1,id+': one collider box');
 const g=propGeometry(id);assert.equal(g.attributes.position.array.every(Number.isFinite),true);const bb=g.boundingBox||(g.computeBoundingBox(),g.boundingBox);assert(Math.abs(bb.min.y)<.01,id+': base on y 0');assert(Math.abs(bb.min.x+bb.max.x)<.02&&Math.abs(bb.min.z+bb.max.z)<.02,id+': centred on x and z');
 const m=createProp(id,fade);assert(m.isMesh&&!Array.isArray(m.material)&&m.children.length===0,id+': ONE mesh, ONE material, one draw call');
}
// the cargo crate's numbers are the model's
{const i=propInfo('prop.crate-bin'),k=CARGO_KINDS.crate;assert(Math.abs(i.width-k.w)<.02&&Math.abs(i.depth-k.l)<.02&&Math.abs(i.height-k.h)<.02,'cargo.js crate size = prop.crate-bin')}
assert(propInfo('prop.crate-bin').triangles<=200&&propInfo('prop.crate-wood').triangles<=300,'the crates are cheap (156 and 284 triangles)');
// the startup module grew by less than 1.5 MB for all eight (was 6,974,968 bytes before G3b)
{const size=statSync(new URL('../dist/props-assets.js',import.meta.url)).size;assert(size-6974968<1.5e6,'props-assets.js grew by '+(size-6974968)+' bytes');assert(size-6974968>0)}
// the originals never ship: no Cargo.glb texture, no Boxes folder in dist
{const text=readFileSync(new URL('../dist/props-assets.js',import.meta.url),'utf8');assert(!text.includes('Cargo.glb'),'the 317 MB source is never referenced by the shipped module')}
console.log('PASS cartons.mjs: 6 cartons and 2 crates at true size, one 256 px jpeg and one material each (one draw call), centred on the ground, startup module +'+((statSync(new URL('../dist/props-assets.js',import.meta.url)).size-6974968)/1e6).toFixed(2)+' MB, cargo.js crate = the model');