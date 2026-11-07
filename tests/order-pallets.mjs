import assert from 'node:assert/strict';
import {palletsOf,liftPallet,setPallet,stageByHand,setOnSquare,dropOrderPallet,orderPallet,squarePallet,stagingPallets,totalPlanks,racksMap,addToRack,takeFromRackCell,normalizePallets,withPallets,PALLET_CAP} from '../dist/pallets.js';
import {takeTicket,stagePlanks,stagePallet,shipTicket,loadTicket,stagingOf,migrateOrderPallets,releaseOrderPallet,normalizeTickets} from '../dist/tickets.js';
import {normalizeCompanies} from '../dist/careers.js';
import {boxesOf} from '../dist/fork-pallets.js';
import {createPalletTags,glyphCell,tagCell} from '../dist/pallet-tags.js';
import {WAREHOUSE_STAGING} from '../dist/warehouse-layout.js';
import {Quaternion} from '../dist/vendor/three.module.js';

// Order pallets (D1, DESIGN 4.16 J): an order's staging square holds a real pallet {at:{staging:i}, order:id}. By hand the pallet appears with the first stack; set on the square by the forklift, a plain pallet gives the order
// what it needs and the rest is surplus; a complete (or partial) order pallet can be lifted, carried and set on the floor; it is never stock, never in a rack, and loading consumes it.
const DAY=3,NOW=(DAY-1)*1440+700;
const ticket=(id,planks,extra={})=>({id,customer:'Greenway Builders',kind:'pickup',planks,issuedAt:(DAY-1)*1440+420,dueAt:(DAY-1)*1440+1080,status:'open',staged:0,...extra});
const company=(...list)=>({tickets:{nextId:10,day:DAY,released:[0,1,2,3],list}});
const A={playerId:'me',rank:4,now:NOW};

// taking an order stamps a square on its ticket; the first free square, and it stays when an older order finishes
{let co=company(ticket(1,12),ticket(2,24),ticket(3,40));
 co=takeTicket(co,{id:1,...A}).company;co=takeTicket(co,{id:2,...A}).company;
 assert.deepEqual(stagingOf(co).map(k=>k&&k.id),[1,2,null],'S1, S2');assert.equal(co.tickets.list[1].square,1);
 co=takeTicket(co,{id:3,...A}).company;assert.deepEqual(stagingOf(co).map(k=>k&&k.id),[1,2,3]);
 // order 1 is done: order 2 keeps S2 (its pallet is standing there), and the next order takes the freed S1
 co={...co,tickets:{...co.tickets,list:co.tickets.list.map(k=>k.id===1?{...k,status:'done'}:k)}};
 assert.deepEqual(stagingOf(co).map(k=>k&&k.id),[null,2,3],'the others stay where they are');
 co={...co,tickets:{...co.tickets,list:[...co.tickets.list,ticket(4,12)]}};co=takeTicket(co,{id:4,...A}).company;assert.deepEqual(stagingOf(co).map(k=>k&&k.id),[4,2,3],'the freed square is used')}

// by hand: the pallet appears with the first stack and grows; the ticket follows it
{let co=company(ticket(1,12,{status:'taken',takenBy:'me',square:1}));
 assert.equal(orderPallet(co,1),null,'no pallet before the first stack');
 let r=stagePlanks(co,{id:1,count:4,now:NOW});co=r.company;assert.equal(r.used,4);
 const p=orderPallet(co,1);assert.deepEqual([p.count,p.order,p.at],[4,1,{staging:1}],'the first stack makes the pallet on S2');assert.equal(co.tickets.list[0].staged,4);assert.equal(co.tickets.list[0].status,'taken');
 assert.equal(totalPlanks(co),0,'an order pallet is reserved, not stock');assert.deepEqual(racksMap(co),{});
 r=stagePlanks(co,{id:1,count:99,now:NOW});co=r.company;assert.equal(r.used,8,'only what the order needs');assert.equal(co.tickets.list[0].status,'staged');assert.equal(orderPallet(co,1).count,12);
 assert.match(stagePlanks(co,{id:1,count:4,now:NOW}).error,/fully staged/);
 // the pallet is lifted away: hand stacking is refused until it is back on its square
 let c2=co;c2=liftPallet(c2,orderPallet(c2,1).id).company;assert.equal(orderPallet(c2,1).order,1,'it is still the order\'s on the forks');
 c2={...c2,tickets:{...c2.tickets,list:[{...c2.tickets.list[0],status:'taken',staged:8}]}};
 assert.match(stagePlanks(c2,{id:1,count:4,now:NOW}).error,/not on its square/)}

