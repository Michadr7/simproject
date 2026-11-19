// Warm-meal buff: slows hunger/energy drain for a game-minute window (notes/cooking-design.md section 3 & 8, L-PURE).
export const MIN_DRAIN_MULT=0.5;
export const WARM_MEAL_CONFIG=Object.freeze({
 ok:Object.freeze({durationMin:120,drainMult:0.85}),
 good:Object.freeze({durationMin:180,drainMult:0.8}),
 perfect:Object.freeze({durationMin:240,drainMult:0.75})
});

export const freshWarmMeal=()=>({untilGameMin:0,drainMult:1});

export function normalizeWarmMeal(value){
 if(!value||typeof value!=='object')return freshWarmMeal();
 const untilGameMin=Number.isFinite(value.untilGameMin)&&value.untilGameMin>0?Math.floor(value.untilGameMin):0;
 const drainMult=Number.isFinite(value.drainMult)&&value.drainMult>=MIN_DRAIN_MULT&&value.drainMult<=1?value.drainMult:1;
 return untilGameMin>0?{untilGameMin,drainMult}:freshWarmMeal();
}

export function applyBuff(state,nowMin,quality='good'){
 const cur=normalizeWarmMeal(state);
 const now=Number.isFinite(nowMin)?Math.max(0,Math.floor(nowMin)):0;
 const cfg=WARM_MEAL_CONFIG[quality];
 if(!cfg)return cur;
 const active=cur.untilGameMin>now;
 return {
  untilGameMin:Math.max(cur.untilGameMin,now+cfg.durationMin),
  drainMult:active?Math.min(cur.drainMult,cfg.drainMult):cfg.drainMult
 };
}

export function drainFactor(state,nowMin){
 const cur=normalizeWarmMeal(state);
 const now=Number.isFinite(nowMin)?nowMin:0;
 return now<cur.untilGameMin?cur.drainMult:1;
}
