// world-tick.js: the world's ONE daily tick on a save (stock, supply, needs, NPC moods and sickness) and the pump hooks; pure (no DOM, no three.js, no clock, no chance); implements notes/world-system-design.md (stage W-D1).
// game.js calls worldDue(progress) every frame (two reads and a compare) and runWorldDay when it is true: once per day number, at 05:00 game time, up to 14 missed days after a load or a sleep. Only the authority ticks (single player, or the co-op host).
// progress.world = world-state.js save, progress.needs = needs.js list, progress.npcs = npc-life.js saved NPC state, progress.standing = {people} (the PLAYER's standing, changed elsewhere).
import {MAP} from './map-definition.js';
import {townPopulation} from './population.js';
import {dayPlan} from './schedule.js';
import {ROSTER_ORDER,byId} from './npc-roster.js';
import {moodTick,isSick,needsFor,normalizeNpcs,MOOD_MIN,MOOD_MAX} from './npc-life.js';
import {normalizeWorld,visitCounts,pumpAvailMgal,pumpSell,TICK_MINUTE,CATCH_UP_MAX} from './world-state.js';
import {normalizeNeeds,needsFrom,expire,retireOffKinds,PLACE_POINTS,newsText} from './needs.js';
import {PALLET_LINK,PLACES,PUMP_PLACE,SOLD_OUT_TEXT} from './world-goods.js';
import {totalPlanks,crewPutAway} from './pallets.js';
import {strollDemand} from './stroll-visits.js';
import {normalizeYard} from './sawmill-yard.js';
import {workforceDay,pickWorkforceStumps} from './workforce-tick.js'; // W3 (notes/workforce-design.md): the Ridgeline crew's day (trickle, 4 logs sawn, the world tick, 12 planks hauled, late lumber needs)
import {plotAt,setPlot} from './grid.js';

export {TICK_MINUTE,CATCH_UP_MAX,SOLD_OUT_TEXT};
export const SICK_FARM_HEALTH=.5; // Hal sick: the farm makes half (owner answer 3)

// The newest day number whose 05:00 has passed: game day (housing.day is 1-based) before 05:00 is still yesterday's tick. Never below 0.
export function tickTargetDay(progress){
 const d=(Number(progress?.housing?.day)||1)-1,m=Number(progress?.routine?.minutes)||0;
 return Math.max(0,m>=TICK_MINUTE?d:d-1);
}
// true when a day's tick has not run yet (cheap: no allocation). `authority` = single player or the co-op host.
export const worldDue=(progress,authority=true)=>authority&&!!progress?.world&&tickTargetDay(progress)>progress.world.day;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
// visits per place for one day, from every person's day plan (the same for everyone; memoised by the caller): errands plus strolls that end at an open shop front (N2, stroll-visits.js: a stroll into a shop is a real shop visit)
const demandFor=day=>strollDemand(townPopulation().people,day,dayPlan,visitCounts,MAP);

// The Ridgeline pallets' planks ARE the world's warehouse place (the pallets are the truth; workforce-tick.js mirrors them both ways). A save with no Ridgeline pallets yet keeps the world's number:
// for the crew's day that number is set on pallets that are not saved (warehouseOf), and what is left after the day goes back into the number, so nothing is made or lost and the save keeps its shape.
const hasPallets=company=>!!company&&(Array.isArray(company.pallets)||company.racks!==undefined||company.forkload!==undefined);
function warehouseOf(world,progress){
 const company=progress?.companies?.[PALLET_LINK.company];if(hasPallets(company))return {company,real:true,spare:0};
 const n=Number(world.stock?.[PALLET_LINK.place]?.[PALLET_LINK.good])||0,put=crewPutAway({},n);return {company:put.company,real:false,spare:n-put.placed};
}

