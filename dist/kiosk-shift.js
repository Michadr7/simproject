// BZ2 kiosk POS shift & B3 outdoors rules (map-master 3.3, 4.3).
import {addXp} from './skills.js';
import {advanceTime} from './routine.js';
import {hasItem,normalizeInventory} from './inventory.js';
import {applyCampRestComfort,normalizeComfort} from './weather.js';

export const KIOSK_HOURS=Object.freeze([360,1320]);
export const KIOSK_CUSTOMERS_PER_SHIFT=4;
export const KIOSK_PER_SALE=450;
export const KIOSK_BASE_WAGE=1200;
export const LICENCE_PRICE_CENTS=15000;
export const LICENCE_DAYS=7;

export const KIOSK_ORDERS=Object.freeze([
 {customer:'commuter Sam',itemsText:'Pump 2 Unleaded + Coffee to Go',totalCents:2450,tipCents:100},
 {customer:'trucker Dale',itemsText:'Pump 1 Diesel + Beef Jerky & Water',totalCents:5200,tipCents:150},
 {customer:'hiker Maya',itemsText:'Bag of Ice + Trail Map + Soda',totalCents:1600,tipCents:75},
 {customer:'courier Leo',itemsText:'Motor Oil + Hotdog',totalCents:1550,tipCents:100},
 {customer:'forester Owen',itemsText:'2× Trail Sandwich + Water',totalCents:900,tipCents:75},
 {customer:'local Carla',itemsText:'Fuel Fill + Granola Bar',totalCents:3150,tipCents:125}
].map(Object.freeze));

export function normalizeKioskShift(val){
 if(!val||typeof val!=='object'||Array.isArray(val))return null;
 const n=(x,max)=>Number.isSafeInteger(x)&&x>=0&&x<=max?x:0;
 const active=val.active===true,rawDay=n(val.day,1e7),day=active&&rawDay<1?1:rawDay;
 const served=active?Math.min(KIOSK_CUSTOMERS_PER_SHIFT-1,n(val.served,KIOSK_CUSTOMERS_PER_SHIFT)):0;
 const earned=n(val.earned,1e7),lastDoneDay=n(val.lastDoneDay,1e7);
 if(!active&&!lastDoneDay&&!earned)return null;
 return {active,day,served,earned,lastDoneDay};
}

export function normalizeOutdoors(val){
 if(!val||typeof val!=='object'||Array.isArray(val))return null;
 const d=Number.isSafeInteger(val.licenceUntilDay)&&val.licenceUntilDay>0&&val.licenceUntilDay<=1e7?val.licenceUntilDay:0;
 const cf=Number.isSafeInteger(val.campFireUntil)&&val.campFireUntil>0&&val.campFireUntil<=1e9?val.campFireUntil:0;
 if(!d&&!cf)return null;
 return {...(d>0?{licenceUntilDay:d}:{}),...(cf>0?{campFireUntil:cf}:{})};
}

export const kioskOrderFor=(day=1,served=0)=>KIOSK_ORDERS[Math.abs((Math.trunc(day||1)*3+Math.trunc(served||0))%KIOSK_ORDERS.length)];

export function canStartKioskShift(progress){
 const mins=progress?.routine?.minutes??0;
 if(mins<KIOSK_HOURS[0]||mins>=KIOSK_HOURS[1])return {error:'Eastbank Fuel Kiosk cashier shifts run 6 AM–10 PM.'};
 if(progress?.shift)return {error:'Clock out of your current shift first.'};
 const day=progress?.housing?.day||1;
 if(progress?.kioskShift?.active)return {error:'You are already on a kiosk cashier shift.'};
 if(progress?.kioskShift?.lastDoneDay===day)return {error:'You already worked a kiosk shift today. Come back tomorrow!'};
 return {ok:true};
}

export function startKioskShift(progress){
 const check=canStartKioskShift(progress);
 if(check.error)return check;
 const day=progress?.housing?.day||1;
 const ks={active:true,day,served:0,earned:0,lastDoneDay:progress?.kioskShift?.lastDoneDay||0};
 return {state:{...progress,kioskShift:ks},order:kioskOrderFor(day,0),message:`Clocked in at Eastbank Fuel Kiosk (${KIOSK_CUSTOMERS_PER_SHIFT} sales to complete).`};
}

