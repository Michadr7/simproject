import assert from 'node:assert/strict';
import {tickSupply,shortfall,planksNeeded,planksHeld,supplyOrder,normalizeSupply,returnPlanks,SUPPLY} from '../dist/supply.js';
import {normalizeCompanies} from '../dist/careers.js';
import {palletsOf,racksMap,totalPlanks} from '../dist/pallets.js';

// The warehouse's plank supply (DESIGN 4.16 H and I): a crew brings what the open orders need and the warehouse lacks, as pallets in the racks.
const DAY=3,at=m=>(DAY-1)*1440+m;
const k=(id,planks,status='open',staged=0)=>({id,customer:'Greenway Builders',kind:'pickup',planks,issuedAt:at(420),dueAt:at(900),status,staged});
const co=(tickets,extra={})=>({tickets:{nextId:9,day:DAY,released:[0],list:tickets},...extra});

// what is needed and what is held (every pallet: racks and forks, and the planks in a player's hands; the lumberyard stock is NOT the warehouse)
assert.equal(planksNeeded(co([k(1,24),k(2,40,'taken',10),k(3,12,'staged',12),k(4,12,'done',12)])),24+30,'open and taken orders only, minus what is already on their pallet');
assert.equal(planksHeld({stock:{logs:0,planks:30},racks:{'A1-1':40,'B2-2':12},forkload:8},4),52+8+4,'racks, forks and hands; the old counts still read');
assert.equal(planksHeld({stock:{logs:0,planks:30},pallets:[{id:1,product:'planks',count:25,at:{rack:'A1-1'}},{id:2,product:'planks',count:10,at:{fork:true}}]}),35,'pallets');
assert.equal(shortfall(co([k(1,24)],{racks:{'C2-1':30}})),0,'enough on the pallets: nothing is missing');
assert.equal(shortfall(co([k(1,24)],{stock:{logs:0,planks:99}})),24,'the lumberyard stock does not count as in the warehouse');
assert.equal(shortfall(co([k(1,40),k(2,24)],{racks:{'A1-1':20}})),44);

// batches of 40, at most 120
assert.equal(supplyOrder(1),40);assert.equal(supplyOrder(40),40);assert.equal(supplyOrder(41),80);assert.equal(supplyOrder(500),120);

// short on planks in the working day: a delivery is scheduled an hour out, and only one at a time
let r=tickSupply(co([k(1,40),k(2,24)]),{now:at(480)});
assert.deepEqual(r.scheduled,{at:at(480)+SUPPLY.delay,planks:80},'64 missing -> two batches of 40');assert.deepEqual(r.company.supply,{at:at(540),planks:80});assert.equal(r.delivered,0);
const again=tickSupply(r.company,{now:at(490)});assert.equal(again.company,r.company,'nothing changes while one is on its way');assert.equal(again.scheduled,null);
// it lands when due, as pallets of 40 in the racks (the lumberyard has none, so they come from the mill off the map), and the order is cleared
r=tickSupply(r.company,{now:at(541)});assert.equal(r.delivered,80);assert.equal(r.pallets,2);assert.equal(r.fromStock,0);assert.equal(totalPlanks(r.company),80);assert.equal(palletsOf(r.company).length,2);assert.equal(r.company.supply,undefined);assert.match(r.message,/2 pallets \(80 planks\)/);
assert(Object.keys(racksMap(r.company)).every(slot=>/-1$/.test(slot)),'on the floor level first: '+Object.keys(racksMap(r.company)));
// then there is enough: no more are sent
assert.equal(tickSupply(r.company,{now:at(542)}).company,r.company);
// the lumberyard's own planks go first
{const y=tickSupply({...co([k(1,40)]),stock:{logs:3,planks:25},supply:{at:at(500),planks:40}},{now:at(500)});assert.equal(y.fromStock,25,'25 of the 40 came out of the lumberyard stock');assert.equal(y.company.stock.planks,0);assert.equal(y.company.stock.logs,3,'logs untouched');assert.equal(totalPlanks(y.company),40)}
// already enough, or no orders: nothing happens (the same object comes back)
const quiet=co([k(1,12)],{racks:{'A1-1':50}});assert.equal(tickSupply(quiet,{now:at(480)}).company,quiet);const none=co([]);assert.equal(tickSupply(none,{now:at(480)}).company,none);assert.equal(tickSupply(undefined,{now:at(480)}).company,undefined);
// not at night: the crew only goes for planks in the working day (6 AM to 6 PM), but a delivery on its way still lands
const needy=co([k(1,40)]);assert.equal(tickSupply(needy,{now:at(300)}).scheduled,null,'before 6 AM');assert.equal(tickSupply(needy,{now:at(1090)}).scheduled,null,'after 6 PM');
assert.equal(tickSupply({...needy,supply:{at:at(1100),planks:40}},{now:at(1100)}).delivered,40,'a late delivery still lands');
// a day jump (sleep) lands it too
assert.equal(tickSupply({...needy,supply:{at:at(600),planks:40}},{now:at(600)+1440}).delivered,40);
// full racks: what does not fit is not delivered
{const full={...needy,pallets:[...Array(120)].map((_,i)=>({id:i+1,product:'planks',count:40,at:{rack:['A','B','C','D','E'][Math.floor(i/24)]+(Math.floor((i%24)/3)+1)+'-'+((i%3)+1)}})),supply:{at:at(500),planks:40}};
 const f=tickSupply(full,{now:at(500)});assert.equal(f.delivered,0);assert.match(f.message,/racks are full/);assert.equal(f.company.supply,undefined,'the order is closed; a new one goes out if orders still need it')}

