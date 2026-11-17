// npc-busyness (notes/npc-movement-design.md N2): busyness() 0..1 from weather, minute and weekday; the schedule's optional outdoor blocks follow it (and are unchanged without ctx.weather);
// the crowd pool cap follows it; strolls that end at an open shop front count as shop visits in the demand.
import assert from 'node:assert/strict';
import {MAP} from '../dist/map-definition.js';
import {buildPopulation} from '../dist/population.js';
import {dayPlan} from '../dist/schedule.js';
import {busyness,crowdPool,outdoorShare,takesOutdoor,weatherFactor,timeFactor,weekdayFactor,OUTDOOR_FLOOR,MIN_POOL} from '../dist/busyness.js';
import {strollVisits,strollDemand,addVisits} from '../dist/stroll-visits.js';
import {visitCounts} from '../dist/world-state.js';
import {createNpcCrowd,POOL} from '../dist/npc-crowd.js';

// 1. the factor: range, ordering (nice > rain > storm, midday > night, weekend > weekday), numbers named in the header
{const f=(weather,minute,weekday)=>busyness({weather,minute,weekday});
 for(const w of ['clear','cloudy','fog','rain','storm','snow','nonsense',0,1,2])for(let m=0;m<1440;m+=37)for(let d=1;d<=14;d++){const b=f(w,m,d);assert.ok(b>=0&&b<=1&&Number.isFinite(b),'in range '+w+' '+m+' '+d)}
 assert.equal(f('clear',720,6),1,'a fine Saturday midday is 1');assert.equal(f('clear',720,7),1);
 assert.ok(f('clear',720,3)<f('clear',720,6),'weekend busier');assert.equal(f('clear',720,1),f('clear',720,8),'day 8 is a Monday again');assert.equal(f('clear',720,1),f('clear',720,'Monday'));
 assert.ok(f('clear',720,1)>f('rain',720,1)&&f('rain',720,1)>f('storm',720,1),'nice > rain > storm');
 assert.ok(f('clear',720,1)>f('clear',150,1)*8,'midday far busier than 02:30');assert.ok(f('clear',540,1)<f('clear',660,1)&&f('clear',1200,1)<f('clear',1000,1),'ramps up in the morning, down in the evening');
 assert.equal(f('clear',-720,6),f('clear',720,6),'minutes wrap');assert.equal(f(),f('clear',720,1),'defaults');
 assert.equal(weatherFactor(0),1);assert.ok(Math.abs(weatherFactor(2)-.1)<1e-9);assert.ok(weatherFactor(1)<weatherFactor(.5));assert.equal(weatherFactor('Rain'),weatherFactor('rain'));
 assert.equal(timeFactor(600),1);assert.equal(timeFactor(0),timeFactor(1440));assert.equal(weekdayFactor('sunday'),1)}

// 2. what it scales: the outdoor share has a floor, the pool never leaves [MIN_POOL, pool]
{assert.equal(outdoorShare(0),OUTDOOR_FLOOR);assert.equal(outdoorShare(1),1);assert.ok(takesOutdoor(1,.999)&&!takesOutdoor(0,.5)&&takesOutdoor(0,.05));
 assert.equal(crowdPool(1,9),9);assert.equal(crowdPool(0,9),Math.round(9*.4));assert.ok(crowdPool(0,9)>=MIN_POOL);assert.equal(crowdPool(1,2),2,'never above the pool');assert.equal(crowdPool(0,0),0);
 let last=-1;for(let b=0;b<=1;b+=.05){const n=crowdPool(b,POOL);assert.ok(n>=last,'monotone');last=n}
 assert.equal(POOL,9,'the pool constant is unchanged by this stage')}

// 3. schedule: without ctx.weather the plans are exactly the old ones; with it, a fine day has more outdoor time than a storm, same everywhere, and every plan still covers the day
{const pop=buildPopulation(),days=[1,2,3,4,5,6,7],outside=(w)=>{let n=0,min=0;for(const p of pop.people)for(const d of days){const plan=dayPlan(p,d,w?{weather:()=>w}:{});let t=0;for(const b of plan){assert.equal(b.from,t,'plan has no gap');t=b.to;if(b.act==='outside'){n++;min+=b.to-b.from}}assert.equal(t,1440)}return {n,min}};
 const base=outside(null),clear=outside('clear'),storm=outside('storm');
 assert.deepEqual(dayPlan(pop.people[0],3),dayPlan(pop.people[0],3,{}),'no weather: unchanged');
 assert.ok(clear.n<=base.n&&clear.n>=base.n*.7,'a fine day keeps most outdoor blocks: '+clear.n+' of '+base.n);
 assert.ok(storm.n<clear.n*.6,'a storm cuts them hard: '+storm.n+' vs '+clear.n);assert.ok(storm.n>0,'but not to nothing ('+storm.n+')');
 assert.deepEqual(dayPlan(pop.people[2],4,{weather:()=>'rain'}),dayPlan(pop.people[2],4,{weather:()=>'rain'}),'deterministic');
 console.log('outdoor blocks over 28 people x 7 days: old '+base.n+', clear '+clear.n+', storm '+storm.n+' ('+base.min+' / '+clear.min+' / '+storm.min+' min)')}

