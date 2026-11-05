import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {ITEMS,itemById} from '../dist/items.js';
import {SIZES,FEE_CENTS,BUNDLE,DELAY_MIN,VEHICLE_ORDER,sizeOf,catalogue,quote,placeOrder,deliverDue,takeDelivery,setMainHome,mainHome,homesHeld,dropSpot,etaText,nowMinutes,waiting,overview,normalizeOrders,STUDIO_ID,MAX_UNITS} from '../dist/orders.js';
import {VEHICLE_SLOTS,vehicleCapacity,vehicleCount,buyVehicle,orderVehicle,soldOnLot,soldOnline,parkingAim,VEHICLE_PRICE,inStock,restockMinutes,displayColour,vehicleLabel} from '../dist/orders.js';
import {coloursOf} from '../dist/paint.js';
import {propertyTransaction} from '../dist/ownership.js';
import {BASE_SLOTS} from '../dist/inventory.js';

// Size classes and fees: small $3 per six, medium $8 per two, large $25 each; a parcel takes as long as its slowest class.
assert.deepEqual(FEE_CENTS,{small:300,medium:800,large:2500});assert.deepEqual(DELAY_MIN,{small:180,medium:720,large:1440});assert.equal(VEHICLE_ORDER.fee,15000);assert.equal(VEHICLE_ORDER.delay,2880);
assert.equal(sizeOf(itemById('apple')),'small');assert.equal(sizeOf(itemById('axe')),'medium');assert.equal(sizeOf(itemById('small-backpack')),'medium');assert.equal(sizeOf(itemById('large-backpack')),'large');
assert(catalogue().every(c=>SIZES.includes(c.size))&&!catalogue().some(c=>c.item.id==='wood-log'),'every buyable item has a size; logs cannot be ordered');
{const q=quote([{id:'apple',qty:6}]);assert.equal(q.fee,300,'six small things are one bundle');assert.equal(quote([{id:'apple',qty:7}]).fee,600);
 const mix=quote([{id:'apple',qty:1},{id:'axe',qty:3},{id:'large-backpack',qty:2}]);assert.equal(mix.fee,300+2*800+2*2500,'fees add up by class');assert.equal(mix.delayMin,1440,'the slowest class sets the delay');assert.equal(mix.subtotal,100+3*2000+2*4500);assert.equal(mix.total,mix.subtotal+mix.fee);
 assert.equal(quote([]).units,0);assert.equal(quote([{id:'nope',qty:2},{id:'apple',qty:-1},{id:'apple',qty:.5}]).units,0,'junk lines are dropped');assert.equal(quote([{id:'apple',qty:2},{id:'apple',qty:3}]).units,2,'a repeated item counts once')}
assert.equal(etaText(100,100),'arriving now');assert.equal(etaText(250,100),'in 2 h 30 min');assert.equal(etaText(100+1440*2,100),'in 2 days');assert.equal(etaText(130,100),'in 30 min');

// Homes: nobody who has no home can order; the studio or a rented house can; the main home is the first unless you choose.
const base=()=>({...freshProgress(),cash:100000});
{const p=base();assert.deepEqual(homesHeld(p),[]);assert.equal(mainHome(p),null);const r=placeOrder(p,[{id:'apple',qty:1}]);assert(/need a home/.test(r.error),'no home, no delivery: '+r.error)}
const studio={...base(),housing:{...base().housing,rented:true}};
assert.deepEqual(homesHeld(studio).map(h=>h.id),[STUDIO_ID]);assert.equal(mainHome(studio),STUDIO_ID);
const house=MAP.properties.find(p=>p.listing),withHouse=propertyTransaction(studio,'rent',house.id).state;
assert.deepEqual(homesHeld(withHouse).map(h=>h.id),[STUDIO_ID,house.id]);assert.equal(mainHome(withHouse),STUDIO_ID,'the first home is the default main home');
{const r=setMainHome(withHouse,house.id);assert.equal(mainHome(r.state),house.id);assert.equal(setMainHome(withHouse,'nowhere').error!==undefined,true,'only a held home can be main');
 const left={...r.state,properties:{}};assert.equal(mainHome(left),STUDIO_ID,'if you leave your main home the next one takes over')}
// drop spots exist for every home and are clear of the building
for(const id of [STUDIO_ID,house.id]){const d=dropSpot(id);assert(d&&Number.isFinite(d.x)&&Number.isFinite(d.z),id+' has a drop spot')}
assert.equal(dropSpot(STUDIO_ID).kind,'locker');assert.equal(dropSpot(house.id).kind,'box');assert.equal(dropSpot('nowhere'),null);