// planks coming back (an order failed): they go to open rack space as pallets, floor level nearest the door first; what does not fit goes to the lumberyard, nothing is lost
{const r=returnPlanks({stock:{logs:2,planks:5}},12);assert.equal(r.placed,12);assert.equal(r.toStock,0);assert.equal(totalPlanks(r.company),12);assert.equal(palletsOf(r.company).length,1);assert.deepEqual(r.cells.length,1);assert(/-1$/.test(r.cells[0]),'floor level first: '+r.cells[0]);assert.deepEqual(r.company.stock,{logs:2,planks:5},'the stock is untouched');
 const more=returnPlanks(r.company,90);assert.equal(totalPlanks(more.company),102);assert.equal(palletsOf(more.company).length,4,'12, then 40 + 40 + 10');assert(!more.cells.includes(r.cells[0]),'a cell that holds a pallet is skipped');
 const fullRacks={pallets:Array.from({length:120},(_,i)=>({id:i+1,product:'planks',count:40,at:{rack:['A','B','C','D','E'][Math.floor(i/24)]+(Math.floor((i%24)/3)+1)+'-'+((i%3)+1)}})),stock:{logs:0,planks:3}};
 const full=returnPlanks(fullRacks,25);assert.equal(full.placed,0);assert.equal(full.toStock,25);assert.deepEqual(full.company.stock,{logs:0,planks:28},'the racks are full: the planks go to the lumberyard');
 assert.equal(returnPlanks(r.company,0).company,r.company,'nothing to return: the same object');assert.equal(returnPlanks(undefined,0).company,undefined)}
// saved on the company, cleaned on load
assert.deepEqual(normalizeSupply({at:5000,planks:80}),{at:5000,planks:80});assert.equal(normalizeSupply({at:-1,planks:80}),null);assert.equal(normalizeSupply({at:5,planks:'x'}),null);assert.equal(normalizeSupply(null),null);assert.equal(normalizeSupply({at:5,planks:99999}).planks,1000);
assert.deepEqual(normalizeCompanies({ridgeline:{supply:{at:5000,planks:80}}}).ridgeline.supply,{at:5000,planks:80});assert.equal(normalizeCompanies({ridgeline:{supply:{at:'soon'},stock:{planks:3}}}).ridgeline.supply,undefined);

console.log('PASS supply.mjs: the crew brings what open orders need and the warehouse lacks (every pallet and the hands counted, the lumberyard stock not), in batches of 40 up to 120, one delivery at a time an hour out, only in the working day, landing as pallets in the racks (floor level first, the lumberyard\'s planks first), a full warehouse refusing them, saved and cleaned on load.');
