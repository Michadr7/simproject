// workforce-tick.js: workforce economy & stock sync (workforce-design W2).
import {MAP} from './map-definition.js';
import {hashOf} from './population.js';
import {markedBlocks} from './forest.js';
import {BLOCK_TREES} from './workforce-pose.js';
import {LOGS_TO_PLANKS,PLANKS_PER_STACK,TRICKLE_PER_DAY,SAW_MIN_PER_LOG,STARTER_TRUCK,cycleEarnings} from './plank-economy.js';
import {YARD_MAX_PLANKS,freshYard,normalizeYard,switchSaw,feed,tick,trickle} from './sawmill-yard.js';
import {normalizeCells,toCompany,intakeFromYard} from './warehouse-intake.js';
import {totalPlanks,consumeFromRacks,crewPutAway,STAGING_SQUARES,orderPallet,squarePallet,stageByHand,dropOrderPallet} from './pallets.js';
import {PLACES,PALLET_LINK} from './world-goods.js';
import {TICK_MINUTE,normalizeWorld,worldTick} from './world-state.js';
import {CLAIM_LAPSE_MIN,normalizeNeeds,fill} from './needs.js';
import {CLOSE,ticketsOf} from './tickets.js';

const freeze=Object.freeze;
export const WORKFORCE_ACTOR='workforce';
export const SAWMILL_PLACE='property:sawmill';
export const FOREST_PLACE='zone:forest';
export const WORKFORCE_SHIFT_HOURS=freeze([360,1080]);
export const WORKFORCE_LOGS_PER_DAY=4;
export const WORKFORCE_SAWN_PER_DAY=WORKFORCE_LOGS_PER_DAY*LOGS_TO_PLANKS;
export const WORKFORCE_MAX_YARD_INFLOW=WORKFORCE_SAWN_PER_DAY+TRICKLE_PER_DAY;
export const WORKFORCE_YARD_CAP=48;
export const WORKFORCE_HAUL_PER_DAY=12;
export const WORKFORCE_WAREHOUSE_CAP=PLACES[PALLET_LINK.place]?.goods[PALLET_LINK.good]?.target||60;
export const WORKFORCE_STUMPS_MAX=2;
export const WORKFORCE_NEED_GRACE_DAYS=1;
export const WORKFORCE_NEED_PLANKS_STEP=8;
export const WORKFORCE_NEED_LOGS_STEP=4;
export const WORKFORCE_TICKET_GRACE_MIN=180;
export const WORKFORCE_TICKET_STEP_MIN=30;
export const WORKFORCE_TICKET_BATCH=PLANKS_PER_STACK;

const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const clampInt=(v,lo,hi)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):lo;
const mirrorWarehouse=(world,company)=>{
 const d=PLACES[PALLET_LINK.place]?.goods[PALLET_LINK.good];if(!d)return world;
 const n=clamp(totalPlanks(company),0,d.max);
 return {...world,stock:{...world.stock,[PALLET_LINK.place]:{...world.stock[PALLET_LINK.place],[PALLET_LINK.good]:n}}};
};
const setSawmillWorld=(world,planks)=>({...world,stock:{...world.stock,[SAWMILL_PLACE]:{...world.stock[SAWMILL_PLACE],planks:clamp(planks,0,YARD_MAX_PLANKS)}}});

export function normalizeWorkforce(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 return Number.isSafeInteger(value.lastMin)&&value.lastMin>=0&&value.lastMin<=1e9?{lastMin:value.lastMin}:null;
}

export function pickWorkforceStumps(day,seed=MAP.seed,trees=null){
 const d=clampInt(day,1,1e6);
 const prevDay=Math.max(1,d-1);
 const blocks=markedBlocks(prevDay);
 const targetBlock=blocks[0];
 const pool=Array.isArray(trees)&&trees.length?trees:(BLOCK_TREES[targetBlock]||[]);
 if(!pool.length)return freeze([]);
 const count=Math.min(WORKFORCE_STUMPS_MAX,pool.length);
 const picked=[],used=new Set();
 for(let salt=0;picked.length<count&&salt<pool.length*4;salt++){
  const idx=hashOf(seed,'workforce-stump',d,targetBlock,salt)%pool.length;
  if(used.has(idx))continue;
  used.add(idx);
  const t=pool[idx],x=Number.isFinite(t.tx)?t.tx:t.x,z=Number.isFinite(t.tz)?t.tz:t.z;
  picked.push(freeze({block:targetBlock,key:t.key||`${Math.floor(x)},${Math.floor(z)}`,x,z,stage:'stump'}));
 }
 return freeze(picked);
}

