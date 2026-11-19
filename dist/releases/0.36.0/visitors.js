// visitors.js: pure day plans for visitors (people who are not residents), implements N4 of notes/npc-movement-design.md (design: notes/world-system-design.md 'VISITORS AND OUTDOOR LIFE'). Rory walks (full plan, same block shape as schedule.js so npc-walk.js personPose draws him); Matt, Jenni and deliveries are DATA only (drive passes, no road graph, no drawing).
// visitorPlan(visitor, day, ctx) -> blocks covering 0..1440 {from,to,act,place,activity,...}: a pure function of (visitor, day, weather(day)) with hashes only (hashOf, no clock, no chance), so every co-op client given the host's day and weather gets the same plan. The pose at a minute is a pure function of the plan and the minute, so it is frame-rate independent.
// ACTIVITY vocabulary (notes/npc-movement-design.md section 3): walk, stand, pace, sit, enter, exit, visit, loop, drive. `activity` says what the block means; `act` is the schedule.js word npc-walk.js presenceOf understands: travel (walk: drawn, drive: hidden), outside (drawn, paces), pause (drawn, stands or sits), sleep and away (hidden).
// Rory's optional outdoor blocks follow busyness.js (weather x time x weekday, section 6 decision 3): in bad weather or at night he stays at his camp instead of roaming. ctx.weather(day) turns that on; without it he roams as on a fine day.
import {hashOf,WALK_SPEED,GAME_MINUTES_PER_SECOND} from './population.js';
import {personPose,blockIndex} from './npc-walk.js';
import {busyness,takesOutdoor} from './busyness.js';

export const DAY=1440;
export const ACTIVITIES=Object.freeze(['walk','stand','pace','sit','enter','exit','visit','loop','drive']);
export const KINDS=Object.freeze(['loiterer','through-driver','delivery']);
export const SEED=1;                 // default seed when ctx.seed is not given (schedule.js passes the map's seed; the visitors only need it to differ between worlds)
export const MAP_CROSSING_M=1500;    // a through-driver crosses the map end to end (map-master: 1,500 m)
export const DRIVE_ENDS=Object.freeze(['west','east']);

// ── Rory Dobbinson: homeless, loiters on foot all day, sleeps rough (hidden) at his camp ──
// Spots are DATA with placeholder coordinates until the map's edge points exist: pass ctx.spots (same shape) to replace them, and ctx.point(place) to the pose.
export const RORY_SPOTS=Object.freeze([
 {id:'rory-camp',x:-215,z:190,kind:'camp'},
 {id:'rory-bench',x:-20,z:-8,kind:'bench'},
 {id:'rory-edge-north',x:60,z:-215,kind:'edge'},
 {id:'rory-edge-east',x:240,z:30,kind:'edge'},
 {id:'rory-bridge',x:110,z:150,kind:'edge'},
]);
export const RORY_WAKE=Object.freeze([390,90]);      // wakes at 06:30 plus 0 to 89 minutes
export const RORY_BEDTIME=Object.freeze([1260,60]);  // heads back to camp from 21:00 plus 0 to 59 minutes
export const RORY_STAY=Object.freeze([45,105]);      // each stop lasts 45 to 149 game minutes
export const ACTIVITY_OF_KIND=Object.freeze({camp:'sit',bench:'sit',edge:'pace'});
export const ACT_OF_ACTIVITY=Object.freeze({sit:'pause',stand:'pause',visit:'pause',pace:'outside'});

// ── Visitors ──
export const RORY=Object.freeze({id:'rory',name:'Rory Dobbinson',kind:'loiterer'});
export const MATT=Object.freeze({id:'matt',name:'Matt Rossion',kind:'through-driver',vehicle:'pevrolet',chance:45,passes:[1,2],window:[360,1320],speed:[22,28],stopChance:5,habits:Object.freeze({speeding:true,redLights:true,pulledOver:'often'})}); // random days (45%), 1 or 2 passes, any hour 06:00 to 22:00, any direction; speeds in m/s
export const JENNI=Object.freeze({id:'jenni',name:'Jenni Crain',kind:'through-driver',vehicle:'worktruck',days:Object.freeze([1,3,5]),trips:Object.freeze([{at:480,entry:'west'},{at:900,entry:'east'}]),speed:[12,14],jitter:6,habits:Object.freeze({speeding:false,redLights:false})}); // Mon/Wed/Fri 08:00 west to east, 15:00 east to west (owner 2026-11-16)
export const VISITORS=Object.freeze([RORY,MATT,JENNI]);
// A delivery visitor is plain data: {id,name,kind:'delivery',vehicle,days:[1..7],arrive,entry,stops:[door ids],speed:[lo,hi],visitMinutes}. No delivery exists yet in the game: visitorPlan understands the shape so the first one needs no code.

