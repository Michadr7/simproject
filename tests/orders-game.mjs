import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {ticketsOf,stagingOf} from '../dist/tickets.js';
import {racksOf} from '../dist/forest.js';
import {WAREHOUSE_TABLE,WAREHOUSE_STAGING,DOCK_DOOR,HALL,slotById} from '../dist/warehouse-layout.js';
import {DOCK_BAY,dockRoute} from '../dist/customers.js';
import {ZONE,IN} from '../dist/dock.js';
import {BAY,TIP} from '../dist/forklift.js';
import {CARRY_Z} from '../dist/fork-pallets.js';

// Filling a customer order (0.35 step 3b, DESIGN 4.16 C): take planks out of a floor-level rack, stage them on the order's pallet, and when it is staged the customer's truck comes to the dock;
// E at the dock door loads it: the order is done, pays, and the truck leaves.
globalThis.location={search:'?debug',hostname:'localhost',href:'http://localhost/?debug',origin:'http://localhost',protocol:'http:',host:'localhost'};
const {bootGame}=await import('./support/boot-game.mjs');
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3;
// the route is real: it starts at the map edge and ends in the bay, and the bay is against the loading door (the bed's middle at the dock's x)
{const r=dockRoute(MAP.exits[0]);assert.deepEqual(r.inPath.at(-1),[DOCK_BAY.x,DOCK_BAY.z]);assert.deepEqual(r.outPath[0],[DOCK_BAY.x,DOCK_BAY.z]);assert(r.inPath[0][0]>=MAP.playable.x1-1||r.inPath[0][0]>290,'it comes from the map edge');assert(r.outPath.at(-1)[0]>290,'and leaves by it');assert(Math.abs(DOCK_BAY.x-ZONE.x)<.01&&Math.abs(DOCK_BAY.yaw-Math.PI)<1e-9&&DOCK_BAY.z<ZONE.z-4,'facing north in line with the loading zone, its tail (4.4 m behind its middle) a little north of it')}

