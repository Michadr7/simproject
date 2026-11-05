import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {dropSpot,STUDIO_ID} from '../dist/orders.js';
import {MAP} from '../dist/map-definition.js';
import {propertyTransaction} from '../dist/ownership.js';
import {CLASSES,doorPoint} from '../dist/vehicle.js';

// The Store app in the packaged game (0.34): order on the phone to the studio, wait for the parcel, see the locker light up, collect it at the drop spot.
const g=await bootGame({position:{x:0,z:3}});
try{
 const {GameState,pump,send,ids,find,scene}=g,p=()=>GameState.progress;
 GameState.progress={...p(),cash:20000,housing:{...p().housing,rented:true}};pump(1);
 // no home, no order: first with a fresh save that rents nothing
 GameState.progress={...p(),housing:{...p().housing,rented:false}};ids.get('phoneButton').click();ids.get('phoneApp-store').click();
 assert(/need a home/.test(ids.get('phoneStoreNote').textContent),'without a home the Store says so: '+ids.get('phoneStoreNote').textContent);assert(ids.get('phoneStoreOrder').disabled,'and cannot order');
 ids.get('phoneClose').click();
 // rent the studio, open the Store, fill the cart
 GameState.progress={...p(),housing:{...p().housing,rented:true}};ids.get('phoneButton').click();ids.get('phoneApp-store').click();
 assert.equal(ids.get('phoneStoreCategory').value,'vehicles','the Store opens on Vehicles');assert(!ids.get('phoneStoreVehicles').hidden&&ids.get('phoneStoreItems').hidden,'one category at a time');
 {const cat=ids.get('phoneStoreCategory');cat.value='furniture';cat.onchange();assert(!ids.get('phoneStoreSoon').hidden&&/coming soon/.test(ids.get('phoneStoreSoon').textContent),'a placeholder category says so');cat.value='tools';cat.onchange();assert(!ids.get('phoneStoreItems').hidden&&ids.get('phoneStoreVehicles').hidden,'Tools shows the things')}
 for(const id of ['apple','apple','axe'])find('phoneStoreAdd-'+id).click();
 assert(/2 × Apple, 1 × Axe/.test(ids.get('phoneStoreCart').textContent),'the cart lists the things: '+ids.get('phoneStoreCart').textContent);
 assert(/delivery \$11\.00/.test(ids.get('phoneStoreTotals').textContent),'one small bag ($3) and one medium ($8): '+ids.get('phoneStoreTotals').textContent);
 const cash0=p().cash;ids.get('phoneStoreOrder').click();
 assert.equal(p().orders.queue.length,1,'the order is on the way');assert.equal(p().cash,cash0-(200+2000+1100),'paid: things and delivery');assert(/Order placed/.test(ids.get('phoneMessage').textContent));
 assert(/On the way to Studio 2B/.test(ids.get('phoneStoreOrders').children.map(c=>c.textContent).join('|')),'the Orders list shows it');
 {const cat=ids.get('phoneStoreCategory');cat.value='vehicles';cat.onchange();find('phoneStoreInfo-offroad').click();assert(!ids.get('phoneStoreInfoView').hidden&&ids.get('phoneStoreListView').hidden,'Info opens the vehicle view');assert(/Pevrolet/.test(ids.get('phoneStoreInfoName').textContent)&&/mph/.test(ids.get('phoneStoreInfoSpecs').textContent),ids.get('phoneStoreInfoSpecs').textContent);
  ids.get('phoneBack').onclick();assert(ids.get('phoneStoreInfoView').hidden&&!ids.get('phoneStoreListView').hidden,'Back closes the Info view first');assert(!ids.get('phoneScreen-store').hidden,'and stays in the Store');
  ids.get('phoneBack').onclick();assert(ids.get('phoneScreen-store').hidden&&!ids.get('phoneScreen-home').hidden,'Back again goes to the home screen');assert(ids.get('phoneBack').disabled,'nothing to go back to on the home screen')}
  ids.get('phoneClose').click();
 // before its time nothing waits; a day later it is at the locker
 pump(1);assert.equal(scene().getObjectByName('parcel-locker').visible,true,'the locker is there for a tenant');
 GameState.progress={...p(),housing:{...p().housing,day:p().housing.day+1}};pump(2);
 assert.equal(p().orders.queue.length,0);assert.equal(p().orders.drops[STUDIO_ID].reduce((n,l)=>n+l.qty,0),3,'three things wait at the studio locker');
 assert(/Your order has arrived/.test(ids.get('jobToast').textContent),'a toast says so: '+ids.get('jobToast').textContent);
 // walk to the locker and collect with E
 const d=dropSpot(STUDIO_ID);GameState.me.position.x=d.x;GameState.me.position.z=d.z+1.2;pump(1);
 assert(/Collect your order · 3 things/.test(ids.get('prompt').querySelector('span').textContent),'the prompt: '+ids.get('prompt').querySelector('span').textContent);
 send('keydown','KeyE');send('keyup','KeyE');pump(.5);
 assert.equal(p().inventory.slots.reduce((n,s)=>n+s.quantity,0),3,'the things are in the inventory');assert.equal(p().orders.drops[STUDIO_ID],undefined,'and the locker is empty'); // The dealership: the lot shows a vehicle for sale (E buys that colour), the phone lists only vehicles you own, a bought colour is sold out for days, and a vehicle ordered in the Store is parked on the driveway two game days later.
 {const wt=MAP.vehicles.find(v=>v.id==='eastbank-worktruck'),wc=CLASSES.worktruck,door=doorPoint(wt.home,wc),shown=()=>ids.get('phoneGarage').children.filter(c=>!c.hidden).length;
  ids.get('phoneButton').click();ids.get('phoneApp-player').click();assert.equal(shown(),1,'with no vehicle the phone shows only the note');ids.get('phoneClose').click();
  GameState.me.position.x=door.x;GameState.me.position.z=door.z;pump(1);
  assert(/Buy the Army olive Worktruck · \$4500\.00/.test(ids.get('prompt').querySelector('span').textContent),'the lot prompt: '+ids.get('prompt').querySelector('span').textContent);
  GameState.progress={...p(),cash:10};send('keydown','KeyE');send('keyup','KeyE');pump(.5);assert.equal(p().vehicles.length,0,'too poor to buy');
  GameState.progress={...p(),cash:2000000};send('keydown','KeyE');send('keyup','KeyE');pump(.5);assert.equal(p().vehicles.length,1,'bought on the lot');assert.equal(p().vehicles[0].colour,'olive');assert.equal(p().cash,2000000-450000);
  assert(scene().getObjectByName('vehicle-v1'),'the new vehicle is in the world');pump(1);
  assert(/Drive the Worktruck/.test(ids.get('prompt').querySelector('span').textContent),'now it can be driven: '+ids.get('prompt').querySelector('span').textContent);
  ids.get('phoneButton').click();ids.get('phoneApp-player').click();assert.equal(ids.get('phoneGarage').children.length,2,'the phone lists the vehicle you own (a card, and the hidden note)');assert.equal(shown(),1);ids.get('phoneClose').click();
  // sold out: the olive Worktruck is gone from the Store (greyed swatch) and the lot shows the next colour
  ids.get('phoneButton').click();ids.get('phoneApp-store').click();assert(find('phoneStoreColour-worktruck-olive').disabled,'the bought colour is sold out');assert(!find('phoneStoreColour-worktruck-red').disabled);
  assert(find('phoneStoreVehicle-worktruck').disabled,'a studio holds one vehicle: no room for a second');ids.get('phoneClose').click();
  {const r=propertyTransaction({...p(),cash:p().cash+3000000},'rent','house-r1');assert(!r.error,r.error);GameState.progress=r.state}
  ids.get('phoneButton').click();ids.get('phoneApp-store').click();const btn=find('phoneStoreVehicle-offroad');assert(!btn.disabled,'with a rented small house there is room for two');
  find('phoneStoreColour-offroad-red').click();const cash1=p().cash;btn.click();
  assert.equal(p().cash,cash1-1100000-15000,'price and delivery paid');assert(find('phoneStoreColour-offroad-red').disabled,'the ordered colour is reserved');ids.get('phoneClose').click();
  GameState.me.position.x=-5;GameState.me.position.z=15;
  GameState.progress={...p(),housing:{...p().housing,day:p().housing.day+3}};pump(2);
  assert.equal(p().vehicles.length,2,'the order arrived as a second vehicle');const parked=p().vehicles.find(v=>v.model==='offroad');assert.equal(parked.colour,'red');assert(Math.hypot(parked.x-MAP.studio.x,parked.z-MAP.studio.doorZ)<40,'near the studio: '+JSON.stringify(parked));
  assert(scene().getObjectByName('vehicle-'+parked.uid),'and it is in the world');assert(/has been delivered/.test(ids.get('jobToast').textContent),'a toast says so: '+ids.get('jobToast').textContent)} console.log('Store in the game: the phone Store needs a home, orders to the studio with the delivery fee, the parcel arrives a day later at the locker (a toast and a prompt), and E collects it into the inventory. The dealership: a lot prompt to buy, owned-only vehicle list, and a Store vehicle order parked near the studio two days later.');
}finally{await g.done()}
