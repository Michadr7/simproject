// Shop presence and interior light ramp by opening hours (notes/owner-feedback-2026-11-18.md item 9). Pure: no DOM, no three.js, no globals.
export const DEFAULT_HOURS=Object.freeze({market:Object.freeze([420,1320]),cafe:Object.freeze([480,1080])});
export const LIGHT_DIM=0.2;
export const LIGHT_FULL=1;
export const LIGHT_RAMP_HOURS=0.25;
export const LIGHT_RATE=4;

const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const smooth=t=>{const x=clamp(t,0,1);return x*x*(3-2*x)};

function toHoursPair(entry){
 if(!entry)return null;
 const raw=Array.isArray(entry)?entry:entry.hours;
 if(!Array.isArray(raw)||raw.length<2)return null;
 const a=Number(raw[0]),b=Number(raw[1]);
 if(!Number.isFinite(a)||!Number.isFinite(b))return null;
 return a>24||b>24?[a/60,b/60]:[a,b];
}

export function shopPresence(kind,hourFloat,hoursTable=DEFAULT_HOURS){
 const pair=toHoursPair(hoursTable?.[kind])||toHoursPair(DEFAULT_HOURS[kind]);
 const h=Number.isFinite(hourFloat)?((hourFloat%24)+24)%24:0;
 if(!pair)return {open:false,clerkVisible:false,customersVisible:false,cupsVisible:false,lightScale:LIGHT_DIM};
 const [opens,closes]=pair;
 const open=h>=opens&&h<closes;
 let lightScale=LIGHT_DIM;
 if(open){
  const tOpen=LIGHT_RAMP_HOURS>0?(h-opens)/LIGHT_RAMP_HOURS:1;
  const tClose=LIGHT_RAMP_HOURS>0?(closes-h)/LIGHT_RAMP_HOURS:1;
  lightScale=LIGHT_DIM+(LIGHT_FULL-LIGHT_DIM)*smooth(Math.min(1,tOpen,tClose));
 }
 return {open,clerkVisible:open,customersVisible:open,cupsVisible:open,lightScale};
}

export function stepLightScale(current,target,dt){
 const c=Number.isFinite(current)?current:LIGHT_DIM;
 const t=Number.isFinite(target)?target:LIGHT_DIM;
 const d=Number.isFinite(dt)?Math.max(0,dt):0;
 return c+(t-c)*(1-Math.exp(-d*LIGHT_RATE));
}