export function ringUpKioskCustomer(progress){
 const ks=progress?.kioskShift;
 if(!ks?.active)return {error:'Clock in at the kiosk counter first.'};
 const order=kioskOrderFor(ks.day,ks.served);
 const served=ks.served+1,done=served>=KIOSK_CUSTOMERS_PER_SHIFT;
 const paid=KIOSK_PER_SALE+order.tipCents+(done?KIOSK_BASE_WAGE:0);
 const life={...progress.life,energy:Math.max(0,(progress.life?.energy??100)-4)};
 let next={...progress,cash:(progress.cash||0)+paid,life,routine:{...progress.routine,earned:(progress.routine?.earned||0)+paid}};
 next=addXp(next,'hospitality',5).state;
 next=advanceTime(next,10);
 if(done)next={...next,standing:{...(next.standing||{}),town:(next.standing?.town||0)+1}};
 const totalEarned=(ks.earned||0)+paid;
 const nextKs={active:!done,day:ks.day,served:done?0:served,earned:totalEarned,lastDoneDay:done?ks.day:(ks.lastDoneDay||0)};
 next={...next,kioskShift:nextKs};
 const nextOrder=done?null:kioskOrderFor(ks.day,served);
 return {state:next,paid,completed:done,served,nextOrder,message:done?`Kiosk shift complete! Earned $${(totalEarned/100).toFixed(2)} today (+1 town standing).`:`Rang up ${order.customer} (+$${(paid/100).toFixed(2)}, ${served}/${KIOSK_CUSTOMERS_PER_SHIFT}).`};
}

export function endKioskShiftEarly(progress){
 const ks=progress?.kioskShift;
 if(!ks?.active)return {error:'Not on a kiosk shift.'};
 const nextKs={active:false,day:ks.day,served:0,earned:ks.earned||0,lastDoneDay:ks.served>0?ks.day:(ks.lastDoneDay||0)};
 return {state:{...progress,kioskShift:nextKs},message:ks.served>0?'Kiosk shift ended early.':'Kiosk shift cancelled.'};
}

export const hasHuntingLicence=progress=>(progress?.outdoors?.licenceUntilDay||0)>=(progress?.housing?.day||1);

export function buyHuntingLicence(progress,{discountMult=1}={}){
 const cost=Math.round(LICENCE_PRICE_CENTS*discountMult);
 if((progress?.cash||0)<cost)return {error:`You need $${(cost/100).toFixed(2)} for a 7-day Hunting Licence.`};
 const day=progress?.housing?.day||1;
 const until=Math.max(day,progress?.outdoors?.licenceUntilDay||0)+LICENCE_DAYS;
 return {state:{...progress,cash:progress.cash-cost,outdoors:{...(progress.outdoors||{}),licenceUntilDay:until}},cost,untilDay:until,message:`7-Day Hunting Licence active through Day ${until}.`};
}

export function restAtCamp(progress,campName='Blackstone Camp'){
 if(!hasItem(progress,'tent'))return {error:'You need a Camp Tent from Eden Outdoors to rest here.'};
 const inv=normalizeInventory(progress?.inventory);
 const idx=inv.slots.findIndex(s=>s.id==='firewood-bundle'&&s.quantity>0);
 const usedFirewood=idx>=0;
 if(usedFirewood){inv.slots[idx].quantity--;if(inv.slots[idx].quantity<=0)inv.slots.splice(idx,1)}
 const energy=usedFirewood?100:Math.max(progress?.life?.energy??0,75);
 const mins=progress?.routine?.minutes??0;
 const wait=mins<360?360-mins:1440-mins+360;
 let next={...progress,inventory:inv,life:{...progress.life,energy}};
 next=advanceTime(next,wait);
 const nowMin=((next.housing?.day||1)-1)*1440+(next.routine?.minutes||0);
 next={...next,comfort:applyCampRestComfort(normalizeComfort(progress?.comfort),usedFirewood,nowMin)};
 if(usedFirewood)next={...next,outdoors:{...(next.outdoors||{}),campFireUntil:nowMin+180}};
 return {state:next,usedFirewood,message:usedFirewood?`Rested by the campfire at ${campName} until 6:00 AM (Energy 100%, used 1 firewood).`:`Rested in your tent at ${campName} until 6:00 AM (Energy ${energy}%).`};
}
