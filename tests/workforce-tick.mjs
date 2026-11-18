import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP} from '../dist/map-definition.js';
import {markedBlocks} from '../dist/forest.js';
import {LOGS_TO_PLANKS,TRICKLE_PER_DAY} from '../dist/plank-economy.js';
import {freshYard,normalizeYard,trickle,YARD_MAX_PLANKS} from '../dist/sawmill-yard.js';
import {addToRack,crewPutAway,stageByHand,totalPlanks,consumeFromRacks,orderPallet} from '../dist/pallets.js';
import {normalizeWorld} from '../dist/world-state.js';
import {PALLET_LINK} from '../dist/world-goods.js';
import {claim} from '../dist/needs.js';
import {makeTicket,takeTicket} from '../dist/tickets.js';
import {
 SAWMILL_PLACE,FOREST_PLACE,WORKFORCE_YARD_CAP,WORKFORCE_WAREHOUSE_CAP,WORKFORCE_STUMPS_MAX,
 WORKFORCE_NEED_PLANKS_STEP,WORKFORCE_TICKET_BATCH,
 normalizeWorkforce,pickWorkforceStumps,paceComparison,supplyFromStocks,workforceDay,workforceTicketStep,lumberDemand,crewShare,WORKFORCE_DAILY_DRAW
} from '../dist/workforce-tick.js';
import {runWorldDay} from '../dist/world-tick.js';import {freshProgress,normalizeProgress} from '../dist/jobs.js';

// 1. consumeFromRacks on pallets.js: racks first, preserves order pallets, exact totalPlanks delta
{
 let co=addToRack({},'A1-1',20).company;
 co=addToRack(co,'B2-2',12).company;
 co=stageByHand(co,{order:77,square:0,n:8,need:8}).company;
 assert.equal(totalPlanks(co),32,'order pallet excluded from stock');
 const noop=consumeFromRacks(co,0);
 assert.equal(noop.company,co);assert.equal(noop.taken,0);
 const r=consumeFromRacks(co,25);
 assert.equal(r.taken,25);assert.equal(r.left,0);
 assert.equal(totalPlanks(r.company),7);
 assert.equal(orderPallet(r.company,77).count,8,'order pallet untouched');
 const rem=consumeFromRacks(r.company,20);
 assert.equal(rem.taken,7);assert.equal(rem.left,13);
 assert.equal(totalPlanks(rem.company),0);
 assert.equal(orderPallet(rem.company,77).count,8);
}

