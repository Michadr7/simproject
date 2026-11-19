import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import * as E from '../dist/eden-wholesale.js';
import {GOOD_KEYS} from '../dist/bakery-goods.js';

// Eden Wholesale (owner decision 2026-11-19): the flour and coffee-bean supplier for Ironwood Bakery. The registry, and the GLB scripts/build-eden-wholesale.mjs writes. Pure, no scene.
assert.equal(E.ID,'eden-wholesale');assert.equal(E.NAME,'Eden Wholesale');assert.equal(E.OWNER,'Bruce Hughes');assert.equal(E.PLACEHOLDER,true);
assert.deepEqual([...E.GOODS_SOLD],['flour','coffee-beans']);assert.deepEqual([...E.GOODS_SOLD],[...GOOD_KEYS],'the goods come from bakery-goods.js');
assert(E.sells('flour')&&E.sells('coffee-beans')&&!E.sells('planks'));
assert.deepEqual([...E.HOURS],[420,1020]);assert.equal(E.HOURS_LABEL,'07:00-17:00');
assert(!E.isOpen(419)&&E.isOpen(420)&&E.isOpen(1019)&&!E.isOpen(1020)&&E.isOpen(420+1440)&&!E.isOpen(NaN));

// 1. The anchors sit where they should: door on the front wall inside the footprint width, the counter and truck in front, dock, pickup and stock on the dock apron.
const {SIZE,DOOR,COUNTER,DOCK,PICKUP,TRUCK_BAY,STOCK,SIGN,ANCHORS,SOLIDS}=E,hw=SIZE.w/2,hd=SIZE.d/2;
assert.deepEqual([SIZE.w,SIZE.d],[12,9]);assert(SIZE.h>5&&SIZE.h<7);
assert(Math.abs(DOOR.x)+DOOR.width/2<hw&&DOOR.z>0&&DOOR.z<=hd&&DOOR.facing==='+z');
assert(COUNTER.z>hd&&Math.abs(COUNTER.x-DOOR.x)<.01,'the counter prompt stands outside, in front of the door');
const onDock=p=>p.x>1.4&&p.x<hw&&p.z>1.2&&p.z<=hd;
assert(onDock(PICKUP)&&onDock(DOCK)&&Math.abs(DOCK.z-hd)<1e-9,'pickup on the dock, dock point on its front edge');
for(const g of GOOD_KEYS)assert(onDock(STOCK[g]),`stock spot ${g} on the dock`);
assert(TRUCK_BAY.z-hd>3.5&&Math.abs(TRUCK_BAY.x-DOCK.x)<.01,'the truck stands clear of the front, in line with the dock');
const inSolid=p=>SOLIDS.some(s=>p.x>s.x0&&p.x<s.x1&&p.z>s.z0&&p.z<s.z1);
for(const p of [COUNTER,DOCK,PICKUP,TRUCK_BAY,...Object.values(STOCK)])assert(!inSolid(p),'no anchor inside a solid');
assert.equal(SIGN.node,'sign_eden_wholesale');assert.equal(SIGN.text,'EDEN WHOLESALE');assert(SIGN.width>5&&SIGN.height>.5&&SIGN.y-SIGN.height/2>DOOR.height);assert.equal(SIGN.baked,true,'v2: the words are in the model');
// v2: the staff door on the west wall (Barber's Walk side on site 1), the lamps on the walls / under the canopy, and their anchors
const {SIDE_DOOR,LAMPS}=E;assert(SIDE_DOOR.x===-hw&&SIDE_DOOR.facing==='-x'&&SIDE_DOOR.z-SIDE_DOOR.width/2>-hd&&SIDE_DOOR.z+SIDE_DOOR.width/2<1.2,'side door on the west wall of the hall');
assert(Math.abs(Math.sin(SIDE_DOOR.yaw)+1)<1e-9,'side door yaw faces -x');assert.deepEqual(ANCHORS.anchor_side_door,[SIDE_DOOR.x,0,SIDE_DOOR.z]);
assert.deepEqual(LAMPS.map(l=>l.id),['shop-w','shop','shop-e','dock-w','dock-e','side','back']);
for(const l of LAMPS){assert(Math.abs(l.x)<=hw+.2&&l.z>=-hd-.2&&l.z<=hd&&l.y>2&&l.y<5,`lamp ${l.id} on the building`);assert.deepEqual(ANCHORS['anchor_lamp_'+l.id],[l.x,l.y,l.z])}
assert(LAMPS.some(l=>l.kind==='gooseneck'&&Math.abs(l.x-DOOR.x)<1e-9),'a lamp over the shop door');assert(LAMPS.filter(l=>l.kind==='canopy').every(l=>l.x>1.4&&l.z>1.2),'dock lamps over the dock');

