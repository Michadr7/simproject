// sawmill-yard.js: the player-fed sawmill yard v2 (logs and trunks waiting, time-based sawing into planks and slabs, yard stock, daily trickle, pickup); implements planks-economy-design.md stage P-B and timber-redesign-design.md stage T-B. Pure: no DOM, no three.js, no globals, no Math.random/Date.now.
import {LOGS_TO_PLANKS,PLANKS_PER_STACK,TRICKLE_PER_DAY,SAW_MIN_PER_LOG,SAW_MIN_PER_TRUNK,TRUNK_TO_SLABS} from './plank-economy.js';
export {LOGS_TO_PLANKS,PLANKS_PER_STACK,TRICKLE_PER_DAY,SAW_MIN_PER_LOG,SAW_MIN_PER_TRUNK,TRUNK_TO_SLABS};

const freeze=Object.freeze;
export const YARD_VERSION=2; // v1 (logs, planks) loads as v2 with no trunks and no slabs
export const YARD_MAX_LOGS=40; // PLACEHOLDER: max logs waiting at the sawmill bench (40 logs = 160 planks)
export const YARD_MAX_TRUNKS=20; // trunks waiting for the saw (20 trunks = 40 slabs)
export const YARD_MAX_PLANKS=160; // PLACEHOLDER: max planks in the sawmill yard stock (matches world-goods.js sawmill max 160 = 40 stacks)
export const YARD_MAX_SLABS=80; // slabs in the yard stock
export const YARD_CAPACITY=YARD_MAX_PLANKS; // PLACEHOLDER: alias for yard plank capacity

const clampInt=(v,lo,hi,d)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const TIME_GRID=792000; // common multiple of 30, 60, 120, 144, 165, 240, 360, 720, 1000 steps per game min
const snapTime=x=>{if(!Number.isFinite(x)||x<=0)return 0;const g=Math.round(x*TIME_GRID);if(Math.abs(x*TIME_GRID-g)<1e-6){const v=g/TIME_GRID,d=Math.round(v*1e6)/1e6;return Math.abs(v-d)<1e-9?d:v}return x};
const NEED=kind=>kind==='trunk'?SAW_MIN_PER_TRUNK:SAW_MIN_PER_LOG;
const canCut=(s,kind)=>kind==='trunk'?s.trunks>0&&s.slabs<YARD_MAX_SLABS:kind==='log'?s.logs>0&&s.planks<YARD_MAX_PLANKS:false;
const anyCut=s=>canCut(s,'log')||canCut(s,'trunk');
const make=(o)=>freeze({v:YARD_VERSION,trunks:o.trunks,logs:o.logs,trunksSawn:o.trunksSawn,logsSawn:o.logsSawn,planks:o.planks,slabs:o.slabs,cutMin:o.cutMin,cutKind:o.cutKind,on:o.on,lastTrickleDay:o.lastTrickleDay});

export function freshYard(){
 return make({trunks:0,logs:0,trunksSawn:0,logsSawn:0,planks:0,slabs:0,cutMin:0,cutKind:null,on:false,lastTrickleDay:0});
}

// Any saved yard or junk -> a valid frozen yard state (old versions and partial saves load cleanly).
export function normalizeYard(raw){
 const top=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const r=top.state&&typeof top.state==='object'&&!Array.isArray(top.state)?top.state:top;
 const logs=clampInt(r.logs!==undefined?r.logs:r.logsWaiting,0,YARD_MAX_LOGS,0);
 const trunks=clampInt(r.trunks,0,YARD_MAX_TRUNKS,0);
 const logsSawn=clampInt(r.logsSawn,0,1e9,0),trunksSawn=clampInt(r.trunksSawn,0,1e9,0);
 const planks=clampInt(r.planks!==undefined?r.planks:r.stock,0,YARD_MAX_PLANKS,0);
 const slabs=clampInt(r.slabs,0,YARD_MAX_SLABS,0);
 const lastTrickleDay=clampInt(r.lastTrickleDay,0,100000,0);
 const base={trunks,logs,trunksSawn,logsSawn,planks,slabs,lastTrickleDay};
 const kind=r.cutKind==='trunk'?'trunk':'log';
 const cutKind=Number.isFinite(r.cutMin)&&r.cutMin>0&&r.cutMin<NEED(kind)&&canCut(base,kind)?kind:null;
 const cutMin=cutKind?snapTime(r.cutMin):0;
 const on=!anyCut(base)?false:typeof r.on==='boolean'?r.on:true;
 return make({...base,cutMin,cutKind,on});
}

// Toggle or set the saw switch; refuses to stay on with nothing to cut or a full yard.
export function switchSaw(state,want){
 const s=normalizeYard(state);
 const rawOn=want===undefined?!s.on:Boolean(want);
 const on=rawOn&&anyCut(s);
 if(on===s.on)return s;
 return make({...s,on});
}

// Feed whole logs (or trunks) into the sawmill bench up to the cap; turns the saw on when the yard has room.
export function feed(state,count=1,kind='log'){
 const s=normalizeYard(state),trunk=kind==='trunk';
 if(!Number.isFinite(count)||Math.floor(count)<=0)return freeze({state:s,accepted:0,refused:0});
 const want=Math.min(1e9,Math.floor(count)),room=Math.max(0,(trunk?YARD_MAX_TRUNKS-s.trunks:YARD_MAX_LOGS-s.logs));
 const accepted=Math.min(want,room),refused=want-accepted;
 if(accepted<=0)return freeze({state:s,accepted,refused});
 const grown={...s,...(trunk?{trunks:s.trunks+accepted}:{logs:s.logs+accepted})};
 return freeze({state:make({...grown,on:anyCut(grown)}),accepted,refused});
}

