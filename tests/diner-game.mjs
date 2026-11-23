import assert from 'node:assert/strict';
import {bootGame} from './support/boot-game.mjs';
import {talkOpen,talkName,talkText,reply,closeTalk} from './support/talk.mjs';
import {dinerSpots,dinerOf} from '../dist/diner-flow.js';
import {normalizeProgress} from '../dist/jobs.js';
import {DINER_RANKS,DINER_BONUS_PER_RANK} from '../dist/diner-job.js';
import {PIECE_PAY} from '../dist/shift.js';

// diner D-A2 (notes/diner-design.md): Alder Coffee & Diner is a real career in the packaged game. Hire at Elena on day 1, clock in, take an order, collect it at the pass, serve it, clear the table, clock out:
// wage + piece pay + tips + the $10 x rank bonus are paid; a customer who gives up costs a tip and 2 reputation but never wages; two counted shifts earn the promotion to Barista & Cook.
// (The food itself is a placeholder until the Station View, D-C: serving uses an automatic quality.)
const g=await bootGame({position:{x:36,z:-6.3}});
try{
 const {GameState,pump,send,ids}=g,p=()=>GameState.progress,me=()=>GameState.me.position;
 const key=c=>send('keydown',c),press=(c='KeyE')=>{send('keydown',c);send('keyup',c);pump(.3)},go=(x,z)=>Object.assign(me(),{x,y:.02,z});
 const at=(minutes,day=p().housing.day)=>{GameState.progress={...p(),housing:{...p().housing,day},routine:{...p().routine,minutes}}};
 const enter=x=>{go(x,-7.5);pump(1);go(x,-8.9);pump(2.5)};
 const wageFor=min=>Math.round(min*DINER_RANKS[0].wage/60);
 // ---- day 1: hire at Elena's counter from the first minute, clock in through the talk
 at(510);enter(36);assert.equal(ids.get('locationName').textContent,'ALDER COFFEE & DINER');
 assert(!p().careers.diner?.hired&&p().cafe===undefined,'a new save has no diner career and no old cafe field');
 go(0,-2);pump(.3);press();assert(talkOpen(ids)&&talkName(ids)==='Elena');
 reply(ids,/cafe work/);assert(/Eight dollars an hour plus tips/.test(talkText(ids)),talkText(ids));
 reply(ids,/would like the job/);assert(p().careers.diner.hired&&p().careers.diner.rank===1&&p().careers.diner.rep===10,'hired as a Waiter');
 assert(/Wonderful/.test(talkText(ids))&&/Welcome aboard/.test(talkText(ids)),talkText(ids));
 reply(ids,/Clock me in right now/);assert.equal(p().shift?.employer,'diner','clocked in through the talk');assert(dinerOf(p()),'the diner clock is part of the shift');
 assert(closeTalk(ids,key));
 const tasks0=p().shift.tasks.map(t=>t.kind);assert.deepEqual(tasks0,['take_order','serve_plate'],'day 1, rank 1: take orders and serve them');
 // ---- play: whatever the floor offers, nearest need first; the clock jumps ahead when nothing is on offer
 const spotsNow=()=>dinerSpots(p());
 const act=s=>{go(s.mx,s.mz);pump(.2);press();if(s.act==='bus')pump(1.8)};
 const tasksDone=()=>p().shift.tasks.every(t=>t.done>=t.target);
 function play({until,skipTicket=null,limit=400}){
  for(let i=0;i<limit&&!until();i++){
   const spots=spotsNow().filter(s=>!(skipTicket!==null&&(s.act==='pickup'||s.act==='serve')&&s.ref===skipTicket)),order=['serve','pickup','bus','take'];
   const s=order.map(a=>spots.find(x=>x.act===a)).find(Boolean);
   if(s)act(s);else{at(p().routine.minutes+3);pump(.7)}
   assert(p().shift,'still on shift at '+p().routine.minutes);
  }
  assert(until(),'the goal was reached');
 }
 // one full order by hand first, step by step, asserting each rule
 play({until:()=>spotsNow().some(s=>s.act==='take'),limit:40});
 const takeSpot=spotsNow().find(s=>s.act==='take');assert(/Take the order/.test(takeSpot.label),takeSpot.label);
 act(takeSpot);{const d=dinerOf(p());assert.equal(d.tickets.length,1,'one ticket on the rail');assert.equal(p().shift.pieces.ordersTaken,1);assert.equal(d.tickets[0].stage,'queued','the cook is the NPC at rank 1')}
 assert(!spotsNow().some(s=>s.act==='pickup'),'not ready yet');
 at(p().routine.minutes+8);pump(.8);assert.equal(dinerOf(p()).tickets[0].stage,'ready','the order is ready on the pass');
 {const s=spotsNow().find(x=>x.act==='pickup');assert(s&&/Pick up/.test(s.label),'pickup offered');act(s);assert.equal(dinerOf(p()).carried.length,1,'order in hand')}
 const cup=g.scene().getObjectByName('diner-held-cup'),wrist=cup?.parent.getObjectByName('WristL');
 assert(cup?.visible&&wrist,'a carried order shows a cup by the animated left hand');
 assert(cup.getWorldPosition(cup.position.clone()).distanceTo(wrist.getWorldPosition(cup.position.clone()))<.115,'the cup is in reach of the palm');
 {const s=spotsNow().find(x=>x.act==='serve');assert(s,'serve offered at the table');const cash0=p().cash,tips0=dinerOf(p()).tipsCents;act(s);const d=dinerOf(p());assert.equal(d.servedOrders,1);assert(d.tipsCents>=50&&d.tipsCents<=300,'tip $0.50..$3.00: '+d.tipsCents);assert.equal(p().shift.pieces.tips,d.tipsCents,'tips are counted as a piece, in cents');assert.equal(p().cash,cash0,'pay comes at clock-out, not per order')}
 assert.equal(cup.visible,false,'serving clears the carried cup');
 assert(p().skills.hospitality.xp>0,'hospitality experience is earned');
 at(p().routine.minutes+30);pump(.8);{const s=spotsNow().find(x=>x.act==='bus');assert(s,'the table is dirty after the meal');act(s);assert.equal(p().shift.pieces.tablesBused,1);assert(dinerOf(p()).tables.every(t=>t.status!=='dirty'||t.id!==s.ref),'cleared')}
 // finish the day's tasks (take 6, serve 8)
 play({until:tasksDone});
 const sh1=p().shift,paid1=sh1.paidMinutes,tips1=dinerOf(p()).tipsCents,pieces1={...sh1.pieces},cash1=p().cash,rep1=p().careers.diner.rep;
 assert(paid1>=60,'a counted shift: '+paid1+' min on site');assert.equal(pieces1.failedOrders||0,0,'no failed order today');
 // clock out through the talk: wage + pieces + tips + bonus
 go(0,-2);pump(.3);press();assert(talkOpen(ids));reply(ids,/cafe work/);reply(ids,/Clock me out/);assert(!p().shift,'clocked out');assert(closeTalk(ids,key));
 {const stub=p().payStubs[0],pieceCents=Object.entries(pieces1).reduce((s,[k,n])=>s+(PIECE_PAY[k]||0)*n,0);
  assert(stub.paidMinutes>=paid1,'the clock ran on while talking');assert.equal(stub.wage,wageFor(stub.paidMinutes),'wage by the hour on site');assert.equal(stub.bonus,DINER_BONUS_PER_RANK*1,'$10 x rank bonus when every task is done');assert.equal(stub.piecePay,pieceCents,'pieces include the tips in cents');assert(pieces1.tips===tips1&&tips1>0);
  assert.equal(stub.total,stub.wage+stub.piecePay+stub.bonus);assert.equal(p().cash,cash1+stub.total,'cash paid');assert.equal(p().careers.diner.shifts,1,'one counted shift');assert(p().careers.diner.rep>rep1,'reputation up');assert.equal(p().careers.diner.lastShiftDay,1)}
 go(0,-2);pump(.3);press();assert(/Sharp shift earlier/.test(talkText(ids)),'Elena remembers the shift: '+talkText(ids));assert(closeTalk(ids,key));assert.equal(p().careers.diner.rank,1,'not promoted yet: one shift');
 // ---- day 2: a customer who is never served gives up: no tip, -2 reputation, wages untouched
 at(480,2);pump(1);go(0,-2);pump(.3);press();reply(ids,/cafe work/);reply(ids,/Clock me in/);assert.equal(p().shift?.employer,'diner');assert(closeTalk(ids,key));
 assert.deepEqual(p().shift.tasks.map(t=>t.kind),['take_order','bus_table']);
 play({until:()=>spotsNow().some(s=>s.act==='take'),limit:60});
 const takeBad=spotsNow().find(s=>s.act==='take');act(takeBad);const badTicket=dinerOf(p()).tickets[0].id;
 play({until:()=>(p().shift.pieces.failedOrders||0)>=1,skipTicket:badTicket,limit:900});
 assert.equal(p().shift.pieces.failedOrders,1,'the forgotten order counted as failed');assert(!dinerOf(p()).tickets.some(t=>t.id===badTicket),'its ticket is gone');
 play({until:tasksDone});
 {const sh=p().shift,paid=sh.paidMinutes,pieces={...sh.pieces},cash0=p().cash,rep0=p().careers.diner.rep;
  go(0,-2);pump(.3);press();reply(ids,/cafe work/);reply(ids,/Clock me out/);assert(closeTalk(ids,key));
  const stub=p().payStubs[0];assert.equal(stub.wage,wageFor(stub.paidMinutes),'a failed order never docks the wage (the full hourly wage for every minute on site)');assert.equal(stub.bonus,DINER_BONUS_PER_RANK,'the bonus is still paid when the tasks are done');
  assert.equal(p().cash,cash0+stub.total);assert.equal(p().careers.diner.rep-rep0,5+(stub.paidMinutes>=300?2:0)-2*1,'+5 all tasks, +2 a full shift, -2 for the failed order: '+(p().careers.diner.rep-rep0));assert.equal(p().careers.diner.shifts,2)}
 // ---- promotion after two counted shifts: Waiter -> Barista & Cook, asked at the counter
 assert(p().skills.hospitality.xp>=40,'hospitality level 2 reached: '+p().skills.hospitality.xp+' xp');
 go(0,-2);pump(.3);press();reply(ids,/cafe work/);reply(ids,/due a promotion/);assert.equal(p().careers.diner.rank,2,'promoted: '+talkText(ids));assert(/Barista/.test(talkText(ids)),talkText(ids));assert(closeTalk(ids,key));
 // ---- a save from before this change (cafe employed) loads as a diner Rank 1 employee; a shift left half done is paid at the old rate; saved without the old field it stays put
 {const old=normalizeProgress({cash:100,cafe:{employed:true,stage:'serve',customer:1,day:3,paidDay:2,served:1}});
  assert(old.careers.diner.hired&&old.careers.diner.rank===1,'employed -> hired at Rank 1');assert.equal(old.careers.diner.lastShiftDay,2,'lastShiftDay from paidDay');assert.equal(old.cash,100+1200,'one served customer settled at the old $12');assert.equal(old.cafe,undefined,'the old field is dropped');assert(old.messages.some(m=>/real career now/.test(m.text)),'a phone note');
  const again=normalizeProgress(JSON.parse(JSON.stringify(old)));assert.equal(again.cash,old.cash,'idempotent');assert.equal(again.careers.diner.rank,1);
  assert(!normalizeProgress({cafe:{employed:false}}).careers.diner,'not employed: nothing happens');assert.equal(normalizeProgress({cafe:{employed:true,stage:'off',paidDay:0,served:2}}).cash,0,'a finished (off) shift owes nothing')}
 console.log('PASS diner-game.mjs: hired at Elena on day 1 and clocked in through the talk; order taken, collected at the pass, served with a $0.50-$3.00 tip, table cleared; wage + pieces + tips + $10 x rank bonus paid at clock-out; a forgotten order costs -2 rep and the tip but never wages; promoted to Barista & Cook after 2 counted shifts; an old cafe-employed save loads as a Rank 1 diner employee.');
}finally{await g.done()}
