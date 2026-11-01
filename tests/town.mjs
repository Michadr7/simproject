import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import {markingBars,parkingBays,townSpots,buildingRects,crossingRects,FOUNTAIN,BUS_STOP} from '../dist/town.js';
import {terrain,SURFACE} from '../dist/terrain.js';
import {propInfo,propGeometry} from '../dist/props.js';
import {createWorld} from '../dist/world.js';
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none
const T=terrain(),scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity}),near=(a,b,t)=>Math.abs(a-b)<=t;
assert.deepEqual(validateMap(),[]);

// ── The street wall: shops shoulder to shoulder, flush with the sidewalk, no gaps ───────────────────────────────────────────
const shops=MAP.landmarks.filter(l=>l.plot&&/^C\d+$/.test(l.plot)),rect=l=>{const f=propInfo(l.prop).footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),xs=[f.x0,f.x1].map(x=>l.x+x*c),zs=[f.z0,f.z1].map(z=>l.z+z*c);return {x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)}};
const south=shops.filter(l=>Math.abs(Math.cos(l.yaw)+1)<1e-9).sort((a,b)=>a.x-b.x),north=shops.filter(l=>Math.abs(Math.cos(l.yaw)-1)<1e-9).sort((a,b)=>a.x-b.x);
assert.deepEqual([south.length,north.length],[7,3],'seven shops south of the cross street, three north of it');
for(const [name,row,front,end] of [['south',south,-80.7,43],['north',north,-99.3,9]]){
 const r=row.map(rect);assert(near(r[0].x0,-20,.2),`${name} row starts at the west edge: ${r[0].x0.toFixed(2)}`);assert(near(r.at(-1).x1,end,.2),`${name} row ends at ${end}: ${r.at(-1).x1.toFixed(2)}`);
 for(let i=1;i<r.length;i++)assert(r[i].x0-r[i-1].x1<=.5&&r[i].x0-r[i-1].x1>=-.2,`${name} row: ${(r[i].x0-r[i-1].x1).toFixed(2)} m between buildings ${i} and ${i+1}`);
 for(const [k,b] of r.entries())assert(near(name==='south'?b.z0:b.z1,front,.15),`${name} building ${k+1} stands at the sidewalk (${(name==='south'?b.z0:b.z1).toFixed(2)})`)}