// Ordering: pay, wait, receive, collect.
{let p=studio;const cartItems=[{id:'apple',qty:2},{id:'axe',qty:1}],q=quote(cartItems);
 const r=placeOrder(p,cartItems);assert(!r.error,r.error);p=r.state;assert.equal(p.cash,100000-q.total);assert.equal(p.orders.queue.length,1);assert.equal(p.orders.queue[0].arrivesAt,nowMinutes(studio)+720);assert(/arrives \w{3} \d+:\d\d [AP]M \(in 12 h\)/.test(r.message),r.message);
 assert.equal(deliverDue(p),p,'nothing arrives early');assert.equal(waiting(p,STUDIO_ID),0);
 const later={...p,routine:{...p.routine,minutes:p.routine.minutes+719}};assert.equal(deliverDue(later).orders.queue.length,1,'one minute early');
 const on={...p,housing:{...p.housing,day:p.housing.day+1}};const d=deliverDue(on);assert.equal(d.orders.queue.length,0);assert.equal(waiting(d,STUDIO_ID),3,'two apples and an axe wait at the locker');
 assert.equal(overview(d).waiting[0].units,3);
 const took=takeDelivery(d,STUDIO_ID);assert(!took.error,took.error);assert.equal(took.taken,3);assert.equal(waiting(took.state,STUDIO_ID),0);assert.equal(took.state.inventory.slots.reduce((n,s)=>n+s.quantity,0),3);
 assert(takeDelivery(took.state,STUDIO_ID).error,'nothing left to take');
 // a full inventory leaves the rest at the door
 const fullInv={...d,inventory:{...d.inventory,slots:Array.from({length:BASE_SLOTS},(_,i)=>({id:'water',quantity:10}))}};const f=takeDelivery(fullInv,STUDIO_ID);assert(f.error&&/full/.test(f.error));assert.equal(waiting(f.state,STUDIO_ID),3,'nothing is lost')}
// refusals
{const poor={...studio,cash:100};assert(/You need/.test(placeOrder(poor,[{id:'axe',qty:1}]).error));assert(/cart is empty/.test(placeOrder(studio,[]).error));assert(/cart is empty/.test(placeOrder(studio,[{id:'vehicle:worktruck',qty:1}]).error),'vehicles are not cart lines');
 assert(/need a home/.test(placeOrder(studio,[{id:'apple',qty:1}],'cedar-nope').error));assert(/cart is empty/.test(placeOrder(studio,[{id:'apple',qty:MAX_UNITS+1}]).error),'more than one order can hold is not a valid line')}
// the queue is limited
{let p=studio;for(let i=0;i<8;i++){const r=placeOrder(p,[{id:'apple',qty:1}]);assert(!r.error,r.error);p=r.state}assert(/too many orders/.test(placeOrder(p,[{id:'apple',qty:1}]).error))}

// Saving: round trip and junk
{const r=placeOrder(studio,[{id:'apple',qty:2}]).state,again=normalizeProgress(JSON.parse(JSON.stringify(r)));assert.deepEqual(again.orders.queue,r.orders.queue);
 assert.deepEqual(normalizeOrders(null),{main:null,nextId:1,nextVehicle:1,queue:[],drops:{},stock:{}});assert.deepEqual(normalizeProgress({}).orders,normalizeOrders());
 const junk=normalizeOrders({main:'x',nextId:'y',queue:[{id:1,home:'studio',items:[{id:'nope',qty:1}]},{id:2,home:'ghost',items:[{id:'apple',qty:1}]},7],drops:{studio:[{id:'apple',qty:-3}],ghost:[{id:'apple',qty:1}]}});
 assert.deepEqual(junk,{main:null,nextId:1,nextVehicle:1,queue:[],drops:{},stock:{}},'bad saved orders are dropped')}