// P-B wiring (notes/planks-economy-design.md): ONE plank source at the sawmill. The player-fed yard (progress.sawmillYard) IS the sawmill's stock; the world place has no rate.
// yardOf: the saved yard, or (a progress that has none yet) a yard holding the world's sawmill planks, so nothing is lost or made. The trickle (6 a day) runs once per ticked day (idempotent, sawmill-yard.js).
export const SAWMILL_PLACE='property:sawmill';
export const yardOf=(progress,world)=>progress?.sawmillYard&&typeof progress.sawmillYard==='object'?normalizeYard(progress.sawmillYard):normalizeYard({planks:Number(world?.stock?.[SAWMILL_PLACE]?.planks)||0});
// W3 stumps (owner answer 2): at the tick, at most 2 standing pines in yesterday's first marked block become stumps (pickWorkforceStumps: a pure function of the day and the seed, so co-op agrees).
// A pine the player has started on (hits > 0) is left alone. -> the new plots (the same object when nothing changed). `day` = the housing day (1-based) the tick opens.
export function workforceStumps(progress,day,seed=MAP.seed){
 let p=progress;const felledAt=(day-1)*1440+TICK_MINUTE;
 for(const s of pickWorkforceStumps(day,seed)){const plot=plotAt(p,s.key);if(plot?.type==='forest'&&plot.tree==='pine'&&!plot.hits)p=setPlot(p,s.key,{type:'forest',tree:null,hits:0,felledAt})}
 return p.plots;
}

// The tick. Returns a NEW progress with world, needs, npcs changed (the same object when nothing is due). dayNow = tickTargetDay(progress) unless a test passes one.
// ctx (all optional): {seed, events(day)->[{kind,at}], weather(day), keeperOf, placePoint}.
export function runWorldDay(progress,dayNow=tickTargetDay(progress),ctx={}){
 const seed=ctx.seed??MAP.seed,P=progress||{};
 let world=normalizeWorld(P.world,seed,dayNow);const from=world.day;
 if(!Number.isSafeInteger(dayNow)||dayNow<=from)return P.world?P:{...P,world,needs:normalizeNeeds(P.needs),npcs:normalizeNpcs(P.npcs)}; // already ticked today: unchanged
 const first=Math.max(from+1,dayNow-CATCH_UP_MAX+1);
 // 1. NPCs: mood drift and sickness for each missed day (capped like the world); Hal's sick days cut the farm's output
 let npcs=normalizeNpcs(P.npcs);const halSick={};
 for(let d=first;d<=dayNow;d++){for(const id of ROSTER_ORDER)npcs[id]=moodTick(npcs[id],d,{seed});halSick[d]=isSick(npcs.hal,d)}
 // 2. the world: production, supply, truck, consumption by the errand visits of every person's day plan
 const memo=new Map(),counts=d=>{if(!memo.has(d))memo.set(d,demandFor(d));return memo.get(d)};
 // W3: each ticked day is the Ridgeline crew's day (workforce-tick.js workforceDay): the yard's trickle (6, once per day), up to 4 forest logs sawn (16 planks, paused at 48 in the yard), the world's tick
 // (production, supply, the warehouse's use taken off the pallets), up to 12 planks hauled from the yard to the racks, and lumber needs left unclaimed for a day filled from real stock. Nothing is made but the trickle.
 const wh=warehouseOf(world,P),claimNow=((Number(P.housing?.day)||1)-1)*1440+(Number(P.routine?.minutes)||0),worldCtx={demand:(place,d)=>counts(d)[place]||0,farmHealth:d=>halSick[d]?SICK_FARM_HEALTH:1,events:ctx.events};
 let yard=yardOf(P,world),company=wh.company,crewNeeds=normalizeNeeds(P.needs);
 for(let d=first;d<=dayNow;d++){const r=workforceDay({world,yard,company,needs:crewNeeds},{day:d,seed,runWorldTick:true,worldCtx,activeNeedId:P.gigs?.active?.needId,claimNow});world=r.world;yard=r.yard;company=r.company;crewNeeds=r.needs}
 if(world.day<dayNow)world={...world,day:dayNow};
 if(!wh.real){const d=PLACES[PALLET_LINK.place].goods[PALLET_LINK.good];world={...world,stock:{...world.stock,[PALLET_LINK.place]:{...world.stock[PALLET_LINK.place],[PALLET_LINK.good]:clamp(totalPlanks(company)+wh.spare,0,d.max)}}}}
 // 3. needs: past-due ones close (a late fill, the keeper's mood), then the new day's needs open
 const keepNeedIds=P.gigs?.active?.needId?[P.gigs.active.needId]:[]; // an old clear/repair need under the active gig stays until that gig ends (OFF_KINDS in needs.js)
 let needs=retireOffKinds(crewNeeds,keepNeedIds); // old open clear/repair needs go quietly, before expire() could charge the keeper's mood
 const ex=expire(needs,world,dayNow,{keeperOf:ctx.keeperOf});needs=ex.needs;world=ex.world;
 for(const m of ex.consequences.mood)if(npcs[m.npc])npcs[m.npc]={...npcs[m.npc],mood:clamp(Math.round(npcs[m.npc].mood+m.delta),MOOD_MIN,MOOD_MAX)};
 const sickNpcs=[],needSeeds=[];
 for(const id of ROSTER_ORDER){const r=byId(id);
  for(const s of needsFor(npcs[id],dayNow,{seed})){
   if(s.reason==='sick'&&r.home){sickNpcs.push({id,home:r.home,good:'bread',qty:1,origin:'shop:market'});continue}
   if((s.kind==='restock'||s.kind==='harvest')&&!PLACES[s.place]?.goods[s.good])continue; // needs.js reads the place's target for these kinds: only goods the world really holds
   if(PLACE_POINTS[s.place]||ctx.placePoint?.(s.place))needSeeds.push({kind:s.kind,place:s.place,good:s.good,person:s.person,qty:s.qty,dueIn:Math.max(1,s.dueDay-dayNow)})}} // seeds for places with no point on the map would only fill the board
 needs=needsFrom(world,dayNow,{needs,sickNpcs,needSeeds,boardOnly:true,keepNeedIds,events:ctx.events,keeperOf:ctx.keeperOf,placePoint:ctx.placePoint});
 yard=normalizeYard({...yard,planks:world.stock[SAWMILL_PLACE].planks}); // what the supply (and any late restock from the sawmill) took leaves the yard: conserved
 const out={...P,world,needs,npcs,sawmillYard:yard};
 if(wh.real&&company!==wh.company)out.companies={...P.companies,[PALLET_LINK.company]:company};
 const plots=workforceStumps(P,dayNow+1,seed);if(plots!==P.plots)out.plots=plots;
 return out;
}

