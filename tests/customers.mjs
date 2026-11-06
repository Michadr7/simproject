// Customer trucks (0.35, the Load Truck task; customers.js): due after clock-in only when the day has the task, loaded from your hands, your truck's bed or the company stock
// (only what the order needs), sent off only when full, paying per plank shipped and counting for the task; the save keeps it; the exit road leaves the map.
import assert from 'node:assert/strict';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {hire} from '../dist/careers.js';
import {clockIn,shiftPay,PIECE_PAY,TASKS} from '../dist/shift.js';
import {scheduleTruck,truckOf,truckDue,truckArrived,truckWaiting,loadFromHands,loadFromStock,loadFromBed,sendOff,ARRIVE_AFTER,BAY} from '../dist/customers.js';
import {addStock,stockOf,inLumberyard} from '../dist/forest.js';
import {MAP,validateMap} from '../dist/map-definition.js';

assert.equal(TASKS.load.piece,'shipped');assert.equal(PIECE_PAY.shipped,50);assert(MAP.employers[0].ranks.find(r=>r.id==='hauler').tasks.includes('load'),'a Hauler loads customer trucks');
assert(inLumberyard(BAY),'the bay is in the timber yard');
// the exit: off the map at both ends, and the validator catches an exit that ends on the map
{const x=MAP.exits[0];assert.equal(x.road,'freight-out');assert(x.in[0][0]>MAP.playable.x1&&x.out[x.out.length-1][0]>MAP.playable.x1);
 assert(validateMap({...MAP,exits:[{...x,out:[...x.out.slice(0,-1),[100,71]]}]}).some(p=>/must start and end outside/.test(p)),'an exit that ends inside the map is caught')}
const at=(p,day,minutes)=>({...p,housing:{...p.housing,day},routine:{...p.routine,minutes}});
let p=clockIn(at(hire(freshProgress(),'ridgeline').state,3,540),'ridgeline').state;
assert.equal(truckOf(scheduleTruck(p)),null,'no Load Truck task: no truck');
p={...p,shift:{...p.shift,tasks:[...p.shift.tasks,{kind:'load',piece:'shipped',target:10,done:0}]}};p=scheduleTruck(p);
assert.deepEqual(truckOf(p),{order:10,loaded:0,stage:'coming',due:2*1440+540+ARRIVE_AFTER});assert.equal(scheduleTruck(p),p,'scheduled once');
assert(!truckDue(p));assert(truckDue(at(p,3,540+ARRIVE_AFTER)),'due twenty game minutes after clock-in');
assert.match(loadFromHands({...p,carry:{kind:'planks',count:4}}).error,/No customer truck/,'not before it arrives');
p=truckArrived(p);assert(truckWaiting(p));
// from your hands: only what the order needs; delivered pay for planks you made
{const r=loadFromHands({...p,carry:{kind:'planks',count:4}});assert.equal(r.count,4);assert.equal(r.state.carry,null);assert.equal(truckOf(r.state).loaded,4);assert.equal(r.state.shift.pieces.delivered,4);p=r.state}
// from the company stock: a stack at a time, no delivered pay (they were paid when they reached the yard)
p=addStock(p,{planks:3});{const r=loadFromStock(p);assert.equal(r.count,3,'only what the stock has');assert.equal(stockOf(r.state).planks,0);assert.equal(r.state.shift.pieces.delivered,4,'stock planks pay nothing more');p=r.state}
assert.match(loadFromStock(p).error,/no planks in stock/);
// from your own truck's bed: what the order needs, the rest stays on your bed
{const r=loadFromBed(p,[{k:'log'},{k:'planks',n:4},{k:'planks',n:4}]);assert.equal(r.count,3,'the order needed three more');assert.deepEqual(r.cargo,[{k:'log'},{k:'planks',n:4},{k:'planks',n:1}],'five planks and the log stay on your bed');assert.equal(truckOf(r.state).loaded,10);p=r.state}
assert.match(loadFromHands({...p,carry:{kind:'planks',count:4}}).error,/send it off/,'a full truck takes no more');
// the save keeps the truck
assert.deepEqual(normalizeProgress(JSON.parse(JSON.stringify(p))).shift.truck,truckOf(p));
// send it off: only full; the shipped planks pay $0.50 each and count for the task
{const half={...p,shift:{...p.shift,truck:{...truckOf(p),loaded:6}}};assert.match(sendOff(half).error,/4 still to load/);
 const before=shiftPay(p).piecePay,r=sendOff(p);assert(!r.error);assert.equal(truckOf(r.state).stage,'gone');assert.equal(r.state.shift.pieces.shipped,10);assert.equal(shiftPay(r.state).piecePay-before,500,'ten planks shipped: $5.00');
 assert(/Task done: Load a customer's truck with 10 planks/.test(r.message),r.message);assert.match(sendOff(r.state).error,/No customer truck/)}
// the truck you see: solid to a walker only while it stands parked in the bay
{const THREE=await import('../dist/vendor/three.module.js'),{createCustomerTruck}=await import('../dist/customer-truck.js'),ct=createCustomerTruck({scene:new THREE.Scene(),exit:MAP.exits[0]});
 assert(!ct.blocksWalker(BAY.x,BAY.z),'nothing to bump into before it comes');ct.update(.1,{order:4,loaded:0,stage:'waiting',due:0});assert(ct.parked()&&ct.blocksWalker(BAY.x,BAY.z)&&ct.blocksWalker(BAY.x,BAY.z+4)&&!ct.blocksWalker(BAY.x+3,BAY.z),'parked: its hull blocks, beside it does not');
 ct.update(.1,{order:4,loaded:4,stage:'gone',due:0});assert(!ct.blocksWalker(BAY.x,BAY.z),'once it drives off it no longer blocks')}
console.log('PASS customers.mjs: a customer truck is due twenty minutes after clock-in when the day has a Load Truck task, takes planks from your hands, your truck (the rest stays on your bed) or the stock (no double pay), is sent off only when full ($0.50 a plank shipped, the task done), and the exit road starts and ends off the map.');
