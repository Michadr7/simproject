// plank-economy.js: the planks chain's numbers in ONE table (prices, pay per step, ratios, rates, cycle times) and the pure wage maths; implements notes/planks-economy-design.md stage P-A. Pure: no DOM, no globals, no Math.random/Date.now. Money is integer cents, time is game minutes.
// Each constant says MEASURED (read from the current code, file named) or PLACEHOLDER (chosen here, tune later). Nothing in dist/ reads this file yet: stages P-B onward adopt it (the edits are listed in notes/eval/outbox/P-A.md).
// WAGE RULE (owner 2026-11-17): a full by-hand cycle is the BEST hands-on job in town: its cents per game hour at the same level must be at least WAGE_MARGIN_PCT above the best existing hands-on job. existingJobs(level) measures every
// existing job from the same speeds (gig-pay.js, carry.js, skills.js, tools.js, careers wages, cafe-job.js). The market errands in jobs.js (ROUTES) are listed but kept out of the rule (see EXCLUDED_FROM_RULE): they are 6-36 m from the market door and
// pay 12 to 18 dollars with no cap, so they are a bug in the old tutorial job, not a wage to match. tests/plank-economy.mjs fails if any rule job overtakes the cycle, and cross-checks every MEASURED copy below against the real file.
import {TYPICAL_M_PER_GAME_MIN,WALK_M_PER_GAME_MIN,GAME_MIN_PER_REAL_SEC,MIN_PAR_M,PAR_SLACK,payFor} from './gig-pay.js';
import {swingTime,logsPerTree} from './skills.js';
import {hitsFor} from './tools.js';
import {GOODS,PLACES} from './world-goods.js';
import {normalizeWorld,priceOf,stockAt,PRICE_BAND_PCT,LOW_STOCK_FRAC} from './world-state.js';

const freeze=Object.freeze;
const num=(v,d)=>Number.isFinite(v)?v:d;
const clampInt=(v,lo,hi,d)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const round1=x=>Math.round(x*10)/10;

// ---- 1. goods and prices (MEASURED: world-goods.js GOODS.planks.baseCents 900, marked ASSUMED there; world-state.js priceOf moves it within +-25% with stock and prosperity)
export const PLANK_PLACES=freeze({sawmill:'property:sawmill',supplier:'property:eastbank-supply',warehouse:'office:ridgeline-warehouse'});
export const PLANK_BASE_CENTS=GOODS.planks.baseCents;      // MEASURED 900. All three places sell at the one base: world-state has no per-place base. PLACEHOLDER question: should the sawmill (wholesale) be cheaper? Left equal.
export const LOG_BASE_CENTS=GOODS.logs.baseCents;          // MEASURED 1500 (world-goods.js, ASSUMED there). A log makes 4 planks (3600 c at base): the 2.4x mark-up pays for the saw, the carrying and the road.
export const LOGS_TO_PLANKS=4;                             // DECISION (owner 2026-11-17): 1 log = 4 planks = one belt stack (carry.js PLANKS_PER_STACK 4)
export const PLANKS_PER_STACK=4;                           // MEASURED carry.js PLANKS_PER_STACK: the most planks in the hands, and the size of a belt stack
export const RACK_CELL_PLANKS=40;                          // MEASURED pallets.js PALLET_CAP via forest.js RACK_CAP: planks in one full warehouse rack cell

// ---- 2. production rates (planks per day)
export const OLD_SAWMILL_RATE=24;   // MEASURED 24 before the P-B wiring (world-goods.js rate 24: the sawmill made these with no player at all); the wiring removed that rate, so the old number is kept here as history
export const TRICKLE_PER_DAY=6;            // PLACEHOLDER: replaces 24. 6 = the 6 a day the sawmill ships to the Eastbank supplier (world-goods.js SUPPLY perDay 6) = the supplier's whole daily use (PLACES supplier daily 6): the shop never runs bare, but the warehouse (daily use 10) and every order need the player
export const TOWN_USE_PER_DAY=PLACES['office:ridgeline-warehouse'].goods.planks.daily+PLACES['property:eastbank-supply'].goods.planks.daily;   // MEASURED 16 (10 + 6): the planks the town uses a day
export const PLAYER_SHARE_PER_DAY=Math.max(0,TOWN_USE_PER_DAY-TRICKLE_PER_DAY);   // 10 planks a day must come from the player (2.5 logs): about one quarter of one truck load a day keeps the town going

