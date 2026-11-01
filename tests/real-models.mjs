// Real models where there were placeholders: street trees, parked cars, and the flatbed truck's tyres. Checked in the real game scene (the packaged release).
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {bootGame} from './support/boot-game.mjs';
import {townSpots} from '../dist/town.js';
import {createProp,propInfo} from '../dist/props.js';
import {WHEELS,addWheels} from '../dist/vehicle-parts.js';
import {createVehicles} from '../dist/neighborhood.js';
const g=await bootGame({position:{x:1,z:-6.3}}),scene=g.scene(),S=g.GameState;
const named=re=>{const out=[];scene.traverse(o=>{if(re.test(o.name))out.push(o)});return out};

// ── Trees: the town's 13 and Oak Street's 11 are the broadleaf models, and nothing is left of the cylinder-and-blob kind
{const bark=named(/^street-tree-broadleaf\.\d-bark$/),leaves=named(/^street-tree-broadleaf\.\d-leaves$/),want=townSpots().tree.length+11;
 assert.equal(bark.reduce((n,m)=>n+m.count,0),want,`${want} street trees as models`);assert.equal(leaves.reduce((n,m)=>n+m.count,0),want);
 assert(bark.every(m=>m.castShadow&&m.frustumCulled&&m.geometry.attributes.uv),'textured, shadow-casting and frustum-culled');
 assert.equal(named(/^tree$/).length,0,'the old cylinder-and-blob trees are gone');
 let triangles=0;for(const m of bark.concat(leaves))triangles+=m.count*m.geometry.index.count/3;assert(triangles<45000,`street trees cost ${Math.round(triangles)} triangles (about 1,200 each)`);
 // each model is one of the two nature broadleaf models, so they dither with the sightline fade like the forest
 assert(bark.every(m=>m.material.customProgramCacheKey()==='city-sightline-fade'),'with the sightline fade');}

// ── Vehicles: the three cars on Oak Street are converted car models (not boxes), solid, in the kerb lanes
{const cars=named(/^prop-(taxi|sports-car-2|suv)$/).filter(o=>[[23,-1.9],[40,13.9],[-35,-22]].some(([x,z])=>Math.hypot(o.position.x-x,o.position.z-z)<.01));
 assert.equal(cars.length,3,'the three parked cars are the models taxi, sports-car-2 and suv');
 assert(cars.every(c=>c.isMesh&&c.geometry.index.count/3>2500),'real car geometry (about 3,000 triangles each, wheels included)');
 assert.equal(named(/^parked-/).length,0);
 // solid: standing in one, holding W, you are moved out
 const me=S.me.position;Object.assign(me,{x:23,z:-1.9});g.pump(.1);g.send('keydown','KeyW');g.pump(2.2);g.send('keyup','KeyW');
 assert(Math.hypot(me.x-23,me.z+1.9)>=1.2,`the taxi is solid (you ended ${Math.hypot(me.x-23,me.z+1.9).toFixed(2)} m from its centre)`);
 // the old test signature still works: no world, no fade
 const blocks=[],made=createVehicles(new THREE.Scene(),blocks);assert.equal(made.length,3);assert.equal(blocks.length,3);assert(made.every(v=>!v.drivable&&v.id&&v.spawn&&v.name));}

// ── The flatbed truck has its tyres
{const tyres=named(/^wheels-tyres$/),hubs=named(/^wheels-hubs$/);
 assert.equal(tyres.length,1,'one truck, one set of tyres');assert.equal(tyres[0].count,6,'six wheels: a single axle and a pair, a wheel each side');assert.equal(hubs[0].count,6);assert.equal(tyres[0].parent.name,'prop-flatbed','parented to the truck so they turn and stand with it');
 const info=propInfo('flatbed'),spec=WHEELS.flatbed,m=new THREE.Matrix4(),p=new THREE.Vector3(),sc=new THREE.Vector3(),q=new THREE.Quaternion();
 for(let i=0;i<6;i++){tyres[0].getMatrixAt(i,m);m.decompose(p,q,sc);
  assert(Math.abs(p.y-sc.y)<1e-6,'every tyre stands on the ground (its centre is one radius up)');assert(Math.abs(Math.abs(p.x)-spec.x)<1e-6,'one each side');assert(p.y+sc.y<1.58,'and is no taller than its arch');assert(Math.abs(p.x)+sc.x/2<info.width/2,'inside the truck\'s width');
  assert(Math.abs(sc.x-spec.width)<1e-6&&Math.abs(sc.y-sc.z)<1e-6,'round, with the axis along x')}
 const zs=[...new Set(Array.from({length:6},(_,i)=>{tyres[0].getMatrixAt(i,m);m.decompose(p,q,sc);return +p.z.toFixed(2)}))].sort((a,b)=>a-b);
 assert.deepEqual(zs,[-2.7,1.48,3.04],'in the three axle positions');assert(zs[2]-zs[1]>=2*spec.radius,'the pair do not overlap each other');
 // another prop gets nothing
 assert.equal(addWheels('car',new THREE.Object3D(),{apply:x=>x}),null);
 // a bare prop built outside the game also gets them
 const lone=createProp('flatbed',{apply:x=>x});assert(lone.children.some(c=>c.name==='wheels-tyres'));}
console.log('Real models: 24 street trees are the broadleaf models (no cylinder-and-blob trees left, about 29k triangles), the three Oak Street cars are converted car models and solid, and the flatbed truck has six tyres with hubs inside its arches.');
await g.done();process.exit(0);