// 2. 14-day plank and log conservation (zero free planks beyond trickle) & two-way pallet/world sync
{
 let world=normalizeWorld({day:0,stock:{[SAWMILL_PLACE]:{planks:0},[PALLET_LINK.place]:{planks:0},'property:eastbank-supply':{planks:18},[FOREST_PLACE]:{logs:60}},use:{}},MAP.seed,0);
 let yard=freshYard();
 let company={};
 let needs=[];
 const EASTBANK='property:eastbank-supply';
 const initPlanks=yard.planks+totalPlanks(company)+(world.stock[EASTBANK].planks||0);
 let totalTrickled=0,totalLogsFed=0,totalSawn=0,totalWorldConsumed=0,totalNeedsPlanks=0;
 let totalLogsProduced=0,totalNeedsLogs=0;
 const initLogs=world.stock[FOREST_PLACE].logs+yard.logs;

 for(let d=1;d<=14;d++){
  const logsProdBefore=(world.stock[FOREST_PLACE].logs||0);
  const res=workforceDay({world,yard,company,needs},{day:d,seed:MAP.seed,runWorldTick:true,worldCtx:{demand:()=>0}});
  world=res.world;yard=res.yard;company=res.company;needs=res.needs;
  assert.equal(res.stats.playerPayCents,0);
  assert.equal(res.stats.playerRepDelta,0);
  assert.equal(res.sawmillYard,res.yard);
  // Two-way invariant: warehouse world stock === totalPlanks(company) and sawmill world stock === yard.planks
  assert.equal(world.stock[PALLET_LINK.place].planks,totalPlanks(company),`day ${d} warehouse synced`);
  assert.equal(world.stock[SAWMILL_PLACE].planks,yard.planks,`day ${d} sawmill synced`);
  assert.equal(res.stats.sawnPlanks,res.stats.logsFed*LOGS_TO_PLANKS,`day ${d} 1 log = 4 planks`);
  totalTrickled+=res.stats.trickled;
  totalLogsFed+=res.stats.logsFed;
  totalSawn+=res.stats.sawnPlanks;
  totalWorldConsumed+=world.last?.consumed?.planks||0;
  totalLogsProduced+=world.last?.produced?.logs||0;
  totalNeedsPlanks+=res.stats.needsFilledPlanks;
  totalNeedsLogs+=res.stats.needsFilledLogs;
 }
 const finalPlanks=yard.planks+totalPlanks(company)+(world.stock[EASTBANK].planks||0);
 assert.ok(totalTrickled<=14*TRICKLE_PER_DAY&&totalSawn>0,'workforce sawed logs and stayed within trickle');
 assert.equal(finalPlanks+totalWorldConsumed+totalNeedsPlanks,initPlanks+totalTrickled+totalSawn,'14-day strict plank conservation (0 free planks)');
 const finalLogs=world.stock[FOREST_PLACE].logs+yard.logs;
 assert.equal(finalLogs+totalLogsFed+totalNeedsLogs,initLogs+totalLogsProduced,'14-day strict log conservation');
}

// Cap checks: stops feeding >= 48 yard planks, stops hauling >= 60 warehouse planks
{
 const world=normalizeWorld({day:0,stock:{[FOREST_PLACE]:{logs:50}}},MAP.seed,0);
 const fullYard=trickle(normalizeYard({planks:WORKFORCE_YARD_CAP}),1);
 const r=workforceDay({world,yard:fullYard,company:{}},{day:1,seed:MAP.seed});
 assert.equal(r.stats.logsFed,0,'pauses felling at >= 48 yard planks');
 assert.equal(r.stats.sawnPlanks,0);
 const fullWh=crewPutAway({},WORKFORCE_WAREHOUSE_CAP).company;
 const rWh=workforceDay({world,yard:normalizeYard({planks:24}),company:fullWh},{day:2,seed:MAP.seed});
 assert.equal(rWh.stats.hauledToWarehouse,0,'pauses hauling at >= 60 warehouse planks');
}

// 3. Player is >= 6x faster than workforce
{
 const pace=paceComparison(1,'worktruck');
 assert.equal(pace.ok,true);
 assert.ok(pace.sawRatio>=6&&pace.haulRatio>=6&&pace.ratio>=6,`player is ${pace.ratio}x faster (>= 6x)`);
}