// ---- 3. hands, speeds, distances (MEASURED unless marked)
export const WALK_M_MIN=WALK_M_PER_GAME_MIN;   // MEASURED 9 m per game minute (gig-pay.js: 4.5 m/s, one game minute = 2 real seconds)
export const LOG_CARRY_FACTOR=.95,PLANK_CARRY_FACTOR=.85;   // MEASURED carry.js HANDS_SPEED log .95 (timber redesign T-A, was .8), planks .85
export const LOG_CARRY_M_MIN=WALK_M_MIN*LOG_CARRY_FACTOR,PLANK_CARRY_M_MIN=WALK_M_MIN*PLANK_CARRY_FACTOR;
export const INTERACT_MIN=.5;                  // PLACEHOLDER: one pick up or put down = 1 real second = half a game minute
export const TREE_GAP_M=12;                    // PLACEHOLDER: walk from one felled pine to the next marked one
export const TREE_TO_SAW_M=25;                 // MEASURED-ish: Pine Ridge (82,-266, needs.js PLACE_POINTS) and the landing (129.2,-279.8, forest.js LANDING) both sit 25 to 50 m from the sawmill (104,-278): 25 m is the near side
export const SAW_SECONDS_PER_LOG=8;            // PLACEHOLDER (real seconds): lever, the Cut clip (log in the blade from frame 14 to 47 at 24 fps, sawmill.js) and the belt carrying the stack out
export const SAW_MIN_PER_LOG=SAW_SECONDS_PER_LOG*GAME_MIN_PER_REAL_SEC;
// Timber redesign T-A (notes/timber-redesign-design.md, owner answers): a trunk sawn whole gives 2 slabs in 12 s (a log stays 8 s for 4 boards); a trunk is bucked into 2 logs. Pay is in cents, PLACEHOLDER numbers kept apart from PAY so the level-1 wage test is unchanged until the wiring.
export const SAW_SECONDS_PER_TRUNK=12,SAW_MIN_PER_TRUNK=SAW_SECONDS_PER_TRUNK*GAME_MIN_PER_REAL_SEC,TRUNK_TO_SLABS=2,TRUNK_TO_LOGS=2;
export const TIMBER_PAY=freeze({buckTrunk:100,trunkToSaw:150,slabOffBelt:40,slabDelivered:1400});
export const BELT_TO_TRUCK_M=8;               // PLACEHOLDER: the truck is parked beside the belt
export const DOCK_M=6;                         // PLACEHOLDER: the truck is backed to the warehouse door, to the rack or the order spot
export const SAWMILL_POS=freeze({x:104,z:-278});           // MEASURED map-definition.js landmark 'sawmill'
export const WAREHOUSE_POS=freeze({x:166.9,z:31.5});       // MEASURED map-definition.js office 'ridgeline-warehouse' door
export const LUMBERYARD_POS=freeze({x:87,z:52});           // MEASURED forest.js LUMBERYARD centre (x 80-94, z 44-60)
export const ROAD_FACTOR=1.3;                  // PLACEHOLDER: road length over straight line (the gig board uses 1.2 as PAR_SLACK; the real road bends more)
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const ROAD_M=Math.ceil(dist(SAWMILL_POS,WAREHOUSE_POS)*ROAD_FACTOR);   // 411 m one way, sawmill to the Ridgeline warehouse
export const YARD_ROAD_M=Math.ceil(dist(SAWMILL_POS,LUMBERYARD_POS)*ROAD_FACTOR);   // the same to the lumberyard (the old forest.js delivery)
export const DRIVE_FIDDLE_MIN=1;               // PLACEHOLDER: start, park and get out, per end
export const HANDOVER_MIN=1;                   // PLACEHOLDER: speaking to the foreman for a delivery
// Planks that fit on a bed: MEASURED cargo.js BEDS space / CARGO_KINDS.planks.space 1 (the test cross-checks capacity(model,'planks')). worktruck is the starter truck (vehicle.js).
export const STARTER_TRUCK='worktruck';
export const BED_PLANKS=freeze({worktruck:32,offroad:32,shortbed:44,flatbed:120,atv:5});
// Top speeds m/s MEASURED vehicle.js CLASSES; a truck drives at the gig pace 12 m/s at most (gig-pay.js typical), less for a slow one (67% of its top).
export const TOP_SPEED=freeze({worktruck:17.9,offroad:26.8,shortbed:29,flatbed:15.6,atv:15.6});
export const TYPICAL_FRACTION=.67;
export const truckMetresPerMin=model=>{const top=TOP_SPEED[model]??TOP_SPEED[STARTER_TRUCK];return Math.min(TYPICAL_M_PER_GAME_MIN.vehicle,top*TYPICAL_FRACTION/GAME_MIN_PER_REAL_SEC)};
export const knownTruck=model=>typeof model==='string'&&Object.prototype.hasOwnProperty.call(BED_PLANKS,model);
export const planksPerLoad=model=>BED_PLANKS[knownTruck(model)?model:STARTER_TRUCK];

