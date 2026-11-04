import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {PROPS} from '../dist/props-assets.js';
import {propInfo,propGeometry,createProp,createPropInstances} from '../dist/props.js';
import {createWorld,DIRT_ROADS,FIELDS,zoneAt} from '../dist/world.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import {terrain,SURFACE} from '../dist/terrain.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// ── The converted models: [triangles, width, height] each (scripts/build-props.mjs; a deliberate change means updating this table) ──────────────
const EXPECT={'house-a':[1174,10.4,6.7],'house-e':[1731,10.4,9.1],'house-h':[770,10.4,5.9],'house-c':[1196,10.3,8.3],'house-j':[1210,11,8.3],'house-l':[1310,8.3,8.4],'house-o':[1326,10.2,9.1],'house-r':[1030,8.2,9.1],'house-t':[2062,10.5,9.3],
 'shop-e':[1509,13.1,7.1],'shop-i':[2544,9.9,13.4],'shop-l':[3512,11,18.2],'shop-a':[1252,7.1,10.3],'shop-c':[1195,7.1,7.1],'shop-d':[1100,6.7,10.3],'shop-f':[1794,6.7,13.5],'shop-g':[2006,7.8,13.5],'shop-h':[1512,7.1,10.3],store:[528,13,7],barn:[2910,12,9.3],'small-barn':[2176,9.4,7.7],'open-barn':[1612,8.9,7.4],'silo-house':[2880,8.3,14.1],coop:[948,3.6,2.8],windmill:[4070,9.9,14.3],hut:[632,6.5,5.7],log:[202,2.8,.8],
 car:[2764,1.8,1.2],suv:[3062,2.2,1.7],'sports-car':[2842,1.8,1.3],'police-car':[3016,2,1.5],taxi:[2804,1.8,1.4],'car-2':[2894,2,1.5],'sports-car-2':[2948,1.9,1.3],pickup:[4442,2.3,1.8],flatbed:[3024,4.2,3.8],
 // furniture (Kenney Furniture Kit, 2 m per model unit)
 'f-bed-double':[364,1.9,.8],'f-bed-single':[314,1.1,.7],'f-sofa':[256,2,.9],'f-coffee-table':[248,1.3,.5],'f-table':[240,1.7,.7],'f-chair':[340,.4,.9],'f-tv':[144,1.4,.9],'f-tv-cabinet':[308,1.6,.6],'f-bookcase':[640,.8,1.8],'f-wardrobe':[536,.8,1.7],'f-desk':[352,1.5,.8],'f-desk-chair':[656,.7,1.2],
 // Eastbank Works (Kenney City Kit Industrial, 8 m per model unit): four solid buildings, three containers, a tank
 'industrial-q':[2062,17.1,7],'industrial-t':[1586,13.8,8.1],'industrial-s':[876,17,6.7],'industrial-p':[1162,13.5,5.7],'container-a':[402,3,2.8],'container-b':[402,3,2.8],'container-c':[402,3,2.8],'tank-small':[310,6.8,3.3],
 // pallets, boxes, crates and loading-zone props (the project owner's own models, true size, assets/*.glb)
 'prop.pallet':[204,1.2,.14],'prop.box-small':[36,.4,.3],'prop.box-medium':[36,.6,.4],'prop.crate-large':[264,1.03,.8],'prop.pallet-small-boxes':[636,1.2,.74],'prop.pallet-medium-boxes':[492,1.2,.94],'prop.pallet-crate':[468,1.2,.94],'prop.zone-bollard':[236,.3,.87],'prop.zone-sign-unload':[108,.92,2.3],'prop.zone-sign-pickup':[108,.92,2.3],'prop.dock-plate':[212,2,.06],
 // gas-station props (own models, true size, file origin kept)
 'prop.fuel-pump':[252,.64,1.73],'prop.fuel-pump-diesel':[252,.64,1.73],'prop.fuel-nozzle':[84,.05,.03],'prop.fuel-nozzle-diesel':[84,.05,.03],'prop.pump-island':[672,3.4,1.91],'prop.forecourt-canopy':[456,12.08,5.59],
 'f-cabinet':[188,.9,.9],'f-sink':[596,.9,1],'f-stove':[1604,.9,.9],'f-fridge':[584,1,1.8],'f-toilet':[440,.6,.9],'f-bath':[1204,2.4,.8],'f-bath-sink':[632,.7,1.1],'f-lamp':[152,.3,1.7],'f-rug':[56,3.1,0],'f-plant':[104,.4,1.3],'f-stairs':[616,3.6,2.7],'f-side-table':[236,1.1,.8]};
