import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {ITEMS} from '../dist/items.js';
import {createCharacter} from '../dist/character.js';
import {createConsumptionAnimation,MOUTH,USE_AT,TOTAL} from '../dist/consumption.js';

const one=new THREE.Vector3(1,1,1);
const scalesUnchanged=root=>{let ok=true;root.traverse(o=>{if(o.name.startsWith('upperArm')||o.name.startsWith('forearm'))ok&&=o.scale.equals(one)});return ok};
for(const item of ITEMS.filter(i=>i.type!=='equipment')){
 const character=createCharacter({}),body=character.group,upperArm=character.arms[1],forearm=character.forearms[1];
 assert.equal(upperArm.userData.forearm,forearm);assert.equal(forearm.parent,upperArm,'forearm hangs from the elbow');
 body.position.set(3,0,-2);body.rotation.y=1.1;body.updateMatrixWorld(true);
 const anim=createConsumptionAnimation(upperArm,item);assert.equal(anim.prop.parent,forearm,'held in the forearm hand');
 const mouth=body.localToWorld(new THREE.Vector3(MOUTH.x,MOUTH.y,MOUTH.z));
 const propAt=()=>{body.updateMatrixWorld(true);return anim.prop.getWorldPosition(new THREE.Vector3())};
 assert(propAt().distanceTo(mouth)>.5,'starts at the side');
 let geometries=0,disposed=0;
 anim.prop.traverse(m=>{if(m.geometry){geometries++;m.geometry.addEventListener('dispose',()=>disposed++)}if(m.material)m.material.addEventListener('dispose',()=>disposed++)});
 const phases=[];let maxSquash=0;
 for(let i=0;i<Math.round(USE_AT/.05)-1;i++){phases.push(anim.update(.05));assert(scalesUnchanged(body),'arm never scales');
  // Upper arm and forearm stay rigid: the hand stays a fixed distance from the elbow.
  const elbow=forearm.getWorldPosition(new THREE.Vector3()),shoulder=upperArm.getWorldPosition(new THREE.Vector3());maxSquash=Math.max(maxSquash,Math.abs(elbow.distanceTo(shoulder)-.25))}
 assert(maxSquash<1e-6);
 // Just before use the item is at the lips and the elbow is clearly bent.
 assert(propAt().distanceTo(mouth)<.04,'reaches the mouth: '+item.id+' '+propAt().distanceTo(mouth));
 assert(forearm.quaternion.angleTo(new THREE.Quaternion())>.8,'elbow bends');
 assert(phases.every(p=>p==='raising'));assert(anim.prop.parent,'still held until used');
 assert.equal(anim.update(.05),'used');assert.equal(anim.prop.parent,null,'item disappears when used');assert.equal(disposed,geometries*2,'resources freed');
 const raised=upperArm.quaternion.clone();assert.equal(anim.update(.1),'lowering');
 assert(upperArm.quaternion.angleTo(raised)>.01&&upperArm.quaternion.angleTo(new THREE.Quaternion())>.05,'lowers gradually, no snap');
 let last;for(let i=0;i<Math.round(TOTAL/.05)+2;i++)last=anim.update(.05);
 assert.equal(last,'done');assert(upperArm.quaternion.angleTo(new THREE.Quaternion())<1e-6&&forearm.quaternion.angleTo(new THREE.Quaternion())<1e-6,'back to rest');
 anim.dispose();assert.equal(disposed,geometries*2,'cleanup is idempotent');
}
// Interrupting mid-raise frees the item and returns the arm to rest.
const c=createCharacter({}),a=createConsumptionAnimation(c.arms[1],ITEMS[0]);a.update(.4);a.dispose();
assert.equal(a.prop.parent,null);assert(c.arms[1].quaternion.angleTo(new THREE.Quaternion())<1e-6);
console.log('All 15 consumable models: elbow-jointed reach to the mouth with no arm scaling, one-second use, smooth lowering, interruption and resource disposal passed.');
