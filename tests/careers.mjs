// Careers and shifts (0.35 step 1, DESIGN 4.15): hiring, tools handed over once, promotions, quitting, company names and owners;
// clocking in by daylight, one shift at a time, wage on site only, piece pay, tasks, bonus, reputation, end of day, off site, pay stubs, save normalisation.
import assert from 'node:assert/strict';
import {MAP,validateMap} from '../dist/map-definition.js';
import {freshProgress,normalizeProgress} from '../dist/jobs.js';
import {itemById} from '../dist/items.js';
import {addItem,countItem} from '../dist/inventory.js';
import {xpForNext} from '../dist/skills.js';
import {hire,quit,promote,nextRank,careerOf,rankOf,collectOwed,employerName,ownerOf,canManage,renameCompany,setCoOwner,changeRep,START_REP} from '../dist/careers.js';
import {clockIn,clockOut,tickShift,recordPiece,dailyTasks,shiftPay,onSiteAt,canClockIn,OFF_SITE_LIMIT,PIECE_PAY,BONUS_PER_RANK,TASKS} from '../dist/shift.js';

const R='ridgeline',E=MAP.employers.find(e=>e.id===R);
assert.deepEqual(validateMap(),[],'the map with employers validates');
for(const e of MAP.employers)for(const r of e.ranks){for(const id of r.grants)assert(itemById(id)?.type==='tool',`${e.id} ${r.id} grants a real tool (${id})`);for(const k of r.tasks)assert(TASKS[k],`${e.id} ${r.id} task kind ${k} exists`)}
// the validator catches a broken employer
{const bad={...MAP,employers:[{...E,office:'nowhere',ranks:[E.ranks[1],E.ranks[0]]}]};const problems=validateMap(bad);assert(problems.some(p=>p.includes('unknown office')),'unknown office caught');assert(problems.some(p=>p.includes('needs or pays less')),'ranks out of order caught')}

const at=(p,day,minutes)=>({...p,housing:{...p.housing,day},routine:{...p.routine,minutes}});
const xpFor=level=>{let xp=0;for(let l=1;l<level;l++)xp+=xpForNext(l);return xp};
const withLevel=(p,level)=>({...p,skills:{...p.skills,lumberjack:{xp:xpFor(level)}}});

// ── Hiring ──
let p=freshProgress();
assert.equal(careerOf(p,R).hired,false);assert.equal(rankOf(p,R),null);
assert(canClockIn(at(p,1,480),R).error.includes('Apply'),'not hired: no clock-in');
// an old save carrying logs: bought back once at $1 each
p=addItem(addItem(p,'wood-log').state,'wood-log').state;
let h=hire(p,R);assert(!h.error);p=h.state;
assert.deepEqual(h.boughtBack,{count:2,earned:200});assert.equal(countItem(p,'wood-log'),0);assert.equal(p.cash,200);
assert.equal(careerOf(p,R).rank,1);assert.equal(careerOf(p,R).rep,START_REP);assert.equal(rankOf(p,R).id,'trainee');
assert.deepEqual(h.handed,['axe']);assert.equal(countItem(p,'axe'),1,'the Trainee gets an axe');
assert(hire(p,R).error,'cannot be hired twice');

// ── Quitting and climbing again: the axe is handed over once, ever; XP stays ──
p=withLevel(p,4);
let q=quit(p,R);assert(!q.error);let pq=q.state;
assert.equal(careerOf(pq,R).hired,false);assert.equal(careerOf(pq,R).rank,0);assert.equal(careerOf(pq,R).shifts,0);assert.equal(pq.skills.lumberjack.xp,xpFor(4),'skill XP stays');
assert.equal(countItem(pq,'axe'),1,'the tool you were given stays yours');
pq={...pq,inventory:{...pq.inventory,slots:pq.inventory.slots.filter(s=>s.id!=='axe')}}; // sold or lost it
h=hire(pq,R);assert(!h.error);assert.deepEqual(h.handed,[],'no second free axe after quitting');assert.equal(countItem(h.state,'axe'),0);assert.equal(h.boughtBack,null,'buy-back only on the first hire');
// already carrying the tool when it is due: counted as handed over, no duplicate
{let f=addItem(freshProgress(),'axe',{}).state;const r=hire(f,R);assert.deepEqual(r.handed,[]);assert.equal(countItem(r.state,'axe'),1);assert(careerOf(r.state,R).granted.includes('axe'))}
// a full inventory: the tool is owed and collected later
{let f=freshProgress();for(let i=0;i<8;i++)f=addItem(f,'water').state;for(let i=0;i<70&&!addItem(f,'water').error;i++)f=addItem(f,'water').state;
 const r=hire(f,R);assert.deepEqual(r.owed,['axe']);assert.equal(countItem(r.state,'axe'),0);assert(collectOwed(r.state,R).error,'still full');
 const room={...r.state,inventory:{...r.state.inventory,slots:r.state.inventory.slots.slice(1)}};const c=collectOwed(room,R);assert.deepEqual(c.handed,['axe']);assert.equal(careerOf(c.state,R).owed.length,0)}
