// gig-pay.js: pure gig pay rules (par distance, per-metre rate, handling fee, daily fatigue, tip, minimum time); implements notes/gig-overhaul-design.md (Rules and Anti-cheese). No DOM, no globals, integer cents.
// Tunable defaults (the owner's 5 questions, recommended answers):
export const TARGET_C_PER_GAME_MIN=Object.freeze({walk:20,vehicle:30}); // 20 c per game minute = $12 per game hour (between job ranks 2 and 3)
export const HANDLING_C=Object.freeze({walk:150,vehicle:400});
export const MIN_PAR_M=Object.freeze({walk:300,vehicle:500}); // the board never offers a shorter par (walk 150 m paid about 1740 c/game hour, too close to the job wage: owner-approved 300 m, G-B)
export const PAR_SLACK=1.2;
// Speeds in metres per GAME minute. Game clock: 0.5 game minutes per real second (game.js:1445 advanceTime(P,step*.5)), so 1 game minute = 2 real seconds.
// Walk 4.5 m/s (game.js:1505) = 9 m per game minute; sprint 8.2 m/s (game.js:1505) = 16.4.
// Vehicles (G-B check): the fastest road class is the shortbed, top 29 m/s (vehicle.js:30); worktruck 17.9 (vehicle.js:28), offroad 26.8 (vehicle.js:31), flatbed 15.6, ATV 15.6 (vehicle.js:29,33), tractors 6.3/7.2. So the too-fast floor is 29 m/s (was assumed 40, unreachable).
// Typical 12 m/s stays: below the worktruck's 17.9 top because of corners, acceleration (0 to top in several seconds) and stops.
export const GAME_MIN_PER_REAL_SEC=.5;
export const WALK_M_PER_GAME_MIN=4.5/GAME_MIN_PER_REAL_SEC; // 9
export const FASTEST_M_PER_GAME_MIN=Object.freeze({walk:8.2/GAME_MIN_PER_REAL_SEC,vehicle:29/GAME_MIN_PER_REAL_SEC});
export const TYPICAL_M_PER_GAME_MIN=Object.freeze({walk:WALK_M_PER_GAME_MIN,vehicle:12/GAME_MIN_PER_REAL_SEC});
// Fatigue by number of gigs already done this game day (the 1st to 5th gig is doneToday 0..4).
export const FATIGUE_TIERS=Object.freeze([Object.freeze({upTo:5,pct:100}),Object.freeze({upTo:8,pct:70}),Object.freeze({upTo:10,pct:40})]);
export const MAX_GIGS_PER_DAY=10;
export const TIP_PER_GENEROSITY_PCT=10; // generosity 0..3 gives 0/10/20/30 percent of pay before the cap
export const TIP_CAP_PCT=25;
export const TIP_FULL_QUALITY=90,TIP_HALF_QUALITY=70;
const modeOf=m=>m==='vehicle'?'vehicle':'walk';
const clampInt=(v,lo,hi,d)=>Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.floor(v))):d;
// Shortest route through the ordered points ({x,z}) times PAR_SLACK, rounded up to whole metres.
export function parMetres(points){
 if(!Array.isArray(points))return 0;let len=0;
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(!a||!b)continue;const d=Math.hypot((b.x||0)-(a.x||0),(b.z||0)-(a.z||0));if(Number.isFinite(d))len+=d}
 return Math.max(0,Math.ceil(len*PAR_SLACK-1e-9))+0;
}
export const meetsMinPar=(parM,mode)=>parM>=MIN_PAR_M[modeOf(mode)];
// Cents per metre (a fraction; money is floored once in payFor): target cents per game minute over the typical pace.
export const centsPerMetre=mode=>TARGET_C_PER_GAME_MIN[modeOf(mode)]/TYPICAL_M_PER_GAME_MIN[modeOf(mode)];
// type may carry its own handling fee ({handling}); otherwise the mode default. Unfloored.
export function basePay(type,mode,parM){const m=modeOf(mode),h=Number.isFinite(type?.handling)?type.handling:HANDLING_C[m];return h+Math.max(0,Number.isFinite(parM)?parM:0)*centsPerMetre(m)}
export function fatigueFactor(doneToday){const n=clampInt(doneToday,0,9999,0);for(const t of FATIGUE_TIERS)if(n<t.upTo)return t.pct/100;return 0}
export const canTakeMore=doneToday=>fatigueFactor(doneToday)>0;
// Game minutes the route cannot honestly be finished faster than.
export const minElapsed=(parM,mode)=>(Number.isFinite(parM)?Math.max(0,parM):0)/FASTEST_M_PER_GAME_MIN[modeOf(mode)];
export function tipFor(pay,generosity,quality,onTime){
 if(!onTime)return 0;const q=Number.isFinite(quality)?quality:0,band=q>=TIP_FULL_QUALITY?1:q>=TIP_HALF_QUALITY?.5:0,g=clampInt(generosity,0,3,0);
 return Math.floor(Math.min(pay*g*TIP_PER_GENEROSITY_PCT*band/100,pay*TIP_CAP_PCT/100));
}
// {mode,type?,parM,quality 0-100,repMul (1 = none),doneToday,generosity 0-3,onTime,elapsedMin} -> {base,factor,pay,tip,total,tooFast}
export function payFor(o={}){
 const mode=modeOf(o.mode),parM=Number.isFinite(o.parM)?Math.max(0,o.parM):0,quality=clampInt(o.quality,0,100,100),repMul=Number.isFinite(o.repMul)?Math.max(0,o.repMul):1;
 const factor=fatigueFactor(o.doneToday),tooFast=Number.isFinite(o.elapsedMin)&&o.elapsedMin<minElapsed(parM,mode);
 const handling=Number.isFinite(o.type?.handling)?o.type.handling:HANDLING_C[mode];
 const base=Math.floor(basePay(o.type,mode,parM));
 const pay=tooFast?Math.floor(handling*factor):Math.floor(basePay(o.type,mode,parM)*quality/100*repMul*factor); // too fast: the handling fee only (still tired)
 const tip=tooFast?0:tipFor(pay,o.generosity,quality,!!o.onTime);
 return {base,factor,pay,tip,total:pay+tip,tooFast};
}
