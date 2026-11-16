// The sr90 Low Poly Farming Pack (itch.io; no licence required, free to use) as DATA: 37 props, the water tower, 14 implements, trailers and combine parts. Nothing is placed in the map and nothing drives yet.
// Checks: the ids, sizes, bale real size, the combine's unloading auger node, wheel nodes kept as parts and pivots, origin on the ground, one mesh and one draw call each, no clash with the older farm ids.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS as CORE} from '../dist/props-assets.js';
import {propInfo,propGeometry,createProp,ensureFarmProps} from '../dist/props.js';
import {FARM_PROPS} from '../dist/props-assets-farm.js';
await ensureFarmProps(); // the farm.* records are a lazy module (props.js)
const PROPS={...CORE,...FARM_PROPS};
import {creditFor} from '../dist/credits.js';
const fade={apply:m=>m};
const PROP_IDS=['bale-round-hay','bale-round-strapped','bale-square-large','bale-square-small','bale-square-green-a','bale-square-straw','bale-square-green-b','bale-square-flat-green','bale-large-green',
 'crate-plastic-tall','crate-plastic-mid','crate-plastic-low','crate-wood-large-bin','crate-wood','box-wood-small','pallet-wood','barrel-drum-lid','barrel-drum-open','barrel-wood-cradle','barrel-wood-closed','barrel-wood-open',
 'trough-metal','trough-metal-hay','manger-wood','manger-wood-hay','trough-wood','trough-wood-hay','rack-v-unclear','bag-feed-green','bag-feed-open','sack-closed','sack-open-large','sack-tied','bucket-metal','bucket-wood','milk-can','wheelbarrow'].map(x=>'farm.'+x);
// vehicles, implements and trailers: id -> [file, triangles, wheel nodes (as parts and pivots)]
const MACHINES={'farm.seeder':['seeder',13716,[]],'farm.cultivator':['cultivator',2190,[]],'farm.harrow':['harrow',3715,[]],'farm.mower-bar':['mower_bar',7995,[]],'farm.mower-yellow':['mower_yellow',2407,[]],'farm.combine-header':['combine_header',7107,[]],
 'farm.baler-round':['baler_round',7098,['wheel_fl','wheel_fr','wheel_rl','wheel_rr']],'farm.rake-tedder':['rake_tedder',14336,['wheel_01','wheel_02','wheel_03','wheel_04','wheel_05','wheel_06','wheel_07','wheel_08']],
 'farm.sprayer':['sprayer',18553,['wheel_l','wheel_r']],'farm.spreader':['trailer_grain',6161,['wheel_l','wheel_r']],'farm.trailer-red':['trailer_red',14320,['wheel_fl','wheel_fr','wheel_rl','wheel_rr']],
 'farm.trailer-tank-sr90':['trailer_tank',12473,['wheel_fl','wheel_fr','wheel_ml','wheel_mr','wheel_rl','wheel_rr']],'farm.cart-small':['cart_small',5133,['wheel_l','wheel_r']],
 'farm.combine-harvester':['combine_harvester',16578,['wheel_fl','wheel_fr','wheel_rl','wheel_rr']]};
