import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createProp,propInfo} from '../dist/props.js';
import {SHADOW_CASTERS,trimLoop} from '../dist/rigged-props.js';
import {MAP} from '../dist/map-definition.js';
import {BELT_SLOTS,freshSawmill,switchSawmill,switchLabel,anchorWorld,createSawmillController} from '../dist/sawmill.js';

// three's Quaternion.angleTo is 2*acos(|dot|), which cannot resolve angles under about 0.02 degrees in float32; the chord form below can.
THREE.Quaternion.prototype.angleTo=function(q){const s=this.dot(q)<0?-1:1;return 4*Math.asin(Math.min(1,.5*Math.hypot(this.x-s*q.x,this.y-s*q.y,this.z-s*q.z,this.w-s*q.w)))};

// ── The rules (pure) ──────────────────────────────────────────────────────────────
{const s0=freshSawmill();assert.deepEqual(s0,{on:false},'the saw is off when the game loads');
 const a=switchSawmill(s0,undefined);assert.deepEqual(a.state,{on:true});assert.deepEqual(s0,{on:false},'the old state is not changed');
 assert.deepEqual(switchSawmill(a.state,undefined).state,{on:false},'flips back');assert.deepEqual(switchSawmill(a.state,true).state,{on:true},'on when already on changes nothing');
 assert.equal(BELT_SLOTS,4);assert(switchSawmill(s0,true,BELT_SLOTS).error,'a full belt refuses to switch on');assert.deepEqual(switchSawmill(s0,true,BELT_SLOTS-1).state,{on:true},'room for one more stack: fine');
 assert.deepEqual(switchSawmill({on:true},false,BELT_SLOTS).state,{on:false},'a full belt never stops you switching off');
 assert.equal(switchLabel(s0),'Switch the saw on');assert.equal(switchLabel({on:true}),'Switch the saw off')}

// ── The model: where the switch is, the trimmed loops, the clips playing together ──────────
const landmark=MAP.landmarks.find(l=>l.id==='sawmill'),info=propInfo(landmark.prop);
{const p=anchorWorld(landmark,info.anchors.anchor_switch);assert(Math.abs(p.x-100.1)<.05&&Math.abs(p.z+282)<.05,`switch stands at ${p.x},${p.z}`);assert.equal(p.y,.3)}
const group=createProp('sawmill-v4',{apply:m=>m}),ctl=createSawmillController(group,landmark);assert(ctl&&!ctl.ready,'the controller waits for the model');
await group.userData.ready;assert(ctl.ready);
const scene=group.userData.scene,clips=group.userData.clips,node=n=>scene.getObjectByName(n),near=(a,b,e=.002)=>Math.abs(a-b)<e;
const step=(seconds,dt=1/30)=>{for(let t=0;t<seconds-1e-9;t+=dt)ctl.update(dt)};
// Loop clips: one turn, starting at t = 0, 1.0 s, 24 distinct poses and the closing key that wraps to the first.
for(const name of ['BladeSpin','BeltRun']){const c=clips.get(name);assert(near(c.duration,1,1e-6),name+' is exactly 1.0 s');
 for(const t of c.tracks)assert.equal(t.times[0],0,`${name}.${t.name}: first key at t = 0`);
 const q=c.tracks.find(t=>t.name.endsWith('.quaternion'));assert.equal(q.times.length,25,'25 keys: 24 poses and the pose it wraps to');assert(near(q.times[24],1,1e-5));
 const angles=[];for(let i=0;i<24;i++){const a=new THREE.Quaternion().fromArray(q.values,i*4),b=new THREE.Quaternion().fromArray(q.values,(i+1)*4);angles.push(a.angleTo(b))}
 assert(Math.max(...angles)-Math.min(...angles)<1e-3,`${name}: equal steps all the way round, including the step that closes the loop (${angles.map(v=>(v*57.3).toFixed(1))[0]} degrees)`)}
{const q=clips.get('BladeSpin').tracks.find(t=>t.name==='Blade.quaternion'),a=new THREE.Quaternion().fromArray(q.values,0),b=new THREE.Quaternion().fromArray(q.values,96);assert(a.angleTo(b)<1e-3,'BladeSpin: the closing key is the first pose')}
// The one-shot clips are as exported (first key at 1/24 s): only the loops are trimmed.
assert(near(clips.get('SwitchOn').tracks[0].times[0],1/24,1e-5)&&near(clips.get('Cut').duration,100/24,1e-3));
assert.throws(()=>trimLoop(new THREE.AnimationClip('X',-1,[new THREE.NumberKeyframeTrack('a.x',[0,5],[0,1])]),1),/expected 1 s/,'a clip of the wrong length is an error');

