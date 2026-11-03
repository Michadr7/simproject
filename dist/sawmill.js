// The sawmill's switch, blade, cut and belt. Rules are pure ((state, want, belt) -> {state} or {error}, and carry.js for logs and planks); the controller only plays the model's clips (rigged-props.js)
// to match and draws what the saved numbers say. The clips live on separate rigs (BladeSpin on BladeRig, SwitchOn/SwitchOff on SawmillRig, Cut on FeedLog and the four planks, BeltRun on the rollers),
// so they run together. The switch is not saved: the saw is off whenever the game loads. The belt count is (carry.js `belt`); where the stacks sit is derived from it.
import * as THREE from './vendor/three.module.js';
import {BELT_SLOTS,PLANKS_PER_STACK,MAX_PLANK_DROPS,PLANK_REST,restHeight} from './carry.js';
import {createSawdust} from './sawdust.js';
export {BELT_SLOTS};

export const freshSawmill=()=>({on:false});
// want: true (on), false (off), or undefined (flip). `stacks`: stacks on the belt.
export function switchSawmill(state,want,stacks=0){
 const on=want===undefined?!state.on:!!want;
 if(on===state.on)return {state};
 if(on&&stacks>=BELT_SLOTS)return {error:'The belt is full. Take some planks away before switching the saw on.'};
 return {state:{...state,on}};
}
export const switchLabel=state=>state.on?'Switch the saw off':'Switch the saw on';

// A model point in the world: the landmark's position and yaw turn model coordinates (x, y, z) into the map's.
export function anchorWorld(landmark,anchor){
 const c=Math.round(Math.cos(landmark.yaw)),s=Math.round(Math.sin(landmark.yaw)),[x,y,z]=anchor;
 return {x:landmark.x+x*c+z*s,y,z:landmark.z-x*s+z*c};
}

