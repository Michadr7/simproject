// Vehicle damage rules (VD1, notes/vehicle-damage-design.md). Pure: no DOM, no clock, no random (the caller passes `now` in seconds). A vehicle has one number, cond 0..1000 (1000 = perfect).
// stepVehicle (vehicle.js) says how hard it hit (`impact`, m/s) and what (`hitKind`); this file turns that into points, bands, effects, stalls and the repair bill and time.
// ---- TUNING (VD7a): every number you retune lives in this block or in `tough` (vehicle.js classes). npm test prints the crash table (tests/damage-table.mjs): look there after a change. ----
export const IMPACT_MIN=4; // m/s: a bump slower than this costs nothing
export const CRASH_K=1; // points per (m/s)^2 above IMPACT_MIN^2, before the class's `tough` (1 = the S70's scale). points = tough x CRASH_K x (impact^2 - IMPACT_MIN^2)
export const POINT_CAP=600; // one crash never takes more (VD7a: the curve below no longer reaches it at any class's top speed; it only guards a future fast vehicle)
// vehicle.js `tough` is the damage a class takes per unit of crash energy (higher = takes MORE; the old comment said the reverse). VD7a: the S70 .58 and the off-road .68 hit a wall at full speed for about 480 points (about 50% left); the slow classes (worktruck 1.3, flatbed 1.7) are scaled up so a top-speed hit costs them about 40% too.
export const PERSON_POINTS=20; // a hit on a person is this, not the wall formula (today a person stops the hull like a wall)
export const STALL_POINTS=250; // a crash of this many points or more stalls the engine
export const STALL_SECONDS=1; // the engine can be restarted this long after it stalled
export const DEBOUNCE_SECONDS=.5; // one crash counts once: the largest hit inside this window
export const PERFECT=1000;
// Bands (cond >= min). VD7a edges: Fine 800, Worn 650, Damaged 250, Limping 1 (was 700 / 400 / 150 / 1) so a top-speed wall hit (about 50% left) reads Damaged, and a bump or two stays Fine or Worn. pull: a steering bias (fraction of full lock) towards one side; brake: braking strength; burn: gas use; rough: engine voice; cranks: extra cranks before it starts; smoke: the smoke tier (0 grey, 1 dark, 2 black).
export const BANDS=Object.freeze([
 {id:'fine',label:'Fine',min:800,top:1,accel:1,brake:1,pull:0,burn:1,rough:0,cranks:0,smoke:0},
 {id:'worn',label:'Worn',min:650,top:.95,accel:1,brake:.95,pull:.02,burn:1.05,rough:.1,cranks:0,smoke:0},
 {id:'damaged',label:'Damaged',min:250,top:.85,accel:.85,brake:.8,pull:.06,burn:1.15,rough:.25,cranks:2,smoke:1},
 {id:'limping',label:'Limping',min:1,top:.5,accel:.6,brake:.6,pull:.12,burn:1.3,rough:.4,cranks:4,smoke:2},
 {id:'wrecked',label:'Wrecked',min:0,top:0,accel:0,brake:.3,pull:.2,burn:0,rough:0,cranks:0,smoke:2}
]);
const cleanCond=c=>Number.isFinite(c)?Math.max(0,Math.min(PERFECT,Math.round(c))):PERFECT;
export const bandOf=cond=>{const c=cleanCond(cond);return BANDS.find(b=>c>=b.min)};
// Crash points: tough x CRASH_K x (impact^2 - IMPACT_MIN^2), capped, whole. A person is the fixed PERSON_POINTS above the threshold. tough: vehicle.js classes (higher = takes more damage).
export function crashPoints(impact,tough=1,kind='world'){
 if(!(impact>IMPACT_MIN))return 0;
 if(kind==='person')return PERSON_POINTS;
 return Math.min(POINT_CAP,Math.max(0,Math.round(tough*CRASH_K*(impact*impact-IMPACT_MIN*IMPACT_MIN))));
}
export const applyPoints=(cond,points)=>Math.max(0,cleanCond(cond)-Math.max(0,Math.round(points||0)));
// The debounce: a window opens at the first hit and lasts DEBOUNCE_SECONDS; inside it only the largest hit counts (a stop can be split over two slices). Keep the state with the vehicle (not saved).
export const freshCrashState=()=>({at:-Infinity,best:0});
// registerCrash(state, now, points) -> {state, points: what to take off cond now (the part above the biggest hit so far in the window), stall: true once, when the window's largest hit reaches STALL_POINTS}
export function registerCrash(state,now,points){
 const p=Math.max(0,Math.round(points||0));
 if(p<=0)return {state,points:0,stall:false};
 const open=now-state.at<DEBOUNCE_SECONDS,best=open?state.best:0,top=Math.max(best,p);
 return {state:{at:open?state.at:now,best:top},points:top-best,stall:best<STALL_POINTS&&top>=STALL_POINTS};
}
// Which way a vehicle pulls (+1 or -1): fixed per vehicle, from its uid (no random).
export function pullSide(uid){let h=0;for(const ch of String(uid))h=(h*31+ch.charCodeAt(0))|0;return h&1?1:-1}
// The class as it drives at this condition (applied next to withLoad in driving.js). Fine returns the class itself. `pull` is the steering bias magnitude, `burnMul`/`rough`/`cranks`/`smoke` are pure numbers for fuel, sound and smoke.
export function withDamage(cls,cond){
 const b=bandOf(cond);
 if(b.id==='fine')return cls;
 return {...cls,top:cls.top*b.top,reverse:cls.reverse*b.top,accel:cls.accel*b.accel,brake:cls.brake*b.brake,pull:b.pull,burnMul:b.burn,rough:b.rough,cranks:b.cranks,smoke:b.smoke,band:b.id};
}
// Engine: a Wrecked vehicle never starts; after a stall (at = the time it stalled) it restarts after STALL_SECONDS.
export const canStart=cond=>cleanCond(cond)>0;
export const stallOver=(stalledAt,now)=>stalledAt==null||now-stalledAt>=STALL_SECONDS;
export const extraCranks=cond=>bandOf(cond).cranks;
// Repair (shared with a later repair job): the bill is 25% of the price x the share of condition lost, at least $25. Prices and bills are whole cents. A perfect vehicle costs nothing (and is refused by the shop).
export const REPAIR_SHARE=.25,REPAIR_MIN_CENTS=2500;
export function repairCents(priceCents,cond){
 const lost=PERFECT-cleanCond(cond);if(lost<=0||!(priceCents>0))return 0;
 return Math.max(REPAIR_MIN_CENTS,Math.ceil(priceCents*REPAIR_SHARE*lost/PERFECT));
}
// Repair takes game time: half an hour for a scratch up to 6 hours for a wreck, in quarter hours. 0 when perfect.
export const REPAIR_HOURS_MIN=.5,REPAIR_HOURS_MAX=6;
export function repairHours(cond){
 const lost=PERFECT-cleanCond(cond);if(lost<=0)return 0;
 return Math.round((REPAIR_HOURS_MIN+(REPAIR_HOURS_MAX-REPAIR_HOURS_MIN)*lost/PERFECT)*4)/4;
}
// ---- VD2: wiring helpers (still pure) ----
export const PULL_SPEED=3; // m/s: the steering bias fades in below this speed (a parked vehicle does not turn its wheel)
export const CRANK_SECONDS=.5; // one ignition crank
export const SHAKE_SECONDS=.4; // camera shake length after a counted crash (VD7a: was .25)
export const SHAKE_MIN=.03,SHAKE_MAX=.18; // metres at the smallest counted crash and at POINT_CAP (VD7a: was .02 to .12)
export const ENERGY_COST=5; // energy the driver loses in a crash that stalls the engine (STALL_POINTS or more)
export const percent=cond=>Math.round(cleanCond(cond)/10);
// Steering with the pull added: pull is a fraction of full lock (withDamage), side is pullSide(uid) (+1 or -1). Result stays in -1..1.
export const pulledSteer=(steer,pull,side,speed)=>Math.max(-1,Math.min(1,(steer||0)+(pull||0)*side*Math.min(1,Math.abs(speed||0)/PULL_SPEED)));
// Camera shake: amplitude in metres from the window's largest hit (0.02 m for a small one up to 0.12 m at the cap), and the offset at `left` seconds before it ends (decays to 0).
export const shakeAmplitude=points=>+(SHAKE_MIN+(SHAKE_MAX-SHAKE_MIN)*Math.min(1,Math.max(0,points)/POINT_CAP)).toFixed(3);
export function shakeOffset(left,amp){if(!(left>0)||!(amp>0))return {x:0,y:0,z:0};const k=amp*Math.min(1,left/SHAKE_SECONDS);return {x:Math.sin(left*95)*k,y:Math.sin(left*130+1)*k*.7,z:Math.sin(left*70+2)*k*.5}}
// The toast when a crash moves a vehicle into a worse band (name: the vehicle's short name).
export function bandToast(name,cond){const b=bandOf(cond),pct=percent(cond);
 if(b.id==='wrecked')return `Your ${name} is Wrecked (0%). It will not start.`;
 if(b.id==='limping')return `Your ${name} is Limping (${pct}%). It is at half speed and drinks fuel: get it repaired.`;
 if(b.id==='damaged')return `Your ${name} is Damaged (${pct}%). It is slower and uses more gas.`;
 if(b.id==='worn')return `Your ${name} is Worn (${pct}%). It pulls a little and uses a bit more gas.`;
 return `Your ${name} is in good shape (${pct}%).`}