assert.deepEqual(Object.keys(PROPS).sort(),Object.keys(EXPECT).sort(),'every converted prop is in the table, and nothing else ships');
let triangles=0;const GAS=new Set(['prop.fuel-pump','prop.fuel-pump-diesel','prop.fuel-nozzle','prop.fuel-nozzle-diesel','prop.pump-island','prop.forecourt-canopy']);
for(const [id,[tris,width,height]] of Object.entries(EXPECT)){
 const info=propInfo(id),g=propGeometry(id),coloured=!!info.col;
 assert(Math.abs(info.triangles-tris)<=tris*.02+2,`${id}: ${info.triangles} triangles (expected about ${tris})`);assert.equal(g.index.count/3,info.triangles);triangles+=info.triangles;
 assert(Math.abs(info.width-width)<.15,`${id}: ${info.width} m wide`);assert(Math.abs(info.height-height)<.2,`${id}: ${info.height} m tall`);
 for(const a of coloured?['position','normal','color']:['position','normal','uv'])assert(g.attributes[a].array.every(Number.isFinite),`${id}: finite ${a}`);
 assert(g.index.array.every(i=>i<g.attributes.position.count),`${id}: indices in range`);
 const box=new THREE.Box3().setFromBufferAttribute(g.attributes.position);
 assert(box.min.y>=-1&&box.min.y<.4,`${id}: stands on the ground (lowest point ${box.min.y.toFixed(2)})`);{let under=0;const pos=g.attributes.position;for(let i=0;i<pos.count;i++)if(pos.getY(i)<-.15)under++;assert(under<pos.count*.05,`${id}: little of it is underground`)}assert(Math.abs(box.max.y-info.height)<.01);
 if(GAS.has(id))assert(info.footprint.x0<0&&info.footprint.x1>0,id+': the file origin is kept (checked below)');
 else if(id==='prop.dock-plate')assert.deepEqual(info.footprint,{x0:-1,x1:1,z0:-.6,z1:.78},'the dock plate keeps its file origin (keepOrigin): 0.78 m of plate on +z, 0.60 m on -z');
 else assert(Math.abs((box.min.x+box.max.x)/2)<.01&&Math.abs((box.min.z+box.max.z)/2)<.01,`${id}: centred`);
 if(coloured){assert(!info.texture&&info.col&&info.norQ,`${id}: baked colours, compact normals`);assert(g.attributes.normal.array.every(v=>v>=-1.001&&v<=1.001),`${id}: unit-range normals`)}
 else assert(info.texture.startsWith(/^(house|shop|industrial|container|tank)-/.test(id)?'data:image/png;base64,':'data:image/jpeg;base64,')&&info.texture.length<400e3,`${id}: texture ${(info.texture.length/1024).toFixed(0)} KB`);
 assert(info.colliders.length>=(id==='f-rug'||id==='prop.dock-plate'||/nozzle|canopy/.test(id)?0:1)&&info.colliders.length<=40,`${id}: ${info.colliders.length} collision boxes`);
 for(const c of info.colliders)assert(c.x-c.hx>=info.footprint.x0-1.01&&c.x+c.hx<=info.footprint.x1+1.01&&c.z-c.hz>=info.footprint.z0-1.01&&c.z+c.hz<=info.footprint.z1+1.01,`${id}: a collision box lies outside the model`);
 assert(propGeometry(id)===g,'geometry is shared');
}
// The pallet and zone props keep their true size (1 unit = 1 m, nothing rescaled) and have one exact collision box (a walk-over dock plate has none; a sign collides on its post only, the board is above head height).
{const SIZE={'prop.pallet':[1.2,.8,.144],'prop.box-small':[.4,.3,.3],'prop.box-medium':[.6,.4,.4],'prop.crate-large':[1.03,.83,.8],'prop.pallet-small-boxes':[1.2,.8,.743],'prop.pallet-medium-boxes':[1.2,.8,.943],'prop.pallet-crate':[1.2,.83,.944],'prop.zone-bollard':[.3,.3,.865],'prop.zone-sign-unload':[.92,.3,2.3],'prop.zone-sign-pickup':[.92,.3,2.3],'prop.dock-plate':[2,1.38,.062]};
 for(const [id,[w,d,h]] of Object.entries(SIZE)){const i=propInfo(id);assert(Math.abs(i.width-w)<.011&&Math.abs(i.depth-d)<.011&&Math.abs(i.height-h)<.011,`${id}: true size ${w} x ${d} x ${h} m, got ${i.width} x ${i.depth} x ${i.height}`)
  const geometry=propGeometry(id).attributes,flat=new Set();for(let k=0;k<geometry.color.count;k++)flat.add([0,1,2].map(c=>geometry.color.array[k*3+c].toFixed(3)).join());assert(flat.size>=1&&flat.size<=5&&!i.texture&&!i.uv,`${id}: flat colours only (${flat.size}), no texture`)
  if(/^prop\.(pallet|box|crate|zone-bollard)/.test(id)){assert.equal(i.colliders.length,1,id+' has one box');const c=i.colliders[0];assert(Math.abs(c.hx*2-w)<=.2&&Math.abs(c.hz*2-d)<=.2&&Math.abs(c.x)<.01&&Math.abs(c.z)<.01,`${id}: its box (${c.hx*2} x ${c.hz*2}) fits its footprint, centred`)}
  if(/zone-sign/.test(id)){const c=i.colliders[0];assert(c.hx<.15&&c.hz<.15,id+': only the post is solid')}}
 assert.equal(propInfo('prop.dock-plate').colliders.length,0,'the dock plate is walked over');
 // Repeated props are instanced: 500 pallets are one InstancedMesh, one draw call and 500 x 204 triangles; each id is its own draw call, so the whole set of eleven is at most 11.
 const fadeStub={apply:m=>m},spots=Array.from({length:500},(_,k)=>({x:k%25*1.4,z:Math.floor(k/25)*1.1,yaw:(k%4)*Math.PI/2})),yard=createPropInstances('prop.pallet',spots,fadeStub);
 assert(yard.isInstancedMesh&&yard.count===500&&!yard.castShadow&&yard.geometry===propGeometry('prop.pallet'),'one instanced mesh sharing the model geometry');
 const m4=new THREE.Matrix4(),p4=new THREE.Vector3();yard.getMatrixAt(26,m4);p4.setFromMatrixPosition(m4);assert(Math.abs(p4.x-1.4)<1e-5&&Math.abs(p4.z-1.1)<1e-5&&p4.y===0,'instance 26 stands at its spot');
 {const boxes=createPropInstances('container-a',spots.slice(0,8),fadeStub);assert(boxes.isInstancedMesh&&boxes.count===8&&boxes.material.map&&!boxes.material.vertexColors,'a textured prop (a container) is instanced too, with its palette texture')}assert.equal(createPropInstances('prop.box-small',[],fadeStub).count,0,'no spots, nothing drawn')}
