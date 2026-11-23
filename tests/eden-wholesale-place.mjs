import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import * as E from '../dist/eden-wholesale.js';
import {PROP_ID,POSE,PROP_INFO,splitTriangles,isGlassSrgb,glowAt,WINDOW_HOURS,LAMP_GLOW} from '../dist/eden-wholesale-place.js';
import {SUPPLIER} from '../dist/bakery-goods.js';
import {itemById,isBuyable} from '../dist/items.js';
import {addItem,countItem} from '../dist/inventory.js';
import {shopOpen} from '../dist/routine.js';
import {propInfo,createProp} from '../dist/props.js';
import {parkingBays,townSpots} from '../dist/town.js';
import {terrain,SURFACE} from '../dist/terrain.js';
import {doorOf,propertyById} from '../dist/properties.js';
import {placePoint} from '../dist/population.js';
import {footprintRects} from '../dist/cover-sampler.js';
import {createWorld} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none

// Stage W-PLACE: Eden Wholesale stands on plot C21 behind the Pharmacy and Bank (owner 2026-11-19), loaded as a GLB by game.js into a placeholder prop.
assert.deepEqual(validateMap(),[]);
const near=(a,b,t=1e-6)=>Math.abs(a-b)<=t,W=p=>E.worldPoint(p,POSE);

// 1. The map entries: plot, landmark (prop + model), property, staff; the plot is the footprint at the pose.
const plot=MAP.reserved.find(p=>p.id==='C21'),lm=MAP.landmarks.find(l=>l.id===PROP_ID),prop=propertyById(PROP_ID),staff=MAP.posts.find(s=>s.id===PROP_ID);
assert.deepEqual([plot.x0,plot.x1,plot.z0,plot.z1,plot.facing,plot.kind],[30,42,-69,-60,'south','commercial']);
assert.deepEqual({x:lm.x,z:lm.z,yaw:lm.yaw},{...POSE});assert.equal(lm.prop,PROP_ID);assert.equal(lm.model,E.MODEL);assert.equal(lm.plot,'C21');assert.equal(lm.zone,'alder');
assert.deepEqual(E.footprintAt(POSE),{x0:plot.x0,x1:plot.x1,z0:plot.z0,z1:plot.z1},'the plot is exactly the building');
assert.equal(prop.type,'shop');assert.equal(prop.name,E.NAME);assert.equal(prop.enterable,true);assert.equal(prop.access,'public');assert.equal(prop.owner,null);assert.equal(prop.company,E.COMPANY);
assert.deepEqual([staff.role,...staff.hours],['Clerk',...E.HOURS]);assert.deepEqual(staff.at,{property:PROP_ID});
assert.equal(SUPPLIER,'property:'+PROP_ID,'bakery-goods.js names the placed property');
const door=doorOf(prop),d0=W([E.DOOR.x,0,E.DOOR.z]);assert(near(door.x,33.7,1e-3)&&near(door.z,-60.7,1e-3)&&near(door.x,d0.x)&&near(door.z,d0.z)&&door.faceZ===1,'the door is the model door, facing south');
for(const [name,p,want] of [['dock',E.DOCK,[39.7,-60]],['pickup',E.PICKUP,[39.4,-61.1]],['truck bay',E.TRUCK_BAY,[39.7,-56.2]],['counter',E.COUNTER,[33.7,-59.6]]]){const w=W(p);assert(near(w.x,want[0],1e-3)&&near(w.z,want[1],1e-3),`${name} at ${want}`)}

// 2. The prop: placeholders.js serves PROP_INFO (SOLIDS as colliders, the door); createProp is the empty group game.js fills with the GLB.
const info=propInfo(PROP_ID);assert.deepEqual(info.footprint,{x0:-6,x1:6,z0:-4.5,z1:4.5});assert.equal(info.colliders.length,E.SOLIDS.length);
E.SOLIDS.forEach((s,i)=>{const c=info.colliders[i];assert(near(c.x-c.hx,s.x0,1e-4)&&near(c.x+c.hx,s.x1,1e-4)&&near(c.z-c.hz,s.z0,1e-4)&&near(c.z+c.hz,s.z1,1e-4),`collider ${s.id} is the SOLIDS box`)});
assert.deepEqual(info.colliders,PROP_INFO.colliders);assert.equal(info.door.width,E.DOOR.width);
const group=createProp(PROP_ID,{apply:m=>m});assert(group.isGroup&&group.name==='prop-eden-wholesale'&&group.children.length===0&&group.userData.model===E.MODEL&&group.userData.fade,'an empty group named for game.js, with the model path and the fade');