// Advance sawing by dtGameMin game minutes (frame-rate independent). 1 log = LOGS_TO_PLANKS planks in SAW_MIN_PER_LOG; 1 trunk = TRUNK_TO_SLABS slabs in SAW_MIN_PER_TRUNK. Logs are cut first, then trunks; a cut in progress is finished first.
export function tick(state,dtGameMin){
 const s=normalizeYard(state);
 if(!Number.isFinite(dtGameMin)||dtGameMin<=0||!s.on||!anyCut(s))return s;
 let {trunks,logs,trunksSawn,logsSawn,planks,slabs}=s,kind=s.cutKind,t=snapTime(s.cutMin+Math.min(dtGameMin,1e9));
 for(let guard=0;guard<2000;guard++){
  if(!kind||!canCut({trunks,logs,planks,slabs},kind))kind=canCut({trunks,logs,planks,slabs},'log')?'log':canCut({trunks,logs,planks,slabs},'trunk')?'trunk':null;
  if(!kind)break;
  const need=NEED(kind);if(t+1e-9<need)break;
  t=snapTime(Math.max(0,t-need));
  if(kind==='log'){logs--;logsSawn=Math.min(1e9,logsSawn+1);planks=Math.min(YARD_MAX_PLANKS,planks+LOGS_TO_PLANKS)}
  else{trunks--;trunksSawn=Math.min(1e9,trunksSawn+1);slabs=Math.min(YARD_MAX_SLABS,slabs+TRUNK_TO_SLABS)}
  kind=null;
 }
 const rest={trunks,logs,trunksSawn,logsSawn,planks,slabs,lastTrickleDay:s.lastTrickleDay},active=anyCut(rest);
 if(active&&!kind)kind=canCut(rest,'log')?'log':'trunk';
 return make({...rest,cutMin:active&&t>0?snapTime(t):0,cutKind:active&&t>0?kind:null,on:active});
}

// Take up to one stack (PLANKS_PER_STACK = 4) from the yard stock.
export function takeStack(state){
 const s=normalizeYard(state);
 const taken=Math.min(PLANKS_PER_STACK,s.planks),planks=s.planks-taken;
 const next=taken>0?make({...s,planks}):s;
 return freeze({state:next,planks:taken});
}

// Take one slab from the yard stock.
export function takeSlab(state){
 const s=normalizeYard(state),taken=s.slabs>0?1:0;
 return freeze({state:taken?make({...s,slabs:s.slabs-1}):s,slabs:taken});
}

// Put carried boards or slabs back into the yard stock (kept in the lumber hut, lumber-hut.js) up to the cap; what does not fit stays in the hands (left).
export function storeInYard(state,count,kind='planks'){
 const s=normalizeYard(state),slab=kind==='slab',want=Number.isFinite(count)?Math.max(0,Math.floor(count)):0,room=slab?YARD_MAX_SLABS-s.slabs:YARD_MAX_PLANKS-s.planks,stored=Math.min(want,room);
 return freeze({state:stored?make({...s,...(slab?{slabs:s.slabs+stored}:{planks:s.planks+stored})}):s,stored,left:want-stored});
}

// Apply the daily town trickle (TRICKLE_PER_DAY = 6) once per game day, idempotent for the same day.
export function trickle(state,day){
 const s=normalizeYard(state);
 if(!Number.isFinite(day))return s;
 const d=Math.min(100000,Math.floor(day));
 if(d<1||d<=s.lastTrickleDay)return s;
 const planks=Math.min(YARD_MAX_PLANKS,s.planks+TRICKLE_PER_DAY),next={...s,planks,lastTrickleDay:d},active=s.on&&anyCut(next);
 return make({...next,cutMin:active?s.cutMin:0,cutKind:active?s.cutKind:null,on:active});
}

// Snapshot for the sawmill yard UI.
export function summarize(state){
 const s=normalizeYard(state),cutNeed=NEED(s.cutKind||(s.logs>0||s.trunks===0?'log':'trunk'));
 return freeze({
  v:s.v,logs:s.logs,logsWaiting:s.logs,logsSawn:s.logsSawn,planks:s.planks,
  trunks:s.trunks,trunksSawn:s.trunksSawn,slabs:s.slabs,
  stacks:Math.floor(s.planks/PLANKS_PER_STACK),loosePlanks:s.planks%PLANKS_PER_STACK,
  canTake:s.planks>0,canTakeStack:s.planks>=PLANKS_PER_STACK,canTakeSlab:s.slabs>0,canFeed:s.logs<YARD_MAX_LOGS,canFeedTrunk:s.trunks<YARD_MAX_TRUNKS,
  logSpace:YARD_MAX_LOGS-s.logs,trunkSpace:YARD_MAX_TRUNKS-s.trunks,plankSpace:YARD_MAX_PLANKS-s.planks,slabSpace:YARD_MAX_SLABS-s.slabs,
  on:s.on,cutMin:s.cutMin,cutKind:s.cutKind,
  cutProgress:s.logs+s.trunks>0?Math.min(1,+(s.cutMin/cutNeed).toFixed(6)):0,
  minutesLeft:s.logs+s.trunks>0?snapTime(s.logs*SAW_MIN_PER_LOG+s.trunks*SAW_MIN_PER_TRUNK-s.cutMin):0,
  lastTrickleDay:s.lastTrickleDay
 });
}