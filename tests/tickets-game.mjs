import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {MAP} from '../dist/map-definition.js';
import {hire,promote,careerOf} from '../dist/careers.js';
import {clockIn,clockOut} from '../dist/shift.js';
import {ticketsOf,openTickets,takenBy,makeTicket} from '../dist/tickets.js';
import {trackerItems} from '../dist/tracker.js';
import {WAREHOUSE_TABLE} from '../dist/warehouse-layout.js';

// Customer orders in the packaged game (0.35 step 3a, DESIGN 4.16 A and G): they come in only while a Yard hand (rank 4) or better is on shift, shake the phone, are listed on the phone,
// are taken at the warehouse's order table (through applyCompany), show on the tracker, fail at their deadline or when you clock out, and cost reputation.
const W=MAP.offices.find(o=>o.kind==='warehouse'),DAY=3,abs=(day,min)=>(day-1)*1440+min;
const g=await bootGame({position:{x:W.door.out.x,z:W.door.out.z}});
try{
 const {GameState,pump,send,ids,created}=g,p=()=>GameState.progress,me=()=>GameState.me.position,prompt=()=>ids.get('prompt').querySelector('span').textContent;
 const at=(day,minutes)=>{GameState.progress={...p(),housing:{...p().housing,day},routine:{...p().routine,minutes}}};
 const press=(code='KeyE',seconds=1.2)=>{send('keydown',code);send('keyup',code);pump(seconds)};
 const co=()=>p().companies?.ridgeline,list=()=>ticketsOf(co()).list,phoneBtn=()=>ids.get('phoneButton');
 const rankUp=n=>{while(careerOf(p(),'ridgeline').rank<n)GameState.progress=promote(p(),'ridgeline',undefined,{force:true}).state};
 const clock=(minutes,day=DAY)=>{at(day,minutes);GameState.progress=clockIn(p(),'ridgeline').state};

 // a trainee on shift gets no orders
 GameState.progress=hire(p(),'ridgeline').state;clock(480,DAY-1);pump(1.2);assert.equal(list().length,0,'rank 1 has no customer orders');
 GameState.progress=clockOut(p()).state;pump(.6);
 // a Yard hand on shift: the 7 AM pickup arrives, the phone shakes, the toast names it
 rankUp(4);assert.equal(careerOf(p(),'ridgeline').rank,4);at(DAY,430);GameState.progress=clockIn(p(),'ridgeline').state;pump(1.2);
 assert.equal(list().length,1,'the 7 AM pickup is released: '+JSON.stringify(list().map(k=>k.id)));const t1=list()[0];assert.equal(t1.status,'open');assert.equal(t1.kind,'pickup');
 assert(/New order #1 · /.test(ids.get('jobToast').textContent),'the toast names it: '+ids.get('jobToast').textContent);assert(phoneBtn().classList.contains('has-unread'),'and the phone is shaking with an unread badge');
 // the phone lists it (Jobs, Shift)
 phoneBtn().click();ids.get('phoneApp-jobs').click();const jobsText=()=>{const t=e=>[e.textContent||'',...(e.children||[]).map(t)].join(' | ');return t(ids.get('phoneJobs'))};
 assert(/Customer orders/.test(jobsText())&&/#1 · /.test(jobsText())&&/Open/.test(jobsText()),'the phone lists the order: '+jobsText().slice(0,300));ids.get('phoneClose').click();
 // later in the day more come in; nothing is released twice
 at(DAY,800);GameState.progress={...p(),shift:{...p().shift,startedAt:430,last:abs(DAY,800)}};pump(1.2);assert.equal(list().length,4,'the 9 AM delivery and the 10 AM and 1 PM pickups come in: '+list().map(k=>k.id+k.kind));assert.deepEqual(list().map(k=>k.kind),['pickup','delivery','pickup','pickup']);
 const before=JSON.stringify(list());pump(1.2);assert.equal(JSON.stringify(list()),before,'released once');
 // go in and use the table (the clock goes back to the morning: the doors are open 6 AM to 6 PM)
 at(DAY,540);GameState.progress={...p(),shift:{...p().shift,last:abs(DAY,540),startedAt:430}};
 // walk in and use the table
 at(DAY,540);GameState.progress={...p(),shift:{...p().shift,last:abs(DAY,540),startedAt:430}};
 me().x=W.door.out.x;me().z=W.door.out.z;pump(.6);assert(/Enter · Ridgeline Warehouse/.test(prompt()),prompt());press('KeyE',2.5);assert(/WAREHOUSE/.test(ids.get('locationName').textContent),'inside: '+ids.get('locationName').textContent);
 me().x=WAREHOUSE_TABLE.x;me().z=WAREHOUSE_TABLE.z+1.4;pump(.6);assert(/Order table · \d+ open/.test(prompt()),'the table says how many are open: '+prompt());
 press('KeyE',.4);const dialog=()=>ids.get('dialogText').textContent;assert(/Order table|On the board/.test(dialog()+ids.get('dialog').textContent)||/On the board/.test(dialog()),'the table lists the orders: '+dialog());
 assert(/needs Sawyer, rank 5/.test(dialog()),'a Yard hand sees the delivery order and what rank it needs: '+dialog());ids.get('jobAction').click();pump(.4);
 assert.equal(takenBy(co(),'me').length,1,'the first order is yours');const mine=takenBy(co(),'me')[0];assert.equal(mine.status,'taken');assert.equal(mine.takenBy,'me');
 // it is a task on the tracker, at the warehouse door
 {const item=trackerItems(p(),{x:0,z:0}).find(i=>i.id==='ticket:'+mine.id);assert(item&&item.group==='Orders'&&/Order #\d+/.test(item.title)&&item.pos.x===W.door.out.x,'the tracker lists it: '+JSON.stringify(item))}
 // a failed pickup: past its deadline it fails, costs 3 reputation, shakes the phone
 const rep=careerOf(p(),'ridgeline').rep;at(DAY,mine.dueAt%1440+1);pump(1.2);
 assert.equal(list().find(k=>k.id===mine.id).status,'failed','past its time it fails');assert.equal(careerOf(p(),'ridgeline').rep,Math.max(0,rep-3),'and costs reputation');assert(/failed/.test(ids.get('jobToast').textContent),ids.get('jobToast').textContent);
 // clocking out fails a taken pickup at once
 {const open=openTickets(co());assert(open.length>0);at(DAY,545);ids.get('jobToast').textContent='';
  const k=open.find(t=>t.kind==='pickup');GameState.progress={...p(),companies:{...p().companies,ridgeline:{...co(),tickets:{...ticketsOf(co()),list:ticketsOf(co()).list.map(t=>t.id===k.id?{...t,status:'taken',takenBy:'me'}:t)}}}};
  GameState.progress=clockOut(p()).state;pump(1.2);assert.equal(list().find(t=>t.id===k.id).status,'failed','a taken pickup fails when you clock out')}
 console.log('Tickets in the game: only a Yard hand on shift gets orders, they shake the phone and are listed on it, you take one at the order table, it shows on the tracker, and a pickup fails at its deadline or when you clock out.');
}finally{g.close?.()}
