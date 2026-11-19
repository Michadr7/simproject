import * as T from './vendor/three.module.js';

// The axe swing as a pure function of progress 0..1, in the character's own space (metres, +Z forward, -X the right side).
// Trail carry (owner 2026-11-18, US Forest Service trail-tool guide): ONE hand choked up just below the head, the arm hanging relaxed at the side,
// the head forward and the edge down, the handle trailing behind. The swing: the left hand joins and the right hand slides down to the butt during the
// wind-up (past the shoulder, in front of the body, never behind it) -> accelerate down through the trunk -> short hold at impact -> recover to the
// trail carry while the left hand lets go and the right hand slides back up under the head. Everything is continuous, so there are no snaps between phases.
export const CARRY=new T.Vector3(-.23,1.07,.13); // the right hand at the side, a little forward of the relaxed idle hand (the arm hangs nearly straight)
export const CARRY_DIR=new T.Vector3(0,.25,.97).normalize(); // the handle runs forward and a little up from the fist: the head in front, the edge down, the butt trailing behind the hip
export const CARRY_POLE=null; // the elbow keeps its natural down-and-out direction
export const GRIP=.12; // swinging: the right hand holds the handle 12 cm from its butt end (the item origin; the butt is 7 cm behind it)
export const CHOKE=.2,CARRY_GRIP=.45; // carrying: the hand sits CHOKE below the far end of the head (CARRY_GRIP for the basic 0.72 m axe)
export const carryGrip=headEnd=>Number.isFinite(headEnd)?Math.max(GRIP,headEnd-CHOKE):CARRY_GRIP; // headEnd: the axe model's far end along +z (item-models.js)
// Logging polish (owner 2026-11-19, notes/eval/prompts/opus-logging-polish.md): a slow, heavy, chunky swing in five phases of progress: wind-up (0..windUp, slow),
// a held beat at the top (..top), a fast committed strike (..impact: the blade hits at CHOP_IMPACT), a hit-stop of a few frames then a small recoil out of the cut (..hold),
// and a slow recovery to the trail carry (..1). Every phase border is continuous in position, lean and crouch; at 0 and 1 the pose is the carry whatever the variant.
export const CHOP_TIMING=Object.freeze({windUp:.4,top:.52,impact:.62,stop:.665,hold:.72});
export const CHOP_IMPACT=CHOP_TIMING.impact; // game.js lands the hit (chips, the chop sound, the camera nudge) at this progress, not at the swing's start
// One heavy swing lands HITS_PER_SWING of tools.js's hits, so a pine takes half the swings, each about twice as long: the felling time stays as before.
// swingSeconds(base, need): base = skills.js swingTime(level), need = the hits the job takes (tools.js hitsFor / buckHitsFor). Exact for any need >= 2; a 1-hit job still gets one full heavy swing.
export const HITS_PER_SWING=2;
export const swingSeconds=(base,need=HITS_PER_SWING)=>{const n=Math.max(1,Math.floor(need)||1);return base*Math.max(n,HITS_PER_SWING)/Math.ceil(n/HITS_PER_SWING)};
const JOIN=.5,ALIGN_OFF=.12,ALIGN_ON=.86; // the left hand is on by half the wind-up; the carry alignment is let go early in the wind-up and taken again late in the recovery
const UP=new T.Vector3(-.22,1.95,.02),DOWN=new T.Vector3(-.1,1.12,.55),COCK=new T.Vector3(0,.035,-.03),RECOIL=new T.Vector3(-.01,.07,-.05); // COCK: the extra lift during the held beat; RECOIL: the bounce out of the cut
const WIND_CONTROL=new T.Vector3(-.4,1.62,.25),STRIKE_CONTROL=new T.Vector3(-.3,1.75,.5),RECOVER_CONTROL=new T.Vector3(-.45,1,.4);
const clamp01=t=>Math.max(0,Math.min(1,t));
const smoother=t=>{t=clamp01(t);return t*t*t*(t*(t*6-15)+10)};
const bezier=(a,b,c,t,out)=>{const u=1-t;return out.set(u*u*a.x+2*u*t*b.x+t*t*c.x,u*u*a.y+2*u*t*b.y+t*t*c.y,u*u*a.z+2*u*t*b.z+t*t*c.z)};
const LEAN={back:-.12,cock:-.16,forward:.34,recoil:.29},CROUCH={top:.03,strike:.17,recoil:.13}; // the torso rocks back to load, then drops its weight into the blow
// Variety (pure, no Math.random): chopVariant(swing index, seed) -> {side, tilt, lift, snap, sag}. side alternates every swing (the notch is cut from alternate sides:
// a slightly diagonal blow from the right, then from the left), tilt how diagonal (0.2..1 of DIAG metres), lift the wind-up height, snap the strike's ease power (higher = later, harder),
// sag the recovery's dip. seed: a number or a string (the tree's plot key, the trunk id, the worker): every co-op client gets the same sequence.
const DIAG=.08,V=Object.freeze({lift:[-.03,.07],snap:[1.6,2.3],sag:[-.06,.06]});
const NEUTRAL=Object.freeze({side:1,tilt:0,lift:0,snap:1.9,sag:0});
const hashOf=s=>{if(typeof s==='number'&&Number.isFinite(s))return s>>>0;let h=2166136261;for(const ch of String(s))h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0};
const mix=(a,b)=>{let h=Math.imul(a^Math.imul(b,0x9E3779B1),0x85EBCA6B)>>>0;h^=h>>>13;h=Math.imul(h,0xC2B2AE35)>>>0;h^=h>>>16;return h>>>0};
export function chopVariant(index,seed,out={side:1,tilt:0,lift:0,snap:1.9,sag:0}){
 const i=Math.max(0,Math.floor(index)||0),s=hashOf(seed),r=k=>mix(mix(s,i),k)/4294967296,L=(range,k)=>range[0]+(range[1]-range[0])*r(k);
 out.side=((i+(s&1))&1)?-1:1;out.tilt=.2+.8*r(1);out.lift=L(V.lift,2);out.snap=L(V.snap,3);out.sag=L(V.sag,4);return out;
}
const vUp=new T.Vector3(),vTop=new T.Vector3(),vDown=new T.Vector3(),vRec=new T.Vector3(),vWind=new T.Vector3(),vStrike=new T.Vector3(),vRecover=new T.Vector3(); // scratch (no allocation per call)
// out.twoHand: the left hand's weight on the handle; out.grip: where the right hand holds the handle (metres from the item origin); out.align: 1 = carry alignment (CARRY_DIR), 0 = follow the forearm;
// out.lean/out.crouch: for avatar.setLean/setCrouch. variant: chopVariant's output (null = the plain overhead swing).
export function chopPose(progress,out={point:new T.Vector3(),lean:0,twoHand:0,grip:CARRY_GRIP,align:1,crouch:0},carry=CARRY_GRIP,variant=null){
 const p=clamp01(Number.isFinite(progress)?progress:0),{windUp,top,impact,stop,hold}=CHOP_TIMING,v=variant||NEUTRAL,d=(v.side<0?-1:1)*clamp01(v.tilt)*DIAG,lift=Math.max(V.lift[0],Math.min(V.lift[1],v.lift||0));
 vUp.set(UP.x-d,UP.y+lift,UP.z);vTop.copy(vUp).add(COCK);vDown.set(DOWN.x+d*.5,DOWN.y,DOWN.z);vRec.copy(vDown).add(RECOIL);
 vWind.set(WIND_CONTROL.x-d*.5,WIND_CONTROL.y+lift*.5,WIND_CONTROL.z);vStrike.set(STRIKE_CONTROL.x-d*.3,STRIKE_CONTROL.y+lift*.5,STRIKE_CONTROL.z);vRecover.set(RECOVER_CONTROL.x,RECOVER_CONTROL.y+Math.max(V.sag[0],Math.min(V.sag[1],v.sag||0)),RECOVER_CONTROL.z);
 let crouch=0;
 if(p<windUp){const t=smoother(p/windUp),j=smoother(p/(windUp*JOIN));bezier(CARRY,vWind,vUp,t,out.point);out.lean=LEAN.back*t;out.twoHand=j;out.grip=carry+(GRIP-carry)*j;crouch=CROUCH.top*t}
 else if(p<top){const t=smoother((p-windUp)/(top-windUp));out.point.copy(vUp).addScaledVector(COCK,t);out.lean=LEAN.back+(LEAN.cock-LEAN.back)*t;out.twoHand=1;out.grip=GRIP;crouch=CROUCH.top} // the held beat: a slow last lift, the weight loaded
 else if(p<impact){const t=(p-top)/(impact-top),snap=Math.max(V.snap[0],Math.min(V.snap[1],v.snap||NEUTRAL.snap));bezier(vTop,vStrike,vDown,t**snap,out.point);const e=smoother(t);out.lean=LEAN.cock+(LEAN.forward-LEAN.cock)*e;out.twoHand=1;out.grip=GRIP;crouch=CROUCH.top+(CROUCH.strike-CROUCH.top)*e}
 else if(p<stop){out.point.copy(vDown);out.lean=LEAN.forward;out.twoHand=1;out.grip=GRIP;crouch=CROUCH.strike} // the hit-stop: dead still for a few frames
 else if(p<hold){const t=smoother((p-stop)/(hold-stop));out.point.copy(vDown).lerp(vRec,t);out.lean=LEAN.forward+(LEAN.recoil-LEAN.forward)*t;out.twoHand=1;out.grip=GRIP;crouch=CROUCH.strike+(CROUCH.recoil-CROUCH.strike)*t} // the recoil out of the cut
 else{const t=smoother((p-hold)/(1-hold));bezier(vRec,vRecover,CARRY,t,out.point);out.lean=LEAN.recoil*(1-t);out.twoHand=1-t;out.grip=GRIP+(carry-GRIP)*t;crouch=CROUCH.recoil*(1-t)}
 out.crouch=crouch;out.align=p<ALIGN_OFF||p>ALIGN_ON?1:0;
 return out;
}