// 4. stroll visits: only an 'outside' block at a shop front that is open for some of it counts; added to the errand counts
{const people=[{id:'a'},{id:'b'},{id:'c'}],h=MAP.shops.market.hours,
 plans={a:[{from:0,to:h[0]-30,act:'home',place:'x'},{from:h[0]+60,to:h[0]+90,act:'outside',place:'shop:market'},{from:h[0]+90,to:1440,act:'shop',place:'shop:market'}],
  b:[{from:0,to:60,act:'outside',place:'shop:market'},{from:60,to:h[1]+30,act:'outside',place:'shop:market'},{from:h[1]+30,to:1440,act:'outside',place:'shop:market'},{from:0,to:1,act:'outside',place:'property:house-r2'}],
  c:[{from:h[1]+1,to:h[1]+50,act:'outside',place:'shop:market'}]},
 planOf=p=>plans[p.id];
 const s=strollVisits(people,1,planOf,MAP);assert.deepEqual(s,{'shop:market':2},'a: 1 open block; b: only 60..close+30 overlaps the hours (one before opening, one after closing); c: closed');
 const errands=visitCounts(people,1,planOf);assert.deepEqual(errands,{'shop:market':1});
 assert.deepEqual(strollDemand(people,1,planOf,visitCounts,MAP),{'shop:market':3});assert.deepEqual(addVisits({a:1},{a:2,b:3}),{a:3,b:3});
 assert.deepEqual(strollVisits(people,1,planOf,()=>null),{},'no hours known: nothing counted')}
{const pop=buildPopulation(),days=[1,2,3,4,5,6,7];let strolls=0,errands=0;for(const d of days){const s=strollVisits(pop.people,d,dayPlan,MAP),e=visitCounts(pop.people,d,dayPlan);for(const k in s)strolls+=s[k];for(const k in e)errands+=e[k]}
 assert.ok(strolls>0,'real strolls exist');console.log('real week: '+errands+' errand visits, '+strolls+' stroll visits to open shop fronts')}

// 5. crowd: time.busy lowers how many pool characters are added; without it nothing changes
{const mk=()=>({group:{visible:false,position:{x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z}},rotation:{y:0}},apply(){},setMotion(){},update(){}});
 const people=[...Array(12).keys()].map(i=>({id:'p'+i,name:'p'+i,body:'male'})),plan=[{from:0,to:600,act:'home',place:'dwelling:x'},{from:600,to:1440,act:'outside',place:'shop:market'}];
 const run=busy=>{const c=createNpcCrowd({scene:{add(){}},createCharacter:mk,outfit:()=>({}),population:{people},schedule:{planOf:()=>plan},pool:9});
  for(let i=0;i<30;i++)c.update(.05,{x:MAP.shops.market.x+20,z:MAP.shops.market.z},busy===undefined?{day:1,minute:600}:{day:1,minute:600,busy});return c.slots.filter(s=>s.owner).length};
 assert.equal(run(),9,'no busy: the whole pool');assert.equal(run(1),9);assert.equal(run(0),crowdPool(0,9));assert.ok(run(0)<run(1));
 // drawn people stay when it gets quieter (nobody pops out): fill at busy 1, then drop to 0
 const c=createNpcCrowd({scene:{add(){}},createCharacter:mk,outfit:()=>({}),population:{people},schedule:{planOf:()=>plan},pool:9});
 for(let i=0;i<30;i++)c.update(.05,{x:MAP.shops.market.x+20,z:MAP.shops.market.z},{day:1,minute:600,busy:1});for(let i=0;i<30;i++)c.update(.05,{x:MAP.shops.market.x+20,z:MAP.shops.market.z},{day:1,minute:600,busy:0});
 assert.equal(c.slots.filter(s=>s.owner).length,9,'already drawn people stay');
 // the crowd's warm() fills its route cache without the per-frame budget
 const c2=createNpcCrowd({scene:{add(){}},createCharacter:mk,outfit:()=>({}),population:{people:people.slice(0,1)},schedule:{planOf:()=>plan},pool:9}),job=c2.warm([{from:'shop:market',to:'shop:cafe'},{from:'shop:cafe',to:'property:house-r2'}],{perStep:1});
 assert.equal(c2.routeCount,0);assert.equal(job.step(),1);assert.equal(job.step(),0);assert.equal(c2.routeCount,2);assert.equal(job.table.size,2)}
console.log('PASS npc-busyness');
