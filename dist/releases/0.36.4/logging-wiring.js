// logging-wiring.js: pure rules for playing the logging sounds in the game (forest ambience gain with hysteresis, seeded creak gate, log thud size); implements notes/eval/outbox/logging-sounds.md wiring request.
import {LOGGING_FILES,FOREST_AMBIENCE,LOGGING_LOOPS,LOGGING_MIX} from './logging-sounds.js';
const clamp01=v=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0;

export const FOREST={fullM:10,startM:36,stopM:44,fadeS:1.5,duckVehicle:.4,duckTalk:.55,quietIndoors:0};
export const CREAK={minS:16,maxS:38,workMinS:7,workMaxS:15,minProx:.25,seed:20261119,scale:1};
// The one-shot clips (everything but the loop): fetched together the first time a logging sound is wanted.
export const LOGGING_ONESHOT_FILES=Object.freeze(LOGGING_FILES.filter(f=>f!==FOREST_AMBIENCE.pines));

// 1 within fullM metres of the nearest standing tree, 0 beyond stopM, smooth between (smoothstep). Always in [0,1].
export function forestProximity(distM){
 if(!Number.isFinite(distM))return 0;
 const t=clamp01((FOREST.stopM-distM)/(FOREST.stopM-FOREST.fullM));
 return t*t*(3-2*t);
}
// Hysteresis so the loop does not flutter at the edge: it starts inside startM and stops beyond stopM. state {on}; returns the proximity target (0 when off or indoors).
export function forestTarget(state,distM,outdoors=true){
 if(!outdoors||!Number.isFinite(distM)){state.on=false;return 0}
 if(state.on){if(distM>=FOREST.stopM)state.on=false}else if(distM<=FOREST.startM)state.on=true;
 return state.on?forestProximity(distM):0;
}
// Final loop gain (bounded): level of the loop * proximity * duck (duck 1 = none). Never above the loop's registry level.
export function forestLoopGain(prox,duck=1,level=LOGGING_LOOPS.forestPines.level){
 return +(Math.max(0,level)*clamp01(prox)*clamp01(duck)).toFixed(4);
}
// How far the loop is ducked: 1 free, lower under an engine (driving or forklift), lower still... the lowest of the two wins.
export function forestDuck({vehicle=false,talking=false}={}){return Math.min(vehicle?FOREST.duckVehicle:1,talking?FOREST.duckTalk:1)}

// A seeded timer gate for wood creaks: tick(dt seconds, prox 0..1, working) returns true when one should play. Frame-rate independent (it only adds dt), rare, never random per frame.
export function createCreakGate(seed=CREAK.seed){
 let s=(seed>>>0)||1,wait=0;
 const rnd=()=>(s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296;
 const draw=working=>{const lo=working?CREAK.workMinS:CREAK.minS,hi=working?CREAK.workMaxS:CREAK.maxS;return lo+rnd()*(hi-lo)};
 wait=draw(false);
 return {
  tick(dt,prox,working=false){
   if(!(dt>0)||clamp01(prox)<CREAK.minProx)return false;
   wait-=Math.min(dt,.5);
   if(wait>0)return false;
   wait=draw(working);return true;
  },
  get wait(){return wait}
 };
}
// Size of the thud when logs/trunk hit the ground: a felled trunk by its log count, a carried log set down is medium.
export function thudSizeForLogs(count){return count>=4?'heavy':count>=2?'medium':'small'}
export const CREAK_LEVEL=LOGGING_MIX.woodCreak;
