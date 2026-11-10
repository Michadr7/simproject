// A person's day (0.35.4, DESIGN 4.20): every plan covers the whole day in order and joins up with the next day; every post is staffed for its hours, every day;
// people sleep, shop only while the shop is open, and are where the plan says; the town's schedule answers "who is here now".
import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {buildPopulation,isAway,tripOf} from '../dist/population.js';
import {dayPlan,blockAt,stateAt,createSchedule,ACTS,DAY} from '../dist/schedule.js';

const town=buildPopulation(),DAYS=[...Array(21).keys()].map(d=>d+1);
let sleepLeast=Infinity,errands=0,trips=0;
for(const p of town.people)for(const day of DAYS){
 const plan=dayPlan(p,day),who=`${p.name}, day ${day}`;
 assert.deepEqual(dayPlan(p,day),plan,'the same day twice is the same plan');
 // covers 0..1440 in order, no gaps, no empty blocks
 assert.equal(plan[0].from,0,who);assert.equal(plan.at(-1).to,DAY,who);
 plan.forEach((b,i)=>{assert.ok(Number.isInteger(b.from)&&Number.isInteger(b.to)&&b.to>b.from,who);assert.ok(ACTS.includes(b.act),who);if(i)assert.equal(b.from,plan[i-1].to,who)});
 // starts and ends at home, at rest; places follow from each other; a trip goes somewhere else and is never cut off by midnight
 const rest=isAway(p.home)?['away']:['sleep','home'];
 assert.equal(plan[0].place,p.home,who);assert.equal(plan.at(-1).place,p.home,who);assert.ok(rest.includes(plan[0].act)&&rest.includes(plan.at(-1).act),who);
 let here=p.home;
 for(const b of plan){
  if(b.act==='travel'){trips++;assert.equal(b.origin,here,who);assert.notEqual(b.place,b.origin,who);assert.ok(['walk','drive'].includes(b.mode),who);assert.ok(b.to<DAY,`${who}: still on the road at midnight`);
   assert.equal(b.to-b.from,tripOf(b.origin,b.place,p).minutes,who);if(b.mode==='drive')assert.ok(p.drives,who)}
  else assert.equal(b.place,here,who);
  here=b.place;
  if(b.act==='sleep'||b.act==='home')assert.equal(b.place,p.home,who);
  if(b.act==='away')assert.ok(isAway(b.place),who);
  if(b.act==='work')assert.equal(b.place,p.work,who);
  if(b.act==='shop'){errands++;const [opens,closes]=MAP.shops[b.place.slice(5)].hours;assert.ok(b.from>=opens&&b.to<=closes,`${who}: at ${b.place} ${b.from}-${b.to}`)}
 }
 // a post is staffed for all of its hours; residents sleep
 if(p.post){const [from,to]=p.hours;for(const m of [from,from+1,Math.floor((from+to)/2),to-1]){const b=blockAt(plan,m);assert.ok(b.act==='work'&&b.place===p.work,`${who}: at ${m} is ${b.act} at ${b.place}`)}}
 if(p.resident){const slept=plan.filter(b=>b.act==='sleep').reduce((n,b)=>n+b.to-b.from,0);sleepLeast=Math.min(sleepLeast,slept);assert.ok(slept>=300,`${who} sleeps ${slept} minutes`);assert.equal(plan[0].act,'sleep',who)}
 else assert.ok(plan.every(b=>['away','travel','work'].includes(b.act)),who);
 if(isAway(p.work)){const out=plan.filter(b=>b.act==='away').reduce((n,b)=>n+b.to-b.from,0);assert.ok(out>=480,`${who} is out of town for the working day`)}
}
assert.ok(errands>20,'people do go shopping');assert.ok(trips>town.people.length*DAYS.length,'everybody who works travels');

// days differ (arrival times, errands) but a person's habits do not (the same waking time for someone at home)
const elena=town.people.find(p=>p.name==='Elena');
assert.ok(new Set(DAYS.map(d=>JSON.stringify(dayPlan(elena,d)))).size>3,'not every day is the same');
const atHome=town.people.find(p=>p.resident&&!p.work);assert.equal(new Set(DAYS.map(d=>dayPlan(atHome,d)[0].to)).size,1);

// blockAt: the block and how far through it; minutes wrap; stateAt is the same thing in one call
{const plan=dayPlan(elena,3),travel=plan.find(b=>b.act==='travel'),mid=(travel.from+travel.to)/2,b=blockAt(plan,mid);
 assert.equal(b.act,'travel');assert.ok(Math.abs(b.progress-.5)<1e-9);assert.equal(blockAt(plan,travel.from).progress,0);
 assert.deepEqual(blockAt(plan,DAY+10),blockAt(plan,10));assert.deepEqual(stateAt(elena,3,mid),b);
 assert.equal(blockAt(plan,0).act,'sleep');assert.equal(blockAt(plan,12*60).act,'work');assert.equal(blockAt(plan,12*60).place,'shop:cafe')}

// the town's schedule: who is where
{const sched=createSchedule(town),names=list=>list.map(p=>p.name).sort();
 assert.equal(sched.planOf(elena.id,3),sched.planOf(elena.id,3),'a plan is worked out once a day');assert.deepEqual(sched.planOf(elena.id,3),dayPlan(elena,3));assert.equal(sched.planOf('nobody',3),null);
 for(const day of [1,2,9]){
  // the shops are staffed while they are open: the market by its day clerk then its evening clerk, the café by Elena and the barista
  assert.ok(names(sched.present('shop:market',day,8*60)).includes('Noah'));assert.ok(!names(sched.present('shop:market',day,20*60)).includes('Noah'));
  assert.ok(sched.present('shop:market',day,20*60).some(p=>p.post==='market-evening'));
  assert.equal(sched.present('shop:cafe',day,10*60).filter(p=>p.post).length,2);
  // Ridgeline: everyone is on site from 6 AM to 6 PM, nobody at 3 AM or 9 PM
  const crew=town.people.filter(p=>p.employer==='ridgeline');
  for(const m of [360,720,1079])for(const p of crew)assert.equal(sched.at(p.id,day,m).act,'work',`${p.name} at ${m}`);
  for(const m of [180,1260])for(const p of crew)assert.notEqual(sched.at(p.id,day,m).act,'work');
  assert.equal(sched.present('zone:forest',day,720).length,2,'two fellers in the woods at noon');
  // at 3 AM the town is asleep and the commuters are out of town; at 7:45 AM people are on the move
  assert.ok(town.people.every(p=>sched.at(p.id,day,180).act===(p.resident?'sleep':'away')));
  assert.equal(sched.travelling(day,180).length,0);
  assert.ok(DAYS.slice(0,1).every(()=>[...Array(120).keys()].some(i=>sched.travelling(day,360+i).length>0)));
 }}

// real paths arrive with A2: a caller may replace the travel estimate, and the plan still holds together
{const slow=(from,to,p)=>({...tripOf(from,to,p),minutes:tripOf(from,to,p).minutes*2});
 for(const p of town.people){const plan=dayPlan(p,5,{trip:slow});assert.equal(plan[0].from,0);assert.equal(plan.at(-1).to,DAY);plan.forEach((b,i)=>{if(i)assert.equal(b.from,plan[i-1].to)});
  if(p.post){const b=blockAt(plan,p.hours[0]);assert.equal(b.act,'work',`${p.name} still arrives on time with slower travel`)}}}

console.log(`schedule tests passed: ${town.people.length} people over ${DAYS.length} days, least sleep ${sleepLeast} minutes, ${errands} shop visits`);
