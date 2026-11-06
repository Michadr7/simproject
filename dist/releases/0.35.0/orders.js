// The Store app's orders (0.34): you order things on the phone, pay the price and a delivery fee, and the parcel is delivered some game hours later to a home you rent or own (your "main" home by
// default). It waits at that home's drop spot until you collect it: a parcel locker beside the studio's entrance, a parcel box on the grass in front of a house's door.
// Everything here is pure (integer cents, minutes of game time), and tests/orders.mjs checks it. Saved as `progress.orders` (an optional field: no schema bump).
//   {main: homeId | null, nextId, queue: [{id, home, items: [{id, qty}], subtotal, fee, placedAt, arrivesAt}], drops: {[homeId]: [{id, qty}]}}
// Times are minutes of game time counted from the start of day 1 (nowMinutes).
import {itemById,isBuyable,ITEMS} from './items.js';
import {addItem,requirementError} from './inventory.js';
import {levelOf} from './skills.js';
import {normalizeProperties} from './ownership.js';
import {MAP} from './map-definition.js';
import {doorOf,propertyById} from './properties.js';
import {validColour,colourOf,coloursOf} from './paint.js';
import {weekday} from './housing.js';
import {formatClock} from './routine.js';

export const STUDIO_ID='studio';
// Size classes. The fee is per bundle: a bundle holds BUNDLE units of a class (six small things travel in one bag, a big thing needs its own van).
export const SIZES=Object.freeze(['small','medium','large']);
export const FEE_CENTS=Object.freeze({small:300,medium:800,large:2500}),BUNDLE=Object.freeze({small:6,medium:2,large:1}),DELAY_MIN=Object.freeze({small:180,medium:720,large:1440});
// Vehicles (0.34): the dealership on the Eastbank depot lot sells the two drivable models, each in six colours (paint.js). Buy on the lot (E at the door: yours at once, parked where it stands), or order from the phone: a delivery fee and
// two game days later it is parked on your home's driveway. Prices in cents, per model. A sold colour is out of stock for 3 to 6 game days (restock), so one buyer cannot clear the lot; the lot's display vehicles show what is in stock.
export const VEHICLE_PRICE=Object.freeze({worktruck:450000,offroad:1100000,flatbed:800000});export const RESTOCK_DAYS=Object.freeze({min:3,max:6});
// How many vehicles a home holds (DESIGN 4.14): an apartment 1; a house by its size (MAP.properties size). The limit is the sum over the homes you rent or own; owned and on-the-way vehicles both count.
export const VEHICLE_SLOTS=Object.freeze({apartment:1,small:1,medium:2,large:3});
export const VEHICLE_ORDER=Object.freeze({fee:15000,delay:2880});
export const MAX_UNITS=30,MAX_QUEUE=8;
const cash=n=>'$'+(n/100).toFixed(2);

// What size an item is: its own `size` if the data says so, else by kind (food and drink are small; clothing, tools and small bags medium; big bags and materials large).
export function sizeOf(item){
 if(!item)return 'small';if(SIZES.includes(item.size))return item.size;
 if(item.type==='food'||item.type==='drink')return 'small';
 if(item.type==='equipment')return item.slotBonus>=20?'large':'medium';
 if(item.type==='tool')return 'medium';
 return 'large';
}
export const orderable=item=>!!item&&isBuyable(item);
export const catalogue=()=>ITEMS.filter(orderable).map(item=>({item,size:sizeOf(item)}));

// ── Time ──────────────────────────────────────────────────────────────────────────────────────────────────
export const nowMinutes=p=>((p.housing?.day||1)-1)*1440+Math.floor(p.routine?.minutes||0);
// The arrival as the in-game clock shows it (the weekday and time on the phone), so the player never has to convert hours: 'Tue 3:00 PM'.
export const arrivalText=at=>weekday(Math.floor(at/1440)+1).slice(0,3)+' '+formatClock(at%1440);
export function etaText(arrivesAt,now){
 const left=Math.max(0,arrivesAt-now);if(left<=0)return 'arriving now';
 const days=Math.floor(left/1440),hours=Math.floor(left%1440/60),minutes=Math.ceil(left%60);
 return days?`in ${days} day${days===1?'':'s'}${hours?` ${hours} h`:''}`:hours?`in ${hours} h${minutes&&minutes<60?` ${minutes} min`:''}`:`in ${minutes} min`;
}