// quitting is refused while on that employer's shift
{const s=clockIn(at(p,1,480),R).state;assert.equal(quit(s,R).error,'Clock out first.')}

// ── Promotions ──
{let s=withLevel(p,1);let n=nextRank(s,R);assert.equal(n.rank.id,'feller');assert.equal(n.ready,false);assert(promote(s,R).error.startsWith('Not yet'));
 s=withLevel(s,3);s={...s,careers:{...s.careers,[R]:{...careerOf(s,R),shifts:3,rep:20}}};n=nextRank(s,R);assert(n.ready,'level 3, 3 shifts, rep 20 makes a Feller');
 const r=promote(s,R);assert(!r.error);assert.equal(rankOf(r.state,R).id,'feller');
 // all the way up: the top rank says so
 let top={...withLevel(r.state,20),careers:{...r.state.careers,[R]:{...careerOf(r.state,R),shifts:99,rep:100}}};for(let i=0;i<10&&!promote(top,R).error;i++)top=promote(top,R).state;
 assert.equal(rankOf(top,R).id,'foreman');assert(nextRank(top,R).top);assert.equal(promote(top,R).error,'You are at the top rank.');
 assert.equal(changeRep(top,R,500).careers[R].rep,100,'rep is capped');assert.equal(changeRep(top,R,-500).careers[R].rep,0)}

// ── Names, owners, co-owners ──
assert.equal(employerName(p,R),'Ridgeline Timber Co.');assert.equal(ownerOf(p,R).name,'Walt Hargrove');
assert.equal(canManage(p,R),false,'an NPC-owned company takes no decisions from players');assert(renameCompany(p,R,'Mine').error);
{let s={...p,companies:{[R]:{owner:{kind:'player',id:'me'}}}};assert(canManage(s,R));
 s=renameCompany(s,R,'  Pine & Co  ').state;assert.equal(employerName(s,R),'Pine & Co');
 assert(setCoOwner(s,R,'ana',true,'bob').error,'only the owner chooses co-owners');
 s=setCoOwner(s,R,'ana',true).state;assert(canManage(s,R,'ana'),'a co-owner makes owner-level decisions');assert(!renameCompany(s,R,'Ana Lumber','ana').error);
 assert(setCoOwner(s,R,'zed',true,'ana').error,'a co-owner cannot add co-owners');
 assert(!canManage(setCoOwner(s,R,'ana',false).state,R,'ana'),'removed co-owner loses it');
 const saved=normalizeProgress(JSON.parse(JSON.stringify(s)));assert.equal(employerName(saved,R),'Pine & Co');assert.deepEqual(saved.companies[R].coOwners,['ana'])}

// ── Daily tasks: by counters, never random ──
{const t1=dailyTasks(E,1,0,1);assert.equal(t1.length,2);assert.deepEqual(t1.map(t=>t.kind).sort(),['fell','landing']);assert.deepEqual(dailyTasks(E,1,0,1),t1,'same day, same tasks');
 assert.notDeepEqual(dailyTasks(E,1,1,2).map(t=>t.target),t1.map(t=>t.target),'targets vary day to day');
 const t2=dailyTasks(E,2,3,4);assert.equal(t2.length,3);assert(t2.some(t=>t.kind==='mill'),'a new Feller gets a milling task');
 const t4=dailyTasks(E,4,0,9);assert.equal(t4.length,4);assert(t4.some(t=>t.kind==='stack'||t.kind==='pick'),'a Yard hand gets warehouse work');
 for(let d=1;d<20;d++)for(const t of dailyTasks(E,5,d,d))assert(TASKS[t.kind].amounts.includes(t.target));}

// ── Clocking in ──
assert(canClockIn(at(p,1,359),R).error.includes('6:00 AM'),'before 6 AM');
assert(canClockIn(at(p,1,1051),R).error.includes('5:30 PM'),'after the last clock-in');
let s=clockIn(at(p,1,480),R);assert(!s.error);s=s.state;
assert.equal(s.shift.employer,R);assert.equal(s.shift.tasks.length,2);
assert(canClockIn(s,R).error.includes('already clocked in'));
// one shift at a time across employers
{const two={...MAP,employers:[E,{...E,id:'other',name:'Other Co'}]};const both={...s,careers:{...s.careers,other:{...careerOf(s,R)}}};
 assert(clockIn(both,'other',two).error.includes('Clock out first'),'no second shift at the same time')}

// ── Wage on site only, off-site clock-out ──
const tick=(st,minutes,onSite,day=st.housing.day)=>tickShift(at(st,day,minutes),{onSite});
let r=tick(s,540,true);s=r.state;assert.equal(s.shift.paidMinutes,60,'an hour on site');
r=tick(s,570,false);s=r.state;assert.equal(s.shift.paidMinutes,60,'off site is not paid');assert.equal(s.shift.offSiteMinutes,30);
r=tick(s,580,true);s=r.state;assert.equal(s.shift.offSiteMinutes,0,'back on site resets the off-site count');assert.equal(s.shift.paidMinutes,70);
{const away=tick(s,580+OFF_SITE_LIMIT,false);assert.equal(away.stub.reason,'off-site','an hour away clocks you out');assert.equal(away.state.shift,null)}

