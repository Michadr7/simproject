// VD4 in the packaged game (design tests 9 to 11, game level): a wrecked S70 stands in the Eastbank service bay. The player walks up, presses E, pays the quote, the vehicle leaves the world and cannot be driven, game hours pass,
// the phone says it is ready, E collects it Fine. A wreck far away is towed from the phone for the fee, a repair kit is bought at the counter and used, and the save holds the shop state.
import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {normalizeProgress} from '../dist/jobs.js';
import {towFee,bayPose,hoursNow} from '../dist/garage.js';

const B=bayPose();
const g=await bootGame({position:{x:122.2,z:20.4},progress:{cash:30000,completed:5,routine:{minutes:480},
 vehicles:[{uid:'v1',model:'shortbed',colour:'#c23b2e',x:B.x,z:B.z,yaw:B.yaw,fuelMgal:10000,cond:0},{uid:'v2',model:'offroad',colour:'#2e5f9a',x:60,z:15,yaw:0,fuelMgal:10000,cond:0}],orders:{nextVehicle:3}}});
try{
 const {GameState,pump,send,ids,find,scene,store}=g,press=code=>{send('keydown',code);send('keyup',code)};
 const prompt=()=>({text:ids.get('prompt').querySelector('span').textContent,key:ids.get('prompt').querySelector('kbd').textContent,hidden:ids.get('prompt').hidden}),toast=()=>ids.get('jobToast').textContent;
 const profile=()=>JSON.parse(store.get('edenridge.profile.v1')).progress,saved=uid=>profile().vehicles.find(v=>v.uid===uid),mesh=uid=>scene().getObjectByName('vehicle-'+uid);
 const advance=hours=>{const r=GameState.progress.routine,m=r.minutes+hours*60;assert(m<1439,'the test clock stays inside the day');GameState.progress={...GameState.progress,routine:{...r,minutes:m}}};
 const dialog=()=>({open:!ids.get('dialog').hidden,text:ids.get('dialogText').textContent,first:ids.get('jobAction').hidden?null:ids.get('jobAction').textContent,second:ids.get('extraAction').hidden?null:ids.get('extraAction').textContent,third:ids.get('thirdAction').hidden?null:ids.get('thirdAction').textContent});
 pump(1.5);
 assert(mesh('v1').visible&&mesh('v2').visible,'both wrecks are in the world at the start');
 assert(Math.abs(mesh('v1').position.x-B.x)<.5&&Math.abs(mesh('v1').position.z-B.z)<.5,'v1 stands in the service bay');

 // 1. The prompt at the bay and the counter menu: full, partial, kit, with prices and hours.
{const p=prompt();assert(!p.hidden&&p.key==='E'&&/Repair shop · Kasumuchi S70 at 0%/.test(p.text),'at the bay: E, Repair shop, the S70 and its condition ('+JSON.stringify(p)+')')}
 press('KeyE');pump(.3);
 {const d=dialog();assert(d.open,'E opens the counter');assert.equal(d.first,'Repair fully · $125.00 · 6 h','the quote is the user\'s $125 and 6 game hours');assert.equal(d.second,'Fix to 70% · $87.50 · 4 h 15 min','the cheap line');assert.equal(d.third,'Buy a repair kit · $40.00')}

 // 2. Pay: cash down by the quote, the vehicle leaves the world, the save holds the shop state and the unchanged condition.
 const t0=hoursNow(GameState.progress);ids.get('jobAction').click();pump(.3);
 assert.equal(GameState.progress.cash,30000-12500,'$125 paid');assert(/in the shop: \$125\.00, ready in 6 h/.test(toast()),'toast: '+toast());
 assert.equal(mesh('v1').visible,false,'the vehicle is in the shop, not in the world');
 {const s=GameState.progress.garage.shop.v1;assert(s&&s.to===1000&&Math.abs(s.readyAt-(t0+6))<.2,'ready 6 game hours later: '+JSON.stringify(s));assert.equal(saved('v1').cond??1000,0,'the saved condition stays 0 until it is collected');assert.deepEqual(profile().garage.shop.v1,s,'the shop state is saved');
  const again=normalizeProgress(profile());assert.deepEqual(again.garage.shop.v1,s,'and survives normalisation (a reload)');assert.equal(again.vehicles.find(v=>v.uid==='v1').cond,0)}
 assert(!/Drive the|Ride in/.test(prompt().text),'there is no door to drive it from: '+prompt().text);
 {const p=prompt();assert(/Repair shop · Kasumuchi S70 ready in/.test(p.text),'the counter says when: '+p.text)}

 // 3. Towing the far wreck from the phone: the fee from the straight-line distance, the vehicle appears at the bay, its condition is kept.
 ids.get('phoneButton').click();ids.get('phoneApp-player').click();
 const tow=find('tow-v2');assert(tow,'the Player screen has a Call a tow button on the pickup card');assert(/Call a tow to the repair shop · \$\d+\.\d\d/.test(tow.textContent),'it shows the fee: '+tow.textContent);
 {const card=ids.get('phoneGarage').children.find(c=>c.children.includes(tow)),lines=card.children.map(c=>c.textContent).join(' | ');assert(/Condition 0% \(Wrecked\)/.test(lines),'the card shows the condition: '+lines);
  const c1=ids.get('phoneGarage').children.find(c=>c.children.some(x=>x.id==='tow-v1')),l1=c1.children.map(c=>c.textContent).join(' | ');assert(/In the shop: ready in 6 h · ready \w+day \d+:\d\d (AM|PM)/.test(l1)||/In the shop: ready in 5\.9\d h/.test(l1)||/In the shop: ready in/.test(l1),'the S70 card shows the shop line: '+l1);assert(c1.children.find(x=>x.id==='tow-v1').hidden,'no tow button for a vehicle in the shop')}
 const cash1=GameState.progress.cash,fee=towFee({x:60,z:15},B);assert(fee>7500&&fee<25000);
 tow.onclick();pump(.3);
 assert.equal(cash1-GameState.progress.cash,fee,'the tow fee was paid: $'+(fee/100).toFixed(2));assert(/tow truck brought your .* to the shop/.test(ids.get('phoneMessage').textContent),ids.get('phoneMessage').textContent);
 assert(mesh('v2').visible&&Math.hypot(mesh('v2').position.x-B.x,mesh('v2').position.z-B.z)<1.5,'the pickup now stands in the bay');assert.equal(saved('v2').cond??1000,0,'its condition is kept (still a wreck)');
 ids.get('phoneClose').click();

 // 4. The repair kit: bought at the counter ($40), equipped, used on the wreck (+15%), one consumed.
 press('KeyE');pump(.3);{const d=dialog();assert(d.open&&/Repair fully · \$2,750\.00 · 6 h/.test(d.first),'now the pickup is the one at the counter: '+JSON.stringify(d));assert(/Buy a repair kit · \$40\.00/.test(d.third||d.second))}
 const cash2=GameState.progress.cash;(ids.get('thirdAction').hidden?ids.get('extraAction'):ids.get('thirdAction')).click();pump(.3);
 assert.equal(cash2-GameState.progress.cash,4000,'a kit costs $40');assert.equal(GameState.progress.inventory.slots.find(s=>s.id==='repair-kit')?.quantity,1);
 GameState.progress={...GameState.progress,equipped:'repair-kit'};Object.assign(GameState.me.position,{x:129.8,z:23.75});GameState.me.rotation.y=-Math.PI/2;pump(.5);
 {const p=prompt();assert(!p.hidden&&/Use a repair kit · Pevrolet Off Road Pickup 0%/.test(p.text)&&p.key==='E','with the kit in hand the pickup offers it: '+JSON.stringify(p))}
 press('KeyE');pump(.3);assert.equal(saved('v2').cond,150,'0 + 150');assert(!GameState.progress.inventory.slots.some(s=>s.id==='repair-kit'),'the kit is gone');assert(/Repair kit used: the Pevrolet Off Road Pickup is at 15%/.test(toast()),toast());
 GameState.progress={...GameState.progress,equipped:null};Object.assign(GameState.me.position,{x:122.2,z:20.4});GameState.me.rotation.y=0;

 // 5. Game hours pass: not ready after 5, ready after 6, announced on the phone, collected Fine at the bay.
 advance(5);pump(.5);{const p=prompt();assert(/Repair shop/.test(p.text)&&!/collect/.test(p.text),'not ready yet: '+p.text)}
 assert.equal(mesh('v1').visible,false,'still in the shop');assert(!(GameState.progress.messages||[]).some(m=>/ready at the Eastbank repair shop/.test(m.text)),'no ready message yet');
 advance(1.2);pump(.5);
 assert((GameState.progress.messages||[]).some(m=>/Your Kasumuchi S70 is ready at the Eastbank repair shop/.test(m.text)),'the phone says it is ready');
 {const p=prompt();assert(/Repair shop · collect the Kasumuchi S70/.test(p.text),'the counter offers it: '+p.text)}
 press('KeyE');pump(.3);assert(/Collect the Kasumuchi S70 · 100%/.test(dialog().first),'first choice is Collect: '+dialog().first);ids.get('jobAction').click();pump(.5);
 assert(/Your Kasumuchi S70 is ready: 100%/.test(toast()),toast());assert(mesh('v1').visible,'it is back in the world');assert(Math.hypot(mesh('v1').position.x-B.x,mesh('v1').position.z-B.z)<8,'next to the bay');
 assert.equal(saved('v1').cond,undefined,'saved as a perfect vehicle (no cond)');assert.deepEqual(GameState.progress.garage.shop,{},'the shop is empty');assert.equal(GameState.progress.cash,30000-12500-fee-4000,'the cash total is the quote + tow + kit, nothing else');
 console.log('  repaired: $125.00 and 6 game hours; tow fee $'+(fee/100).toFixed(2)+'; kit $40.00');
 console.log('Garage in the game (packaged): E at the Eastbank service bay quotes $125 for a wrecked S70, the vehicle leaves the world and cannot be driven, the phone announces it after 6 game hours, E collects it Fine; a far wreck is towed from the phone for the fee with its condition kept; a repair kit is bought, equipped and used (+15%); the shop state is saved.');
}finally{await g.done()}