// ---- 4. pay per step, whole cents
// MEASURED (copied from the live code, the test cross-checks): shift.js PIECE_PAY trees 300 (a marked pine felled on a Ridgeline shift), logs 25 (stacked at the landing), delivered 100 (a plank at the lumberyard), racks 500 (a full rack cell), deliveries 2500 (an order).
export const OLD_PAY=freeze({fellTree:300,landingLog:25,gatheredLog:25,lumberyardPlank:100, // lumberyardPlank: the LEGACY number: the live pay is PAY.plankDelivered 730 since the quest rework (shift.js PIECE_PAY.delivered); wage-rule comparisons below keep the old job as it was
 rackCell:500,orderDelivery:2500,orderPick:800});
// The chain's pay. fellTree stays 300 (existing, needs a clocked-in Ridgeline shift and a marked pine). The three new ones are PLACEHOLDERS tuned by tests/plank-economy.mjs to the wage rule:
export const PAY=freeze({
 fellTree:OLD_PAY.fellTree,        // MEASURED, unchanged
 logToSaw:120,                     // PLACEHOLDER: a log carried to the saw and fed in (replaces the landing's 25 for a log that goes to the saw)
 plankOffBelt:25,                  // PLACEHOLDER: per plank taken off the belt (a stack of 4 = 100)
 plankDelivered:730,               // PLACEHOLDER: per plank handed over at the warehouse/order (replaces the lumberyard's 100): 81% of the 900 world price. Tuned: the smallest round-ish value that puts the level 1 cycle 20%+ above the best existing job
 rackCell:OLD_PAY.rackCell         // MEASURED, unchanged ($5 per full cell of 40 once per shift)
});
export const PAY_PER_PLANK_AT_PRICE_PCT=95;   // SANE LIMIT (the test pins it): all steps together may pay at most this share of the world price of a plank, or the goods are worth less than the labour. At 900 c the rule needs about 91%; a higher plank price (world-goods.js baseCents, ASSUMED there) would give room
export const WAGE_MARGIN_PCT=20;              // owner rule: at least this much above the best existing hands-on job (the test requires it at level 1)
export const WAGE_LEVELS_REQUIRED=freeze([1]);   // the rule is pinned at level 1 (owner spec). At levels 3+ the old 300 c a tree felling job gets faster (fewer swings) and beats the chain: see the P-A report