// ── Pieces, tasks, bonus, reputation ──
{const before=s.shift.tasks;let w=s,finished=[];for(const t of before){const x=recordPiece(w,t.piece,t.target+5);w=x.state;finished.push(...x.finished)}
 assert.equal(finished.length,before.length,'each task reports when it is done');assert(w.shift.tasks.every(t=>t.done===t.target),'progress stops at the target');
 assert.equal(recordPiece(freshProgress(),'logs',3).state.shift,null,'off shift a piece counts for nothing');
 const pay=shiftPay(w);const pieces=before.reduce((sum,t)=>sum+PIECE_PAY[t.piece]*(t.target+5),0);
 assert.equal(pay.wage,Math.round(70*800/60));assert.equal(pay.piecePay,pieces);assert.equal(pay.bonus,BONUS_PER_RANK);assert(pay.all);
 const cashBefore=w.cash,o=clockOut(at(w,1,600));assert(!o.error);
 assert.equal(o.state.cash,cashBefore+pay.total,'paid in cash at clock-out');assert.equal(o.stub.total,pay.total);assert.equal(o.stub.from,480);
 assert.equal(o.repDelta,5,'all tasks done: +5 (not a full shift)');assert.equal(careerOf(o.state,R).shifts,1,'counted: over an hour on site');
 assert.equal(o.state.payStubs[0].name,'Ridgeline Timber Co.');
 assert(canClockIn(at(o.state,1,700),R).error.includes('already worked a shift here today'),'one shift a day per employer');
 assert(!canClockIn(at(o.state,2,400),R).error,'tomorrow again')}
// a short shift with unfinished tasks: not counted, reputation down
{const st=clockIn(at(p,3,600),R).state,o=clockOut(tick(st,630,true).state);assert.equal(o.counted,false);assert.equal(careerOf(o.state,R).shifts,0);assert.equal(o.repDelta,-4);assert.equal(o.stub.bonus,0)}

// ── End of day: at 6 PM, and after a sleep skip into the next day ──
{const st=clockIn(at(p,5,900),R).state,o=tick(st,1080,true);assert.equal(o.stub.reason,'end-of-day');assert.equal(o.stub.paidMinutes,180);assert.equal(o.stub.to,1080);assert.equal(o.state.shift,null)}
{const st=clockIn(at(p,5,1000),R).state,o=tick(st,360,true,6);assert.equal(o.stub.reason,'end-of-day');assert.equal(o.stub.paidMinutes,80,'paid only up to 6 PM');assert.equal(o.stub.day,5)}
// a full shift adds reputation
{const st=clockIn(at(p,7,360),R).state,o=tick(st,1080,true);assert.equal(o.repDelta,2-4,'full shift +2, two unfinished tasks -4')}

// ── Pay stubs: the last 7 ──
{let st=p;for(let d=10;d<20;d++){st=clockIn(at(st,d,480),R).state;st=tick(st,600,true).state;st=clockOut(st).state}assert.equal(st.payStubs.length,7);assert.equal(st.payStubs[0].day,19)}

// ── On site ──
assert(onSiteAt(R,{x:100,z:-270}),'Pine Ridge is on site');assert(onSiteAt(R,{x:85,z:50}),'the timber yard (I5)');assert(onSiteAt(R,{x:160,z:30}),'the warehouse plot (I1)');
assert(!onSiteAt(R,{x:-5,z:15}),'the city is off site');assert(onSiteAt(R,{x:-5,z:15,inCompanyVehicle:true}),'in the company truck');
assert(onSiteAt(R,{x:0,z:0,room:'ridgeline-office'}),'inside the office');assert(!onSiteAt(R,{x:100,z:-270,room:'house:cedar-1'}),'inside some house is not on site');

// ── Save ──
{const st=clockIn(at(p,8,480),R).state,back=normalizeProgress(JSON.parse(JSON.stringify(st)));
 assert.deepEqual(back.shift,st.shift,'a shift survives a save');assert.deepEqual(back.careers[R],st.careers[R]);
 const notHired=normalizeProgress({...JSON.parse(JSON.stringify(st)),careers:{}});assert.equal(notHired.shift,null,'a shift for an employer you do not work for is dropped');
 const junk=normalizeProgress({careers:{[R]:{hired:true,rank:99,rep:-5,shifts:'x',granted:['axe','nope']},ghost:{hired:true}},shift:{employer:'ghost'},payStubs:[{employer:R,total:-1},null]});
 assert.equal(junk.careers[R].rank,E.ranks.length);assert.equal(junk.careers[R].rep,0);assert.deepEqual(junk.careers[R].granted,['axe']);assert.equal(junk.careers.ghost,undefined);assert.equal(junk.shift,null);assert.equal(junk.payStubs.length,1);assert.equal(junk.payStubs[0].total,0)}

console.log('PASS careers.mjs: hiring (axe handed over once, ever; old logs bought back), promotions, quitting keeps XP, company names and co-owners, daily tasks by counters, daylight clock-in, one shift at a time, wage on site only, off-site and end-of-day clock-out, pieces, bonus, reputation, pay stubs, save normalisation.');
