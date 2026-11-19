// busyness.js: how busy the town looks outdoors, 0..1, from the weather, the time of day and the day of the week (notes/npc-movement-design.md section 6 decision 3, stage N2). Pure: no clock, no chance; the same for every co-op client given the host's day and weather.
// busyness({weather, minute, weekday}) = WEATHER x TIME x WEEKDAY, each 0..1. 1 is a fine weekend midday. Two things use it:
//   outdoorShare(b)  the share of the optional outdoor blocks (strolls, sitting out) that a person takes: OUTDOOR_FLOOR + (1 - OUTDOOR_FLOOR) x b. schedule.js asks it per person per block with a hash roll (dayPlan ctx.weather turns it on).
//   crowdPool(b, pool) how many of the pool's characters the crowd may add: at least MIN_POOL, scaled between POOL_FLOOR x pool and pool. People already drawn stay until they leave (nobody pops out).
// The draw radius (npc-crowd.js DRAW_RADIUS 120 m) and the pool size (POOL 9) are NOT changed here.
// weather: a word ('clear' ... 'storm', unknown words count as 'overcast') or a number 0..2 (wind.js: calm 0, storm 2). weekday: a day number from 1 (Monday, as housing.js weekday(day)) or a name.
export const WEATHER_FACTOR=Object.freeze({clear:1,sunny:1,partly:.85,cloudy:.8,overcast:.7,fog:.6,wind:.6,drizzle:.45,rain:.3,snow:.3,storm:.1});
export const TIME_CURVE=Object.freeze([[0,.05],[360,.1],[480,.7],[600,1],[1020,1],[1140,.6],[1260,.25],[1380,.1],[1440,.05]]); // [minute, factor], linear between
export const WEEKDAY_FACTOR=Object.freeze([.9,.9,.9,.9,.95,1,1]); // Monday to Sunday
export const OUTDOOR_FLOOR=.1;  // even in a storm at night a tenth of the optional outdoor blocks still happen
export const POOL_FLOOR=.4;     // the share of the pool a dead-quiet moment still allows
export const MIN_POOL=3;
const NAMES=['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

export function weatherFactor(weather){
 if(typeof weather==='number'&&Number.isFinite(weather)){const w=clamp(weather,0,2);return w<=1?1-.7*w:.3-.2*(w-1)} // 0 calm = 1, 1 = .3 (rain), 2 storm = .1
 const f=WEATHER_FACTOR[String(weather).toLowerCase()];return f===undefined?WEATHER_FACTOR.overcast:f;
}
export function timeFactor(minute){
 const m=((Number(minute)||0)%1440+1440)%1440;
 for(let i=1;i<TIME_CURVE.length;i++){const [m1,v1]=TIME_CURVE[i];if(m<=m1){const [m0,v0]=TIME_CURVE[i-1];return v0+(v1-v0)*(m-m0)/(m1-m0)}}
 return TIME_CURVE[TIME_CURVE.length-1][1];
}
export function weekdayFactor(weekday){
 if(typeof weekday==='string'){const i=NAMES.indexOf(weekday.toLowerCase());return i<0?WEEKDAY_FACTOR[0]:WEEKDAY_FACTOR[i]}
 const d=Math.floor(Number(weekday));return Number.isFinite(d)?WEEKDAY_FACTOR[(((d-1)%7)+7)%7]:WEEKDAY_FACTOR[0];
}
export const busyness=({weather='clear',minute=720,weekday=1}={})=>clamp(weatherFactor(weather)*timeFactor(minute)*weekdayFactor(weekday),0,1);
export const outdoorShare=b=>OUTDOOR_FLOOR+(1-OUTDOOR_FLOOR)*clamp(Number(b)||0,0,1);
// roll: a 0..1 number from a hash (the caller's), so the choice is a function of person and day only
export const takesOutdoor=(b,roll)=>roll<outdoorShare(b);
export const crowdPool=(b,pool)=>{const n=Math.max(0,Math.floor(pool)),k=POOL_FLOOR+(1-POOL_FLOOR)*clamp(Number(b)||0,0,1);return Math.min(n,Math.max(Math.min(MIN_POOL,n),Math.round(n*k)))};