// ── helpers ──
const seedOf=ctx=>ctx&&ctx.seed!==undefined?ctx.seed:SEED;
const hash=(ctx,visitor,...key)=>hashOf(seedOf(ctx),visitor.id,...key);
const range=(h,[lo,span])=>lo+h%span;
const between=(h,[lo,hi])=>lo+(h%1000)/1000*(hi-lo);
export const weekdayOf=day=>(((Math.floor(Number(day))||1)-1)%7+7)%7+1; // 1 Monday ... 7 Sunday (housing.js and busyness.js count the same way)
const walkMinutes=(a,b)=>Math.max(2,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/WALK_SPEED*GAME_MINUTES_PER_SECOND)); // the same sum as population.js tripOf
export const crossingMinutes=(speed,length=MAP_CROSSING_M)=>Math.max(1,Math.ceil(length/speed*GAME_MINUTES_PER_SECOND));

// Fills the day with away (hidden) blocks around the given timed blocks, so blockIndex and personPose work on a driver's plan too.
function fillDay(timed,place='off-map'){
 const out=[];let now=0;
 for(const b of timed.slice().sort((a,c)=>a.from-c.from)){if(b.from>now)out.push({from:now,to:b.from,act:'away',place,activity:'stand'});out.push(b);now=b.to}
 if(now<DAY)out.push({from:now,to:DAY,act:'away',place,activity:'stand'});
 return out;
}

// ── Rory ──
function loiterPlan(visitor,day,ctx){
 const spots=ctx.spots||RORY_SPOTS,camp=spots.find(s=>s.kind==='camp')||spots[0],byId=Object.fromEntries(spots.map(s=>[s.id,s]));
 const trip=ctx.trip||((a,b)=>({minutes:walkMinutes(byId[a],byId[b])}));
 const weekday=weekdayOf(day),h=(...k)=>hash(ctx,visitor,'day',day,...k);
 const wake=range(h('wake'),RORY_WAKE),bedtime=range(h('bed'),RORY_BEDTIME);
 const blocks=[];let now=0,here=camp.id;
 const stay=(until,activity,act=ACT_OF_ACTIVITY[activity])=>{const end=Math.min(DAY,Math.max(now,Math.round(until)));if(end>now){blocks.push({from:now,to:end,act,place:here,activity});now=end}};
 const go=to=>{if(to===here)return true;const end=Math.min(DAY,now+Math.max(1,Math.round(trip(here,to).minutes)));if(end>now){blocks.push({from:now,to:end,act:'travel',mode:'walk',origin:here,place:to,activity:'walk'});now=end;here=to}return true};
 stay(wake,'stand','sleep');
 for(let i=0;i<24&&now<bedtime;i++){
  const b=ctx.weather?busyness({weather:ctx.weather(day),minute:now,weekday}):1,roams=takesOutdoor(b,h('roam',i)%1000/1000);
  if(!roams){go(camp.id);stay(Math.min(bedtime,now+range(h('rest',i),RORY_STAY)),'sit');continue} // bad weather or night: he stays at camp
  const others=spots.filter(s=>s.id!==here&&s.kind!=='camp'),spot=others[h('spot',i)%others.length];
  if(!spot){stay(bedtime,'sit');break}
  if(now+trip(here,spot.id).minutes+RORY_STAY[0]+trip(spot.id,camp.id).minutes>=bedtime)break; // too late to go out and settle: walk home now (below)
  go(spot.id);
  stay(Math.min(bedtime,now+range(h('stay',i),RORY_STAY)),ACTIVITY_OF_KIND[spot.kind]||'stand');
 }
 go(camp.id);
 if(now<DAY)stay(DAY,'stand','sleep');
 return blocks;
}