// the sidewalk meets the facade, and there are at least eight different buildings along the street
assert(new Set(shops.map(l=>l.prop)).size>=9,'varied buildings along the street');
for(const l of shops){const b=rect(l),z=l.yaw?b.z0-.5:b.z1+.5;assert.equal(T.surfaceAt(l.x,z),SURFACE.PAVEMENT,`${l.id}: the sidewalk is in front of it`)}
assert.equal(MAP.pavements.filter(p=>p.draw).length,8,'eight drawn pavements');
for(const p of MAP.pavements.filter(p=>p.draw))assert(scene.getObjectByName(p.plaza?'town-square':'pavement'),'pavements are drawn');
// ── Crosswalks, stop lines and parking bays are painted on the road, and the four arms of Alder Street's junction all have one ──────
const bars=markingBars();assert(bars.length>=200,'markings: '+bars.length);
for(const b of bars)assert([SURFACE.ROAD,SURFACE.STREET].includes(T.surfaceAt(b.x,b.z)),`a marking at ${b.x.toFixed(1)},${b.z.toFixed(1)} lies on a road`);
for(const c of MAP.crossings){assert([SURFACE.ROAD,SURFACE.STREET].includes(T.surfaceAt(c.x,c.z)),`crossing ${c.x},${c.z} is on a road`);assert(c.span>=9&&c.span<=19)}
const arms=MAP.crossings.filter(c=>Math.hypot(c.x-50,c.z+90)<12);assert.equal(arms.length,4,'a crosswalk on each arm of the junction of the cross street and Alder Street');
assert.equal(MAP.stopLines.length,4);for(const s of MAP.stopLines)assert([SURFACE.ROAD].includes(T.surfaceAt(s.x,s.z)),'a stop line is on the road');
const paint=scene.getObjectByName('road-markings');assert.equal(paint.count,bars.length,'every bar is drawn, in one instanced mesh');
// the lot and the lanes
const lot=MAP.lots[0];assert.equal(T.surfaceAt((lot.x0+lot.x1)/2,(lot.z0+lot.z1)/2),SURFACE.ROAD,'the lot is asphalt');assert(scene.getObjectByName('lot-alder-lot'));
for(const [x,z] of [[44,-57],[50,-57]])assert.equal(T.surfaceAt(x,z),SURFACE.ROAD,'the lot joins Alder Street along its aisle');
const bays=parkingBays();assert.equal(bays.length,9*2+20,'18 parallel bays and 20 lot bays');
// ── Parked cars: in bays, facing the way the bay faces, clear of crosswalks, and not too many ───────────────────────────────────────
const parked=MAP.landmarks.filter(l=>l.decor&&/^park-/.test(l.id)),yawOf={east:Math.PI/2,west:-Math.PI/2,north:Math.PI};
assert(parked.length>=12&&parked.length<=16,'a dozen or so cars: '+parked.length);
let tris=0;for(const car of parked){tris+=propInfo(car.prop).triangles;const inBay=bays.find(b=>Math.abs(b.x-car.x)<.4&&Math.abs(b.z-car.z)<.5&&Math.abs(Math.sin(b.face==='north'?Math.PI:yawOf[b.face]-car.yaw))<1e-6);
 if(!/^park-oak/.test(car.id))assert(inBay,`${car.id} is in a bay of its own, nose the right way`);
 assert([SURFACE.ROAD,SURFACE.STREET].includes(T.surfaceAt(car.x,car.z)),`${car.id} is on the road`);
 const f=propInfo(car.prop).footprint,s=Math.abs(Math.round(Math.sin(car.yaw))),half=s?[f.z1,f.x1]:[f.x1,f.z1];
 for(const r of crossingRects())assert(!(car.x+half[0]>r.x0&&car.x-half[0]<r.x1&&car.z+half[1]>r.z0&&car.z-half[1]<r.z1),`${car.id} does not stand on a crosswalk`)}
assert(tris<=50000,'parked cars cost '+tris+' triangles in all, and only the near ones are drawn');
{const used=new Set();for(const car of parked.filter(c=>!/^park-oak/.test(c.id))){const bay=bays.find(b=>Math.abs(b.x-car.x)<.4&&Math.abs(b.z-car.z)<.5);assert(!used.has(bay.id),'one car to a bay');used.add(bay.id)}}
// The spawn stays clear: a step into a blocked point is refused, so a car parked over it leaves a new player unable to move at all.
assert(!world.blocked(MAP.spawn.x,MAP.spawn.z),'nothing stands on the spawn point');for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])for(let d=.1;d<=3;d+=.1)assert(!world.blocked(MAP.spawn.x+dx*d,MAP.spawn.z+dz*d),`3 m of clear ground from the spawn toward ${dx},${dz}`);
// ── Street furniture: on the pavement, clear of buildings and crossings, spaced out, each kind plentiful enough ───────────────────────────────────
const spots=townSpots(),minimum={lamp:12,hydrant:6,bin:8,meter:5,bench:9,tree:10,planter:4,bollard:8};
for(const [kind,n] of Object.entries(minimum))assert(spots[kind].length>=n,`${kind}: ${spots[kind].length} (at least ${n})`);
const buildings=buildingRects(),crossings=crossingRects(),all=[];
for(const kind of ['lamp','hydrant','bin','meter','bench','tree','planter','bollard'])for(const s of spots[kind]){
 assert.equal(T.surfaceAt(s.x,s.z),SURFACE.PAVEMENT,`${kind} at ${s.x},${s.z} is on pavement`);
 assert(!crossings.some(r=>s.x>r.x0&&s.x<r.x1&&s.z>r.z0&&s.z<r.z1)||kind==='bollard'||kind==='planter','no '+kind+' on a crosswalk');
 if(kind!=='bench'&&kind!=='bollard'&&kind!=='planter')assert(!buildings.some(b=>s.x>b.x0&&s.x<b.x1&&s.z>b.z0&&s.z<b.z1),`${kind} at ${s.x},${s.z} is not inside a building`);
 for(const o of all)assert(Math.hypot(o.x-s.x,o.z-s.z)>=.9,`${kind} at ${s.x},${s.z} is clear of a ${o.kind} at ${o.x},${o.z}`);all.push({kind,...s})}