export function paceComparison(level=1,truckModel=STARTER_TRUCK){
 const c=cycleEarnings(level,truckModel);
 const shiftHours=(WORKFORCE_SHIFT_HOURS[1]-WORKFORCE_SHIFT_HOURS[0])/60;
 const wfSawnPerHour=WORKFORCE_SAWN_PER_DAY/shiftHours;
 const wfHaulPerHour=WORKFORCE_HAUL_PER_DAY/shiftHours;
 const playerPlanksPerHour=c.minutes>0?c.planks*60/c.minutes:0;
 const sawRatio=wfSawnPerHour>0?+(playerPlanksPerHour/wfSawnPerHour).toFixed(2):Infinity;
 const haulRatio=wfHaulPerHour>0?+(playerPlanksPerHour/wfHaulPerHour).toFixed(2):Infinity;
 const ratio=Math.min(sawRatio,haulRatio);
 return freeze({level:c.level,truck:c.truck,playerPlanksPerHour:+playerPlanksPerHour.toFixed(2),workforceSawnPerHour:+wfSawnPerHour.toFixed(4),workforceHaulPerHour:+wfHaulPerHour.toFixed(4),sawRatio,haulRatio,ratio,ok:ratio>=6});
}

export function supplyFromStocks(company,yardState,wantPlanks){
 const co=company||{},y=normalizeYard(yardState);
 const want=clampInt(wantPlanks,0,1e6);
 const inStock=clampInt(co.stock?.planks||0,0,1e7);
 if(!want)return freeze({company:co,yard:y,placed:0,pallets:0,fromStock:0,fromYard:0});
 const takeStock=Math.min(want,inStock);
 const takeYard=Math.min(want-takeStock,y.planks);
 const avail=takeStock+takeYard;
 if(!avail)return freeze({company:co,yard:y,placed:0,pallets:0,fromStock:0,fromYard:0});
 const put=crewPutAway(co,avail);
 const used=put.placed;
 const fromStock=Math.min(takeStock,used);
 const fromYard=Math.max(0,used-fromStock);
 const nextStock=inStock-fromStock;
 const nextLogs=clampInt(co.stock?.logs||0,0,1e7);
 const baseCo=put.company;
 let nextCo;
 if(nextStock||nextLogs){nextCo={...baseCo,stock:{logs:nextLogs,planks:nextStock}}}
 else{const {stock,...rest}=baseCo;nextCo=rest}
 const nextYard=fromYard>0?normalizeYard({...y,planks:y.planks-fromYard}):y;
 return freeze({company:nextCo,yard:nextYard,placed:used,pallets:put.pallets,fromStock,fromYard});
}

const hasBlockingClaim=(need,claimNow)=>{
 const claims=need?.claims;if(!claims||typeof claims!=='object')return false;
 for(const [pid,c] of Object.entries(claims)){
  if(pid===WORKFORCE_ACTOR||!c||!(c.qty>0))continue;
  if(!Number.isFinite(claimNow)||(claimNow-c.at)<CLAIM_LAPSE_MIN)return true;
 }
 return false;
};

