import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {GLTFLoader} from '../dist/vendor/GLTFLoader.js';
import {RIGGED} from '../dist/rigged-assets.js';

// The converted sawmill (scripts/rigged-glb.mjs) keeps everything the spec (assets-src/assets/sawmill_spec.md) relies on: nodes, rigs, clips, anchors and emissive materials,
// and merges the static meshes by material so it stays inside the draw-call budget. This opens the embedded file exactly as the game will.
const m=RIGGED['sawmill-v4'];assert(m,'sawmill-v4 is converted');
const bytes=Uint8Array.from(Buffer.from(m.glb,'base64')),gltf=await new GLTFLoader().parseAsync(bytes.buffer,'');
const root=gltf.scene.getObjectByName('Sawmill');assert(root,'root node Sawmill');assert.equal(root.position.length(),0,'the root is at the origin');
const byName=n=>{const o=gltf.scene.getObjectByName(n);assert(o,'node '+n+' exists');return o};

// Rigs and skinned meshes: separate armatures per clip group, so the clips can play together.
const skinned=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)skinned.push(o.name)});
// (a mesh with two materials, like the blade, loads as a group Blade_Mesh of two skinned meshes: three skinned nodes, four skinned draws)
assert.deepEqual(skinned.sort(),['Blade_1','Blade_2','Switch_Lamp_On','Switch_Lever'],'three skinned nodes');assert.deepEqual(byName('Blade_Mesh').children.map(c=>c.name).sort(),['Blade_1','Blade_2']);
for(const n of ['BladeRig','SawmillRig','Blade','Switch','Lamp'])byName(n);
for(const n of ['Blade_1','Blade_2'])assert.deepEqual(byName(n).skeleton.bones.map(b=>b.name),['Blade']);assert.deepEqual(byName('Switch_Lever').skeleton.bones.map(b=>b.name).sort(),['Lamp','Switch']);
assert.equal(byName('Blade_Mesh').parent.name,'BladeRig');assert.equal(byName('Switch_Lever').parent.name,'SawmillRig');

// Animated objects stay separate nodes, with the rest state from the spec.
for(let i=0;i<4;i++){const p=byName('Plank_Out_'+i);assert(p.isMesh);assert(Math.abs(p.scale.x-.001)<1e-6,'planks are hidden at rest')}
for(let i=0;i<8;i++)assert(byName('Belt_Roller_'+i).isMesh);
assert.equal(byName('FeedLog').children.length,2,'the log is bark and end grain');
// Static meshes are merged by material; the individual names are gone on purpose.
assert.equal(gltf.scene.getObjectByName('Post_00'),undefined,'static parts are merged');
const merged=[];gltf.scene.traverse(o=>{if(o.name.startsWith('Static_'))merged.push(o.name)});
assert(merged.length>=8&&merged.length<=14,'static meshes merged to one per material: '+merged.length);

// Clips: names, targets, and the facts the game code must handle (reported, not fixed here).
const clips=new Map(gltf.animations.map(c=>[c.name,c]));
assert.deepEqual([...clips.keys()].sort(),['BeltRun','BladeSpin','Cut','SwitchOff','SwitchOn']);
const targets=c=>[...new Set(c.tracks.map(t=>t.name.split('.')[0]))].sort();
assert.deepEqual(targets(clips.get('BladeSpin')),['Blade']);assert.deepEqual(targets(clips.get('SwitchOn')),['Lamp','Switch']);assert.deepEqual(targets(clips.get('SwitchOff')),['Lamp','Switch']);
assert.deepEqual(targets(clips.get('Cut')),['FeedLog','Plank_Out_0','Plank_Out_1','Plank_Out_2','Plank_Out_3']);
assert.equal(targets(clips.get('BeltRun')).length,8);
const near=(a,b)=>Math.abs(a-b)<.002;
assert(near(clips.get('Cut').duration,100/24),'Cut is 100 frames at 24 fps: '+clips.get('Cut').duration);
assert(near(clips.get('SwitchOn').duration,9/24)&&near(clips.get('SwitchOff').duration,9/24),'switch clips are 9 frames');
// The two loop clips were exported with one extra frame and start at 1/24, not 0: the first and last rotation keys are the same pose, so the true loop is 24 frames (1.0 s).
for(const n of ['BladeSpin','BeltRun']){const c=clips.get(n),t=c.tracks.find(t=>t.name.endsWith('.quaternion'));assert.equal(t.times.length,25,n+' has 25 keys');assert(near(t.times[0],1/24)&&near(c.duration,25/24),n+' runs from 1/24 to 25/24 as exported')}
{const t=clips.get('BladeSpin').tracks.find(t=>t.name==='Blade.quaternion'),a=new THREE.Quaternion().fromArray(t.values,0),b=new THREE.Quaternion().fromArray(t.values,24*4);assert(Math.abs(a.dot(b))>.9999,'BladeSpin: last key repeats the first (one full turn)')}

// Anchors: every spec anchor exists, and the data table matches the nodes.
const spec={anchor_blade_sound:[0,1.15,0],anchor_sawdust:[0,1.38,0],anchor_log_in:[-3.2,1.4,.95],anchor_player:[0,.3,1.7],anchor_switch:[-4,.3,3.9],anchor_switch_prompt:[-4,1.45,3.35],anchor_lamp:[-4,1.56,3.315],anchor_plank_out:[3.2,1.3,-.95],anchor_plank_pile:[6,.3,0],
 anchor_belt_0:[6.4,.8,1.5],anchor_belt_1:[6.4,.8,.5],anchor_belt_2:[6.4,.8,-.5],anchor_belt_3:[6.4,.8,-1.5],anchor_belt_clear:[6.4,1,-2.3],anchor_belt_sound:[6.4,1.05,0],anchor_beacon:[7.6,2.3,-2.1]};
