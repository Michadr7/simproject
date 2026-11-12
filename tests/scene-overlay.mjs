import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';import {join} from 'node:path';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {propInfo} from '../dist/props.js';
import {emptyEdits,normaliseEdits,applyToNamed,editedYardItems,sceneKeys,yardKey,drawCallCost} from '../dist/scene-edit.js';
import {SCENE_EDITS} from '../dist/scene-edits.js';
import {groupByModel,turnedColliders,createSceneOverlay} from '../dist/scene-overlay.js';
import {bootGame} from './support/boot-game.mjs';

const fade={apply:m=>m},flat=()=>0,near=(a,b,m)=>assert(Math.abs(a-b)<1e-9,`${m}: ${a} vs ${b}`);
const fakeColliders=()=>{const list=[];return {list,box(x,z,hx,hz){const c={circle:false,x,z,hx,hz,active:true};list.push(c);return c}}};
const PROPS=['prop.pallet','prop.crate-large','container-a'];
const sample=normaliseEdits({added:[
 {id:'e-0001',prop:PROPS[0],x:10,z:20,yaw:0},{id:'e-0002',prop:PROPS[1],x:12,z:20,yaw:Math.PI/2},{id:'e-0003',prop:PROPS[0],x:14,z:20,yaw:0},{id:'e-0004',prop:PROPS[2],x:30,z:40,yaw:Math.PI/2}]});

// ── The shipped overlay is empty ──
assert.deepEqual(SCENE_EDITS,emptyEdits());

// ── Grouping: one group per distinct model, in edit order ──
{const g=groupByModel(sample.added);
 assert.deepEqual([...g.keys()],[PROPS[0],PROPS[1],PROPS[2]]);
 assert.deepEqual(g.get(PROPS[0]).map(a=>a.id),['e-0001','e-0003']);
 assert.equal(groupByModel([]).size,0);assert.equal(drawCallCost(sample),3);}

// ── Colliders turned by yaw ──
{const base=propInfo(PROPS[2]).colliders;assert(base.length>0,'the container has colliders');
 const b0=base[0],t0=turnedColliders(PROPS[2],{x:100,z:50,yaw:0})[0];
 near(t0.x,100+b0.x,'x');near(t0.z,50+b0.z,'z');near(t0.hx,b0.hx,'hx');near(t0.hz,b0.hz,'hz');
 const t90=turnedColliders(PROPS[2],{x:100,z:50,yaw:Math.PI/2})[0];
 near(t90.hx,b0.hz,'quarter turn swaps hx');near(t90.hz,b0.hx,'quarter turn swaps hz');
 near(t90.x,100+b0.z,'turned x');near(t90.z,50-b0.x,'turned z'); // the same formula the world uses for landmarks (x + bx cos + bz sin, z - bx sin + bz cos)
 const t45=turnedColliders(PROPS[2],{x:0,z:0,yaw:Math.PI/4})[0];assert(t45.hx>=Math.min(b0.hx,b0.hz)&&t45.hz>=Math.min(b0.hx,b0.hz));near(t45.hx,t45.hz*0+(Math.SQRT1_2*(b0.hx+b0.hz)),'45 degrees grows the box');}

// ── Building, rebuild disposes and replaces ──
{const cols=fakeColliders(),parent=new THREE.Group(),ov=createSceneOverlay({parent,fade,heightAt:flat,colliders:cols,edits:sample});
 assert.equal(ov.meshes().length,3,'three models, three meshes (three draw calls)');assert.equal(ov.drawCalls(),3);
 assert.equal(parent.getObjectByName('scene-overlay').children.length,3);
 const pallet=ov.meshes().find(m=>m.name==='scene-overlay-'+PROPS[0]);assert.equal(pallet.count,2);
 const expected=sample.added.reduce((n,a)=>n+propInfo(a.prop).colliders.length,0);
 assert.equal(cols.list.length,expected);assert.equal(ov.colliders().length,expected);assert(cols.list.every(c=>c.active));
 const hit=cols.list.find(c=>Math.abs(c.x-10)<2&&Math.abs(c.z-20)<2);assert(hit,'a collider stands at the first pallet');
 const old=ov.meshes();let disposed=0;for(const m of old)m.addEventListener('dispose',()=>disposed++);
 const oldBoxes=cols.list.slice();
 ov.rebuild(normaliseEdits({added:[{id:'e-0009',prop:PROPS[1],x:50,z:60,yaw:0}]}));
 assert.equal(disposed,3,'the old instanced meshes are disposed');
 assert.equal(ov.meshes().length,1);assert.equal(parent.getObjectByName('scene-overlay').children.length,1);
 assert(oldBoxes.every(c=>!c.active),'the old colliders are switched off');
 assert.equal(ov.colliders().length,propInfo(PROPS[1]).colliders.length);assert(ov.colliders().every(c=>c.active&&Math.abs(c.x-50)<3));
 ov.rebuild(emptyEdits());assert.equal(ov.meshes().length,0);assert.equal(ov.colliders().length,0);
 assert.equal(parent.getObjectByName('scene-overlay').userData.sceneOverlay,ov,'reachable from the group');}
{const cols=fakeColliders(),ov=createSceneOverlay({parent:new THREE.Group(),fade,heightAt:flat,colliders:cols}); // the shipped overlay: nothing
 assert.equal(ov.meshes().length,0);assert.equal(cols.list.length,0);}

