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
const HOUSES=['house-r1','house-r2','house-r3','house-r4','house-r5','house-r6','house-r7','house-r8'],ALDER=['alder-store','alder-offices','alder-tower','alder-bakery','alder-barber','alder-pharmacy','alder-bank','police-station','alder-books','alder-cinema'];
assert.deepEqual(PROPERTIES.map(p=>p.id),['market','cafe','studio',...HOUSES,...ALDER,'farm-house','farm-barn','farm-small-barn','farm-open-barn','farm-silo','farm-coop','farm-windmill','sawmill']);
for(const l of MAP.landmarks.filter(l=>l.prop&&!l.decor))assert(PROPERTIES.some(p=>p.landmark===l.id),`${l.id} has a door rule or an explicit "not enterable"`);
for(const l of MAP.landmarks.filter(l=>l.decor))assert(!PROPERTIES.some(p=>p.landmark===l.id),`${l.id} is yard decor (a vehicle or a log), not a building`);
for(const kind of Object.keys(MAP.shops))assert.equal(propertyById(kind)?.type,'shop',`${kind} is registered`);
assert.equal(propertyById('studio').access,'tenant');
for(const id of [...ALDER,'farm-barn','farm-small-barn','farm-open-barn','farm-silo','farm-coop','farm-windmill','sawmill']){const p=propertyById(id);assert.equal(p.enterable,false,id);assert(p.reason.length>20,`${id} says why it cannot be entered`)}
assert.deepEqual(validateMap(),[]);

// ── Doors: where they are, and that you can walk up to them ──────────────────────────────────────────
const FACE={south:[0,1],north:[0,-1]};
for(const id of [...HOUSES,'farm-house']){
 const property=propertyById(id),landmark=MAP.landmarks.find(l=>l.id===property.landmark),door=doorOf(property),model=PROPS[landmark.prop],plot=MAP.reserved.find(p=>p.id===property.plot);
 const s=Math.round(Math.sin(landmark.yaw)),c=Math.round(Math.cos(landmark.yaw));
 assert(Math.abs(door.x-(landmark.x+model.door.x*c+model.door.z*s))<1e-6&&Math.abs(door.z-(landmark.z-model.door.x*s+model.door.z*c))<1e-6,`${id}: the door is on the front wall, ${model.door.x} m off the centre`);
 assert.deepEqual([Math.round(door.faceX),Math.round(door.faceZ)],FACE[plot?.facing||'south'],`${id}: the door faces the street the plot faces`);
 assert(door.width>=1.2&&door.height>=2&&door.height<=2.3,`${id}: a real door (${door.width} x ${door.height} m)`);
 for(const d of [1,2,4])assert(!world.blocked(door.x+Math.round(door.faceX)*d,door.z+Math.round(door.faceZ)*d),`${id}: you can stand ${d} m in front of the door`);
 if(plot)assert(plot.path.x0<door.x&&door.x<plot.path.x1,`${id}: the path leads to the door`);
}
assert.equal(doorOf(propertyById('market')),null,'shops keep their own door system');
assert.equal(doorOf(propertyById('sawmill')),null);assert.equal(doorOf(propertyById('farm-barn')),null,'barns have no door yet');

// ── What a door does ─────────────────────────────────────────────────────────────────────────────
const VACANT=['house-r1','house-r3','house-r5','house-r7'],RESIDENTS={'house-r2':'Marta Ellison','house-r4':'Tom Reyes','house-r6':'Priya Nair','house-r8':'Grace Whitfield','farm-house':'Hal Brennan'};
for(const id of VACANT){const p=propertyById(id);assert.deepEqual(doorState(p),{state:'vacant',open:false,label:'Locked · For sale',title:p.name,message:'The door is locked. This house is vacant and for sale.'},id)}
for(const [id,name] of Object.entries(RESIDENTS)){const s=doorState(propertyById(id));assert.equal(s.state,'npc',id);assert.equal(s.label,`Locked · ${name}'s home`);assert(s.message.includes(name)&&s.message.includes('locked'))}
for(const id of [...HOUSES,'farm-house'])assert.equal(doorState(propertyById(id)).open,false,`${id}: no house opens for a player who owns nothing`);
// an owner finds the door shut with a note until interiors exist; the shops are public; the studio opens for its tenant
{const mine=doorState(propertyById('house-r1'),['house-r1']);assert.equal(mine.state,'owned');assert.equal(mine.open,true);assert.equal(mine.label,'Enter · 1 Cedar Loop');const held=worldDoors(['house-r1','house-r3']);assert.deepEqual(held.filter(d=>d.open).map(d=>d.id),['house-r1','house-r3'],'a held door opens, the others stay locked');assert.equal(held.find(d=>d.id==='house-r2').open,false)}
assert.equal(doorState(propertyById('market')).open,true);assert.equal(doorState(propertyById('studio'),[]).open,false);assert.equal(doorState(propertyById('studio'),['studio']).open,true);
assert.equal(doorState(propertyById('sawmill')).open,false);assert.equal(doorState(propertyById('alder-store')).state,'closed');
const doors=worldDoors([]);assert.deepEqual(doors.map(d=>d.id),[...HOUSES,'farm-house']);assert(doors.every(d=>d.label&&d.title&&d.message&&Number.isFinite(d.x)&&Number.isFinite(d.z)));