// ---- 5. the cycle for one truck load, by hand
const STEP_LABELS=freeze({fell:'Fell and cut the pines',logs:'Carry the logs to the saw and feed them',saw:'Run the saw',belt:'Take the planks off the belt and load the truck',drive:'Drive to the warehouse and back',unload:'Unload and hand the order over'});
export const cycleEarnings=(level,truckModel)=>{
 const lv=clampInt(level,1,20,1),model=knownTruck(truckModel)?truckModel:STARTER_TRUCK,planks=planksPerLoad(model);
 const logs=Math.ceil(planks/LOGS_TO_PLANKS),trees=Math.ceil(logs/logsPerTree(lv));
 const hits=hitsFor('axe',lv),swingMin=hits*swingTime(lv)*GAME_MIN_PER_REAL_SEC;
 const fellMin=trees*(swingMin+TREE_GAP_M/WALK_M_MIN);
 const logMin=logs*(INTERACT_MIN+TREE_TO_SAW_M/LOG_CARRY_M_MIN+INTERACT_MIN+TREE_TO_SAW_M/WALK_M_MIN);
 const sawMin=logs*SAW_MIN_PER_LOG;
 const stacks=Math.ceil(planks/PLANKS_PER_STACK);
 const beltMin=stacks*(INTERACT_MIN+BELT_TO_TRUCK_M/PLANK_CARRY_M_MIN+INTERACT_MIN+BELT_TO_TRUCK_M/WALK_M_MIN);
 const driveMin=2*(ROAD_M/truckMetresPerMin(model)+DRIVE_FIDDLE_MIN);
 const unloadMin=stacks*(INTERACT_MIN+DOCK_M/PLANK_CARRY_M_MIN+INTERACT_MIN+DOCK_M/WALK_M_MIN)+HANDOVER_MIN;
 const cells=Math.floor(planks/RACK_CELL_PLANKS);
 const steps=[
  {id:'fell',label:STEP_LABELS.fell,count:trees,unit:'trees',minutes:fellMin,cents:trees*PAY.fellTree},
  {id:'logs',label:STEP_LABELS.logs,count:logs,unit:'logs',minutes:logMin,cents:logs*PAY.logToSaw},
  {id:'saw',label:STEP_LABELS.saw,count:logs,unit:'logs',minutes:sawMin,cents:0},
  {id:'belt',label:STEP_LABELS.belt,count:planks,unit:'planks',minutes:beltMin,cents:planks*PAY.plankOffBelt},
  {id:'drive',label:STEP_LABELS.drive,count:1,unit:'trips',minutes:driveMin,cents:0},
  {id:'unload',label:STEP_LABELS.unload,count:planks,unit:'planks',minutes:unloadMin,cents:planks*PAY.plankDelivered+cells*PAY.rackCell}
 ].map(s=>({...s,minutes:round1(s.minutes)}));
 const minutes=round1(steps.reduce((t,s)=>t+s.minutes,0)),cents=steps.reduce((t,s)=>t+s.cents,0);
 return {level:lv,truck:model,planks,logs,trees,cents,minutes,centsPerHour:minutes>0?Math.round(cents*60/minutes):0,centsPerPlank:planks?Math.round(cents/planks):0,steps};
};
// The wage of the by-hand chain, cents per game hour (the number the rule compares).
export const hourlyWage=(level,truckModel)=>cycleEarnings(level,truckModel).centsPerHour;

