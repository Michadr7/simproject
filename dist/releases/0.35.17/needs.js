// needs.js: the world's NEEDS (restock, harvest, errand, clear, repair, ...): open, claim, fill, expire, pay and turn into a gig board slot (pure, deterministic, no clock, no chance); implements notes/world-system-design.md (stage W-B).
// A need is {id,kind,place,good,person,qty,filled,openedDay,dueDay,closedDay,unitCents,claims:{playerId:{qty,at}},status:'open'|'filled'|'expired',origin}. The list is passed in and returned (NOT inside world-state's save): game.js saves it next to progress.world.
// `now` everywhere is game minutes (gigs.js gameMinutes); a day number is floor(now/1440). Every function returns NEW objects and never changes its inputs.
// Goods are conserved: fills move stock with world-state deliver/buy only (you cannot fill more than the source has or the target can take).
import {GOODS,PLACES,PALLET_LINK} from './world-goods.js';
import {priceOf,lowStock,deliver,buy,PROSPERITY_FLOOR} from './world-state.js';
import {payFor,parMetres,meetsMinPar,MIN_PAR_M} from './gig-pay.js';

export const KINDS=Object.freeze(['restock','harvest','errand','clear','repair','tend','tow','serve']);
export const MAX_OPEN_NEEDS=6;          // the board never floods
export const LOW_FRAC=.3,REFILL_FRAC=.7; // open under 30% of target, ask for enough to reach 70%
export const HARVEST_FULL_FRAC=.9,HARVEST_KEEP_FRAC=.6; // a producer at 90% of max is "full": harvest down to 60%
export const RESTOCK_CAP=24,HARVEST_CAP=30;
export const DUE_DAYS=Object.freeze({restock:2,harvest:3,errand:2,clear:3,repair:3,tend:1,tow:2,serve:1});
export const HYSTERESIS_DAYS=1;         // a need for the same kind+place+good cannot reopen until 1 day after it closed
export const PRUNE_DAYS=3;              // closed needs stay in the list this long (the hysteresis memory)
export const CLAIM_LAPSE_MIN=60;        // a claim without progress for 60 game minutes lapses
export const URGENCY_MIN_PCT=100,URGENCY_MAX_PCT=130; // value multiplier from the day it opens to its due day
export const LATE_FILL_PCT=40,MOOD_HIT=-8,MOOD_HIT_PARTIAL=-4,PROSPERITY_HIT=-1;
export const CHORE_UNIT_CENTS=800;      // value of one unit of work for clear/repair/tend/tow/serve (placeholder)
export const VEHICLE_QTY=12;             // a need of this many units or more is a vehicle job
export const KEEPERS=Object.freeze({'shop:market':'noah','shop:cafe':'sophie','property:farm-house':'hal','property:alder-bakery':'baker'}); // UNVERIFIED ids (gig-clients HAL_ID is a guess too); ctx.keeperOf overrides
export const EVENT_KINDS=Object.freeze({'tree-down':'clear','road-blocked':'clear','broken-fence':'repair','stranded-car':'tow'}); // ctx.events kind -> need kind
// Place points (x,z). market/cafe/farm/gas are the gigs.js origins; the warehouse is its door (map-definition.js); the rest are map landmark centres (FIX-R2). ctx.placePoint(place) overrides.
export const PLACE_POINTS=Object.freeze({
 'shop:market':Object.freeze({id:'market',name:'Corner Market',x:19,z:-6.3}),'shop:cafe':Object.freeze({id:'alder-coffee',name:'Alder Coffee',x:36,z:-6.3}),
 'property:farm-house':Object.freeze({id:'farm',name:'Willow Farmhouse',x:-80,z:-236.5}),'property:eastbank-gas-kiosk':Object.freeze({id:'gas',name:'the gas station',x:156.5,z:-8.25}),
 'office:ridgeline-warehouse':Object.freeze({id:'ridgeline-warehouse',name:'Ridgeline Warehouse',x:166.9,z:31.5}),
 'property:alder-bakery':Object.freeze({id:'alder-bakery',name:'Ironwood Bakery',x:17.75,z:-76.35}),'property:sawmill':Object.freeze({id:'sawmill',name:'Sawmill',x:104,z:-274.5}),
 'property:eastbank-supply':Object.freeze({id:'eastbank-supply',name:'Eastbank Building Supplier',x:83,z:40}),'zone:forest':Object.freeze({id:'forest',name:'Pine Ridge',x:82,z:-266})}); // FIX-R2: bakery = its landmark point; sawmill and supplier = a free spot beside the building (audit A F7: the landmark centres are inside their colliders); farm = the open yard (-80,-236.5) (audit A F1, see gigs.js FARM_ORIGIN); the forest = inside the Pine Ridge zone (it was z 120, outside the playable area)