// 3. Parking markings end west of the pedestrian approach and the loading area.
const lot=MAP.lots.find(l=>l.id==='alder-lot');assert.equal(lot.bays.count,15);
const lotBays=parkingBays().filter(b=>b.id.startsWith('alder-lot'));assert(lotBays.every(b=>b.x+b.w/2<=27+1e-9),'no bay east of x 27');
const cars=MAP.landmarks.filter(l=>/^park-lot-/.test(l.id));assert.equal(cars.length,6);for(const c of cars)assert(c.x<29.7||c.x>45,`${c.id} is not at the wholesale's front (x ${c.x})`);
const T=terrain();assert.equal(T.surfaceAt(39.7,-56.2),SURFACE.ROAD,'the truck stands on the lot');assert.equal(T.surfaceAt(39.7,-59.5),SURFACE.ROAD,'nothing raised in front of the dock');
for(const [x,z] of [[33.7,-59.6],[36,-59],[27,-64],[29.25,-67],[29.25,-61],[28.75,-70.5],[36,-70.5],[42.75,-70.5]])assert.equal(T.surfaceAt(x,z),SURFACE.PAVEMENT,`the footway at ${x},${z} (door, counter, Barber's Walk, the strip to the staff door)`);
const pp=placePoint('property:'+PROP_ID);assert.equal(T.surfaceAt(pp.x,pp.z),SURFACE.PAVEMENT,'the staff walk to a point on pavement');

// 4. The world: solid hall and shop front, open counter, dock pickup, door approach and truck bay; no street furniture on or against it; ground cover kept out of the footprint.
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
assert(scene.getObjectByName('prop-eden-wholesale'),'world.js placed the landmark group');
for(const [x,z,what] of [[36,-66,'hall'],[32,-62,'shop front'],[41.6,-60.3,'east canopy post']])assert(world.blocked(x,z),`${what} is solid at ${x},${z}`);
for(const [x,z,what] of [[33.7,-59.6,'approach'],[39.4,-61.1,'pickup'],[39.7,-56.2,'truck bay'],[38.5,-60.3,'dock edge'],[33.7,-60.2,'door step'],[29,-70.5,'west alley'],[35,-70.5,'central alley'],[42.75,-70.5,'east alley']])assert(!world.blocked(x,z),`${what} is open at ${x},${z}`);
const spots=townSpots();for(const [kind,list] of Object.entries(spots))for(const s of list)assert(!(s.x>28.5&&s.x<43.5&&s.z>-70.5&&s.z<-58.5),`no ${kind} on or against the wholesale (${s.x},${s.z})`);
const rects=footprintRects(MAP.buildings,MAP.landmarks.map(l=>({x:l.x,z:l.z,yaw:l.yaw,footprint:propInfo(l.prop).footprint})));assert(rects.some(r=>near(r.x0,30)&&near(r.x1,42)&&near(r.z0,-69)&&near(r.z1,-60)),'the ground cover skips the footprint');

const bank=MAP.reserved.find(p=>p.id==='C7');assert.equal(plot.z0-bank.z1,3,'3 m between the bank plot and the wholesale rear wall');
for(const [minutes,open] of [[419,false],[420,true],[1019,true],[1020,false]])assert.equal(shopOpen(PROP_ID,{minutes}),open);
for(const id of E.RETAIL_GOODS){const item=itemById(id);assert.equal(item?.type,'ingredient');assert(!isBuyable(item),'ingredients are exclusive to Wholesale');const purchase=addItem({cash:item.price,inventory:{slots:[]}},id,{purchase:true});assert.equal(purchase.state.cash,0);assert.equal(countItem(purchase.state,id),1)}

