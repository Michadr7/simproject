import {addItem,hotbarItems} from '../dist/inventory.js';
import * as THREE from '../dist/vendor/three.module.js';
// Exercise the real game startup and UI with a synthetic DOM and GPU-only renderer stub.
import {mkdtemp,readFile,writeFile,cp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const html=await readFile('dist/index.html','utf8');
class El extends EventTarget{
 constructor(tag='div'){super();this.tag=tag;this.hidden=false;this.value='';this.children=[];this.dataset={};this.style={setProperty(){}};this.classList={add(){},remove(){},toggle(){}};this.selectors=new Map()}
 append(...els){this.children.push(...els)}replaceChildren(...els){this.children=[...els]}setAttribute(k,v){this[k]=v}querySelector(s){if(!this.selectors.has(s))this.selectors.set(s,new El());return this.selectors.get(s)}focus(){}matches(s){return ['input','textarea','select'].includes(this.tag)}setCustomValidity(){}reportValidity(){}setPointerCapture(){}click(){this.onclick?.({preventDefault(){}})}
 getBoundingClientRect(){return {left:0,top:0,width:1400,height:900}}
 getContext(){return new Proxy({measureText:t=>({width:t.length*20})},{get:(o,k)=>o[k]??(()=>{})})}
}
for(const saved of [false,true]){
 const dir=await mkdtemp(join(tmpdir(),'city-startup-'));
 try{
 const release=html.match(/import\('\.\/(releases\/[^/]+)\/game\.js'/)[1];
 await cp('dist/'+release,dir,{recursive:true});
 const threeURL=pathToFileURL(resolve('dist/vendor/three.module.js')).href;
 await writeFile(join(dir,'vendor/three.module.js'),`export * from '${threeURL}';export class WebGLRenderer{constructor(){this.shadowMap={}}setPixelRatio(){}setSize(){}setViewport(){}clear(){}render(scene,camera){globalThis.__renders=(globalThis.__renders||0)+1;globalThis.__renderScene=scene;globalThis.__renderCamera=camera}}`);
 const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El(m[1]==='characterName'?'input':'div')]));
 const doc=new EventTarget();doc.getElementById=id=>ids.get(id)||null;doc.createElement=tag=>new El(tag);doc.body=new El();doc.querySelectorAll=()=>[];doc.hidden=false;
 const win=new EventTarget();win.matches=()=>false;const store=new Map();if(saved){store.set('citylife.character.v1',JSON.stringify({version:1,appearance:{name:'Michadr'}}));store.set('citylife.progress.v1',JSON.stringify({version:1,progress:{cash:11200,completed:5,phase:'available',position:{x:1,z:-6.3}}}))}
 let nextFrame;Object.assign(globalThis,{document:doc,window:win,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},innerWidth:1400,innerHeight:900,devicePixelRatio:1,requestAnimationFrame:fn=>{nextFrame=fn}});
 const originalSocket=globalThis.WebSocket;
 class FakeSocket extends EventTarget {
  constructor(){super();this.readyState=1;this.bufferedAmount=0;this.sent=[];globalThis.__testSocket=this}
  send(data){this.sent.push({time:globalThis.__testNow,message:JSON.parse(data)})}
  close(){this.readyState=3}
  receive(message){const e=new Event('message');e.data=JSON.stringify(message);this.dispatchEvent(e)}
 }
 globalThis.WebSocket=FakeSocket;globalThis.__testSocket=undefined;globalThis.__renders=0;
 await import(pathToFileURL(join(dir,'game.js')).href);
 assert(nextFrame,'startup reaches animation loop');nextFrame(performance.now()+16);
 // Main menu: nothing connects at load, and the world is drawn once and then left alone until Play.
 assert.equal(globalThis.__testSocket,undefined,'no connection is opened before you choose multiplayer');
 assert(!ids.get('welcome').hidden,'the main menu is showing');assert(!ids.get('menuHome').hidden);assert(ids.get('menuMultiplayerPanel').hidden&&ids.get('menuSettingsPanel').hidden);
 {const drawn=globalThis.__renders;assert(drawn>0,'the world is drawn once behind the menu');nextFrame(performance.now()+32);nextFrame(performance.now()+48);assert.equal(globalThis.__renders,drawn,'the world is not redrawn while the main menu is open')}
 if(!saved){ // Play is offline: with no character it opens the creator, and Back returns to the menu with no connection made.
  ids.get('start').click();assert(!ids.get('creator').hidden,'Play with no character opens the creator');assert.equal(globalThis.__testSocket,undefined,'Play is offline');
  ids.get('cancelCreator').click();assert(!ids.get('welcome').hidden,'Back from the creator returns to the main menu');
 }
 // Multiplayer > Join (an empty address means this computer) starts the game once the server has said welcome.
 ids.get('menuMultiplayer').click();assert(!ids.get('menuMultiplayerPanel').hidden&&ids.get('menuHome').hidden);
 ids.get('menuAddress').value='';ids.get('menuJoin').click();
 assert(globalThis.__testSocket,'Join opens a connection');assert(!ids.get('welcome').hidden,'the menu stays up until the server answers');
 __testSocket.receive({type:'welcome',id:'test-self'});
 globalThis.WebSocket=originalSocket;
 assert(ids.get('menuHome').hidden===false,'the menu is back on its home panel for next time');
 if(saved){
 const pressE=()=>{const e=new Event('keydown');e.code='KeyE';win.dispatchEvent(e)};let simTime=performance.now()+100;const pump=seconds=>{for(let i=0;i<seconds*25;i++){simTime+=40;nextFrame(simTime)}};
 assert(ids.get('welcome').hidden);assert.equal(ids.get('cash').textContent,'$112.00');pressE();assert(ids.get('dialogText').textContent.includes('Furnished studio'));ids.get('jobAction').click();pump(.1);assert.equal(ids.get('cash').textContent,'$22.00');
 const roomModule=await import(pathToFileURL(join(dir,'apartment.js')).href),person=globalThis.__renderScene.getObjectByName('player');
 const {GameState}=await import(pathToFileURL(join(dir,'state.js')).href);
 const go=(x,z)=>Object.assign(GameState.me.position,{x,y:.02,z});go(roomModule.BED.x,roomModule.BED.z);GameState.progress.life.energy=20;const sleepMinutes=GameState.progress.routine.minutes,sleepDay=GameState.progress.housing.day;pressE();ids.get('jobAction').click();pump(.1);assert(!ids.get('sleepFade').hidden);pump(1.4);assert(ids.get('sleepFade').hidden);assert.equal(GameState.progress.life.energy,100);assert.equal(GameState.progress.routine.minutes,sleepMinutes,'sleep does not advance clock');assert.equal(GameState.progress.housing.day,sleepDay);assert(ids.get('clockStatus').textContent.includes('Monday'));ids.get('billsButton').click();assert(ids.get('jobAction').hidden,'no bill before the weekly due day');ids.get('closeDialog').click();pump(.1);assert.equal(ids.get('cash').textContent,'$22.00');go(roomModule.EXIT.x,roomModule.EXIT.z);pressE();
 // Doors only enter; work is offered by the clerk inside.
 // Shop doors slide open as you walk up and you walk through them: no E.
 const enter=x=>{go(x,-7.5);pump(1);go(x,-8.9);pump(2.5)},leave=()=>{go(0,4.4);pump(2.5)}; // door cooldown is 1-2 s after using a door
 enter(19);assert.equal(ids.get('locationName').textContent,'CORNER MARKET');assert(ids.get('dialog').hidden,'door does not open a job dialog');go(0,-2);pressE();assert(ids.get('storeOverlay').hidden,'counter opens a short menu first');ids.get('jobAction').click();assert(!ids.get('storeOverlay').hidden,'View items for sale opens the store');ids.get('storeWork').click();assert.equal(ids.get('dialogKicker').textContent,'Noah');pump(3);const beforeLook=globalThis.__renderCamera.getWorldDirection(new THREE.Vector3());ids.get('closeDialog').click();pump(3);const afterLook=globalThis.__renderCamera.getWorldDirection(new THREE.Vector3());assert(beforeLook.dot(afterLook)>.99,'conversation close preserves camera heading');const settled=globalThis.__renderCamera.position.clone();pump(3);assert(settled.distanceTo(globalThis.__renderCamera.position)<.02,'camera stays still without fresh input');pressE();ids.get('storeWork').click();ids.get('jobAction').click();leave();go(-10.2,-7);pressE();ids.get('jobAction').click();pump(.1);assert.equal(ids.get('cash').textContent,'$40.00');
 enter(19);go(0,-2);pressE();ids.get('jobAction').click();ids.get('storeGroceries').click();ids.get('storeClose').click();pump(.1);assert.equal(ids.get('cash').textContent,'$36.00');leave();
 assert.match(ids.get('clockChip').textContent,/^[A-Z][a-z]{2} · \d{1,2}:\d{2} (AM|PM)$/,'the time chip under the minimap');
 // A menu opened during the door fade freezes the transition (it used to finish it and unpause the game under the menu).
 {const esc=()=>{const e=new Event('keydown',{cancelable:true});e.code='Escape';win.dispatchEvent(e)};
  go(19,-7.5);pump(1);go(19,-8.9);pump(.06);ids.get('help').click();assert(!ids.get('controls').hidden,'controls menu is open');pump(2);
  assert.equal(ids.get('locationName').textContent,'WESTSIDE','the door fade waits while the Controls menu is open');assert(!ids.get('controls').hidden,'the menu stays open');
  esc();pump(.1);assert(ids.get('controls').hidden,'Escape closes the menu');pump(2.5);assert.equal(ids.get('locationName').textContent,'CORNER MARKET','the fade finishes once the menu is closed');leave();}
 // Two seconds of walking in 100 ms frames and in 20 ms frames cover the same ground and the same game time (movement used to be
 // capped at 40 ms a frame while the clock ran on real time, so slow frames made the player slow but not the hunger).
 {const hold=(code,down)=>{const e=new Event(down?'keydown':'keyup',{cancelable:true});e.code=code;win.dispatchEvent(e)};
  const walk=frameMs=>{Object.assign(GameState.me.position,{x:-5,y:.2,z:12});pump(.2);const z0=GameState.me.position.z,m0=GameState.progress.routine.minutes;hold('KeyW',true);for(let t=0;t<2000;t+=frameMs){simTime+=frameMs;nextFrame(simTime)}hold('KeyW',false);pump(.2);return {metres:z0-GameState.me.position.z,minutes:GameState.progress.routine.minutes-m0}};
  const slow=walk(100),fast=walk(20);
  assert(slow.metres>7&&fast.metres>7,`walked ${slow.metres.toFixed(2)} and ${fast.metres.toFixed(2)} m`);assert(Math.abs(slow.metres-fast.metres)<.3,`ground covered: ${slow.metres.toFixed(2)} m in 100 ms frames, ${fast.metres.toFixed(2)} m in 20 ms frames`);
  assert(Math.abs(slow.minutes-fast.minutes)<.05,`game time: ${slow.minutes} vs ${fast.minutes}`);}

 // A closed shop keeps its door shut, shows CLOSED and tells you its hours.
 {const saved=GameState.progress.routine.minutes;GameState.progress.routine.minutes=23*60+30;go(19,-6.3);pump(.2);go(19,-7.9);pump(2.5);assert.equal(ids.get('locationName').textContent,'WESTSIDE','cannot enter a closed shop');assert.match(ids.get('jobToast').textContent,/Corner Market is closed/);GameState.progress.routine.minutes=saved;go(19,-6.3);pump(.2)}
 // Left click acts like E, but only once the mouse is captured: the click that captures it just captures. (At Noah's counter it opens his menu.)
 {const click=type=>{const e=new Event(type,{cancelable:true});e.button=0;win.dispatchEvent(e);return e};
  enter(19);go(0,-2);doc.pointerLockElement=null;click('mousedown');click('mouseup');pump(.1);assert(ids.get('dialog').hidden,'uncaptured click does not act');
  doc.pointerLockElement=ids.get('world');const down=click('mousedown');assert(down.defaultPrevented);pump(.1);assert.equal(ids.get('dialogKicker').textContent,'Noah','captured left click acts like E');click('mouseup');doc.pointerLockElement=null;
  ids.get('closeDialog').click();pump(.1);leave();assert.equal(ids.get('locationName').textContent,'WESTSIDE');}
 enter(36);assert.equal(ids.get('locationName').textContent,'ALDER COFFEE');go(0,-2);pressE();ids.get('extraAction').click();ids.get('jobAction').click();pump(.1);assert.equal(ids.get('cash').textContent,'$30.00');leave();go(1,-6.3);pressE();pump(.1);assert.equal(ids.get('locationName').textContent,'STUDIO 2B','rented home opens directly');go(3,-3.5);pressE();ids.get('jobAction').click();ids.get('bagButton').click();assert(ids.get('inventoryGroceries').textContent.startsWith('0 grocery packs'));ids.get('inventoryClose').click();
 const wheel=new Event('wheel',{cancelable:true});wheel.deltaY=-400;wheel.deltaMode=0;ids.get('world').dispatchEvent(wheel);pump(4);assert(globalThis.__renderCamera.position.distanceTo(person.position)<5);
 go(roomModule.EXIT.x,roomModule.EXIT.z);pressE();enter(36);const shopRoot=globalThis.__renderScene.getObjectByName('cafe-interior');assert.equal(person.parent,shopRoot);assert(shopRoot.children.filter(m=>m.name==='storefront-glass').every(m=>m.material.transparent&&m.material.opacity<.2));
 go(0,-2);pressE();ids.get('jobAction').click();ids.get('jobAction').click();pressE();ids.get('jobAction').click();ids.get('jobAction').click();pump(10);
 for(const drink of ['Latte','Espresso']){go(-2.3,-.7);pressE();assert(ids.get('dialogText').textContent.includes(drink.toLowerCase()));ids.get('jobAction').click();go(-1.25,-2.25);pressE();if(drink==='Latte'){ids.get('jobAction').click();assert(!ids.get('dialog').hidden);ids.get('extraAction').click()}else ids.get('jobAction').click();pump(4);assert.equal(JSON.parse(store.get('citylife.profile.v1')).progress.cafe.stage,'serve');go(-2.3,-.7);pressE();pump(10);pressE();pump(14)}
 go(0,-2);pressE();ids.get('jobAction').click();ids.get('jobAction').click();pump(.1);assert.equal(ids.get('cash').textContent,'$54.00');pressE();ids.get('jobAction').click();ids.get('jobAction').click();pump(.1);assert.equal(ids.get('cash').textContent,'$54.00');
 }

 else {assert.equal(ids.get('creator').hidden,false);ids.get('characterName').value='Test';ids.get('creatorForm').onsubmit({preventDefault(){}});assert(ids.get('creator').hidden);nextFrame(performance.now()+32);assert.equal(ids.get('cash').textContent,'$0.00')}
 // Phone UI integration: keyboard, pointer release, movement lock, apps, acceptance and marker.
 const {GameState:phoneState}=await import(pathToFileURL(join(dir,'state.js')).href);
 const {CONTRACTS}=await import(pathToFileURL(join(dir,'contracts.js')).href);
 let phoneNow=performance.now()+50000;
 const phoneFrame=()=>{phoneNow+=40;nextFrame(phoneNow)};
 const key=(code,repeat=false)=>{const e=new Event('keydown',{cancelable:true});e.code=code;e.repeat=repeat;win.dispatchEvent(e);return e};
 ids.get('closeDialog').click();
 phoneState.progress.gigBoard={ids:CONTRACTS.slice(0,3).map(j=>j.id),refreshAt:1e8};
 assert(ids.get('phoneOverlay').hidden,'phone starts hidden');
 let releases=0;doc.pointerLockElement=ids.get('world');doc.exitPointerLock=()=>{releases++;doc.pointerLockElement=null;doc.dispatchEvent(new Event('pointerlockchange'))};
 key('KeyW');const phoneX=phoneState.me.position.x,phoneZ=phoneState.me.position.z;
 const tab=key('Tab');assert(tab.defaultPrevented);assert(!ids.get('phoneOverlay').hidden);assert.equal(releases,1,'phone unlocks cursor');
 key('Tab',true);assert(!ids.get('phoneOverlay').hidden,'repeat does not flicker phone');
 key('KeyW');for(let i=0;i<8;i++)phoneFrame();
 assert.equal(phoneState.me.position.x,phoneX);assert.equal(phoneState.me.position.z,phoneZ,'WASD cannot move while phone is open');
 ids.get('phoneApp-bank').click();assert.equal(ids.get('phoneBalance').textContent,ids.get('cash').textContent);
 ids.get('phoneHome').click();assert(!ids.get('phoneScreen-home').hidden);
 ids.get('phoneApp-player').click();assert.equal(ids.get('phoneEnergy').textContent,Math.round(phoneState.progress.life.energy)+' / 100');
 assert.equal(ids.get('phoneFood').textContent,Math.round(phoneState.progress.life.food)+' / 100');
 const oldEnergy=phoneState.progress.life.energy;phoneState.progress.life.energy=1;
 ids.get('phoneApp-gigs').click();const accept=ids.get('phoneContracts').children[0].children.at(-1);
 assert(!accept.disabled,'low energy never blocks acceptance');assert.equal(ids.get('phoneContracts').children.filter(c=>!c.hidden).length,3);phoneState.progress.life.energy=oldEnergy;
 ids.get('phoneApp-gigs').click();assert(!accept.disabled);accept.click();
 assert(ids.get('phoneOverlay').hidden);assert.equal(phoneState.progress.activeJob.id,CONTRACTS[0].id);
 assert.equal(phoneState.progress.life.energy,oldEnergy,'no upfront energy charge');
 assert.equal(JSON.parse(store.get('citylife.profile.v1')).progress.activeJob.id,CONTRACTS[0].id);
 for(let i=0;i<3;i++)phoneFrame();assert.equal(phoneState.me.position.z,phoneZ,'held key does not stick after closing phone');
 key('KeyP');ids.get('phoneApp-gigs').click();assert(accept.disabled,'active job blocks accepting again');assert(ids.get('phoneContracts').children[0].hidden,'cooling-down gig is hidden');key('Escape');assert(ids.get('phoneOverlay').hidden);
 if(saved){Object.assign(phoneState.me.position,{x:0,y:.02,z:4.4});for(let i=0;i<300;i++)phoneFrame()}
 // The HUD is bars, not a box: needs show as bars that warn when low, and putting the axe away lowers the carrying arm again.
 if(saved){
  phoneState.progress.life.food=9;phoneState.progress.life.thirst=28;phoneState.progress.life.energy=80;for(let i=0;i<10;i++)phoneFrame();
  assert.equal(ids.get('vitalFoodFill').style.width,'9%');assert.equal(ids.get('vitalFood').dataset.level,'critical');assert.equal(ids.get('vitalThirst').dataset.level,'low');assert.equal(ids.get('vitalEnergy').dataset.level,'ok');assert.equal(ids.get('vitalEnergyValue').textContent,'80');
  phoneState.progress.life.food=100;phoneState.progress.life.thirst=100;phoneState.progress.life.energy=100;for(let i=0;i<10;i++)phoneFrame();
  const forearm=globalThis.__renderScene.getObjectByName('player').getObjectByName('LowerArmR'),rest=forearm.quaternion.clone();
  const bagBefore=phoneState.progress.inventory;
  phoneState.progress={...phoneState.progress,inventory:addItem(phoneState.progress,'axe').state.inventory};
  const axeSlot=hotbarItems(phoneState.progress).findIndex(h=>h.item.id==='axe')+1;
  key('Digit'+axeSlot);for(let i=0;i<80;i++)phoneFrame();assert.equal(phoneState.progress.equipped,'axe');assert(forearm.quaternion.angleTo(rest)>.5,'the right arm is raised to carry the axe');
  key('Digit'+axeSlot);for(let i=0;i<160;i++)phoneFrame();assert.equal(phoneState.progress.equipped,null);assert(forearm.quaternion.angleTo(rest)<.08,'the right arm is back down once the axe is put away');
  phoneState.progress={...phoneState.progress,inventory:bagBefore}; // leave the bag as the rest of the test expects
 }
 phoneFrame();const gigMarker=globalThis.__renderScene.getObjectByName('gig-marker');assert(gigMarker.visible);
 assert.equal(gigMarker.position.x,CONTRACTS[0].location.x);
 const beforePay=phoneState.progress.cash;
 Object.assign(phoneState.me.position,{x:CONTRACTS[0].location.x,y:.165,z:CONTRACTS[0].location.z});phoneFrame();
 assert.equal(ids.get('gigStepGo').textContent,'☑');assert.equal(phoneState.progress.activeJob.stage,'task');assert.equal(phoneState.progress.cash,beforePay);
 assert.match(ids.get('direction').style.transform,/^rotate\(/,'the arrow is the gig arrow (it used to be overwritten by the market beacon)');assert.equal(globalThis.__renderScene.getObjectByName('objective-beacon').visible,false,'no market beacon during a gig');
 ids.get('objectiveToggle').click();assert(ids.get('objectiveDetails').hidden);assert.equal(ids.get('objectiveToggle')['aria-expanded'],'false');ids.get('objectiveToggle').click();assert(!ids.get('objectiveDetails').hidden);
 for(let i=0;i<205;i++)phoneFrame();assert.equal(phoneState.progress.activeJob.stage,'return');assert.equal(ids.get('gigStepTask').textContent,'☑');
 Object.assign(phoneState.me.position,{x:CONTRACTS[0].returnLocation.x,y:.165,z:CONTRACTS[0].returnLocation.z});key('KeyE');phoneFrame();
 assert.equal(phoneState.progress.cash,beforePay+1000);assert.equal(phoneState.progress.activeJob,null);assert(!gigMarker.visible);
 if(saved){Object.assign(phoneState.me.position,{x:36,y:.165,z:-6.3});key('KeyE');phoneFrame()}
 // Exercise frame-level throttling, final stop delivery, mesh sync and remote events.
 const {GameState:state}=await import(pathToFileURL(join(dir,'state.js')).href);
 ids.get('closeDialog').click();
 let networkNow=performance.now()+100000;
 function networkFrame(){networkNow+=10;globalThis.__testNow=networkNow;nextFrame(networkNow)}
 Object.assign(state.me.position,{x:-5,y:.2,z:12});networkFrame(); // open ground, and one warm-up frame that absorbs the test's big clock jump
 const startZ=state.me.position.z;
 const down=new Event('keydown');down.code='KeyW';win.dispatchEvent(down);
 __testSocket.sent=[];
 for(let i=0;i<30;i++)networkFrame();
 assert.notEqual(state.me.position.z,startZ,'keyboard moves simulation state');
 const up=new Event('keyup');up.code='KeyW';win.dispatchEvent(up);
 for(let i=0;i<30;i++)networkFrame();
 const packets=__testSocket.sent;
 assert(packets.length>1);
 for(let i=1;i<packets.length;i++)assert(packets[i].time-packets[i-1].time>=50,'50ms minimum send interval');
 assert(Math.abs(packets.at(-1).message.position.z-state.me.position.z)<.0001,'final stopped position sent');
 assert.deepEqual(globalThis.__renderScene.getObjectByName('player').position.toArray(),Object.values(state.me.position),'mesh copies state');
 const remote={id:'test-other',position:{x:0,y:0,z:0},room:saved?'cafe':'street'};
 __testSocket.receive({type:'playerJoined',...remote});networkFrame();
 const mesh=globalThis.__renderScene.getObjectByName('remote-player');assert(mesh);
 __testSocket.receive({type:'playerMoved',...remote,position:{x:5,y:0,z:0}});networkFrame();
 assert(mesh.position.x>0&&mesh.position.x<5,'frame interpolates remote movement');
 __testSocket.receive({type:'playerLeft',id:remote.id});assert.equal(mesh.parent,null);
 // Survival/settings/inventory UI share live state, without advancing the clock.
 key('KeyP');ids.get('phoneApp-settings').click();assert(!ids.get('phoneScreen-settings').hidden);
 const clockBeforeSetting=state.progress.routine.minutes;
 ids.get('phoneDrainMultiplier').value='50';ids.get('phoneDrainMultiplier').onchange();
 assert.equal(state.progress.settings.statDrainMultiplier,50);
 assert.equal(state.progress.routine.minutes,clockBeforeSetting,'drain setting does not change time');
 assert.equal(JSON.parse(store.get('citylife.profile.v1')).progress.settings.statDrainMultiplier,50);
 ids.get('phoneTestItem').value='water';ids.get('phoneGrantItem').click();
 ids.get('phoneTestItem').value='apple';ids.get('phoneGrantItem').click();
 ids.get('phoneTestItem').value='small-backpack';ids.get('phoneGrantItem').click();
 assert.equal(state.progress.inventory.slots.length,3);
 ids.get('phoneDrainMultiplier').value='1';ids.get('phoneDrainMultiplier').onchange();key('KeyP');
 state.progress.life.thirst=10;state.progress.life.food=10;state.progress.life.energy=10;
 key('KeyI');assert(!ids.get('inventoryOverlay').hidden);assert(!ids.get('inventoryPanel').hidden);
 const slotButtons=ids.get('inventoryGrid').children;
 assert.equal(slotButtons[0].children[0].textContent,'💧');
 const stoppedX=state.me.position.x;key('KeyW');networkFrame();assert.equal(state.me.position.x,stoppedX);
 slotButtons[0].click();assert.equal(state.progress.life.thirst,10,'consumption does not restore immediately');assert.equal(state.progress.inventory.slots.length,3);assert(ids.get('inventoryOverlay').hidden);
 const held=globalThis.__renderScene.getObjectByName('held-item');assert(held,'held prop attached');
 key('KeyW');for(let i=0;i<50;i++)networkFrame();assert.equal(state.me.position.x,stoppedX);assert.equal(state.progress.inventory.slots.length,3,'not consumed before one second');
 key('Escape');const pausedRotation=held.quaternion.clone();for(let i=0;i<30;i++)networkFrame();assert(held.quaternion.equals(pausedRotation),'paused arm holds its pose');assert.equal(state.progress.inventory.slots.length,3);
 key('Escape');for(let i=0;i<52;i++)networkFrame();assert(state.progress.life.thirst>54.9&&state.progress.life.thirst<=55);assert.equal(state.progress.inventory.slots.length,2);assert.equal(held.parent,null,'held prop removed');
 key('KeyI');
 ids.get('inventoryGrid').children[1].click();assert.equal(state.progress.inventory.equipment.backpack,'small-backpack');
 assert(ids.get('inventoryCapacity').textContent.includes('/ 18 slots'));key('Escape');
 key('KeyQ');assert(!ids.get('radialPanel').hidden);assert.equal(ids.get('radialItems').children[0].children[0].textContent,'🍎');
 key('Digit1');assert.equal(state.progress.inventory.slots.length,1,'quick wheel also waits for animation');key('Digit1');for(let i=0;i<102;i++)networkFrame();assert(state.progress.life.food>24.8&&state.progress.life.food<=25);assert(state.progress.life.thirst>59.8&&state.progress.life.thirst<=60);assert(state.progress.life.energy>11.8&&state.progress.life.energy<=12);assert.equal(state.progress.inventory.slots.length,0);
 networkFrame();assert(ids.get('needsStatus').textContent.includes('Thirst'));
 key('KeyP');ids.get('phoneApp-player').click();assert.equal(ids.get('phoneThirst').textContent,Math.round(state.progress.life.thirst)+' / 100');key('Escape');
 // J toggles the objective without opening a movement-blocking modal.
 const wasHidden=ids.get('objectiveDetails').hidden;key('KeyJ');assert.equal(ids.get('objectiveDetails').hidden,!wasHidden);key('KeyJ',true);assert.equal(ids.get('objectiveDetails').hidden,!wasHidden);key('KeyJ');assert.equal(ids.get('objectiveDetails').hidden,wasHidden);key('KeyT');assert.equal(ids.get('objectiveDetails').hidden,!wasHidden,'T also toggles the task panel');key('KeyT');assert.equal(ids.get('objectiveDetails').hidden,wasHidden);
 assert(!html.includes('inventoryShopItem'),'bag has no store controls');
 // Shop doors slide open as you walk up: leave through the front door, then walk into the market.
 if(saved){Object.assign(state.me.position,{x:0,y:.02,z:4.4});for(let i=0;i<300;i++)networkFrame()}
 Object.assign(state.me.position,{x:19,y:.165,z:-7.5});for(let i=0;i<100;i++)networkFrame();Object.assign(state.me.position,{x:19,y:.165,z:-8.9});for(let i=0;i<300;i++)networkFrame();Object.assign(state.me.position,{x:0,y:.02,z:-2});key('KeyE');
 // Noah offers a short menu: browse the store or ask about jobs.
 assert.equal(ids.get('dialogKicker').textContent,'Noah');assert.equal(ids.get('jobAction').textContent,'View items for sale');assert.equal(ids.get('extraAction').textContent,'View jobs');assert(ids.get('storeOverlay').hidden);ids.get('jobAction').click();assert(!ids.get('storeOverlay').hidden);
 const beforeBuy=state.progress.cash;const buyApple=ids.get('storeItems').children[0].children.at(-1);assert.equal(buyApple.id,'buy-apple');buyApple.click();assert.equal(state.progress.cash,beforeBuy-100);assert(ids.get('storeMessage').textContent.startsWith('✓'),'a purchase is confirmed in the pinned header');assert.equal(ids.get('storeMessage').dataset.kind,'ok');assert.equal(state.progress.inventory.slots[0].id,'apple');assert.equal(JSON.parse(store.get('citylife.profile.v1')).progress.cash,beforeBuy-100);
 ids.get('storeFilter-drink').click();assert.equal(ids.get('storeItems').children.length,5);ids.get('storeClose').click();assert(ids.get('storeOverlay').hidden);
 key('KeyI');assert(!ids.get('inventoryOverlay').hidden);assert.equal(ids.get('inventoryGrid').children[0].children[1].textContent,'Apple');key('Escape');
 console.log(saved?'Existing save: gameplay, phone apps/controls/gigs, and multiplayer frame checks passed.':'Fresh save: creator, phone apps/controls/gigs, and multiplayer frame checks passed.');
 }finally{await rm(dir,{recursive:true,force:true})}
}
