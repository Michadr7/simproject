// sawmill-yard.js: the player-fed sawmill yard (logs waiting, time-based sawing, planks yard stock, daily trickle, stack pickup); implements notes/planks-economy-design.md stage P-B. Pure: no DOM, no three.js, no globals, no Math.random/Date.now.
import {LOGS_TO_PLANKS,PLANKS_PER_STACK,TRICKLE_PER_DAY,SAW_MIN_PER_LOG} from './plank-economy.js';
export {LOGS_TO_PLANKS,PLANKS_PER_STACK,TRICKLE_PER_DAY,SAW_MIN_PER_LOG};

const freeze=Object.freeze;
export const YARD_VERSION=1;
export const YARD_MAX_LOGS=40; // PLACEHOLDER: max logs waiting at the sawmill bench (40 logs = 160 planks)
export const YARD_MAX_PLANKS=160; // PLACEHOLDER: max planks in the sawmill yard stock (matches world-goods.js sawmill max 160 = 40 stacks)
export const YARD_CAPACITY=YARD_MAX_PLANKS; // PLACEHOLDER: alias for yard plank capacity

const clampInt=(v,lo,hi,d)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
const TIME_GRID=792000; // common multiple of 30, 60, 120, 144, 165, 240, 360, 720, 1000 steps per game min
const snapTime=x=>{if(!Number.isFinite(x)||x<=0)return 0;const g=Math.round(x*TIME_GRID);if(Math.abs(x*TIME_GRID-g)<1e-6){const v=g/TIME_GRID,d=Math.round(v*1e6)/1e6;return Math.abs(v-d)<1e-9?d:v}return x};

export function freshYard(){
 return freeze({v:YARD_VERSION,logs:0,logsSawn:0,planks:0,cutMin:0,on:false,lastTrickleDay:0});
}

// Any saved yard or junk -> a valid frozen yard state (old versions and partial saves load cleanly).
export function normalizeYard(raw){
 const top=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 const r=top.state&&typeof top.state==='object'&&!Array.isArray(top.state)?top.state:top;
 const logs=clampInt(r.logs!==undefined?r.logs:r.logsWaiting,0,YARD_MAX_LOGS,0);
 const logsSawn=clampInt(r.logsSawn,0,1e9,0);
 const planks=clampInt(r.planks!==undefined?r.planks:r.stock,0,YARD_MAX_PLANKS,0);
 const lastTrickleDay=clampInt(r.lastTrickleDay,0,100000,0);
 const cutMin=logs>0&&planks<YARD_MAX_PLANKS&&Number.isFinite(r.cutMin)&&r.cutMin>0&&r.cutMin<SAW_MIN_PER_LOG?snapTime(r.cutMin):0;
 const on=logs===0||planks>=YARD_MAX_PLANKS?false:typeof r.on==='boolean'?r.on:logs>0;
 return freeze({v:YARD_VERSION,logs,logsSawn,planks,cutMin,on,lastTrickleDay});
}

// Toggle or set the saw switch; refuses to stay on with no logs or a full yard.
export function switchSaw(state,want){
 const s=normalizeYard(state);
 const rawOn=want===undefined?!s.on:Boolean(want);
 const on=rawOn&&s.logs>0&&s.planks<YARD_MAX_PLANKS;
 if(on===s.on)return s;
 return freeze({...s,on});
}

// Feed whole logs into the sawmill bench up to YARD_MAX_LOGS; turns the saw on when space remains in the yard.
export function feed(state,logs=1){
 const s=normalizeYard(state);
 if(!Number.isFinite(logs)||Math.floor(logs)<=0)return freeze({state:s,accepted:0,refused:0});
 const want=Math.min(1e9,Math.floor(logs)),room=Math.max(0,YARD_MAX_LOGS-s.logs);
 const accepted=Math.min(want,room),refused=want-accepted;
 const next=accepted>0?freeze({...s,logs:s.logs+accepted,on:s.planks<YARD_MAX_PLANKS}):s;
 return freeze({state:next,accepted,refused});
}

// Advance sawing by dtGameMin game minutes (frame-rate independent; 1 log = LOGS_TO_PLANKS planks).
export function tick(state,dtGameMin){
 const s=normalizeYard(state);
 if(!Number.isFinite(dtGameMin)||dtGameMin<=0||!s.on||s.logs<=0||s.planks>=YARD_MAX_PLANKS)return s;
 const total=snapTime(s.cutMin+Math.min(dtGameMin,1e9));
 const byTime=Math.floor((total+1e-9)/SAW_MIN_PER_LOG);
 const roomLogs=Math.ceil((YARD_MAX_PLANKS-s.planks)/LOGS_TO_PLANKS);
 const done=Math.min(s.logs,roomLogs,byTime);
 const logs=s.logs-done,logsSawn=Math.min(1e9,s.logsSawn+done);
 const planks=Math.min(YARD_MAX_PLANKS,s.planks+done*LOGS_TO_PLANKS);
 const active=logs>0&&planks<YARD_MAX_PLANKS;
 const cutMin=active?snapTime(Math.max(0,total-done*SAW_MIN_PER_LOG)):0;
 return freeze({v:YARD_VERSION,logs,logsSawn,planks,cutMin,on:active,lastTrickleDay:s.lastTrickleDay});
}

// Take up to one stack (PLANKS_PER_STACK = 4) from the yard stock.
export function takeStack(state){
 const s=normalizeYard(state);
 const taken=Math.min(PLANKS_PER_STACK,s.planks),planks=s.planks-taken;
 const next=taken>0?freeze({...s,planks}):s;
 return freeze({state:next,planks:taken});
}

// Apply the daily town trickle (TRICKLE_PER_DAY = 6) once per game day, idempotent for the same day.
export function trickle(state,day){
 const s=normalizeYard(state);
 if(!Number.isFinite(day))return s;
 const d=Math.min(100000,Math.floor(day));
 if(d<1||d<=s.lastTrickleDay)return s;
 const planks=Math.min(YARD_MAX_PLANKS,s.planks+TRICKLE_PER_DAY);
 const active=s.on&&s.logs>0&&planks<YARD_MAX_PLANKS;
 return freeze({v:YARD_VERSION,logs:s.logs,logsSawn:s.logsSawn,planks,cutMin:active?s.cutMin:0,on:active,lastTrickleDay:d});
}

// Snapshot for a future sawmill yard UI.
export function summarize(state){
 const s=normalizeYard(state);
 return freeze({
  v:s.v,logs:s.logs,logsWaiting:s.logs,logsSawn:s.logsSawn,planks:s.planks,
  stacks:Math.floor(s.planks/PLANKS_PER_STACK),loosePlanks:s.planks%PLANKS_PER_STACK,
  canTake:s.planks>0,canTakeStack:s.planks>=PLANKS_PER_STACK,canFeed:s.logs<YARD_MAX_LOGS,
  logSpace:YARD_MAX_LOGS-s.logs,plankSpace:YARD_MAX_PLANKS-s.planks,
  on:s.on,cutMin:s.cutMin,
  cutProgress:s.logs>0?Math.min(1,+(s.cutMin/SAW_MIN_PER_LOG).toFixed(6)):0,
  minutesLeft:s.logs>0?snapTime(s.logs*SAW_MIN_PER_LOG-s.cutMin):0,
  lastTrickleDay:s.lastTrickleDay
 });
}