const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
try{
 const {GameState,pump,send,ids,scene,win}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent;
 const press=(code='KeyE',seconds=1.2)=>{send('keydown',code);send('keyup',code);pump(seconds)};
 const co=()=>p().companies?.ridgeline,list=()=>ticketsOf(co()).list,truck=()=>scene().getObjectByName('dock-truck');
 const stagedBoards=()=>scene().getObjectByName('warehouse-interior').children.find(c=>c.name==='warehouse-boards-floor').count;
 GameState.progress=hire(p(),'ridgeline').state;while(careerOf(p(),'ridgeline').rank<4)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state;
 GameState.progress={...p(),housing:{...p().housing,day:DAY},routine:{...p().routine,minutes:430}};GameState.progress=clockIn(p(),'ridgeline').state;
 GameState.progress={...p(),companies:{...p().companies,ridgeline:{...co(),racks:{'A1-1':40,'B2-1':10}}}};pump(1.2);
 const t=list()[0];assert(t&&t.kind==='pickup'&&t.planks===12,'the 7 AM pickup is for 12 planks: '+JSON.stringify(t));assert.equal(truck().visible,false,'no truck yet');
 // in, to the table, take the order
 pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),prompt());press('KeyE',2.5);
 me().x=WAREHOUSE_TABLE.x;me().z=WAREHOUSE_TABLE.z+1.4;pump(.6);press('KeyE',.4);ids.get('jobAction').click();pump(.2);ids.get('jobAction').click();pump(.4);assert.equal(list()[0].status,'taken','the order is yours (open its card, then Accept)');
 assert.deepEqual(stagingOf(co()).map(k=>k&&k.id),[t.id,null,null],'it has the first staging pallet');
 // nothing to take or stage until you stand at a rack with planks
 const A1=slotById('A1-1'),S1=WAREHOUSE_STAGING[0];
 for(let trip=1;trip<=3;trip++){
  me().x=A1.stand.x;me().z=A1.stand.z;pump(.6);assert(/Take a stack from rack A1-1 · \d+ · for your order/.test(prompt()),'the rack offers planks for the order: '+prompt());press('KeyE',1.2);
  assert.deepEqual(p().carry,{kind:'planks',count:4},'a stack of four in your hands');assert.equal(racksOf(p())['A1-1'],40-4*trip);
  me().x=S1.x;me().z=S1.z-1.3;pump(.6);assert(new RegExp(`Stage the planks on order #${t.id} · ${(trip-1)*4} / 12`).test(prompt()),'the pallet offers it: '+prompt());press('KeyE',1.2);
  assert.equal(p().carry,null);assert.equal(list()[0].staged,trip*4);assert.equal(stagedBoards(),trip*4,'the planks stand on the pallet')}
 assert.equal(list()[0].status,'staged','all twelve planks are staged');assert.equal(racksOf(p())['A1-1'],28,'twelve left the rack');
 // no more picking or staging for a finished pallet; the rack offers nothing now
 me().x=A1.stand.x;me().z=A1.stand.z;pump(.6);assert(!/Take planks/.test(prompt()),'nothing more to pick: '+prompt());
 // the customer's truck drives in once the order is staged (it takes a while)
 me().x=BAY.x;me().z=BAY.z+2.3;pump(60);assert.equal(truck().visible,true,'the truck is in the yard');assert(Math.hypot(truck().position.x-DOCK_BAY.x,truck().position.z-DOCK_BAY.z)<1.5,'parked in the bay: '+truck().position.x.toFixed(1)+','+truck().position.z.toFixed(1));
 // D3: the order's pallet goes out through the roller door on the forklift and onto the green loading zone (E at the dock door is gone)
 {const win=g.win,fork=()=>win.__city.fork,place=(x,z,yaw,lift=.3)=>{fork().state={x,z,yaw,speed:0,lift,steer:0,roll:0};pump(.3)},hold=(c,s)=>{send('keydown',c);pump(s);send('keyup',c);pump(.1)};
  me().x=BAY.x;me().z=BAY.z+2.3;pump(.6);await new Promise(r=>setTimeout(r,400));pump(.8);press('KeyE',.6);assert.equal(fork().on,true,'on the forklift');
  const sq=WAREHOUSE_STAGING[0];place(sq.x,sq.z-(.62-.6+TIP),0,.1);hold('KeyR',.25);assert(p().companies.ridgeline.pallets.some(q=>q.at.fork&&q.order===list()[0].id&&q.count===12),'the order pallet is on the forks');
  // not on the zone inside, and out through the door
  place(IN.x,8.6,0);hold('KeyW',3);pump(.8);assert.equal(fork().where,'outside','out on the apron');
  // an incomplete or wrong place is refused; the zone loads
  place(ZONE.x-4,ZONE.z+CARRY_Z,Math.PI,.6);hold('KeyF',1.5);assert(p().companies.ridgeline.pallets.some(q=>q.at.fork),'not set down off the zone');assert.equal(list()[0].status,'staged');
  const cash0=p().cash,pieces0=p().shift.pieces.orders||0;place(ZONE.x,ZONE.z+CARRY_Z,Math.PI,.6);hold('KeyF',1.5);
  assert.equal(list()[0].status,'done','the order is done');assert.equal(p().shift.pieces.orders,pieces0+1,'and counted as an order');assert(p().messages.some(x=>x.app==='jobs'&&/shipped/.test(x.text)),'a Jobs message says it shipped: '+JSON.stringify(p().messages.map(x=>x.text)));assert(!(p().companies.ridgeline.pallets||[]).some(q=>q.order),'the order pallet is used up');}
 pump(80);assert.equal(truck().visible,false,'the truck has left the map');
 console.log('Orders: planks out of a rack into your hands, onto the order\'s pallet (four at a time), the customer\'s truck drives in once it is staged and parks north of the loading zone, the order pallet on the forklift set on the zone loads it, the order counts and pays, and the truck leaves.');
}finally{g.close?.()}