export function workforceDay(state={},opts={}){
 const seed=Number.isFinite(opts?.seed)?opts.seed:(state?.world?.seed??MAP.seed);
 const worldIn=normalizeWorld(state?.world,seed,Math.max(0,(Number(opts?.day)||1)-1));
 const day=Number.isSafeInteger(opts?.day)?clampInt(opts.day,1,1e6):worldIn.day+1;
 let y=normalizeYard(state?.yard??state?.sawmillYard??freshYard());
 let co=state?.company||{};
 let ns=normalizeNeeds(state?.needs);
 let w=mirrorWarehouse(worldIn,co);
 w=setSawmillWorld(w,y.planks);

 // 1. Daily sawmill trickle (6/day max, idempotent per day)
 const beforeTrickle=y.planks;
 y=trickle(y,day);
 const trickled=y.planks-beforeTrickle;

 // 2. Felling & sawing (up to 4 forest logs/day -> 16 planks, paused above 48 yard planks)
 const forestLogs=w.stock[FOREST_PLACE]?.logs||0;
 const capLogs=y.planks<WORKFORCE_YARD_CAP?Math.min(WORKFORCE_LOGS_PER_DAY,forestLogs,Math.ceil((WORKFORCE_YARD_CAP-y.planks)/LOGS_TO_PLANKS),Math.floor((YARD_MAX_PLANKS-y.planks)/LOGS_TO_PLANKS)):0;
 const fed=capLogs>0?feed(y,capLogs):{state:y,accepted:0};
 const logsFed=fed.accepted;
 if(logsFed>0)w={...w,stock:{...w.stock,[FOREST_PLACE]:{...w.stock[FOREST_PLACE],logs:forestLogs-logsFed}}};
 let sawnPlanks=0;
 if(fed.state.logs>0&&fed.state.planks<WORKFORCE_YARD_CAP){
  const active=fed.state.on?fed.state:switchSaw(fed.state,true);
  const beforeSaw=active.planks;
  y=tick(active,WORKFORCE_LOGS_PER_DAY*SAW_MIN_PER_LOG);
  sawnPlanks=y.planks-beforeSaw;
 }else{
  y=fed.state;
 }
 w=setSawmillWorld(w,y.planks);

 // 3. Optional daily worldTick + two-way warehouse/sawmill stock sync
 let warehouseConsumed=0,suppliedToEastbank=0;
 if(opts?.runWorldTick){
  const whBefore=totalPlanks(co);
  w=worldTick(w,day,opts.worldCtx||{});
  const whAfter=w.stock[PALLET_LINK.place]?.[PALLET_LINK.good]||0;
  warehouseConsumed=Math.max(0,whBefore-whAfter);
  if(warehouseConsumed>0)co=consumeFromRacks(co,warehouseConsumed).company;
  w=mirrorWarehouse(w,co);
  suppliedToEastbank=w.last?.supplied?.planks||0;
  y=normalizeYard({...y,planks:w.stock[SAWMILL_PLACE]?.planks||0});
 }

 // 4. Haul up to 12 planks/day from sawmill yard to warehouse racks while warehouse < 60
 let hauledToWarehouse=0;
 const whRoom=Math.max(0,WORKFORCE_WAREHOUSE_CAP-totalPlanks(co));
 const haulPlanks=Math.min(WORKFORCE_HAUL_PER_DAY,whRoom,y.planks);
 const haulStacks=Math.floor(haulPlanks/PLANKS_PER_STACK);
 if(haulStacks>0){
  const flow=intakeFromYard(y,normalizeCells(co),haulStacks);
  if(flow.stored>0){
   const rebuilt=toCompany(flow.cells,co);
   co={...co,pallets:rebuilt.pallets};
   hauledToWarehouse=flow.stored;
  }
  y=flow.left>0?normalizeYard({...flow.yard,planks:flow.yard.planks+flow.left}):flow.yard;
  w=mirrorWarehouse(w,co);
  w=setSawmillWorld(w,y.planks);
 }

 // 5. Fill open unclaimed lumber needs after WORKFORCE_NEED_GRACE_DAYS (1 full day)
 let needsFilledPlanks=0,needsFilledLogs=0;
 const fillNow=day*1440+TICK_MINUTE;
 for(let i=0;i<ns.length;i++){
  const n=ns[i];
  if(n.status!=='open'||(n.good!=='planks'&&n.good!=='logs'))continue;
  if((day-n.openedDay)<WORKFORCE_NEED_GRACE_DAYS)continue;
  if(n.kind==='restock'&&!n.origin)continue; // strict conservation: never deliver from null/air
  if(opts?.activeNeedId&&opts.activeNeedId===n.id)continue;
  if(hasBlockingClaim(n,opts?.claimNow))continue;
  const stepQty=n.good==='planks'?WORKFORCE_NEED_PLANKS_STEP:WORKFORCE_NEED_LOGS_STEP;
  const whBeforeNeed=w.stock[PALLET_LINK.place]?.[PALLET_LINK.good]||0;
  const sawBeforeNeed=w.stock[SAWMILL_PLACE]?.planks||0;
  const r=fill(ns,w,n.id,WORKFORCE_ACTOR,stepQty,fillNow);
  if(r.units>0){
   ns=r.needs;w=r.world;
   if(n.good==='planks'){
    needsFilledPlanks+=r.units;
    const sawDelta=Math.max(0,sawBeforeNeed-(w.stock[SAWMILL_PLACE]?.planks||0));
    if(sawDelta>0)y=normalizeYard({...y,planks:w.stock[SAWMILL_PLACE].planks});
    const whDelta=Math.max(0,whBeforeNeed-(w.stock[PALLET_LINK.place]?.[PALLET_LINK.good]||0));
    if(whDelta>0){co=consumeFromRacks(co,whDelta).company;w=mirrorWarehouse(w,co)}
   }else{
    needsFilledLogs+=r.units;
   }
  }
 }

 const stumps=pickWorkforceStumps(day,seed,opts?.trees);
 return freeze({
  day,
  world:w,
  yard:y,
  sawmillYard:y,
  company:co,
  needs:ns,
  stumps,
  stats:freeze({trickled,logsFed,sawnPlanks,warehouseConsumed,suppliedToEastbank,hauledToWarehouse,needsFilledPlanks,needsFilledLogs,playerPayCents:0,playerRepDelta:0})
 });
}

