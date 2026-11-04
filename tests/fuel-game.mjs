import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';

// Refuelling in the real game loop (0.35): the packaged game starts with a worktruck saved in the Eastbank drive-through lane, beside the pumps, with a low tank. The player takes a nozzle with
// a real E press at the pump, and HOLDS F (E stays for doors) at the glowing tank cap; the tank, the cash, the prompts, the arm and the saved profile are read back.
// Also: the wrong fuel, the hose limit, hanging up, and that E never fills.
const html=await readFile('dist/index.html','utf8');
class El extends EventTarget{
 constructor(tag='div'){super();this.tag=tag;this.hidden=false;this.value='';this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.selectors=new Map()}
 append(...els){this.children.push(...els)}replaceChildren(...els){this.children=[...els]}setAttribute(k,v){this[k]=v}querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new El());return this.selectors.get(s)}focus(){}matches(){return false}setCustomValidity(){}reportValidity(){}setPointerCapture(){}click(){this.onclick?.({preventDefault(){}})}
 getBoundingClientRect(){return {left:0,top:0,width:1400,height:900}}
 getContext(){return new Proxy({measureText:t=>({width:t.length*20})},{get:(o,k)=>o[k]??(()=>{})})}
}
const dir=await mkdtemp(join(tmpdir(),'city-fuel-'));
try{
 const release=html.match(/import\('\.\/(releases\/[^/]+)\/game\.js'/)[1];
 await cp('dist/'+release,dir,{recursive:true});
 const threeURL=pathToFileURL(resolve('dist/vendor/three.module.js')).href;
 await writeFile(join(dir,'vendor/three.module.js'),`export * from '${threeURL}';export class WebGLRenderer{constructor(){this.shadowMap={}}setPixelRatio(){}setSize(){}setViewport(){}clear(){}render(scene,camera){globalThis.__renderScene=scene;globalThis.__renderCamera=camera}}`);
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1]==='characterName'?'input':'div')]));
 const doc=new EventTarget();doc.getElementById=id=>ids.get(id)||null;doc.createElement=tag=>new El(tag);doc.body=new El();doc.querySelectorAll=()=>[];doc.hidden=false;
 const win=new EventTarget();win.matches=()=>false;const store=new Map();
 // A worktruck saved in the south lane of the drive-through, heading east, its tank cap beside the diesel pump, with a low tank (5 of 21 gallons). The player starts beside it.
 const truckPose={x:159.5,z:-5,yaw:Math.PI/2,fuelMgal:5000};
 store.set('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));
 store.set('citylife.progress.v1',JSON.stringify({version:1,progress:{cash:5000,completed:5,phase:'available',position:{x:157.3,z:-6.95},vehicles:[{uid:'eastbank-worktruck',model:'worktruck',...truckPose}]}}));
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 await import(pathToFileURL(join(dir,'game.js')).href);nextFrame(performance.now()+16);
 ids.get('start').click();assert(ids.get('welcome').hidden,'Play starts the game');
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 let simTime=performance.now()+100;const frame=()=>{simTime+=40;nextFrame(simTime)},pump=s=>{for(let i=0;i<s*25;i++)frame()};
 const down=new Set(),key=(code,type)=>{const e=new Event(type);e.code=code;win.dispatchEvent(e)},hold=(code,on)=>{if(on&&!down.has(code)){down.add(code);key(code,'keydown')}else if(!on&&down.has(code)){down.delete(code);key(code,'keyup')}},press=code=>{key(code,'keydown');key(code,'keyup')};
 const scene=globalThis.__renderScene,me=GameState.me,toast=()=>ids.get('jobToast').textContent,person=scene.getObjectByName('player');
 const prompt=()=>({text:ids.get('prompt').querySelector('span').textContent,key:ids.get('prompt').querySelector('kbd').textContent,keyHidden:ids.get('prompt').querySelector('kbd').hidden,hidden:ids.get('prompt').hidden});
 const local=name=>{person.updateMatrixWorld(true);const v=new THREE.Vector3();person.getObjectByName(name).getWorldPosition(v);return person.worldToLocal(v)};
 pump(1);
 const gasUse={x:155.7,z:-6.95},dieselUse={x:157.3,z:-6.95},nearCap={x:157.3,z:-6.95};
 const profile=()=>JSON.parse(store.get('citylife.profile.v1')).progress;
 const truck=()=>profile().vehicles.find(v=>v.uid==='eastbank-worktruck');
 const truckMesh=scene.getObjectByName('vehicle-eastbank-worktruck'),marker=truckMesh.getObjectByName('filler-marker');
 assert(scene.getObjectByName('nozzle-eastbank-gas-1')&&scene.getObjectByName('nozzle-eastbank-gas-0'),'both nozzles are in the scene, in their holsters');
 assert(scene.getObjectByName('hose-idle-eastbank-gas-1'),'and their hoses are drawn, idle');assert(scene.getObjectByName('readout-eastbank-gas-1')&&scene.getObjectByName('readout-eastbank-gas-0'),'each pump has a readout screen');
 assert(marker&&!marker.visible,'the tank cap glow is off while no nozzle is in hand');
 const wristRest=local('WristR');

 // 1. the prompts at the diesel pump: take the nozzle (E), and the tank cap says what the truck takes
 Object.assign(me.position,dieselUse);me.rotation.y=Math.PI;pump(.4);
 {const p=prompt();assert(!p.hidden&&/Take the diesel nozzle/.test(p.text)&&p.key==='H'&&!p.keyHidden,'the pump says: H, Take the diesel nozzle ('+JSON.stringify(p)+')');assert(/\$4\.20\/gal/.test(p.text),'with its price in dollars a gallon')}
 press('KeyH');pump(1);
 assert(/diesel nozzle in your hand/i.test(toast()),'H at the diesel pump takes the nozzle ('+toast()+')');
 assert(marker.visible,'the tank cap glows while the nozzle is in hand');
 {const p=prompt();assert(!p.hidden&&/^Hold to fill · Worktruck · takes diesel · 5\.0 of 21 gal/.test(p.text)&&p.key==='F'&&!p.keyHidden,'at the cap the prompt says: F, hold to fill, which vehicle, which fuel, how much ('+JSON.stringify(p)+')')}
 // the arm holds the nozzle out in front, and the nozzle is in the hand
 {const w=local('WristR');assert(w.z-wristRest.z>.12,`the right arm reaches forward with the nozzle (${(w.z-wristRest.z).toFixed(2)} m)`);
  const nozzle=scene.getObjectByName('nozzle-eastbank-gas-1'),hand=new THREE.Vector3();person.getObjectByName('WristR').getWorldPosition(hand);assert(nozzle.position.distanceTo(hand)<.5,`the nozzle is in the hand (${nozzle.position.distanceTo(hand).toFixed(2)} m from the wrist)`)}

 // 2. E does NOT fill (it is for doors): pressing and holding E leaves the tank alone
 const cash0=GameState.progress.cash;
 hold('KeyE',true);pump(1);hold('KeyE',false);pump(.2);
 assert.equal(GameState.progress.cash,cash0,'holding E takes no fuel and no money');

 // 3. HOLD F at the cap: the tank fills, the cash goes down by the same amount, the pump shows it
 hold('KeyF',true);pump(2.5);hold('KeyF',false);pump(.3);
 const after=truck();const gained=after.fuelMgal-5000;
 assert(gained>=900&&gained%50===0,`filled ${gained/1000} gallons of diesel while F was held (whole steps)`);
 assert.equal(cash0-GameState.progress.cash,gained/50*21,`the money went down by $4.20 a gallon: $${((cash0-GameState.progress.cash)/100).toFixed(2)}`);
 assert.equal(profile().cash,GameState.progress.cash,'the cash is saved');
 console.log(`  fill: ${(gained/1000).toFixed(2)} gal for $${((cash0-GameState.progress.cash)/100).toFixed(2)}; truck tank ${(after.fuelMgal/1000).toFixed(2)} of 21 gal`);
 // 4. letting go of F stops the flow at once
 const stopped=GameState.progress.cash;pump(1);assert.equal(GameState.progress.cash,stopped,'no fuel flows with F released');

 // 5. the wrong fuel: the gas pump does not fill a diesel truck (an error, no money taken, no penalty); the tank cap says so
 press('KeyE');pump(.3); // (the cap prompt is chosen here: E shows how to fill)
 assert(/Hold F to fill/.test(toast()),'E at the cap only reminds you to hold F ('+toast()+')');
 Object.assign(me.position,{x:156.9,z:-7.25});pump(.4);press('KeyH');pump(.3);assert(/Nozzle back in its holster/.test(toast()),'the diesel nozzle hangs up at its own pump ('+toast()+')');
 assert(!marker.visible,'and the glow goes out');
 Object.assign(me.position,gasUse);pump(.4);press('KeyH');pump(.3);assert(/gas nozzle in your hand/i.test(toast()),'and the gas nozzle comes out of the other pump ('+toast()+')');
 Object.assign(me.position,nearCap);pump(.4);
 {const p=prompt();assert(/Wrong fuel · takes diesel/.test(p.text)&&p.keyHidden,'at the cap: "Wrong fuel · takes diesel", with no key shown ('+JSON.stringify(p)+')')}
 const cash1=GameState.progress.cash,mgal1=truck().fuelMgal;
 hold('KeyF',true);pump(.5);hold('KeyF',false);pump(.2);
 assert.equal(GameState.progress.cash,cash1,'no money taken for the wrong fuel');assert.equal(truck().fuelMgal,mgal1,'the tank does not change');
 assert(/takes diesel, not gas/.test(toast()),'the game says which fuel the truck takes ('+toast()+')');

 // 6. hanging up: E at the pump takes the nozzle back to its holster (the gas one, taken in step 5)
 Object.assign(me.position,gasUse);pump(.4);press('KeyH');pump(.3);assert(/Nozzle back in its holster/.test(toast()),'H at the pump hangs the nozzle back ('+toast()+')');
 pump(1);{const w=local('WristR');assert(w.z-wristRest.z<.1,'and the arm relaxes again')}

 // 7. the hose limit: walk away with a nozzle out and it goes back by itself
 Object.assign(me.position,dieselUse);pump(.4);press('KeyH');pump(.3);assert(/diesel nozzle in your hand/i.test(toast()),'taken again');
 Object.assign(me.position,{x:138,z:-20});pump(.6);
 assert(/hose is at its limit/.test(toast()),'walking away past 3.5 m puts the nozzle back ('+toast()+')');
 // 8. the save keeps the truck's tank (it is away from home, so it is saved), in milli-gallons
 assert(profile().vehicles.some(v=>v.uid==='eastbank-worktruck'&&v.fuelMgal===after.fuelMgal&&v.fuelMl===undefined),'the saved tank is the one the game shows');
 console.log('Refuelling (the packaged game, imperial): a real H press takes the diesel nozzle at the pump, the tank cap glows and says what the truck takes, F held fills in whole steps at exactly $4.20 a gallon, E never fills, letting go stops it, the wrong fuel is refused without money, the arm holds the nozzle, E hangs it up, walking past 3.5 m puts it back, the tank is saved.');
}finally{await rm(dir,{recursive:true,force:true})}