// Gas-station props (the project owner's own models): true size, the FILE ORIGIN KEPT (no recentring), anchors read from the anchor_* empties, an emissive canopy light, and the collision rules
// (the pumps and the island: one exact box each; the nozzles: none; the canopy: none, since a roof on columns must not block 12 x 9 m; the map adds its four column boxes when it places it).
{const near=(a,b,e=.011)=>Math.abs(a-b)<e,pump=['prop.fuel-pump','prop.fuel-pump-diesel'],nozzle=['prop.fuel-nozzle','prop.fuel-nozzle-diesel'];
 for(const id of pump){const i=propInfo(id);assert(near(i.width,.64)&&near(i.depth,.46)&&near(i.height,1.73),id+' is 0.64 x 0.46 x 1.73 m (the file measures 0.46 deep, not 0.44)');assert.deepEqual(i.footprint,{x0:-.32,x1:.32,z0:-.23,z1:.23},id+' keeps its origin at the footprint centre');
  assert.deepEqual(i.colliders,[{x:0,z:0,hx:.32,hz:.23}],id+': one exact box');assert.equal(i.triangles,252);
  assert.deepEqual(Object.keys(i.anchors).sort(),['anchor_hose_ny_0','anchor_hose_py_0','anchor_nozzle_ny_0','anchor_nozzle_py_0','anchor_use_ny_0','anchor_use_py_0'],id+': six anchors, named as the model spec says');
  const a=i.anchors;assert(near(a.anchor_use_py_0[2],-1.3)&&near(a.anchor_use_ny_0[2],1.3)&&a.anchor_use_py_0[1]===0&&a.anchor_use_ny_0[1]===0&&a.anchor_use_py_0[0]===0,'the use spots are on the ground, 1.3 m from the pump centre line, +Y face = -z (Blender +Y is -z in the game)');
  assert(near(a.anchor_nozzle_py_0[2],-.235)&&near(a.anchor_nozzle_ny_0[2],.235)&&near(a.anchor_nozzle_py_0[1],.95),'the holsters are on the two long faces, 0.95 m up');assert(near(a.anchor_hose_py_0[1],.3)&&near(a.anchor_hose_py_0[2],-.22),'the hose leaves near the base, 0.30 m up')}
 {const i=propInfo('prop.pump-island');assert(near(i.width,3.4)&&near(i.depth,1.2)&&near(i.height,1.91)&&i.triangles===672);assert.deepEqual(i.footprint,{x0:-1.7,x1:1.7,z0:-.6,z1:.6});assert.deepEqual(i.colliders,[{x:0,z:0,hx:1.7,hz:.6}],'the island: one exact box');
  const names=Object.keys(i.anchors).sort();assert.equal(names.length,12,'twelve anchors');assert(names.every(n=>/^anchor_(nozzle|hose|use)_(py|ny)_[01]$/.test(n)),'names are clean: Blender\'s ".002" duplicate suffix is dropped: '+names.join());
  for(const kind of ['nozzle','hose','use'])for(const side of ['py','ny'])assert(i.anchors[`anchor_${kind}_${side}_0`][0]<0&&i.anchors[`anchor_${kind}_${side}_1`][0]>0,`${kind} ${side}: the petrol pump (0) is at x < 0 and the diesel pump (1) at x > 0`);
  assert(near(i.anchors.anchor_use_py_1[0],.8)&&near(i.anchors.anchor_use_py_0[0],-.8)&&near(i.anchors.anchor_use_py_0[2],-1.3)&&i.anchors.anchor_use_py_0[1]===0,'the pumps stand at x = -0.8 and +0.8; use spots on the ground');
  assert(near(i.anchors.anchor_hose_py_0[1],.48)&&near(i.anchors.anchor_nozzle_py_0[1],1.13),'on the island the pump anchors sit 0.18 m (the kerb) higher than a single pump\'s')}
 for(const id of nozzle){const i=propInfo(id);assert(near(i.width,.05)&&near(i.depth,.53)&&i.triangles===84&&i.colliders.length===0&&!i.anchors,id+': about 0.05 x 0.53 m, 84 triangles, no collider, no anchors');
  assert.deepEqual(i.footprint,{x0:-.03,x1:.03,z0:-.25,z1:.28},id+': the origin is the grip centre (x, y and z kept), the spout runs to +z');const y=propGeometry(id).attributes.position;let lo=1e9,hi=-1e9;for(let k=0;k<y.count;k++){lo=Math.min(lo,y.getY(k));hi=Math.max(hi,y.getY(k))}assert(near(lo,-.135)&&near(hi,.032),id+': y is kept too (-0.135 to 0.032), so the grip centre is the origin')}
 {const i=propInfo('prop.forecourt-canopy'),g=propGeometry('prop.forecourt-canopy'),pos=g.attributes.position;assert(near(i.width,12.08)&&near(i.depth,9.14)&&near(i.height,5.59)&&i.triangles===456);assert.deepEqual(i.colliders,[],'the canopy has no automatic box (the map adds the four column boxes)');assert(!i.anchors);
  // the four footings under the steel columns stand at x = +-5.0, z = +-3.2 (the 0.8 x 0.8 m column boxes the map will add); nothing else comes down to the ground outside them
  const near4=(x,z)=>[[5,3.2],[-5,3.2],[5,-3.2],[-5,-3.2]].some(([cx,cz])=>Math.abs(x-cx)<=.4+.01&&Math.abs(z-cz)<=.4+.01);let footings=0;for(let k=0;k<pos.count;k++)if(pos.getY(k)<.75){footings++;assert(near4(pos.getX(k),pos.getZ(k)),`a vertex at ground level (${pos.getX(k)}, ${pos.getZ(k)}) is outside the four column footings`)}assert(footings>=96);
  let roofLow=1e9;for(let k=0;k<pos.count;k++)if(pos.getY(k)>4.74)roofLow=Math.min(roofLow,pos.getY(k));assert(near(roofLow,4.75),'the roof underside is 4.75 m: nobody walks into it (the avatar is under 2 m)');
  // the emissive light panels survive the converter: the last 72 triangles, one extra material group, emissive strength 2.0
  assert.deepEqual(i.glow,{from:1152,count:216,color:[255,247,221],strength:2},'Canopy_Light kept as an emissive group (strength 2)');assert.equal(i.glow.from+i.glow.count,g.index.count);assert.deepEqual(g.groups.map(x=>[x.start,x.count,x.materialIndex]),[[0,1152,0],[1152,216,1]]);
  for(let t=i.glow.from;t<g.index.count;t++)assert(near(pos.getY(g.index.getX(t)),4.74,.02),'every light panel hangs on the roof underside');
  const fade={apply:m=>m},mesh=createProp('prop.forecourt-canopy',fade),mats=mesh.material;assert(Array.isArray(mats)&&mats.length===2&&mats[0].vertexColors&&!mats[0].emissive.r&&mats[1].emissiveIntensity===2&&mats[1].emissive.r>.9,'the body is flat colours; the light group glows (emissive, intensity 2)');
  const inst=createPropInstances('prop.forecourt-canopy',[{x:0,z:0}],fade);assert(Array.isArray(inst.material)&&inst.material[1].emissiveIntensity===2,'instanced canopies glow too');
  for(const id of GAS)if(id!=='prop.forecourt-canopy')assert(!propInfo(id).glow&&!Array.isArray(createProp(id,fade).material),id+' has one plain material')}
 // flat colours only, no texture; one mesh each (a draw call each)
 for(const id of GAS){const i=propInfo(id);assert(i.col&&!i.texture&&!i.uv&&i.door===null&&i.floor===null,id+': flat colours, no door, no deck')}
 // cost of a forecourt (4 pumps, the island, the canopy): triangles only; the 8 idle hoses are runtime meshes (about 120 triangles each, see DESIGN.md 4.13 part I)
 assert.equal(4*252+672+456,2136,'4 pumps, an island and a canopy: 2,136 triangles');}
