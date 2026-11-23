import './legacy-keys.js';
import {normalizeCoolers} from './water-cooler.js';
import {MAP} from './map-definition.js';
import {freshInventory,normalizeInventory,hasItem} from './inventory.js';
import {itemById} from './items.js';
import {freshSkills,normalizeSkills,freshStats,normalizeStats} from './skills.js';
export const CAFE_OLD_PAY=1200; // diner D-A2: what one served customer of the retired cafe shift paid (2400 for two), used to settle a shift saved half done
import {normalizeRoutine} from './routine.js';
import {normalizeLife,normalizeDrainMultiplier} from './life.js';
import {freshHousing,normalizeHousing} from './housing.js';
import {normalizeHotel} from './hotel.js';
import {normalizeKioskShift,normalizeOutdoors} from './kiosk-shift.js';
import {normalizeFishingLog} from './fishing.js';
import {normalizeFreight} from './freight.js';
import {normalizeEdenWork} from './weld-core.js';
import {normalizeHunting} from './wildlife.js';
import {SCHEMA,normalizeProperties,normalizeNotices} from './ownership.js';
import {freshOrders,normalizeOrders} from './orders.js';
import {normalizeMessages,addMessage} from './messages.js';
import {normalizePlots,normalizeLogs,nextLogIdFor} from './grid.js';
import {isWalkable} from './world.js';
import {normalizeCarry,normalizeBelt,normalizePlankDrops,rescueCarry,normalizeCrateDrops,normalizeSlabDrops,BELT_SLOTS,PLANKS_PER_STACK} from './carry.js';
import {normalizeYard} from './sawmill-yard.js'; // P-B wiring: the player-fed sawmill yard (an optional field: no schema bump)
import {normalizeVehicles} from './vehicle.js';import {PARCEL_PIECES_ENABLED,migrateParcel,purgeOrphanParcels} from './cargo-items.js'; // cargo redesign C-B: the parcel as a real piece (off until game.js is wired)
import {freshGarage,normalizeGarage} from './garage.js'; // VD4: the repair shop's state (garage.js owns the rules; a later repair job calls them from here)
import {normalizeCareers,normalizeCompanies,START_REP} from './careers.js';
import {normalizeGigs,freshGigs,gameMinutes} from './gigs.js';import {activeView} from './gig-bridge.js';import {normalizeStarter,fresh as freshStarter} from './starter.js'; // 0.36: gigs and the starter story (optional fields, no schema bump)
import {normalizeShift,normalizePayStubs} from './shift.js';import {normalizePets,fresh as freshPets} from './pets.js'; // PET3: the cat (optional field, no schema bump)
import {expireOldPlankNeeds,normalizeBakeryStock,SACKS_PER_PALLET} from './bakery-needs.js';
import {normalizeWorld,TICK_MINUTE} from './world-state.js';import {normalizeNeeds} from './needs.js';import {normalizeNpcs,normalizeStanding} from './npc-life.js';import {normalizeTalkPeople,isEmptyTalk,migrateNpcsTalk} from './talk-memory.js';import {normalizeCrowdLife} from './npc-relations.js';import {normalizeRelationships} from './relationships.js'; // W-D1: the living world's saves (world-tick.js runs the daily tick); optional fields, no schema bump
import {migrateGroceries} from './grocery-migrate.js';import {normalizeWarmMeal} from './warm-meal.js';
import {normalizeComfort} from './weather.js';
export const MARKET={name:MAP.shops.market.name,x:MAP.shops.market.x,z:MAP.shops.market.z};
export const ROUTES=[
 {name:'18 Oak Street',description:'A grocery order for a resident at the apartments.',x:3.8,z:-7,pay:1200},
 {name:'Alder Coffee',description:'A fresh produce order for the coffee shop.',x:36,z:-6.3,pay:1400},
 {name:'Oak Street Laundry',description:'A grocery order for the laundry staff.',x:-10.2,z:-7,pay:1800}
];
export const PROGRESS_KEY='edenridge.progress.v1';
export const freshProgress=()=>({schema:SCHEMA,properties:{},homeNotices:[],cash:0,completed:0,phase:'available',activeJob:null,inventory:freshInventory(),settings:{statDrainMultiplier:1},position:null,housing:freshHousing(),life:normalizeLife(),routine:normalizeRoutine(),plots:{},equipped:null,skills:freshSkills(),stats:freshStats(),logs:[],nextLogId:1,carry:null,belt:0,plankDrops:[],vehicles:[],garage:freshGarage(),orders:freshOrders(),careers:{},companies:{},tutorial:{loggingSeen:false},shift:null,payStubs:[],focus:null,gigs:freshGigs(),starter:freshStarter(),pets:freshPets(),world:normalizeWorld(null,MAP.seed,0),needs:[],npcs:normalizeNpcs(null),standing:normalizeStanding(null)});
export const money=cents=>'$'+(cents/100).toFixed(2);
// diner D-A2: the old cafe shift (progress.cafe {employed, paidDay, served}) became the diner career. An employed player is hired at Rank 1 (lastShiftDay from paidDay), a shift saved half done is paid at the old rate, and progress.cafe is never read or written again. Idempotent: the saved result has no cafe field.
function migrateCafe(s,a){const c=a.cafe;if(!c||typeof c!=='object'||c.employed!==true||s.careers.diner?.hired||!MAP.employers.some(e=>e.id==='diner'))return;
 const day=Number.isSafeInteger(c.paidDay)&&c.paidDay>=0&&c.paidDay<=1e7?c.paidDay:0,served=Number.isSafeInteger(c.served)&&c.served>0&&c.stage!=='off'?Math.min(2,c.served):0,pay=served*CAFE_OLD_PAY;
 s.careers={...s.careers,diner:{hired:true,rank:1,rep:START_REP,shifts:0,lastShiftDay:day,granted:[],owed:[]}};if(pay){s.cash+=pay;s.routine={...s.routine,earned:s.routine.earned+pay}}s.messages=addMessage(s,{app:'jobs',text:'Elena: Alder Coffee & Diner is a real career now. You are on the crew as a Waiter: clock in on your phone (Jobs) or at the counter.'+(pay?' Your unfinished shift was paid: '+money(pay)+'.':''),at:gameMinutes(s)}).state.messages}
