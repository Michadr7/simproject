// diner D-A wiring (notes/diner-design.md): the diner career runs through the generic shift.js and careers.js with a test map (the employer goes into MAP in the game-wiring stage).
import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {freshProgress} from '../dist/jobs.js';
import {hire} from '../dist/careers.js';
import {clockIn,clockOut,canClockIn,shiftPay,recordPiece,TASKS,PIECE_PAY,dailyTasks} from '../dist/shift.js';
import {DINER_RANKS,DINER_HOURS,DINER_ID,DINER_BONUS_PER_RANK} from '../dist/diner-job.js';
const E={id:DINER_ID,name:'Alder Coffee & Diner',skill:'hospitality',office:'ridgeline-office',owner:{kind:'npc',id:'elena',name:'Elena',title:'Manager'},hours:DINER_HOURS,sites:MAP.employers[0].sites,ranks:DINER_RANKS};
const map={...MAP,employers:[...MAP.employers,E]};
for(const r of DINER_RANKS)for(const k of r.tasks)assert(TASKS[k]&&PIECE_PAY[TASKS[k].piece]!==undefined,'task '+k+' has a piece with a pay rate');
let p=freshProgress();p={...p,housing:{...p.housing,day:3},routine:{...p.routine,minutes:600}};
const h=hire(p,DINER_ID,map);assert(!h.error,'hire: '+h.error);p=h.state;
assert(dailyTasks(E,1,0,3).every(t=>DINER_RANKS[0].tasks.includes(t.kind)),'rank 1 only offers waiter tasks');
const early={...p,routine:{...p.routine,minutes:300}};assert.match(canClockIn(early,DINER_ID,map).error,/8:00 AM to 6:00 PM.*5:00 PM/,'the clock-in message reads the employer hours');
let c=clockIn(p,DINER_ID,map);assert(!c.error,'clock in: '+c.error);p=c.state;
for(const t of p.shift.tasks){p=recordPiece(p,TASKS[t.kind].piece,t.target).state}
p=recordPiece(p,'tips',275).state;p={...p,shift:{...p.shift,paidMinutes:480}};
const pay=shiftPay(p,p.shift,map);assert.equal(pay.bonus,DINER_BONUS_PER_RANK*1,'all tasks done: $10 x rank, not the 2500 of the logging bonus');assert(pay.piecePay>=275,'tips are paid in cents');
const wageBefore=Math.round(480*DINER_RANKS[0].wage/60);assert.equal(pay.wage,wageBefore);
const rep0=p.careers[DINER_ID].rep,cash0=p.cash;
let q=recordPiece(p,'failedOrders',2).state;const pay2=shiftPay(q,q.shift,map);assert.equal(pay2.wage,wageBefore,'failed orders never reduce wages');
const out=clockOut(q,'clock-out',map);assert(!out.error);assert(out.repDelta<=5+2-4,'two failed orders cost 4 rep: '+out.repDelta);
const out0=clockOut(p,'clock-out',map);assert.equal(out0.repDelta-out.repDelta,4,'each failed order is -2 rep');
console.log('PASS diner-wiring: hospitality skill, diner tasks and pieces, hours message from the employer, $10 x rank bonus, tips in cents, failed order = -2 rep and no wage dock');