for(const [name,want] of Object.entries(spec)){const got=m.anchors[name];assert(got,name+' is in the table');assert(want.every((v,i)=>Math.abs(v-got[i])<.01),`${name} ${got} vs spec ${want}`);assert(byName(name).position.distanceTo(new THREE.Vector3(...got))<.001,name+' node matches the table')}
assert.equal(Object.keys(m.anchors).length,Object.keys(spec).length,'no unexpected anchors');

// Materials: emissive colours and strengths survive; both beacon lenses are lit in the file (the code turns one off).
const mats=new Map();gltf.scene.traverse(o=>{if(o.material)mats.set(o.material.name,o.material)});
for(const [n,strength] of [['Lamp_On',4],['Beacon_Green',3.6],['Beacon_Red',4]]){const mat=mats.get(n);assert(mat,n+' exists');assert(mat.emissive.r+mat.emissive.g+mat.emissive.b>0,n+' has an emissive colour');assert(near(mat.emissiveIntensity,strength),`${n} emissive strength ${mat.emissiveIntensity}`)}
assert.equal(mats.get('Lamp_Off').emissiveIntensity,1);assert.equal(mats.get('Lamp_Off').emissive.r+mats.get('Lamp_Off').emissive.g,0,'Lamp_Off is dark');
assert(gltf.scene.getObjectByName('Static_Beacon_Green').material===mats.get('Beacon_Green'),'each lens has its own material, so one can go dark alone');
assert.equal(mats.size,14,'all 14 materials');

// Budget: triangles unchanged by the merge, draw calls within the plan.
let drawCalls=0,triangles=0;gltf.scene.traverse(o=>{if(o.isMesh){drawCalls++;triangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3}});
assert.equal(triangles,m.report.trianglesBefore,'the merge changed no triangles');assert(drawCalls<=30,'draw calls: '+drawCalls);
assert.equal(m.report.drawCallsAfter,drawCalls);

// Bounds table: the deck tops the spec gives, in glTF coordinates.
const top=n=>m.bounds[n][4];assert(near(top('Deck'),.3)&&near(top('ShedDeck'),.2),'deck tops 0.30 and 0.20');
const w=n=>[m.bounds[n][0],m.bounds[n][3]];assert(near(w('Deck')[0],-4.3)&&near(w('Deck')[1],4.3),'main deck is 8.6 m wide: '+w('Deck'));
// The whole prop is wider than the spec's footprint (-4.6..8.2 by +-3.3): the log pile reaches x = -7.74 and the roofs overhang to z = +-3.72 and x = 8.29. Placement and tree clearing must use these.
const all=Object.values(m.bounds),span=k=>Math.max(...all.map(b=>b[k]));const lo=k=>Math.min(...all.map(b=>b[k]));
assert(near(lo(0),-7.738)&&near(span(3),8.288)&&near(lo(2),-3.724)&&near(span(5),3.724),'whole-prop footprint');assert(span(4)>5.6&&span(4)<5.8,'roof ridge about 5.6 m');
for(const n of ['Post_00','ShedPost_11','BenchTop_1','BenchTop_-1','Belt_Beam_L','Belt_Leg_R1','Belt_EndStop','Deck','ShedDeck'])assert(m.bounds[n],n+' bounds');
// The in-game path: createProp returns a group at once, filled when the model has decoded; the rest state is the spec's (lever up, lamp dark), every material goes through the sightline fade.
{const {createProp,propInfo}=await import('../dist/props.js'),applied=new Set(),fade={apply:mat=>{applied.add(mat);return mat}};
 const group=createProp('sawmill-v4',fade);assert.equal(group.name,'prop-sawmill-v4');assert.equal(group.children.length,0,'empty until decoded');
 await group.userData.ready;const scene=group.userData.scene;
 assert(Math.abs(scene.getObjectByName('Lamp').scale.x-.001)<1e-6,'lamp bone is dark at rest (last frame of SwitchOff)');
 const lever=scene.getObjectByName('Switch'),up=new THREE.Quaternion().copy(lever.quaternion);{const off=group.userData.clips.get('SwitchOff'),t=off.tracks.find(t=>t.name==='Switch.quaternion');assert(up.angleTo(new THREE.Quaternion().fromArray(t.values,t.values.length-4))<1e-5,'lever is where SwitchOff leaves it')}
 const fresh=new Set();scene.traverse(o=>{if(o.isMesh)fresh.add(o.material)});assert.equal(applied.size,fresh.size,'every material has the sightline fade');
 let skinnedCulled=0;scene.traverse(o=>{if(o.isSkinnedMesh&&o.frustumCulled)skinnedCulled++});assert.equal(skinnedCulled,0,'skinned meshes are not frustum-culled by their bind pose');
 assert.deepEqual(group.userData.anchors,propInfo('sawmill-v4').anchors)}console.log(`Sawmill asset: ${m.report.nodesAfter} nodes, ${drawCalls} draw calls (was ${m.report.primitivesBefore}), ${triangles} triangles, 3 skinned nodes, ${gltf.animations.length} clips, ${Object.keys(m.anchors).length} anchors, emissive materials intact; loop clips carry one extra frame (reported).`);