// ── Through-drivers and deliveries (data only) ──
// A drive block: {act:'travel',mode:'drive',activity:'drive',origin:entry end,place:exit end,speed,vehicle,habits,length}. How far along the pass a car is at a minute: driveProgress.
function passBlock(visitor,from,entry,speed,length){
 const exit=entry==='west'?'east':'west';
 return {from,to:Math.min(DAY,from+crossingMinutes(speed,length)),act:'travel',mode:'drive',activity:'drive',origin:entry,place:exit,speed,length,vehicle:visitor.vehicle||null,habits:visitor.habits||null};
}
function throughPlan(visitor,day,ctx){
 const length=ctx.mapLength||MAP_CROSSING_M,h=(...k)=>hash(ctx,visitor,'day',day,...k),weekday=weekdayOf(day),timed=[];
 if(visitor.days){ // fixed commute
  if(visitor.days.includes(weekday))visitor.trips.forEach((t,i)=>{const speed=between(h('speed',i),visitor.speed),at=t.at+(h('jit',i)%(2*(visitor.jitter||0)+1))-(visitor.jitter||0);timed.push(passBlock(visitor,Math.max(0,Math.min(at,DAY-1)),t.entry,speed,length))});
 }else if(h('appear')%100<visitor.chance){ // random days
  const n=visitor.passes[0]+h('count')%(visitor.passes[1]-visitor.passes[0]+1),[w0,w1]=visitor.window;
  const starts=[];for(let i=0;i<n;i++){const speed=between(h('speed',i),visitor.speed),s=w0+h('at',i)%(w1-w0),entry=h('dir',i)%2?'east':'west';starts.push([s,entry,speed])}
  starts.sort((a,b)=>a[0]-b[0]);let free=0;
  for(const [s,entry,speed] of starts){const from=Math.max(s,free),b=passBlock(visitor,from,entry,speed,length);if(b.to>DAY)continue;
   if(visitor.stopChance&&h('stop',from)%100<visitor.stopChance){b.stop={place:'ironwood',minutes:5+h('stopfor',from)%25}} // rarely stops in town: data for the future car system
   timed.push(b);free=b.to}
 }
 return fillDay(timed);
}
function deliveryPlan(visitor,day,ctx){
 const length=ctx.mapLength||MAP_CROSSING_M,h=(...k)=>hash(ctx,visitor,'day',day,...k);
 if(!(visitor.days||[]).includes(weekdayOf(day)))return fillDay([]);
 const speed=between(h('speed'),visitor.speed||[10,13]),entry=visitor.entry||'west',per=visitor.visitMinutes||6;
 const inB=passBlock(visitor,Math.max(0,visitor.arrive+h('late')%11-5),entry,speed,length/2),timed=[inB];let t=inB.to;
 for(const door of visitor.stops||[]){timed.push({from:t,to:t+per,act:'pause',place:door,activity:'visit'});t+=per}
 const out=passBlock(visitor,t,entry,speed,length/2);out.origin='town';out.place=entry;if(out.to<=DAY)timed.push(out);
 return fillDay(timed.filter(b=>b.to<=DAY));
}

// ── Public ──
// visitorPlan(visitor, day, ctx): ctx {seed, weather(day)->word|number, spots, trip(from,to), mapLength}. Returns the day's blocks, contiguous from 0 to 1440.
export function visitorPlan(visitor,day,ctx={}){
 if(visitor.kind==='loiterer')return loiterPlan(visitor,day,ctx);
 if(visitor.kind==='through-driver')return throughPlan(visitor,day,ctx);
 if(visitor.kind==='delivery')return deliveryPlan(visitor,day,ctx);
 return fillDay([]);
}
export const visitorBlockAt=(plan,minute)=>plan[blockIndex(plan,minute)];
// Where a walking visitor is: npc-walk.js personPose over the plan. ctx.point(place)->{x,z}, ctx.route(from,to)->route (both injected, as for residents). Fills out; state 'hidden' when asleep or off the map.
export const visitorPose=(out,visitor,day,minute,ctx)=>personPose(out,visitorPlan(visitor,day,ctx),minute,ctx);
// How far along its pass a driver is, 0..1 (0 before it enters the map, 1 once it has left), written into out with the block. null when the visitor is not on a pass at that minute. Pure and allocation-free.
export function driveProgress(out,plan,minute){
 const b=plan[blockIndex(plan,minute)];if(!b||b.activity!=='drive'){return null}
 const m=minute>=0&&minute<DAY?minute:((minute%DAY)+DAY)%DAY;
 out.t=Math.min(1,Math.max(0,(m-b.from)/Math.max(1,b.to-b.from)));out.entry=b.origin;out.exit=b.place;out.speed=b.speed;out.block=b;return out;
}