// 4. Grace periods + player claim blocks + zero pay/rep + empty source stock = 0 moved
{
 // Needs grace (< 1 day vs >= 1 day), player claim block, empty source stock
 const baseWorld=normalizeWorld({day:2,stock:{[SAWMILL_PLACE]:{planks:20},[FOREST_PLACE]:{logs:12},'property:eastbank-supply':{planks:5}}},MAP.seed,2);
 const yard2=normalizeYard({planks:20,lastTrickleDay:3});
 const lumberNeed={id:'need-p1',kind:'restock',place:'property:eastbank-supply',good:'planks',person:'',qty:20,filled:0,openedDay:3,dueDay:5,closedDay:-1,unitCents:900,claims:{},status:'open',origin:SAWMILL_PLACE};
 const logNeed={id:'need-l1',kind:'harvest',place:FOREST_PLACE,good:'logs',person:'',qty:10,filled:0,openedDay:3,dueDay:6,closedDay:-1,unitCents:1500,claims:{},status:'open',origin:''};
 // Same day (openedDay 3, day 3): grace period blocks workforce
 const day3=workforceDay({world:baseWorld,yard:yard2,company:{},needs:[lumberNeed,logNeed]},{day:3,seed:MAP.seed});
 assert.equal(day3.stats.needsFilledPlanks,0,'needs wait 1 full game day before workforce fills');
 assert.equal(day3.stats.needsFilledLogs,0);
 // Player claim on day 4 blocks workforce
 const claimed=claim([lumberNeed],'need-p1','me',8,3*1440+600).needs;
 const day4Blocked=workforceDay({world:day3.world,yard:normalizeYard({...day3.yard,lastTrickleDay:4}),company:{},needs:claimed},{day:4,seed:MAP.seed});
 assert.equal(day4Blocked.stats.needsFilledPlanks,0,'player claim blocks workforce fill');
 // Unclaimed needs on day 4 (>= 1 day old) fill 8 planks (sawmill) and 4 logs (forest) honestly
 const yardBeforeD4=normalizeYard({planks:24,lastTrickleDay:4});
 const wPreD4=normalizeWorld({day:3,stock:{[SAWMILL_PLACE]:{planks:24},[FOREST_PLACE]:{logs:12},'property:eastbank-supply':{planks:5}}},MAP.seed,3);
 const whFull=crewPutAway({},WORKFORCE_WAREHOUSE_CAP).company;
 const day4Fill=workforceDay({world:wPreD4,yard:yardBeforeD4,company:whFull,needs:[lumberNeed,logNeed]},{day:4,seed:MAP.seed});
 assert.equal(day4Fill.stats.needsFilledPlanks,WORKFORCE_NEED_PLANKS_STEP,'fills 8 planks after 1 full day');
 assert.equal(day4Fill.stats.needsFilledLogs,4,'fills 4 logs after 1 full day');
 assert.equal(day4Fill.stats.playerPayCents,0);assert.equal(day4Fill.stats.playerRepDelta,0);
 assert.equal(day4Fill.needs[0].filled,WORKFORCE_NEED_PLANKS_STEP);
 assert.equal(day4Fill.needs[1].filled,4);
 assert.equal(day4Fill.world.stock['property:eastbank-supply'].planks,5+8,'destination received the real 8 planks');
 // Empty source stock -> 0 moved
 const dryYard=normalizeYard({planks:0,lastTrickleDay:5});
 const dryWorld=normalizeWorld({day:4,stock:{[SAWMILL_PLACE]:{planks:0},[FOREST_PLACE]:{logs:0},'property:eastbank-supply':{planks:5}}},MAP.seed,4);
 const day5Dry=workforceDay({world:dryWorld,yard:dryYard,company:{},needs:[lumberNeed]},{day:5,seed:MAP.seed});
 assert.equal(day5Dry.stats.logsFed,0);assert.equal(day5Dry.stats.sawnPlanks,0);
 assert.equal(day5Dry.stats.hauledToWarehouse,0);assert.equal(day5Dry.stats.needsFilledPlanks,0,'empty source stock moves 0');

 // supplyFromStocks: lumberyard first, sawmillYard second, 0 free planks when both empty
 assert.equal(supplyFromStocks({},freshYard(),40).placed,0,'empty stock + empty yard -> 0 planks (no off-map mill)');
 const supRes=supplyFromStocks({stock:{planks:10}},normalizeYard({planks:14}),18);
 assert.equal(supRes.placed,18);assert.equal(supRes.fromStock,10,'lumberyard drawn first');
 assert.equal(supRes.fromYard,8,'sawmillYard drawn second');assert.equal(supRes.yard.planks,6);
 assert.equal(totalPlanks(supRes.company),18);assert.equal(supRes.company.stock,undefined);
}