// Rest: lever up, lamp dark, blade still.
const bladeAt=()=>node('Blade').quaternion.clone(),leverAt=()=>node('Switch').quaternion.clone(),lampScale=()=>node('Lamp').scale.x;
assert(near(lampScale(),.001,1e-6),'lamp dark at rest');const bladeRest=bladeAt(),leverRest=leverAt();step(1);assert(bladeAt().angleTo(bladeRest)<1e-6&&leverAt().angleTo(leverRest)<1e-6&&near(lampScale(),.001,1e-6),'nothing moves while the saw is off');
// On: lever swings, lamp lights, the blade spins up (all at once: separate rigs).
ctl.setOn(true);step(.1);const midLever=leverAt();assert(midLever.angleTo(leverRest)>.02&&lampScale()<.5,'lever moving, lamp not yet lit at 0.1 s');assert(bladeAt().angleTo(bladeRest)>0,'the blade is already turning while the lever swings');
step(.4);{const t=clips.get('SwitchOn').tracks.find(t=>t.name==='Switch.quaternion'),last=new THREE.Quaternion().fromArray(t.values,t.values.length-4);assert(leverAt().angleTo(last)<1e-4,'the lever lands on the last SwitchOn key');assert(near(lampScale(),1,1e-4),'lamp lit')
 assert(Math.abs(leverAt().angleTo(leverRest)-Math.PI/3)<.03,'the lever swings 60 degrees: '+(leverAt().angleTo(leverRest)*57.3).toFixed(1))}
step(2);assert(ctl.speed>.85,'blade near full speed: '+ctl.speed.toFixed(2));
{const before=bladeAt();step(1/30);const per=before.angleTo(bladeAt());assert(per>.05&&per<.5,'about 15 degrees a frame at full speed: '+(per*57.3).toFixed(1))}
// Flip halfway: the lever reverses from where it is (no jump).
ctl.setOn(false);step(.25);const swingBack=leverAt();ctl.setOn(true);const justFlipped=leverAt();step(1/30);assert(leverAt().angleTo(swingBack)<.35,'reverses from where the lever was ('+(leverAt().angleTo(swingBack)*57.3).toFixed(1)+' degrees in one frame)');assert(justFlipped.angleTo(swingBack)<1e-6);
step(1);ctl.setOn(false);step(.5);assert(near(lampScale(),.001,.05)||lampScale()<.1,'lamp goes dark: '+lampScale().toFixed(3));assert(leverAt().angleTo(leverRest)<1e-3,'lever back up');
// The blade coasts to a stop and then holds its pose.
step(8);assert.equal(ctl.speed,0);{const hold=bladeAt();step(.5);assert(bladeAt().angleTo(hold)<1e-9,'stopped blade holds still')}
// Out of range (group hidden): nothing is animated.
{ctl.setOn(true);group.visible=false;const before=leverAt();step(.5);assert(leverAt().angleTo(before)<1e-9,'a hidden sawmill is not animated');group.visible=true;ctl.setOn(false);step(1)}