assert(spots.bin.concat(spots.hydrant).concat(spots.meter).every(s=>world.blocked(s.x,s.z)),'bins, hydrants and meters are solid');
for(const [kind,name] of [['hydrant','hydrant'],['bin','bin'],['meter','parking-meter'],['bench','bench'],['planter','planter'],['bollard','bollard']])assert.equal(scene.getObjectByName(name).count,spots[kind].length,`${name}s are drawn, one instance each`);
// Street trees are the Quaternius broadleaf models (bark and leaves, one pair per model), not cylinders and blobs.
{const bark=[];scene.traverse(o=>{if(/^street-tree-broadleaf\.\d-bark$/.test(o.name))bark.push(o)});assert.equal(bark.reduce((n,m)=>n+m.count,0),spots.tree.length,'street trees are drawn, one instance each');assert(bark.every(m=>m.castShadow&&m.geometry.attributes.uv),'as textured models that cast shadows');assert.equal(scene.getObjectByName('tree'),undefined,'and none of the old cylinder-and-blob trees remain');
 assert(spots.tree.every(s=>world.blocked(s.x,s.z)),'every trunk is solid');
 const solid=world.addBroadleaves([{x:-30,z:-20,y:0},{x:-31,z:-22,y:0}],'test-tree');assert.equal(solid.length,2);assert(solid.every(c=>c.radius>.2&&c.radius<.5),'a trunk radius from the model');}
// ── The town square ───────────────────────────────────────────────────────────────────────────
const square=MAP.plazas[0];assert(near(FOUNTAIN.x,(square.x0+square.x1)/2,1.5)&&FOUNTAIN.z>square.z0+FOUNTAIN.r&&FOUNTAIN.z<square.z1-FOUNTAIN.r,'the fountain is in the middle of the square');
assert.equal(T.surfaceAt(FOUNTAIN.x,FOUNTAIN.z+FOUNTAIN.r+1),SURFACE.PAVEMENT);assert(world.blocked(FOUNTAIN.x,FOUNTAIN.z)&&world.blocked(FOUNTAIN.x+FOUNTAIN.r-.5,FOUNTAIN.z),'the fountain is solid');assert(!world.blocked(FOUNTAIN.x+FOUNTAIN.r+2,FOUNTAIN.z),'but you can walk around it');
for(const [x,z] of [...square.planters,...square.trees])assert(x>square.x0&&x<square.x1&&z>square.z0&&z<square.z1,'in the square');
assert(scene.getObjectByName('fountain')&&scene.getObjectByName('bus-stop')&&scene.getObjectByName('town-square'));
assert.equal(T.surfaceAt(BUS_STOP.x,BUS_STOP.z),SURFACE.PAVEMENT,'the bus stop is on the sidewalk');
// the square is walkable from the street, all round
for(const [x,z] of [[24.5,-97],[10.3,-104],[37.5,-114],[23.5,-117.5],[17,-109]])assert(!world.blocked(x,z),`the square is open to walk at ${x},${z}`); // between the bollards, beside the benches and round the fountain
const water=scene.getObjectByName('fountain').children.find(c=>c.material?.transparent);const before=water.material.opacity;world.update(.5,new THREE.PerspectiveCamera(),new THREE.Vector3(23,0,-100));world.update(.5,new THREE.PerspectiveCamera(),new THREE.Vector3(23,0,-100));assert.notEqual(water.material.opacity,before,'the water shimmers');
console.log(`Town: a street wall of ${shops.length} buildings with no gaps, ${bars.length} road markings (crosswalks on all four arms of the main junction, stop lines, ${bays.length} bays), ${parked.length} parked cars, and ${Object.values(spots).reduce((s,a)=>s+a.length,0)} pieces of street furniture on the pavements, a fountain in the square and a bus stop.`);
