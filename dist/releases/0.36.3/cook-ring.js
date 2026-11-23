// Pure timed cooking ring and sweet-spot scoring (notes/cooking-design.md section 3 & 8, L-PURE).
export const RING_CENTER=0.72;
export const BASE_GOOD_HALF=0.14;
export const BASE_PERFECT_HALF=0.05;
export const LEVEL_WIDEN=0.004;
export const MAX_LEVEL_WIDEN=0.06;
export const BURN_AT=0.95;

export const QUALITY_MULT=Object.freeze({burnt:0.4,ok:1.0,good:1.15,perfect:1.3});

const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));

export function ringProgress(elapsedSec,totalSec){
 if(!Number.isFinite(elapsedSec)||!Number.isFinite(totalSec)||totalSec<=0)return 0;
 return clamp(elapsedSec/totalSec,0,1);
}

export function sweetSpot(hospitalityLevel=1){
 const lv=Number.isFinite(hospitalityLevel)?Math.max(1,Math.floor(hospitalityLevel)):1;
 const widen=Math.min(MAX_LEVEL_WIDEN,(lv-1)*LEVEL_WIDEN);
 const goodHalf=BASE_GOOD_HALF+widen;
 const perfectHalf=BASE_PERFECT_HALF+widen*0.5;
 const goodStart=clamp(RING_CENTER-goodHalf,0.25,RING_CENTER);
 const goodEnd=clamp(RING_CENTER+goodHalf,RING_CENTER,BURN_AT-0.01);
 const perfectStart=clamp(RING_CENTER-perfectHalf,goodStart,RING_CENTER);
 const perfectEnd=clamp(RING_CENTER+perfectHalf,RING_CENTER,goodEnd);
 return {goodStart,perfectStart,perfectEnd,goodEnd,burnAt:BURN_AT};
}

export function ringResult(progress,hospitalityLevel=1){
 const p=Number.isFinite(progress)?clamp(progress,0,1):0;
 const spot=sweetSpot(hospitalityLevel);
 if(p>=spot.burnAt)return {quality:'burnt',mult:QUALITY_MULT.burnt};
 if(p>=spot.perfectStart&&p<=spot.perfectEnd)return {quality:'perfect',mult:QUALITY_MULT.perfect};
 if(p>=spot.goodStart&&p<=spot.goodEnd)return {quality:'good',mult:QUALITY_MULT.good};
 return {quality:'ok',mult:QUALITY_MULT.ok};
}
