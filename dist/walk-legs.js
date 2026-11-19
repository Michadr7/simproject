// walk-legs.js: seeded multi-leg pedestrian routes between real town places (>= 40 m per leg, no repeat pairs); implements notes/npc-movement-design.md and notes/owner-feedback-2026-11-18.md item 2. Pure: no DOM, no three.js, no globals, no clock, no randomness.
import {MAP} from './map-definition.js';
import {hashOf,placePoint,placeKind,isAway,tripOf} from './population.js';
import {walkLegMinutes} from './npc-routes.js';
import {isCrossing} from './npc-walk.js';

export const MIN_LEG_METRES=40; // minimum real walking distance along the pavement graph per leg
export const PAUSE_BY_KIND=Object.freeze({home:7,market:6,diner:7,park:6,work:6,bench:5,place:6}); // game minutes spent paused at each destination (1 min = 2 real s)
export const PAUSE_VARIATION=4; // deterministic 0..3 min (owner 2026-11-18: stops of 5-10 game min = 10-20 real s) spread added to PAUSE_BY_KIND
export const DEFAULT_MAX_LEGS=5;
export const MIN_WINDOW_MINUTES=75; // shortest daytime window worth replacing with a multi-leg walk loop
export const HOME_BUFFER_MINUTES=20; // leave at least this much time at home before sleep/shop/work when expanding a window
export const DAY=1440;
export const PLACE_KINDS=Object.freeze(['home','market','diner','park','work','bench']);

// Shared town destinations on the Oak Street / Ironwood pavement network (benches and park derived from MAP where present, offset onto walkable pavement).
export const TOWN_WALK_PLACES=Object.freeze([
 Object.freeze({id:'shop:market',kind:'market',label:'Corner Market'}),
 Object.freeze({id:'shop:cafe',kind:'diner',label:'Alder Coffee & Diner'}),
 Object.freeze({id:'park:alder-square',kind:'park',label:'Alder Square'}),
 Object.freeze({id:'bench:oak-south-w',kind:'bench',label:'Oak Street west bench'}),
 Object.freeze({id:'bench:oak-south-e',kind:'bench',label:'Oak Street east bench'}),
 Object.freeze({id:'bench:alder-cross',kind:'bench',label:'Alder Cross bench'}),
 Object.freeze({id:'bench:alder-square',kind:'bench',label:'Alder Square bench'}),
 Object.freeze({id:'bench:alder-square-w',kind:'bench',label:'Alder Square west bench'})
]);

const EXTRA_POINTS=Object.freeze({
 'bench:oak-south-w':Object.freeze({x:9,z:18.8}),
 'bench:oak-south-e':Object.freeze({x:27,z:18.8}),
 'bench:alder-cross':Object.freeze({x:-11.5,z:-82.5})
});
const TOWN_ZONES=new Set(['city','alder']);
const pairKey=(a,b)=>a<b?a+'|'+b:b+'|'+a;
const hasPlace=(id,map)=>id==='shop:market'?!!map?.shops?.market:id==='shop:cafe'?!!map?.shops?.cafe:id==='park:alder-square'?!!(map?.plazas||[]).find(p=>p.id==='alder-square'):id==='bench:alder-square'||id==='bench:alder-square-w'?!!(map?.plazas||[]).find(p=>p.id==='alder-square')?.benches?.length:Object.prototype.hasOwnProperty.call(EXTRA_POINTS,id);

function isTownWork(work,map){
 if(!work||isAway(work))return false;
 const k=placeKind(work);
 if(k==='shop')return true;
 if(k!=='property')return false;
 const id=work.slice(work.indexOf(':')+1),prop=(map?.properties||[]).find(p=>p.id===id);
 if(!prop)return false;
 const lm=prop.landmark&&(map?.landmarks||[]).find(l=>l.id===prop.landmark);
 return !!lm&&TOWN_ZONES.has(lm.zone);
}

