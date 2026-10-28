import * as T from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {normalizeAppearance} from './appearance.js';

// Skeletal characters from the Quaternius Ultimate Modular Men/Women packs (CC0), converted by
// scripts/build-characters.mjs. Each body type is one skeleton plus swappable head/top/legs/shoe parts.
// The pack is authored in centimetres (about 187 high); this brings it to roughly 1.95 m.
export const MODEL_SCALE=.0104;
const PART_NAMES={head:'Head',top:'Body',legs:'Legs',feet:'Feet'};
// Speeds (units/s) at which the pack's Walk and Run clips play at normal rate.
const WALK_SPEED=1.5,RUN_SPEED=4.4;

let assets=null,loading=null;
export const characterAssetsReady=()=>!!assets;
function extract(gltf){
 const meshes=[];gltf.scene.traverse(o=>{if(o.isSkinnedMesh)meshes.push(o)});
 if(!meshes.length)throw new Error('Character file has no skinned meshes');
 const skeleton=meshes[0].skeleton,container=gltf.scene.getObjectByName('character')||gltf.scene;
 const topOf=node=>{while(node.parent&&node.parent!==container)node=node.parent;return node};
 const rigRoot=topOf(skeleton.bones[0]),parts=new Map(),clips=new Map(gltf.animations.map(c=>[c.name,c]));
 for(const mesh of meshes){
  const key=topOf(mesh).name;if(!parts.has(key))parts.set(key,[]);
  parts.get(key).push({geometry:mesh.geometry,material:mesh.material,bindMatrix:mesh.bindMatrix});
 }
 return {rigRoot,bones:skeleton.bones,boneInverses:skeleton.boneInverses,parts,clips};
}
// Decodes the embedded models once. Until this resolves, createCharacter returns a simple stand-in.
export function loadCharacterAssets(){
 if(assets)return Promise.resolve(assets);
 loading??=(async()=>{
  const loader=new GLTFLoader(),result={};
  for(const kind of ['male','female']){
   const {default:data}=await import(`./character-${kind}.js`);
   const binary=Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer;
   result[kind]=extract(await loader.parseAsync(binary,''));
  }
  return assets=result;
 })();
 return loading;
}

const Y=new T.Vector3(0,1,0),X=new T.Vector3(1,0,0);
const v1=new T.Vector3(),v2=new T.Vector3(),vS=new T.Vector3(),vE=new T.Vector3(),vW=new T.Vector3(),vG=new T.Vector3(),vDir=new T.Vector3(),vPole=new T.Vector3(),vE2=new T.Vector3();
const qa=new T.Quaternion(),qb=new T.Quaternion(),qc=new T.Quaternion(),qGroup=new T.Quaternion();

// Rotates a bone in world space by `delta`, blending from its current local rotation by `weight`.
// The animated rotation is remembered in `memo` so it can be put back before the next frame: the mixer
// skips bones whose animated value has not changed, which would otherwise leave them stuck in the IK pose.
function turnBone(bone,delta,weight,memo){
 if(!memo.has(bone))memo.set(bone,bone.quaternion.clone());
 bone.getWorldQuaternion(qb).premultiply(delta);
 bone.parent.getWorldQuaternion(qc).invert().multiply(qb);
 bone.quaternion.slerp(qc,weight);bone.updateMatrixWorld(true);
}

function createFallback(appearance){
 const group=new T.Group(),skin=new T.MeshStandardMaterial({color:appearance.skin,roughness:.9}),cloth=new T.MeshStandardMaterial({color:'#66869b',roughness:.9});
 const body=new T.Mesh(new T.CapsuleGeometry(.3,1.1,4,8),cloth),head=new T.Mesh(new T.SphereGeometry(.2,12,8),skin);
 body.position.y=.9;head.position.y=1.7;body.castShadow=head.castShadow=true;group.add(body,head);
 const hand=new T.Group();hand.position.set(-.35,.9,.1);group.add(hand);
 const noop=()=>{};
 return {group,hand,mouth:new T.Vector3(0,1.6,.2),fallback:true,apply:noop,update:noop,setMotion:noop,setSeated:noop,reach:noop,clearReach:noop,setHeldTilt:noop,alignHeld:noop,setTwoHanded:noop,setLean:noop,
  hold(object){hand.add(object)},release(){for(const child of [...hand.children])hand.remove(child)},bone:()=>null,get motion(){return 'Idle'}};
}

