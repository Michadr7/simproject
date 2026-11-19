import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {fresh,PLACES,skipStarter} from '../dist/starter.js';
import {WAREHOUSE_TABLE} from '../dist/warehouse-layout.js';
import {talkOpen,talkName,reply,closeTalk} from './support/talk.mjs';

// Talking to NPCs (both the docked #talk panel and the legacy #dialog.in-world menus) must never pause time, needs, or world updates;
// walking stays locked, blocking modals (pause, bills, inventory) still pause, and walk-away / speaker-gone / shop-close / vehicle-hit close talk cleanly.
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');

const O=MAP.offices[0],W=MAP.offices.find(o=>o.kind==='warehouse');
const g=await bootGame({
 position:{x:19,z:-6.3},
 progress:{starter:skipStarter()}
});
try{
 const {GameState,pump,send,ids,win}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const key=c=>send('keydown',c),press=(c='KeyE',s=.3)=>{send('keydown',c);send('keyup',c);pump(s)};
 const go=(x,z)=>Object.assign(me(),{x,y:.02,z});
 const at=minutes=>{GameState.progress={...p(),routine:{...p().routine,minutes}}};
 const enter=(x,wait=2.5)=>{go(x,-7.5);pump(1);go(x,-8.9);pump(wait)};
 const leave=()=>{go(0,3.9);pump(.4);press('KeyE',1);go(0,4.4);pump(2.5)};

 function assertLiveWhileOpen(label,closeFn){
  const m0=p().routine.minutes,f0=p().life.food,t0=p().life.thirst,e0=p().life.energy,x0=me().x,z0=me().z;
  send('keydown','KeyW');pump(5);send('keyup','KeyW');
  assert(p().routine.minutes>m0,label+': clock must advance while open ('+m0+' -> '+p().routine.minutes+')');
  assert(p().life.food<f0&&p().life.thirst<t0&&p().life.energy<e0,label+': needs must drain while open');
  assert.equal(me().x,x0,label+': walking X locked while open');
  assert.equal(me().z,z0,label+': walking Z locked while open');
  closeFn();
  const m1=p().routine.minutes;pump(2);
  assert(p().routine.minutes>m1,label+': clock keeps running after close ('+m1+' -> '+p().routine.minutes+')');
 }

 // 1. Route offer at Noah's counter via store -> marketWork (#dialog.in-world)
 at(540);enter(19);go(0,-2);pump(.3);press();
 assert(talkOpen(ids)&&talkName(ids)==='Noah','Noah opens in #talk');
 reply(ids,/browse items/);ids.get('storeWork').click();pump(.2);
 assert.equal(ids.get('dialog').hidden,false,'marketWork opens #dialog');
 assert.match(ids.get('dialogText').textContent,/grocery order/,'route offer shown: '+ids.get('dialogText').textContent);
 assertLiveWhileOpen('Noah route offer (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});

 // 2. Noah via the fallback menu (marketMenu #dialog when #talk is absent)
 const talkEl=ids.get('talk');
 ids.delete('talk');
 press();
 assert.equal(ids.get('dialog').hidden,false,'Noah fallback opens #dialog');
 assert.equal(ids.get('dialogKicker').textContent,'Noah');
 assert.match(ids.get('jobAction').textContent,/What is on the shelves/,'marketMenu shown: '+ids.get('dialogText').textContent);
 assertLiveWhileOpen('Noah fallback marketMenu (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});
 ids.set('talk',talkEl);

 // 3. Shop closes while #dialog is open (and while #talk is open)
 ids.get('closeDialog').click();pump(.1);
 press();assert(talkOpen(ids),'#talk open with Noah');
 at(22*60+1);pump(.4);
 assert(!talkOpen(ids),'#talk closes when the market closes');
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock keeps running after shop-close in #talk')}

 at(540);
 ids.delete('talk');press();assert.equal(ids.get('dialog').hidden,false,'#dialog open with Noah');ids.set('talk',talkEl);
 at(22*60+1);pump(.4);
 assert.equal(ids.get('dialog').hidden,true,'#dialog closes when the market closes');
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock keeps running after shop-close in #dialog')}
 leave();

 // 4. Employer office menus: Ridgeline company store (#dialog), ownerMenu fallback (#dialog), warehouse order table (#dialog)
 at(540);go(O.door.x+.8,O.door.z);pump(.6);press('KeyE',2.5);
 go(4.2,-2.3);pump(.6);press();
 assert.equal(ids.get('dialog').hidden,false,'company store opens #dialog');
 assertLiveWhileOpen('Ridgeline company store (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});

 go(0,-1.1);pump(.6);ids.delete('talk');press();ids.set('talk',talkEl);
 assert.equal(ids.get('dialog').hidden,false,'employer ownerMenu fallback opens #dialog');
 assert.equal(ids.get('dialogKicker').textContent,'Walt Hargrove');
 assertLiveWhileOpen('Employer ownerMenu (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});

 go(0,3.9);pump(.4);press('KeyE',1);go(0,4.4);pump(2.5);
 go(W.door.out.x,W.door.out.z);pump(.6);press('KeyE',2.5);
 go(WAREHOUSE_TABLE.x,WAREHOUSE_TABLE.z+1.4);pump(.6);press();
 assert.equal(ids.get('dialog').hidden,false,'warehouse orderTable opens #dialog');
 assertLiveWhileOpen('Warehouse orderTable (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});
 go(0,10.9);pump(.4);press('KeyE',1);go(0,11.5);pump(2.5);

 // 5. Apartment buzzer (station #dialog outdoors)
 go(1-2.4,-7.2);pump(.6);press();
 assert.equal(ids.get('dialog').hidden,false,'apartment buzzer opens #dialog');
 assert.equal(ids.get('dialogKicker').textContent,'Oak Street Apartments');
 assertLiveWhileOpen('Apartment buzzer (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});

 // 6. Hal's talk (#dialog fallback, #talk, walk-away, speaker disappears, vehicle hit)
 at(600);GameState.progress={...p(),starter:{...fresh(),step:3}};
 go(PLACES.hal.x+1.2,PLACES.hal.z);pump(2);
 ids.delete('talk');press();ids.set('talk',talkEl);
 assert.equal(ids.get('dialog').hidden,false,'Hal fallback opens #dialog');
 assert.equal(ids.get('dialogKicker').textContent,'Hal Brennan');
 assertLiveWhileOpen('Hal fallback (#dialog)',()=>{key('Escape');pump(.2);assert.equal(ids.get('dialog').hidden,true)});

 // Walk-away (> 3 m) closes #dialog and keeps time running
 ids.delete('talk');press();ids.set('talk',talkEl);assert.equal(ids.get('dialog').hidden,false);
 go(me().x+4,me().z);pump(.3);
 assert.equal(ids.get('dialog').hidden,true,'walking > 3 m closes #dialog');
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock keeps running after walk-away')}

 // Speaker disappears (Hal leaves after 5:30 PM) closes both #talk and #dialog and keeps time running
 go(PLACES.hal.x+1.2,PLACES.hal.z);pump(1);
 press();assert(talkOpen(ids),'#talk open with Hal');
 GameState.progress={...p(),starter:{...p().starter,done:true},routine:{...p().routine,minutes:1051}};pump(.4);
 assert(!talkOpen(ids),'#talk closes when Hal disappears');
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock keeps running after speaker disappears (#talk)')}

 at(600);GameState.progress={...p(),starter:{...fresh(),step:3}};pump(1);
 ids.delete('talk');press();ids.set('talk',talkEl);assert.equal(ids.get('dialog').hidden,false);
 GameState.progress={...p(),starter:{...p().starter,done:true},routine:{...p().routine,minutes:1051}};pump(.4);
 assert.equal(ids.get('dialog').hidden,true,'#dialog closes when Hal disappears');
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock keeps running after speaker disappears (#dialog)')}

 // Vehicle hit closes talk and keeps time running
 at(600);GameState.progress={...p(),starter:{...fresh(),step:3}};pump(1);
 press();assert(talkOpen(ids),'#talk open before vehicle hit');
 assert(win.__city?.driving,'debug driving hook available');
 const dev=win.__city.driving.addDev('shortbed',null,{x:me().x+15,z:me().z,yaw:0});
 const truck=win.__city.driving.byId.get(dev.id);
 truck.state={x:me().x,z:me().z,yaw:0,speed:0,steer:0};pump(.3);
 assert(!talkOpen(ids),'#talk closes when hit by a vehicle');
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock keeps running after vehicle hit')}
 win.__city.driving.removeDev(dev.id);pump(.2);

 // 7. Blocking modals (pause menu, bills dialog) STILL pause time and needs
 key('Escape');pump(.1);assert.equal(ids.get('controls').hidden,false,'pause menu open');
 {const m=p().routine.minutes,f=p().life.food;pump(3);assert.equal(p().routine.minutes,m,'pause menu freezes clock');assert.equal(p().life.food,f,'pause menu freezes needs')}
 key('Escape');pump(.1);assert.equal(ids.get('controls').hidden,true,'pause menu closed');

 ids.get('billsButton').click();pump(.1);assert.equal(ids.get('dialog').hidden,false,'bills dialog open');
 {const m=p().routine.minutes,f=p().life.food;pump(3);assert.equal(p().routine.minutes,m,'bills dialog freezes clock');assert.equal(p().life.food,f,'bills dialog freezes needs')}
 ids.get('closeDialog').click();pump(.1);
 {const m=p().routine.minutes;pump(2);assert(p().routine.minutes>m,'clock resumes after blocking modal closes')}

 console.log('PASS no-pause.mjs: Noah route offer/fallback, Ridgeline store/ownerMenu/orderTable, buzzer, Hal fallback all keep clock and needs running with walking locked; shop-close, walk-away, speaker-disappear and vehicle-hit close talk cleanly; pause and bills modals still freeze time.');
}finally{await g.done()}