const ALL=[...PROP_IDS,'farm.water-tower',...Object.keys(MACHINES)];
assert.equal(new Set(ALL).size,ALL.length,'52 distinct ids');assert.equal(ALL.length,52);
for(const id of ALL){assert(PROPS[id],id+' is in props-assets.js');assert(PROPS[id].source.startsWith('Farm/sr90/'),id+' comes from the sr90 pack')}
// no clash: every id from the sr90 pack is in the list, and the older farm ids and the KidBi tank name are untouched
for(const [id,p] of Object.entries(PROPS))if(p.source.startsWith('Farm/sr90/'))assert(ALL.includes(id)||/^farm\.house-(brick|red)$/.test(id),id+' is a listed sr90 id'); // the two farmhouses are checked in tests/farm-houses.mjs
for(const id of ['farm.big-barn','farm.silo','farm.fence-a','farm.fence-b','farm.cow','farm.horse','farm.llama','farm.pig','farm.pug','farm.sheep','farm.zebra','barn','windmill'])assert(!PROPS[id].source.startsWith('Farm/sr90/'),id+' still the older model');
assert(!PROPS['farm.trailer-tank'],'the sr90 tank trailer is named farm.trailer-tank-sr90 (the KidBi tank keeps farm.trailer-tank)');
assert.equal(PROPS['farm.spreader'].source,'Farm/sr90/trailer_grain.glb','farm.spreader is the pack\'s Trailer_Grain (a fertiliser spreader)');
assert(creditFor('Farm/sr90/seeder.glb'),'the sr90 pack has a credit');
let tris=0;
const common=(id,minTris)=>{const info=propInfo(id),g=propGeometry(id),pos=g.attributes.position,box=new THREE.Box3().setFromBufferAttribute(pos);
 assert(info.triangles>=minTris&&g.index.count/3===info.triangles,`${id}: every triangle kept`);assert(pos.array.every(Number.isFinite)&&g.attributes.normal.array.every(Number.isFinite),id+': finite');
 assert(Math.abs(box.min.y)<.02,`${id}: lowest point on the ground (${box.min.y.toFixed(3)})`);assert(Math.abs(box.max.y-info.height)<.011,id+': height recorded');
 assert(info.col&&info.norQ&&!info.texture&&!info.uv&&info.door===null&&!info.glow,id+': flat colours baked to vertex colours, no texture');
 assert(info.footprint.x1>info.footprint.x0&&info.footprint.z1>info.footprint.z0&&info.colliders.length>=1,id+': footprint and collision boxes in the data');
 for(const c of info.colliders)assert(c.hx>0&&c.hz>0&&c.x-c.hx>=info.footprint.x0-.51&&c.x+c.hx<=info.footprint.x1+.51&&c.z-c.hz>=info.footprint.z0-.51&&c.z+c.hz<=info.footprint.z1+.51,id+': a box lies inside the footprint');
 const mesh=createProp(id,fade);assert(!Array.isArray(mesh.material),id+': one material, one draw call');tris+=info.triangles;return info};
for(const id of PROP_IDS){const info=common(id,50);assert(!info.parts&&!info.nodes,id+': a prop has no moving parts');
 assert(Math.abs(info.footprint.x0+info.footprint.x1)<.03&&Math.abs(info.footprint.z0+info.footprint.z1)<.03,id+': footprint centred (origin on the ground at the footprint centre)')}
