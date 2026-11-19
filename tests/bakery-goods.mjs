import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as B from '../dist/bakery-goods.js';

// Bakery goods (owner decision 2026-11-19): flour and coffee beans replace planks as the bakery's restock. The registry, and the GLBs scripts/build-bakery-goods.mjs writes. Pure, no scene.
const {GOODS,GOOD_KEYS,VARIANTS,DEMAND,BAKERY}=B;
assert.deepEqual(GOOD_KEYS,['flour','coffee-beans'],'the two goods');
assert.equal(BAKERY,'property:alder-bakery');
assert.equal(B.SUPPLIER,'property:eden-wholesale','W-PLACE: Eden Wholesale supplies the bakery');assert.equal(B.SUPPLIER_LABEL,'Eden Wholesale');assert.equal(B.PLACEHOLDER,true);

// 1. Names unique, unit sack, prices and masses positive whole numbers, the asked targets and maxes.
const labels=GOOD_KEYS.map(k=>GOODS[k].label),paths=GOOD_KEYS.flatMap(k=>VARIANTS.map(v=>GOODS[k].models[v]));
assert.equal(new Set(labels).size,labels.length,'display names unique');assert.equal(new Set(paths).size,paths.length,'model paths unique');
for(const k of GOOD_KEYS){const g=GOODS[k];assert.equal(g.key,k);assert.equal(g.unit,'sack');assert(Number.isSafeInteger(g.baseCents)&&g.baseCents>0,`${k} price positive`);assert(Number.isSafeInteger(g.massKg)&&g.massKg>0);
 assert.equal(g.supplier,B.SUPPLIER);assert.equal(g.demand.place,BAKERY);assert(g.demand.target>0&&g.demand.max>g.demand.target);assert(Object.isFrozen(g)&&Object.isFrozen(g.models))}
assert.deepEqual([GOODS.flour.demand.target,GOODS.flour.demand.max],[6,18]);assert.deepEqual([GOODS['coffee-beans'].demand.target,GOODS['coffee-beans'].demand.max],[4,12]);
assert.deepEqual(DEMAND.flour[BAKERY],{label:'Ironwood Bakery',target:6,max:18},'the plank-needs DEMAND shape');
assert.equal(B.modelPath('flour','pallet'),'assets/goods/flour-pallet.glb');assert.equal(B.modelPath('flour'),'assets/goods/flour-sack.glb');assert.equal(B.modelPath('planks'),null);assert.equal(B.modelPath('flour','crate'),null);
assert.equal(B.priceOf('flour',3),5400);assert.equal(B.priceOf('flour',-1),0);assert.equal(B.priceOf('bread'),0);assert.equal(B.goodOf('nope'),null);
assert.deepEqual(B.palletsOf(9),{pallets:2,loose:1});assert.deepEqual(B.palletsOf(NaN),{pallets:0,loose:0});

// 2. Every model file exists and is a well-formed GLB: one mesh, one primitive, one material shared in form by all, vertex colours, base-centre origin, a sane size and triangle count.
const SIZE={sack:[[.3,.55],[.5,.75],[.2,.35]],carry:[[.5,.8],[.15,.3],[.35,.55]],pallet:[[.85,1],[.4,.65],[.7,.8]]},TRIS={sack:1000,carry:1000,pallet:3000};
let material=null;const report=[];
for(const k of GOOD_KEYS)for(const v of VARIANTS){const rel=GOODS[k].models[v],file=new URL('../dist/'+rel,import.meta.url);assert(existsSync(file),`${rel} exists (run node scripts/build-bakery-goods.mjs)`);
 const b=readFileSync(file);assert.equal(b.readUInt32LE(0),0x46546C67,`${rel}: glTF magic`);assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length,'the header length is the file length');
 const jl=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+jl)),bin=b.subarray(28+jl);assert.equal(b.readUInt32LE(24+jl),0x004E4942,'a BIN chunk');
 assert.equal(j.meshes.length,1);assert.equal(j.meshes[0].primitives.length,1,`${rel}: one primitive = one draw call`);assert.equal(j.materials.length,1,`${rel}: one material`);assert(!j.images&&!j.textures,'no textures');
 const m=JSON.stringify(j.materials[0]);if(material===null)material=m;assert.equal(m,material,'every file has the same material, so one shared vertex-colour material fits all');
 const p=j.meshes[0].primitives[0];assert.equal(p.attributes.COLOR_0,2,'vertex colours');const ca=j.accessors[p.attributes.COLOR_0];assert(ca.normalized&&ca.componentType===5121&&ca.type==='VEC4');
 const pa=j.accessors[p.attributes.POSITION],ia=j.accessors[p.indices],tris=ia.count/3;
 for(const a of j.accessors){const bv=j.bufferViews[a.bufferView];assert((bv.byteOffset||0)%4===0&&bv.byteOffset+bv.byteLength<=bin.length,'views inside the BIN chunk, 4-byte aligned')}
 const iv=j.bufferViews[ia.bufferView],T=ia.componentType===5123?Uint16Array:Uint32Array,idx=new T(bin.buffer.slice(bin.byteOffset+iv.byteOffset,bin.byteOffset+iv.byteOffset+ia.count*T.BYTES_PER_ELEMENT));
 assert(idx.every(i=>i<pa.count),'indices in range');
 const size=[0,1,2].map(i=>pa.max[i]-pa.min[i]);assert(Math.abs(pa.min[1])<1e-4,`${rel}: base at y 0`);assert(Math.abs(pa.min[0]+pa.max[0])<2e-3&&Math.abs(pa.min[2]+pa.max[2])<2e-3,`${rel}: centred on x and z`);
 SIZE[v].forEach(([lo,hi],i)=>assert(size[i]>=lo&&size[i]<=hi,`${rel}: size ${'xyz'[i]} ${size[i].toFixed(3)} within ${lo}..${hi}`));
 assert(tris>0&&tris<=TRIS[v],`${rel}: ${tris} triangles (budget ${TRIS[v]})`);
 if(v==='carry'){const c=GOODS[k].carrySize;['x','y','z'].forEach((a,i)=>assert(Math.abs(c[a]-size[i])<.01,`${k} carrySize.${a} ${c[a]} matches the model ${size[i].toFixed(3)}`))}
 report.push(`${k}-${v} ${tris}`)}
console.log(`PASS bakery-goods: 2 goods, 6 models (${report.join(', ')} triangles), supplier ${B.SUPPLIER}`);