// 5. The GLB split: body, window glass, lamp lenses; every triangle kept once; lenses = mesh extras.glow.
const b=readFileSync(new URL('../dist/'+E.MODEL,import.meta.url)),jl=b.readUInt32LE(12),j=JSON.parse(b.toString('utf8',20,20+jl)),bin=b.subarray(28+jl);
const pr=j.meshes[0].primitives[0],arr=(a,Type,n)=>{const bv=j.bufferViews[a.bufferView],o=bin.byteOffset+(bv.byteOffset||0)+(a.byteOffset||0);return new Type(bin.buffer.slice(o,o+n*Type.BYTES_PER_ELEMENT))};
const ia=j.accessors[pr.indices],ca=j.accessors[pr.attributes.COLOR_0],idx=arr(ia,ia.componentType===5123?Uint16Array:Uint32Array,ia.count),col=arr(ca,Uint8Array,ca.count*4),glow=j.meshes[0].extras.glow;
const s=splitTriangles(idx,col,4,glow),{counts}=s;
assert.equal(s.index.constructor,idx.constructor);assert.equal(counts.body+counts.windows+counts.lenses,ia.count/3);assert.equal(counts.lenses,glow.count/3);assert(counts.windows>=60&&counts.windows<=200,`${counts.windows} window-glass triangles`);
assert.deepEqual(s.groups.map(g=>g.material),[0,1,2]);assert.equal(s.groups[2].start+s.groups[2].count,ia.count);
const key=(a,i)=>[a[i],a[i+1],a[i+2]].join(','),before=new Map(),after=new Map();for(let i=0;i<idx.length;i+=3){before.set(key(idx,i),(before.get(key(idx,i))||0)+1);after.set(key(s.index,i),(after.get(key(s.index,i))||0)+1)}
assert.deepEqual([...after].sort(),[...before].sort(),'the same triangles, reordered');
assert(isGlassSrgb(59,85,102)&&isGlassSrgb(108*.9,138*.9,153*.9)&&!isGlassSrgb(70,80,87)&&!isGlassSrgb(57,66,74)&&!isGlassSrgb(47,95,158),'glass vs slate trim, frame and the blue rack');

// 6. Night glow: windows lit only in the dark within staff hours, lamp lenses bright in the dark and faint by day.
const DAY={sunHeight:.6},NIGHT={sunHeight:-.4};
assert.deepEqual(glowAt(720,DAY),{windows:0,lamps:LAMP_GLOW.day,key:0});
assert.equal(glowAt(390,NIGHT).windows>0,true,'06:30 in the dark: staff in, windows lit');assert.equal(glowAt(1110,NIGHT).windows>0,true,'18:30: closing up');
assert.equal(glowAt(1200,NIGHT).windows,0,'20:00: dark windows');assert.equal(glowAt(300,NIGHT).windows,0,'05:00: nobody in yet');assert.equal(glowAt(1200,NIGHT).lamps,LAMP_GLOW.night);
assert.deepEqual([...WINDOW_HOURS],[360,1170]);

// 7. game.js loads the GLB into the group and drives the glow (the wiring this stage owns).
const game=readFileSync(new URL('../dist/game.js',import.meta.url),'utf8');
assert(game.includes("scene.getObjectByName('prop-eden-wholesale')")&&game.includes('eden.userData.model')&&game.includes('edenSplit(')&&game.includes('edenGlowAt('),'game.js loads and lights the model');
console.log(`PASS eden-wholesale-place: C21 with 3 m rear alley, ${info.colliders.length} SOLIDS colliders, public retail door, clear dock approach, ingredients and opening hours, ${counts.body}/${counts.windows}/${counts.lenses} body/window/lens triangles, windows lit ${WINDOW_HOURS.map(m=>String(m/60|0).padStart(2,'0')+':'+String(m%60).padStart(2,'0')).join('-')} in the dark, supplier ${SUPPLIER}`);