// Vehicles: bought on the lot or ordered to a home, in a colour; a sold colour restocks after 3 to 6 game days; they park on the driveway on arrival; each home holds some.
{const models=Object.keys(VEHICLE_PRICE),rich={...studio,cash:5000000},m=models[0],c0=coloursOf(m)[0].id,c1=coloursOf(m)[1].id;
 assert.deepEqual([...models].sort(),['offroad','worktruck'],'both drivable models have a price');
 assert.equal(vehicleCount(rich),0);assert(inStock(rich,m,c0));assert.equal(displayColour(rich,m),c0,'the lot shows the first colour in stock');
 const bought=buyVehicle(rich,m,c0);assert(!bought.error,bought.error);const own=bought.state;assert.equal(own.vehicles.length,1);assert.equal(own.vehicles[0].uid,'v1');assert.equal(own.vehicles[0].colour,c0);assert.equal(own.cash,rich.cash-VEHICLE_PRICE[m]);
 assert.deepEqual([own.vehicles[0].x,own.vehicles[0].z],[MAP.vehicles.find(v=>v.model===m).home.x,MAP.vehicles.find(v=>v.model===m).home.z],'a lot purchase stands where the display vehicle stood');
 assert(!inStock(own,m,c0),'that colour is sold out');assert(restockMinutes(own,m,c0)>=3*1440&&restockMinutes(own,m,c0)<=6*1440+0,'restock in 3 to 6 game days: '+restockMinutes(own,m,c0));assert.equal(displayColour(own,m),c1,'the lot now shows the next colour');
 assert(/sold out/.test(buyVehicle(own,m,c0).error));assert(/no room/.test(buyVehicle(own,m,c1).error),'a studio holds one vehicle');assert(/not made/.test(buyVehicle(rich,m,'pink').error));assert(/not for sale/.test(buyVehicle(rich,'tractor',c0).error)); assert(soldOnLot('worktruck')&&soldOnline('worktruck')&&soldOnLot('offroad')&&soldOnline('offroad'),'both models are sold on the lot and online (sale: both)');assert(!soldOnLot('tractor')&&!soldOnline('tractor'),'an unknown model is sold nowhere');assert(/You need/.test(buyVehicle({...studio,cash:100},m,c0).error));
 // restock: the colour is back after its time (a game day later is not enough, a week is)
 const day=n=>({...own,housing:{...own.housing,day:own.housing.day+n}});assert(!inStock(day(2),m,c0),'not yet');assert(inStock(day(7),m,c0),'a week later it is back');
 // a second home gives room; the second buy gets the next uid
 const housed=propertyTransaction(own,'rent','house-r1');assert(!housed.error,housed.error);const two={...housed.state,cash:5000000};assert.equal(vehicleCapacity(two),2);const second=buyVehicle(two,'offroad',coloursOf('offroad')[2].id);assert(!second.error,second.error);assert.deepEqual(second.state.vehicles.map(v=>v.uid),['v1','v2']);assert.equal(second.state.orders.nextVehicle,3);
 // ordering: paid now with the delivery fee, the colour reserved, delivered to the driveway later as a new owned vehicle
 const ord=orderVehicle(rich,m,c1);assert(!ord.error,ord.error);assert.equal(ord.state.cash,rich.cash-VEHICLE_PRICE[m]-VEHICLE_ORDER.fee);assert.equal(ord.state.orders.queue[0].arrivesAt,nowMinutes(rich)+2880);assert.equal(ord.state.vehicles?.length||0,0,'not yours until it arrives');assert(!inStock(ord.state,m,c1),'the colour is reserved');assert.equal(vehicleCount(ord.state),1,'an ordered vehicle takes the slot');
 assert(/no room/.test(orderVehicle(ord.state,m,c0).error));assert.equal(deliverDue(ord.state),ord.state,'not early');
 const arrived=deliverDue({...ord.state,housing:{...ord.state.housing,day:ord.state.housing.day+3}});assert.equal(arrived.vehicles.length,1);assert.equal(arrived.vehicles[0].colour,c1);assert.equal(arrived.orders.queue.length,0);assert.equal(arrived.vehicles[0].uid,'v1');
 const aim=parkingAim(STUDIO_ID);assert(aim&&Number.isFinite(aim.x+aim.z+aim.yaw));assert.equal(vehicleCount(arrived),1);
 assert(/home to receive/.test(orderVehicle({...freshProgress(),cash:5000000},m,c0).error),'a home is needed');
 assert.deepEqual(normalizeOrders(JSON.parse(JSON.stringify(ord.state.orders))),ord.state.orders,'saves round-trip');
 assert.equal(overview(ord.state).queue[0].vehicle,vehicleLabel(m,c1));
 // room: a studio holds 1; studio plus a small house 2; delivered to a house, it parks on that plot's driveway spot
 assert.deepEqual(VEHICLE_SLOTS,{apartment:1,small:1,medium:2,large:3});const plot=MAP.reserved.find(r=>r.id==='R1'),at=parkingAim('house-r1');assert.deepEqual([at.x,at.z],[plot.park.x,plot.park.z],'delivered to the house driveway spot');
 // migration: the first dealership build saved owned ids; they become v1, v2 where they were left
 const old=normalizeProgress({orders:{owned:['eastbank-worktruck']},vehicles:[{uid:'eastbank-worktruck',model:'worktruck',x:120,z:30,yaw:1,fuelMgal:5000}]});assert.equal(old.vehicles.length,1);assert.deepEqual([old.vehicles[0].uid,old.vehicles[0].model,old.vehicles[0].x,old.vehicles[0].fuelMgal],['v1','worktruck',120,5000]);assert.equal(old.orders.nextVehicle,2)}console.log('Orders: size-class fees (small $3 per six, medium $8 per two, large $25), delay by the slowest class, a home is needed, the main home setting, parcels wait at the locker or box and are collected into the inventory (a full inventory leaves the rest), at most 8 orders at once, vehicles bought on the lot or ordered (one of each, parked near the home on arrival), and save round trips.');
