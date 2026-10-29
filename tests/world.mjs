import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
const sx=matrix=>new THREE.Vector3().setFromMatrixScale(matrix).x; // a matrix's x scale, however the tree is turned
import {zoneAt,isWalkable,cellOf,cellKey,parseCellKey,gridZoneAt,worldLayout,cuttableTreeAt,nearDirtRoad,nearAsphalt,inRiver,FIELDS,fenceSegments,WALKABLE,createWorld} from '../dist/world.js';

// Zones and bounds: every original city coordinate stays in the city.
assert.equal(zoneAt(0).id,'city');assert.equal(zoneAt(-61).id,'city');assert.equal(zoneAt(58).id,'city');
assert.equal(zoneAt(-30,-100).id,'county');assert.equal(zoneAt(-100,-150).id,'farm');assert.equal(zoneAt(60,-150).id,'forest');assert.equal(zoneAt(-30,-60).id,'county');
for(const [x,z] of [[-5,15],[1,-6.3],[-60,-47],[57,47]])assert(isWalkable(x,z),'old city point '+x+','+z);
assert(isWalkable(-100,-150)&&isWalkable(100,-150)&&isWalkable(-30,-88)&&isWalkable(-30,-60),'farm, forest, bridge and county road');assert(!isWalkable(0,60)&&!isWalkable(-100,0)&&!isWalkable(100,0)&&!isWalkable(0,-86)&&!isWalkable(-40,-86)&&!isWalkable(-20,-86)&&!isWalkable(-30,-250),'outskirts and the river block; only the bridge crosses');
// Grid maths.
assert.deepEqual(cellOf(10.9,-14.2),{ix:10,iz:-15});assert.equal(cellKey(-3,4),'-3,4');
assert.deepEqual(parseCellKey('-120,15'),{ix:-120,iz:15});for(const bad of ['1,2,3','a,b','1.5,2',' 1,2','',null,'99999,1'])assert.equal(parseCellKey(bad),null);
assert.equal(gridZoneAt(0,0),null,'city is not gridded');assert.equal(gridZoneAt(-100,-150),'farm');assert.equal(gridZoneAt(100,-150),'forest');assert.equal(gridZoneAt(-30,-150),null,'the County Road is not gridded');
assert.equal(gridZoneAt(-36,-150),'farm');assert.equal(gridZoneAt(-35,-150),null,'cell must be fully inside');assert.equal(gridZoneAt(100,-100),null);
// Deterministic generation; pines sit on forest cell centres, off roads, never touching.
const a=worldLayout();assert.equal(a,worldLayout(),'cached');
assert(a.cuttable.length>250&&a.cuttable.length<450,'pine count '+a.cuttable.length);assert(a.decor.length>300);{const inForest=a.decor.filter(t=>zoneAt(t.x,t.z).id==='forest').length,total=a.cuttable.length+inForest;assert(total>=400&&total<=500,'Pine Ridge has '+total+' trees (400-500 wanted)')}
for(const t of a.decor){assert(!inRiver(t.x,t.z,3),'no tree stands in the river');assert(!nearAsphalt(t.x,t.z,2.5),'no tree stands on the road')}
for(const t of a.cuttable){assert.equal(gridZoneAt(t.ix,t.iz),'forest');assert.equal(t.x,t.ix+.5);assert.equal(t.z,t.iz+.5);assert(!nearDirtRoad(t.x,t.z,1.5));assert.equal(cuttableTreeAt(t.key),t)}
const keys=new Set(a.cuttable.map(t=>t.key));assert.equal(keys.size,a.cuttable.length);
for(const t of a.cuttable)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(dx||dz)assert(!keys.has(cellKey(t.ix+dx,t.iz+dz)),'pines never touch');
for(const d of a.decor)assert(!nearDirtRoad(d.x,d.z,1.4),'decor keeps roads clear');
// Fields: inside the farm, big and open.
assert.equal(FIELDS.length,3,'three big open fields');
for(const f of FIELDS){for(let ix=f.x0;ix<f.x1;ix++)for(let iz=f.z0;iz<f.z1;iz++)assert.equal(gridZoneAt(ix,iz),'farm');assert(!nearDirtRoad(f.x0,f.z0,0)&&!nearDirtRoad(f.x1,f.z1,0))}
const rails=fenceSegments(),farm=WALKABLE.find(w=>w.zone==='farm'),perimeter=2*(farm.x1-farm.x0+farm.z1-farm.z0),fenced=rails.reduce((n,seg)=>n+Math.hypot(seg.x1-seg.x0,seg.z1-seg.z0),0);
assert(Math.abs(perimeter-fenced-9)<.01,'the perimeter is fenced except one 9 m gap where the farm road enters: '+(perimeter-fenced));
assert(rails.every(seg=>seg.x0===farm.x0||seg.x0===farm.x1||seg.z0===farm.z0||seg.z0===farm.z1),'only the outer edge is fenced; nothing inside the farm');

