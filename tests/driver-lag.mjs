// DR1: the seated driver must not slide against the cab. Over a scripted S-turn at 25 m/s at 30, 60 and 144 Hz fixed steps, the head stays within 1 cm of its resting place against the seat anchor in the vehicle's own space (before DR1 the body only turned, the cab also pitched and rolled: up to 3.8 cm), the hips follow the anchor, and the hands stay within a stated tolerance of the wheel's grip points.
// The frame order mirrors game.js frame(): driving.step, driving.update, the cab pose (hands), avatar.update, then the placement (driving.seatPose, as syncPlayerMesh does), then the matrices as a render would leave them.
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createDriving} from '../dist/driving.js';
import {SURFACE} from '../dist/terrain.js';
import {createCharacter,loadCharacterAssets} from '../dist/character.js';
import {OUTFITS,outfit} from '../dist/appearance.js';
await loadCharacterAssets();
const HEAD_TOL=.01,HAND_TOL=.15,FORK_HIPS=.95,V0=25; // metres: the head 1 cm; the hands 15 cm (at full lock the fist slides about 12 cm round the rim: the reach of a 1.95 m driver's arms, same before and after DR1)
function drive(hz,{tilt=true}={}){
 const scene=new THREE.Scene(),d=createDriving({scene,surface:()=>SURFACE.STREET,footing:()=>0,baseBlocked:()=>false,saved:[]}),f=d.byId.get('eastbank-shortbed');
 const avatar=createCharacter(outfit('male',OUTFITS.male[0][0])),player=avatar.group;scene.add(player);player.rotation.order='YXZ';
 f.state={...f.state,x:-240,z:-40,yaw:Math.PI/2,speed:0,steer:0};f.pitch=f.roll=0;scene.updateMatrixWorld(true);
 assert(d.enter(f.spec.id,'driver'));
 const mesh=f.mesh,ud=mesh.userData,sw=ud.steeringWheel,g=ud.grip,a=ud.seats.driver,cabHand=new THREE.Vector3(),cabRim=new THREE.Vector3(),cabZ=new THREE.Vector3(0,0,1);
 const bones={head:avatar.bone('Head'),hips:avatar.bone('Hips')||avatar.bone('Body'),R:avatar.bone('WristR'),L:avatar.bone('WristL')};
 const pose=dt=>{ // game.js updateCabPose, then avatar.update, then syncPlayerMesh
  const s=d.seatedAt();avatar.setSeated(!!s);
  for(const [side,k] of [['R',-1],['L',1]]){cabRim.set(Math.sin(k*g.angle)*g.radius,Math.cos(k*g.angle)*g.radius,0).applyAxisAngle(cabZ,sw.rotation.z);avatar.reach(side,cabHand.set(sw.position.x+cabRim.x-a[0],sw.position.y+cabRim.y-(a[1]-FORK_HIPS),sw.position.z-g.back-(a[2]+g.hips)),1);avatar.setHandCurl(side,.8)}
  avatar.setLean(g.lean);avatar.update(dt);
  const p=d.seatPose(FORK_HIPS);player.rotation.set(tilt?p.rx:0,p.ry,tilt?p.rz:0);player.position.set(p.x,p.y,p.z);
  scene.updateMatrixWorld(true);
 };
 const local=(p,inv)=>p.clone().applyMatrix4(inv),world=b=>b.getWorldPosition(new THREE.Vector3());
 const sample=()=>{const inv=mesh.matrixWorld.clone().invert(),s=d.seatedAt(),seat=local(new THREE.Vector3(s.x,s.y,s.z),inv);
  const target=k=>local(sw.localToWorld(new THREE.Vector3(Math.sin(k*g.angle)*g.radius,Math.cos(k*g.angle)*g.radius,-g.back)),inv);
  return {head:local(world(bones.head),inv).sub(seat),hips:local(world(bones.hips),inv).sub(seat),R:local(world(bones.R),inv).sub(target(-1)),L:local(world(bones.L),inv).sub(target(1))}};
 for(let i=0;i<20;i++){d.update(1/60);pose(1/60)}
 const base=sample(),dt=1/hz,keys=t=>t<1?[1,0]:t<2.2?[1,1]:t<4.6?[1,-1]:t<5.8?[1,1]:[1,0],max={head:0,hips:0,R:0,L:0},tilts=[];
 f.state={...f.state,speed:V0};
 for(let i=0,n=Math.round(7*hz);i<n;i++){const [throttle,steer]=keys(i*dt);f.state={...f.state,speed:V0};d.step(dt,{throttle,steer,brake:false},[]);d.update(dt);pose(dt);const s=sample();for(const k of Object.keys(max))max[k]=Math.max(max[k],s[k].distanceTo(base[k]));tilts.push(Math.max(Math.abs(f.pitch),Math.abs(f.roll)))}
 return {max,tilt:Math.max(...tilts),speed:f.state.speed};
}
for(const hz of [30,60,144]){
 const r=drive(hz);if(process.env.DRV)console.log(hz,'Hz max offsets (cm): head',(r.max.head*100).toFixed(2),'hips',(r.max.hips*100).toFixed(2),'R',(r.max.R*100).toFixed(1),'L',(r.max.L*100).toFixed(1),'tilt deg',(r.tilt*57.3).toFixed(1));
 assert(r.tilt>.03,`${hz} Hz: the S-turn really tilts the cab (${(r.tilt*57.3).toFixed(1)} degrees)`);
 assert(r.max.head<HEAD_TOL,`${hz} Hz: the head stays within 1 cm of the seat anchor in the cab's space (${(r.max.head*100).toFixed(2)} cm)`);
 assert(r.max.hips<HEAD_TOL,`${hz} Hz: the hips stay on the anchor (${(r.max.hips*100).toFixed(2)} cm)`);
 for(const h of ['R','L'])assert(r.max[h]<HAND_TOL,`${hz} Hz: the ${h} hand stays within ${HAND_TOL*100} cm of its wheel grip (${(r.max[h]*100).toFixed(1)} cm)`);
}
{const old=drive(60,{tilt:false});assert(old.max.head>.02,`control: a body that only turns (the old behaviour) slides ${(old.max.head*100).toFixed(1)} cm against the cab, so this test would have caught the lag`)}
console.log('Driver lag: the seated driver tilts with the cab: head and hips within 1 cm of the seat anchor and the hands within 15 cm of the wheel grips over an S-turn at 25 m/s at 30, 60 and 144 Hz; the old turn-only body drifts more than 2 cm.');