// ---- 6. every existing hands-on job, in cents per game hour (the rule's comparison table)
// MEASURED: careers wages (map-definition.js employers[ridgeline].ranks wage + needs.level), the cafe shift (cafe-job.js: $24, stages order 10 + brew 10 + serve 10 + clean 15 minutes, two customers), the old odd-job routes (jobs.js ROUTES).
export const RIDGELINE_RANKS=freeze([freeze({id:'trainee',level:1,wage:800}),freeze({id:'feller',level:3,wage:1000}),freeze({id:'hauler',level:5,wage:1200}),freeze({id:'yard-hand',level:7,wage:1400}),freeze({id:'sawyer',level:10,wage:1600}),freeze({id:'foreman',level:15,wage:1800})]);
export const wageAt=level=>{let w=0;for(const r of RIDGELINE_RANKS)if(r.level<=level)w=r.wage;return w};
export const CAFE=freeze({pay:2400,minutes:2*(10+10+10+15)});
export const MARKET_ROUTES=freeze([freeze({name:'18 Oak Street',m:6.3,pay:1200}),freeze({name:'Alder Coffee',m:36.3,pay:1400}),freeze({name:'Oak Street Laundry',m:11.3,pay:1800})]);   // distance from the market door (0,-2) to each drop
export const EXCLUDED_FROM_RULE=freeze({'market-errand':'legacy tutorial errand (jobs.js ROUTES): the drop is 6 to 36 m from the market door, so it pays 12 to 18 dollars for about 2 to 9 game minutes with no cap or cooldown in jobs.js transactJob. Matching it would price the chain at over 20 dollars per game minute. Fix the old job instead (see the P-A report).'});
export const UNMEASURED_JOBS=freeze(['stumps (150 c a stump: no dig time exists)','pick (800 c an order: no time model)','deliver (2500 c an order: needs an order of a stated size)','replant','load (50 c a plank: no customer truck time)']);
export const gigHourly=(mode)=>{ // a gig at the shortest par the board offers, best tip (generosity 3, quality 100, on time)
 const parM=MIN_PAR_M[mode],r=payFor({mode,parM,quality:100,repMul:1,doneToday:0,generosity:3,onTime:true,elapsedMin:1e9}),speed=TYPICAL_M_PER_GAME_MIN[mode],minutes=parM/PAR_SLACK/speed+HANDOVER_MIN;
 return {cents:r.total,minutes:round1(minutes),centsPerHour:Math.round(r.total*60/minutes)};
};
export function existingJobs(level){
 const lv=clampInt(level,1,20,1),out=[];
 const add=(id,label,cents,minutes,extra={})=>out.push({id,label,cents,minutes:round1(minutes),centsPerHour:minutes>0?Math.round(cents*60/minutes):0,inRule:!EXCLUDED_FROM_RULE[id],...extra});
 add('cafe','Cafe shift (Alder Coffee)',CAFE.pay,CAFE.minutes);
 for(const mode of ['walk','vehicle']){const g=gigHourly(mode);add('gig-'+mode,'Gig at the shortest par ('+mode+')',g.cents,g.minutes)}
 {const swingMin=hitsFor('axe',lv)*swingTime(lv)*GAME_MIN_PER_REAL_SEC,treeMin=swingMin+TREE_GAP_M/WALK_M_MIN,wage=wageAt(lv);
  add('ridgeline-fell','Ridgeline: fell marked pines (wage + 300 a tree)',Math.round(treeMin*wage/60)+OLD_PAY.fellTree,treeMin)}
 {const logMin=INTERACT_MIN+TREE_TO_SAW_M/LOG_CARRY_M_MIN+INTERACT_MIN+TREE_TO_SAW_M/WALK_M_MIN,wage=wageAt(lv);
  add('ridgeline-landing','Ridgeline: carry logs to the landing (wage + 25 a log)',Math.round(logMin*wage/60)+OLD_PAY.landingLog,logMin)}
 if(lv>=5){const planks=BED_PLANKS[STARTER_TRUCK],stacks=planks/PLANKS_PER_STACK,wage=wageAt(lv);
  const min=stacks*(INTERACT_MIN+BELT_TO_TRUCK_M/PLANK_CARRY_M_MIN+INTERACT_MIN+BELT_TO_TRUCK_M/WALK_M_MIN)+2*(YARD_ROAD_M/truckMetresPerMin(STARTER_TRUCK)+DRIVE_FIDDLE_MIN)+stacks*(INTERACT_MIN+DOCK_M/PLANK_CARRY_M_MIN+INTERACT_MIN+DOCK_M/WALK_M_MIN);
  add('ridgeline-haul','Ridgeline: haul planks to the lumberyard (wage + 100 a plank)',Math.round(min*wage/60)+planks*OLD_PAY.lumberyardPlank,min)}
 if(lv>=7){const stacks=RACK_CELL_PLANKS/PLANKS_PER_STACK,wage=wageAt(lv),min=stacks*(INTERACT_MIN+DOCK_M*2/PLANK_CARRY_M_MIN+INTERACT_MIN+DOCK_M*2/WALK_M_MIN);
  add('ridgeline-stack','Ridgeline: stack a rack cell (wage + $5 a cell)',Math.round(min*wage/60)+OLD_PAY.rackCell,min)}
 {const m=MARKET_ROUTES,avgPay=m.reduce((t,r)=>t+r.pay,0)/m.length,avgMin=m.reduce((t,r)=>t+2*r.m/WALK_M_MIN+HANDOVER_MIN,0)/m.length;
  add('market-errand','Market errand (jobs.js ROUTES, legacy)',Math.round(avgPay),avgMin)}
 return out;
}
export function bestExisting(level){
 const rule=existingJobs(level).filter(j=>j.inRule);let best=null;for(const j of rule)if(!best||j.centsPerHour>best.centsPerHour)best=j;return best;
}
// The rule at one level: the by-hand cycle must beat the best existing hands-on job by WAGE_MARGIN_PCT.
export function wageRule(level,truckModel){
 const cycle=cycleEarnings(level,truckModel),best=bestExisting(level),needed=Math.ceil(best.centsPerHour*(100+WAGE_MARGIN_PCT)/100);
 return {ok:cycle.centsPerHour>=needed,cycleCentsPerHour:cycle.centsPerHour,bestId:best.id,bestCentsPerHour:best.centsPerHour,neededCentsPerHour:needed,marginPct:best.centsPerHour>0?Math.round((cycle.centsPerHour/best.centsPerHour-1)*100):0,
  payShareOfPricePct:Math.round(cycle.centsPerPlank*100/PLANK_BASE_CENTS)};
}