// Scene build with a minimal canvas stub (Node has no DOM).
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const scene=new THREE.Scene(),world=createWorld(scene,{cullRadius:Infinity});
const pine=a.cuttable[0];
assert(world.blocked(pine.x+.3,pine.z),'trunk blocks');assert(!world.blocked(pine.x+1,pine.z+1)||a.decor.some(d=>Math.hypot(d.x-pine.x-1,d.z-pine.z-1)<1));
assert(world.blocked(-100,-216),'the perimeter fence blocks');assert(world.blocked(-35,-190),'and so does the side along the County Road');assert(!world.blocked(-35,-160),'the gap where the farm road enters is open');for(const f of FIELDS)assert(!world.blocked((f.x0+f.x1)/2,(f.z0+f.z1)/2)&&!world.blocked(f.x0+1,f.z0+1),'fields are open ground for vehicles: '+f.id);
assert(world.cuttableNear(pine.x+1.5,pine.z).some(t=>t.key===pine.key));assert(!world.cuttableNear(pine.x+5,pine.z).some(t=>t.key===pine.key));
world.hitTree(pine.key,{x:pine.x-1,z:pine.z});world.update(.2,new THREE.PerspectiveCamera(),new THREE.Vector3());assert(world.trees.get(pine.key).standing,'a hit only shakes');
world.fellTree(pine.key,{x:pine.x-1,z:pine.z});assert(!world.blocked(pine.x+.3,pine.z),'felled tree no longer blocks');assert(!world.cuttableNear(pine.x,pine.z).some(t=>t.key===pine.key));
const trunks=world.trees.get(pine.key).meshes[0],stumps=scene.getObjectByName('pine-stumps'),m=new THREE.Matrix4();
for(let i=0;i<20;i++)world.update(.1,new THREE.PerspectiveCamera(),new THREE.Vector3());
trunks.getMatrixAt(world.trees.get(pine.key).slot,m);assert.equal(world.trees.get(pine.key).slot,-1,'a felled pine is not drawn at all');
stumps.getMatrixAt(world.trees.get(pine.key).index,m);assert(sx(m)>.5,'stump left behind');
const other=a.cuttable[1];assert(world.setFelled(other.key));assert(!world.setFelled(other.key),'idempotent');assert(!world.blocked(other.x,other.z));
// Fall callback, stump, sapling, regrowth.
{const t3=a.cuttable[3],cam=new THREE.PerspectiveCamera(),look=new THREE.Vector3();let landed=0;
 world.fellTree(t3.key,{x:t3.x-1,z:t3.z},()=>landed++);for(let i=0;i<10;i++)world.update(.1,cam,look);assert.equal(landed,0,'still falling at 1 s');
 for(let i=0;i<10;i++)world.update(.1,cam,look);assert.equal(landed,1,'callback once the trunk has landed');for(let i=0;i<10;i++)world.update(.1,cam,look);assert.equal(landed,1);
 const trunk=world.trees.get(t3.key).meshes[0],stump=scene.getObjectByName('pine-stumps'),at=world.trees.get(t3.key).index,slot=world.trees.get(t3.key).slot,mat=new THREE.Matrix4();
 stump.getMatrixAt(at,mat);assert(sx(mat)>.5,'stump after the fall');
 assert(world.setStage(t3.key,'sapling'));trunk.getMatrixAt(world.trees.get(t3.key).slot,mat);assert(sx(mat)>.1&&sx(mat)<.5,'a small pine: '+sx(mat));assert(!world.blocked(t3.x+.3,t3.z),'a sapling does not block');assert(!world.cuttableNear(t3.x,t3.z).some(t=>t.key===t3.key),'and cannot be chopped');
 assert(!world.setStage(t3.key,'sapling'),'idempotent');assert(world.setStage(t3.key,'stump'));assert.equal(world.trees.get(t3.key).slot,-1,'a stump is not drawn as a tree');
 assert(world.setRegrown(t3.key));trunk.getMatrixAt(world.trees.get(t3.key).slot,mat);assert(sx(mat)>.8,'full size again');assert(world.blocked(t3.x+.3,t3.z),'solid again');assert(world.cuttableNear(t3.x,t3.z).some(t=>t.key===t3.key),'choppable again');
 stump.getMatrixAt(at,mat);assert.equal(sx(mat),0,'stump gone');assert(!world.setRegrown(t3.key),'already standing');
 world.fellTree(t3.key,{x:t3.x-1,z:t3.z});for(let i=0;i<25;i++)world.update(.1,cam,look);assert(world.setStage(t3.key,'sapling'),'can fell it again after regrowth');}
// Target ring and ground logs.
{const ring=scene.getObjectByName('tree-target');assert(!ring.visible);world.setTarget(a.cuttable[5]);assert(ring.visible&&ring.position.x===a.cuttable[5].x&&ring.position.z===a.cuttable[5].z);world.setTarget(null);assert(!ring.visible);
 const logs=scene.getObjectByName('ground-logs');assert.equal(logs.count,0);world.setLogs([{x:100,z:5,rot:0},{x:101,z:6,rot:1.2}]);assert.equal(logs.count,2);
 const m=new THREE.Matrix4();logs.getMatrixAt(1,m);assert.deepEqual([m.elements[12],m.elements[14]],[101,6]);world.setLogs([]);assert.equal(logs.count,0);
 world.setLogs(Array.from({length:500},(_,i)=>({x:100,z:5,rot:0})));assert(logs.count<=96,'instance cap');world.setLogs([]);}
// Grid overlay: hidden in the city, visible with a target cell in the zones.
assert.equal(world.updateGrid({x:0,z:0},0,false),null);assert(!scene.getObjectByName('plot-grid').visible);
const target=world.updateGrid({x:100.2,z:-149.8},0,true);assert.deepEqual([target.ix,target.iz,target.zone,target.key],[100,-149,'forest','100,-149']);
assert(scene.getObjectByName('plot-grid').visible&&scene.getObjectByName('plot-grid').geometry.drawRange.count>100);
assert.equal(world.updateGrid({x:-35.2,z:-150},Math.PI/2,true),null,'no target cell across the farm and County Road seam');
console.log(`World zones, bounds, grid maths, tree stages and fall callback, target ring, ground logs, deterministic ${a.cuttable.length} pines + ${a.decor.length} decor trees, fenced fields with gates, collisions, felling, stumps and grid overlay passed.`);
