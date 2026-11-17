// world-state.js: the living world's stock, prices and daily tick (pure, deterministic, no clock, no chance outside an injected seed); implements notes/world-system-design.md (stage W-A).
// Save shape (small): {v,seed,day,stock:{place:{good:n}},use:{place:{good:n}},town:{region:{prosperity,history:[7]}},truck:{nextDay},pump:{gas,diesel},last}
//   pump = milli-gallons already sold at the pumps but not yet taken out of the gallon stock (0..999 each; see pumpSell).
//   stock = start-of-day stock (plus what players deliver or buy); use = what the current day will consume (so stockAt can run it down by the clock); last = the newest tick's report.
// Everything returns NEW objects. Goods are conserved: they change only by consumption, production, the supply truck (imports), deliver (moves) and buy (removes).
import {GOODS,PLACES,PLACE_IDS,REGIONS,TRUCK,BLOCKING_EVENTS,SUPPLY,PUMP_PLACE,MGAL_PER_GAL} from './world-goods.js';

export const WORLD_VERSION=1;
export const TICK_MINUTE=300;          // 05:00, the world ticks once a day here (game.js decides when)
export const CATCH_UP_MAX=14;          // a load or sleep runs at most this many missed days
export const PRICE_BAND_PCT=25;        // a price stays within +-25% of base
export const PROSPERITY_FLOOR=30,PROSPERITY_MAX=100,PROSPERITY_START=60,PROSPERITY_STEP=2;
export const HISTORY_DAYS=7;
export const HEALTHY_PCT=75,LOW_PCT=50,CRISIS_PCT=30; // 3-day average stock fill that raises, lowers or lowers fast the prosperity
export const LOW_STOCK_FRAC=.3;        // lowStock(): a good below this share of its target is "low"

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const isInt=v=>Number.isSafeInteger(v);
// same hash as population.js hashOf (FNV-1a + final mix), copied so this file stays free of map imports
export function hashOf(...parts){let h=2166136261;for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0}
const pctOf=(n,pct)=>Math.floor(n*pct/100);

function freshStock(seed){const stock={};for(const id of PLACE_IDS){stock[id]={};for(const [good,d] of Object.entries(PLACES[id].goods))stock[id][good]=clamp(pctOf(d.start,90+hashOf(seed,id,good,'start')%21),0,d.max)}return stock}
const freshTown=()=>Object.fromEntries(Object.keys(REGIONS).map(r=>[r,{prosperity:PROSPERITY_START,history:[]}]));

// A saved world (or anything: garbage, an old save without one) -> a valid world. Unknown places and goods are dropped, numbers are clamped. `day` is where a fresh world starts, so it does not catch up 14 days.
export function normalizeWorld(raw,seed=0,day=0){
 const r=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const sd=isInt(r.seed)?r.seed:(isInt(seed)?seed:0),dy=isInt(r.day)&&r.day>=0?r.day:(isInt(day)&&day>=0?day:0);
 const stock=freshStock(sd),use={},town=freshTown();
 for(const id of PLACE_IDS)for(const [good,d] of Object.entries(PLACES[id].goods)){
  const v=r.stock?.[id]?.[good];if(isInt(v))stock[id][good]=clamp(v,0,d.max);
  const u=r.use?.[id]?.[good];if(isInt(u)&&u>0){(use[id]||(use[id]={}))[good]=Math.min(u,d.max*4)}}
 for(const id of Object.keys(REGIONS)){const t=r.town?.[id];if(!t||typeof t!=='object')continue;
  if(isInt(t.prosperity))town[id].prosperity=clamp(t.prosperity,PROSPERITY_FLOOR,PROSPERITY_MAX);
  if(Array.isArray(t.history))town[id].history=t.history.filter(isInt).map(n=>clamp(n,0,150)).slice(-HISTORY_DAYS)}
 const nd=r.truck?.nextDay;
 const pump={gas:0,diesel:0};for(const f of Object.keys(pump)){const v=r.pump?.[f];if(isInt(v))pump[f]=clamp(v,0,MGAL_PER_GAL-1)}
 return {v:WORLD_VERSION,seed:sd,day:dy,stock,use,town,pump,truck:{nextDay:isInt(nd)&&nd>=0?nd:dy+TRUCK.firstOffset+hashOf(sd,'truck')%3},last:null};
}
const copy=w=>({...w,stock:Object.fromEntries(Object.entries(w.stock).map(([k,v])=>[k,{...v}])),use:Object.fromEntries(Object.entries(w.use||{}).map(([k,v])=>[k,{...v}])),
 town:Object.fromEntries(Object.entries(w.town).map(([k,v])=>[k,{...v,history:[...v.history]}])),truck:{...w.truck},pump:{...(w.pump||{gas:0,diesel:0})}});

