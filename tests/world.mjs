import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {zoneAt,isWalkable,cellOf,cellKey,parseCellKey,gridZoneAt,worldLayout,cuttableTreeAt,nearDirtRoad,FIELDS,fenceSegments,WALKABLE,createWorld} from '../dist/world.js';

// Zones and bounds: every original city coordinate stays in the city.
assert.equal(zoneAt(0).id,'city');assert.equal(zoneAt(-61).id,'city');assert.equal(zoneAt(58).id,'city');
assert.equal(zoneAt(-61.01).id,'farm');assert.equal(zoneAt(58.01).id,'forest');
for(const [x,z] of [[-5,15],[1,-6.3],[-60,-47],[57,47]])assert(isWalkable(x,z),'old city point '+x+','+z);
assert(isWalkable(-160,50)&&isWalkable(160,-50));assert(!isWalkable(0,60)&&!isWalkable(-170,0)&&!isWalkable(170,0));
// Grid maths.
assert.deepEqual(cellOf(10.9,-14.2),{ix:10,iz:-15});assert.equal(cellKey(-3,4),'-3,4');
assert.deepEqual(parseCellKey('-120,15'),{ix:-120,iz:15});for(const bad of ['1,2,3','a,b','1.5,2',' 1,2','',null,'99999,1'])assert.equal(parseCellKey(bad),null);
assert.equal(gridZoneAt(0,0),null,'city is not gridded');assert.equal(gridZoneAt(-100,-10),'farm');assert.equal(gridZoneAt(100,20),'forest');
assert.equal(gridZoneAt(-62,0),'farm');assert.equal(gridZoneAt(-61,0),null,'cell must be fully inside');assert.equal(gridZoneAt(100,56),null);
// Deterministic generation; pines sit on forest cell centres, off roads, never touching.
const a=worldLayout();assert.equal(a,worldLayout(),'cached');
assert(a.cuttable.length>250&&a.cuttable.length<450,'pine count '+a.cuttable.length);assert(a.decor.length>600);
for(const t of a.cuttable){assert.equal(gridZoneAt(t.ix,t.iz),'forest');assert.equal(t.x,t.ix+.5);assert.equal(t.z,t.iz+.5);assert(!nearDirtRoad(t.x,t.z,1.5));assert.equal(cuttableTreeAt(t.key),t)}
const keys=new Set(a.cuttable.map(t=>t.key));assert.equal(keys.size,a.cuttable.length);
for(const t of a.cuttable)for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(dx||dz)assert(!keys.has(cellKey(t.ix+dx,t.iz+dz)),'pines never touch');
for(const d of a.decor)assert(!nearDirtRoad(d.x,d.z,1.4),'decor keeps roads clear');
// Fields: inside the farm, each with exactly one gate gap on the road side.
assert.equal(FIELDS.length,8);
for(const f of FIELDS){for(let ix=f.x0;ix<f.x1;ix++)for(let iz=f.z0;iz<f.z1;iz++)assert.equal(gridZoneAt(ix,iz),'farm');assert(!nearDirtRoad(f.x0,f.z0,0)&&!nearDirtRoad(f.x1,f.z1,0))}
const rails=fenceSegments(),perimeter=FIELDS.reduce((n,f)=>n+2*(f.x1-f.x0+f.z1-f.z0),0),fenced=rails.reduce((n,s)=>n+Math.hypot(s.x1-s.x0,s.z1-s.z0),0);
assert(perimeter-fenced>=2*FIELDS.length&&perimeter-fenced<=4*FIELDS.length,'gates');

// Scene build with a minimal canvas stub (Node has no DOM).
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})})};
const scene=new THREE.Scene(),world=createWorld(scene);
const pine=a.cuttable[0];
assert(world.blocked(pine.x+.3,pine.z),'trunk blocks');assert(!world.blocked(pine.x+1,pine.z+1)||a.decor.some(d=>Math.hypot(d.x-pine.x-1,d.z-pine.z-1)<1));
const f=FIELDS[0];assert(world.blocked(f.x0+.5,f.z0),'fence blocks');assert(!world.blocked((f.x0+f.x1)/2,f.z1),'gate is open');
assert(world.cuttableNear(pine.x+1.5,pine.z).some(t=>t.key===pine.key));assert(!world.cuttableNear(pine.x+5,pine.z).some(t=>t.key===pine.key));
world.hitTree(pine.key,{x:pine.x-1,z:pine.z});world.update(.2,new THREE.PerspectiveCamera(),new THREE.Vector3());assert(world.trees.get(pine.key).standing,'a hit only shakes');
world.fellTree(pine.key,{x:pine.x-1,z:pine.z});assert(!world.blocked(pine.x+.3,pine.z),'felled tree no longer blocks');assert(!world.cuttableNear(pine.x,pine.z).some(t=>t.key===pine.key));
const trunks=scene.getObjectByName('pine-trunks'),stumps=scene.getObjectByName('pine-stumps'),m=new THREE.Matrix4();
for(let i=0;i<20;i++)world.update(.1,new THREE.PerspectiveCamera(),new THREE.Vector3());
trunks.getMatrixAt(world.trees.get(pine.key).index,m);assert.equal(m.elements[0],0,'pine hidden after the fall');
stumps.getMatrixAt(world.trees.get(pine.key).index,m);assert(m.elements[0]>.5,'stump left behind');
const other=a.cuttable[1];assert(world.setFelled(other.key));assert(!world.setFelled(other.key),'idempotent');assert(!world.blocked(other.x,other.z));
// Grid overlay: hidden in the city, visible with a target cell in the zones.
assert.equal(world.updateGrid({x:0,z:0},0,false),null);assert(!scene.getObjectByName('plot-grid').visible);
const target=world.updateGrid({x:100.2,z:20.2},0,true);assert.deepEqual([target.ix,target.iz,target.zone,target.key],[100,21,'forest','100,21']);
assert(scene.getObjectByName('plot-grid').visible&&scene.getObjectByName('plot-grid').geometry.drawRange.count>100);
assert.equal(world.updateGrid({x:-61.2,z:0},Math.PI/2,true),null,'no target cell across the city seam');
console.log(`World zones, bounds, grid maths, deterministic ${a.cuttable.length} pines + ${a.decor.length} decor trees, fenced fields with gates, collisions, felling, stumps and grid overlay passed.`);