// bales at REAL size: round about 1.5 m across (height) x 1.25 m wide, square about 0.9 m long and 0.4 to 0.55 m high
for(const id of ['farm.bale-round-hay','farm.bale-round-strapped']){const i=propInfo(id);assert(i.height>=1.4&&i.height<=1.6&&i.width>=1.1&&i.width<=1.4,`${id}: ${i.width} wide x ${i.height} tall`);assert(i.depth<=1.6,id+': ~1.5 m across')}
for(const id of ['farm.bale-square-large','farm.bale-square-small']){const i=propInfo(id);assert(Math.max(i.width,i.depth)>=.85&&Math.max(i.width,i.depth)<=.95,`${id}: about 0.9 m long`);assert(i.height>=.35&&i.height<=.55,`${id}: ${i.height} m high`)}
for(const id of ['farm.bale-square-green-a','farm.bale-square-straw','farm.bale-square-green-b','farm.bale-square-flat-green','farm.bale-large-green'])assert(Math.max(propInfo(id).width,propInfo(id).depth,propInfo(id).height)<=1.8,id+': silage blocks are no longer bigger than 1.8 m');
// the water tower: a tall tower on legs, boxes only at the legs
{const i=common('farm.water-tower',3000);assert(i.height>11&&i.height<13&&i.width>4&&i.width<5.5,'water tower 4.8 x 6.3 x 12.3 m');assert(i.colliders.length>=2&&i.colliders.length<=12,'the legs, not one block');assert(!i.parts)}
// machines: triangles kept, wheel nodes kept as triangle runs (parts) and pivots (nodes), anchors kept, origin kept (not centred)
for(const [id,[file,n,wheels]] of Object.entries(MACHINES)){const i=common(id,n);assert.equal(i.source,`Farm/sr90/${file}.glb`);assert.equal(i.triangles,n,id+': keeps every triangle');
 assert(i.anchors&&i.anchors.anchor_hitch_front||id==='farm.combine-harvester'||id==='farm.combine-header','a hitch anchor on '+id);
 const names=(i.parts||[]).filter(p=>p.name!=='body').map(p=>p.name);
 for(const w of wheels){assert(names.includes(w),`${id}: wheel part ${w} kept`);assert(Array.isArray(i.nodes[w])&&i.nodes[w].length===3,`${id}: pivot of ${w} kept`);assert(i.nodes[w][1]>.2&&i.nodes[w][1]<1.2,`${id}: ${w} hub height ${i.nodes[w][1]}`)}
 if(wheels.length){let at=0,total=0;for(const p of i.parts){assert.equal(p.from,at,`${id}: parts follow each other`);assert(p.count>0&&p.count%3===0);at+=p.count;total+=p.count}assert.equal(total,n*3,id+': the parts add up to every index');assert.equal(i.parts[0].name,'body')}
 else assert(!i.parts,id+': no wheels, no parts')}
// origin kept (rear axle or hitch contract): a long machine is not centred on its footprint
assert(Math.abs((PROPS['farm.combine-harvester'].footprint.z0+PROPS['farm.combine-harvester'].footprint.z1)/2)>1,'the combine keeps the file origin (the front axle)');
// the combine's unloading auger is its OWN node with its pivot at the base of the tube, and the tip anchor sits on it
{const c=propInfo('farm.combine-harvester'),a=c.parts.find(p=>p.name==='unload_auger');assert(a&&a.count/3>=250&&a.count/3<=400,'the auger is its own run of about 312 triangles');
 const piv=c.nodes.unload_auger,tip=c.nodes.unload_auger_tip;assert(piv&&tip,'auger pivot and tip are recorded');assert(Math.hypot(tip[0]-piv[0],tip[2]-piv[2])>7&&Math.hypot(tip[0]-piv[0],tip[2]-piv[2])<10,'the tip is about 8.6 m from the pivot (a long tube)');assert(piv[1]>3&&piv[1]<4.2,'the pivot is on top of the body');
 assert(c.nodes.seat&&c.anchors.anchor_header_mount,'seat and header mount kept');
 // the auger triangles lie beside the body, near the pivot..tip line: every auger vertex is within 1 m of the tube's axis
 const g=propGeometry('farm.combine-harvester'),pos=g.attributes.position,idx=g.index.array;let out=0;for(let k=a.from;k<a.from+a.count;k++){const v=idx[k],x=pos.getX(v),z=pos.getZ(v);const dx=tip[0]-piv[0],dz=tip[2]-piv[2],L=Math.hypot(dx,dz),t=((x-piv[0])*dx+(z-piv[2])*dz)/L/L,ex=piv[0]+dx*t-x,ez=piv[2]+dz*t-z;if(Math.hypot(ex,ez)>1.1)out++}
 assert.equal(out,0,'every auger vertex lies along the tube')}
// the extension is additive: older records have no parts or nodes
for(const id of ['barn','farm.big-barn','farm.cow','prop.pallet'])assert(!PROPS[id].parts&&!PROPS[id].nodes,id+' unchanged');
console.log(`sr90 farm pack: ${ALL.length} ids (${PROP_IDS.length} props, the water tower, ${Object.keys(MACHINES).length} machines), ${tris} triangles, one mesh and one draw call each, wheel and auger nodes kept as data`);
