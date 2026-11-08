import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {ticketsOf,stagingOf,DESTINATIONS} from '../dist/tickets.js';
import {dropSpot} from '../dist/orders.js';
import {DOCK_DOOR,HALL} from '../dist/warehouse-layout.js';
import {DOCK_BAY} from '../dist/customers.js';
import {ZONE,IN} from '../dist/dock.js';
import {BAY} from '../dist/forklift.js';
import {CARRY_Z} from '../dist/fork-pallets.js';
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');
import {addPlanks,removePlanks,countOf,freeCount,orderCount,orderIdsOf,removeOrderPlanks,takeAll,unloadOne,unloadKind,normalizeCargo,cargoText} from '../dist/cargo.js';

// Delivery orders (0.35 step 4, DESIGN 4.16 C): a staged delivery is loaded through the loading door onto a truck with a bed parked outside, driven to the house, and unloaded at its drop spot.
// Pure part: planks on and off a bed.
{const a=addPlanks(null,'flatbed',10);assert.deepEqual(a.cargo,[{k:'planks',n:4},{k:'planks',n:4},{k:'planks',n:2}]);assert.equal(countOf(a.cargo,'planks'),10);
 const r=removePlanks([{k:'log'},...a.cargo],6);assert.deepEqual(r.cargo,[{k:'log'},{k:'planks',n:4}],'the last stacks come off first, a partial stack is cut');assert.equal(removePlanks(a.cargo,11).error!==undefined,true,'fewer than asked is refused');
 assert(addPlanks(null,'flatbed',200).error,'200 planks do not fit');assert(addPlanks(null,'car',4).error,'a car has no bed');assert.equal(removePlanks(a.cargo,10).cargo,null,'all of it off leaves an empty bed')}

// Pure: an order's planks are the customer's, not yours (playtest 2026-11-06: the planks of a missed delivery stayed on the truck and could be sold)
{const own={k:'planks',n:3},tagged=addPlanks([{k:'log'},own],'flatbed',10,7).cargo;
 assert.deepEqual(tagged.slice(2),[{k:'planks',n:4,o:7},{k:'planks',n:4,o:7},{k:'planks',n:2,o:7}],'the order\'s stacks carry its id');assert.equal(freeCount(tagged,'planks'),3,'only your own planks are yours');assert.equal(orderCount(tagged,7),10);assert.deepEqual(orderIdsOf(tagged),[7]);assert.equal(countOf(tagged,'planks'),13,'the bed still holds all of them');
 assert.match(cargoText(tagged),/1 log, 3 planks, 10 planks for order #7/);
 // the lumberyard sale and the customer\'s truck take only what is yours
 const sold=takeAll(tagged,'planks');assert.equal(sold.count,3);assert.deepEqual(sold.cargo.filter(p=>p.k==='planks'),[{k:'planks',n:4,o:7},{k:'planks',n:4,o:7},{k:'planks',n:2,o:7}],'the order\'s planks stay on the bed');assert.equal(takeAll(sold.cargo,'planks').count,0);
 // by hand: the last piece that is yours; none left: refused with the order named
 const hand=unloadOne(null,tagged,'flatbed');assert.deepEqual(hand.carry,{kind:'planks',count:3});assert.equal(orderCount(hand.cargo,7),10);assert.match(unloadOne(null,hand.cargo.filter(p=>p.k!=='log'),'flatbed').error,/belong to order #7/);
 assert.match(unloadKind(null,tagged.filter(p=>p.o),'flatbed','planks').error,/belong to order #7/);assert.deepEqual(unloadKind(null,tagged,'flatbed','planks').carry,{kind:'planks',count:3});
 // only delivering (or the order failing) takes them off
 const off=removeOrderPlanks(tagged,7);assert.equal(off.count,10);assert.deepEqual(off.cargo,[{k:'log'},own],'yours stays');assert.equal(removeOrderPlanks(tagged,8).count,0);assert.equal(removeOrderPlanks(addPlanks(null,'flatbed',4,7).cargo,7).cargo,null);
 // saved: the tag survives, junk does not
 assert.deepEqual(normalizeCargo([{k:'planks',n:4,o:7},{k:'planks',n:2,o:-3},{k:'planks',n:1,o:'x'}],'flatbed'),[{k:'planks',n:4,o:7},{k:'planks',n:2},{k:'planks',n:1}])}
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3,DEST=DESTINATIONS[0],DUE=(DAY-1)*1440+1440+1080;
const ticket=(status,extra={})=>({nextId:2,day:DAY,released:[0,1,2,3],list:[{id:1,customer:'Greenway Builders',kind:'delivery',planks:12,issuedAt:(DAY-1)*1440+540,dueAt:DUE,status,staged:12,takenBy:'me',dest:DEST,...extra}]});
const setup=(g,tk,pallets)=>{const {GameState}=g,p=()=>GameState.progress;GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<5)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
 GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:700}};GameState.progress=clockIn(p(),'ridgeline').state;
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...(p().companies?.ridgeline||{}),tickets:tk,...(pallets?{pallets}:{})}}}};
const flat=(x,z,yaw,cargo)=>({uid:'v1',model:'flatbed',colour:'blue',x,z,yaw,fuelMgal:30000,...(cargo?{cargo}:{})});