// Gig board text per kind; TITLES has the good-specific one-liners (the egg slice first).
export const TEMPLATES=Object.freeze({
 restock:{title:g=>`${GOODS[g]?.label||'Goods'} for the shop`,text:(n,g,from,to)=>`${to} is running low. Bring ${n} ${GOODS[g]?.unit||'unit'}(s) of ${(GOODS[g]?.label||'goods').toLowerCase()} from ${from}.`},
 harvest:{title:g=>`Bring in the ${(GOODS[g]?.label||'harvest').toLowerCase()}`,text:(n,g,from)=>`${from} has more than it can store. Collect ${n} ${GOODS[g]?.unit||'unit'}(s).`},
 errand:{title:g=>`A favour: ${(GOODS[g]?.label||'an errand').toLowerCase()}`,text:(n,g,from,to)=>`${to} is under the weather and needs ${n} ${GOODS[g]?.unit||'unit'}(s) from ${from}.`},
 clear:{title:()=>'Clear the way',text:(n,g,from,to)=>`Something is blocking ${to}. Clear it.`},repair:{title:()=>'Mend it',text:(n,g,from,to)=>`Something at ${to} is broken. Repair it.`},
 tend:{title:()=>'Tend the animals',text:(n,g,from,to)=>`${to} needs looking after.`},tow:{title:()=>'Tow job',text:(n,g,from,to)=>`A vehicle at ${to} needs a tow.`},serve:{title:()=>'Cover a shift',text:(n,g,from,to)=>`${to} needs a hand serving.`}});