// ---- pump hooks (stage W-D1, fuel.js stays as it is): game.js asks how much a pump can still sell, clips the sale to it, then reports what was sold.
// pumpGate -> {mgal: the most this pump may sell now (a multiple of `step`), soldOut: true when it has none}
export function pumpGate(progress,fuel,wantMgal,step=50){
 const avail=pumpAvailMgal(progress?.world,fuel),n=Math.min(Math.max(0,Math.floor(Number(wantMgal))||0),avail),m=Math.floor(n/step)*step;
 return {mgal:m,soldOut:avail<step};
}
// -> a NEW progress whose world stock fell by the sale (whole gallons through world-state buy()).
export function pumpSold(progress,fuel,soldMgal){
 if(!progress?.world||!(soldMgal>0))return progress;
 return {...progress,world:pumpSell(progress.world,fuel,soldMgal).world};
}
export {PUMP_PLACE};

// W-D2 Town news: the phone lines for needs that opened between two lists (at most `max`, in list order). Pure: game.js posts them as phone messages after a tick.
export function newsFor(before,after,max=2,ctx={}){
 const seen=new Set((Array.isArray(before)?before:[]).map(n=>n.id)),out=[];
 for(const n of Array.isArray(after)?after:[]){if(out.length>=max)break;if(n.status==='open'&&!seen.has(n.id))out.push(newsText(n,ctx))}
 return out;
}