// ── Cutting: the Cut clip, the stack landing on the belt, riding to the end stop, the beacon ───────────────────────
{const BELT=scene.getObjectByName('belt-planks'),plank=i=>node('Plank_Out_'+i),pos=i=>{const m=new THREE.Matrix4(),v=new THREE.Vector3();BELT.getMatrixAt(i,m);return v.setFromMatrixPosition(m)};
 const beacon=n=>{let mat=null;scene.traverse(o=>{if(o.isMesh&&o.material.name===n)mat=o.material});return mat.emissiveIntensity};
 assert.equal(ctl.count(),0,'an empty belt');assert.equal(BELT.count,0);assert(!node('FeedLog').visible,'no log waits on the bench until one is put in');
 assert(beacon('Beacon_Green')>3&&beacon('Beacon_Red')===0,'green while there is room');
 assert.equal(ctl.startCut(()=>{}),false,'the saw has to be on to take a log');ctl.setOn(true);step(1);
 let landed=0;assert(ctl.startCut(()=>landed++));assert(ctl.cutting);assert.equal(ctl.startCut(),false,'one cut at a time');assert(node('FeedLog').visible,'the log is on the bench');
 assert(!ctl.sawing&&ctl.dust.particles.alive===0,'nothing flies before the log reaches the blade');
 step(.1);const rest=node('FeedLog').position.clone();step(1.2);assert(ctl.sawing,'the log is in the blade at 1.3 s (frames 14 to 47)');assert(ctl.dust.particles.alive>100&&ctl.dust.points.visible,'sawdust is flying: '+ctl.dust.particles.alive);assert(node('FeedLog').position.distanceTo(rest)>1,'the log travels onto the bench and into the blade');assert.equal(landed,0);assert(node('FeedLog').scale.x>.5,'still in one piece at 1.3 s');
 step(.9);assert(!ctl.sawing,'out of the blade by 2.2 s');assert(node('FeedLog').scale.x<.01,'the log is cut at frame 47 (about 2 s): the planks take over');assert(ctl.cutting&&landed===0,'but the planks have not landed yet');assert(node('Plank_Out_0').scale.x>.5,'planks sliding over the belt');step(2.5);assert.equal(ctl.dust.particles.alive,0,'the dust has settled');assert(!ctl.dust.points.visible);assert(ctl.beltLevel>0,'the belt is running with the new stack');
 assert.equal(landed,1,'the cut ends once');assert(!ctl.cutting);assert(!node('FeedLog').visible,'the log is gone');
 for(let i=0;i<4;i++)assert(Math.abs(plank(i).scale.x-.001)<1e-6&&Math.abs(plank(i).position.x-1.6)<1e-4,`plank ${i} is back at rest, hidden`);
 assert.equal(ctl.count(),1);assert.equal(BELT.count,4,'four planks drawn');
 {const c=[0,1,2,3].map(i=>{const col=new THREE.Color();BELT.getColorAt(i,col);return +col.r.toFixed(2)}),m4=new THREE.Matrix4(),sc=new THREE.Vector3();BELT.getMatrixAt(0,m4);sc.setFromMatrixScale(m4);assert.equal(new Set(c).size,4,'four different shades, so the boards read as a stack: '+c);assert(Math.abs(sc.y-.88)<1e-6,'12% thinner than the 12 cm slot: a seam between boards');for(let i=0;i<4;i++)assert(plank(i).material!==plank(0).material||i===0,'the clip planks have their own shade too')}
 {const first=pos(0);assert(Math.abs(first.x-6.4)<1e-3&&Math.abs(first.y-.86)<1e-3&&first.z<1.5&&first.z>1.0,`the stack is where the clip put it, and has begun to ride: ${first.toArray().map(v=>v.toFixed(2))}`);assert(Math.abs(pos(3).y-1.22)<1e-3,'four planks stacked, 12 cm apart')}
 const roller=node('Belt_Roller_0'),was=roller.quaternion.clone();step(.5);assert(roller.quaternion.angleTo(was)>.05,'the rollers turn while the stack moves');
 assert(!ctl.frontArrived());step(7);assert(ctl.frontArrived(),'the stack reaches the end stop (3 m at 0.47 m/s)');assert(Math.abs(pos(0).z-(1.5-3))<1e-3,'on the last slot (z = -1.5)');
 step(2);{const hold=roller.quaternion.clone();step(.5);assert(roller.quaternion.angleTo(hold)<1e-3,'the rollers stop when nothing moves')}
 // Four stacks: red beacon; taking one stack: green again, the others ride forward.
 ctl.setBelt(4);ctl.update(1/30);assert.equal(BELT.count,16);assert(beacon('Beacon_Red')>3&&beacon('Beacon_Green')===0,'red when the belt is full');{let g=null,r=null;scene.traverse(o=>{if(o.isMesh&&o.material.name==='Beacon_Green')g=o.material;if(o.isMesh&&o.material.name==='Beacon_Red')r=o.material});assert(g.color.g<.2&&r.color.r>.2,'the unlit lens is dim glass, the lit one keeps its colour')}
 assert(ctl.take());assert.equal(ctl.count(),3);step(.1);assert(beacon('Beacon_Green')>3&&beacon('Beacon_Red')===0,'green again after taking one stack');assert.equal(BELT.count,12);
 {const z0=pos(0).z;step(1);assert(pos(0).z<z0,'the rest ride forward to fill the gap');step(3)}assert.equal(ctl.take()&&ctl.take()&&ctl.take(),true);assert.equal(ctl.take(),false,'an empty belt gives nothing');assert.equal(ctl.count(),0);
 ctl.setBelt(2);ctl.update(1/30);assert.equal(BELT.count,8);assert(Math.abs(pos(0).z+1.5)<1e-3&&Math.abs(pos(4).z+.5)<1e-3,'a loaded belt starts packed against the end stop');
 // Planks put down on the ground.
 ctl.setDrops([{id:1,x:104,z:-260,count:4},{id:2,x:106,z:-260,count:2}]);const ground=scene.getObjectByName('ground-planks');assert.equal(ground.count,6);
 ctl.setDrops([]);assert.equal(ground.count,0)}
// ── Shadows: only the large parts cast ────────────────────────────────────────────────
{const cast=[],plain=[];scene.traverse(o=>{if(o.isMesh)(o.castShadow?cast:plain).push(o.name)});
 assert.deepEqual(cast.sort(),['Blade_1','Blade_2','FeedLog_1','FeedLog_2','Static_Bark','Static_EndGrain','Static_Iron_Dark','Static_Roof_Slate','Static_Stone','Static_Timber','Static_Timber_Dark'],'casters');
 for(const n of plain)assert(/^(Belt_Roller_\d|Plank_Out_\d|Switch_Lamp_On|Switch_Lever|belt-planks|ground-planks|Static_(Beacon_(Green|Red)|Lamp_Off))$/.test(n),n+' is a small part and does not cast');
 let meshes=0;scene.traverse(o=>{if(o.isMesh){meshes++;assert(o.receiveShadow,o.name+' receives shadows')}});
 console.log(`Sawmill rig: rules, trimmed loops (1.0 s, 24 poses), switch and blade together, mid-swing reversal, coasting stop, a cut from log to stack on the belt (planks hidden after, belt riding to the end stop, rollers turning only while it moves), the beacon, planks on the ground; shadow draws ${cast.length} (was ${meshes}), the other ${plain.length} small parts do not cast.`)}
