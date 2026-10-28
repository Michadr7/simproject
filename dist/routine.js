import {hoursOf} from './map-definition.js';
import {advanceHousingDays} from './housing.js';
export const freshRoutine=()=>({minutes:540,earned:0,shiftStep:0,shiftDay:0});
export function normalizeRoutine(v={}){const r=freshRoutine();for(const k of Object.keys(r))if(Number.isFinite(v?.[k])&&v[k]>=0)r[k]=v[k];r.minutes=Math.min(1439,r.minutes);r.shiftStep=Math.min(3,Math.floor(r.shiftStep));return r}
// 12-hour clock with AM / PM: 540 -> "9:00 AM", 1380 -> "11:00 PM".
export function formatClock(minutes){const total=Math.floor(minutes)%1440,hour=Math.floor(total/60);return `${hour%12||12}:${String(total%60).padStart(2,'0')} ${hour<12?'AM':'PM'}`}
export const clockText=r=>formatClock(r.minutes);
// Opening hours come from the map (map-definition.js): open from `opens` up to, not including, `closes`.
export const shopOpen=(kind,r)=>{const [opens,closes]=hoursOf(kind);return r.minutes>=opens&&r.minutes<closes};
const hourLabel=minutes=>{const hour=Math.floor(minutes/60),rest=minutes%60;return `${hour%12||12}${rest?':'+String(rest).padStart(2,'0'):''} ${hour<12||hour===24?'AM':'PM'}`};
// "7 AM–10 PM"
export const hoursText=kind=>{const [opens,closes]=hoursOf(kind);return `${hourLabel(opens)}–${hourLabel(closes)}`};
export function advanceTime(s,minutes){const r=normalizeRoutine(s.routine),total=r.minutes+minutes,days=Math.floor(total/1440);return {...s,routine:{...r,minutes:total%1440,earned:days?0:r.earned},housing:days?advanceHousingDays(s.housing,days):s.housing}}
export const SHIFT_TASKS=[{name:'Wipe the table',x:-3.8,z:1},{name:'Restock cups',x:3.8,z:-2.3},{name:'Finish at the counter',x:0,z:-2}];
export function shiftAction(s,position,place){const r=normalizeRoutine(s.routine);if(place!=='cafe'||!shopOpen('cafe',r))return {error:'Café work is available 8 AM–6 PM.'};if(r.shiftDay===s.housing.day)return {error:'Your shift is finished for today.'};const task=SHIFT_TASKS[r.shiftStep];if(!task||Math.hypot(position.x-task.x,position.z-task.z)>1.7)return {error:'Move to the current work station.'};let next=advanceTime({...s,routine:{...r,shiftStep:r.shiftStep+1}},30);if(r.shiftStep===2){next.cash+=2400;next.routine={...next.routine,shiftStep:0,shiftDay:next.housing.day,earned:next.routine.earned+2400};return {state:next,message:'Shift complete · $24.00 earned.'}}return {state:next,message:'Task complete · 30 game minutes passed.'}}