// ── The chainsaw (owner 2026-11-18). Carried two-handed low in front of the body, the bar forward and angled a little left and down (the right hand on the
// rear handle, the model's origin; the left hand takes the front handle). Bucking a trunk is a hold of `total` seconds (tools.js buckTimeSec): the first
// SAW_TIMING.approach of it the character steps in beside the trunk (sawStand), leans, crouches and lowers the bar onto the trunk's top; the rest is the
// cut: the bar is drawn down through the trunk's thickness, its point staying on the cut line (x SAW_CUT_X, z SAW_STAND, character space) while the bar
// tips steeper. A small vibration (a few mm, 47/53 Hz, a pure function of time) rides on the hands while the saw bites. When the cut completes or E is
// let go early (`release` = the hold time it ended at), a recoil lift eases everything back to the carry in SAW_TIMING.recoil seconds.
export const SAW_CARRY=new T.Vector3(-.02,1.2,.25),SAW_DIR=new T.Vector3(.5,-.25,.83).normalize(),SAW_GRIP=0;
export const SAW_STAND=.66,SAW_CUT_X=-.1,SAW_REACH=.42; // after the step the trunk's axis lies SAW_STAND ahead and the cut at x SAW_CUT_X; the wrist sits SAW_REACH behind the bar point, along the bar
export const SAW_TIMING=Object.freeze({approach:.28,recoil:.45,lift:.1}); // approach: share of the hold; recoil: seconds; lift: metres at the top of the recoil
export const SAW_CUT=Object.freeze({top:.37,bottom:.06,pitch0:.75,pitch1:1.15,lean0:.75,lean1:1,crouch0:.38,crouch1:.58}); // for the 0.35 m trunk (sawmill-pile.js TRUNK_RADIUS .175)
export const SAW_VIBRATION=Object.freeze({amp:.003,hzX:47,hzY:53,fadeIn:.1});
export const sawCutting=(time,total)=>time>=SAW_TIMING.approach*total&&time<total; // the bar is in the wood (the chainsaw sound's `cutting`)
const sawBase=(th,total,out)=>{const a=SAW_TIMING.approach*total,C=SAW_CUT;
 if(th<a){const s=smoother(th/a),c=Math.cos(C.pitch0),n=Math.sin(C.pitch0),hy=C.top+n*SAW_REACH,hz=SAW_STAND-c*SAW_REACH; // (SAW_CUT_X, hy, hz): the hand where the cut starts
  out.dir.set(SAW_DIR.x*(1-s),SAW_DIR.y+(-n-SAW_DIR.y)*s,SAW_DIR.z+(c-SAW_DIR.z)*s).normalize();
  out.point.set(SAW_CARRY.x+(SAW_CUT_X-SAW_CARRY.x)*s,SAW_CARRY.y+(hy-SAW_CARRY.y)*s,SAW_CARRY.z+(hz-SAW_CARRY.z)*s);
  out.lean=C.lean0*s;out.crouch=C.crouch0*s;out.step=s;out.bar.copy(out.point).addScaledVector(out.dir,SAW_REACH)}
 else{const u=total>a?clamp01((th-a)/(total-a)):1,e=(u+u*u*(3-2*u))/2,pitch=C.pitch0+(C.pitch1-C.pitch0)*e; // a slow, even sweep
  out.dir.set(0,-Math.sin(pitch),Math.cos(pitch));out.bar.set(SAW_CUT_X,C.top+(C.bottom-C.top)*e,SAW_STAND);out.point.copy(out.bar).addScaledVector(out.dir,-SAW_REACH);
  out.lean=C.lean0+(C.lean1-C.lean0)*e;out.crouch=C.crouch0+(C.crouch1-C.crouch0)*e;out.step=1}
 return out};
