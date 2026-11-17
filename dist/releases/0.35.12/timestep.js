// Real time drives the simulation. Each frame's real time is cut into equal slices of at most 1/30 s, and everything that must
// advance with real time (movement and collisions, the clock, hunger and thirst, contracts, pedestrians, action timers, doors)
// runs once per slice. A slow frame is several small steps instead of one short one, so at 10 FPS the player covers the same ground
// and gets as hungry as at 60 FPS (before, movement was capped at 40 ms a frame while the clock and needs ran on up to 250 ms).
// There is no accumulator, so a fast display (144 FPS) takes one small step per frame and needs no interpolation to look smooth.
export const MAX_STEP=1/30; // the longest slice: at the top speed (8.2 m/s) that is 27 cm, under the 33 cm collision radius
export const MAX_FRAME=.25; // longer frames (a stalled tab) are clipped, so the world slows rather than jumping
export function substeps(seconds,{maxStep=MAX_STEP,maxFrame=MAX_FRAME}={}){
 const total=Math.min(Math.max(0,Number(seconds)||0),maxFrame);
 if(total===0)return {count:0,step:0};
 const count=Math.max(1,Math.ceil(total/maxStep-1e-9));
 return {count,step:total/count};
}
