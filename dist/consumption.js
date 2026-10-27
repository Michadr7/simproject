import * as THREE from './vendor/three.module.js';
import {createHeldItem,disposeHeldItem} from './item-models.js';
import {ELBOW,HAND} from './character.js';

// Timeline (seconds): raise to the mouth, sip/bite, item is used at USE_AT,
// then the empty hand lowers back to rest. Nothing is ever scaled.
export const RAISE=.8,USE_AT=1,LOWER=.45,TOTAL=USE_AT+LOWER;
// Where the held item ends up, in the character's local space (just in front of the lips).
export const MOUTH=Object.freeze({x:0,y:1.67,z:.29});

const DOWN=new THREE.Vector3(0,-1,0),EPS=1e-6;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};

// Analytic two-bone IK in the upperArm's parent space. The elbow bends toward a
// pole that points down and away from the body, like a natural hand-to-mouth reach.
export function solveArm(shoulder,target,upper=ELBOW,lower=HAND){
 const toTarget=new THREE.Vector3().subVectors(target,shoulder);
 const distance=THREE.MathUtils.clamp(toTarget.length(),Math.abs(upper-lower)+1e-4,upper+lower-1e-4);
 const dir=toTarget.normalize();
 const pole=new THREE.Vector3((Math.sign(shoulder.x)||1)*.45,-1,.05);
 pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
 const cos=THREE.MathUtils.clamp((upper*upper+distance*distance-lower*lower)/(2*upper*distance),-1,1);
 const angle=Math.acos(cos);
 const elbow=shoulder.clone().add(dir.clone().multiplyScalar(Math.cos(angle)*upper)).add(pole.multiplyScalar(Math.sin(angle)*upper));
 const shoulderRotation=new THREE.Quaternion().setFromUnitVectors(DOWN,elbow.clone().sub(shoulder).normalize());
 const hand=shoulder.clone().add(dir.multiplyScalar(distance));
 const forearmDir=hand.sub(elbow).applyQuaternion(shoulderRotation.clone().invert()).normalize();
 const elbowRotation=new THREE.Quaternion().setFromUnitVectors(DOWN,forearmDir);
 return {shoulderRotation,elbowRotation};
}

// upperArm must be a character arm with userData.forearm (see character.js).
// update(dt) returns 'raising' until the item is used, 'used' exactly once at USE_AT
// (apply stats then), 'lowering' while the hand returns, and 'done' at the end.
export function createConsumptionAnimation(upperArm,item){
 const forearm=upperArm.userData.forearm;
 if(!forearm)throw new Error('Consumption needs an arm with a forearm joint.');
 const prop=createHeldItem(item);prop.position.set(0,-HAND,.03);forearm.add(prop);
 const startShoulder=upperArm.quaternion.clone(),startElbow=forearm.quaternion.clone();
 const restShoulder=new THREE.Quaternion(),restElbow=new THREE.Quaternion();
 const pose=solveArm(upperArm.position.clone(),new THREE.Vector3(MOUTH.x,MOUTH.y,MOUTH.z));
 const handRotation=new THREE.Quaternion(),tilt=new THREE.Quaternion(),xAxis=new THREE.Vector3(1,0,0);
 let elapsed=0,used=false,finished=false,propRemoved=false,lowerShoulder=null,lowerElbow=null;
 function removeProp(){if(propRemoved)return;propRemoved=true;disposeHeldItem(prop)}
 function keepPropUpright(sip){
  // Counter-rotate so the item stays upright relative to the body, then tip it toward the lips.
  handRotation.copy(upperArm.quaternion).multiply(forearm.quaternion).invert();
  prop.quaternion.copy(handRotation).multiply(tilt.setFromAxisAngle(xAxis,sip));
 }
 function update(dt){
  if(finished)return 'done';
  elapsed=Math.min(TOTAL,elapsed+Math.max(0,Math.min(dt,.25)));
  if(elapsed<USE_AT-EPS){
   const t=smooth(elapsed/RAISE);
   upperArm.quaternion.slerpQuaternions(startShoulder,pose.shoulderRotation,t);
   forearm.quaternion.slerpQuaternions(startElbow,pose.elbowRotation,t);
   const sipT=smooth((elapsed-RAISE*.85)/(USE_AT-RAISE*.85));
   keepPropUpright(item.type==='drink'?sipT*.7:Math.sin(sipT*Math.PI)*.12);
   return 'raising';
  }
  if(!used){
   used=true;removeProp();
   lowerShoulder=upperArm.quaternion.clone();lowerElbow=forearm.quaternion.clone();
   return 'used';
  }
  const t=smooth((elapsed-USE_AT)/LOWER);
  upperArm.quaternion.slerpQuaternions(lowerShoulder,restShoulder,t);
  forearm.quaternion.slerpQuaternions(lowerElbow,restElbow,t);
  if(elapsed>=TOTAL-EPS){finished=true;upperArm.quaternion.copy(restShoulder);forearm.quaternion.copy(restElbow);return 'done'}
  return 'lowering';
 }
 // Interrupted (scene change, reload): remove the item and return the arm to rest immediately.
 function dispose(){removeProp();if(!finished){finished=true;upperArm.quaternion.copy(restShoulder);forearm.quaternion.copy(restElbow)}}
 return {prop,update,dispose,get used(){return used},get finished(){return finished}};
}