export const normalizeProgress=value=>normalizeProgressWith(value,PARCEL_PIECES_ENABLED); // pieces: the test switch (PARCEL_PIECES_ENABLED is a constant)
export function normalizeProgressWith(value,pieces){
 const a=value&&typeof value==='object'?value:{},s=freshProgress();
 if(Number.isSafeInteger(a.cash)&&a.cash>=0&&a.cash<=1e10)s.cash=a.cash;
 if(Number.isSafeInteger(a.completed)&&a.completed>=0&&a.completed<=100000)s.completed=a.completed;
 if(a.phase==='carrying')s.phase='carrying';
 if(a.position&&Number.isFinite(a.position.x)&&Number.isFinite(a.position.z)&&isWalkable(a.position.x,a.position.z))s.position={x:a.position.x,z:a.position.z};
 s.inventory=normalizeInventory(a.inventory);s.settings={statDrainMultiplier:normalizeDrainMultiplier(a.settings?.statDrainMultiplier)};
 s.activeJob=null; // an old save's cooldowns, gigBoard and activeJob keys are ignored; an old in-progress gig is cancelled with one phone message (below)
 // Saves from before the schema number (0.29 and earlier) are schema 1: they have no properties, which is exactly what a fresh save has, so the step to schema 2 only adds the fields.
 s.schema=SCHEMA;s.properties=normalizeProperties(a.properties);s.homeNotices=normalizeNotices(a.homeNotices);
 s.housing=normalizeHousing(a.housing);s.life=normalizeLife(a.life);s.routine=normalizeRoutine(a.routine);s.plots=normalizePlots(a.plots);s.skills=normalizeSkills(a.skills);s.stats=normalizeStats(a.stats);s.logs=normalizeLogs(a.logs);s.nextLogId=nextLogIdFor(a.nextLogId,s.logs);s.carry=normalizeCarry(a.carry);s.belt=normalizeBelt(a.belt);s.plankDrops=normalizePlankDrops(a.plankDrops);s.plankDrops=rescueCarry(s).plankDrops; // 0.35.6: a save stuck with full hands and a full ground is freed
 s.tutorial={loggingSeen:a.tutorial?.loggingSeen===true}; /* T-C: the logging guide (logging-tutorial.js) has been shown once */ {const cd=normalizeCrateDrops(a.crateDrops);if(cd.length)s.crateDrops=cd} // C-B: crates and boxes put down on the ground (an optional field: absent when there are none)
 {const sd=normalizeSlabDrops(a.slabDrops);if(sd.length)s.slabDrops=sd}if(Number.isSafeInteger(a.crewMark)&&a.crewMark>=0)s.crewMark=a.crewMark; // crewMark: the yard's logsSawn at the last world tick (world-tick.js demand gate; optional) // T-E (timber redesign): slabs put down on the ground (optional, absent when none). progress.logs keeps kind 'trunk' (grid.js normalizeLogs), carry takes two logs, a trunk or a slab (carry.js normalizeCarry), the yard loads v1 as v2 (sawmill-yard.js normalizeYard): no schema bump
 s.vehicles=normalizeVehicles(a.vehicles,MAP.vehicles,MAP.playable); s.garage=normalizeGarage(a.garage,s.vehicles); // VD4: vehicles in the repair shop and the hard-luck day (optional: an old save has none); 0.33: where the drivable vehicles were left (a new optional field: no schema bump)
 s.focus=typeof a.focus==='string'&&/^[a-z0-9:_-]{1,40}$/i.test(a.focus)?a.focus:null;s.messages=normalizeMessages(a.messages);s.coolers=normalizeCoolers(a.coolers);s.orders=normalizeOrders(a.orders); // messages: the phone's notifications (DESIGN 4.19); 0.34: Store orders and the main home (an optional field: no schema bump)
 s.careers=normalizeCareers(a.careers);migrateCafe(s,a);s.companies=normalizeCompanies(a.companies);s.shift=normalizeShift(a.shift,s.careers);s.payStubs=normalizePayStubs(a.payStubs);s.gigs=normalizeGigs(a.gigs);{const gig=s.gigs.active;s.vehicles=s.vehicles.map(v=>{if(!v.cargo?.some(c=>c.k==='bakery-pallet'))return v;const cargo=v.cargo.filter(c=>c.k!=='bakery-pallet'||(gig?.truck===v.uid&&gig.haul===SACKS_PER_PALLET&&gig.id===c.j&&gig.needGood===c.g));if(cargo.length)return {...v,cargo};const {cargo:unused,...withoutCargo}=v;return withoutCargo})}if(s.carry?.kind==='sack'&&(s.gigs.active?.id!==s.carry.gig||s.gigs.active.needGood!==s.carry.good||s.gigs.active.truck||s.gigs.active.haul!==1))s.carry=null;s.activeJob=activeView(s);s.starter=normalizeStarter(a.starter,s);s.pets=normalizePets(a.pets);{const tick=Math.max(0,s.routine.minutes>=TICK_MINUTE?s.housing.day-1:s.housing.day-2);s.world=normalizeWorld(a.world,MAP.seed,tick);if(s.world.day>tick)s.world={...s.world,day:tick}}s.needs=expireOldPlankNeeds(normalizeNeeds(a.needs),[s.gigs.active?.needId]);if(a.bakeryStock)s.bakeryStock=normalizeBakeryStock(a.bakeryStock);s.npcs=normalizeNpcs(a.npcs);s.standing=normalizeStanding(a.standing);{const tk=normalizeTalkPeople(a.talk);if(!isEmptyTalk(tk))s.talk=tk;s.npcs=migrateNpcsTalk(s.npcs,{...s,talk:tk},s.housing.day-1)}if(a.activeJob&&typeof a.activeJob==='object'&&typeof a.activeJob.id==='string'&&!a.activeJob.id.startsWith('gig-'))s.messages=addMessage(s,{app:'gigs',text:'Your old gig was cancelled. New gigs are on the board.',at:gameMinutes(s)}).state.messages; // 0.35: careers (DESIGN 4.15), optional fields: no schema bump
 // P-B wiring: the sawmill yard is the sawmill's ONE plank stock. A save without one (older than the wiring) gets a yard holding the world's sawmill planks plus the stacks left on the old belt, so nothing is lost or made. The belt is now only what the yard shows (up to 4 stacks).
 {const y=a.sawmillYard&&typeof a.sawmillYard==='object'&&!Array.isArray(a.sawmillYard)?normalizeYard(a.sawmillYard):normalizeYard({planks:(s.world.stock['property:sawmill']?.planks||0)+s.belt*PLANKS_PER_STACK});s.sawmillYard=y;s.belt=Math.min(BELT_SLOTS,Math.floor(y.planks/PLANKS_PER_STACK))}
 // A save from the first dealership build kept owned vehicles as ids in orders.owned: they become owned vehicles v1, v2 ... where they were left.
 if(Array.isArray(a.orders?.owned)&&!s.vehicles.length){const old=Array.isArray(a.vehicles)?a.vehicles:[],moved=[];for(const id of a.orders.owned){const slot=MAP.vehicles.find(v=>v.id===id);if(!slot)continue;const was=old.find(v=>v?.uid===id);moved.push({uid:'v'+(s.orders.nextVehicle+moved.length),model:slot.model,x:Number.isFinite(was?.x)?was.x:slot.home.x,z:Number.isFinite(was?.z)?was.z:slot.home.z,yaw:Number.isFinite(was?.yaw)?was.yaw:slot.home.yaw,fuelMgal:was?.fuelMgal})}
  s.vehicles=normalizeVehicles(moved,MAP.vehicles,MAP.playable);s.orders={...s.orders,nextVehicle:s.orders.nextVehicle+s.vehicles.length}}
 s.orders={...s.orders,nextVehicle:Math.max(s.orders.nextVehicle,...s.vehicles.map(v=>+v.uid.slice(1)+1))}; // a new vehicle never reuses an owned uid
 if(typeof a.starter?.loanUid==='string'&&!s.starter.loanUid)s.vehicles=s.vehicles.filter(v=>v.uid!==a.starter.loanUid); // G3: a loan truck whose story step no longer allows it (a broken save) is removed: nobody keeps a free extra truck
 const tool=itemById(a.equipped);s.equipped=tool?.type==='tool'&&hasItem(s,tool.id)?tool.id:null;
 if(a.warmMeal)s.warmMeal=normalizeWarmMeal(a.warmMeal);
 if(a.comfort)s.comfort=normalizeComfort(a.comfort);
 if(a.hotel)s.hotel=normalizeHotel(a.hotel);
 if(a.kioskShift){const ks=normalizeKioskShift(a.kioskShift);if(ks)s.kioskShift=ks}
 if(a.outdoors){const od=normalizeOutdoors(a.outdoors);if(od)s.outdoors=od}
 if(Array.isArray(a.fishingLog)){const fl=normalizeFishingLog(a.fishingLog);if(fl.length)s.fishingLog=fl}
 if(a.freight){const fr=normalizeFreight(a.freight);if(fr)s.freight=fr}
 if(a.edenWork){const ew=normalizeEdenWork(a.edenWork);if(ew)s.edenWork=ew}
 if(a.hunting){const ht=normalizeHunting(a.hunting);if(ht)s.hunting=ht}
 if(a.crowdLife){const cl=normalizeCrowdLife(a.crowdLife);if(Object.keys(cl).length)s.crowdLife=cl}
 if(a.relationships){const rel=normalizeRelationships(a.relationships);if(Object.keys(rel).length)s.relationships=rel}
 const migrated=migrateGroceries(s);
 if(pieces)return migrateParcel(purgeOrphanParcels(migrated)); // C-B: after vehicles and gigs are normalised: stray parcel pieces go, an old held parcel becomes a piece (hands, else stays held); safe to run twice
 return migrated;
}
export const routeFor=s=>ROUTES[s.completed%ROUTES.length];
export const targetFor=s=>s.phase==='carrying'?routeFor(s):MARKET;
export const nearby=(position,target)=>Math.hypot(position.x-target.x,position.z-target.z)<=2.5;
export function transactJob(state,action,position,context={}){
 const s=normalizeProgress(state);
 if(action==='pickup'&&s.phase==='available'&&context.shop==='market'&&Math.hypot(position.x,position.z+2)<=1.6)return {state:{...s,phase:'carrying'},paid:0};
 if(action==='deliver'&&s.phase==='carrying'&&(s.completed%3===1?context.shop==='cafe'&&Math.hypot(position.x,position.z+2)<=1.6:!context.shop&&Math.hypot(position.x-routeFor(s).x,position.z-routeFor(s).z)<=1.4)){const pay=routeFor(s).pay;return {state:{...s,phase:'available',completed:s.completed+1,cash:s.cash+pay,routine:{...s.routine,earned:s.routine.earned+pay}},paid:pay}}
 return {state:s,paid:0,error:'Speak to the market clerk to collect work, or use the marked delivery point.'};
}
export function loadProgress(storage){try{const a=JSON.parse(storage.getItem(PROGRESS_KEY));return a?.version===1?normalizeProgress(a.progress):freshProgress()}catch{return freshProgress()}}
export function saveProgress(storage,progress){try{storage.setItem(PROGRESS_KEY,JSON.stringify({version:1,progress:normalizeProgress(progress)}));return true}catch{return false}}
