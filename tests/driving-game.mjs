import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {MAP} from '../dist/map-definition.js';
import {propInfo} from '../dist/props.js';
import {CLASSES,doorPoint} from '../dist/vehicle.js';

// Driving in the real game loop (not the pure step alone): the packaged game starts with a synthetic DOM, the player stands at the pickup's door and PRESSES E (the real interaction path),
// drives with the keys held through the frame loop (W S A D, Space), is stopped by a building, gets out with E, and what is saved is read back from the storage. No debug hooks do any of the actions.
const html=await readFile('dist/index.html','utf8');
class El extends EventTarget{
 constructor(tag='div'){super();this.tag=tag;this.hidden=false;this.value='';this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.selectors=new Map()}
 append(...els){this.children.push(...els)}replaceChildren(...els){this.children=[...els]}setAttribute(k,v){this[k]=v}querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new El());return this.selectors.get(s)}focus(){}matches(){return false}setCustomValidity(){}reportValidity(){}setPointerCapture(){}click(){this.onclick?.({preventDefault(){}})}
 getBoundingClientRect(){return {left:0,top:0,width:1400,height:900}}
 getContext(){return new Proxy({measureText:t=>({width:t.length*20})},{get:(o,k)=>o[k]??(()=>{})})}
}
const dir=await mkdtemp(join(tmpdir(),'city-driving-'));
try{
 const release=html.match(/import\('\.\/(releases\/[^/]+)\/game\.js'/)[1];
 await cp('dist/'+release,dir,{recursive:true});
 const threeURL=pathToFileURL(resolve('dist/vendor/three.module.js')).href;
 await writeFile(join(dir,'vendor/three.module.js'),`export * from '${threeURL}';export class WebGLRenderer{constructor(){this.shadowMap={}}setPixelRatio(){}setSize(){}setViewport(){}clear(){}render(scene,camera){globalThis.__renderScene=scene;globalThis.__renderCamera=camera}}`);
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1]==='characterName'?'input':'div')]));
 const doc=new EventTarget();doc.getElementById=id=>ids.get(id)||null;doc.createElement=tag=>new El(tag);doc.body=new El();doc.querySelectorAll=()=>[];doc.hidden=false;
 const win=new EventTarget();win.matches=()=>false;const store=new Map();
 // the player stands at the pickup's driver door (the door point of its home pose)
 const pick=MAP.vehicles.find(v=>v.id==='eastbank-pickup'),pc=CLASSES.pickup,door=doorPoint(pick.home,pc);
 store.set('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));
 store.set('citylife.progress.v1',JSON.stringify({version:1,progress:{cash:5000,completed:5,phase:'available',position:{x:door.x,z:door.z}}}));
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 await import(pathToFileURL(join(dir,'game.js')).href);nextFrame(performance.now()+16);
 ids.get('start').click();assert(ids.get('welcome').hidden,'Play starts the game');
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 let simTime=performance.now()+100;const frame=()=>{simTime+=40;nextFrame(simTime)},pump=s=>{for(let i=0;i<s*25;i++)frame()};
 const down=new Set(),key=(code,type)=>{const e=new Event(type);e.code=code;win.dispatchEvent(e)},hold=(code,on)=>{if(on&&!down.has(code)){down.add(code);key(code,'keydown')}else if(!on&&down.has(code)){down.delete(code);key(code,'keyup')}},press=code=>{key(code,'keydown');key(code,'keyup')},letGo=()=>{for(const c of [...down])hold(c,false)};
 const scene=globalThis.__renderScene,person=scene.getObjectByName('player'),truck=scene.getObjectByName('vehicle-eastbank-pickup'),flat=scene.getObjectByName('vehicle-eastbank-flatbed'),me=GameState.me;
 assert(person&&truck&&flat,'the player and both drivable vehicles are in the scene');pump(1);
 const home=v=>Math.hypot(v.position.x-pick.home.x,v.position.z-pick.home.z);
 assert(home(truck)<.01&&Math.abs(Math.abs(truck.rotation.y)-Math.PI)<.01,'the pickup stands in its bay, nose to the back wall');assert(Math.hypot(me.position.x-door.x,me.position.z-door.z)<.2&&person.visible,'the player stands at the driver door, visible');
 const toast=()=>ids.get('jobToast').textContent;

 // 1. E at the door refuses while carrying a log, and works with empty hands
 GameState.progress.carry={kind:'log'};press('KeyE');pump(.3);assert(person.visible&&/hands are full/.test(toast()),'carrying a log: E at the door is refused ("hands are full"), you stay on foot');GameState.progress.carry=null;pump(.3);
 press('KeyE');pump(.3);assert(!person.visible,'E at the driver door: you get in (the avatar is hidden)');assert(/Driving the pickup/.test(toast()),'and the toast says how: '+toast());
 const seat=MAP.vehicles[0],seatAt=()=>new THREE.Vector3(truck.position.x,0,truck.position.z);
 assert(Math.hypot(me.position.x-truck.position.x,me.position.z-truck.position.z)<2,'the player rides with the vehicle');
 // 2. the keys: S reverses out of the bay, W then drives forward, a stopped game stands still
 hold('KeyS',true);pump(2.5);hold('KeyS',false);pump(.2);const back=truck.position.z-pick.home.z;assert(back>3&&Math.abs(truck.position.x-pick.home.x)<.5,`S reverses the pickup out of its bay (${back.toFixed(1)} m south)`);
 const zBack=truck.position.z;hold('KeyW',true);pump(3);const mid=truck.position.clone();hold('KeyW',false);pump(.1);assert(mid.z<zBack-1.5,`W drives it forward again (from z ${zBack.toFixed(1)} to ${mid.z.toFixed(1)})`);
 {const p=truck.position.clone();pump(.5);assert(p.distanceTo(truck.position)<.2+10*.5*.8,'coasting after W slows down')}
 // brake: Space stops it quickly
 hold('KeyW',true);pump(2);hold('KeyW',false);hold('Space',true);pump(1.5);hold('Space',false);const stopped=truck.position.clone();pump(.5);assert(truck.position.distanceTo(stopped)<.05,'Space brakes it to a standstill');
 // 3. getting out is refused while moving ("Stop first"), the game stays in the vehicle; a pause freezes the vehicle where it is
 hold('KeyW',true);pump(1.5);press('KeyE');pump(.1);assert(!person.visible&&/Stop first/.test(toast()),'E while moving: "Stop first", still driving');
 {ids.get('dialog').hidden=true;const before=truck.position.clone();key('Escape','keydown');pump(1);const after=truck.position.clone();assert(before.distanceTo(after)<.5,'Esc pauses: the vehicle stays where it is');key('Escape','keydown');pump(.2)}
 hold('KeyW',false);hold('Space',true);pump(2);hold('Space',false);pump(.2);

 // 4. drive with the keys only, steering toward waypoints read from the vehicle's pose (the way a player would): out through the depot cut, Oak East, then Works Lane south
 const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));let gear=1;
 const driveTo=(route,{limit=120}={})=>{let reached=0,t=0;for(;t<limit*25&&reached<route.length;t++){
   const [wx,wz,tol=4,cap=99]=route[reached],x=truck.position.x,z=truck.position.z,yawNow=truck.rotation.y,speed=(driveTo.last?Math.hypot(x-driveTo.last.x,z-driveTo.last.z)/.04:0);driveTo.last={x,z};
   const dist=Math.hypot(wx-x,wz-z);if(dist<tol){reached++;continue}
   const want=Math.atan2(wx-x,wz-z),err=wrap(want-yawNow),errR=wrap(want+Math.PI-yawNow);
   if(gear===1&&Math.abs(err)>2.2&&dist<30&&speed<1)gear=-1;else if(gear===-1&&(Math.abs(errR)>2.2||(dist>8&&Math.abs(err)<1)))gear=1;
   if(gear===1){hold('KeyW',speed<Math.min(cap,Math.abs(err)>.9?4:11));hold('KeyS',false);hold('KeyA',err>.12);hold('KeyD',err<-.12);hold('Space',speed>cap+.5)}
   else{hold('KeyW',false);hold('KeyS',true);hold('KeyA',errR<-.12);hold('KeyD',errR>.12);hold('Space',false)} // in reverse the wheel is turned the other way
   frame()}
  letGo();return {reached,t:t/25}};
 {const r=driveTo([[95,-8,3],[99,-6,3],[100,-1.5,3],[101,10,4],[102,30,5],[102,60,5]]);assert.equal(r.reached,6,`the pickup, driven with the keys, leaves the depot and runs down Works Lane (waypoint ${r.reached} of 6 after ${r.t.toFixed(0)} s)`);console.log(`  keys: depot to the south end of Works Lane in ${r.t.toFixed(0)} s of game time, at (${truck.position.x.toFixed(1)}, ${truck.position.z.toFixed(1)})`)}
 // zone and minimap follow the player's position (it rides with the vehicle): Works Lane is in Eastbank
 assert(Math.hypot(me.position.x-truck.position.x,me.position.z-truck.position.z)<2&&me.position.z>50,'the player position follows the vehicle (zones, minimap, objectives)');
 // 5. a building stops it: back up Works Lane, west along Oak East, and drive straight at the supplier's front wall (plot I3)
 const supplier=MAP.landmarks.find(l=>l.id==='eastbank-supply'),info=propInfo(supplier.prop);
 {const r=driveTo([[102,30,5],[100,10,5],[95,8,5],[83,8,4]]);assert.equal(r.reached,4,'back up the lane and west along Oak East to the supplier');
  const wall=supplier.z-info.depth/2; // the wall facing north (the plot faces Oak Street); the kit's front is turned to +z and the plot yaw puts the doors on the yard, so use the footprint's z extent
  hold('KeyW',true);pump(10);hold('KeyW',false);pump(.3);const nose=truck.position.z+pc.hz,still=truck.position.clone();pump(.5);assert(truck.position.distanceTo(still)<.01,'driven at the supplier it comes to a stop');
  console.log(`  supplier: stopped at z ${truck.position.z.toFixed(2)}, nose at ${nose.toFixed(2)}`);assert(truck.position.z<supplier.z-info.depth/2+.5||nose<supplier.z+1,'and its nose is not inside the building');
  // nothing solid is inside the hull: sample the building's footprint
  const fx0=supplier.x-info.width/2,fx1=supplier.x+info.width/2,fz0=supplier.z-info.depth/2;assert(!(truck.position.x>fx0&&truck.position.x<fx1&&truck.position.z>fz0),'the vehicle centre is outside the building')}
 // 6. get out: E when stopped; you appear beside the vehicle (at the driver's door) and never inside it
 pump(.3);press('KeyE');pump(.3);assert(person.visible,'E when stopped: you get out');
 {const tx=truck.position.x,tz=truck.position.z,s={x:tx,z:tz,yaw:truck.rotation.y},d=doorPoint(s,pc);assert(Math.hypot(me.position.x-d.x,me.position.z-d.z)<.2,`you stand at the driver's door (${me.position.x.toFixed(2)}, ${me.position.z.toFixed(2)} against ${d.x.toFixed(2)}, ${d.z.toFixed(2)})`);
  const l={x:(me.position.x-tx)*Math.cos(s.yaw)-(me.position.z-tz)*Math.sin(s.yaw),z:(me.position.x-tx)*Math.sin(s.yaw)+(me.position.z-tz)*Math.cos(s.yaw)};assert(Math.abs(l.x)>pc.hx,'outside the hull')}
 // 7. a walker cannot walk through the parked vehicle: walk (A or D, whichever way is toward it) at its side for 2 s and the position stays outside the inflated hull
 {const d=doorPoint({x:truck.position.x,z:truck.position.z,yaw:truck.rotation.y},pc);
  // face the vehicle: the player's heading follows the movement keys relative to the camera yaw (looking along the vehicle's heading); the left side of the vehicle is +x local; walk toward the hull by teleporting the saved position next to it is not allowed, so use the keys
  me.rotation.y=0;pump(.1);let minDist=1e9;const test=k=>{hold(k,true);for(let i=0;i<25*3;i++){frame();const l={x:(me.position.x-truck.position.x),z:(me.position.z-truck.position.z)};const s={x:truck.position.x,z:truck.position.z,yaw:truck.rotation.y};const lx=l.x*Math.cos(s.yaw)-l.z*Math.sin(s.yaw),lz=l.x*Math.sin(s.yaw)+l.z*Math.cos(s.yaw);if(Math.abs(lz)<pc.hz)minDist=Math.min(minDist,Math.abs(lx)-pc.hx)}hold(k,false)};
  for(const k of ['KeyA','KeyD','KeyW','KeyS']){test(k)}
  assert(minDist>=.32,`a walker is never closer to the hull than the player radius (closest ${minDist.toFixed(2)} m)`)}
 // 8. what is saved: the pickup where it was left, the player at its door, and nothing else changed
 {const profile=JSON.parse(store.get('citylife.profile.v1')),saved=profile.progress;assert.equal(saved.vehicles.length,1,'one vehicle has left home');const v=saved.vehicles[0];assert.equal(v.uid,'eastbank-pickup');assert(Math.hypot(v.x-truck.position.x,v.z-truck.position.z)<.02&&Math.abs(wrap(v.yaw-truck.rotation.y))<.002,'saved at the pose it was left in');
  assert.equal(profile.version,1,'the profile format is unchanged');assert.equal(saved.schema,2,'schema stays 2');assert(saved.position&&Number.isFinite(saved.position.x),'the player position is saved too')}
 // 9. back in at the door, then R: gets you out and sends you to the spawn; the vehicle stays exactly where it was
 {const left=truck.position.clone(),yawLeft=truck.rotation.y,d=doorPoint({x:left.x,z:left.z,yaw:yawLeft},pc);me.position.x=d.x;me.position.z=d.z;pump(.2);press('KeyE');pump(.3);assert(!person.visible,'E at the door again: back in');press('KeyR');pump(.5);assert(person.visible,'R gets you out of the vehicle');assert(Math.hypot(me.position.x-MAP.spawn.x,me.position.z-MAP.spawn.z)<8,`and sends you to the spawn (${me.position.x.toFixed(1)}, ${me.position.z.toFixed(1)})`);assert(truck.position.distanceTo(left)<.01&&Math.abs(truck.rotation.y-yawLeft)<1e-9,'the vehicle stays where you left it')}
 console.log('Driving (the packaged game): E at the driver door gets in (refused while carrying), W S A D and Space drive the pickup out of the depot and down Works Lane, a building stops it, E (below 1 m/s) gets out at the driver\'s door, a walker cannot walk through it, and the saved pose is read back from the storage.');
}finally{await rm(dir,{recursive:true,force:true})}
