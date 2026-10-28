import * as T from './vendor/three.module.js';

// The axe swing as a pure function of progress 0..1, in the character's own space (metres, +Z forward, -X the right side).
// Carry pose -> wind up past the shoulder (in front of the body, never behind it) -> accelerate down through the trunk ->
// short hold at impact -> recover to the carry pose. Everything is continuous, so there are no snaps between phases.
export const CARRY=new T.Vector3(-.28,1.28,.05); // the right hand, bent at the chest
export const CARRY_DIR=new T.Vector3(.4,.7,-.5).normalize(); // over the shoulder: the shaft crosses it and the head rides behind
export const GRIP=.18; // the hand holds the handle 18 cm from its butt end
export const CHOP_TIMING={windUp:.46,impact:.58,hold:.64};
const UP=new T.Vector3(-.22,1.95,.02),DOWN=new T.Vector3(-.1,1.12,.55);
const WIND_CONTROL=new T.Vector3(-.4,1.62,.25),STRIKE_CONTROL=new T.Vector3(-.3,1.75,.5),RECOVER_CONTROL=new T.Vector3(-.45,1,.4);
const clamp01=t=>Math.max(0,Math.min(1,t));
const smoother=t=>{t=clamp01(t);return t*t*t*(t*(t*6-15)+10)};
const bezier=(a,b,c,t,out)=>{const u=1-t;return out.set(u*u*a.x+2*u*t*b.x+t*t*c.x,u*u*a.y+2*u*t*b.y+t*t*c.y,u*u*a.z+2*u*t*b.z+t*t*c.z)};
const LEAN={back:-.12,forward:.32};
export function chopPose(progress,out={point:new T.Vector3(),lean:0,twoHand:0}){
 const p=clamp01(progress),{windUp,impact,hold}=CHOP_TIMING;
 if(p<windUp){const t=smoother(p/windUp);bezier(CARRY,WIND_CONTROL,UP,t,out.point);out.lean=LEAN.back*t;out.twoHand=clamp01(t*2.5)}
 else if(p<impact){const t=(p-windUp)/(impact-windUp);bezier(UP,STRIKE_CONTROL,DOWN,t*t,out.point);out.lean=LEAN.back+(LEAN.forward-LEAN.back)*smoother(t);out.twoHand=1}
 else if(p<hold){out.point.copy(DOWN);out.lean=LEAN.forward;out.twoHand=1}
 else{const t=smoother((p-hold)/(1-hold));bezier(DOWN,RECOVER_CONTROL,CARRY,t,out.point);out.lean=LEAN.forward*(1-t);out.twoHand=clamp01(1-t*1.6)}
 return out;
}
