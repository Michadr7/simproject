import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {BEND_DROP,BEND_LEAN} from '../dist/carry.js';
import {propInfo} from '../dist/props.js';
import {MAP} from '../dist/map-definition.js';

// The carry poses in the real game loop (not the pose maths alone): the game is started with a synthetic DOM and the real character, a carry kind is put in the saved state,
// and the bones of the drawn player are measured. If game.js stopped calling the pose or the bend, these assertions fail.
const html=await readFile('dist/index.html','utf8');
class El extends EventTarget{
 constructor(tag='div'){super();this.tag=tag;this.hidden=false;this.value='';this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.selectors=new Map()}
 append(...els){this.children.push(...els)}replaceChildren(...els){this.children=[...els]}setAttribute(k,v){this[k]=v}querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new El());return this.selectors.get(s)}focus(){}matches(){return false}setCustomValidity(){}reportValidity(){}setPointerCapture(){}click(){this.onclick?.({preventDefault(){}})}
 getBoundingClientRect(){return {left:0,top:0,width:1400,height:900}}
 getContext(){return new Proxy({measureText:t=>({width:t.length*20})},{get:(o,k)=>o[k]??(()=>{})})}
}
const dir=await mkdtemp(join(tmpdir(),'city-carry-'));
try{
 const release=html.match(/import\('\.\/(releases\/[^/]+)\/game\.js'/)[1];
 await cp('dist/'+release,dir,{recursive:true});
 const threeURL=pathToFileURL(resolve('dist/vendor/three.module.js')).href;
 await writeFile(join(dir,'vendor/three.module.js'),`export * from '${threeURL}';export class WebGLRenderer{constructor(){this.shadowMap={}}setPixelRatio(){}setSize(){}setViewport(){}clear(){}render(scene,camera){globalThis.__renderScene=scene;globalThis.__renderCamera=camera}}`);
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1]==='characterName'?'input':'div')]));
 const doc=new EventTarget();doc.getElementById=id=>ids.get(id)||null;doc.createElement=tag=>new El(tag);doc.body=new El();doc.querySelectorAll=()=>[];doc.hidden=false;
 const win=new EventTarget();win.matches=()=>false;const store=new Map();
 store.set('edenridge.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));
 store.set('edenridge.progress.v1',JSON.stringify({version:1,progress:{cash:5000,completed:5,phase:'available',position:{x:1,z:-6.3},careers:{ridgeline:{hired:true,rank:1,rep:10,shifts:0,lastShiftDay:0,granted:[],owed:[]}},shift:{employer:'ridgeline',day:1,startedAt:540,last:540,paidMinutes:0,offSiteMinutes:0,tasks:[],pieces:{}}}}));
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 await import(pathToFileURL(join(dir,'game.js')).href);nextFrame(performance.now()+16);
 ids.get('start').click();assert(ids.get('welcome').hidden,'Play starts the game');
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 let simTime=performance.now()+100;const frame=()=>{simTime+=40;nextFrame(simTime)},pump=s=>{for(let i=0;i<s*25;i++)frame()};
 const key=(code,type='keydown')=>{const e=new Event(type);e.code=code;win.dispatchEvent(e)};
 const person=globalThis.__renderScene.getObjectByName('player');assert(person,'the player is in the scene');
 const local=name=>{person.updateMatrixWorld(true);const v=new THREE.Vector3();person.getObjectByName(name).getWorldPosition(v);return person.worldToLocal(v)};
 pump(1);
 // 1. Planks in both hands: the stack is crosswise in front of the chest with a hand under each end; the arms hang free again once it is put down.
 const rest={R:local('WristR'),L:local('WristL')};
 GameState.progress.carry={kind:'planks',count:4};pump(1.5);
 for(const s of ['R','L']){const w=local('Wrist'+s);assert(w.z>.25&&w.y>.95&&Math.abs(Math.abs(w.x)-.3)<.1,`${s} hand is under the stack at chest height (x ${w.x.toFixed(2)}, y ${w.y.toFixed(2)}, z ${w.z.toFixed(2)})`);assert(w.z-rest[s].z>.1,`${s} hand moved forward from its resting place`)}
 const stack=person.getObjectByName('carried-planks');
 if(stack){assert(stack.visible,'the stack is drawn');const sp=new THREE.Vector3();stack.getWorldPosition(sp);person.worldToLocal(sp);assert(Math.abs(sp.x)<.1&&sp.z>.3&&sp.y>1&&sp.y<1.4,`the stack is in front of the chest (${sp.x.toFixed(2)}, ${sp.y.toFixed(2)}, ${sp.z.toFixed(2)})`)}
 GameState.progress.carry=null;pump(1.5);const back=local('WristR');assert(back.z<rest.R.z+.1,'put down: the arms relax again');
 // 1b. A log on the shoulder: the right hand rests on its top surface near the middle (knuckles within a few centimetres of the bark), and nothing of the arm or hand goes into the log.
 // `through` is how deep the arm and hand are inside the bark (0 if clear): the forearm is sampled along its length, plus the wrist and the finger bones.
 const armPoints=(a,b,fingers,from=0)=>{const A=local(a),B=local(b),out=[];for(let k=from;k<=8;k++)out.push(A.clone().lerp(B,k/8));for(const f of fingers)out.push(local(f));return out};
 GameState.progress.carry={kind:'log'};pump(1.5);{const mesh=person.getObjectByName('carried-log').children[0],gb=mesh.geometry.boundingBox??(mesh.geometry.computeBoundingBox(),mesh.geometry.boundingBox),size=gb.getSize(new THREE.Vector3()),length=Math.max(size.x,size.y,size.z),radius=Math.min(size.y,size.z)/2,axis=person.getObjectByName('carried-log').position;
  const dist=p=>Math.abs(p.z-axis.z)<length/2?Math.hypot(p.x-axis.x,p.y-axis.y)-radius:1;
  const knuckle=local('Middle1R'),gap=dist(knuckle),along=knuckle.z-axis.z,pts=armPoints('LowerArmR','WristR',['WristR','Middle1R','Middle2R','Middle3R','Index2R','Index3R','Thumb2R','Pinky2R'],2),through=-Math.min(0,...pts.map(dist));
  console.log(`  log: ${length.toFixed(2)} m long, radius ${radius.toFixed(2)} m; right knuckles ${gap.toFixed(3)} m from the bark, ${along.toFixed(2)} m along from the middle; deepest point of the arm/hand inside the bark ${through.toFixed(3)} m`);
  assert(knuckle.y<axis.y&&knuckle.y>axis.y-radius*2.2,'the hand supports the log from underneath (it does not come up over it)');assert(gap>-.03&&gap<.07,`the hand is within a few centimetres of the log surface (${gap.toFixed(3)} m)`);assert(Math.abs(along)<length/4,`and near its middle (${along.toFixed(2)} m from it)`);
  const head=local('Head'),fromHead=Math.hypot(knuckle.x-head.x,knuckle.y-head.y,knuckle.z-head.z);console.log(`  right knuckles are ${fromHead.toFixed(2)} m from the head`);assert(fromHead>.22,`the hand is not up at the head (${fromHead.toFixed(2)} m)`);
  assert(through<.025,`no part of the arm or hand goes through the log (${through.toFixed(3)} m deep)`);
  GameState.progress.carry=null;pump(1.5);assert(local('WristR').z<rest.R.z+.1,'put down: the right arm relaxes')}
 // 1c. The stack: neither hand nor forearm goes into the planks; both hands are under it, touching. All in the player's own space (the box is the boards' bounds in it).
 GameState.progress.carry={kind:'planks',count:4};pump(1.5);{const stackObj=person.getObjectByName('carried-planks');person.updateMatrixWorld(true);const box=new THREE.Box3();
  stackObj.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])box.expandByPoint(person.worldToLocal(new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld)))});
  const depth=p=>box.containsPoint(p)?Math.min(p.x-box.min.x,box.max.x-p.x,p.y-box.min.y,box.max.y-p.y,p.z-box.min.z,box.max.z-p.z):-box.distanceToPoint(p);
  const names=s=>['Wrist','Index1','Index2','Index3','Middle1','Middle2','Middle3','Ring2','Pinky2','Thumb2'].map(n=>n+s);
  let through=-1e9,touch=1e9;for(const s of ['R','L']){const pts=armPoints('LowerArm'+s,'Wrist'+s,names(s));through=Math.max(through,...pts.map(depth));touch=Math.min(touch,...pts.map(p=>box.distanceToPoint(p)))}
  if(process.env.POSE_DEBUG)for(const n of ['LowerArmL','WristL','Index2L','Middle1L','Middle3L','Thumb2L'])console.log('    ',n,'depth',depth(local(n)).toFixed(3),'at',Object.values(local(n)).slice(0,3).map(v=>v.toFixed(2)).join(','));
  console.log(`  stack: deepest point of a hand or forearm inside the planks ${Math.max(0,through).toFixed(3)} m; closest approach ${touch.toFixed(3)} m; boards y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}, z ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}, x ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}`);
  assert(through<.025,`no part of either hand or forearm goes into the planks (${through.toFixed(3)} m)`);assert(touch<.04,'and the hands are touching the stack');
  GameState.progress.carry=null;pump(1.5)} // 1d. Swapping straight from a log to planks (no empty hands in between): the right arm must let go of the log and hang free, not stay raised.
 GameState.progress.carry={kind:'log'};pump(1.2);GameState.progress.carry={kind:'planks',count:4};pump(1.2);GameState.progress.carry=null;pump(1.5);{const r=local('WristR');assert(r.distanceTo(rest.R)<.15,`log, then planks, then nothing: the right arm is back at rest (${r.distanceTo(rest.R).toFixed(2)} m away)`);GameState.progress.carry=null;pump(1.5)}
 // 2. The bend, for the put-down and the pick-up: the hips drop 0.22 m and the spine leans about 50 degrees, and the item changes hands while fully bent.
 // the spine angle is the turn of the Chest bone against the standing pose (Abdomen and Torso carry 30% and 70% of it on the way)
 const turn=name=>{person.updateMatrixWorld(true);const q=new THREE.Quaternion();person.getObjectByName(name).getWorldQuaternion(q);return q},hipsY=()=>local('Hips').y,standing={},pitch=()=>{const q=turn('Chest');standing.q??=q.clone();return 2*Math.acos(Math.min(1,Math.abs(q.dot(standing.q))))};standing.q=turn('Chest');
 const clear={head:1e9,torso:1e9},measure=(start,changed)=>{standing.q=turn('Chest');const base={y:hipsY(),pitch:0};const parts={Abdomen:turn('Abdomen'),Torso:turn('Torso'),Chest:turn('Chest')},peak={Abdomen:0,Torso:0,Chest:0};let low=0,lean=0,atChange=null,frames=0;start();for(let i=0;i<60;i++){frame();frames++;if(GameState.progress.carry?.kind==='planks'){const st=person.getObjectByName('carried-planks');person.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(st),pt=n=>person.getObjectByName(n).getWorldPosition(new THREE.Vector3());clear.head=Math.min(clear.head,box.distanceToPoint(pt('Head')));clear.torso=Math.min(clear.torso,box.distanceToPoint(pt('Chest')),box.distanceToPoint(pt('Torso')),box.distanceToPoint(pt('Abdomen')))}const drop=base.y-hipsY(),lp=pitch()-base.pitch;low=Math.max(low,drop);lean=Math.max(lean,lp);for(const n of ['Abdomen','Torso','Chest']){const a=2*Math.acos(Math.min(1,Math.abs(turn(n).dot(parts[n]))));peak[n]=Math.max(peak[n],a)};if(atChange===null&&changed()){const d=base.y-hipsY();atChange={drop:d,lean:pitch()-base.pitch}}if(!changed()&&i>5&&frames>30&&atChange)break}
  pump(.5);return {low,lean,peak,atChange,after:{y:hipsY()-base.y,pitch:pitch()-base.pitch}}};
 const wantDrop=BEND_DROP,wantLean=BEND_LEAN;
 for(const [name,run] of [['put down a log',()=>{GameState.progress.carry={kind:'log'};GameState.progress.logs=[];pump(.5);return measure(()=>key('KeyX'),()=>GameState.progress.carry===null)}],
  ['pick up a log',()=>{const me=GameState.me.position;GameState.progress.carry=null;GameState.progress.logs=[{id:1,x:me.x+.6,z:me.z+.6,rot:0,t:0}];pump(.5);return measure(()=>key('KeyE'),()=>GameState.progress.carry?.kind==='log')}],
  ['put down planks',()=>{GameState.progress.logs=[];GameState.progress.carry={kind:'planks',count:4};pump(1.5);return measure(()=>key('KeyX'),()=>GameState.progress.carry===null)}]]){
  const r=run();console.log(`  ${name}: hips dropped ${r.low.toFixed(3)} m (design ${wantDrop}), spine leaned ${(r.lean*180/Math.PI).toFixed(1)} deg (design ${(wantLean*180/Math.PI).toFixed(0)}), at the hand-over ${r.atChange?r.atChange.drop.toFixed(3)+' m / '+(r.atChange.lean*180/Math.PI).toFixed(1)+' deg':'never'}, Abdomen/Torso/Chest turned ${['Abdomen','Torso','Chest'].map(n=>(r.peak[n]*180/Math.PI).toFixed(1)).join('/')} deg, upright again ${r.after.y.toFixed(3)} m / ${(r.after.pitch*180/Math.PI).toFixed(1)} deg`);
  assert(r.atChange,`${name}: the item changed hands`);
  if(name==='put down planks'){console.log(`  stack clearance through the bend: head ${clear.head.toFixed(2)} m, torso bones ${clear.torso.toFixed(2)} m`);assert(clear.head>.1,'the stack stays clear of the head');assert(clear.torso>.1,'the stack stays clear of the torso')}
  assert(r.low>wantDrop*.85&&r.low<wantDrop*1.3,`${name}: hips drop about ${wantDrop} m (${r.low.toFixed(3)})`);
  assert(r.lean>wantLean*.8,`${name}: the spine leans about 50 degrees (${(r.lean*180/Math.PI).toFixed(1)})`);
  assert(r.atChange.drop>wantDrop*.8&&r.atChange.lean>wantLean*.75,`${name}: the item changes hands while fully bent`);
  assert(Math.abs(r.after.y)<.03&&Math.abs(r.after.pitch)<.1,`${name}: standing upright again afterwards`);
 }
 // 3. A stack on the ground: snapped to a quarter turn, solid from every side (the box is the drawn footprint, 1.2 x 0.45 m), and still pick-up-able by E when you stand against it.
 // Run once where the stack was put down (the street) and once on the sawmill's main deck.
 const stackWalk=(drop,where,floorY,standY=floorY,lead=2.5)=>{
  const ground=globalThis.__renderScene.getObjectByName('ground-planks');assert.equal(ground.count,4,`${where}: the stack is drawn`);ground.geometry.computeBoundingBox();const size=ground.geometry.boundingBox.getSize(new THREE.Vector3()),odd=drop.q%2===1,hx=(odd?size.z:size.x)/2,hz=(odd?size.x:size.z)/2;
  assert(Math.abs(size.x-1.2)<1e-3&&Math.abs(size.z-.45)<.01,`${where}: the footprint is 1.2 x 0.45 m`);
  const m=new THREE.Matrix4(),p=new THREE.Vector3();ground.getMatrixAt(0,m);p.setFromMatrixPosition(m);assert(Math.abs(p.y-(floorY+.06))<1e-6,`${where}: the stack lies at the floor height ${floorY} (drawn at ${p.y.toFixed(3)})`);
  const me=GameState.me.position,keys=['KeyW','KeyA','KeyS','KeyD'],gaps=[];let best=null;
  for(const [name,dx,dz] of [['west',-(hx+lead),0],['east',hx+lead,0],['north',0,-(hz+lead)],['south',0,hz+lead]])for(const k of keys){
   Object.assign(me,{x:drop.x+dx,y:standY,z:drop.z+dz});pump(.3);key(k);let inside=false;for(let i=0;i<100;i++){frame();if(Math.abs(me.x-drop.x)-hx<.33-.02&&Math.abs(me.z-drop.z)-hz<.33-.02)inside=true}key(k,'keyup');pump(.2);
   assert(!inside,`${where}: walking ${k} from the ${name} never enters the stack's box`);const gap=Math.max(Math.abs(me.x-drop.x)-hx,Math.abs(me.z-drop.z)-hz)-.33;gaps.push(gap);if(!best||gap<best.gap)best={gap,x:me.x,z:me.z}}
  console.log(`  ${where}: stack ${size.x.toFixed(2)} x ${size.z.toFixed(2)} m, box half ${hx.toFixed(2)} x ${hz.toFixed(2)}; closest stop ${best.gap.toFixed(3)} m from the box edge`);
  assert(gaps.some(g=>g<.12),`${where}: at least one approach stopped against the box (so the box really blocks, not only that nobody walked there)`);
  Object.assign(me,{x:best.x,y:standY,z:best.z});pump(.3);key('KeyE');pump(1.5);assert.deepEqual(GameState.progress.carry,{kind:'planks',count:4},`${where}: E picks the stack up while standing against it`);assert.deepEqual(GameState.progress.plankDrops,[]);
  assert.equal(globalThis.__renderScene.getObjectByName('ground-planks').count,0,`${where}: the picked-up stack is gone from the ground`)};
 {const drop=GameState.progress.plankDrops[0];assert(drop,'the stack was put down');assert([0,1,2,3].includes(drop.q),'quarter turn '+drop.q);stackWalk(drop,'street',0,.02)}
 // The sawmill's main deck: the clearest spot on it (furthest from every post and the bench), in world coordinates.
 {const landmark=MAP.landmarks.find(l=>l.id==='sawmill'),info=propInfo(landmark.prop),c=Math.round(Math.cos(landmark.yaw)),s=Math.round(Math.sin(landmark.yaw)),world=(x,z)=>({x:landmark.x+x*c+z*s,z:landmark.z-x*s+z*c}),turned=Math.abs(s)===1;
  const boxes=info.colliders.map(b=>({...world(b.x,b.z),hx:turned?b.hz:b.hx,hz:turned?b.hx:b.hz})),deck=info.floors[0];assert(deck,'the model has a main deck');
  let spot=null;for(let x=deck.x0+1.5;x<=deck.x1-1.5;x+=.25)for(let z=deck.z0+1.5;z<=deck.z1-1.5;z+=.25){const w=world(x,z),room=Math.min(...boxes.map(b=>Math.max(Math.abs(w.x-b.x)-b.hx,Math.abs(w.z-b.z)-b.hz)));if(!spot||room>spot.room)spot={...w,room}}
  assert(spot&&spot.room>1.1,`a clear spot on the deck (${spot?.room.toFixed(1)} m from the nearest post)`);
  // The player must be allowed on the deck: teleport there and stand.
  const me=GameState.me.position;GameState.progress.carry=null;GameState.progress.plankDrops=[{id:1,x:spot.x,z:spot.z,count:4,q:0}];Object.assign(me,{x:spot.x,y:deck.y,z:spot.z+3});pump(1.5);
  console.log(`  sawmill deck: height ${deck.y}, stack at ${spot.x.toFixed(1)}, ${spot.z.toFixed(1)} with ${spot.room.toFixed(1)} m clear`);
  stackWalk(GameState.progress.plankDrops[0]??{id:1,x:spot.x,z:spot.z,count:4,q:0},'sawmill deck',deck.y,deck.y,Math.max(.6,Math.min(.8,spot.room-.4)))}}finally{await rm(dir,{recursive:true,force:true})}
console.log('Carry in the game loop: planks are held crosswise at chest height with both hands under them (nothing through the boards), a log is held up from underneath by the right hand (nothing through the bark, hand well away from the head), a hand lets go when the carry changes; picking up and putting down both bend the spine about 50 degrees and drop the hips 0.22 m, change hands at the bottom and stand up again.');