// 2. worldPoint / footprintAt, and the two candidate sites stay inside the Ironwood zone and off every listed plot and the car park (notes/ironwood-city-design.md 1.4).
assert.deepEqual(E.worldPoint([1,0,2],{x:10,z:20,yaw:0}),{x:11,y:0,z:22});
const n=E.worldPoint([0,0,1],{x:0,z:0,yaw:Math.PI});assert(Math.abs(n.z+1)<1e-9&&Math.abs(n.x)<1e-9,'yaw PI faces north (-z)');
const TAKEN={C1:[-20,-7,-81,-63.5],C2:[-7,3,-81,-70],C3:[3,14,-81,-69],C4:[14,21.5,-81,-71.5],C5:[21.5,28.5,-81,-73],C6:[28.5,36,-81,-72.5],C7:[36,43,-81,-72],C8:[-20,-6.5,-108,-99],C9:[-6.5,1,-108,-99],C10:[1,9,-107,-99],
 C11:[57,69,-81,-73.5],C12:[57,69,-66,-59],C13:[57,69,-59,-52],C14:[57,69,-109.5,-99],C15:[57,69,-117,-109.5],C16:[57,69,-124.5,-117],C17:[57,69,-133,-124.5],C18:[-20,-6.5,-131,-122],C19:[-6.5,1,-131,-122],C20:[1,9,-131,-122],
 H1:[10,37,-132,-120],plaza:[57,69,-73.5,-66],'alder-lot':[-14,45,-63,-52],'main-street':[-30,84,-99,-81],'ironwood-street':[43,57,-142,-3.5],'river-street':[-30,50,-142,-131],'barbers-walk':[21.5,28.5,-80.7,-63]};
assert.equal(E.SITE_CANDIDATES.length,2);
for(const s of E.SITE_CANDIDATES){const f=E.footprintAt(s.pose);assert(Math.abs((f.x1-f.x0)*(f.z1-f.z0)-108)<1e-6,`${s.id}: 12 x 9`);
 assert(f.x0>=-20&&f.x1<=70&&f.z0>=-142&&f.z1<=-48,`${s.id}: inside the Ironwood zone`);
 for(const [id,[x0,x1,z0,z1]] of Object.entries(TAKEN))assert(!(f.x0<x1&&f.x1>x0&&f.z0<z1&&f.z1>z0),`${s.id} overlaps ${id}`)}

// 3. The GLB: well formed, one mesh / primitive / material, vertex colours, no textures, footprint 12 x 9 from the origin, under the triangle budget, anchors and the sign node match the registry.
const file=new URL('../dist/'+E.MODEL,import.meta.url);assert(existsSync(file),`${E.MODEL} exists (run node scripts/build-eden-wholesale.mjs)`);
const b=readFileSync(file);assert.equal(b.readUInt32LE(0),0x46546C67,'glTF magic');assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
const jl=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+jl)),bin=b.subarray(28+jl);assert.equal(b.readUInt32LE(24+jl),0x004E4942,'a BIN chunk');
assert.equal(j.meshes.length,1);assert.equal(j.meshes[0].primitives.length,1,'one primitive = one draw call');assert.equal(j.materials.length,1);assert(!j.images&&!j.textures,'no textures');
const mat=j.materials[0];assert.deepEqual([mat.pbrMetallicRoughness.metallicFactor,mat.pbrMetallicRoughness.roughnessFactor,mat.doubleSided],[0,.95,true],'the goods material numbers');
const p=j.meshes[0].primitives[0],ca=j.accessors[p.attributes.COLOR_0];assert(ca.normalized&&ca.componentType===5121&&ca.type==='VEC4','vertex colours');
const pa=j.accessors[p.attributes.POSITION],ia=j.accessors[p.indices],tris=ia.count/3;
for(const a of j.accessors){const bv=j.bufferViews[a.bufferView];assert((bv.byteOffset||0)%4===0&&bv.byteOffset+bv.byteLength<=bin.length,'views inside the BIN chunk, 4-byte aligned')}
const iv=j.bufferViews[ia.bufferView],T=ia.componentType===5123?Uint16Array:Uint32Array,idx=new T(bin.buffer.slice(bin.byteOffset+iv.byteOffset,bin.byteOffset+iv.byteOffset+ia.count*T.BYTES_PER_ELEMENT));
assert(idx.every(i=>i<pa.count),'indices in range');
assert(Math.abs(pa.min[1])<1e-4,'base at y 0');assert(pa.max[1]>=SIZE.wallH&&pa.max[1]<=SIZE.h+.05,`height ${pa.max[1]}`);
assert(pa.min[0]>=-hw-.15&&pa.max[0]<=hw+.15&&pa.min[2]>=-hd-.15&&pa.max[2]<=hd+.01,'inside the 12 x 9 footprint (small trims only; nothing past the front)');
assert(tris>500&&tris<=3500,`${tris} triangles (soft budget 3500)`);
const glow=j.meshes[0].extras?.glow;assert(glow&&glow.from+glow.count===ia.count&&glow.count%3===0&&glow.count/3>=2*LAMPS.length,'the lamp lenses are the last triangles (mesh extras.glow, the props-assets glow shape)');
const nodes=Object.fromEntries(j.nodes.filter(nd=>nd.mesh===undefined).map(nd=>[nd.name,nd.translation]));
for(const [name,t] of Object.entries(ANCHORS))assert.deepEqual(nodes[name],t,`GLB ${name} matches the registry (rebuild the GLB after editing dist/eden-wholesale.js)`);
assert.deepEqual(nodes[SIGN.node],[SIGN.x,SIGN.y,SIGN.z],'the sign node');const sx=j.nodes.find(nd=>nd.name===SIGN.node).extras;assert.equal(sx.text,SIGN.text);
assert(sx.baked&&sx.letterHeight>=.3&&sx.letterHeight<SIGN.height,'baked letters fit the board');
console.log(`PASS eden-wholesale: ${tris} triangles (${glow.count/3} lamp-lens), ${Object.keys(ANCHORS).length} anchors (${LAMPS.length} lamps, side door) + sign node (letters ${sx.letterHeight} m), sells ${E.GOODS_SOLD.join(' and ')}, open ${E.HOURS_LABEL}, ${E.SITE_CANDIDATES.length} candidate sites clear of C1..C20, H1 and the car park`);
