// Carry pose for a box held at the belly (notes/handoff.md G2c): where the carton sits against the sweater and where the two hands go, pure numbers, no DOM, no three.js, no allocation when `out` is passed.
// The character's frame: x to the left of the body (the right hand is at negative x), y up from the soles, z forward. Measured on the real rig (male and female, idle): the front of the torso is at z 0.17 to 0.21 between y 1.0 and 1.2 m,
// the shoulders are at y 1.49, x +-0.12..0.16. The carton's origin is the centre of its base (props.js), so the base sits (height / 2) under the centre.
export const TORSO_FRONT=.2; // the front of the belly and chest (m)
export const BACK_GAP=.012; // the box's back face stands this far off the sweater, so it touches without sinking in
export const BOX_CENTRE_Y=1.08; // the box's centre, belly to lower chest height
export const HAND_OUT=.03; // each palm presses on the side face: this far outside it
export const BEND_DOWN=.7,BEND_FORWARD=.3; // the same bend the plank stack follows (game.js updateCarryPose): the box and hands go down and out while stooping to put it down
export const BOX_POLES=Object.freeze({R:Object.freeze({x:-.55,y:-1,z:-.35}),L:Object.freeze({x:.55,y:-1,z:-.35})}); // the elbows bend forward and drop out to the sides
export const freshBoxPose=()=>({box:{x:0,y:0,z:0},R:{x:0,y:0,z:0},L:{x:0,y:0,z:0}});
// size: the box's bounding size {x: width, y: height, z: depth} in metres. bend 0..1 (carry.js bendAmount). Returns `out`.
export function boxPose(size,bend=0,out=freshBoxPose()){
 const w=Number.isFinite(size?.x)&&size.x>0?size.x:.3,h=Number.isFinite(size?.y)&&size.y>0?size.y:.2,d=Number.isFinite(size?.z)&&size.z>0?size.z:.2,b=Number.isFinite(bend)?Math.max(0,Math.min(1,bend)):0;
 const cy=BOX_CENTRE_Y-BEND_DOWN*b,cz=TORSO_FRONT+BACK_GAP+d/2+BEND_FORWARD*b;
 out.box.x=0;out.box.y=cy-h/2;out.box.z=cz; // the mesh origin: the middle of the base
 out.R.x=-(w/2+HAND_OUT);out.L.x=w/2+HAND_OUT;out.R.y=out.L.y=cy;out.R.z=out.L.z=cz;
 return out;
}
// Which pose the arms should be in: 'box' for the gig parcel in the hands, 'planks' or 'log' for p.carry, null for none. Seated (a vehicle seat, the forklift) always wins: the cab pose owns the arms.
// The existing planks and log poses (game.js) stay where they were; only the box is new, and `freeArms` is the game's own outdoors check for those two.
export function poseFor(p,{seated=false,parcelInHands=false,freeArms=true}={}){
 if(seated)return null;
 const kind=p?.carry?.kind;
 if(kind==='planks'||kind==='log')return freeArms?kind:null;
 if(kind==='crate'||kind==='box')return freeArms&&!p?.equipped?'box':null; // audit minor (C-B): a crate or a box in the arms is the same belly hold (game.js draws it outdoors only)
 if(kind==='parcel')return parcelInHands&&!p?.equipped?'box':null; // the gig parcel as a piece in the hands (progress.carry)
 return parcelInHands&&!p?.carry&&!p?.equipped?'box':null; // a tool in the hand (axe, nozzle) owns the right arm: no box pose then
}
