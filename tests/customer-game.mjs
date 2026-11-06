import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {hire} from '../dist/careers.js';
import {clockIn} from '../dist/shift.js';
import {scheduleTruck,BAY} from '../dist/customers.js';
import {addStock} from '../dist/forest.js';
import {loadPoints} from '../dist/cargo.js';

// The customer's truck in the packaged game (0.35): due after clock-in, it drives in along the exit road and parks in the timber yard bay (solid while it stands there),
// you load it from the stock at its back, send it off at the cab, and it drives off the map and disappears.
const g=await bootGame({position:{x:90,z:58}});
try{
 const {GameState,pump,send,ids,scene}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const prompt=()=>ids.get('prompt').querySelector('span').textContent,press=()=>{send('keydown','KeyE');send('keyup','KeyE');pump(1.2)};
 const truck=()=>scene().getObjectByName('customer-truck');
 // a Hauler's day with a Load Truck task of 8 planks, 8 planks in stock, the truck due now
 let s={...p(),housing:{...p().housing,day:3},routine:{...p().routine,minutes:540}};s=clockIn(hire(s,'ridgeline').state,'ridgeline').state;
 s={...s,shift:{...s.shift,tasks:[{kind:'load',piece:'shipped',target:8,done:0}]}};s=scheduleTruck(s);s={...s,shift:{...s.shift,truck:{...s.shift.truck,due:0}}};GameState.progress=addStock(s,{planks:8});
 assert.equal(truck().visible,false,'no truck before it is due');
 pump(2);assert(truck().visible,'it is on its way');assert(truck().position.x>200,'coming in from the east: x '+truck().position.x.toFixed(0));
 pump(40);assert.equal(p().shift.truck.stage,'waiting','it has parked');assert(Math.abs(truck().position.x-BAY.x)<.5&&Math.abs(truck().position.z-BAY.z)<.5,'in the bay: '+truck().position.x.toFixed(1)+','+truck().position.z.toFixed(1));
 assert(/customer's truck is waiting/.test(ids.get('jobToast').textContent),ids.get('jobToast').textContent);
 // load from the stock at its back: two stacks of four
 const back=loadPoints('flatbed').find(q=>q.side==='rear');me().x=BAY.x;me().z=BAY.z-back.z;pump(.6);
 assert(/Load planks from the stock · 0 \/ 8 \(stock 8\)/.test(prompt()),'the back of the truck: '+prompt());press();press();assert.equal(p().shift.truck.loaded,8);
 assert.equal(truck().getObjectByName('cargo-planks').count,8,'two stacks of four boards on its bed (each board is drawn)');
 // send it off at the cab
 me().x=BAY.x-2.05;me().z=BAY.z-1.765;pump(.6);assert(/Send the truck off · 8 planks/.test(prompt()),'the cab: '+prompt());press();
 assert.equal(p().shift.truck.stage,'gone');assert.equal(p().shift.pieces.shipped,8);assert.equal(p().shift.tasks[0].done,8,'the task is done');
 pump(60);assert.equal(truck().visible,false,'it drove off the map and is gone');
 console.log('PASS customer-game.mjs: the customer\'s truck drives in from the east edge when due, parks in the timber yard bay, is loaded from the stock at its back (drawn on its bed), is sent off at the cab (the task done) and drives off the map.');
}finally{await g.done()}
