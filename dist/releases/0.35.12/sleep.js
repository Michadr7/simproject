// Sleeping (0.34, DESIGN 4.14): in single player a night in bed skips the clock forward to 6 AM and costs a little food and drink; in multiplayer the clock never moves (everyone shares the day).
// Pure: the game calls sleepThrough and shows the toast. Time is the routine's minutes of the day; a new day bills rent and delivers parcels through advanceTime and the order clock.
import {advanceTime,normalizeRoutine,formatClock} from './routine.js';
import {normalizeLife,needsEffects} from './life.js';

export const WAKE_MINUTE=360; // 6:00 AM
export const SLEEP_DRAIN_FACTOR=.25; // food and thirst drain at a quarter of the awake rate while you sleep
// Awake drain per real second (life.js tickLife); a game minute is 2 real seconds (the game clock runs 0.5 game minutes per second).
const FOOD_PER_S=.018,THIRST_PER_S=.028,SECONDS_PER_GAME_MINUTE=2;

// Game minutes until the next 6 AM (today's if it is earlier than 6, else tomorrow's). Exactly 6:00 sleeps the whole day.
export function minutesToWake(minutes){const m=Math.floor(minutes);const left=(WAKE_MINUTE-m+1440)%1440;return left===0?1440:left}

// One night: the clock moves to 6 AM, food and thirst drain slowly over the skipped hours (times the testing multiplier), energy is full, and rent/bills run for any new day.
// online = in a multiplayer room: nothing moves but energy. Returns {state, minutes, message}.
export function sleepThrough(state,{online=false,drainMultiplier=1}={}){
 const life=normalizeLife(state.life),rest=Math.max(life.energy,needsEffects(life).energyCap),rested={...state,life:{...life,energy:rest}};
 if(online)return {state:rested,minutes:0,message:'Rested · Energy restored'};
 const minutes=minutesToWake(normalizeRoutine(state.routine).minutes),seconds=minutes*SECONDS_PER_GAME_MINUTE*SLEEP_DRAIN_FACTOR*(Number.isFinite(drainMultiplier)?drainMultiplier:1);
 const next=advanceTime({...rested,life:{...life,energy:rest,food:Math.max(0,life.food-seconds*FOOD_PER_S),thirst:Math.max(0,life.thirst-seconds*THIRST_PER_S)}},minutes);
 const hours=Math.round(minutes/60*10)/10;
 return {state:next,minutes,message:`Rested · ${formatClock(WAKE_MINUTE)} · ${hours} h slept`};
}

// Passing out at 0 energy (DESIGN 4.18): two game hours pass (the clock does not move online: the game holds a 60 s black screen instead), you wake with energy 25,
// and food and thirst drain at the sleep rate meanwhile. Pure; the game moves you to your bed and runs the fade.
export const PASS_OUT_MINUTES=120,PASS_OUT_ENERGY=25,PASS_OUT_ONLINE_SECONDS=60;
export function passOutThrough(state,{online=false,drainMultiplier=1}={}){
 const life=normalizeLife(state.life);
 if(online)return {state:{...state,life:{...life,energy:PASS_OUT_ENERGY}},minutes:0};
 const seconds=PASS_OUT_MINUTES*SECONDS_PER_GAME_MINUTE*SLEEP_DRAIN_FACTOR*(Number.isFinite(drainMultiplier)?drainMultiplier:1);
 const next=advanceTime({...state,life:{...life,energy:PASS_OUT_ENERGY,food:Math.max(0,life.food-seconds*FOOD_PER_S),thirst:Math.max(0,life.thirst-seconds*THIRST_PER_S)}},PASS_OUT_MINUTES);
 return {state:next,minutes:PASS_OUT_MINUTES};
}