export const TITLES=Object.freeze({'restock|eggs':'Eggs for the market'});

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const CHORE=new Set(['clear','repair','tend','tow','serve']); // as gigs.js CHORE_KINDS: these skip the minimum-distance rule
const isInt=Number.isSafeInteger;
export function hashOf(...parts){let h=2166136261;for(const ch of parts.join('|')){h^=ch.codePointAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;return h>>>0}
export const dayOf=now=>Math.floor((Number(now)||0)/1440);
export const keyOf=n=>`${n.kind}|${n.place}|${n.good||''}`;
const clone=n=>({...n,claims:Object.fromEntries(Object.entries(n.claims||{}).map(([k,v])=>[k,{...v}]))});
const keeperOf=(place,ctx)=>ctx?.keeperOf?.(place)||KEEPERS[place]||'';
const pointOf=(place,ctx)=>{const p=ctx?.placePoint?.(place)||PLACE_POINTS[place];return p&&Number.isFinite(p.x)&&Number.isFinite(p.z)?{id:p.id||place,x:p.x,z:p.z,room:p.room||'street',name:p.name||PLACES[place]?.label||place}:null};

// A saved list (or garbage) -> a valid list.
export function normalizeNeeds(raw){
 if(!Array.isArray(raw))return [];const out=[];
 for(const n of raw){if(!n||typeof n.id!=='string'||!KINDS.includes(n.kind)||typeof n.place!=='string'||!isInt(n.qty)||n.qty<1)continue;
  const st=['open','filled','expired'].includes(n.status)?n.status:'open',claims={};
  for(const [k,c] of Object.entries(n.claims&&typeof n.claims==='object'?n.claims:{}))if(isInt(c?.qty)&&c.qty>0&&Number.isFinite(c.at))claims[k]={qty:c.qty,at:c.at};
  out.push({id:n.id,kind:n.kind,place:n.place,good:typeof n.good==='string'?n.good:'',person:typeof n.person==='string'?n.person:'',qty:n.qty,filled:clamp(isInt(n.filled)?n.filled:0,0,n.qty),
   openedDay:isInt(n.openedDay)?n.openedDay:0,dueDay:isInt(n.dueDay)?n.dueDay:0,closedDay:isInt(n.closedDay)?n.closedDay:-1,unitCents:isInt(n.unitCents)&&n.unitCents>=0?n.unitCents:0,
   claims:st==='open'?claims:{},status:st,origin:typeof n.origin==='string'?n.origin:''})}
 return out.slice(0,60);
}
export const openNeeds=needs=>needs.filter(n=>n.status==='open');
export const remainingOf=n=>Math.max(0,n.qty-n.filled);
const lapse=(n,now)=>{for(const [k,c] of Object.entries(n.claims))if(now-c.at>=CLAIM_LAPSE_MIN||c.qty<=0)delete n.claims[k];return n};
const claimedByOthers=(n,pid)=>Object.entries(n.claims).reduce((a,[k,c])=>k===pid?a:a+c.qty,0);
// Value multiplier in percent, 100 on the day it opens up to 130 on its due day.
export function urgencyPct(n,day){const span=Math.max(1,n.dueDay-n.openedDay);return Math.round(URGENCY_MIN_PCT+(URGENCY_MAX_PCT-URGENCY_MIN_PCT)*clamp((day-n.openedDay)/span,0,1))}
// Value (cents) of units filled after `before` units were already in: pro rata, telescoping so the parts add up to the whole.
export function valueCents(n,units,day,before=0){
 const total=Math.floor(n.unitCents*n.qty*urgencyPct(n,day)/100),a=clamp(before,0,n.qty),b=clamp(before+units,0,n.qty);
 return Math.floor(total*b/n.qty)-Math.floor(total*a/n.qty);
}

// The producer that can supply a good (most stock first, data order breaks ties), or null.
function sourceFor(world,good,not){let best=null,bs=0;for(const [id,p] of Object.entries(PLACES)){if(p.kind!=='producer'||id===not||!p.goods[good])continue;const s=world.stock[id][good];if(s>bs){best=id;bs=s}}return best?{place:best,stock:bs}:null}
const unitCentsFor=(world,place,good)=>good&&PLACES[place]?.goods[good]?priceOf(world,place,good):good&&GOODS[good]?GOODS[good].baseCents:CHORE_UNIT_CENTS;

// What the world needs today. ctx: {needs: the current list (open + recently closed), sickNpcs:[{id,home,good?,qty?,origin?}], needSeeds:[{kind,person?,place,good?,qty,origin?,dueIn?}], events: [{id?,kind,at,qty?}] or day=>[...], keeperOf, placePoint}.
// Returns the NEW full list: open needs are kept (a restock whose shelf has recovered closes as filled), new ones are added in a fixed order up to MAX_OPEN_NEEDS.
export function needsFrom(world,day,ctx={}){
 const list=normalizeNeeds(ctx.needs).map(clone).filter(n=>n.status==='open'||day-n.closedDay<=PRUNE_DAYS);
 for(const n of list){if(n.status!=='open')continue;
  if(n.kind==='restock'&&world.stock[n.place]?.[n.good]>=Math.ceil(PLACES[n.place].goods[n.good].target*REFILL_FRAC)){n.status='filled';n.closedDay=day;n.claims={}}
  if(n.kind==='harvest'&&world.stock[n.place]?.[n.good]<=Math.floor(PLACES[n.place].goods[n.good].max*HARVEST_KEEP_FRAC)){n.status='filled';n.closedDay=day;n.claims={}}}
 const cands=[],mk=(pri,kind,place,good,qty,o={})=>cands.push({pri,kind,place,good:good||'',qty,person:o.person||'',origin:o.origin||'',dueIn:o.dueIn});
 for(const r of lowStock(world,LOW_FRAC)){ // restock: a shop is under 30% and some producer has the good
  if(ctx.boardOnly&&r.place===PALLET_LINK.place&&r.good===PALLET_LINK.good)continue; // audit A F5: the Ridgeline pallets are the truth for this stock (world-tick mirrorPallets overwrites it every day), so planks delivered by a gig would vanish and the need reopen: a money loop
  const d=PLACES[r.place].goods[r.good],src=sourceFor(world,r.good,r.place);if(!src)continue;
  const qty=Math.min(RESTOCK_CAP,Math.ceil(d.target*REFILL_FRAC)-r.stock,src.stock,d.max-r.stock);if(qty>=1)mk(r.stock/r.target,'restock',r.place,r.good,qty,{origin:src.place})}
 for(const [id,p] of Object.entries(PLACES)){if(p.kind!=='producer')continue; // harvest: a producer is full and production is being wasted
  for(const [good,d] of Object.entries(p.goods)){const s=world.stock[id][good];if(!d.rate||s<d.max*HARVEST_FULL_FRAC)continue;
   const qty=Math.min(HARVEST_CAP,s-Math.floor(d.max*HARVEST_KEEP_FRAC));if(qty>=1)mk(.5+(1-s/d.max),'harvest',id,good,qty)}}
 for(const s of Array.isArray(ctx.sickNpcs)?ctx.sickNpcs:[]){if(!s||typeof s.id!=='string'||typeof s.home!=='string')continue; // errand: a sick neighbour needs something from a shop
  mk(.1,'errand',s.home,typeof s.good==='string'?s.good:'bread',isInt(s.qty)&&s.qty>0?Math.min(s.qty,6):1,{person:s.id,origin:typeof s.origin==='string'?s.origin:'shop:market'})}
 for(const s of Array.isArray(ctx.needSeeds)?ctx.needSeeds:[]){if(!s||!KINDS.includes(s.kind)||typeof s.place!=='string'||!isInt(s.qty)||s.qty<1)continue;
  mk(.15,s.kind,s.place,s.good,Math.min(s.qty,RESTOCK_CAP),{person:s.person,origin:s.origin,dueIn:isInt(s.dueIn)?s.dueIn:undefined})}
 const evs=typeof ctx.events==='function'?ctx.events(day):ctx.events;
 for(const e of Array.isArray(evs)?evs:[]){const kind=EVENT_KINDS[e?.kind];if(!kind||typeof e.at!=='string')continue;mk(.2,kind,e.at,'',isInt(e.qty)&&e.qty>0?e.qty:1,{person:typeof e.person==='string'?e.person:''})}
 cands.sort((a,b)=>a.pri-b.pri||(keyOf(a)<keyOf(b)?-1:keyOf(a)>keyOf(b)?1:0));
 let open=list.filter(n=>n.status==='open').length;
 for(const c of cands){if(open>=MAX_OPEN_NEEDS)break;const key=keyOf(c);
  if(ctx.boardOnly){const sl=needToSlot({id:'',kind:c.kind,place:c.place,good:c.good,qty:c.qty,filled:0,openedDay:day,dueDay:day,origin:c.origin},ctx);if(!sl||(!CHORE.has(c.kind)&&sl.parM<MIN_PAR_M.walk))continue} // FIX-R2 (ctx.boardOnly, which world-tick.js sets): only needs that can become a board slot (a point on the map, a par of 300 m or more, as boardFor filters) take one of the six places
  if(list.some(n=>keyOf(n)===key&&(n.status==='open'||day-n.closedDay<HYSTERESIS_DAYS)))continue; // one open need per kind+place+good; hysteresis
  const due=day+(c.dueIn??(DUE_DAYS[c.kind]+hashOf(world.seed,key,day,'due')%2)),vp=c.kind==='errand'&&c.origin?c.origin:c.place;
  list.push({id:`${key}|${day}`,kind:c.kind,place:c.place,good:c.good,person:c.person,qty:c.qty,filled:0,openedDay:day,dueDay:due,closedDay:-1,unitCents:unitCentsFor(world,vp,c.good),claims:{},status:'open',origin:c.origin});open++}
 return list;
}

// A player claims up to qty units (several players can claim one need; claims that idle 60 game minutes lapse). Returns {needs, claimed, error?}.
export function claim(needs,id,playerId,qty,now){
 const out=needs.map(clone),n=out.find(x=>x.id===id);if(!n)return {needs:out,claimed:0,error:'No such need.'};
 if(n.status!=='open')return {needs:out,claimed:0,error:'This need is closed.'};
 lapse(n,now);const room=Math.max(0,remainingOf(n)-claimedByOthers(n,playerId)),want=isInt(qty)&&qty>0?qty:0,claimed=Math.min(want,room);
 if(claimed<1)return {needs:out,claimed:0,error:'Already claimed by others.'};
 n.claims[playerId]={qty:claimed,at:now};return {needs:out,claimed};
}

// A player delivers/does `qty` units. Goods move with world-state deliver/buy, so you can never fill more than the source has or the target can take.
// opts.carried (restock only): the player already took the goods out of the source (gigs.js pickNeedHaul), so deliver() adds them to the shelf without taking them from the source a second time. Returns {needs, world, units (accepted and paid), cents (raw pro-rata value, before quality/fatigue; needPay does those), over (qty not accepted)}.
export function fill(needs,world,id,playerId,qty,now,opts={}){
 const out=needs.map(clone),n=out.find(x=>x.id===id),day=dayOf(now),want=isInt(qty)&&qty>0?qty:0;
 if(!n||n.status!=='open'||!want)return {needs:out,world,units:0,cents:0,over:want};
 lapse(n,now);const room=Math.max(0,remainingOf(n)-claimedByOthers(n,playerId)),ask=Math.min(want,room);let w=world,units=0;
 if(ask>0){
  if(n.kind==='restock'){const r=deliver(world,n.place,n.good,ask,opts.carried?null:(n.origin||null));w=r.world;units=r.moved} // opts.carried: the goods were already taken from the source at pickup (W-D2), so they come from nowhere here
  else if(n.kind==='harvest'){const r=buy(world,n.place,n.good,ask);w=r.world;units=r.sold}
  else if(n.kind==='errand'&&n.origin&&PLACES[n.origin]?.goods[n.good]){const r=buy(world,n.origin,n.good,ask);w=r.world;units=r.sold}
  else units=ask}
 const cents=valueCents(n,units,day,n.filled);n.filled+=units;
 const c=n.claims[playerId];if(c){c.qty-=units;c.at=units>0?now:c.at;if(c.qty<=0)delete n.claims[playerId]}
 if(n.filled>=n.qty){n.status='filled';n.closedDay=day;n.claims={}}
 return {needs:out,world:w,units,cents,over:want-units};
}

// Past-due needs close as 'expired': the world's own actor fills a late, smaller part (40% of qty: Hal's run, the supply truck), the keeper loses mood, the region loses prosperity.
// Returns {needs, world, consequences:{mood:[{npc,delta}], prosperity:[{region,delta}], npcFill:[{id,actor,units}], price:[{place,good,before,after}]}}.
export function expire(needs,world,day,ctx={}){
 const out=needs.map(clone),cons={mood:[],prosperity:[],npcFill:[],price:[]};let w=world;
 for(const n of out){if(n.status!=='open'||n.dueDay>=day)continue;
  const left=remainingOf(n),late=Math.min(left,Math.max(1,Math.floor(n.qty*LATE_FILL_PCT/100)));let units=0;const before=n.good&&PLACES[n.place]?.goods[n.good]?priceOf(w,n.place,n.good):null;
  if(n.kind==='restock'){const r=deliver(w,n.place,n.good,late,n.origin||null);w=r.world;units=r.moved}
  else if(n.kind==='harvest'){const r=buy(w,n.place,n.good,late);w=r.world;units=r.sold}
  else if(n.kind==='errand'&&n.origin&&PLACES[n.origin]?.goods[n.good]){const r=buy(w,n.origin,n.good,late);w=r.world;units=r.sold}
  else units=late;
  const actor=n.kind==='restock'?(n.origin==='property:farm-house'?'hal':'supply-truck'):n.kind==='harvest'?'hal':'town-crew';
  if(units>0)cons.npcFill.push({id:n.id,actor,units});
  n.filled+=units;n.status='expired';n.closedDay=day;n.claims={};
  const who=n.person||keeperOf(n.place,ctx);if(who)cons.mood.push({npc:who,delta:n.filled-units>0?MOOD_HIT_PARTIAL:MOOD_HIT});
  const region=PLACES[n.place]?.region;
  if(region&&w.town[region]){const t=w.town[region],np=clamp(t.prosperity+PROSPERITY_HIT,PROSPERITY_FLOOR,100);if(np!==t.prosperity){w={...w,town:{...w.town,[region]:{...t,history:[...t.history],prosperity:np}}};cons.prosperity.push({region,delta:np-t.prosperity})}}
  if(before!==null)cons.price.push({place:n.place,good:n.good,before,after:priceOf(w,n.place,n.good)});
 }
 return {needs:out,world:w,consequences:cons};
}

// Pay for doing `qty` units of a need: the gig-pay floor (handling + distance, with fatigue and the too-fast rule) PLUS the need's value (unit value x urgency, scaled by quality and fatigue; 0 when too fast).
// ctx: {day, before (units already filled by others, for pro rata), doneToday, repMul, generosity, onTime, elapsedMin}. Returns {floor, value, tip, total, factor, tooFast}.
export function needPay(need,qty,quality,mode,parM,ctx={}){
 const g=payFor({mode,parM,quality,doneToday:ctx.doneToday,repMul:ctx.repMul,generosity:ctx.generosity,onTime:ctx.onTime,elapsedMin:ctx.elapsedMin});
 const day=isInt(ctx.day)?ctx.day:need.openedDay,q=clamp(Number.isFinite(quality)?quality:100,0,100),units=clamp(isInt(qty)?qty:0,0,need.qty);
 const value=g.tooFast?0:Math.floor(valueCents(need,units,day,ctx.before||0)*q/100*g.factor);
 return {floor:g.pay,value,tip:g.tip,total:g.pay+value+g.tip,factor:g.factor,tooFast:g.tooFast};
}

// A need as a gigs.js board slot (same fields boardFor makes: slot,window,expiresAt,type,client,clientName,places,large,origin,points,parM,mode,pair,starter) plus need fields.
// type is 'need-<kind>': W-E must add those ids to GIG_TYPES (acceptGig/normalizeActive look the type up). Returns null when a place has no point. ctx: {slot, placePoint, names:{id:name}, keeperOf}.
export function needToSlot(need,ctx={}){
 const dest=pointOf(need.place,ctx),from=need.kind==='restock'||need.kind==='errand'?pointOf(need.origin,ctx):dest;if(!dest||!from)return null;
 const mode=need.qty>=VEHICLE_QTY?'vehicle':'walk',parM=parMetres([from,dest]),client=need.person||keeperOf(need.place,ctx),T=TEMPLATES[need.kind],fromName=from.name,toName=dest.name;
 return {slot:isInt(ctx.slot)?ctx.slot:0,window:need.openedDay,expiresAt:(need.dueDay+1)*1440,type:'need-'+need.kind,client,clientName:ctx.names?.[client]||client,
  places:[{...dest}],large:false,origin:{...from},points:[{...dest}],parM,mode,pair:`${from.id}>${dest.id}`,starter:false,
  needId:need.id,kind:need.kind,good:need.good,qty:need.qty,remaining:remainingOf(need),unitCents:need.unitCents,meetsPar:meetsMinPar(parM,mode),
  title:(need.place==='shop:market'&&TITLES[`${need.kind}|${need.good}`])||T.title(need.good),description:T.text(remainingOf(need),need.good,fromName,toName)};
}
// The board: open needs with something left to do, as slots (most urgent first), at most `max`.
export function needSlots(needs,ctx={},max=4){
 const out=[];for(const n of openNeeds(needs).filter(x=>remainingOf(x)>0).sort((a,b)=>a.dueDay-b.dueDay||(a.id<b.id?-1:1))){const s=needToSlot(n,{...ctx,slot:out.length});if(s)out.push(s);if(out.length>=max)break}
 return out;
}

// A player gives up a need (the gig was abandoned or the need closed): only that player's claim goes. Returns a NEW list.
export function release(needs,id,playerId){const out=needs.map(clone),n=out.find(x=>x.id===id);if(n)delete n.claims[playerId];return out}
// The phone line when a need opens (Town news): the keeper says it in the first person for the egg slice, the rest read from the template title.
export function newsText(need,ctx={}){
 const who=need.person||keeperOf(need.place,ctx),name=ctx.names?.[who]||(who?who[0].toUpperCase()+who.slice(1):'The town'),g=(GOODS[need.good]?.label||'goods').toLowerCase();
 if(need.kind==='restock')return `${name}: we are nearly out of ${g}.`;
 if(need.kind==='harvest')return `${name}: the ${g} are piling up. Could someone bring them in?`;
 if(need.kind==='errand')return `${name} is under the weather and needs ${g}.`;
 return `${name}: ${TEMPLATES[need.kind].title(need.good)}.`;
}