// ── Homes ─────────────────────────────────────────────────────────────────────────────────────────────────
// The homes you can have things delivered to: the studio while you rent it, and every house you rent or own.
export function homesHeld(p){
 const out=[];if(p.housing?.rented)out.push({id:STUDIO_ID,name:'Studio 2B',kind:'apartment'});
 for(const id of Object.keys(normalizeProperties(p.properties)))out.push({id,name:MAP.properties.find(q=>q.id===id)?.name||id,kind:'house'});
 return out;
}
export const holds=(p,id)=>homesHeld(p).some(h=>h.id===id);
// The main home: the one you set, if you still hold it, else the first home you hold, else null.
export function mainHome(p){const held=homesHeld(p);if(!held.length)return null;const set=p.orders?.main;return held.some(h=>h.id===set)?set:held[0].id}
// Where the parcel waits: a locker by the studio's entrance, or a box on the grass in front of a house's door, a little to one side of the path.
export function dropSpot(id){
 if(id===STUDIO_ID)return {x:MAP.studio.x+2.6,z:MAP.studio.doorZ+1.1,kind:'locker',yaw:0};
 const property=propertyById(id),door=property&&doorOf(property);if(!door)return null;
 const sx=door.faceZ,sz=-door.faceX; // sideways along the wall
 return {x:+(door.x+door.faceX*2.4+sx*1.8).toFixed(2),z:+(door.z+door.faceZ*2.4+sz*1.8).toFixed(2),kind:'box',yaw:Math.atan2(door.faceX,door.faceZ)};
}

// ── Saving ────────────────────────────────────────────────────────────────────────────────────────────────
export const freshOrders=()=>({main:null,nextId:1,nextVehicle:1,queue:[],drops:{},stock:{}});
const int=(v,lo,hi,d)=>Number.isSafeInteger(v)&&v>=lo&&v<=hi?v:d;
function normalizeLines(list,limit=MAX_UNITS){
 const out=[],seen=new Set();
 for(const l of Array.isArray(list)?list:[]){const item=itemById(l?.id);if(!orderable(item)||seen.has(item.id))continue;const qty=int(l.qty,1,limit,0);if(qty){seen.add(item.id);out.push({id:item.id,qty})}}
 return out;
}
export function normalizeOrders(value){
 const out=freshOrders();if(!value||typeof value!=='object')return out;
 if(typeof value.main==='string'&&(value.main===STUDIO_ID||MAP.properties.some(p=>p.id===value.main&&p.listing)))out.main=value.main;
 out.nextId=int(value.nextId,1,1e9,1);
 for(const o of (Array.isArray(value.queue)?value.queue:[]).slice(0,MAX_QUEUE)){
  const items=normalizeLines(o?.items),vehicle=typeof o?.vehicle==='string'&&VEHICLE_PRICE[o.vehicle]&&validColour(o.vehicle,o.colour)?o.vehicle:null;if((!items.length&&!vehicle)||typeof o.home!=='string'||!dropSpot(o.home))continue;
  out.queue.push({id:int(o.id,1,1e9,out.nextId),home:o.home,items:vehicle?[]:items,...(vehicle?{vehicle,colour:o.colour}:{}),subtotal:int(o.subtotal,0,1e9,0),fee:int(o.fee,0,1e9,0),placedAt:int(o.placedAt,0,1e9,0),arrivesAt:int(o.arrivesAt,0,1e9,0)});
 }
 for(const [home,list] of Object.entries(value.drops&&typeof value.drops==='object'?value.drops:{})){if(!dropSpot(home))continue;const items=normalizeLines(list,1000);if(items.length)out.drops[home]=items}
 for(const [key,at] of Object.entries(value.stock&&typeof value.stock==='object'?value.stock:{})){const [model,colour]=key.split(':');if(VEHICLE_PRICE[model]&&validColour(model,colour)&&Number.isSafeInteger(at)&&at>0&&at<1e9)out.stock[key]=at}
 out.nextVehicle=int(value.nextVehicle,1,1e6,1);
 out.nextId=Math.max(out.nextId,...out.queue.map(o=>o.id+1),1);
 return out;
}

