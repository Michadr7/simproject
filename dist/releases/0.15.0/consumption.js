import * as THREE from './vendor/three.module.js';
import {createHeldItem,disposeHeldItem} from './item-models.js';

export function createConsumptionAnimation(arm,item){
 const prop=createHeldItem(item),originalRotation=arm.quaternion.clone(),originalScale=arm.scale.clone();
 // The character's arm pivot is at the shoulder; the hand is 0.56m down its local Y axis.
 prop.position.set(0,-.56,.015);arm.add(prop);
 const mouth=new THREE.Vector3(0,1.69,.24),reach=mouth.sub(arm.position);
 const target=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),reach.clone().normalize());
 const targetScale=originalScale.clone();targetScale.y*=reach.length()/.56;
 let elapsed=0,disposed=false;
 function dispose(){if(disposed)return;disposed=true;disposeHeldItem(prop);arm.quaternion.copy(originalRotation);arm.scale.copy(originalScale)}
 return {
  prop,
  update(dt){
   if(disposed)return true;
   elapsed=Math.min(1,elapsed+Math.max(0,Math.min(dt,.25)));
   const progress=Math.min(1,elapsed/.8),ease=progress*progress*(3-2*progress);
   arm.quaternion.copy(originalRotation).slerp(target,ease);arm.scale.copy(originalScale).lerp(targetScale,ease);
   // Small final tilt reads as a sip/bite, while the prop remains attached to the hand.
   prop.rotation.x=item.type==='drink'?-Math.max(0,(elapsed-.7)/.3)*.45:0;
   if(elapsed>=1){dispose();return true}return false;
  },
  dispose
 };
}
