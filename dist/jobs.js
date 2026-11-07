import {normalizeCoolers} from './water-cooler.js';
import {MAP} from './map-definition.js';
import {freshInventory,normalizeInventory,hasItem} from './inventory.js';
import {itemById} from './items.js';
import {freshSkills,normalizeSkills,freshStats,normalizeStats} from './skills.js';
import {normalizeActiveJob,normalizeCooldowns,normalizeGigBoard} from './contracts.js';
import {normalizeCafe} from './cafe-job.js';
import {normalizeRoutine} from './routine.js';
import {normalizeLife,normalizeDrainMultiplier} from './life.js';
import {freshHousing,normalizeHousing} from './housing.js';
import {SCHEMA,normalizeProperties,normalizeNotices} from './ownership.js';
import {freshOrders,normalizeOrders} from './orders.js';
import {normalizeMessages} from './messages.js';
import {normalizePlots,normalizeLogs,nextLogIdFor} from './grid.js';
import {isWalkable} from './world.js';
import {normalizeCarry,normalizeBelt,normalizePlankDrops} from './carry.js';
import {normalizeVehicles} from './vehicle.js';
import {normalizeCareers,normalizeCompanies} from './careers.js';
import {normalizeShift,normalizePayStubs} from './shift.js';
export const MARKET={name:MAP.shops.market.name,x:MAP.shops.market.x,z:MAP.shops.market.z};
export const ROUTES=[
 {name:'18 Oak Street',description:'A grocery order for a resident at the apartments.',x:3.8,z:-7,pay:1200},
 {name:'Alder Coffee',description:'A fresh produce order for the coffee shop.',x:36,z:-6.3,pay:1400},
 {name:'Oak Street Laundry',description:'A grocery order for the laundry staff.',x:-10.2,z:-7,pay:1800}
];
export const PROGRESS_KEY='citylife.progress.v1';
export const freshProgress=()=>({schema:SCHEMA,properties:{},homeNotices:[],cash:0,completed:0,phase:'available',activeJob:null,inventory:freshInventory(),settings:{statDrainMultiplier:1},cooldowns:{},gigBoard:{ids:[],refreshAt:0},position:null,housing:freshHousing(),life:normalizeLife(),routine:normalizeRoutine(),cafe:normalizeCafe(),plots:{},equipped:null,skills:freshSkills(),stats:freshStats(),logs:[],nextLogId:1,carry:null,belt:0,plankDrops:[],vehicles:[],orders:freshOrders(),careers:{},companies:{},shift:null,payStubs:[],focus:null});
export const money=cents=>'$'+(cents/100).toFixed(2);
export function normalizeProgress(value){
 const a=value&&typeof value==='object'?value:{},s=freshProgress();
 if(Number.isSafeInteger(a.cash)&&a.cash>=0&&a.cash<=1e10)s.cash=a.cash;
 if(Number.isSafeInteger(a.completed)&&a.completed>=0&&a.completed<=100000)s.completed=a.completed;
 if(a.phase==='carrying')s.phase='carrying';
 if(a.position&&Number.isFinite(a.position.x)&&Number.isFinite(a.position.z)&&isWalkable(a.position.x,a.position.z))s.position={x:a.position.x,z:a.position.z};
 s.inventory=normalizeInventory(a.inventory);s.settings={statDrainMultiplier:normalizeDrainMultiplier(a.settings?.statDrainMultiplier)};
 s.activeJob=normalizeActiveJob(a.activeJob);s.cooldowns=normalizeCooldowns(a.cooldowns);s.gigBoard=normalizeGigBoard(a.gigBoard);
 // Saves from before the schema number (0.29 and earlier) are schema 1: they have no properties, which is exactly what a fresh save has, so the step to schema 2 only adds the fields.
 s.schema=SCHEMA;s.properties=normalizeProperties(a.properties);s.homeNotices=normalizeNotices(a.homeNotices);
 s.housing=normalizeHousing(a.housing);s.life=normalizeLife(a.life);s.routine=normalizeRoutine(a.routine);s.cafe=normalizeCafe(a.cafe);s.plots=normalizePlots(a.plots);s.skills=normalizeSkills(a.skills);s.stats=normalizeStats(a.stats);s.logs=normalizeLogs(a.logs);s.nextLogId=nextLogIdFor(a.nextLogId,s.logs);s.carry=normalizeCarry(a.carry);s.belt=normalizeBelt(a.belt);s.plankDrops=normalizePlankDrops(a.plankDrops);
 s.vehicles=normalizeVehicles(a.vehicles,MAP.vehicles,MAP.playable); // 0.33: where the drivable vehicles were left (a new optional field: no schema bump)
 s.focus=typeof a.focus==='string'&&/^[a-z0-9:_-]{1,40}$/i.test(a.focus)?a.focus:null;s.messages=normalizeMessages(a.messages);s.coolers=normalizeCoolers(a.coolers);s.orders=normalizeOrders(a.orders); // messages: the phone's notifications (DESIGN 4.19); 0.34: Store orders and the main home (an optional field: no schema bump)
 s.careers=normalizeCareers(a.careers);s.companies=normalizeCompanies(a.companies);s.shift=normalizeShift(a.shift,s.careers);s.payStubs=normalizePayStubs(a.payStubs); // 0.35: careers (DESIGN 4.15), optional fields: no schema bump
 // A save from the first dealership build kept owned vehicles as ids in orders.owned: they become owned vehicles v1, v2 ... where they were left.
 if(Array.isArray(a.orders?.owned)&&!s.vehicles.length){const old=Array.isArray(a.vehicles)?a.vehicles:[],moved=[];for(const id of a.orders.owned){const slot=MAP.vehicles.find(v=>v.id===id);if(!slot)continue;const was=old.find(v=>v?.uid===id);moved.push({uid:'v'+(s.orders.nextVehicle+moved.length),model:slot.model,x:Number.isFinite(was?.x)?was.x:slot.home.x,z:Number.isFinite(was?.z)?was.z:slot.home.z,yaw:Number.isFinite(was?.yaw)?was.yaw:slot.home.yaw,fuelMgal:was?.fuelMgal})}
  s.vehicles=normalizeVehicles(moved,MAP.vehicles,MAP.playable);s.orders={...s.orders,nextVehicle:s.orders.nextVehicle+s.vehicles.length}}
 s.orders={...s.orders,nextVehicle:Math.max(s.orders.nextVehicle,...s.vehicles.map(v=>+v.uid.slice(1)+1))}; // a new vehicle never reuses an owned uid
 const tool=itemById(a.equipped);s.equipped=tool?.type==='tool'&&hasItem(s,tool.id)?tool.id:null;return s;
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