// ── The cart and what it costs ────────────────────────────────────────────────────────────────────────────────
// cart: [{id, qty}]. Returns {lines, units, subtotal, fee, total, delayMin, bySize, error?}.
export function quote(cart){
 const lines=normalizeLines(cart,MAX_UNITS).map(l=>{const item=itemById(l.id);return {id:l.id,name:item.name,icon:item.icon,qty:l.qty,size:sizeOf(item),unit:item.price,total:item.price*l.qty}});
 const units=lines.reduce((n,l)=>n+l.qty,0),bySize={};for(const l of lines)bySize[l.size]=(bySize[l.size]||0)+l.qty;
 const fee=SIZES.reduce((sum,s)=>sum+(bySize[s]?Math.ceil(bySize[s]/BUNDLE[s])*FEE_CENTS[s]:0),0);
 const delayMin=SIZES.reduce((m,s)=>bySize[s]?Math.max(m,DELAY_MIN[s]):m,0),subtotal=lines.reduce((n,l)=>n+l.total,0);
 return {lines,units,subtotal,fee,total:subtotal+fee,delayMin,bySize};
}

// ── Transactions (pure: a new progress, or {error}) ───────────────────────────────────────────────────────────
export function placeOrder(p,cart,home){
 const orders=normalizeOrders(p.orders),fail=error=>({state:p,error}),q=quote(cart);
 if(!q.units)return fail('Your cart is empty.');
 for(const line of q.lines){const locked=requirementError(p,itemById(line.id));if(locked)return fail(locked)}
 if(q.units>MAX_UNITS)return fail(`One order can hold ${MAX_UNITS} things.`);
 const target=home||mainHome(p);
 if(!target||!holds(p,target))return fail('You need a home to receive an order. Rent a studio or a house first.');
 if(orders.queue.length>=MAX_QUEUE)return fail('You have too many orders on the way. Wait for one to arrive.');
 if(p.cash<q.total)return fail(`You need ${cash(q.total)}: ${cash(q.subtotal)} for the things and ${cash(q.fee)} delivery.`);
 const now=nowMinutes(p),entry={id:orders.nextId,home:target,items:q.lines.map(l=>({id:l.id,qty:l.qty})),subtotal:q.subtotal,fee:q.fee,placedAt:now,arrivesAt:now+q.delayMin};
 const name=homesHeld(p).find(h=>h.id===target).name;
 return {state:{...p,cash:p.cash-q.total,orders:{...orders,nextId:orders.nextId+1,queue:[...orders.queue,entry]}},order:entry,message:`Order placed: ${cash(q.total)} with ${cash(q.fee)} delivery. It arrives ${arrivalText(entry.arrivesAt)} (${etaText(entry.arrivesAt,now)}) at ${name}.`};
}
// Moves every parcel whose time has come from the queue to its home's drop spot. Returns the same progress object when nothing is due.
export function deliverDue(p){
 const orders=normalizeOrders(p.orders),now=nowMinutes(p),due=orders.queue.filter(o=>o.arrivesAt<=now);if(!due.length)return p;
 const drops={...orders.drops};
 const fleet=[...(p.vehicles||[])];let nextVehicle=orders.nextVehicle;
 for(const o of due){if(o.vehicle){const aim=parkingAim(o.home),slot=MAP.vehicles.find(v=>v.model===o.vehicle);if(aim&&slot)fleet.push({uid:'v'+nextVehicle,model:o.vehicle,colour:o.colour,x:aim.x,z:aim.z,yaw:aim.yaw,fuelMgal:slot.fuel.tankMgal});nextVehicle++;continue}const list=(drops[o.home]||[]).map(l=>({...l}));for(const l of o.items){const at=list.find(x=>x.id===l.id);if(at)at.qty+=l.qty;else list.push({...l})}drops[o.home]=list}
 return {...p,vehicles:fleet,orders:{...orders,nextVehicle,queue:orders.queue.filter(o=>o.arrivesAt>now),drops}};
}
export const waiting=(p,home)=>(normalizeOrders(p.orders).drops[home]||[]).reduce((n,l)=>n+l.qty,0);
export const waitingHomes=p=>Object.keys(normalizeOrders(p.orders).drops).filter(h=>holds(p,h)&&waiting(p,h)>0);
// Picks up what waits at a home's drop spot, as much as the inventory has room for (the rest stays).
export function takeDelivery(p,home){
 const orders=normalizeOrders(p.orders),list=orders.drops[home];if(!list||!list.length)return {state:p,error:'Nothing is waiting here.'};
 let progress=p,taken=0,left=[],full=false;
 for(const l of list){let rest=l.qty;
  while(rest>0&&!full){const r=addItem(progress,l.id);if(r.error){full=true;break}progress=r.state;rest--;taken++}
  if(rest>0)left.push({id:l.id,qty:rest})}
 const drops={...orders.drops};if(left.length)drops[home]=left;else delete drops[home];
 const state={...progress,orders:{...orders,drops}};
 if(!taken)return {state:p,error:'Your inventory is full. Make room, then collect your order.'};
 return {state,taken,message:left.length?`You took ${taken} things. Your inventory is full: the rest waits here.`:`You collected your order (${taken} thing${taken===1?'':'s'}).`};
}
export function setMainHome(p,id){
 if(!holds(p,id))return {state:p,error:'You can only choose a home you rent or own.'};
 const orders=normalizeOrders(p.orders);if(mainHome(p)===id&&orders.main===id)return {state:p,message:'That is already your main home.'};
 return {state:{...p,orders:{...orders,main:id}},message:`${homesHeld(p).find(h=>h.id===id).name} is now your main home. Orders go there.`};
}
// ── Vehicles ─────────────────────────────────────────────────────────────────────────────────────────────────
const slotsOf=h=>h.kind==='apartment'?VEHICLE_SLOTS.apartment:VEHICLE_SLOTS[MAP.properties.find(q=>q.id===h.id)?.size]||1;
export const vehicleCapacity=p=>homesHeld(p).reduce((n,h)=>n+slotsOf(h),0);
export const ownedVehicles=p=>p.vehicles||[];
// The vehicles you own plus the ones on the way: both take a place.
export const vehicleCount=p=>ownedVehicles(p).length+normalizeOrders(p.orders).queue.filter(q=>q.vehicle).length;
const noRoom=p=>vehicleCount(p)>=vehicleCapacity(p)?`You have no room for another vehicle (${vehicleCount(p)} of ${vehicleCapacity(p)}). Rent or buy another home first: an apartment holds 1, a small house 1, a medium house 2, a large house 3.`:null;
export const vehicleName=model=>MAP.vehicles.find(v=>v.model===model)?.name||model;
export const vehicleLabel=(model,colour)=>`${colourOf(model,colour)?.name||''} ${vehicleName(model)}`.trim();
// Stock: a colour you buy is out of stock for 3 to 6 game days. The number of days comes from counters (no random numbers: the same save always gives the same days).
const restockDays=(orders,model,colour)=>RESTOCK_DAYS.min+Math.abs(orders.nextVehicle*7+orders.nextId*3+coloursOf(model).findIndex(c=>c.id===colour)*5)%(RESTOCK_DAYS.max-RESTOCK_DAYS.min+1);
export const restockMinutes=(p,model,colour)=>Math.max(0,(normalizeOrders(p.orders).stock[`${model}:${colour}`]||0)-nowMinutes(p));
export const inStock=(p,model,colour)=>VEHICLE_PRICE[model]!==undefined&&validColour(model,colour)&&restockMinutes(p,model,colour)===0;
// The colour the lot's display vehicle of a model shows: the first colour that is in stock, or null when every colour is sold out.
export const displayColour=(p,model)=>coloursOf(model).find(c=>inStock(p,model,c.id))?.id||null;
// Where a model is sold (MAP.vehicles[].sale): 'dealership' on the lot only, 'online' from the phone only, 'both'.
export const soldOnLot=model=>{const s=MAP.vehicles.find(v=>v.model===model)?.sale;return s==='dealership'||s==='both'};
export const soldOnline=model=>{const s=MAP.vehicles.find(v=>v.model===model)?.sale;return s==='online'||s==='both'};
// A model may need a skill level before it can be bought (MAP.vehicles[].requires): the sentence to show, or null.
export function vehicleLock(p,model){const r=MAP.vehicles.find(v=>v.model===model)?.requires;if(!r)return null;const level=levelOf(p.skills?.[r.skill]?.xp||0).level;return level>=r.level?null:`Needs ${r.skill[0].toUpperCase()+r.skill.slice(1)} level ${r.level} (you are level ${level}).`}
function checkBuyable(p,model,colour,where){
 if(!VEHICLE_PRICE[model])return 'That vehicle is not for sale.';{const lock=vehicleLock(p,model);if(lock)return `The ${vehicleLabel(model,colour)}: ${lock[0].toLowerCase()+lock.slice(1)}`}if(where==='lot'&&!soldOnLot(model))return 'That vehicle is sold online only: order it from the phone Store.';if(where==='order'&&!soldOnline(model))return 'That vehicle is sold at the dealership only: buy it on the lot.';if(!validColour(model,colour))return 'That colour is not made.';
 if(!inStock(p,model,colour))return `The ${vehicleLabel(model,colour)} is sold out: it is back in ${Math.ceil(restockMinutes(p,model,colour)/1440)} game day(s).`;
 return noRoom(p);
}
const sold=(orders,p,model,colour)=>({...orders.stock,[`${model}:${colour}`]:nowMinutes(p)+restockDays(orders,model,colour)*1440});
// Buying on the lot: you pay the price and the vehicle is yours where it stood. Returns the new progress, the new vehicle entry, and a message.
export function buyVehicle(p,model,colour){
 const orders=normalizeOrders(p.orders),fail=error=>({state:p,error}),price=VEHICLE_PRICE[model],bad=checkBuyable(p,model,colour,'lot');
 if(bad)return fail(bad);
 if(p.cash<price)return fail(`You need ${cash(price)} to buy the ${vehicleLabel(model,colour)}.`);
 const slot=MAP.vehicles.find(v=>v.model===model),entry={uid:'v'+orders.nextVehicle,model,colour,x:slot.home.x,z:slot.home.z,yaw:slot.home.yaw,fuelMgal:slot.fuel.tankMgal};
 return {state:{...p,cash:p.cash-price,vehicles:[...ownedVehicles(p),entry],orders:{...orders,nextVehicle:orders.nextVehicle+1,stock:sold(orders,p,model,colour)}},vehicle:entry,message:`You bought the ${vehicleLabel(model,colour)} for ${cash(price)}. The keys are yours.`};
}
// Ordering from the phone: the price and the delivery fee now, and two game days later it is parked on the home's driveway.
export function orderVehicle(p,model,colour,home){
 const orders=normalizeOrders(p.orders),fail=error=>({state:p,error}),price=VEHICLE_PRICE[model];
 const target=home||mainHome(p);if(price&&(!target||!holds(p,target)))return fail('You need a home to receive a vehicle. Rent a studio or a house first.');
 const bad=checkBuyable(p,model,colour,'order');if(bad)return fail(bad);
 if(orders.queue.length>=MAX_QUEUE)return fail('You have too many orders on the way. Wait for one to arrive.');
 const total=price+VEHICLE_ORDER.fee;if(p.cash<total)return fail(`You need ${cash(total)}: ${cash(price)} for the vehicle and ${cash(VEHICLE_ORDER.fee)} delivery.`);
 const now=nowMinutes(p),entry={id:orders.nextId,home:target,items:[],vehicle:model,colour,subtotal:price,fee:VEHICLE_ORDER.fee,placedAt:now,arrivesAt:now+VEHICLE_ORDER.delay};
 return {state:{...p,cash:p.cash-total,orders:{...orders,nextId:orders.nextId+1,queue:[...orders.queue,entry],stock:sold(orders,p,model,colour)}},order:entry,message:`Ordered the ${vehicleLabel(model,colour)}: ${cash(total)} with ${cash(VEHICLE_ORDER.fee)} delivery. It arrives ${arrivalText(entry.arrivesAt)} (${etaText(entry.arrivesAt,now)}) at ${homesHeld(p).find(h=>h.id===target).name}.`};
}
// Where a delivered vehicle is aimed: a few metres in front of the home's door, facing along the street.
export function parkingAim(home){
 if(!dropSpot(home))return null;if(home===STUDIO_ID)return {x:MAP.studio.x+8,z:MAP.studio.doorZ+9,yaw:Math.PI/2};
 const park=MAP.reserved.find(r=>r.id===propertyById(home)?.plot)?.park;if(park)return {x:park.x,z:park.z,yaw:park.heading==='south'?0:Math.PI}; // the house's own driveway spot, nose toward the house
 const door=doorOf(propertyById(home));return {x:+(door.x+door.faceX*7).toFixed(2),z:+(door.z+door.faceZ*7).toFixed(2),yaw:Math.atan2(door.faceZ,-door.faceX)};
}
// A summary for the screen: {homes, main, queue (with eta text), waiting}.
export function overview(p){
 const orders=normalizeOrders(p.orders),now=nowMinutes(p),held=homesHeld(p);
 return {homes:held,main:mainHome(p),queue:orders.queue.map(o=>({...o,eta:`${arrivalText(o.arrivesAt)} (${etaText(o.arrivesAt,now)})`,homeName:held.find(h=>h.id===o.home)?.name||o.home,units:o.vehicle?1:o.items.reduce((n,l)=>n+l.qty,0),vehicle:o.vehicle?vehicleLabel(o.vehicle,o.colour):null})),waiting:waitingHomes(p).map(h=>({home:h,name:held.find(x=>x.id===h).name,units:waiting(p,h)}))};
}
