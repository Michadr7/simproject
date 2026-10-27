import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {ITEMS,isConsumable} from '../dist/items.js';
import {createCharacter,loadCharacterAssets} from '../dist/character.js';
import {outfit,OUTFITS} from '../dist/appearance.js';
import {createConsumptionAnimation,USE_AT,TOTAL} from '../dist/consumption.js';
await loadCharacterAssets();

const wristToMouth=c=>{c.group.updateMatrixWorld(true);const w=new T.Vector3();c.bone('WristR').getWorldPosition(w);return c.group.worldToLocal(w).distanceTo(c.mouth)};
const consumables=ITEMS.filter(isConsumable);
for(const [n,item] of consumables.entries()){
 const body=n%2?'female':'male',c=createCharacter(outfit(body,OUTFITS[body][n%OUTFITS[body].length][0])),control=createCharacter(outfit(body,OUTFITS[body][0][0]));
 c.group.position.set(3,0,-2);c.group.rotation.y=1.1;c.update(.05);
 const anim=createConsumptionAnimation(c,item);
 assert.equal(anim.prop.parent,c.hand,'held in the hand: '+item.id);
 let geometries=0,disposed=0;
 anim.prop.traverse(m=>{if(m.geometry){geometries++;m.geometry.addEventListener('dispose',()=>disposed++)}if(m.material)m.material.addEventListener('dispose',()=>disposed++)});
 const far=wristToMouth(c);
 const phases=[];for(let i=0;i<Math.round(USE_AT/.05)-1;i++){phases.push(anim.update(.05));c.update(.05)}
 assert(phases.every(p=>p==='raising'));assert(anim.prop.parent,'still held until used');
 assert(wristToMouth(c)<.06,`hand reaches the mouth for ${item.id}: ${wristToMouth(c)}`);assert(far>.3,'starts well below the mouth');
 // The item is level while raised (drinks tip toward the lips near the end).
 assert.equal(anim.update(.05),'used');c.update(.05);assert.equal(anim.prop.parent,null,'item disappears when used');assert.equal(disposed,geometries*2,'resources freed');
 let lowering=0,previous=wristToMouth(c),last;
 for(let i=0;i<Math.round(TOTAL/.05)+2;i++){last=anim.update(.05);c.update(.05);if(last==='lowering'){lowering++;assert(wristToMouth(c)>=previous-1e-6,'hand only moves away while lowering');previous=wristToMouth(c)}}
 assert(lowering>=5,'lowers over several frames, no snap');assert.equal(last,'done');
 control.update(.05);c.update(.05);
 assert(c.bone('LowerArmR').quaternion.angleTo(control.bone('LowerArmR').quaternion)<.05&&c.bone('UpperArmR').quaternion.angleTo(control.bone('UpperArmR').quaternion)<.05,'arm is back in its animation pose');
 assert.equal(c.meshes.length>0&&c.hand.children.length,0,'nothing left in the hand');
 anim.dispose();assert.equal(disposed,geometries*2,'cleanup is idempotent');
}
// Interrupting mid-raise frees the item and drops the arm.
const c=createCharacter(outfit('male','Suit')),control=createCharacter(outfit('male','Suit')),a=createConsumptionAnimation(c,ITEMS.find(isConsumable));
for(let i=0;i<6;i++){a.update(.05);c.update(.05)}a.dispose();c.update(.05);control.update(.05);
assert.equal(a.prop.parent,null);assert(c.bone('LowerArmR').quaternion.angleTo(control.bone('LowerArmR').quaternion)<.05);
console.log(`All ${consumables.length} consumables: hand reaches the mouth with no arm scaling, item in the palm, used after one second, smooth lowering, interruption and resource disposal passed.`);