// Budgets: cars keep their wheels, so about 2,800-3,100 triangles each (flat-shaded models cannot be simplified without losing the small parts, which is what the first conversion did: no tyres), trucks up to 4,600, every building under 4,400.
for(const id of ['car','suv','sports-car','police-car','taxi','car-2','sports-car-2'])assert(propInfo(id).triangles<=3200,`${id} is a light car`);for(const id of ['pickup','flatbed'])assert(propInfo(id).triangles<=4600);
// Every vehicle still has its wheels: a good number of dark triangles standing on the ground, at the four corners.
for(const id of ['car','suv','sports-car','police-car','taxi','car-2','sports-car-2','pickup','flatbed']){const g=propGeometry(id),pos=g.attributes.position,col=g.attributes.color,idx=g.index;let tyres=0;const corners=new Set();
 for(let t=0;t<idx.count;t+=3){const v=[0,1,2].map(k=>idx.getX(t+k)),top=Math.max(...v.map(i=>pos.getY(i))),dark=Math.max(...v.map(i=>col.getX(i)+col.getY(i)+col.getZ(i)))<.1;if(top<.9&&dark){tyres++;const cx=(pos.getX(v[0])+pos.getX(v[1])+pos.getX(v[2]))/3,cz=(pos.getZ(v[0])+pos.getZ(v[1])+pos.getZ(v[2]))/3;corners.add((cx<0?'L':'R')+(cz<0?'B':'F'))}}
 assert(tyres>=120,`${id} has its tyres (${tyres} dark triangles at wheel height)`);assert(corners.size===4,`${id} has a wheel at each of its four corners: ${[...corners]}`)}
