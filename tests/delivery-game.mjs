import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {ticketsOf,stagingOf,DESTINATIONS} from '../dist/tickets.js';
import {dropSpot} from '../dist/orders.js';
import {DOCK_DOOR,HALL} from '../dist/warehouse-layout.js';
import {DOCK_BAY} from '../dist/customers.js';
import {addPlanks,removePlanks,countOf} from '../dist/cargo.js';

// Delivery orders (0.35 step 4, DESIGN 4.16 C): a staged delivery is loaded through the loading door onto a truck with a bed parked outside, driven to the house, and unloaded at its drop spot.
// Pure part: planks on and off a bed.
{const a=addPlanks(null,'flatbed',10);assert.deepEqual(a.cargo,[{k:'planks',n:4},{k:'planks',n:4},{k:'planks',n:2}]);assert.equal(countOf(a.cargo,'planks'),10);
 const r=removePlanks([{k:'log'},...a.cargo],6);assert.deepEqual(r.cargo,[{k:'log'},{k:'planks',n:4}],'the last stacks come off first, a partial stack is cut');assert.equal(removePlanks(a.cargo,11).error!==undefined,true,'fewer than asked is refused');
 assert(addPlanks(null,'flatbed',200).error,'200 planks do not fit');assert(addPlanks(null,'car',4).error,'a car has no bed');assert.equal(removePlanks(a.cargo,10).cargo,null,'all of it off leaves an empty bed')}

const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3,DEST=DESTINATIONS[0],DUE=(DAY-1)*1440+1440+1080;
const ticket=(status,extra={})=>({nextId:2,day:DAY,released:[0,1,2,3],list:[{id:1,customer:'Greenway Builders',kind:'delivery',planks:12,issuedAt:(DAY-1)*1440+540,dueAt:DUE,status,staged:12,takenBy:'me',dest:DEST,...extra}]});
const setup=(g,tk)=>{const {GameState}=g,p=()=>GameState.progress;GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<5)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
 GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:700}};GameState.progress=clockIn(p(),'ridgeline').state;
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...(p().companies?.ridgeline||{}),tickets:tk}}}};
const flat=(x,z,yaw,cargo)=>({uid:'v1',model:'flatbed',colour:'blue',x,z,yaw,fuelMgal:30000,...(cargo?{cargo}:{})});

// 1) loading: a staged delivery at the dock door, a flatbed parked outside
{const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z},progress:{vehicles:[flat(DOCK_BAY.x,DOCK_BAY.z,Math.PI/2)],orders:{nextVehicle:2}}});
 try{const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent,press=(c='KeyE',s=1.2)=>{send('keydown',c);send('keyup',c);pump(s)};
  const planks=()=>scene().getObjectByName('vehicle-v1').getObjectByName('cargo-planks').count,list=()=>ticketsOf(p().companies.ridgeline).list;
  setup(g,ticket('staged'));pump(1.2);
  assert.deepEqual(stagingOf(p().companies.ridgeline).map(k=>k&&k.id),[1,null,null],'a delivery holds a staging pallet too');
  pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),prompt());press('KeyE',2.5);
  me().x=DOCK_DOOR.x-1.6;me().z=HALL.halfD-1;pump(.6);assert(/Load order #1 onto the Tylan Flatbed · 12 planks/.test(prompt()),'the dock offers the load: '+prompt());
  assert.equal(planks(),0);press('KeyE',1.2);
  assert.equal(list()[0].status,'loaded','the order is on the truck');assert.equal(list()[0].vehicle,'v1');assert(planks()>0,'the bed shows the planks');
  assert.equal(p().shift.pieces.deliveries||0,0,'not paid until it is delivered');assert.equal(stagingOf(p().companies.ridgeline).every(k=>!k),true,'the pallet is free again');
 }finally{g.close?.()}}

// 1b) no truck outside: the dock says so and nothing changes
{const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
 try{const {GameState,pump,send,ids}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent,press=(c='KeyE',s=1.2)=>{send('keydown',c);send('keyup',c);pump(s)};
  setup(g,ticket('staged'));pump(1.8);press('KeyE',2.5);me().x=DOCK_DOOR.x-1.6;me().z=HALL.halfD-1;pump(.6);assert(/park a truck with a bed outside/.test(prompt()),prompt());press('KeyE',.6);
  assert.equal(ticketsOf(p().companies.ridgeline).list[0].status,'staged');
 }finally{g.close?.()}}

// 2) unloading: the loaded order, the truck at the house, E at the drop spot
{const d=dropSpot(DEST),at={x:d.x-12,z:d.z-9};
 const g=await bootGame({position:{x:d.x,z:d.z},progress:{vehicles:[flat(at.x,at.z,0,[{k:'planks',n:4},{k:'planks',n:4},{k:'planks',n:4}])],orders:{nextVehicle:2}}});
 try{const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,prompt=()=>ids.get('prompt').querySelector('span').textContent,press=(c='KeyE',s=1.2)=>{send('keydown',c);send('keyup',c);pump(s)};
  const planks=()=>scene().getObjectByName('vehicle-v1').getObjectByName('cargo-planks').count,list=()=>ticketsOf(p().companies.ridgeline).list;
  setup(g,ticket('loaded',{vehicle:'v1'}));pump(1.2);assert(planks()>0,'planks on the bed to begin with');
  pump(.6);assert(new RegExp('Unload order #1 here · 12 planks for Greenway Builders').test(prompt()),'the drop spot offers it: '+prompt());
  const pieces0=p().shift.pieces.deliveries||0;press('KeyE',1.2);
  assert.equal(list()[0].status,'done','delivered');assert.equal(p().shift.pieces.deliveries,pieces0+1,'counted as a delivery');assert.equal(planks(),0,'the planks left the bed');
  assert(/delivered/.test(ids.get('jobToast').textContent+prompt()+''),'it says so');
 }finally{g.close?.()}}

// 2b) the truck has gone elsewhere: refused, nothing taken
{const d=dropSpot(DEST);
 const g=await bootGame({position:{x:d.x,z:d.z},progress:{vehicles:[flat(DOCK_BAY.x,DOCK_BAY.z,Math.PI/2,[{k:'planks',n:4},{k:'planks',n:4},{k:'planks',n:4}])],orders:{nextVehicle:2}}});
 try{const {GameState,pump,send,ids}=g,p=()=>GameState.progress,press=(c='KeyE',s=1.2)=>{send('keydown',c);send('keyup',c);pump(s)};
  setup(g,ticket('loaded',{vehicle:'v1'}));pump(1.8);press('KeyE',1);
  assert.equal(ticketsOf(p().companies.ridgeline).list[0].status,'loaded','still on the truck');
 }finally{g.close?.()}}
console.log('PASS delivery-game.mjs: a delivery takes a staging pallet, E at the dock door loads it onto a truck with a bed parked outside (refused with none), it is paid and counted only when unloaded at the house\'s drop spot with the truck near, and a truck left far away refuses.');