// ── Driveways: from the house to the road, wide enough for a car, with a front path and a parking spot ───────────────────────────────────
const parked=MAP.landmarks.filter(l=>l.decor&&/^car-/.test(l.id));
const onCar=(x,z)=>parked.some(l=>{const f=PROPS[l.prop].footprint,s=Math.round(Math.sin(l.yaw)),c=Math.round(Math.cos(l.yaw)),xs=[f.x0,f.x1].map(v=>l.x+v*c),zs=[f.x0,f.x1].map(v=>l.x*0+v*s*-1);const xx=[f.x0,f.x1].flatMap(a=>[f.z0,f.z1].map(b=>l.x+a*c+b*s)),zz=[f.x0,f.x1].flatMap(a=>[f.z0,f.z1].map(b=>l.z-a*s+b*c));return x>Math.min(...xx)-.6&&x<Math.max(...xx)+.6&&z>Math.min(...zz)-.6&&z<Math.max(...zz)+.6});
for(const plot of MAP.reserved.filter(p=>p.kind==='residential')){
 const d=plot.driveway,p=plot.path,park=plot.park,south=plot.facing==='south',houseEnd=south?d.z0+.4:d.z1-.4,roadEnd=south?d.z1-.25:d.z0+.25;
 assert(d.x1-d.x0>=3.5&&p.x1-p.x0>=1.2,`${plot.id}: a 3.5 m driveway and a front path`);
 for(let x=d.x0+.3;x<d.x1;x+=.5){assert.equal(T.surfaceAt(x,houseEnd),SURFACE.DRIVEWAY,`${plot.id}: driveway ground at the house end, x=${x.toFixed(1)}`);assert.equal(T.surfaceAt(x,roadEnd),SURFACE.ROAD,`${plot.id}: the driveway runs under the loop road at x=${x.toFixed(1)}`)}
 for(let x=p.x0+.3;x<p.x1;x+=.5){assert.equal(T.surfaceAt(x,south?p.z0+.4:p.z1-.4),SURFACE.PATH,`${plot.id}: path ground`);assert.equal(T.surfaceAt(x,south?p.z1-.25:p.z0+.25),SURFACE.ROAD,`${plot.id}: the path reaches the road`)}
 assert.equal(T.surfaceAt(park.x,park.z),SURFACE.DRIVEWAY,`${plot.id}: the parking spot is on the driveway`);assert.equal(T.footingAt(park.x,park.z),FOOTING[SURFACE.DRIVEWAY]);
 // you can walk the whole way: the driveway is open except where a car is parked, the path is always open
 for(let z=d.z0+.7;z<d.z1-.3;z+=.5)for(let x=d.x0+.3;x<d.x1;x+=.7)if(!onCar(x,z))assert(!world.blocked(x,z),`${plot.id}: the driveway is open at ${x.toFixed(1)},${z.toFixed(1)}`);
 for(let z=south?p.z0+1:p.z0+.7;z<(south?p.z1-.3:p.z1-1);z+=.5)assert(!world.blocked((p.x0+p.x1)/2,z),`${plot.id}: the path is open (its last metre by the door can hold a planter)`);
}
// Cars are parked only at homes with a resident, on their parking spot, nose toward the house; vacant homes have an empty driveway.
for(const l of parked){const plot=MAP.reserved.find(p=>p.id===l.id.slice(4).toUpperCase());assert(plot,`${l.id} belongs to a plot`);assert(Math.abs(l.x-plot.park.x)<.01&&Math.abs(l.z-plot.park.z)<.01,`${l.id} stands on its parking spot`);
 assert(propertyById('house-'+l.id.slice(4)).owner?.type==='npc',`${l.id}: only a lived-in home has a car`);assert.equal(Math.abs(Math.cos(l.yaw))>.5?(Math.cos(l.yaw)>0?'south':'north'):'side',plot.park.heading==='north'?'north':'south',`${l.id} faces the house`)}
// Anyone can walk from the driveway to the loop road and on to the city.
{const reach=T.reach(MAP.spawn.x,MAP.spawn.z);for(const plot of MAP.reserved.filter(p=>p.kind==='residential'))assert(reach[T.index(plot.park.x,plot.park.z)],`${plot.id}: the driveway is on the walkable network`)}
console.log('Properties: 29 registered (eight Cedar Heights houses and the farmhouse with locked doors, four vacant and five with residents; shops public, the studio for its tenant, the offices, barns and sawmill explicitly not enterable); every door faces its street with a clear approach; eight driveways, front paths and parking spots join the loop road, four with a parked car.');