// World {x, z} point for any walk-leg place id, reusing population.js placePoint for dwellings, shops, properties, offices and zones.
export function walkPlacePoint(place,map=MAP){
 if(typeof place!=='string'||!place)return null;
 if(place==='park:alder-square'){const q=(map?.plazas||[]).find(p=>p.id==='alder-square');return q?{x:q.fountain.x,z:q.fountain.z+q.fountain.r+2.6}:null}
 if(place==='bench:alder-square'){const b=(map?.plazas||[]).find(p=>p.id==='alder-square')?.benches?.[1];return b?{x:b.x,z:b.z+1.7}:null}
 if(place==='bench:alder-square-w'){const b=(map?.plazas||[]).find(p=>p.id==='alder-square')?.benches?.[3];return b?{x:b.x+1.5,z:b.z}:null}
 if(Object.prototype.hasOwnProperty.call(EXTRA_POINTS,place))return {x:EXTRA_POINTS[place].x,z:EXTRA_POINTS[place].z};
 return placePoint(place,map);
}

export function placeCategory(place,person=null){
 if(person&&place===person.home)return 'home';
 if(person&&place===person.work)return 'work';
 if(place==='shop:market')return 'market';
 if(place==='shop:cafe')return 'diner';
 if(typeof place==='string'&&place.startsWith('park:'))return 'park';
 if(typeof place==='string'&&place.startsWith('bench:'))return 'bench';
 return 'place';
}

export function legPauseMinutes(place,personId,day,step=0,seed=MAP.seed){
 const base=PAUSE_BY_KIND[placeCategory(place)]??PAUSE_BY_KIND.place;
 return base+(hashOf(seed,personId,'walk-pause',day,step,place)%PAUSE_VARIATION);
}

// Candidate town places for a person: their home, their town work place (when in Westside/Ironwood), and the shared market, diner, park and benches.
export function candidatePlacesFor(person,map=MAP){
 const out=[],seen=new Set();
 const add=id=>{if(!id||seen.has(id)||isAway(id)||!walkPlacePoint(id,map))return;seen.add(id);out.push(id)};
 if(person?.resident)add(person.home);
 if(isTownWork(person?.work,map))add(person.work);
 for(const p of TOWN_WALK_PLACES)if(hasPlace(p.id,map))add(p.id);
 return out;
}

// True when (x, z) is on the town pedestrian graph (pavement, path, driveway, crosswalk, or the Westside-Ironwood avenue link).
export function isOnPavementGraph(x,z,surfaceAt,zoneAt,S,map=MAP){
 const s=surfaceAt(x,z);
 if(s===S.PAVEMENT||s===S.PATH||s===S.DRIVEWAY)return true;
 if(isCrossing(x,z,map?.crossings||[]))return true;
 if(s===S.STREET||(s===S.ROAD&&zoneAt?.(x,z)?.id==='alder'))return false;
 return x>=-25&&x<=-16&&z>=-99.5&&z<=-58; // the Westside-Ironwood avenue link where MAP.pavements has a gap between z -60 and -80.7
}

// Pedestrian blocker: wraps baseBlocked (walls, buildings, trees, unwalkable ground) and keeps town walkers on the pavement graph in Westside and Ironwood. Zero allocation per call.
export function townWalkBlocked(baseBlocked,surfaceAt,zoneAt,S,map=MAP){
 const crossings=map?.crossings||[];
 return (x,z)=>{
  if(baseBlocked&&baseBlocked(x,z))return true;
  const s=surfaceAt(x,z);
  if(s===S.PAVEMENT||s===S.PATH||s===S.DRIVEWAY||isCrossing(x,z,crossings))return false;
  const zId=zoneAt?.(x,z)?.id;
  if(zId==='city'||zId==='alder')return s===S.STREET||s===S.ROAD||!(x>=-25&&x<=-16&&z>=-99.5&&z<=-58);
  return false;
 };
}

// Surface cost for findRoute: pavements, front paths, driveways and crosswalks cost 1; grass 2.5; non-crossing roads 5. Zero allocation per call.
export function townWalkCost(surfaceAt,S,map=MAP){
 const crossings=map?.crossings||[];
 return (x,z)=>{
  const s=surfaceAt(x,z);
  if(s===S.PAVEMENT||s===S.PATH||s===S.DRIVEWAY||isCrossing(x,z,crossings))return 1;
  if(s===S.ROAD||s===S.STREET)return 5;
  return 2.5;
 };
}

