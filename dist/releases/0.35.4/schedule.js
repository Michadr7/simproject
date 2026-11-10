// A person's day (0.35.4, DESIGN 4.20). Pure: the plan for a day is a function of the person, the day number and the map, so it is never saved and is the same for everyone.
// A plan is a list of blocks that covers the whole day, 0 to 1440 minutes, in order: {from, to, act, place} and, for 'travel', {origin, mode}.
//   sleep   in bed at home            home    awake at home
//   travel  on the way from `origin` to `place`, mode 'walk' or 'drive'
//   work    at their post             shop    at a shop as a customer
//   away    off the map (a commuter at home, a resident at work out of town)
// Every day starts and ends where the person lives, so days join up without a jump. Travel times are estimates (population.js tripOf) until A2 has real paths: pass `trip` to replace them.
import {MAP} from './map-definition.js';
import {hashOf,tripOf,isAway} from './population.js';

export const ACTS=['sleep','home','travel','work','shop','away'];
export const DAY=1440;
const LAST_ERRAND=1290; // nobody sets out on an errand that would end after 9:30 PM
const ERRAND_REACH=45;  // nor to a shop more than this many game minutes away
const LIE_IN=480;        // someone on a late shift is still up by 8 to 9 AM

export function dayPlan(person,day,ctx={}){
 const map=ctx.map||MAP,trip=ctx.trip||((from,to,p)=>tripOf(from,to,p,map));
 const h=(...key)=>hashOf(map.seed,person.id,...key),today=(...key)=>h('day',day,...key);
 const blocks=[];let now=0,here=person.home;
 const rest=isAway(person.home)?'away':'home';
 // stay here until `until` (never backwards, never past midnight)
 const stay=(until,act)=>{const end=Math.min(DAY,Math.max(now,Math.round(until)));if(end>now){blocks.push({from:now,to:end,act,place:here});now=end}};
 const go=to=>{if(to===here)return;const t=trip(here,to,person),end=Math.min(DAY,now+Math.max(1,Math.round(t.minutes)));
  if(end>now)blocks.push({from:now,to:end,act:'travel',place:to,origin:here,mode:t.mode});now=end;here=to};
 const minutesTo=(from,to)=>from===to?0:Math.max(1,Math.round(trip(from,to,person).minutes));
 // a short visit to a shop that is open for the whole visit, if there is time to get home after it
 const errand=(shops,salt)=>{
  for(const id of shops){const shop='shop:'+id,[opens,closes]=map.shops[id].hours,out=minutesTo(here,shop),arrive=now+out,leave=arrive+15+today(salt,'long')%16;
   if(out<=ERRAND_REACH&&arrive>=opens&&leave<=closes&&leave+minutesTo(shop,person.home)<=LAST_ERRAND){go(shop);stay(leave,'shop');return true}}
  return false};
 const shopOrder=salt=>Object.keys(map.shops).sort((a,b)=>today(salt,a)-today(salt,b)||(a<b?-1:1));
 const toBed=wake=>{go(person.home);stay(Math.max(now+45,Math.min(1380,wake+960)),'home');stay(DAY,'sleep')}; // about eight hours before the next waking, and never straight from the door to bed

 if(!person.resident){ // a commuter: off the map except for the shift
  const [from,to]=person.hours,arrive=from-5-today('early')%10;
  stay(arrive-minutesTo(person.home,person.work),'away');go(person.work);stay(to+(to<=1320?today('late')%10:0),'work');go(person.home);stay(DAY,'away');
 }else if(person.post){ // a resident with a post in town
  const [from,to]=person.hours,arrive=from-5-today('early')%10,leave=arrive-minutesTo(person.home,person.work),wake=Math.max(0,Math.min(leave-40-h('prep')%20,LIE_IN+h('lie-in')%60));
  stay(wake,'sleep');stay(leave,'home');go(person.work);stay(to+(to<=1320?today('late')%10:0),'work');
  if(today('errand')%3===0)errand(shopOrder('errand'),'errand');
  toBed(wake);
 }else if(person.work){ // a resident who works out of town: gone by about 7:30, back about 5:30
  const leave=420+h('leave')%60,wake=leave-50,back=1020+h('back')%60;
  stay(wake,'sleep');stay(leave,'home');go(person.work);stay(back,'away');
  if(today('errand')%4===0)errand(shopOrder('errand'),'errand');
  toBed(wake);
 }else{ // at home: a morning and an afternoon outing on some days
  const wake=420+h('wake')%90;
  stay(wake,'sleep');
  if(today('am')%2===0){stay(540+today('am-at')%60,'home');if(errand(shopOrder('am'),'am'))go(person.home)}
  if(today('pm')%2===0){stay(Math.max(now+30,900+today('pm-at')%120),'home');if(errand(shopOrder('pm'),'pm'))go(person.home)}
  go(person.home);stay(Math.max(now+45,1290+h('bed')%60),'home');stay(DAY,'sleep');
 }
 if(now<DAY)stay(DAY,here===person.home?rest:'travel');
 return blocks;
}

// The block a minute falls in, with how far through it the person is (0 to 1): for a 'travel' block that is how far along the way.
export function blockAt(plan,minute){
 const m=((minute%DAY)+DAY)%DAY,b=plan.find(x=>m>=x.from&&m<x.to)||plan[plan.length-1];
 return {...b,progress:b.to>b.from?Math.min(1,Math.max(0,(m-b.from)/(b.to-b.from))):1};
}
export const stateAt=(person,day,minute,ctx)=>blockAt(dayPlan(person,day,ctx),minute);

// The whole town's days, with each plan worked out once per day (the game asks every frame; a plan is about ten blocks).
export function createSchedule(population,ctx={}){
 const plans=new Map();let planDay=null;
 const planOf=(id,day)=>{if(day!==planDay){plans.clear();planDay=day}let plan=plans.get(id);
  if(!plan){const person=population.people.find(p=>p.id===id);if(!person)return null;plan=dayPlan(person,day,ctx);plans.set(id,plan)}return plan};
 const at=(id,day,minute)=>{const plan=planOf(id,day);return plan&&blockAt(plan,minute)};
 return {planOf,at,
  // everyone who is at the place at that minute (not the people on their way to it)
  present:(place,day,minute)=>population.people.filter(p=>{const b=at(p.id,day,minute);return b.act!=='travel'&&b.place===place}),
  // everyone on the move at that minute
  travelling:(day,minute)=>population.people.filter(p=>at(p.id,day,minute).act==='travel')};
}
