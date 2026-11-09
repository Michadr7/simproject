// Free water at work (DESIGN 4.18): a water cooler in the Ridgeline office and in the warehouse. E: thirst +30, once per game hour at each cooler. Pure.
// Saved as progress.coolers {office|warehouse: game minute of the last drink}.
export const COOLER_THIRST=30,COOLER_MINUTES=60,COOLER_KEYS=Object.freeze(['office','warehouse']);
export function normalizeCoolers(v){const out={};if(v&&typeof v==='object')for(const k of COOLER_KEYS)if(Number.isFinite(v[k])&&v[k]>=0)out[k]=Math.floor(v[k]);return out}
export const gameMinute=p=>Math.floor(((p.housing?.day||1)-1)*1440+(p.routine?.minutes||0));
// Minutes until this cooler can be used again (0 when ready).
export function coolerWait(p,key){const last=p.coolers?.[key];return Number.isFinite(last)?Math.max(0,Math.ceil(last+COOLER_MINUTES-gameMinute(p))):0}
export function useCooler(p,key){
 if(!COOLER_KEYS.includes(key))return {error:'No water here.'};
 const life=p.life||{};if((life.thirst??100)>=100)return {error:'You are not thirsty.'};
 const wait=coolerWait(p,key);if(wait>0)return {error:`The cooler needs a moment: try again in ${wait} min.`};
 return {state:{...p,life:{...life,thirst:Math.min(100,life.thirst+COOLER_THIRST)},coolers:{...(p.coolers||{}),[key]:gameMinute(p)}},message:`Cold water · thirst +${Math.min(COOLER_THIRST,100-life.thirst)}.`};
}