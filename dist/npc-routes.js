// npc-routes.js: the real walking length of every place pair, used to size the schedule's travel blocks, and crowdWarm, which fills the table over a few frames (notes/npc-movement-design.md stage N2; measured in notes/eval/outbox/N1.md). Pure: no DOM, no three.js, no clock of its own (the clock is injected).
// The table is DATA both the schedule and the crowd read, so a plan is a function of (person, day, table). Build it from STATIC obstacles only (terrain, buildings, world colliders): never from parked vehicles or planks, or two co-op machines would size the same block differently. Compare machines with signature().
// A block is sized as length / WALK_SPEED, so nobody has to hurry; a pair that is not in the table falls back to the old straight line x DETOUR estimate (population.js tripOf).
import {WALK_SPEED,GAME_MINUTES_PER_SECOND,DRIVE_OVER,isAway,tripOf,hashOf} from './population.js';

export const HURRY_LIMIT=1.15; // the most a person may need to speed up over WALK_SPEED to arrive on time (the test checks every real block against it)
export const walkLegMinutes=metres=>Math.max(2,Math.ceil(metres/WALK_SPEED*GAME_MINUTES_PER_SECOND));
const key=(from,to)=>from+'>'+to;

// A table of walking lengths in metres by (from,to). get() tries the reverse pair when the pair itself is missing (a route and its way back are about the same length).
export function createRouteTable(){
 const m=new Map();
 const table={
  set(from,to,metres){if(Number.isFinite(metres)&&metres>=0)m.set(key(from,to),Math.round(metres*10)/10);return table},
  get(from,to){const v=m.get(key(from,to));if(v!==undefined)return v;const r=m.get(key(to,from));return r===undefined?null:r},
  has:(from,to)=>m.has(key(from,to)),
  get size(){return m.size},
  entries:()=>[...m.entries()].map(([k,v])=>{const i=k.indexOf('>');return [k.slice(0,i),k.slice(i+1),v]}),
  // one number for the whole table (sorted, lengths in 0.1 m): co-op machines compare it to see that they sized their blocks from the same lengths
  signature:()=>hashOf(...[...m.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(([k,v])=>k+'='+v))
 };
 return table;
}

// A drop-in for dayPlan's ctx.trip: on foot, the length from the table when it has the pair (and the old estimate when it has not); the walk-or-drive decision is the estimate's, so a table never turns a walker into a driver or back.
// minutes = metres / WALK_SPEED rounded UP, never fewer than 2 (as tripOf).
export function tripWithTable(table,map,fallback=null){
 return (from,to,person)=>{
  const base=fallback?fallback(from,to,person):tripOf(from,to,person,map);
  if(base.metres===0)return base;
  const metres=table&&table.get(from,to);
  if(metres===null||metres===undefined)return base;
  if(base.mode!=='walk'){if(!Number.isFinite(base.metres)&&!isAway(from)&&!isAway(to)&&!(person?.drives&&metres>DRIVE_OVER))return {metres,mode:'walk',minutes:walkLegMinutes(metres)};return base}
  return {metres,mode:'walk',minutes:walkLegMinutes(metres)};
 };
}

// Every distinct walking pair {from,to} that the plans use (first seen first). planOf(person,day) is dayPlan or a wrapper of it; days is a list of day numbers.
export function walkPairsOf(people,days,planOf){
 const seen=new Set(),out=[];
 for(const p of people)for(const d of days)for(const b of planOf(p,d))if(b.act==='travel'&&b.mode==='walk'){const k=key(b.origin,b.place);if(!seen.has(k)){seen.add(k);out.push({from:b.origin,to:b.place})}}
 return out;
}

// The speed (as a multiple of WALK_SPEED) someone needs to cover `metres` in a block of `minutes`.
export const hurryOf=(metres,minutes)=>minutes>0?metres/(minutes/GAME_MINUTES_PER_SECOND)/WALK_SPEED:Infinity;

// crowdWarm: work out the route of every pair once, spread over frames. pairs: [{from,to}] or [[from,to]]; routeFn(from,to) -> route {length,direct}|null (null = no such trip, it is skipped, never retried: pass a function that does not give up for a budget).
// opts: {table (default a new one), now (injected ms clock), budgetMs (stop a step after this long), perStep (stop a step after this many routes)}. With no limit one step does everything.
// Returns {table, total, remaining, done, missing, direct, step(), run()}. step() does one slice and returns remaining; at least one route per step, so it always finishes. A budget with no `now` clock means one route per step.
export function crowdWarm(pairs,routeFn,opts={}){
 const {now=null,budgetMs=Infinity,table=createRouteTable()}=opts;
 let perStep=opts.perStep===undefined?Infinity:Math.max(1,Math.floor(opts.perStep));
 if(Number.isFinite(budgetMs)&&!now)perStep=Math.min(perStep,1);
 const list=[],seen=new Set();
 for(const p of pairs||[]){const from=Array.isArray(p)?p[0]:p.from,to=Array.isArray(p)?p[1]:p.to,k=key(from,to);if(from!==to&&!seen.has(k)){seen.add(k);list.push([from,to])}}
 const missing=[],direct=[];let i=0;
 const job={table,total:list.length,missing,direct,
  get remaining(){return list.length-i},
  get done(){return i>=list.length},
  step(){
   const t0=now?now():0;let n=0;
   while(i<list.length){
    const [from,to]=list[i++],r=routeFn(from,to);n++;
    if(r){table.set(from,to,r.length);if(r.direct)direct.push(key(from,to))}else missing.push(key(from,to));
    if(n>=perStep)break;if(now&&now()-t0>=budgetMs)break;
   }
   return list.length-i;
  },
  run(){while(i<list.length)job.step();return job}
 };
 return job;
}
