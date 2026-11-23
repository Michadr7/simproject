// B3 (Eden Outdoors + camps) and BZ2 (Eastbank Fuel Kiosk + Kaspian Bay retail) tests.
import assert from 'node:assert/strict';
import {ITEMS,itemById,isConsumable} from '../dist/items.js';
import {categoryOf} from '../dist/store-categories.js';
import {addItem,countItem} from '../dist/inventory.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {addXp,normalizeSkills,freshSkills} from '../dist/skills.js';
import {propertyById,doorOf} from '../dist/properties.js';
import {isDowntownShop,downtownOpen} from '../dist/downtown-rooms.js';
import {createIronwoodInterior,ALL_IRONWOOD_SERVICES} from '../dist/ironwood-interiors.js';
import {
 KIOSK_HOURS,KIOSK_CUSTOMERS_PER_SHIFT,KIOSK_PER_SALE,KIOSK_BASE_WAGE,LICENCE_PRICE_CENTS,LICENCE_DAYS,
 startKioskShift,ringUpKioskCustomer,endKioskShiftEarly,buyHuntingLicence,hasHuntingLicence,restAtCamp,kioskOrderFor
} from '../dist/kiosk-shift.js';

// 1. B3 / BZ2 items & store categories
const NEW_IDS=['jerky','coffee-to-go','clam-chowder','fish-tacos','fishing-rod','bait-pack','lure-set','tent','firewood-bundle','binoculars','trail-map','motor-oil','ice-bag','rope-coil','life-jacket'];
for(const id of NEW_IDS){
 const item=itemById(id);
 assert(item&&item.price>0&&item.icon,id+' exists in ITEMS');
 assert(categoryOf(item),id+' maps to a valid store category');
}
assert.equal(isConsumable(itemById('jerky')),true);
assert.equal(isConsumable(itemById('coffee-to-go')),true);
assert(ITEMS.findIndex(i=>i.id==='tent')>=0);

// 2. Public shops, doors, interiors & services
const SHOPS=['eden-outdoors','eastbank-gas-kiosk','kaspian-chandlery','kaspian-shack'];
for(const id of SHOPS){
 const prop=propertyById(id);
 assert(prop&&prop.access==='public'&&prop.exteriorDoor===true,id+' is open & public');
 assert.equal(isDowntownShop(id),true,id+' routed through downtown rooms');
 const door=doorOf(prop);
 assert(door&&Number.isFinite(door.x)&&Number.isFinite(door.z),id+' has a door');
 const svc=ALL_IRONWOOD_SERVICES[id];
 assert(svc&&svc.actions.length>=5,id+' has services/stock');
 for(const a of svc.actions)if(a.item)assert(itemById(a.item),id+' references valid item '+a.item);
 const room=createIronwoodInterior(id);
 assert(room.clerk?.group&&room.staff.length>=1&&!room.blocked(0,4.5)&&room.blocked(0,-6),id+' interior walkable & walled');
 assert.equal(downtownOpen(prop,{minutes:prop.hours[0]}),true);
 assert.equal(downtownOpen(prop,{minutes:prop.hours[1]}),false);
}