// 1) loading (D3): the delivery's pallet on the forklift, out through the roller door and onto the loading zone, a flatbed parked beside it
const toTheZone=async(g)=>{const {pump,send,ids,win}=g,me=()=>g.GameState.me.position,fork=()=>win.__city.fork,press=(c='KeyE',s=1.2)=>{send('keydown',c);send('keyup',c);pump(s)};
 pump(1.8);press('KeyE',2.5);await new Promise(r=>setTimeout(r,400));pump(.8);me().x=BAY.x;me().z=BAY.z+2.3;pump(.6);press('KeyE',.6);assert.equal(fork().on,true,'on the forklift');
 const place=(x,z,yaw,lift=.3)=>{fork().state={x,z,yaw,speed:0,lift,steer:0,roll:0};pump(.3)};place(IN.x,8.6,0);send('keydown','KeyW');pump(3);send('keyup','KeyW');pump(.8);assert.equal(fork().where,'outside','out on the apron');
 place(ZONE.x,ZONE.z+CARRY_Z,Math.PI,.6);return {place,note:()=>ids.get('vpNote').textContent,drop:()=>{send('keydown','KeyF');pump(1.5);send('keyup','KeyF');pump(.1)}}};
const orderPallet=[{id:1,product:'planks',count:12,at:{fork:true},order:1}];
{const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z},progress:{vehicles:[flat(DOCK_BAY.x,DOCK_BAY.z,Math.PI)],orders:{nextVehicle:2}}});
 try{const {GameState,pump,ids,scene}=g,p=()=>GameState.progress;
  const planks=()=>scene().getObjectByName('vehicle-v1').getObjectByName('cargo-planks').count,list=()=>ticketsOf(p().companies.ridgeline).list;
  setup(g,ticket('staged'),orderPallet);pump(1.2);
  assert.deepEqual(stagingOf(p().companies.ridgeline).map(k=>k&&k.id),[1,null,null],'a delivery holds a staging pallet too');
  const z=await toTheZone(g);assert.equal(planks(),0);z.drop();
  assert.equal(list()[0].status,'loaded','the order is on the truck');assert(p().vehicles.find(v=>v.uid==='v1').cargo.every(c=>c.o===1),'the planks on the truck are tagged with the order');assert.match(ids.get('jobToast').textContent,/\d+ Cedar Loop, Cedar Heights/,'the toast names the address: '+ids.get('jobToast').textContent);assert.equal(p().focus,'ticket:1','and it is the focused task');assert.equal(list()[0].vehicle,'v1');assert(planks()>0,'the bed shows the planks');
  assert.equal(p().shift.pieces.deliveries||0,0,'not paid until it is delivered');assert.equal(stagingOf(p().companies.ridgeline).every(k=>!k),true,'the pallet is free again');assert(!(p().companies.ridgeline.pallets||[]).some(q=>q.order),'and the order pallet is used up');
 }finally{g.close?.()}}

// 1b) no truck by the zone: the forklift panel says so and nothing changes
{const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
 try{const {GameState,pump}=g,p=()=>GameState.progress;
  setup(g,ticket('staged'),orderPallet);const z=await toTheZone(g);pump(.3);assert.match(z.note(),/Park a truck with a bed beside the loading zone/,z.note());z.drop();
  assert.equal(ticketsOf(p().companies.ridgeline).list[0].status,'staged');assert((p().companies.ridgeline.pallets||[]).some(q=>q.order===1&&q.at.fork),'the pallet is still on the forks');
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
// 3) the delivery runs out of time with the planks still on the truck: they are taken back, and cannot be sold first
{const d=dropSpot(DEST);
 const tag=[{k:'planks',n:4,o:1},{k:'planks',n:4,o:1},{k:'planks',n:4,o:1}];
 const g=await bootGame({position:{x:d.x,z:d.z},progress:{vehicles:[flat(d.x-12,d.z-9,0,tag)],orders:{nextVehicle:2}}});
 try{const {GameState,pump,ids,scene}=g,p=()=>GameState.progress,planks=()=>scene().getObjectByName('vehicle-v1').getObjectByName('cargo-planks').count,list=()=>ticketsOf(p().companies.ridgeline).list;
  setup(g,ticket('loaded',{vehicle:'v1'}));pump(1.2);assert(planks()>0&&list()[0].status==='loaded');
  GameState.progress={...p(),housing:{...p().housing,day:6},routine:{...p().routine,minutes:700}};pump(1.2);
  assert(!list().some(k=>k.id===1&&k.status==='loaded'),'it is no longer a live order (failed, and an old one is cleared away)');assert.equal(planks(),0,'the planks are off the truck');assert.equal(p().vehicles.find(v=>v.uid==='v1').cargo??null,null,'and out of the saved truck');
  {const pallets=p().companies.ridgeline.pallets||[],back=pallets.filter(q=>q.at.rack).reduce((s,q)=>s+q.count,0);assert.equal(back,12,'the 12 planks are back in the racks as a pallet, not gone: '+JSON.stringify(pallets));assert(/-1$/.test(pallets[0].at.rack),'on a floor-level cell')}
 }finally{g.close?.()}}
console.log('PASS delivery-game.mjs: a delivery takes a staging pallet, the pallet on the forklift lowered onto the loading zone loads it onto a truck with a bed parked beside it (refused with none), it is paid and counted only when unloaded at the house\'s drop spot with the truck near, and a truck left far away refuses; an order\'s planks are tagged (not yours to sell or take off) and are taken back when a delivery runs out of time.');