// True when a resident lives on the town pavement network (currently Oak Street Apartments).
export const isTownWalker=(person,map=MAP)=>!!person&&person.resident&&!isAway(person.home)&&walkPlacePoint(person.home,map)!==null&&placeKind(person.home)==='dwelling';

// All distinct {from, to} pairs among town walkers' candidate walk-leg places, for warming npc-routes.js's route table once behind the loading screen.
export function walkLegCandidatePairs(people,map=MAP){
 const seen=new Set(),out=[];
 for(const person of people||[]){
  if(!isTownWalker(person,map))continue;
  const places=candidatePlacesFor(person,map);
  for(let i=0;i<places.length;i++)for(let j=0;j<places.length;j++){
   if(i===j)continue;
   const a=places[i],b=places[j],k=a+'>'+b;
   if(!seen.has(k)){seen.add(k);out.push({from:a,to:b})}
  }
 }
 return out;
}

// Build a deterministic, connected list of walk legs for `person` on `day`.
// Every leg reuses `ctx.table` (npc-routes.js createRouteTable), is >= minMetres (40 m), never repeats the same pair twice in a row, and connects end-to-start.
export function buildWalkLegs(person,day,ctx={}){
 if(!person||!person.resident||isAway(person.home))return [];
 const map=ctx.map||MAP,seed=ctx.seed??map.seed,minMetres=ctx.minMetres??MIN_LEG_METRES,table=ctx.table||null;
 const startPlace=ctx.startPlace||person.home,endPlace=ctx.endPlace||person.home;
 const startMinute=Math.round(ctx.startMinute??540),maxEndMinute=Math.min(DAY,Math.round(ctx.maxEndMinute??1200));
 const maxLegs=Math.max(3,Math.min(8,Math.floor(ctx.maxLegs??DEFAULT_MAX_LEGS)));
 const places=candidatePlacesFor(person,map);
 if(!places.includes(startPlace))places.unshift(startPlace);
 if(!places.includes(endPlace))places.push(endPlace);
 if(places.length<3)return [];

 const lengthOf=(a,b)=>{
  if(a===b)return 0;
  const v=table?table.get(a,b):null;
  if(v!==null&&v!==undefined)return v;
  if(table)return null; // when a real route table is supplied, only measured pairs are eligible
  const pa=walkPlacePoint(a,map),pb=walkPlacePoint(b,map);
  return pa&&pb?tripOf(a,b,person,map).metres:null;
 };
 const minReturn=(from)=>from===endPlace?0:lengthOf(from,endPlace);
 const minTwoHopClose=(from,prevKey,nowMin,usedPairs)=>{
  let best=Infinity;
  for(const c of places){
   if(c===from||c===endPlace)continue;
   const l1=lengthOf(from,c),l2=lengthOf(c,endPlace);if(l1===null||l2===null||l1<minMetres||l2<minMetres)continue;
   const k1=pairKey(from,c),k2=pairKey(c,endPlace);if(k1===prevKey||k1===k2)continue;
   const p1=legPauseMinutes(c,person.id,day,99,seed),tot=walkLegMinutes(l1)+p1+walkLegMinutes(l2);
   if(nowMin+tot<=maxEndMinute&&tot<best&&(!usedPairs.has(k1)||!usedPairs.has(k2)))best=tot;
  }
  return best;
 };

 const legs=[],usedPairs=new Set();
 let cur=startPlace,now=startMinute,lastPair=null;
 const minLoop=startPlace===endPlace?3:2;
 for(let step=0;step<maxLegs;step++){
  const mustClose=step===maxLegs-1;
  const closeLen=cur!==endPlace?minReturn(cur):null;
  const closeMin=closeLen!==null&&closeLen>=minMetres?walkLegMinutes(closeLen):Infinity;
  const canCloseNow=legs.length+1>=minLoop&&cur!==endPlace&&closeLen!==null&&closeLen>=minMetres&&pairKey(cur,endPlace)!==lastPair&&now+closeMin<=maxEndMinute;

  let chosen=null;
  if(!mustClose){
   const pool=[];
   for(const next of places){
    if(next===cur||(next===endPlace&&legs.length+1<minLoop))continue;
    const len=lengthOf(cur,next);if(len===null||len<minMetres)continue;
    const pk=pairKey(cur,next);if(pk===lastPair)continue;
    const walkMin=walkLegMinutes(len),pauseMin=next===endPlace?0:legPauseMinutes(next,person.id,day,step,seed);
    if(next===endPlace){if(now+walkMin<=maxEndMinute)pool.push({next,len,walkMin,pauseMin:0,fresh:!usedPairs.has(pk),closing:true});continue}
    const retLen=minReturn(next),retMin=retLen!==null&&retLen>=minMetres?walkLegMinutes(retLen):Infinity;
    const directRetOk=legs.length+2>=minLoop&&pairKey(next,endPlace)!==pk&&now+walkMin+pauseMin+retMin<=maxEndMinute;
    const twoHopOk=step<maxLegs-2&&minTwoHopClose(next,pk,now+walkMin+pauseMin,usedPairs)<Infinity;
    if(!directRetOk&&!twoHopOk)continue;
    pool.push({next,len,walkMin,pauseMin,fresh:!usedPairs.has(pk),closing:false});
   }
   const freshPool=pool.filter(c=>c.fresh&&!c.closing);
   const pickFrom=freshPool.length?freshPool:pool.filter(c=>!c.closing);
   if(pickFrom.length){
    pickFrom.sort((a,b)=>hashOf(seed,person.id,'leg',day,step,cur,a.next)-hashOf(seed,person.id,'leg',day,step,cur,b.next)||(a.next<b.next?-1:1));
    chosen=pickFrom[0];
   }
  }
  if(!chosen){
   if(canCloseNow)chosen={next:endPlace,len:closeLen,walkMin:closeMin,pauseMin:0,closing:true};
   else break;
  }
  const arrive=now+chosen.walkMin,depart=arrive+chosen.pauseMin;
  legs.push({from:cur,to:chosen.next,metres:chosen.len,walkMinutes:chosen.walkMin,pauseMinutes:chosen.pauseMin,startMinute:now,arriveMinute:arrive,departMinute:depart});
  usedPairs.add(pairKey(cur,chosen.next));
  lastPair=pairKey(cur,chosen.next);
  cur=chosen.next;
  now=depart;
  if(cur===endPlace&&legs.length>=minLoop)break;
 }
 if(legs.length&&cur!==endPlace){
  const len=lengthOf(cur,endPlace);
  if(len!==null&&len>=minMetres&&pairKey(cur,endPlace)!==lastPair&&now+walkLegMinutes(len)<=maxEndMinute&&legs.length+1>=minLoop){
   const walkMin=walkLegMinutes(len);
   legs.push({from:cur,to:endPlace,metres:len,walkMinutes:walkMin,pauseMinutes:0,startMinute:now,arriveMinute:now+walkMin,departMinute:now+walkMin});
   cur=endPlace;
  }
 }
 if(!legs.length||cur!==endPlace||legs.length<minLoop)return [];
 return legs;
}