// time: seconds since the cut began; total: the hold it needs; release: the hold time it ended at (total = completed, less = let go early; omit or -1 while E is held).
// out: {point (right wrist), dir (the bar, unit), bar (the bar point, without the vibration), lean, crouch, twoHand, step (0..1 of the step in), cutting, done}.
export function sawPose(time,total,release=-1,out={point:new T.Vector3(),dir:new T.Vector3(),bar:new T.Vector3(),lean:0,crouch:0,twoHand:1,step:0,cutting:false,done:false}){
 const t=Math.max(0,Number.isFinite(time)?time:0),tot=Math.max(.05,Number.isFinite(total)?total:1),rel=Number.isFinite(release)&&release>=0?Math.min(release,tot):-1,held=rel<0||t<rel,th=held?Math.min(t,tot):rel;
 sawBase(th,tot,out);out.twoHand=1;out.cutting=held&&sawCutting(th,tot);out.done=false;
 let env=clamp01(th/SAW_VIBRATION.fadeIn);
 if(!held){const u=clamp01((t-rel)/SAW_TIMING.recoil),s=smoother(u),lift=SAW_TIMING.lift*Math.sin(Math.PI*u);
  out.point.set(out.point.x+(SAW_CARRY.x-out.point.x)*s,out.point.y+(SAW_CARRY.y-out.point.y)*s+lift,out.point.z+(SAW_CARRY.z-out.point.z)*s);
  out.dir.set(out.dir.x+(SAW_DIR.x-out.dir.x)*s,out.dir.y+(SAW_DIR.y-out.dir.y)*s,out.dir.z+(SAW_DIR.z-out.dir.z)*s).normalize();
  out.bar.copy(out.point).addScaledVector(out.dir,SAW_REACH);out.lean*=1-s;out.crouch*=1-s;env*=1-s;out.done=t-rel>=SAW_TIMING.recoil-1e-9}
 const V=SAW_VIBRATION,w=2*Math.PI*t;out.point.x+=V.amp*env*Math.sin(w*V.hzX);out.point.y+=V.amp*env*Math.sin(w*V.hzY+1.3);
 return out;
}
// Where to stand to buck a trunk lying at (tx,tz) turned by rot (grid.js: its axis is (-cos rot, sin rot)) from (px,pz): beside its middle, on your own side,
// facing across it, so the middle lands at SAW_CUT_X, SAW_STAND in character space. {x,z,yaw} (yaw as the player's rotation.y).
export function sawStand(tx,tz,rot,px,pz,out={x:0,z:0,yaw:0}){
 const ax=-Math.cos(rot),az=Math.sin(rot),nx=-az,nz=ax,side=(px-tx)*nx+(pz-tz)*nz>=0?1:-1,fx=-nx*side,fz=-nz*side; // f: facing, toward the trunk
 out.yaw=Math.atan2(fx,fz);const cx=Math.cos(out.yaw),cz=-Math.sin(out.yaw); // the character's +x in the world
 out.x=tx-cx*SAW_CUT_X-fx*SAW_STAND;out.z=tz-cz*SAW_CUT_X-fz*SAW_STAND;return out;
}
