import assert from 'node:assert/strict';
import {ACTIVITIES,RORY,MATT,JENNI,VISITORS,RORY_SPOTS,RORY_WAKE,RORY_BEDTIME,MAP_CROSSING_M,visitorPlan,visitorBlockAt,visitorPose,driveProgress,crossingMinutes,weekdayOf} from '../dist/visitors.js';
import {makeRoute} from '../dist/npc-walk.js';
import {WALK_SPEED} from '../dist/population.js';

// N4 (notes/npc-movement-design.md): pure visitor plans. Rory walks; Matt and Jenni are drive passes as data.
const byId=Object.fromEntries(RORY_SPOTS.map(s=>[s.id,s]));
const ctx={point:p=>byId[p]||null,route:(a,b)=>byId[a]&&byId[b]?makeRoute([byId[a],byId[b]]):null};
const fine=()=>'clear',storm=()=>'storm';
const contiguous=(plan,msg)=>{assert.equal(plan[0].from,0,msg+': starts at 0');assert.equal(plan.at(-1).to,1440,msg+': ends at 1440');for(let i=0;i<plan.length;i++){assert(plan[i].to>plan[i].from,`${msg}: block ${i} has length`);if(i)assert.equal(plan[i].from,plan[i-1].to,`${msg}: block ${i} joins`)}};
const same=(a,b,msg)=>assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),msg);

// 1. Rory: every day is contiguous, starts and ends asleep at camp, uses only the vocabulary, only known spots.
for(let day=1;day<=60;day++)for(const weather of [undefined,fine,storm]){
 const plan=visitorPlan(RORY,day,{weather});contiguous(plan,`Rory day ${day}`);
 assert.equal(plan[0].act,'sleep');assert.equal(plan[0].place,'rory-camp');assert.equal(plan.at(-1).act,'sleep');assert.equal(plan.at(-1).place,'rory-camp');
 assert(plan[0].to>=RORY_WAKE[0]&&plan[0].to<RORY_WAKE[0]+RORY_WAKE[1],'wakes 06:30 to 08:00');
 let here='rory-camp';
 for(const b of plan){assert(ACTIVITIES.includes(b.activity),`activity ${b.activity}`);assert(byId[b.place],`known spot ${b.place}`);
  if(b.act==='travel'){assert.equal(b.origin,here,'a walk starts where the last block ended');assert.equal(b.mode,'walk')}else assert.equal(b.place,here,'a stop stays where he is');here=b.place;
  if(b.act==='sleep')assert.equal(b.place,'rory-camp','sleeps rough only at camp')}
 const lastOut=plan.filter(b=>b.act!=='sleep').at(-1);assert(lastOut.to<=RORY_BEDTIME[0]+RORY_BEDTIME[1]+90,'home by about bedtime');
}

// 2. Pure: same inputs, same plan; the order of calls does not matter; no random or clock (a second module copy would agree, hashes only).
same(visitorPlan(RORY,9,{weather:fine}),visitorPlan(RORY,9,{weather:fine}),'Rory repeats');
const a=visitorPlan(RORY,12,{weather:fine});visitorPlan(RORY,13,{weather:storm});same(a,visitorPlan(RORY,12,{weather:fine}),'order does not matter');
assert(new Set(Array.from({length:30},(_,i)=>JSON.stringify(visitorPlan(RORY,i+1,{weather:fine})))).size>20,'days differ from each other');
same(visitorPlan(RORY,5,{seed:1}),visitorPlan(RORY,5),'default seed is 1');
assert.notDeepEqual(visitorPlan(RORY,5,{seed:2}),visitorPlan(RORY,5,{seed:1}),'another world, another Rory');

// 3. Busyness: fair weather roams more than a storm (optional outdoor blocks follow busyness.js); a storm keeps him at camp.
const roamMinutes=w=>{let m=0;for(let d=1;d<=60;d++)for(const b of visitorPlan(RORY,d,{weather:w}))if(b.act!=='sleep'&&b.place!=='rory-camp')m+=b.to-b.from;return m};
const fineM=roamMinutes(fine),stormM=roamMinutes(storm);assert(fineM>stormM*2,`fine weather roams far more than a storm (${fineM} vs ${stormM})`);assert(stormM<fineM*.4);
assert(visitorPlan(RORY,3,{weather:fine}).some(b=>b.activity==='pace'||b.activity==='sit'),'he sits or paces');