// ── Named props: keys, applyToNamed, sceneKeys ──
{const keys=sceneKeys(),unique=new Set(keys.map(k=>k.key));
 assert.equal(unique.size,keys.length,'keys are unique');assert.equal(keys.length,MAP.yards.reduce((n,y)=>n+y.items.length,0),'every yard prop has a key');
 assert(unique.has('gas-station.pump-island-1')&&unique.has('gas-station.forecourt-canopy-1')&&unique.has('timber-yard.pallet-6'));
 assert.equal(yardKey('freight-yard','container-a',3),'freight-yard.container-a-3');
 const island=keys.find(k=>k.key==='gas-station.pump-island-1');assert.deepEqual([island.prop,island.x,island.z],['prop.pump-island',156.5,-8.25]);
 const spot={prop:'prop.pallet',x:1,z:2,yaw:0,y:0},edits=normaliseEdits({moved:{a:{x:5,z:6,yaw:1}},removed:['b']});
 assert.equal(applyToNamed('c',spot,edits),spot,'untouched: the same spot');assert.equal(applyToNamed('c',spot,undefined),spot);
 assert.equal(applyToNamed('b',spot,edits),null,'removed: null');
 assert.deepEqual(applyToNamed('a',spot,edits),{prop:'prop.pallet',x:5,z:6,yaw:1,y:0},'moved: new spot, other fields kept');
 const yard=MAP.yards.find(y=>y.id==='timber-yard');
 assert.equal(editedYardItems(yard,emptyEdits()),yard.items,'empty overlay: the very same list');
 const e=normaliseEdits({moved:{'timber-yard.pallet-2':{x:1,z:2,yaw:3}},removed:['timber-yard.pallet-1']}),items=editedYardItems(yard,e);
 assert.equal(items.length,yard.items.length-1);assert(!items.includes(yard.items.find(i=>i.prop==='prop.pallet')));
 assert(items.some(i=>i.prop==='prop.pallet'&&i.x===1&&i.z===2&&i.yaw===3));}

// ── The packaged game with a non-empty overlay ──
const count=scene=>{let calls=0,instanced=0;scene.traverse(o=>{if(o.isMesh&&o.visible){calls++;if(o.isInstancedMesh)instanced++}});return {calls,instanced}};
const inOverlay=scene=>{let n=0;scene.getObjectByName('scene-overlay')?.traverse(o=>{if(o.isMesh)n++});return n};
const withEdits=edits=>async dir=>{await writeFile(join(dir,'scene-edits.js'),`export const SCENE_EDITS=${JSON.stringify(edits)};\n`)};
let before,after,afterRemoved;
{const g=await bootGame({play:false});try{g.pump(1);const s=g.scene();before=count(s);
  assert.equal(inOverlay(s),0,'the empty overlay draws nothing');
  assert.equal(s.getObjectByName('scene-overlay').userData.sceneOverlay.colliders().length,0);}finally{await g.done()}}
{const g=await bootGame({play:false,editRelease:withEdits({version:1,added:sample.added.filter(a=>a.id!=='e-0003'),moved:{},removed:[]})});
 try{g.pump(1);const s=g.scene();after=count(s);
  const ov=s.getObjectByName('scene-overlay').userData.sceneOverlay,mesh=s.getObjectByName('scene-overlay-'+PROPS[2]);
  assert(mesh&&mesh.isInstancedMesh&&mesh.count===1,'the added container is drawn');
  assert.equal(inOverlay(s),3);
  const box=ov.colliders().find(c=>Math.abs(c.x-30)<8&&Math.abs(c.z-40)<8);assert(box&&box.active,'and has a collider');
  assert.equal(after.calls-before.calls,3,'three added models cost three draw calls');}finally{await g.done()}}
{const g=await bootGame({play:false,editRelease:withEdits({version:1,added:[],moved:{'timber-yard.pallet-2':{x:70,z:10,yaw:0}},removed:['timber-yard.pallet-1']})});
 try{g.pump(1);const s=g.scene();afterRemoved=count(s);
  const yard=s.getObjectByName('yard-timber-yard'),pallets=yard.children.find(m=>m.name==='props-prop.pallet');
  assert.equal(pallets.count,5,'one timber-yard pallet removed');
  const m=new THREE.Matrix4(),p=new THREE.Vector3();pallets.getMatrixAt(0,m);p.setFromMatrixPosition(m);assert(pallets.count===5);
  const xs=[];for(let i=0;i<pallets.count;i++){pallets.getMatrixAt(i,m);xs.push(Math.round(p.setFromMatrixPosition(m).x*10)/10)}
  assert(xs.includes(70),'and the second one moved to x 70');assert.equal(afterRemoved.calls,before.calls,'moving and removing named props adds no draw calls');}finally{await g.done()}}

console.log(`Scene overlay: grouping, turned colliders, rebuild (dispose + replace), applyToNamed and sceneKeys (${sceneKeys().length} named props) pinned; packaged game with a 3-model overlay: draw calls ${before.calls} -> ${after.calls} (+${after.calls-before.calls}), empty overlay adds none.`);