export function createCharacter(input){
 let appearance=normalizeAppearance(input);
 if(!assets)return createFallback(appearance);
 const group=new T.Group(),kinds={};let seated=false,motion='Idle',speedNow=0;
 const reaches={R:{target:new T.Vector3(),weight:0},L:{target:new T.Vector3(),weight:0}};
 let held=null,tilt=0,rig=null;const memo=new Map();
 // Held-item orientation override (a carry pose), a second hand on the handle, and a forward/back lean of the spine.
 let alignDir=null,alignAmount=0,twoHandWeight=0,leanAngle=0;const twoHandL={target:new T.Vector3(),weight:0},wantAlign=new T.Quaternion();

 // ── Rig and parts ─────────────────────────────────────────────────────────
 function build(){
  memo.clear();
  if(kinds.model){group.remove(kinds.model);kinds.mixer.stopAllAction()}
  const set=assets[appearance.body],model=new T.Group();model.scale.setScalar(MODEL_SCALE);group.add(model);
  const root=set.rigRoot.clone(true),byName=new Map();root.traverse(o=>byName.set(o.name,o));
  const bones=set.bones.map(b=>byName.get(b.name));
  const skeleton=new T.Skeleton(bones,set.boneInverses);
  model.add(root);
  Object.assign(kinds,{model,set,byName,skeleton,root,meshes:[],mixer:new T.AnimationMixer(model),actions:{}});
  for(const [name,clip] of set.clips){const action=kinds.mixer.clipAction(clip);action.time=Math.random()*clip.duration;kinds.actions[name]=action}
  // Legs: the pack animates two foot control bones; the legs are solved to reach them (see solveLeg). Measure, in the
  // bind pose, where each lower leg ends relative to its foot bone.
  group.updateMatrixWorld(true);
  const bindEnd={};for(const side of ['R','L']){const lower=byName.get('LowerLeg'+side),foot=byName.get('Foot'+side);if(lower&&foot){foot.getWorldPosition(v1);bindEnd[side]=lower.worldToLocal(v1.clone())}}
  kinds.current=null;motion='';play('Idle_Neutral',1);
  kinds.mixer.update(0); // show the idle pose at once instead of the T-pose until the first update
  const side=name=>({upper:byName.get('UpperArm'+name),lower:byName.get('LowerArm'+name),wrist:byName.get('Wrist'+name)});
  rig={R:side('R'),L:side('L'),legs:{R:[byName.get('UpperLegR'),byName.get('LowerLegR')],L:[byName.get('UpperLegL'),byName.get('LowerLegL')]},foot:{R:byName.get('FootR'),L:byName.get('FootL')},bindEnd,head:byName.get('Head'),headEnd:byName.get('Head_end')};
  // Which way is "outwards" for each arm (the pole direction of the elbow), measured from the rest pose.
  group.updateMatrixWorld(true);
  for(const s of ['R','L']){rig[s].upper.getWorldPosition(v1);group.worldToLocal(v1);rig[s].out=Math.sign(v1.x)||1}
  // A socket at the wrist whose unit is one metre (the rig root carries its own scale). Held items are
  // placed and oriented from the actual forearm line each frame, because the wrist bone itself twists with the animation.
  const wrist=rig.R.wrist;wrist.getWorldScale(v2);
  const hand=new T.Group();hand.name='hand-socket';hand.scale.setScalar(1/v2.x);
  wrist.add(hand);api.hand=hand;if(held)hand.add(held.object);
  // The female rig has no Head_end marker, so fall back to a typical head height above the Head bone.
  rig.head.getWorldPosition(vS);if(rig.headEnd)rig.headEnd.getWorldPosition(vE);else vE.copy(vS).addScaledVector(Y,.22);
  // Where the hand goes to eat or drink: just in front of the mouth, in the character's own space.
  api.mouth.copy(vS.lerp(vE,.3));group.worldToLocal(api.mouth);api.mouth.z+=.16;api.mouth.y-=.05;
  applyParts();
 }
 function applyParts(){
  for(const mesh of kinds.meshes){mesh.removeFromParent();for(const m of [].concat(mesh.material))if(m.userData.cloned)m.dispose()}
  kinds.meshes=[];
  for(const key of Object.keys(PART_NAMES)){
   const records=kinds.set.parts.get(`${appearance[key]}__${PART_NAMES[key]}`);
   if(!records)continue;
   for(const record of records){
    const own=[].concat(record.material).map(material=>{
     const role=material.userData?.role;if(!role)return material;
     const copy=material.clone();copy.userData={...material.userData,cloned:true};
     copy.color.set(appearance[role]);if(/^eyebrows/i.test(material.name))copy.color.multiplyScalar(.7);return copy;
    });
    const mesh=new T.SkinnedMesh(record.geometry,own.length===1?own[0]:own);
    mesh.bind(kinds.skeleton,record.bindMatrix);mesh.castShadow=true;mesh.frustumCulled=false;mesh.name=`${appearance[key]}__${PART_NAMES[key]}`;
    kinds.model.add(mesh);kinds.meshes.push(mesh);
   }
  }
 }

 // ── Motion ────────────────────────────────────────────────────────────────
 function play(name,timeScale){
  const next=kinds.actions[name];if(!next)return;
  if(kinds.current!==next){
   next.reset().setEffectiveWeight(1).setEffectiveTimeScale(timeScale).play();
   if(kinds.current)kinds.current.crossFadeTo(next,.2,false);
   kinds.current=next;motion=name;
  }else next.setEffectiveTimeScale(timeScale);
 }
 // speed in world units per second; 0 stands still.
 function setMotion(speed){
  speedNow=speed;
  if(speed<.15)play('Idle_Neutral',1);
  else if(speed<2.4)play('Walk',T.MathUtils.clamp(speed/WALK_SPEED,.6,1.7));
  else play('Run',T.MathUtils.clamp(speed/RUN_SPEED,.7,2.2));
 }

 // ── Arm reach (two-bone IK in world space) and seated pose ────────────────────
 function solveArm(side,state=reaches[side]){
  const arm=rig[side];if(state.weight<.001)return;
  arm.upper.getWorldPosition(vS);arm.lower.getWorldPosition(vE);arm.wrist.getWorldPosition(vW);
  vG.copy(state.target);group.localToWorld(vG);
  const l1=vS.distanceTo(vE),l2=vE.distanceTo(vW),d=T.MathUtils.clamp(vS.distanceTo(vG),Math.abs(l1-l2)+1e-4,l1+l2-1e-4);
  vDir.subVectors(vG,vS).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  group.getWorldQuaternion(qGroup);
  vPole.set(arm.out*.55,-1,-.25).applyQuaternion(qGroup);vPole.addScaledVector(vDir,-vPole.dot(vDir)).normalize();
  vE2.copy(vS).addScaledVector(vDir,along).addScaledVector(vPole,height);
  turnBone(arm.upper,qa.setFromUnitVectors(v1.subVectors(vE,vS).normalize(),v2.subVectors(vE2,vS).normalize()).clone(),state.weight,memo);
  arm.lower.getWorldPosition(vE);arm.wrist.getWorldPosition(vW);
  vG.copy(vS).addScaledVector(vDir,d);
  turnBone(arm.lower,qa.setFromUnitVectors(v1.subVectors(vW,vE).normalize(),v2.subVectors(vG,vE).normalize()).clone(),state.weight,memo);
 }
// Two-bone leg solve toward the animated foot control bone, knees forward. Replaces the pack's baked leg rotations,
 // which swing a thigh out sideways in parts of the Run cycle.
 function solveLeg(side){
  const [upper,lower]=rig.legs[side],foot=rig.foot[side],endLocal=rig.bindEnd[side];if(!upper||!lower||!foot||!endLocal)return;
  upper.getWorldPosition(vS);lower.getWorldPosition(vE);vW.copy(endLocal);lower.localToWorld(vW);foot.getWorldPosition(vG);
  const l1=vS.distanceTo(vE),l2=vE.distanceTo(vW),d=T.MathUtils.clamp(vS.distanceTo(vG),Math.abs(l1-l2)+1e-4,l1+l2-1e-4);
  vDir.subVectors(vG,vS).normalize();
  const along=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  group.getWorldQuaternion(qGroup);vPole.set(0,-.15,1).applyQuaternion(qGroup);vPole.addScaledVector(vDir,-vPole.dot(vDir)).normalize();
  vE2.copy(vS).addScaledVector(vDir,along).addScaledVector(vPole,height);
  turnBone(upper,qa.setFromUnitVectors(v1.subVectors(vE,vS).normalize(),v2.subVectors(vE2,vS).normalize()).clone(),1,memo);
  lower.getWorldPosition(vE);vW.copy(endLocal);lower.localToWorld(vW);vG.copy(vS).addScaledVector(vDir,d);
  turnBone(lower,qa.setFromUnitVectors(v1.subVectors(vW,vE).normalize(),v2.subVectors(vG,vE).normalize()).clone(),1,memo);
 }
 // Arms swing opposite the forward foot. The Walk clip leaves the hands bent in front of the hips, so characters with
 // swingArms set (pedestrians) swing hanging arms instead.
 function applyArmSwing(){
  rig.foot.R.getWorldPosition(v1);group.worldToLocal(v1);const zR=v1.z;rig.foot.L.getWorldPosition(v1);group.worldToLocal(v1);const zL=v1.z;
  const lead=T.MathUtils.clamp((zL-zR)/.35,-1,1),amount=motion==='Run'?.8:.45; // lead > 0: left foot ahead, so the right arm swings forward
  group.getWorldQuaternion(qGroup);
  for(const side of ['R','L']){
   if(reaches[side].weight>.001||(side==='R'&&held))continue;
   const arm=rig[side],phi=(side==='R'?lead:-lead)*amount;
   arm.upper.getWorldPosition(vS);arm.lower.getWorldPosition(vE);
   vDir.set(arm.out*.1,-Math.cos(phi),Math.sin(phi)).normalize().applyQuaternion(qGroup);
   turnBone(arm.upper,qa.setFromUnitVectors(v1.subVectors(vE,vS).normalize(),vDir).clone(),1,memo);
   arm.lower.getWorldPosition(vE);arm.wrist.getWorldPosition(vW);
   const bend=.15+.35*Math.max(0,phi);
   vDir.set(arm.out*.05,-Math.cos(phi+bend),Math.sin(phi+bend)).normalize().applyQuaternion(qGroup);
   turnBone(arm.lower,qa.setFromUnitVectors(v1.subVectors(vW,vE).normalize(),vDir).clone(),1,memo);
  }
 }
 // Lean the spine about the character's side-to-side axis (positive = forward), spread over three bones.
 function applyLean(){
  group.getWorldQuaternion(qGroup);v1.copy(X).applyQuaternion(qGroup);
  for(const [name,share] of [['Abdomen',.3],['Torso',.4],['Chest',.3]]){const bone=kinds.byName.get(name);if(bone)turnBone(bone,new T.Quaternion().setFromAxisAngle(v1,leanAngle*share),1,memo)}
 }
 // The left hand takes hold of the tool's handle, a little way along from the right.
 function gripWithLeft(){
  held.object.updateMatrixWorld(true);v1.set(0,held.axis==='y'?1:0,held.axis==='y'?0:1).applyQuaternion(held.object.getWorldQuaternion(qb));
  rig.R.wrist.getWorldPosition(vW);rig.L.upper.getWorldPosition(vS);
  // Grip the handle at the point nearest the left shoulder (between 10 and 50 cm along from the right hand), so it is within reach.
  const along=T.MathUtils.clamp(v2.subVectors(vS,vW).dot(v1),.1,.5);
  twoHandL.target.copy(vW).addScaledVector(v1,along);group.worldToLocal(twoHandL.target);
  twoHandL.weight=twoHandWeight;solveArm('L',twoHandL);
 }
 function applySeated(){
  group.getWorldQuaternion(qGroup);
  v1.copy(X).applyQuaternion(qGroup);
  for(const [upper,lower] of [rig.legs.R,rig.legs.L]){
   turnBone(upper,new T.Quaternion().setFromAxisAngle(v1,-Math.PI/2),1,memo);
   turnBone(lower,new T.Quaternion().setFromAxisAngle(v1,Math.PI/2),1,memo);
  }
 }
 function update(dt){
  for(const [bone,q] of memo)bone.quaternion.copy(q);
  memo.clear();
  kinds.mixer.update(dt);
  alignAmount+=((alignDir?1:0)-alignAmount)*Math.min(1,dt*10);
  const reaching=reaches.R.weight>.001||reaches.L.weight>.001,striding=!seated&&(motion==='Walk'||motion==='Run'),leaning=Math.abs(leanAngle)>.001;
  if(!reaching&&!seated&&!held&&!striding&&!leaning)return;
  group.updateMatrixWorld(true);
  if(seated)applySeated();else if(striding){solveLeg('R');solveLeg('L');if(api.swingArms)applyArmSwing()}
  if(leaning)applyLean();
  solveArm('R');if(twoHandWeight<.001)solveArm('L');
  if(held)placeHeld();
  if(held&&twoHandWeight>.001)gripWithLeft();
 }
 // Puts the held item in the palm: upright items stay level, tools follow the forearm.
 const basis=new T.Matrix4(),vX=new T.Vector3(),vY=new T.Vector3(),vZ=new T.Vector3(),want=new T.Quaternion();
 function basisFor(direction,out){
  vX.copy(X).applyQuaternion(qGroup);vX.addScaledVector(direction,-vX.dot(direction)).normalize();
  if(held.axis==='z'){vZ.copy(direction);vY.crossVectors(vZ,vX)}else{vY.copy(direction);vZ.crossVectors(vX,vY)}
  basis.makeBasis(vX,vY,vZ);return out.setFromRotationMatrix(basis);
 }
 function placeHeld(){
  const arm=rig.R;arm.lower.getWorldPosition(vE);arm.wrist.getWorldPosition(vW);
  vDir.subVectors(vW,vE).normalize();group.getWorldQuaternion(qGroup);
  if(held.upright)want.copy(qGroup).multiply(qc.setFromAxisAngle(X,-tilt));
  else{
   // Item x runs across the character, the chosen long axis runs along the forearm (or along alignDir for a carry pose).
   basisFor(vDir,want);
   if(alignAmount>.001&&alignDir){v2.copy(alignDir).applyQuaternion(qGroup).normalize();basisFor(v2,wantAlign);want.slerp(wantAlign,alignAmount)}
  }
  api.hand.updateMatrixWorld(true);api.hand.getWorldQuaternion(qb);
  held.object.quaternion.copy(qb).invert().multiply(want);
  vS.copy(vW).addScaledVector(vDir,.045);held.object.position.copy(api.hand.worldToLocal(vS));
 }

 
 const api={
  group,hand:null,mouth:new T.Vector3(),fallback:false,swingArms:false,
  get appearance(){return appearance},get motion(){return motion},get seated(){return seated},get speed(){return speedNow},
  get meshes(){return kinds.meshes},get mixer(){return kinds.mixer},
  bone:name=>kinds.byName.get(name)||null,
  apply(next){const was=appearance.body;appearance=normalizeAppearance(next);if(appearance.body!==was)build();else applyParts()},
  update,setMotion,
  setSeated(value){seated=!!value},
  // Move one hand toward a point given in the character's own space (metres, +Z forward); weight 0..1.
  reach(side,target,weight){const s=reaches[side];if(target)s.target.copy(target);s.weight=weight},
  clearReach(){reaches.R.weight=reaches.L.weight=0},
  // upright: stays level (cups, fruit). Otherwise the item's `axis` ('y' or 'z') runs along the forearm.
  hold(object,{upright=false,axis='y'}={}){this.release();api.hand.add(object);held={object,upright,axis}},
  release(){if(held){held.object.removeFromParent();held=null}tilt=0},
  setHeldTilt(angle){tilt=angle},
  // Carry pose for a held tool: point its long axis along `direction` (character space), or null to follow the forearm.
  alignHeld(direction){alignDir=direction?direction.clone().normalize():null},
  setTwoHanded(weight){twoHandWeight=Math.max(0,Math.min(1,weight))},
  setLean(angle){leanAngle=angle}
 };
 build();
 return api;
}
