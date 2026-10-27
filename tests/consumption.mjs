import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {ITEMS} from '../dist/items.js';
import {createConsumptionAnimation} from '../dist/consumption.js';
for(const item of ITEMS.filter(i=>i.type!=='equipment')){
 const player=new THREE.Group(),arm=new THREE.Group();arm.position.set(.29,1.4,0);player.add(arm);
 const original=arm.quaternion.clone(),scale=arm.scale.clone();
 const anim=createConsumptionAnimation(arm,item);assert.equal(anim.prop.parent,arm);
 const initial=anim.prop.getWorldPosition(new THREE.Vector3()),mouth=new THREE.Vector3(0,1.69,.24);
 assert(initial.distanceTo(mouth)>.6);
 let geometries=0,materials=0,disposedGeometries=0,disposedMaterials=0;
 anim.prop.traverse(m=>{if(m.geometry){geometries++;m.geometry.addEventListener('dispose',()=>disposedGeometries++)}if(m.material){materials++;m.material.addEventListener('dispose',()=>disposedMaterials++)}});
 for(let i=0;i<4;i++)assert.equal(anim.update(.2),false);
 assert(anim.prop.getWorldPosition(new THREE.Vector3()).distanceTo(mouth)<.04,'hand reaches mouth: '+item.id);
 assert.equal(anim.update(.2),true);assert.equal(anim.prop.parent,null);
 assert(arm.quaternion.equals(original));assert(arm.scale.equals(scale));assert.equal(disposedGeometries,geometries);assert.equal(disposedMaterials,materials);
 anim.dispose();assert.equal(disposedGeometries,geometries,'cleanup is idempotent');
}
console.log('All 15 consumable models: hand attachment, mouth reach, one-second timing, pose restoration and resource disposal passed.');