// 5. Tickets grace (180 min), 4/30 min step, empty racks = 0, player take blocks, frame-rate independent, omitted when idle
{
 const t1={...makeTicket(1,1,1),planks:12}; // delivery issuedAt 540, ready at 540+180=720
 const racks=crewPutAway({},20).company;
 const co0={...racks,tickets:{nextId:2,day:1,released:[1],list:[t1]}};
 // Grace < 180 min -> 0 staged
 assert.equal(workforceTicketStep(co0,{now:719}).staged,0,'< 180 min grace: 0 staged');
 // Player claimed ticket -> 0 staged past 180 min
 const takenCo=takeTicket(co0,{id:1,playerId:'me',rank:5,now:550}).company;
 assert.equal(workforceTicketStep(takenCo,{now:750}).staged,0,'player ticket blocks workforce');
 // Empty warehouse racks -> 0 staged past 180 min
 const emptyCo={tickets:{nextId:2,day:1,released:[1],list:[t1]}};
 assert.equal(workforceTicketStep(emptyCo,{now:750}).staged,0,'empty warehouse racks move 0');

 // Frame-rate independent cadences (1 min, 5 min, 30 min) converge identically across 540..780
 const runCadence=stepMin=>{
  let c=co0,tot=0;const comp=[];
  for(let m=540;m<=780;m+=stepMin){
   const r=workforceTicketStep(c,{now:m});
   c=r.company;tot+=r.staged;comp.push(...r.completed);
   assert.equal(r.effects.length,0,'crew ticket staging pays $0 and 0 rep');
  }
  return {c,tot,comp};
 };
 const c1=runCadence(1),c5=runCadence(5),c30=runCadence(30);
 assert.equal(c30.tot,12);assert.deepEqual(c30.comp,[1]);
 assert.deepEqual(c1.c,c30.c,'1-min steps match 30-min steps');
 assert.deepEqual(c5.c,c30.c,'5-min steps match 30-min steps');
 assert.equal(totalPlanks(c30.c),8,'20 - 12 staged from racks = 8 left');
 assert.equal(orderPallet(c30.c,1),null,'completed order pallet consumed');
 assert.equal(c30.c.workforce,undefined,'workforce omitted when idle');

 // One intermediate check: at 720 -> 4 staged, workforce.lastMin present while ticket still open
 const mid=workforceTicketStep(co0,{now:720});
 assert.equal(mid.staged,WORKFORCE_TICKET_BATCH);
 assert.equal(orderPallet(mid.company,1)?.count,WORKFORCE_TICKET_BATCH,'partially staged planks sit on real order pallet');
 assert.deepEqual(mid.company.workforce,{lastMin:720});
 assert.deepEqual(normalizeWorkforce(mid.company.workforce),{lastMin:720});
 assert.equal(normalizeWorkforce({}),null);
}

// 6. Co-op determinism & yesterday stump picking (<= 2 stumps in yesterday's block) + purity
{
 const s1=pickWorkforceStumps(5,MAP.seed),s2=pickWorkforceStumps(5,MAP.seed);
 assert.deepEqual(s1,s2,'stumps deterministic');
 assert.ok(s1.length>=1&&s1.length<=WORKFORCE_STUMPS_MAX);
 assert.equal(s1[0].block,markedBlocks(4)[0],'stumps in yesterday marked block');
 const wA=normalizeWorld({day:0},MAP.seed,0);
 const d1=workforceDay({world:wA,yard:freshYard(),company:{}},{day:2,seed:MAP.seed,runWorldTick:true});
 const d2=workforceDay({world:wA,yard:freshYard(),company:{}},{day:2,seed:MAP.seed,runWorldTick:true});
 assert.deepEqual(d1,d2,'co-op workforceDay deterministic');
 const src=fs.readFileSync(new URL('../dist/workforce-tick.js',import.meta.url),'utf8');
 const firstLine=src.split(/\r?\n/)[0];
 assert.ok(firstLine.length<90&&firstLine.includes('workforce-design W2'),`short header <90 chars: ${firstLine}`);
 assert.ok(!/document|window|three\.module|Date\.now|Math\.random/.test(src),'pure source');
}

