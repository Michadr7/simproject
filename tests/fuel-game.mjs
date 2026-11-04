import {mkdtemp,readFile,writeFile,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';

// Refuelling in the real game loop: the packaged game starts with a worktruck saved beside the Eastbank pumps with a low tank. The player takes a nozzle with a real E press at the
// pump, walks to the filler and HOLDS E (held keys through the frame loop), and the tank, the cash and the saved profile are read back. Also: the wrong fuel, the hose limit, hanging up.
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
 // A worktruck saved beside the Eastbank pumps (its home is far away), with a tank at 5 L of 80
 const truckPose={x:158.5,z:-12.8,yaw:Math.PI,fuelMl:5000};
 store.set('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Tester'}}));
 store.set('citylife.progress.v1',JSON.stringify({version:1,progress:{cash:5000,completed:5,phase:'available',position:{x:156.6,z:-10.6},vehicles:[{uid:'eastbank-worktruck',model:'worktruck',...truckPose}]}}));
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 await import(pathToFileURL(join(dir,'game.js')).href);nextFrame(performance.now()+16);
 ids.get('start').click();assert(ids.get('welcome').hidden,'Play starts the game');
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 let simTime=performance.now()+100;const frame=()=>{simTime+=40;nextFrame(simTime)},pump=s=>{for(let i=0;i<s*25;i++)frame()};
 const down=new Set(),key=(code,type)=>{const e=new Event(type);e.code=code;win.dispatchEvent(e)},hold=(code,on)=>{if(on&&!down.has(code)){down.add(code);key(code,'keydown')}else if(!on&&down.has(code)){down.delete(code);key(code,'keyup')}},press=code=>{key(code,'keydown');key(code,'keyup')};
 const scene=globalThis.__renderScene,me=GameState.me,toast=()=>ids.get('jobToast').textContent;
 pump(1);
 const petrolUse={x:155.7,z:-9.55},dieselUse={x:157.3,z:-9.55},filler={x:156.6,z:-10.6};
 const profile=()=>JSON.parse(store.get('citylife.profile.v1')).progress;
 const truck=()=>profile().vehicles.find(v=>v.uid==='eastbank-worktruck');
 assert(scene.getObjectByName('nozzle-eastbank-gas-1')&&scene.getObjectByName('nozzle-eastbank-gas-0'),'both nozzles are in the scene, in their holsters');
 assert(scene.getObjectByName('hose-idle-eastbank-gas-1'),'and their hoses are drawn, idle');

 // 1. at the diesel pump, E takes the diesel nozzle (a real press at the use spot)
 Object.assign(me.position,dieselUse);pump(.3);press('KeyE');pump(.2);
 assert(/diesel nozzle in your hand/.test(toast()),'E at the diesel pump takes the nozzle ('+toast()+')');
 // 2. walk to the filler (beside the truck's tank cap) and HOLD E: the tank fills, the cash goes down by the same amount
 me.rotation.y=Math.PI/2;Object.assign(me.position,filler);pump(.3);
 const cash0=GameState.progress.cash;
 hold('KeyE',true);pump(2.5);hold('KeyE',false);pump(.3);
 const after=truck();const gained=after.fuelMl-5000;
 assert(gained>=3000&&gained%100===0,`filled ${gained/1000} L of diesel while E was held (whole steps)`);
 assert.equal(cash0-GameState.progress.cash,gained/100*21,`the money went down by $2.10 a litre: ${(cash0-GameState.progress.cash)/100} dollars`);
 assert.equal(profile().cash,GameState.progress.cash,'the cash is saved');
 console.log(`  fill: ${(gained/1000).toFixed(1)} L for $${((cash0-GameState.progress.cash)/100).toFixed(2)}; truck tank ${(after.fuelMl/1000).toFixed(1)} L`);

 // 3. letting go of E stops the flow at once
 const stopped=GameState.progress.cash;pump(1);assert.equal(GameState.progress.cash,stopped,'no fuel flows with E released');

 // 4. the wrong fuel: the petrol pump does not fill a diesel truck (an error, no money taken, no penalty)
 Object.assign(me.position,dieselUse);pump(.3);press('KeyE');pump(.2);assert(/Nozzle back in its holster/.test(toast()),'the diesel nozzle hangs up at its own pump ('+toast()+')');
 Object.assign(me.position,petrolUse);pump(.3);press('KeyE');pump(.2);assert(/petrol nozzle in your hand/.test(toast()),'and the petrol nozzle comes out of the other pump ('+toast()+')');
 Object.assign(me.position,filler);pump(.3);
 const cash1=GameState.progress.cash,ml1=truck().fuelMl;
 press('KeyE');pump(.2);
 hold('KeyE',true);pump(.5);hold('KeyE',false);pump(.2);
 assert.equal(GameState.progress.cash,cash1,'no money taken for the wrong fuel');assert.equal(truck().fuelMl,ml1,'the tank does not change');
 assert(/takes diesel, not petrol/.test(toast()),'the game says which fuel the truck takes ('+toast()+')');

 // 5. hanging up: E at the pump takes the nozzle back to its holster
 Object.assign(me.position,petrolUse);pump(.3);press('KeyE');pump(.2);
 assert(/Nozzle back in its holster/.test(toast()),'E at the pump hangs the nozzle back ('+toast()+')');

 // 6. the hose limit: walk away with a nozzle out and it goes back by itself
 Object.assign(me.position,dieselUse);pump(.3);press('KeyE');pump(.2);assert(/diesel nozzle in your hand/.test(toast()),'taken again');
 Object.assign(me.position,{x:138,z:-20});pump(.5);
 assert(/hose is at its limit/.test(toast()),'walking away past 3.5 m puts the nozzle back ('+toast()+')');
 // 7. the save keeps the truck's tank (it is away from home, so it is saved)
 assert(profile().vehicles.some(v=>v.uid==='eastbank-worktruck'&&v.fuelMl===after.fuelMl),'the saved tank is the one the game shows');
 console.log('Refuelling (the packaged game): a real E press takes the diesel nozzle; holding E fills the truck in whole steps and takes exactly $2.10 a litre; letting go stops it; the wrong fuel is refused without money; E hangs the nozzle up; walking past 3.5 m puts it back; the tank is saved.');
}finally{await rm(dir,{recursive:true,force:true})}