// 4. Pose: personPose draws him: asleep = hidden, a walk moves at walking speed, a stop stands at the spot. Frame-rate independent (a function of the minute only).
{const plan=visitorPlan(RORY,4,{weather:fine}),out={},seen=new Set();
 assert.equal(visitorPose(out,RORY,4,100,{...ctx,weather:fine}).state,'hidden','asleep at 01:40');
 const walk=plan.find(b=>b.act==='travel'),mid=(walk.from+walk.to)/2;visitorPose(out,RORY,4,mid,{...ctx,weather:fine});assert.equal(out.state,'walk');assert.equal(out.moving,true);
 const len=Math.hypot(byId[walk.origin].x-byId[walk.place].x,byId[walk.origin].z-byId[walk.place].z);assert(out.walked<=len+1e-9&&out.walked>0);
 const stop=plan.find(b=>b.act==='pause'||b.act==='outside');visitorPose(out,RORY,4,stop.from+1,{...ctx,weather:fine});assert.equal(out.state,'stand');
 for(let m=0;m<1440;m+=7)seen.add(visitorPose({},RORY,4,m,{...ctx,weather:fine}).state);assert(seen.has('hidden')&&seen.has('walk')&&seen.has('stand'),'sleeps, walks and stands over a day');
 assert.equal(visitorBlockAt(plan,0).act,'sleep');assert.equal(visitorBlockAt(plan,1439).act,'sleep');
 // the same minute reached by fine or coarse sampling gives the same pose
 const p1=visitorPose({},RORY,4,mid,{...ctx,weather:fine}),p2=visitorPose({},RORY,4,mid+1e-9,{...ctx,weather:fine});assert(Math.hypot(p1.x-p2.x,p1.z-p2.z)<1e-6);}
assert(WALK_SPEED>0);

// 5. Jenni: Mon/Wed/Fri only (day 1 is Monday), 08:00 west to east, 15:00 east to west, hidden otherwise; days match busyness.js numbering.
assert.equal(weekdayOf(1),1);assert.equal(weekdayOf(7),7);assert.equal(weekdayOf(8),1);
for(let day=1;day<=28;day++){const plan=visitorPlan(JENNI,day,{weather:storm});contiguous(plan,`Jenni day ${day}`);const drives=plan.filter(b=>b.activity==='drive'),wd=weekdayOf(day);
 if([1,3,5].includes(wd)){assert.equal(drives.length,2,'two passes on a work day');const [am,pm]=drives;assert(Math.abs(am.from-480)<=6&&am.origin==='west'&&am.place==='east','08:00 west to east');assert(Math.abs(pm.from-900)<=6&&pm.origin==='east'&&pm.place==='west','15:00 east to west');
  assert.equal(am.vehicle,'worktruck');assert.equal(am.habits.speeding,false);assert.equal(am.to-am.from,crossingMinutes(am.speed))}
 else assert.equal(drives.length,0,'no pass on a day off');
 for(const b of plan)assert(b.act==='away'||b.act==='travel');}
same(visitorPlan(JENNI,1,{weather:storm}),visitorPlan(JENNI,1,{weather:fine}),'a commuter does not care about the weather (nor does the plan differ between clients)');
{const plan=visitorPlan(JENNI,1),am=plan.find(b=>b.activity==='drive'),out={};assert.equal(driveProgress(out,plan,am.from).t,0);assert.equal(driveProgress(out,plan,(am.from+am.to)/2).t.toFixed(2),'0.50');assert.equal(driveProgress(out,plan,5),null,'not on a pass at 00:05');
 assert.equal(visitorPose({},JENNI,1,am.from+3,ctx).state,'hidden','drivers are not drawn as walkers')}

// 6. Matt: random days, any direction and hour, fast, flags as data, passes never overlap, never run past midnight.
{let days=0,east=0,west=0,stops=0;for(let day=1;day<=300;day++){const plan=visitorPlan(MATT,day);contiguous(plan,`Matt day ${day}`);const drives=plan.filter(b=>b.activity==='drive');if(drives.length)days++;
  assert(drives.length<=2);for(const b of drives){assert(b.from>=MATT.window[0]&&b.to<=1440);assert(b.speed>=22&&b.speed<=28);assert.equal(b.vehicle,'pevrolet');assert.deepEqual({...b.habits},{speeding:true,redLights:true,pulledOver:'often'});assert.equal(b.place,b.origin==='west'?'east':'west');if(b.origin==='east')east++;else west++;if(b.stop)stops++}
  same(plan,visitorPlan(MATT,day),'Matt repeats')}
 assert(days>90&&days<190,`Matt appears on roughly 45% of days (${days}/300)`);assert(east>30&&west>30,'both directions');assert(stops<(east+west)*.2,'rarely stops');
 assert(crossingMinutes(25)<crossingMinutes(13),'faster, shorter crossing');assert.equal(crossingMinutes(25),Math.ceil(MAP_CROSSING_M/25*.5))}

// 7. A delivery visitor is understood as data: in, a visit at each door, out.
{const van={id:'parcel',name:'Parcel van',kind:'delivery',vehicle:'worktruck',days:[2,4],arrive:600,entry:'east',stops:['door-a','door-b'],speed:[10,12],visitMinutes:6};
 const plan=visitorPlan(van,2);contiguous(plan,'delivery');const kinds=plan.filter(b=>b.act!=='away').map(b=>b.activity);assert.deepEqual(kinds,['drive','visit','visit','drive']);
 assert.deepEqual(plan.filter(b=>b.activity==='visit').map(b=>b.place),['door-a','door-b']);assert.equal(visitorPlan(van,3).every(b=>b.act==='away'),true,'nothing on other days')}

// 8. The roster and an unknown kind.
assert.deepEqual(VISITORS.map(v=>v.id),['rory','matt','jenni']);contiguous(visitorPlan({id:'x',kind:'nonsense'},1),'unknown kind is a quiet day');
console.log('PASS visitors: Rory plans (60 days x 3 weathers), busyness, pose, Jenni Mon/Wed/Fri, Matt random passes, delivery data');
