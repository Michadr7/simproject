import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';

// The carry as the player gets it: no debug hooks and no assignment to progress.carry. A log or a stack of planks is put on the ground, E is pressed beside it (the real interaction: candidates, the bend, the
// transaction), the player walks a few steps and stops, and the drawn bones and the drawn item are measured in the player's own space, while walking and while standing.
const html=await readFile('dist/index.html','utf8');
class El extends EventTarget{
 constructor(tag='div'){super();this.tag=tag;this.hidden=false;this.value='';this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.selectors=new Map()}
 append(...els){this.children.push(...els)}replaceChildren(...els){this.children=[...els]}setAttribute(k,v){this[k]=v}querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new El());return this.selectors.get(s)}focus(){}matches(){return false}setCustomValidity(){}reportValidity(){}setPointerCapture(){}click(){this.onclick?.({preventDefault(){}})}
 getBoundingClientRect(){return {left:0,top:0,width:1400,height:900}}
 getContext(){return new Proxy({measureText:t=>({width:t.length*20})},{get:(o,k)=>o[k]??(()=>{})})}
}
const dir=await mkdtemp(join(tmpdir(),'city-real-'));
try{
 const release=html.match(/import\('\.\/(releases\/[^/]+)\/game\.js'/)[1];
 await cp('dist/'+release,dir,{recursive:true});
 const threeURL=pathToFileURL(resolve('dist/vendor/three.module.js')).href;
 await writeFile(join(dir,'vendor/three.module.js'),`export * from '${threeURL}';export class WebGLRenderer{constructor(){this.shadowMap={}}setPixelRatio(){}setSize(){}setViewport(){}clear(){}render(scene,camera){globalThis.__renderScene=scene;globalThis.__renderCamera=camera}}`);
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1]==='characterName'?'input':'div')]));
 const doc=new EventTarget();doc.getElementById=id=>ids.get(id)||null;doc.createElement=tag=>new El(tag);doc.body=new El();doc.querySelectorAll=()=>[];doc.hidden=false;
 const win=new EventTarget();win.matches=()=>false;const store=new Map();
 store.set('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));
 store.set('citylife.progress.v1',JSON.stringify({version:1,progress:{cash:5000,completed:5,phase:'available',position:{x:1,z:-6.3}}}));
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 await import(pathToFileURL(join(dir,'game.js')).href);nextFrame(performance.now()+16);
 ids.get('start').click();assert(ids.get('welcome').hidden,'Play starts the game');
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 let simTime=performance.now()+100;const frame=()=>{simTime+=40;nextFrame(simTime)},pump=s=>{for(let i=0;i<s*25;i++)frame()};
 const key=(code,type='keydown')=>{const e=new Event(type);e.code=code;win.dispatchEvent(e)};
 const person=globalThis.__renderScene.getObjectByName('player'),me=GameState.me.position;assert(person);pump(1);
 const local=name=>{person.updateMatrixWorld(true);const v=new THREE.Vector3();person.getObjectByName(name).getWorldPosition(v);return person.worldToLocal(v)};
 const worldY=name=>{person.updateMatrixWorld(true);const v=new THREE.Vector3();person.getObjectByName(name).getWorldPosition(v);return v.y};
 const along=(a,b,fingers,from=0)=>{const A=local(a),B=local(b),out=[];for(let k=from;k<=8;k++)out.push(A.clone().lerp(B,k/8));for(const f of fingers)out.push(local(f));return out};
 const FINGERS=s=>['Wrist','Index1','Index2','Index3','Middle1','Middle2','Middle3','Ring2','Pinky2','Thumb2'].map(n=>n+s);
 // Walk a few steps (the Walk clip is playing), measure, stop, measure again.
 const walkAndStop=measure=>{key('KeyW');pump(.8);const walking=measure('walking');key('KeyW','keyup');pump(1.2);const standing=measure('standing');return {walking,standing}};

 // ── A log, picked up with E ──
 {GameState.progress.carry=null;GameState.progress.logs=[{id:1,x:me.x+.5,z:me.z+.5,rot:0,t:0}];pump(.5);
  const before=GameState.progress.carry;assert.equal(before,null,'nothing carried before the pick-up');key('KeyE');key('KeyE','keyup');pump(1.5);
  assert.deepEqual(GameState.progress.carry,{kind:'log'},'E picked the log up (the real interaction)');
  const logObj=person.getObjectByName('carried-log');assert(logObj.visible,'the carried log is drawn');
  const mesh=logObj.children[0];mesh.geometry.computeBoundingBox();const gs=mesh.geometry.boundingBox.getSize(new THREE.Vector3()),length=Math.max(gs.x,gs.y,gs.z),radius=Math.min(gs.y,gs.z)/2;
  const measure=when=>{const axis=logObj.position.clone(),head=local('Head'),neck=local('Neck'),chest=local('Chest'),dist=p=>Math.abs(p.z-axis.z)<length/2?Math.hypot(p.x-axis.x,p.y-axis.y)-radius:1;
   const knuckle=local('Middle1R'),gap=dist(knuckle),pts=along('LowerArmR','WristR',FINGERS('R'),2) /* the elbow itself sits against the log on the shoulder; the rest of the forearm and the hand must be clear */,through=-Math.min(0,...pts.map(dist)),r=local('WristR');
   if(process.env.POSE_DEBUG)for(const n of ['UpperArmR','LowerArmR','WristR','Index1R','Index3R','Middle1R','Middle3R','Thumb2R','Pinky2R'])console.log('     ',n,'bark distance',dist(local(n)).toFixed(3),'at',Object.values(local(n)).slice(0,3).map(v=>v.toFixed(2)).join(','));
   // the log's own point nearest the head or neck, measured along the axis: the axis passes the neck at this distance (the bark is `radius` nearer)
   const nearAxis=p=>{const c=Math.max(axis.z-length/2,Math.min(axis.z+length/2,p.z));return Math.hypot(p.x-axis.x,p.y-axis.y,p.z-c)};
   const info={axisY:axis.y,top:axis.y+radius,headY:head.y,neckY:neck.y,chestY:chest.y,fromHead:nearAxis(head)-radius,fromNeck:nearAxis(neck)-radius,gap,through,wristZ:r.z,wristY:r.y,worldTop:worldY('Head')-(head.y-(axis.y+radius))};
   console.log(`  log ${when}: axis y ${info.axisY.toFixed(2)} (head ${info.headY.toFixed(2)}, neck ${info.neckY.toFixed(2)}, chest ${info.chestY.toFixed(2)}); bark ${info.fromHead.toFixed(2)} m from the head joint, ${info.fromNeck.toFixed(2)} m from the neck; right knuckles ${info.gap.toFixed(3)} m from the bark, deepest overlap ${info.through.toFixed(3)} m; wrist at y ${r.y.toFixed(2)} z ${r.z.toFixed(2)}`);
   assert(info.top<info.headY-.05,`${when}: the log rests below the chin (top ${info.top.toFixed(2)}, head joint ${info.headY.toFixed(2)})`);
   assert(info.axisY<info.neckY-.05,`${when}: the log's middle is below the neck (axis ${info.axisY.toFixed(2)}, neck ${info.neckY.toFixed(2)})`);
   assert(info.fromHead>.1&&info.fromNeck>.05,`${when}: the log is clear of the head and neck (${info.fromHead.toFixed(2)} / ${info.fromNeck.toFixed(2)} m)`);
   assert(info.gap>-.03&&info.gap<.07,`${when}: the near hand is on the log's surface, not down at the belly (${info.gap.toFixed(3)} m from the bark)`);
   assert(info.through<.02,`${when}: nothing of the arm or hand is inside the log (${info.through.toFixed(3)} m)`);
   assert(r.y>chest.y-.45,`${when}: the wrist is up at the log, not at the belly (wrist y ${r.y.toFixed(2)}, chest ${chest.y.toFixed(2)})`);return info};
  measure('log, just picked up');walkAndStop(measure);
  key('KeyX');pump(1.5);assert.equal(GameState.progress.carry,null,'X put the log down');pump(.5)}

 // ── A stack of planks, picked up with E ──
 {GameState.progress.logs=[];GameState.progress.carry=null;Object.assign(me,{x:1,y:.02,z:-5.4});GameState.me.rotation.y=0;pump(.3);const sx=1,sz=-4.4;GameState.progress.plankDrops=[{id:1,x:sx,z:sz,count:4,q:0}];pump(1);if(process.env.POSE_DEBUG)console.log('   ground-planks',globalThis.__renderScene.getObjectByName('ground-planks')?.count,'drops',JSON.stringify(GameState.progress.plankDrops),'me',me.x.toFixed(1),me.z.toFixed(1),'stack',sx.toFixed(1),sz.toFixed(1));
  if(process.env.POSE_DEBUG)console.log('   ground-planks',globalThis.__renderScene.getObjectByName('ground-planks')?.count,'drops',JSON.stringify(GameState.progress.plankDrops),'me',me.x.toFixed(2),me.z.toFixed(2),'carry',JSON.stringify(GameState.progress.carry),'putting?');
  key('KeyE');key('KeyE','keyup');pump(1.5);assert.deepEqual(GameState.progress.carry,{kind:'planks',count:4},'E picked the stack up (the real interaction)');
  const stackObj=person.getObjectByName('carried-planks');assert(stackObj.visible,'the carried stack is drawn');
  const measure=when=>{person.updateMatrixWorld(true);const box=new THREE.Box3();
   stackObj.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z])box.expandByPoint(person.worldToLocal(new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld)))});
   const depth=p=>box.containsPoint(p)?Math.min(p.x-box.min.x,box.max.x-p.x,p.y-box.min.y,box.max.y-p.y,p.z-box.min.z,box.max.z-p.z):-box.distanceToPoint(p);
   const head=local('Head'),neck=local('Neck'),hips=local('Hips'),chest=local('Chest');
   const per={};let through=-1e9;for(const s of ['R','L']){const pts=along('LowerArm'+s,'Wrist'+s,FINGERS(s));through=Math.max(through,...pts.map(depth));per[s]=box.distanceToPoint(local('Wrist'+s))}
   const size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
   console.log(`  planks ${when}: boards y ${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}, x ${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}, z ${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)} (hips ${hips.y.toFixed(2)}, chest ${chest.y.toFixed(2)}, neck ${neck.y.toFixed(2)}, head ${head.y.toFixed(2)}); wrists ${per.R.toFixed(3)} / ${per.L.toFixed(3)} m from the boards; deepest overlap ${Math.max(0,through).toFixed(3)} m; head ${box.distanceToPoint(head).toFixed(2)} m, neck ${box.distanceToPoint(neck).toFixed(2)} m away`);
   assert(size.x>size.z*2,`${when}: the stack is carried crosswise (${size.x.toFixed(2)} wide, ${size.z.toFixed(2)} deep)`);
   assert(box.min.y>hips.y+.05&&box.max.y<head.y+.05,`${when}: the stack is at chest height (${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}; hips ${hips.y.toFixed(2)}, head joint ${head.y.toFixed(2)})`);
   assert(Math.abs(centre.x)<.1&&box.min.z>.1,`${when}: in front of the body, centred (x ${centre.x.toFixed(2)}, back edge ${box.min.z.toFixed(2)})`);
   assert(per.R<.09&&per.L<.09,`${when}: both wrists are at the stack (${per.R.toFixed(3)} / ${per.L.toFixed(3)} m)`);
   assert(through<.025,`${when}: no hand or forearm goes into the boards (${through.toFixed(3)} m)`);
   assert(box.distanceToPoint(head)>.12&&box.distanceToPoint(neck)>.05,`${when}: the stack is clear of the head and neck`);
   const wl=local('WristL'),wr=local('WristR');assert(wl.y<box.min.y+.12&&wr.y<box.min.y+.12,`${when}: both hands are under the stack (wrists y ${wl.y.toFixed(2)} / ${wr.y.toFixed(2)}, bottom ${box.min.y.toFixed(2)})`)};
  measure('planks, just picked up');walkAndStop(measure);
  key('KeyX');pump(1.5);assert.equal(GameState.progress.carry,null,'X put the stack down')}
}finally{await rm(dir,{recursive:true,force:true})}
console.log('Carry through the real interaction (E beside a log or a stack, a few steps, stop): the log rests on the shoulder below the chin with the near hand on it, nothing through the bark; the planks are crosswise at chest height with both hands under them, nothing through the boards; measured walking and standing.');