// 7. Demand gate (owner 2026-11-18, prompts/opus-timber-storage.md): the crew saws only for the part of the demand the player leaves.
{
 const world=normalizeWorld({day:0,stock:{[FOREST_PLACE]:{logs:60}}},MAP.seed,0),wh=crewPutAway({},56).company,yard=normalizeYard({planks:0,lastTrickleDay:0});
 assert.equal(WORKFORCE_DAILY_DRAW,16,'a day of warehouse use (10) and town supply (6)');
 const d=lumberDemand(wh,[]);assert.equal(d.demand,WORKFORCE_WAREHOUSE_CAP+WORKFORCE_DAILY_DRAW);
 // a full day, the player saws nothing: the off-screen crew covers the demand
 const idle=workforceDay({world,yard,company:wh,needs:[]},{day:1,seed:MAP.seed,playerMade:0});
 assert.ok(idle.stats.logsFed>0,'the crew saws when the player does not');assert.ok(idle.yard.planks+totalPlanks(idle.company)>=d.demand,`demand ${d.demand} met: ${idle.yard.planks}+${totalPlanks(idle.company)}`);
 // the player covered the gap yesterday: the crew adds nothing
 const busy=workforceDay({world,yard,company:wh,needs:[]},{day:1,seed:MAP.seed,playerMade:16});
 assert.equal(busy.stats.logsFed,0,'the player alone covers demand: the crew saws nothing');assert.equal(busy.stats.crewShare,0);
 // half covered: the crew saws only the rest (gap 14, player 8 -> 6 planks -> 2 logs)
 assert.equal(workforceDay({world,yard,company:wh,needs:[]},{day:1,seed:MAP.seed,playerMade:8}).stats.logsFed,2);
 // stock already over the demand (open orders and needs raise it)
 const full=crewPutAway({},80).company;assert.equal(workforceDay({world,yard,company:full,needs:[]},{day:1,seed:MAP.seed}).stats.logsFed,0,'stock covers demand: nothing sawn');
 assert.equal(lumberDemand(full,[{status:'open',good:'planks',qty:20,filled:4},{status:'open',good:'bread',qty:9,filled:0},{status:'closed',good:'planks',qty:9,filled:0}]).needs,16,'open plank needs count');
 assert.equal(crewShare(76,70,2),4);assert.equal(crewShare(76,80,0),0);assert.equal(crewShare(76,60,NaN),16);
 // world-tick.js: the player's logs sawn since progress.crewMark count for the next tick; the tick writes the new mark; jobs.js keeps it
 const P0=normalizeProgress(freshProgress()),at=(P,day)=>({...P,housing:{...P.housing,day:day+1},routine:{...P.routine,minutes:400}});
 const w1=normalizeWorld({day:100,stock:{[FOREST_PLACE]:{logs:60},[PALLET_LINK.place]:{planks:56}}},MAP.seed,100);
 const run=mark=>{const P={...at({...P0,world:w1,sawmillYard:normalizeYard({planks:0,logsSawn:10,lastTrickleDay:100})},101),crewMark:mark};const r=runWorldDay(P);return {crew:r.sawmillYard.logsSawn-10,r}};
 const lazy=run(10),worker=run(6);assert.ok(lazy.crew>0,'no player sawing since the mark: the crew saws '+lazy.crew);assert.equal(worker.crew,0,'4 logs (16 planks) sawn by the player since the mark: the crew rests');
 assert.equal(lazy.r.crewMark,lazy.r.sawmillYard.logsSawn,'the tick moves the mark');assert.equal(normalizeProgress(lazy.r).crewMark,lazy.r.crewMark,'saved');assert.equal(normalizeProgress(P0).crewMark,undefined,'absent on a fresh save');
}
console.log(`PASS workforce-tick.mjs: 14-day log/plank conservation (0 free planks beyond trickle), >=6x player speed (${paceComparison().ratio}x), $0/0-rep crew fills, grace windows, player claims block, empty stock=0, 1/5/30-min frame invariance, pure; demand gate: an idle player -> the crew meets demand, a player who covers it -> the crew saws nothing, crewMark saved.`);