for(const [id,p] of Object.entries(PROPS))if(!/^(car|car-2|suv|sports-car|sports-car-2|police-car|taxi|pickup|flatbed|log|f-.*)$/.test(id))assert(p.triangles<=4400,`${id} is under the building budget`);
// The rigged sawmill (rigged-props.js, 'sawmill-v4') is walkable under its roof: only the ten posts, the bench, the conveyor and the log pile are solid, and two decks (0.30 and 0.20 m) are floors you stand on. No converted prop has a deck.
{const info=propInfo('sawmill-v4');assert.equal(info.colliders.length,13,'10 posts, bench, conveyor, log pile');assert.equal(info.floors.length,2);assert.deepEqual(info.floors.map(f=>f.y),[.3,.2],'main deck 0.30 m, shed deck 0.20 m');assert(info.rigged&&info.door===null)
 assert.deepEqual(info.footprint,{x0:-7.74,x1:8.29,z0:-3.72,z1:3.72},'the full bounds, not just the deck');for(const [id,p] of Object.entries(PROPS))assert.equal(p.floor,null,id+' has no deck')}
// Houses have a front door, and so does the warehouse (its loading door); shops, farm buildings and vehicles do not.
for(const id of Object.keys(PROPS))if(/^house-/.test(id)){const d=propInfo(id).door;assert(d&&d.width>=1.2&&d.height>=2&&Math.abs(d.z-propInfo(id).footprint.z1)<.011,id+' has its front door on the front wall')}else if(id==='industrial-q'){const d=propInfo(id).door;assert(d.width===3.7&&d.height===2.15&&d.x===1.2&&Math.abs(d.z-propInfo(id).footprint.z1)<.011,'the warehouse has its one loading door (a 3.7 x 2.15 m garage opening) on the front wall, 1.2 m right of its centre (seen from the front)')}else assert.equal(propInfo(id).door,null,id+' has no door');