// by forklift: a plain pallet of 40 set on the square of an order that needs 12: the order takes 12, 28 are surplus; an own pallet just moves back
{let co={...company(ticket(1,12,{status:'taken',takenBy:'me',square:0})),pallets:[{id:1,product:'planks',count:40,at:{fork:true}}]};
 const r=stagePallet(co,{id:1,now:NOW});assert.equal(r.used,12);assert.equal(r.surplus,28);assert.equal(r.company.tickets.list[0].status,'staged');
 assert.deepEqual(palletsOf(r.company).map(p=>[p.count,p.at,p.order]),[[12,{staging:0},1]],'the pallet itself became the order\'s');
 assert.match(r.message,/Order #1 is staged/);
 // lift the complete order pallet, set it on the floor, lift it, set it back
 let c=r.company;c=liftPallet(c,1).company;assert.equal(c.tickets.list[0].status,'staged','it stays staged while lifted');assert.match(shipTicket(c,{id:1,playerId:'me',now:NOW}).error,/not on its square/,'it cannot ship from the forks');
 c=setPallet(c,{floor:{x:0,z:5,yaw:.4}}).company;assert.deepEqual(palletsOf(c)[0].at.floor,{x:0,z:5,yaw:.4});assert.equal(palletsOf(c)[0].order,1,'still the order\'s');assert.match(shipTicket(c,{id:1,playerId:'me',now:NOW}).error,/not on its square/,'nor from the floor');
 assert.match(stagePallet(c,{id:1,now:NOW}).error,/fully staged/,'nothing to set down while the pallet is on the floor');
 c=liftPallet(c,1).company;const back=stagePallet(c,{id:1,now:NOW});assert.equal(back.error,undefined);assert.equal(back.surplus,0);assert.deepEqual(orderPallet(back.company,1).at,{staging:0},'back on its square');
 // an order pallet never goes in a rack
 assert.match(setPallet(liftPallet(back.company,1).company,{rack:'A1-1'}).error,/stays on its square or the floor/);
 // ... and shipping consumes it
 const ship=shipTicket(back.company,{id:1,playerId:'me',now:NOW});assert.equal(ship.error,undefined);assert.equal(orderPallet(ship.company,1),null,'the pallet is gone');assert.equal(ship.company.tickets.list[0].status,'done');
}
// a partial order pallet on the square is topped up by a plain pallet; a plain pallet cannot go on a square whose pallet is elsewhere
{let co={...company(ticket(1,24,{status:'taken',takenBy:'me',square:0})),pallets:[{id:1,product:'planks',count:10,at:{staging:0},order:1,},{id:2,product:'planks',count:30,at:{fork:true}}]};
 co={...co,tickets:{...co.tickets,list:[{...co.tickets.list[0],staged:10}]}};
 const r=stagePallet(co,{id:1,now:NOW});assert.deepEqual([r.used,r.surplus],[14,16]);assert.deepEqual(palletsOf(r.company).map(p=>[p.id,p.count]),[[1,24]],'merged into the order\'s pallet');assert.equal(r.company.tickets.list[0].status,'staged');
 // another order's own pallet on the forks, set on this order's square: refused
 const other={...co,pallets:[{id:1,product:'planks',count:10,at:{staging:0},order:1},{id:3,product:'planks',count:5,at:{fork:true},order:7}]};
 assert.match(setOnSquare(other,{order:1,square:1,need:14}).error,/order #7's pallet/);
 // the order's pallet is on the floor, a plain pallet is on the forks: refused until the order pallet is back
 const away={...co,pallets:[{id:1,product:'planks',count:10,at:{floor:{x:0,z:5,yaw:0}},order:1},{id:2,product:'planks',count:30,at:{fork:true}}]};
 assert.match(setOnSquare(away,{order:1,square:0,need:14}).error,/not on its square/)}

// a failed order's pallet goes wherever it is (the forks too); an order from before pallets still has its count
{let co={...company(ticket(1,12,{status:'staged',takenBy:'me',square:0,staged:12})),pallets:[{id:1,product:'planks',count:12,at:{fork:true},order:1}]};
 const r=releaseOrderPallet(co,1);assert.equal(r.planks,12);assert.equal(palletsOf(r.company).length,0);assert.equal(releaseOrderPallet(r.company,1).planks,0,'nothing the second time')}

// hand taking and stacking never touch an order pallet
{const co={pallets:[{id:1,product:'planks',count:12,at:{staging:0},order:1}]};
 assert.equal(takeFromRackCell(co,'A1-1',4).taken,0);
 // (an order pallet cannot be saved in a rack; the cell join is also refused)
 const rack={pallets:[{id:1,product:'planks',count:12,at:{rack:'A1-1'},order:1}]};assert.equal(addToRack(rack,'A1-1',4).put,0);assert.equal(takeFromRackCell(rack,'A1-1',4).taken,0);assert.deepEqual(racksMap(rack),{})}

// a save: one pallet per order, none in a rack, a square holds one pallet, and one without an order is dropped; squares go in as boxes the forks can find
{const list=normalizePallets([
  {id:1,product:'planks',count:12,at:{staging:0},order:5},
  {id:2,product:'planks',count:3,at:{staging:0},order:6},   // the square is taken
  {id:3,product:'planks',count:3,at:{staging:1}},            // a square needs an order
  {id:4,product:'planks',count:3,at:{rack:'A1-1'},order:8},  // never in a rack
  {id:5,product:'planks',count:3,at:{floor:{x:1,z:2,yaw:0}},order:5}, // one pallet per order
  {id:6,product:'planks',count:9,at:{floor:{x:2,z:2,yaw:0}},order:9},
  {id:7,product:'planks',count:2,at:{staging:7},order:10}]);
 assert.deepEqual(list.map(p=>[p.id,p.order||0,Object.keys(p.at)[0]]),[[1,5,'staging'],[5,0,'floor'],[6,9,'floor']]);
 assert.equal(boxesOf(list).find(b=>b.index===0).kind,'staging');
 const b=boxesOf(list).find(x=>x.kind==='staging');assert.deepEqual([b.x,b.z,b.yaw,b.base,b.count,b.order],[WAREHOUSE_STAGING[0].x,WAREHOUSE_STAGING[0].z,0,0,12,5],'an order pallet is a box on the floor at its square')}

// tickets keep their square; a save from before pallets: a staged ticket gets its pallet
{const t=normalizeTickets({nextId:3,day:DAY,released:[],list:[ticket(1,12,{status:'staged',staged:12,takenBy:'me',square:2}),ticket(2,12,{status:'taken',staged:4,takenBy:'me',square:9})]});
 assert.equal(t.list[0].square,2);assert.equal(t.list[1].square,undefined,'a bad square is dropped');
 const migrated=normalizeCompanies({ridgeline:{tickets:t}}).ridgeline;
 assert.deepEqual(palletsOf(migrated).map(p=>[p.order,p.count,p.at.staging]),[[2,4,0],[1,12,2]],'each counted order gets a pallet on its square (the first free one when none was kept)');
 assert.equal(migrateOrderPallets(migrated),migrated,'idempotent')}

// the tag: an order pallet's plate is green (its own row) and its number is drawn above with glyph quads
{const fakeCanvas=()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(t,k)=>k==='measureText'?()=>({width:10}):()=>{},set:()=>true})});
 const tags=createPalletTags({makeCanvasFn:fakeCanvas}),cam={quaternion:new Quaternion()};
 assert.equal(tags.update([{x:0,y:1,z:0,count:12,product:'planks'}],cam,{x:0,z:0}),1);assert.equal(tags.mesh.count,1,'a plain pallet: one plate');
 assert.equal(tags.update([{x:0,y:1,z:0,count:12,product:'planks',order:12}],cam,{x:0,z:0}),1,'one pallet');assert.equal(tags.mesh.count,1+3,'an order pallet: its plate and "#12" (three glyphs)');
 assert.notDeepEqual(tagCell(12,true),tagCell(12),'the green plate is another cell');assert.equal(glyphCell('x'),null);assert.deepEqual(new Set('#0123456789'.split('').map(c=>JSON.stringify(glyphCell(c)))).size,11,'every glyph has its own cell')}

console.log('PASS order-pallets.mjs: an order\'s staging square holds a real pallet (the first stack makes it, the ticket keeps its square when older orders finish), a plain pallet from the forks gives the order what it needs and the surplus is split off, the order pallet can be lifted, set on the floor and put back but never ships from anywhere else, never goes in a rack or counts as stock, loading consumes it, a failed order releases it wherever it is, saves are cleaned and old staged orders migrate, and its tag is a green plate with the number above.');