// Convert a connected leg list into schedule blocks ({from, to, act, place, origin?, mode?}).
export function legsToBlocks(legs,pauseAct='pause'){
 const out=[];
 for(let i=0;i<legs.length;i++){
  const l=legs[i];
  out.push({from:l.startMinute,to:l.arriveMinute,act:'travel',place:l.to,origin:l.from,mode:'walk'});
  if(l.pauseMinutes>0&&l.departMinute>l.arriveMinute)out.push({from:l.arriveMinute,to:l.departMinute,act:pauseAct,place:l.to});
 }
 return out;
}

// Replace short stroll / stationary 'outside' windows in a schedule.js dayPlan with real >= 40 m multi-leg walks.
// Preserves sleep, work, shop errands, away blocks, and full 0..1440 day continuity.
export function applyWalkLegs(basePlan,person,day,ctx={}){
 if(!Array.isArray(basePlan)||!basePlan.length||!isTownWalker(person,ctx.map||MAP))return basePlan;
 if(typeof ctx.skip==='function'&&ctx.skip(person))return basePlan;
 // Only match `outside` blocks and full 3-block strolls (`home->shop`, `outside`, `shop->home`)—never a `travel` leg belonging to a real `shop` visit.
 const isStrollAt=k=>{
  const a=basePlan[k],b=basePlan[k+1],c=basePlan[k+2];
  return a?.act==='travel'&&a.mode==='walk'&&a.origin===person.home&&b?.act==='outside'&&b.place===a.place&&c?.act==='travel'&&c.mode==='walk'&&c.origin===b.place&&c.place===person.home;
 };
 const isShortHome=(k)=>basePlan[k]?.act==='home'&&basePlan[k].to-basePlan[k].from<=60;
 const out=[];
 let i=0,outing=0;
 while(i<basePlan.length){
  if(!isStrollAt(i)&&basePlan[i].act!=='outside'){out.push(basePlan[i++]);continue}
  let j=i;
  while(j<basePlan.length){
   if(isStrollAt(j)){j+=3;continue}
   if(basePlan[j].act==='outside'){j++;continue}
   if(isShortHome(j)&&(isStrollAt(j+1)||basePlan[j+1]?.act==='outside')){j++;continue}
   break;
  }
  let start=basePlan[i].from,end=basePlan[j-1].to;
  // borrow slack from an adjacent 'home' block (leaving HOME_BUFFER_MINUTES before sleep/next block) so short strolls expand into a full >= 40 m loop
  let trailHome=0;
  if(j<basePlan.length&&basePlan[j].act==='home'&&basePlan[j].place===person.home&&basePlan[j].to-basePlan[j].from>HOME_BUFFER_MINUTES){
   trailHome=basePlan[j].to-basePlan[j].from-HOME_BUFFER_MINUTES;
   end+=trailHome;
  }
  const anchor=i>0?basePlan[i-1].place:person.home,nextAnchor=j<basePlan.length?basePlan[j].place:person.home;
  if(anchor===person.home&&nextAnchor===person.home&&end-start>=MIN_WINDOW_MINUTES){
   const legs=buildWalkLegs(person,day,{...ctx,startPlace:person.home,endPlace:person.home,startMinute:start,maxEndMinute:end,seed:(ctx.seed??(ctx.map||MAP).seed)+outing*97});
   if(legs.length){
    outing++;
    for(const blk of legsToBlocks(legs,'pause'))out.push(blk);
    const tail=legs[legs.length-1].departMinute;
    if(tail<end)out.push({from:tail,to:end,act:'home',place:person.home});
    if(trailHome>0){out.push({from:end,to:basePlan[j].to,act:'home',place:person.home});j++}
    i=j;continue;
   }
  }
  for(let k=i;k<j;k++)out.push(basePlan[k].act==='outside'?{...basePlan[k],act:basePlan[k].place===person.home?'home':'pause'}:basePlan[k]);
  i=j;
 }
 const merged=[];
 for(const b of out){
  const prev=merged[merged.length-1];
  if(prev&&b.act!=='travel'&&prev.act===b.act&&prev.place===b.place&&prev.to===b.from)merged[merged.length-1]={...prev,to:b.to};
  else merged.push(b);
 }
 return merged;
}

// Allocation-free per-day plan cache wrapping `createSchedule` with `applyWalkLegs` so game.js / npc-crowd.js pay zero allocations per frame.
export function createWalkSchedule(schedule,population,ctx={}){
 const plans=new Map(),byId=new Map((population?.people||[]).map(p=>[p.id,p]));
 let cacheDay=null;
 return {
  planOf(id,day){
   if(day!==cacheDay){plans.clear();cacheDay=day}
   let p=plans.get(id);
   if(!p){const base=schedule.planOf(id,day),person=byId.get(id);if(!base)return null;p=person?applyWalkLegs(base,person,day,ctx):base;plans.set(id,p)}
   return p;
  },
  clear(){plans.clear();cacheDay=null}
 };
}
