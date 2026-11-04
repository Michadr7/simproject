// Real models where there were placeholders: street trees, parked cars, and the Worktruck's wheels. Checked in the real game scene (the packaged release).
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {bootGame} from './support/boot-game.mjs';
import {townSpots} from '../dist/town.js';
import {createProp,propInfo} from '../dist/props.js';
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

// ── The Worktruck has four real wheel meshes (the flatbed truck was removed in 0.33): each in a pivot at its axle, parented to the truck, so they spin and steer with it
{const trucks=named(/^vehicle-eastbank-worktruck$/);assert.equal(trucks.length,1,'one Worktruck in the game scene');const wheels=trucks[0].userData.wheels;assert.equal(wheels.length,4);for(const w of wheels){assert(w.pivot.parent===trucks[0]&&w.spin.parent===w.pivot);assert(Math.abs(w.pivot.position.y-w.radius)<.02,'each stands on the ground')}
 assert.equal(named(/^wheels-tyres$/).length,0,'no generated tyres remain');assert.equal(named(/^prop-flatbed$/).length+named(/^vehicle-eastbank-flatbed$/).length,0,'no flatbed anywhere in the world');
 assert.equal(createProp('car',{apply:x=>x}).userData.wheels,undefined,'a prop without split wheels gets none')}console.log('Real models: 24 street trees are the broadleaf models (no cylinder-and-blob trees left, about 29k triangles), the three Oak Street cars are converted car models and solid, and the Worktruck has four real wheel meshes.');
await g.done();process.exit(0);