// 3. BZ2 Kiosk POS cashier shift lifecycle & persistence
{let p=freshProgress();
 p.routine={...p.routine,minutes:300};
 assert(startKioskShift(p).error,'refuses before 6 AM');
 p.routine={...p.routine,minutes:540};
 assert(startKioskShift({...p,shift:{employer:'ridgeline'}}).error,'blocked while clocked into another job');
 const s0=startKioskShift(p);assert(!s0.error&&s0.order);p=s0.state;
 assert(startKioskShift(p).error,'cannot double-start');
 let tips=0;
 for(let i=0;i<KIOSK_CUSTOMERS_PER_SHIFT;i++){
  tips+=kioskOrderFor(p.housing.day,i).tipCents;
  const r=ringUpKioskCustomer(p);
  assert(!r.error,'customer '+(i+1)+' succeeds');
  p=r.state;
  assert.equal(r.completed,i===KIOSK_CUSTOMERS_PER_SHIFT-1);
 }
 assert.equal(p.cash,KIOSK_CUSTOMERS_PER_SHIFT*KIOSK_PER_SALE+tips+KIOSK_BASE_WAGE);
 assert.equal(p.skills.hospitality.xp,20);
 assert.equal(p.standing.town,1);
 assert.equal(p.kioskShift.active,false);
 assert.equal(p.kioskShift.lastDoneDay,p.housing.day);
 assert(startKioskShift(p).error,'cannot repeat same day');
 const saved=normalizeProgress(JSON.parse(JSON.stringify(p)));
 assert.deepEqual(saved.kioskShift,p.kioskShift,'kioskShift survives save/load');
 assert.equal(normalizeProgress(freshProgress()).kioskShift,undefined,'fresh save omits empty kioskShift');
 // Early clock-out with 0 sales still allows restarting today; after 1 sale locks today
 let early=startKioskShift({...freshProgress(),routine:{minutes:600,earned:0,shiftStep:0,shiftDay:0}}).state;
 early=endKioskShiftEarly(early).state;
 assert.equal(early.kioskShift.active,false);
 assert(!startKioskShift(early).error,'0-sale cancel stays retryable');
 early=startKioskShift(early).state;early=ringUpKioskCustomer(early).state;early=endKioskShiftEarly(early).state;
 assert(startKioskShift(early).error,'partial shift locks today');
}

// 4. B3 Hunting licence & Blackstone camp rest
{let p={...freshProgress(),cash:20000};
 assert.equal(hasHuntingLicence(p),false);
 assert(buyHuntingLicence({...p,cash:100}).error,'checks cash');
 const b=buyHuntingLicence(p);assert(!b.error&&b.cost===LICENCE_PRICE_CENTS);
 p=b.state;assert.equal(p.cash,5000);assert.equal(p.outdoors.licenceUntilDay,1+LICENCE_DAYS);
 assert.equal(hasHuntingLicence(p),true);
 const norm=normalizeProgress(JSON.parse(JSON.stringify(p)));
 assert.equal(norm.outdoors.licenceUntilDay,1+LICENCE_DAYS,'licenceUntilDay persists');
 // Camp rest: needs tent, optional firewood consumes 1 & gives 100% energy, advances to 06:00 next day
 assert(restAtCamp(p,'Plunge Pool Camp').error,'refuses without tent');
 p=addItem(p,'tent').state;p.life={...p.life,energy:20};p.routine={...p.routine,minutes:1200};
 const r1=restAtCamp(p,'Plunge Pool Camp');assert(!r1.error&&!r1.usedFirewood);
 assert.equal(r1.state.life.energy,75);assert.equal(r1.state.housing.day,2);assert.equal(r1.state.routine.minutes,360);
 let wf=addItem(p,'firewood-bundle').state;
 const r2=restAtCamp(wf,'High Saddle Camp');assert(!r2.error&&r2.usedFirewood);
 assert.equal(r2.state.life.energy,100);assert.equal(countItem(r2.state,'firewood-bundle'),0);
}

// 5. Optional fishing & hunting skills persist cleanly
{let st={skills:freshSkills()};
 st=addXp(st,'fishing',45).state;st=addXp(st,'hunting',75).state;
 const norm=normalizeSkills(st.skills);
 assert.equal(norm.fishing.xp,45);assert.equal(norm.hunting.xp,75);
}

console.log(`PASS b3-bz2: Kiosk POS shift ($${(KIOSK_BASE_WAGE/100).toFixed(0)} wage + 4 sales), 4 new open interiors, 15 B3/BZ2 items, 7-day licence, tent/firewood camp rest (${KIOSK_HOURS[0]/60} AM–${KIOSK_HOURS[1]/60-12} PM)`);