// The engine: {mode: 'run'|'crank'|'off', since, readyAt, nag}. Fresh when you sit down: a Fine or Worn vehicle runs at once; a damaged one cranks first (extraCranks).
export function freshEngine(cond,now){const n=extraCranks(cond);return !canStart(cond)?{mode:'off',since:-Infinity,readyAt:0,nag:-Infinity}:n>0?{mode:'crank',since:now,readyAt:now+CRANK_SECONDS*n,nag:-Infinity}:{mode:'run',since:now,readyAt:0,nag:-Infinity}}
// One slice: returns {engine, event}. stall: a stalling crash this slice. throttle > 0 is the key that restarts. Events: 'crank' (the starter turns: play the ignition), 'start' (it catches), 'dead' (a Wrecked vehicle: told at most every 3 s).
export function engineStep(e,{cond,throttle=0,now=0,stall=false}){
 let m=e;
 if(stall||!canStart(cond))m={...m,mode:'off',since:(stall||m.mode!=='off')?now:m.since};
 if(m.mode==='off'&&throttle>0){
  if(!canStart(cond))return now-m.nag>=3?{engine:{...m,nag:now},event:'dead'}:{engine:m,event:null};
  if(stallOver(m.since,now))return {engine:{...m,mode:'crank',readyAt:now+CRANK_SECONDS*(1+extraCranks(cond))},event:'crank'};
 }
 if(m.mode==='crank'&&now>=m.readyAt)return {engine:{...m,mode:'run'},event:'start'};
 return {engine:m,event:null};
}
// ---- VD3: how a condition looks and sounds (pure, so the numbers are tested and tuned in one place) ----
// wear: grime, scratches and chips on the paint (uWear.y, 0..1). Nothing from WEAR_START (900) up, then it grows on a curve (VD7a): Worn (799 to 650) about .27 to .46, 400 about .70, Damaged (250) about .82, 0 = 1. crack: the glass (uCrack, 0..1): none at Fine and Worn, light at Damaged, heavy at Limping, full at Wrecked.
export const WEAR_START=900,WEAR_CURVE=.6; // VD7a: wear = ((WEAR_START - cond) / WEAR_START)^WEAR_CURVE, so the first scuffs show early (Worn about .3 to .45) instead of growing in a straight line (was start 850, straight)
export const CRACK_BY_BAND=Object.freeze({fine:0,worn:0,damaged:.45,limping:.8,wrecked:1});
export function lookOf(cond){const c=cleanCond(cond),b=bandOf(c);return {wear:+Math.pow(Math.max(0,Math.min(1,(WEAR_START-c)/WEAR_START)),WEAR_CURVE).toFixed(3),crack:CRACK_BY_BAND[b.id],smoke:b.smoke,band:b.id}}
// Smoke: the exhaust puffs come in `exhaustMul` x the usual rate and in the band's tier (0 grey, 1 dark, 2 black); the hood smokes from Damaged down (puffs a second), a Wrecked one for HOOD_WRECKED_SECONDS after the crash and then no more.
export const EXHAUST_MUL=Object.freeze({fine:1,worn:1.3,damaged:1.6,limping:2.2,wrecked:1});
export const HOOD_RATE=Object.freeze({fine:0,worn:0,damaged:7,limping:16,wrecked:10}),HOOD_WRECKED_SECONDS=60;
export function smokeOf(cond,sinceCrash=Infinity){const b=bandOf(cond),hood=b.id==='wrecked'&&!(sinceCrash<HOOD_WRECKED_SECONDS)?0:HOOD_RATE[b.id];return {tier:b.smoke,exhaustMul:EXHAUST_MUL[b.id],hoodRate:hood}}
// The engine's misfire: a short dip in the sound every `period` seconds at Damaged (1.7 s) and Limping (0.8 s), on a fixed phase of the clock (no random). 0 = none.
export const MISFIRE_PERIOD=Object.freeze({damaged:1.7,limping:.8}),MISFIRE_SECONDS=.12;
export const misfirePeriod=cond=>MISFIRE_PERIOD[bandOf(cond).id]||0;
export function misfiring(cond,time){const p=misfirePeriod(cond);return p>0&&time%p<MISFIRE_SECONDS}
// ---- VD7a: stronger feedback (pure numbers; game.js and debris.js apply them) ----
// Hit-stop: a counted crash of HITSTOP_MIN_POINTS or more freezes the VEHICLE step (not the loop: the clock, saves, people and the network keep running) for HITSTOP_MIN..MAX seconds, growing with the hit up to HITSTOP_FULL_POINTS.
export const HITSTOP_MIN_POINTS=60,HITSTOP_MIN=.05,HITSTOP_MAX=.09,HITSTOP_FULL_POINTS=400;
export const hitStopOf=points=>!(points>=HITSTOP_MIN_POINTS)?0:+(HITSTOP_MIN+(HITSTOP_MAX-HITSTOP_MIN)*Math.min(1,points/HITSTOP_FULL_POINTS)).toFixed(3);
// One simulation slice of `step` seconds with `left` seconds of freeze owed: the freeze eats the start of the slice, the vehicle steps the rest. Real time in, real time out: the same freeze at 30, 60 or 144 slices a second.
export function stopSlice(left,step){const eat=Math.max(0,Math.min(left||0,step));return {left:Math.max(0,(left||0)-eat),dt:step-eat}}
// Red screen-edge flash: strength 0..1 (the CSS opacity is strength x FLASH_OPACITY), from FLASH_MIN at the smallest counted crash up to 1 at FLASH_FULL_POINTS. It fades over FLASH_SECONDS (CSS).
export const FLASH_MIN=.2,FLASH_FULL_POINTS=350,FLASH_OPACITY=.62,FLASH_SECONDS=.8;
export const flashOf=points=>!(points>0)?0:+(FLASH_MIN+(1-FLASH_MIN)*Math.min(1,points/FLASH_FULL_POINTS)).toFixed(3);
// Dash warning lamp: off at Fine and Worn, steady at Damaged, blinking at Limping and Wrecked (the icon, the blinking and the text name it: never colour alone).
export const lampOf=cond=>{const id=bandOf(cond).id;return id==='damaged'?'on':id==='limping'||id==='wrecked'?'blink':'off'};
// Debris at the contact point: chips (paint and plastic) always, sparks from SPARK_POINTS, glass from GLASS_POINTS. Counts grow with the hit and the total never exceeds DEBRIS_MAX_PER_HIT (the pool is 150).
export const SPARK_POINTS=30,GLASS_POINTS=90,DEBRIS_MAX_PER_HIT=60;
export function debrisOf(points){const f=Math.min(1,Math.max(0,points||0)/POINT_CAP);if(!(points>0))return {chips:0,sparks:0,glass:0};
 const chips=Math.round(5+22*f),sparks=points>=SPARK_POINTS?Math.round(6+16*f):0,glass=points>=GLASS_POINTS?Math.round(4+12*f):0,n=chips+sparks+glass,k=n>DEBRIS_MAX_PER_HIT?DEBRIS_MAX_PER_HIT/n:1;
 return {chips:Math.round(chips*k),sparks:Math.round(sparks*k),glass:Math.round(glass*k)}}