// ── Placed in the world ───────────────────────────────────────────────────────────
assert.deepEqual(validateMap(MAP),[]);
const T=terrain(),zoneOf=id=>MAP.zones.find(z=>z.id===id).bounds;
const rotated=l=>{const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),pts=[[f.x0,f.z0],[f.x1,f.z0],[f.x0,f.z1],[f.x1,f.z1]].map(([x,z])=>[l.x+x*c+z*s,l.z-x*s+z*c]);
 return {x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),z0:Math.min(...pts.map(p=>p[1])),z1:Math.max(...pts.map(p=>p[1]))}};
const inside=(r,b)=>r.x0>=b.x0&&r.x1<=b.x1&&r.z0>=b.z0&&r.z1<=b.z1,overlaps=(a,b)=>a.x0<b.x1&&b.x0<a.x1&&a.z0<b.z1&&b.z1>b.z0&&b.z0<a.z1;
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
const rects=MAP.landmarks.map(l=>({l,r:rotated(l)}));
for(const {l,r} of rects){
 assert(inside(r,zoneOf(l.zone)),`${l.id} stands inside its zone ${l.zone}`);
 for(const road of DIRT_ROADS)assert(!overlaps(r,road),`${l.id} is clear of the dirt roads`);for(const f of FIELDS)assert(!overlaps(r,f),`${l.id} is clear of the field ${f.id}`);
 for(const b of l.decor?[]:propInfo(l.prop).colliders){const s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw));for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const lx=b.x+dx*b.hx*.98,lz=b.z+dz*b.hz*.98,x=l.x+lx*c+lz*s,z=l.z-lx*s+lz*c,k=T.surfaceAt(x,z);
  assert(![SURFACE.ROAD,SURFACE.STREET,SURFACE.BRIDGE,SURFACE.WATER,SURFACE.BANK,...(/^house-/.test(l.prop)?[SURFACE.PAVEMENT]:[])].includes(k),`${l.id}: solid ground-level boxes never stand on a road, bridge or water (and a house's never on a pavement; a shop's walls may touch its sidewalk) (${x.toFixed(1)},${z.toFixed(1)} is ${k})`)}}
 assert(world.blocked(l.x+Math.round(Math.cos(l.yaw))*propInfo(l.prop).colliders[0].x+Math.round(Math.sin(l.yaw))*propInfo(l.prop).colliders[0].z,l.z-Math.round(Math.sin(l.yaw))*propInfo(l.prop).colliders[0].x+Math.round(Math.cos(l.yaw))*propInfo(l.prop).colliders[0].z),`${l.id} is solid`);
}
// No two landmarks overlap, except a parked vehicle or a log beside another prop's yard.
for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert(!overlaps(rects[i].r,rects[j].r),`${rects[i].l.id} and ${rects[j].l.id} do not overlap`);
// Plot buildings stand inside their plot; houses keep a front yard of at least 2 m and the front faces the street the plot faces.
const facingYaw={south:0,north:Math.PI,east:Math.PI/2,west:-Math.PI/2};
for(const {l,r} of rects.filter(x=>x.l.plot)){const plot=MAP.reserved.find(p=>p.id===l.plot);assert(inside(r,plot),`${l.id} stands inside its plot ${l.plot}`);
 assert(Math.abs(Math.sin(l.yaw-facingYaw[plot.facing]))<1e-9&&Math.abs(Math.cos(l.yaw-facingYaw[plot.facing])-1)<1e-9,`${l.id} faces ${plot.facing}, like its plot`);
 const yard=plot.facing==='south'?plot.z1-r.z1:plot.facing==='north'?r.z0-plot.z0:0;assert(!/^house-/.test(l.prop)||plot.facing!=='south'&&plot.facing!=='north'||yard>=2,`${l.id} keeps a front yard of ${yard.toFixed(1)} m (shops stand at the pavement)`)}