const SPIN_UP=1.2,SPIN_DOWN=.8; // how fast the blade reaches full speed and coasts to a stop (per second, exponential)
// The rollers are 0.12 m across and BeltRun turns them 450 degrees a second (1.25 turns), so a plank on them moves at pi * 0.12 * 1.25 = 0.47 m/s; the slots are 1 m apart.
const BELT_SPEED=Math.PI*.12*1.25,BELT_EASE=4;
// A stack reads as four boards: each is a slightly different shade, and the plank mesh is 12% thinner than its 12 cm slot so a dark seam shows between them. The thinner mesh is used by everything that shows a plank
// (the clip's four planks, the belt, the ground, the hands), so the hand-off from the clip to the belt changes nothing: the belt's planks sit exactly where the last key of Cut leaves the clip's.
export const PLANK_TINT=[.86,.95,.82,1],PLANK_THIN=.88;
// The log is in the blade from frame 14 to frame 47 of the 24 fps Cut clip (sawmill_spec.md): sawdust flies and the blade's note drops then.
const SAW_FROM=14/24,SAW_TO=47/24,DUST_RATE=220; // particles a second
const BEACON_ON={Beacon_Green:3.6,Beacon_Red:4}; // emissive strengths in the file
// group: the prop group from createProp('sawmill-v4'); landmark: its map entry; options.belt(): the saved belt count, read once the model has decoded. `ready` is false until then.
export function createSawmillController(group,landmark,options={}){
 if(!group?.userData?.ready)return null;
 const ctl={ready:false,on:false,speed:0,cutting:false,sawing:false,beltLevel:0,bladePoint:null,beltPoint:null,switchPoint:null,promptPoint:null,logPoint:null,logPrompt:null,clearPoint:null,clearPrompt:null,
  update(){},setOn(){},startCut(){return false},take(){return false},setBelt(){},count:()=>0,frontArrived:()=>false,setDrops(){},plank:null};
 group.userData.ready.then(()=>{
  const {scene,clips,anchors}=group.userData,mixer=new THREE.AnimationMixer(scene),clip=n=>{const c=clips.get(n);if(!c)throw new Error('sawmill model has no clip '+n);return c};
  const once=n=>{const a=mixer.clipAction(clip(n));a.setLoop(THREE.LoopOnce,1);a.clampWhenFinished=true;return a};
  const blade=mixer.clipAction(clip('BladeSpin')),on=once('SwitchOn'),off=once('SwitchOff'),rollers=mixer.clipAction(clip('BeltRun')),cut=mixer.clipAction(clip('Cut'));
  cut.setLoop(THREE.LoopOnce,1);cut.clampWhenFinished=false;blade.timeScale=0;blade.play();rollers.timeScale=0;rollers.play();
  let last=null; // which switch clip played last, so a flip halfway through continues from where the lever is
  const point=name=>anchorWorld(landmark,anchors[name]),vec=p=>()=>new THREE.Vector3(p.x,p.y,p.z);
  const sw=point('anchor_switch'),swPrompt=point('anchor_switch_prompt'),logIn=point('anchor_log_in'),clear=point('anchor_belt_clear');
  // The felled log waits out of sight until one is put in; the planks and the log are the clip's own nodes (stopping the clip puts them back at rest).
  const feed=scene.getObjectByName('FeedLog');feed.visible=false;
  // The stack as the clip lands it (slot 0): taken from the last keys of the four planks, so the belt stacks match the animation exactly.
  const plankMesh=scene.getObjectByName('Plank_Out_0'),plankMaterial=plankMesh.material,lastKey=(k,what)=>{const t=clip('Cut').tracks.find(t=>t.name===`Plank_Out_${k}.${what}`);if(!t)throw new Error(`Cut has no ${what} track for plank ${k}`);return new THREE.Vector3().fromArray(t.values,t.values.length-3)}, // the last key of Cut: where the clip leaves each plank
   landing=Array.from({length:PLANKS_PER_STACK},(_,k)=>lastKey(k,'position')),landingScale=Array.from({length:PLANKS_PER_STACK},(_,k)=>lastKey(k,'scale')),thinGeometry=plankMesh.geometry.clone().scale(1,PLANK_THIN,1);
  const tints=PLANK_TINT.map(v=>new THREE.Color().setScalar(v)),slot0Z=landing[0].z,mats=new Map();for(let k=0;k<PLANK_TINT.length;k++){const node=scene.getObjectByName('Plank_Out_'+k);node.geometry=thinGeometry;node.material=plankMaterial.clone();node.material.color.multiplyScalar(PLANK_TINT[k])}scene.traverse(o=>{if(o.isMesh)mats.set(o.material.name,o.material)});
  const belt=new THREE.InstancedMesh(thinGeometry,plankMaterial,BELT_SLOTS*PLANKS_PER_STACK);belt.name='belt-planks';belt.receiveShadow=true;belt.frustumCulled=false;belt.count=0;scene.getObjectByName('Sawmill').add(belt);
  const lensColour=new Map(Object.keys(BEACON_ON).map(n=>[n,mats.get(n).color.clone()])),stacks=[],m=new THREE.Matrix4(),one=new THREE.Quaternion(),unit=new THREE.Vector3(1,1,1),at=new THREE.Vector3();
  let dirty=true,done=null,beltSpeed=0;
  const refresh=()=>{ // the planks of every stack, and the beacon: green while there is room, red when the belt is full
   let n=0;for(const s of stacks)landing.forEach((p,k)=>{belt.setMatrixAt(n,m.compose(at.set(p.x,p.y,slot0Z-s.pos),one,landingScale[k]));belt.setColorAt(n++,tints[k])});
   belt.count=n;belt.instanceMatrix.needsUpdate=true;if(belt.instanceColor)belt.instanceColor.needsUpdate=true;dirty=false;
   const full=stacks.length>=BELT_SLOTS;for(const [name,strength] of Object.entries(BEACON_ON)){const mat=mats.get(name);if(!mat)continue;const lit=(name==='Beacon_Red')===full;mat.emissiveIntensity=lit?strength:0;mat.color.copy(lensColour.get(name)).multiplyScalar(lit?1:.12)} // the unlit lens is dim glass, not a bright green or red
  };
  const endCut=()=>{cut.stop();feed.visible=false;ctl.cutting=false;stacks.push({pos:0});dirty=true;const f=done;done=null;f?.()};
  mixer.addEventListener('finished',e=>{if(e.action===cut)endCut()});
  // Planks put down on the ground (carry.js plankDrops): one stack of up to four per drop, in world coordinates, drawn as instances.
  const drops=new THREE.InstancedMesh(thinGeometry,plankMaterial,MAX_PLANK_DROPS*PLANKS_PER_STACK);drops.name='ground-planks';drops.count=0;drops.castShadow=false;drops.receiveShadow=true;drops.frustumCulled=false;(group.parent||scene).add(drops);
  const yAxis=new THREE.Vector3(0,1,0),bladeAt=point('anchor_blade_sound'),beltAt=point('anchor_belt_sound'),dust=createSawdust(group.parent||scene,{origin:point('anchor_sawdust'),yaw:landmark.yaw,floorY:anchors.anchor_player[1]});let emit=0;
  Object.assign(ctl,{
   ready:true,mixer,dust,bladePoint:{x:bladeAt.x,z:bladeAt.z},beltPoint:{x:beltAt.x,z:beltAt.z},switchPoint:{x:sw.x,z:sw.z},promptPoint:vec(swPrompt),logPoint:{x:logIn.x,z:logIn.z},logPrompt:vec({x:logIn.x,y:1.5,z:logIn.z}),clearPoint:{x:clear.x,z:clear.z},clearPrompt:vec({x:clear.x,y:1.4,z:clear.z}),
   plank:{geometry:thinGeometry,material:plankMaterial},
   setOn(want){
    if(want===ctl.on)return;ctl.on=want;
    const from=want?off:on,to=want?on:off;
    const start=last===null?0:Math.max(0,to.getClip().duration-from.time); // the lever reverses from where it is
    from.enabled=false;to.reset();to.time=start;to.play();last=want?'on':'off';
   },
   // The saw takes a log: the Cut clip plays (log lifts onto the bench, goes through the blade, four planks slide over the belt and land); `onDone` runs when the stack has landed.
   startCut(onDone){if(ctl.cutting||!ctl.on)return false;ctl.cutting=true;done=onDone||null;feed.visible=true;cut.reset().play();return true},
   take(){if(!stacks.length)return false;stacks.shift();dirty=true;return true}, // the oldest stack is lifted off; the rest ride forward
   count:()=>stacks.length,frontArrived:()=>stacks.length>0&&stacks[0].pos>=BELT_SLOTS-1-1e-3,
   setBelt(n){stacks.length=0;for(let i=0;i<n;i++)stacks.push({pos:BELT_SLOTS-1-i});dirty=true},
   setDrops(list){let n=0;list.forEach((d,i)=>{const q=one.clone().setFromAxisAngle(yAxis,i*1.3+d.id*.7);for(let k=0;k<d.count;k++){drops.setMatrixAt(n,m.compose(at.set(d.x,restHeight(d.floor,PLANK_REST)+.12*k,d.z),q,unit));drops.setColorAt(n++,tints[k])}});drops.count=n;drops.instanceMatrix.needsUpdate=true;if(drops.instanceColor)drops.instanceColor.needsUpdate=true},
   update(dt){
    if(!group.visible){dust.points.visible=false;ctl.sawing=false;ctl.beltLevel=0;return} // out of range: nothing is drawn, so nothing is animated (and nothing is heard)
    const target=ctl.on?1:0;ctl.speed+=(target-ctl.speed)*(1-Math.exp(-dt*(target?SPIN_UP:SPIN_DOWN)));if(!ctl.on&&ctl.speed<.002)ctl.speed=0;
    blade.timeScale=ctl.speed;
    // The stacks ride to the end stop: the oldest ends on the last slot, the next one behind it, and so on. The rollers turn while anything moves.
    let moving=false;stacks.forEach((s,i)=>{const end=BELT_SLOTS-1-i;if(s.pos<end){s.pos=Math.min(end,s.pos+BELT_SPEED*dt);moving=true;dirty=true}});
    beltSpeed+=((moving?1:0)-beltSpeed)*(1-Math.exp(-dt*BELT_EASE));if(!moving&&beltSpeed<.01)beltSpeed=0;rollers.timeScale=beltSpeed;
    mixer.update(dt);if(dirty)refresh(); // after the mixer: the frame a cut ends, the clip's planks go back to rest and the belt's planks appear in the same frame
    ctl.beltLevel=beltSpeed;ctl.sawing=ctl.cutting&&cut.time>=SAW_FROM&&cut.time<=SAW_TO;
    if(ctl.sawing){emit+=DUST_RATE*dt;const n=Math.floor(emit);emit-=n;dust.emit(n)}
    dust.update(dt);
   }});
  ctl.setBelt(Math.max(0,Math.min(BELT_SLOTS,options.belt?.()||0)));refresh();
 });
 return ctl;
}
