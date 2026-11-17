// A2 slope rules, the pure part (notes/atv-handling-design.md section 2, "Slope" and "Side slope"): what a hill does to a vehicle whose class has `slope:true` (the ATV; the pickup keeps the old rule until tuned).
// Grade g is in degrees along the heading, uphill positive; side s is in degrees across the heading, positive when the ground falls to the vehicle's LEFT (+x, where yaw grows). Both default to 0: flat ground changes nothing.
// Not here (A2 part 2, needs a saved `slip` field and a key decision): the hand-brake drift. The step in vehicle.js calls slopeOf() and applies the numbers; driving.js supplies env.grade and env.side.
export const GRAVITY=9.81,SLOPE_ENGINE=.3; // along-slope gravity is scaled by 0.3 (an arcade hill, not a real one)
export const STEEP_DEG=25,CLIFF_DEG=35; // beyond 25 uphill the throttle cannot hold; the terrain check blocks beyond 35
export const UPHILL_LOSS=.6,DOWNHILL_GAIN=.25,DOWNHILL_BRAKE_LOSS=.3; // top x(1-.6 (g/25)^2) up, x(1+.25 g/25) down, brake x(1-.3 g/25) down
export const ROLLBACK_SPEED=1.5,ROLLBACK_ACCEL=2; // too steep: speed goes to -1.5 m/s at 2 m/s2
export const SIDE_FROM=18,SIDE_REFUSE=25,SIDE_SLIDE_PER_DEG=.15,SIDE_SLIDE_MAX=1.5; // over 18 deg the pose slides downhill; over 25 steering toward uphill is refused
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=d=>d*Math.PI/180;
// env -> {top, brake, gravity, steep, slide, refuse}: top and brake multiply the class numbers; gravity is m/s2 along the heading (negative uphill);
// steep: uphill past 25 degrees (the "Too steep" cue); slide: m/s sideways, + toward the left; refuse: -1/+1 = the steer sign that is refused (0 = none).
export function slopeOf(env){
 const g=Number.isFinite(env&&env.grade)?env.grade:0,s=Number.isFinite(env&&env.side)?env.side:0,up=Math.max(0,g),down=Math.max(0,-g);
 const top=g>=0?1-UPHILL_LOSS*Math.pow(Math.min(up,STEEP_DEG*1.4)/STEEP_DEG,2):1+DOWNHILL_GAIN*Math.min(down,CLIFF_DEG)/STEEP_DEG;
 const over=Math.max(0,Math.abs(s)-SIDE_FROM),slide=Math.sign(s)*Math.min(SIDE_SLIDE_MAX,over*SIDE_SLIDE_PER_DEG);
 return {top:Math.max(.1,top),brake:1-DOWNHILL_BRAKE_LOSS*Math.min(down,STEEP_DEG)/STEEP_DEG,gravity:0-GRAVITY*Math.sin(rad(clamp(g,-CLIFF_DEG,CLIFF_DEG)))*SLOPE_ENGINE,
  steep:g>STEEP_DEG,slide,refuse:Math.abs(s)>SIDE_REFUSE?-Math.sign(s):0}; // ground falling to the left (s>0): uphill is the right, and turning right is steer < 0
}
// The step's use of it. before: speed at the start of the step; after: speed once throttle, brake and drag were applied. Too steep: the throttle is ignored and the speed eases to -1.5 m/s.
// hold: the m/s2 that stops a vehicle with no throttle (drag) or the brake on; a stopped vehicle that this can hold stays put (no creeping).
export const applySlope=(before,after,sl,dt,hold=0)=>{if(sl.steep)return before<=-ROLLBACK_SPEED?before:Math.max(-ROLLBACK_SPEED,before-ROLLBACK_ACCEL*dt);if(Math.abs(before)<.01&&Math.abs(after)<.01&&Math.abs(sl.gravity)<=hold)return after;return after+sl.gravity*dt};
export const slopeSteer=(want,sl)=>sl.refuse!==0&&Math.sign(want)===sl.refuse?0:want;