// Culling: far buildings are not drawn.
{const camera=new THREE.PerspectiveCamera(),s2=new THREE.Scene(),w2=createWorld(s2,{}),at=(x,z)=>w2.update(.016,camera,new THREE.Vector3(x,0,z));
 at(0,0);assert.equal(s2.getObjectByName('prop-barn').visible,false,'the barn is not drawn from the city');assert.equal(s2.getObjectByName('prop-sawmill-v4').visible,false);
 at(-62,-220);assert.equal(s2.getObjectByName('prop-barn').visible,true,'but is drawn from the farm road');assert.equal(s2.getObjectByName('prop-sawmill-v4').visible,false);at(104,-250);assert.equal(s2.getObjectByName('prop-sawmill-v4').visible,true)}
// The signpost at the fork.
{const sign=MAP.signs[0];assert.equal(sign.zone,'county');assert(world.blocked(sign.x,sign.z),'the post is solid');assert.deepEqual(sign.boards.map(b=>b.text),['← WILLOW FIELDS','PINE RIDGE →'])}
// The sawmill is solid where its machinery is: flood-fill from open ground around it. The posts, bench, conveyor and log pile cannot be walked through, the decks can be entered, and every place the player must reach is reachable.
{const sawmill=MAP.landmarks.find(l=>l.id==='sawmill'),info=propInfo(sawmill.prop),step=.5,R=rotated(sawmill),x0=R.x0-3,z0=R.z0-3,nx=Math.round((R.x1+3-x0)/step)+1,nz=Math.round((R.z1+3-z0)/step)+1,c=Math.round(Math.cos(sawmill.yaw)),s=Math.round(Math.sin(sawmill.yaw));
 const toWorld=(x,z)=>[sawmill.x+x*c+z*s,sawmill.z-x*s+z*c],toModel=(x,z)=>[(x-sawmill.x)*c-(z-sawmill.z)*s,(x-sawmill.x)*s+(z-sawmill.z)*c];
 const blockedAt=(i,j)=>world.blocked(x0+i*step,z0+j*step),seen=new Uint8Array(nx*nz),queue=[[0,0]];assert(!blockedAt(0,0),'the search starts on open ground');seen[0]=1;
 while(queue.length){const [i,j]=queue.pop();for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=nx||b>=nz||seen[b*nx+a]||blockedAt(a,b))continue;seen[b*nx+a]=1;queue.push([a,b])}}
 const f=info.floors[0];let deckOpen=0,deckReached=0,blocked=0;for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const [lx,lz]=toModel(x0+i*step,z0+j*step);if(lx<f.x0||lx>f.x1||lz<f.z0||lz>f.z1)continue;if(blockedAt(i,j))blocked++;else{deckOpen++;if(seen[j*nx+i])deckReached++}}
 assert(blocked>60,'posts and the bench are solid ('+blocked+' cells on the main deck)');assert(deckReached>=deckOpen*.9,'an open-sided shed: '+deckReached+' of '+deckOpen+' open deck cells are reachable from outside')
 const reach=(name,r=1.5)=>{const [wx,wz]=toWorld(info.anchors[name][0],info.anchors[name][2]);for(let j=0;j<nz;j++)for(let i=0;i<nx;i++)if(seen[j*nx+i]&&Math.hypot(x0+i*step-wx,z0+j*step-wz)<=r)return true;return false};
 for(const name of ['anchor_switch','anchor_switch_prompt','anchor_player','anchor_log_in','anchor_belt_clear','anchor_belt_0','anchor_plank_out'])assert(reach(name),name+' can be reached on foot (within 1.5 m of walkable ground)')
 for(const name of ['anchor_belt_1','anchor_belt_2','anchor_belt_3','anchor_plank_pile'])assert(!reach(name,.4),name+' is on the solid conveyor, not on open ground') // (anchor_plank_pile (6, 0.3, 0) lies under the belt: a finding for the model's author, see ASSETS.md)
 for(const d of f.y===.3?[[0,0]]:[]){const [cx,cz]=toWorld((f.x0+f.x1)/2+0,(f.z0+f.z1)/2+2);assert.equal(world.floorAt(cx,cz),.3,'standing on the main deck')}
 const [sx,sz]=toWorld(6.4,0);assert.equal(world.floorAt(sx,sz),.2,'standing on the shed deck');const [ex,ez]=toWorld(4.45,0);assert.equal(world.floorAt(ex,ez),null,'and the gap between the decks is ground');assert.equal(world.floorAt(sawmill.x+30,sawmill.z),null,'and not beside it');const barn=MAP.landmarks.find(l=>l.id==='farm-barn');assert.equal(world.floorAt(barn.x,barn.z),null,'the barn has no deck')}
// Cedar Heights: doors face the road with a clear approach; the homes' yards and the road stay open.
for(const {l} of rects.filter(x=>x.l.plot&&/^house-/.test(x.l.prop))){const plot=MAP.reserved.find(p=>p.id===l.plot),info=propInfo(l.prop),s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),front=[l.x+info.door.x*c+info.door.z*s,l.z-info.door.x*s+info.door.z*c];
 for(const d of [1,2,3]){const x=front[0]+s*d,z=front[1]+c*d;assert(!world.blocked(x,z),`${l.id}: you can stand ${d} m in front of the door`)}assert(plot.path.x0<front[0]&&front[0]<plot.path.x1,`${l.id}: the front path leads to the door`)}
console.log(`Props: ${Object.keys(EXPECT).length} converted models (${triangles} triangles in all: 12 houses and 9 shops and offices, the farm set, the timber yard, nine vehicles and 24 pieces of furniture, and 11 pallet, crate and loading-zone props and 6 gas-station props kept at true size, instanced), every landmark inside its zone and plot, clear of roads and of each other, solid with open yards, houses facing their street; the rigged sawmill (solid posts, bench, conveyor and log pile, two decks, every anchor reachable) and the culling.`);