// ---- 7. the phone's Prices screen (data only; phone.js is edited by the main chat)
export const PRICE_NOTES=freeze({low:'Stock low, price high',high:'Well stocked, price low',normal:'Normal',closed:'No price'});
export const PRICE_LABELS=freeze({sawmill:'Sawmill',supplier:'Eastbank Building Supplier',warehouse:'Ridgeline Warehouse'});
export function priceTable(world,day,minute){
 const d=clampInt(day,0,100000,0),w=normalizeWorld(world,0,d),out=[];
 for(const key of Object.keys(PLANK_PLACES)){
  const place=PLANK_PLACES[key],def=PLACES[place].goods.planks,m=minute===undefined?undefined:clampInt(minute,0,1440,0);
  const price=priceOf(w,place,'planks',m),stock=m===undefined?(w.stock[place].planks||0):stockAt(w,place,'planks',m);
  let note=PRICE_NOTES.normal;
  if(!Number.isFinite(price))note=PRICE_NOTES.closed;
  else if(stock<def.target*LOW_STOCK_FRAC||price>=PLANK_BASE_CENTS*(1+PRICE_BAND_PCT/200)&&stock<def.target)note=PRICE_NOTES.low;
  else if(stock>def.target&&price<PLANK_BASE_CENTS)note=PRICE_NOTES.high;
  out.push({place,key,label:PRICE_LABELS[key],priceCents:Number.isFinite(price)?price:0,stock,target:def.target,note});
 }
 return out;
}