// Average fill (percent of target, each good capped at 150%) of a region's shops and depots; of its producers when it has none.
function regionFill(stock,region){
 let kinds=['shop','depot'],rows=[];
 for(let pass=0;pass<2&&!rows.length;pass++,kinds=['producer'])for(const id of PLACE_IDS){const p=PLACES[id];if(p.region!==region||!kinds.includes(p.kind))continue;
  for(const [good,d] of Object.entries(p.goods))rows.push(Math.min(1.5,stock[id][good]/d.target))}
 return rows.length?Math.round(100*rows.reduce((a,b)=>a+b,0)/rows.length):100;
}
const healthOf=(place,day,ctx)=>{const farm=place.health==='farm',fn=farm?ctx.farmHealth:ctx.health;if(typeof fn!=='function')return 1;const v=Number(farm?fn(day):fn(place.id,day));return Number.isFinite(v)?clamp(v,0,1):1};

// One day's tick (the world's 05:00). ctx: {demand(place,day) -> errand visits that day (integer; default 0), farmHealth(day) -> 0..1 (default 1), health(place,day) -> 0..1, events(day) -> [{kind}]}.
// Order: settle yesterday's consumption, produce, supply truck, prosperity, plan today's consumption. A day that is not newer than world.day changes nothing.
export function worldTick(world,day,ctx={}){
 const w=copy(world);if(!isInt(day)||day<=w.day)return w;
 const seed=w.seed,consumed={},produced={},imported={},events=(ctx.events?.(day)||[]).filter(e=>e&&typeof e.kind==='string'),blocked=events.some(e=>BLOCKING_EVENTS.includes(e.kind));
 const add=(o,good,n)=>{if(n>0)o[good]=(o[good]||0)+n};
 for(const id of PLACE_IDS){const p=PLACES[id],st=w.stock[id];
  for(const [good,d] of Object.entries(p.goods)){
   const used=Math.min(st[good],w.use[id]?.[good]||0);st[good]-=used;add(consumed,good,used);                       // settle the day that just ended
   if(d.rate){const out=pctOf(d.rate*healthOf(p,day,ctx),90+hashOf(seed,id,good,day,'out')%21),room=Math.min(out,d.max-st[good]);if(room>0){st[good]+=room;add(produced,good,room)}}}}
 let trucked=false;
 if(day>=w.truck.nextDay&&!blocked){ // the weekly supply truck
  const st=w.stock[TRUCK.place];for(const [good,n] of Object.entries(TRUCK.load)){const load=pctOf(n,85+hashOf(seed,day,good,'truck')%31),room=Math.min(load,PLACES[TRUCK.place].goods[good].max-st[good]);if(room>0){st[good]+=room;add(imported,good,room)}}
  w.truck.nextDay=day+TRUCK.everyDays;trucked=true}
 const supplied={};if(!blocked)for(const s of SUPPLY){const d=PLACES[s.to]?.goods[s.good],src=w.stock[s.from]?.[s.good];if(!d||src===undefined)continue; // W-A2: the producer feeds its shop (moved, never made)
  const n=Math.min(s.perDay,src,Math.max(0,d.target-w.stock[s.to][s.good]));if(n>0){w.stock[s.from][s.good]-=n;w.stock[s.to][s.good]+=n;add(supplied,s.good,n)}}
 // prosperity: moves at most PROSPERITY_STEP a day, never below the floor; it falls by itself while stock stays low
 const fills={};
 for(const [region,t] of Object.entries(w.town)){
  const fill=regionFill(w.stock,region),recent=[...t.history.slice(-2),fill],avg=recent.reduce((a,b)=>a+b,0)/recent.length;
  let step=avg>=HEALTHY_PCT?1:avg<CRISIS_PCT?-2:avg<LOW_PCT?-1:0;if(blocked)step-=1;
  t.prosperity=clamp(t.prosperity+clamp(step,-PROSPERITY_STEP,PROSPERITY_STEP),PROSPERITY_FLOOR,PROSPERITY_MAX);
  t.history=[...t.history,fill].slice(-HISTORY_DAYS);fills[region]=fill}
 // plan today's consumption: errand visits x basket (+ a daily baseline), never more than is on the shelf
 w.use={};
 for(const id of PLACE_IDS){const p=PLACES[id],visits=clamp(Math.floor(Number(ctx.demand?.(id,day))||0),0,500);
  for(const [good,d] of Object.entries(p.goods)){
   const want=visits*(d.basket||0)+(d.daily?pctOf(d.daily,80+hashOf(seed,id,good,day,'use')%41):0),n=Math.min(want,w.stock[id][good]);
   if(n>0)(w.use[id]||(w.use[id]={}))[good]=n}}
 w.day=day;w.last={day,consumed,produced,imported,supplied,trucked,blocked,fills};
 return w;
}

// Run the missed days (fromDay, toDay], at most CATCH_UP_MAX of them (the newest ones). Returns {world, ticks}.
export function catchUp(world,fromDay,toDay,ctx={}){
 let w=copy(world),ticks=0;if(!isInt(fromDay)||!isInt(toDay)||toDay<=fromDay)return {world:w,ticks};
 const first=Math.max(fromDay+1,toDay-CATCH_UP_MAX+1);
 for(let d=first;d<=toDay;d++){w=worldTick(w,d,ctx);ticks++}
 if(w.day<toDay)w.day=toDay;
 return {world:w,ticks};
}

