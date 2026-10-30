import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP,validateMap} from '../dist/map-definition.js';
import {PROPERTIES,propertyById,doorOf,doorState,worldDoors} from '../dist/properties.js';
import {PROPS} from '../dist/props-assets.js';
import {createWorld} from '../dist/world.js';
import {terrain,SURFACE,FOOTING} from '../dist/terrain.js';

globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})}; // ground textures draw on a canvas; tests have none
const world=createWorld(new THREE.Scene(),{cullRadius:Infinity}),T=terrain();

// ── The registry leaves nothing out ───────────────────────────────────────────────────────────
assert.deepEqual(PROPERTIES.map(p=>p.id),['market','cafe','studio','house-r1','house-r2','house-r3','sawmill','farmstead']);
for(const l of MAP.landmarks.filter(l=>l.prop))assert(PROPERTIES.some(p=>p.landmark===l.id),`${l.id} has a door rule or an explicit "not enterable"`);
for(const kind of Object.keys(MAP.shops))assert.equal(propertyById(kind)?.type,'shop',`${kind} is registered`);
assert.equal(propertyById('studio').access,'tenant');
for(const id of ['sawmill','farmstead']){const p=propertyById(id);assert.equal(p.enterable,false);assert(p.reason.length>20,`${id} says why it cannot be entered`)}
assert.deepEqual(validateMap(),[]);

// ── Doors: where they are, and that you can walk up to them ──────────────────────────────────────────
for(const id of ['house-r1','house-r2','house-r3']){
 const property=propertyById(id),landmark=MAP.landmarks.find(l=>l.id===property.landmark),door=doorOf(property),model=PROPS[landmark.prop];
 assert(Math.abs(door.x-landmark.x)<1e-9,`${id}: the door is in the middle of the front wall`);assert(Math.abs(door.z-(landmark.z+model.footprint.z1))<.011,`${id}: on the front wall (${door.z})`);
 assert.deepEqual([Math.round(door.faceX),Math.round(door.faceZ)],[0,1],`${id}: the door faces south, toward the loop road`);
 assert(door.width>=1.2&&door.height>=2&&door.height<=2.3,`${id}: a real door (${door.width} x ${door.height} m)`);
 for(const d of [.6,1,2,4])assert(!world.blocked(door.x,door.z+d),`${id}: you can stand ${d} m in front of the door`);
 // the front path runs from the door to the road
 const plot=MAP.reserved.find(p=>p.id===property.plot);assert(plot.path.x0<door.x&&door.x<plot.path.x1,`${id}: the path leads to the door`);
}
assert.equal(doorOf(propertyById('market')),null,'shops keep their own door system');
assert.equal(doorOf(propertyById('sawmill')),null);

// ── What a door does ─────────────────────────────────────────────────────────────────────────────
const states=Object.fromEntries(['house-r1','house-r2','house-r3'].map(id=>[id,doorState(propertyById(id))]));
assert.deepEqual(states['house-r1'],{state:'vacant',open:false,label:'Locked · For sale',title:'1 Cedar Loop',message:'The door is locked. This house is vacant and for sale.'});
assert.equal(states['house-r2'].state,'npc');assert.equal(states['house-r2'].label,"Locked · Marta Ellison's home");assert(states['house-r2'].message.includes('Marta Ellison')&&states['house-r2'].message.includes('locked'));
assert.equal(states['house-r3'].state,'vacant');
for(const s of Object.values(states))assert.equal(s.open,false,'no house opens for a player who owns nothing');
// an owner finds the door shut with a note until interiors exist; the shops are public; the studio opens for its tenant
{const mine=doorState(propertyById('house-r1'),['house-r1']);assert.equal(mine.state,'owned');assert.equal(mine.open,false);assert(mine.message.includes('not built yet'))}
assert.equal(doorState(propertyById('market')).open,true);assert.equal(doorState(propertyById('studio'),[]).open,false);assert.equal(doorState(propertyById('studio'),['studio']).open,true);
assert.equal(doorState(propertyById('sawmill')).open,false);
const doors=worldDoors([]);assert.deepEqual(doors.map(d=>d.id),['house-r1','house-r2','house-r3']);assert(doors.every(d=>d.label&&d.title&&d.message&&Number.isFinite(d.x)&&Number.isFinite(d.z)));

// ── Driveways: from the house to the road, wide enough for a car, with a front path and a parking spot ───────────────────────────────────
for(const plot of MAP.reserved.filter(p=>p.kind==='residential')){
 const d=plot.driveway,p=plot.path,park=plot.park;
 assert(d.x1-d.x0>=3.5&&p.x1-p.x0>=1.2,`${plot.id}: a 3.5 m driveway and a front path`);
 for(let x=d.x0+.3;x<d.x1;x+=.5){assert.equal(T.surfaceAt(x,d.z0+.4),SURFACE.DRIVEWAY,`${plot.id}: driveway ground at the house end, x=${x.toFixed(1)}`);assert.equal(T.surfaceAt(x,d.z1-.25),SURFACE.ROAD,`${plot.id}: the driveway runs under the loop road at x=${x.toFixed(1)}`)}
 for(let x=p.x0+.3;x<p.x1;x+=.5){assert.equal(T.surfaceAt(x,p.z0+.4),SURFACE.PATH,`${plot.id}: path ground`);assert.equal(T.surfaceAt(x,p.z1-.25),SURFACE.ROAD,`${plot.id}: the path reaches the road`)}
 assert.equal(T.surfaceAt(park.x,park.z),SURFACE.DRIVEWAY,`${plot.id}: the parking spot is on the driveway`);
 assert.equal(T.footingAt(park.x,park.z),FOOTING[SURFACE.DRIVEWAY]);
 // you can walk the whole way, and a car-sized corridor (3.5 x 4.5 m) beside the house is clear of its walls
 for(let z=d.z0+.7;z<d.z1;z+=.5)for(let x=d.x0+.3;x<d.x1;x+=.7)assert(!world.blocked(x,z),`${plot.id}: the driveway is open at ${x.toFixed(1)},${z.toFixed(1)}`);
 for(let z=p.z0+.7;z<p.z1;z+=.5)assert(!world.blocked((p.x0+p.x1)/2,z),`${plot.id}: the path is open`);
}
// Anyone can walk from the driveway to the loop road and on to the city.
{const reach=T.reach(MAP.spawn.x,MAP.spawn.z);for(const plot of MAP.reserved.filter(p=>p.kind==='residential'))assert(reach[T.index(plot.park.x,plot.park.z)],`${plot.id}: the driveway is on the walkable network`)}
console.log('Properties: eight registered (three houses with locked doors: one vacant pair and one NPC-owned, shops public, the studio for its tenant, the sawmill and farmstead explicitly not enterable); every door faces the road with a clear approach; three driveways, front paths and parking spots join the loop road.');