const freeStagingSquare=(co,list,k)=>{
 const existing=orderPallet(co,k.id);
 if(existing&&Number.isInteger(existing.at?.staging))return existing.at.staging;
 if(Number.isInteger(k.square)&&k.square>=0&&k.square<STAGING_SQUARES){
  const occ=squarePallet(co,k.square);
  if(!occ||occ.order===k.id)return k.square;
 }
 for(let s=0;s<STAGING_SQUARES;s++){
  if(squarePallet(co,s))continue;
  if(list.some(o=>o.id!==k.id&&(o.status==='taken'||o.status==='staged')&&o.square===s))continue;
  return s;
 }
 return -1;
};

export function workforceTicketStep(company,opts={}){
 const co=company||{};
 const now=Number(opts?.now);
 const t=ticketsOf(co);
 if(!Number.isFinite(now)||now<0||!t.list.length){
  if(!co.workforce)return freeze({company:co,staged:0,completed:freeze([]),effects:freeze([])});
  const {workforce,...rest}=co;
  return freeze({company:rest,staged:0,completed:freeze([]),effects:freeze([])});
 }
 const stepSize=WORKFORCE_TICKET_STEP_MIN;
 const curSlot=Math.floor(now/stepSize)*stepSize;
 const wf=normalizeWorkforce(co.workforce);
 const candidates=t.list.filter(k=>(k.status==='open'||(k.status==='taken'&&k.takenBy===WORKFORCE_ACTOR))&&now-k.issuedAt>=WORKFORCE_TICKET_GRACE_MIN&&now<k.dueAt&&k.staged<k.planks);
 if(!candidates.length){
  const anyPotential=t.list.some(k=>k.status==='open'||(k.status==='taken'&&k.takenBy===WORKFORCE_ACTOR));
  if(anyPotential||!co.workforce)return freeze({company:co,staged:0,completed:freeze([]),effects:freeze([])});
  const {workforce,...rest}=co;
  return freeze({company:rest,staged:0,completed:freeze([]),effects:freeze([])});
 }
 const minReady=Math.min(...candidates.map(k=>Math.ceil((k.issuedAt+WORKFORCE_TICKET_GRACE_MIN)/stepSize)*stepSize));
 const startSlot=Math.max(wf?Math.max(wf.lastMin+stepSize,minReady):minReady,curSlot-1440*14);
 if(startSlot>curSlot&&wf&&wf.lastMin===curSlot){
  return freeze({company:co,staged:0,completed:freeze([]),effects:freeze([])});
 }
 let nextCo=co,list=t.list.map(k=>({...k})),totalStaged=0;const completed=[];
 for(let slotMin=startSlot;slotMin<=curSlot;slotMin+=stepSize){
  const modMin=((slotMin%1440)+1440)%1440;
  if(!opts?.ignoreHours&&(modMin<WORKFORCE_SHIFT_HOURS[0]||modMin>=WORKFORCE_SHIFT_HOURS[1]))continue;
  for(let i=0;i<list.length;i++){
   const k=list[i];
   if(!(k.status==='open'||(k.status==='taken'&&k.takenBy===WORKFORCE_ACTOR)))continue;
   if(k.takenBy&&k.takenBy!==WORKFORCE_ACTOR)continue;
   if(slotMin<k.issuedAt+WORKFORCE_TICKET_GRACE_MIN||slotMin>=k.dueAt)continue;
   if(k.kind==='pickup'&&modMin>=CLOSE)continue;
   const need=k.planks-k.staged;if(need<=0)continue;
   const sq=freeStagingSquare(nextCo,list,k);if(sq<0)continue;
   const want=Math.min(WORKFORCE_TICKET_BATCH,need);
   const r=consumeFromRacks(nextCo,want);
   if(r.taken<=0)continue;
   const staged=k.staged+r.taken;
   if(staged>=k.planks){
    nextCo=dropOrderPallet(r.company,k.id).company;
    totalStaged+=r.taken;
    const {square:_sq,...restK}=k;
    list[i]={...restK,staged,status:'done',doneAt:slotMin};
    completed.push(list[i].id);
   }else{
    const st=stageByHand(r.company,{order:k.id,square:sq,n:r.taken,need:r.taken});
    if(st.put<=0)continue;
    nextCo=st.company;
    totalStaged+=st.put;
    list[i]={...k,staged:k.staged+st.put,square:sq};
   }
  }
 }
 const stillActive=list.some(k=>k.status==='open'||(k.status==='taken'&&k.takenBy===WORKFORCE_ACTOR));
 const updatedTickets=totalStaged?{...t,list}:t;
 if(stillActive){
  const out={...nextCo,tickets:updatedTickets,workforce:{lastMin:curSlot}};
  return freeze({company:out,staged:totalStaged,completed:freeze(completed),effects:freeze([])});
 }
 const {workforce,...clean}=nextCo;
 return freeze({company:{...clean,tickets:updatedTickets},staged:totalStaged,completed:freeze(completed),effects:freeze([])});
}