// Stock at a minute of the current day: the start-of-day stock minus the share of today's consumption that the opening hours have used so far (derived, not saved).
export function stockAt(world,place,good,minute=0){
 const p=PLACES[place];if(!p||!p.goods[good]||!world.stock?.[place])return 0;
 const have=world.stock[place][good]||0,use=Math.min(have,world.use?.[place]?.[good]||0),[open,close]=p.hours,m=clamp(Number(minute)||0,0,1440);
 const share=close>open?clamp((m-open)/(close-open),0,1):1;
 return have-Math.floor(use*share);
}
// base x clamp(target/stock) x prosperity factor, all within +-25% of base. Pass a minute to price the shelf at that time of day. Returns whole cents, or null for a good the place does not hold.
export function priceOf(world,place,good,minute){
 const p=PLACES[place],d=p?.goods[good];if(!d)return null;
 const stock=minute===undefined?world.stock[place][good]:stockAt(world,place,good,minute),pros=world.town[p.region]?.prosperity??PROSPERITY_START;
 const scarcity=stock<=0?1+PRICE_BAND_PCT/100:clamp(d.target/stock,1-PRICE_BAND_PCT/100,1+PRICE_BAND_PCT/100),factor=1+(50-pros)/50*.1; // a poor town pays more: prosperity 30 -> x1.04, 100 -> x0.90
 const hi=1+PRICE_BAND_PCT/100;return Math.round(GOODS[good].baseCents*(scarcity>=hi?hi:clamp(scarcity*factor,1-PRICE_BAND_PCT/100,hi))); // a bare shelf is always the full +25%
}
// Move goods into a place. With fromPlace the units come out of that stock (never more than it has); without, the player brings them. Capped at the destination's max. Returns {world, moved}.
export function deliver(world,place,good,qty,fromPlace){
 const w=copy(world),d=PLACES[place]?.goods[good],n=Number.isSafeInteger(qty)&&qty>0?qty:0;if(!d||!n)return {world:w,moved:0};
 let moved=Math.min(n,d.max-w.stock[place][good]);
 if(fromPlace!==undefined&&fromPlace!==null){const src=w.stock[fromPlace]?.[good];if(src===undefined||fromPlace===place)return {world:w,moved:0};moved=Math.min(moved,src);w.stock[fromPlace][good]=src-moved}
 moved=Math.max(0,moved);w.stock[place][good]+=moved;return {world:w,moved};
}
// A player buys: the stock drops, never below 0. Returns {world, sold, cents} (cents at today's price per unit).
export function buy(world,place,good,qty){
 const w=copy(world),d=PLACES[place]?.goods[good],n=Number.isSafeInteger(qty)&&qty>0?qty:0;if(!d||!n)return {world:w,sold:0,cents:0};
 const sold=Math.min(n,w.stock[place][good]),price=priceOf(world,place,good);w.stock[place][good]-=sold;return {world:w,sold,cents:sold*price};
}
// What is running short (for needs.js): [{place,good,stock,target}] below LOW_STOCK_FRAC of target in shops and depots, in data order.
export function lowStock(world,frac=LOW_STOCK_FRAC){
 const out=[];for(const id of PLACE_IDS){const p=PLACES[id];if(p.kind==='producer')continue;
  for(const [good,d] of Object.entries(p.goods)){const s=world.stock[id][good];if(s<d.target*frac)out.push({place:id,good,stock:s,target:d.target})}}
 return out;
}
// How many errand visits each place gets in a day, from people's day plans. planOf(person,day) is dayPlan (injected: this file imports nothing from the map). Returns {place: visits}.
export function visitCounts(people,day,planOf){
 const out={};for(const person of people)for(const b of planOf(person,day))if(b.act==='shop')out[b.place]=(out[b.place]||0)+1;return out;
}
// Total units of a good in the whole world (tests and conservation checks).
export function totalOf(world,good){let n=0;for(const id of PLACE_IDS)n+=world.stock[id][good]||0;return n}
// Pump sales (stage W-D1). The pumps sell from the world's gallon stock: pumpAvailMgal = milli-gallons still for sale; pumpSell(world,fuel,mgal) takes them out through buy() in whole gallons and keeps the remainder in world.pump.
// Returns {world,mgal} (mgal = what was really taken, never more than is available).
export const pumpAvailMgal=(world,fuel)=>{const s=world?.stock?.[PUMP_PLACE]?.[fuel];return Number.isSafeInteger(s)?Math.max(0,s*MGAL_PER_GAL-(world.pump?.[fuel]||0)):0};
export function pumpSell(world,fuel,mgal){
 const w=copy(world),n=Math.min(Math.max(0,Math.floor(Number(mgal))||0),pumpAvailMgal(w,fuel));if(n<=0||!PLACES[PUMP_PLACE]?.goods[fuel])return {world:w,mgal:0};
 const total=(w.pump[fuel]||0)+n,gal=Math.floor(total/MGAL_PER_GAL);w.pump[fuel]=total%MGAL_PER_GAL;
 const r=gal>0?buy(w,PUMP_PLACE,fuel,gal):{world:w};return {world:r.world,mgal:n};
}
