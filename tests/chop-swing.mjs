// Logging polish (owner 2026-11-19, chop-path.js): the heavy axe swing's five phases, the hit at CHOP_IMPACT, the seeded per-swing variety, the swing length
// that keeps felling time as before (HITS_PER_SWING hits per swing), frame-rate independence and the crew's swing beat.
import assert from 'node:assert/strict';
import * as T from '../dist/vendor/three.module.js';
import {CARRY,CARRY_GRIP,GRIP,CHOP_TIMING,CHOP_IMPACT,HITS_PER_SWING,swingSeconds,chopVariant,chopPose} from '../dist/chop-path.js';
import {AXE_IDS,hitsFor,buckHitsFor} from '../dist/tools.js';
import {swingTime,MAX_LEVEL} from '../dist/skills.js';
import {SWING_SECONDS,CHOP_BEAT_SECONDS,FELLER_PHASE_MIN,SECONDS_PER_MINUTE,BUCK_CUT_END,swingAt} from '../dist/workforce-pose.js';

const fresh=()=>({point:new T.Vector3(),lean:0,twoHand:0,grip:CARRY_GRIP,align:1,crouch:0});
const pose=(p,v=null)=>{const o=chopPose(p,fresh(),CARRY_GRIP,v);return {point:o.point.clone(),lean:o.lean,crouch:o.crouch,twoHand:o.twoHand,grip:o.grip,align:o.align}};
const C=CHOP_TIMING,seeds=[0,7,'12:-34','buck-41','ridgeline-cutter',123456789];
const variants=[null];for(const s of seeds)for(let i=0;i<40;i++)variants.push(chopVariant(i,s));

// 1. Phases in order; the impact ends the strike, which is short; the wind-up and recovery are long (chunky).
assert(0<C.windUp&&C.windUp<C.top&&C.top<C.impact&&C.impact<C.stop&&C.stop<C.hold&&C.hold<1,'phases in order');
assert.equal(CHOP_IMPACT,C.impact);assert(CHOP_IMPACT>C.top&&CHOP_IMPACT<C.stop,'the impact is inside the strike, before the hit-stop ends');
assert(C.impact-C.top<=.12&&C.windUp>=.35&&1-C.hold>=.25,'a fast strike between a slow wind-up and a slow recovery');
for(const v of variants){const at=pose(CHOP_IMPACT,v),before=pose(CHOP_IMPACT-.02,v);assert(at.point.z>.45&&at.point.y<1.25&&before.point.y>at.point.y+.05,'the blade arrives at the impact: '+at.point.toArray())}
// the hit-stop: dead still from the impact to `stop`, a few frames even at the fastest swing (level 20 felling: swingSeconds(.5, 2) = 1 s)
{const a=pose(CHOP_IMPACT+1e-6),b=pose(C.stop-1e-6);assert(a.point.distanceTo(b.point)<1e-9&&a.lean===b.lean&&a.crouch===b.crouch,'still during the hit-stop');
 assert((C.stop-C.impact)*swingSeconds(swingTime(MAX_LEVEL),2)>=2.5/60,'the hit-stop lasts at least 2.5 frames at 60 Hz at the fastest swing');
 const r=pose(C.hold);assert(r.point.y>a.point.y+.04&&r.point.z<a.point.z,'then a small recoil up and back out of the cut')}
// 2. Continuity at every phase border, and at 0/1 the carry pose whatever the variant (so chained swings with different variants join without a snap).
const fields=['lean','crouch','twoHand','grip'];
for(const v of variants){for(const b of [C.windUp,C.top,C.impact,C.stop,C.hold]){const L=pose(b-1e-7,v),R=pose(b+1e-7,v);assert(L.point.distanceTo(R.point)<1e-4,`point continuous at ${b}`);for(const f of fields)assert(Math.abs(L[f]-R[f])<1e-4,`${f} continuous at ${b}`)}
 for(const p of [0,1]){const o=pose(p,v);assert(o.point.distanceTo(CARRY)<1e-9&&Math.abs(o.lean)<1e-9&&Math.abs(o.crouch)<1e-9&&Math.abs(o.twoHand-(p?0:0))<1e-9&&Math.abs(o.grip-CARRY_GRIP)<1e-9&&o.align===1,'the carry pose at '+p)}}
// smooth outside the strike (a 1/400 step moves the hand < 1.5 cm), fast but bounded inside it
for(const v of variants.slice(0,60)){let prev=pose(0,v).point,out=0,strike=0,fastP=0,fast=0;for(let i=1;i<=400;i++){const p=i/400,q=pose(p,v).point,s=q.distanceTo(prev);if(p>C.top&&p<=C.impact+1e-9)strike=Math.max(strike,s);else out=Math.max(out,s);if(s>fast){fast=s;fastP=p}prev=q}
 assert(out<.015&&strike<.09,`step ${out.toFixed(3)} outside, ${strike.toFixed(3)} in the strike`);assert(fastP>C.top&&fastP<=C.impact+1e-9,'fastest in the strike')}
// 3. Bounded: on the right side, in front of the back, sane heights, lean and crouch in range, for every variant.
for(const v of variants)for(let i=0;i<=200;i++){const o=pose(i/200,v);const {x,y,z}=o.point;
 assert(Number.isFinite(x+y+z+o.lean+o.crouch+o.twoHand+o.grip),'finite');assert(x<-.05&&x>-.55&&y>.9&&y<2.15&&z>-.3&&z<.75,'hand in bounds: '+o.point.toArray());
 assert(o.lean>=-.2&&o.lean<=.4&&o.crouch>=0&&o.crouch<=.2&&o.twoHand>=0&&o.twoHand<=1&&o.grip>=GRIP-1e-9&&o.grip<=CARRY_GRIP+1e-9,'pose values in range')}
{const junk=pose(NaN,{side:5,tilt:9,lift:4,snap:-3,sag:7}),ok=pose(.3,{side:5,tilt:9,lift:4,snap:-3,sag:7});assert(junk.point.distanceTo(CARRY)<1e-9&&ok.point.y<2.15&&ok.point.x<-.05,'junk input is clamped')}
// 4. Variety: same seed, same sequence; consecutive swings always differ (the notch side alternates); seeds differ.
for(const s of seeds){const a=[],b=[];for(let i=0;i<60;i++){a.push({...chopVariant(i,s)});b.push({...chopVariant(i,s)})}assert.deepEqual(a,b,'same seed, same sequence');
 for(let i=1;i<60;i++){assert.notEqual(a[i].side,a[i-1].side,'the notch side alternates');const p=pose(C.top,a[i]).point,q=pose(C.top,a[i-1]).point;assert(p.distanceTo(q)>.02,'consecutive swings differ at the top: '+p.distanceTo(q).toFixed(3))}
 for(const v of a)assert(v.tilt>=.2&&v.tilt<=1&&v.lift>=-.03&&v.lift<=.07&&v.snap>=1.6&&v.snap<=2.3&&v.sag>=-.06&&v.sag<=.06,'variant bounded')}
assert.notDeepEqual({...chopVariant(3,'12:-34')},{...chopVariant(3,'12:-33')},'another tree, another swing');assert.deepEqual({...chopVariant(2.7,5)},{...chopVariant(2,5)},'the index is a whole number');
// 5. Frame-rate independent: the game adds dt to elapsed and asks chopPose(elapsed/total); at 30/60/144 Hz the pose at the same time is the same, and the hit lands within one frame of CHOP_IMPACT.
{const total=swingSeconds(swingTime(1),hitsFor('axe',1)),v=chopVariant(1,'12:-34'),run=hz=>{let e=0,hit=-1;const at=[];for(let f=1;f<=Math.round(total*hz);f++){e=Math.min(total,e+1/hz);if(hit<0&&e>=CHOP_IMPACT*total)hit=e;if(f%(hz/6)===0||Math.abs(e*6-Math.round(e*6))<1e-9)at.push([Math.round(e*6),pose(e/total,v)])}return {hit,at:new Map(at)}};
 const r30=run(30),r60=run(60),r144=run(144);for(const [k,a] of r30.at){for(const r of [r60,r144]){const b=r.at.get(k);assert(b,'sampled at '+k/6+' s');assert(a.point.distanceTo(b.point)<1e-6&&Math.abs(a.lean-b.lean)<1e-6&&Math.abs(a.crouch-b.crouch)<1e-6,'same pose at '+k/6+' s')}}
 for(const [r,hz] of [[r30,30],[r60,60],[r144,144]])assert(r.hit>=CHOP_IMPACT*total-1e-9&&r.hit<CHOP_IMPACT*total+1/hz+1e-9,`the hit lands at the impact at ${hz} Hz`)}
// 6. The swing length: about 1.3-1.8 s at the base axe; felling and bucking take as long as before (one hit per swingTime) within 20 %, for every axe and level.
assert.equal(HITS_PER_SWING,2);{const s=swingSeconds(swingTime(1),hitsFor('axe',1));assert(s>=1.3&&s<=1.8,'base swing '+s)}
for(const id of AXE_IDS)for(let lv=1;lv<=MAX_LEVEL;lv++)for(const need of [hitsFor(id,lv),buckHitsFor(id,lv)]){const before=need*swingTime(lv),after=Math.ceil(need/HITS_PER_SWING)*swingSeconds(swingTime(lv),need),limit=need>=2?.2:1+1e-9;assert(Math.abs(after/before-1)<=limit,`${id} level ${lv} need ${need}: ${before.toFixed(2)} s -> ${after.toFixed(2)} s`)}
// 7. The crew (workforce-pose.js beat): a heavy swing, then a breath, and no swing is ever cut short at the end of the chop phase or the buck cut.
{const chop=FELLER_PHASE_MIN.chop*SECONDS_PER_MINUTE,cut=BUCK_CUT_END*FELLER_PHASE_MIN.buck*SECONDS_PER_MINUTE;assert(SWING_SECONDS>=1.3&&SWING_SECONDS<=1.8&&CHOP_BEAT_SECONDS>SWING_SECONDS);
 for(const end of [chop,cut])for(const e of [1e-6,1e-3,.05])assert.equal(swingAt(end-e),0,'resting, not mid-swing, at a phase end')}
console.log(`PASS chop-swing.mjs: five phases (wind-up ${C.windUp}, held beat to ${C.top}, strike to the impact at ${CHOP_IMPACT}, hit-stop to ${C.stop}, recoil to ${C.hold}, recovery), continuous at every border and the same carry pose at both ends for ${variants.length} variants, bounded, consecutive swings differ (the notch side alternates), seeded and repeatable, frame-rate independent at 30/60/144 Hz, base swing ${swingSeconds(swingTime(1),hitsFor('axe',1)).toFixed(2)} s with felling time kept, crew beat ${SWING_SECONDS}/${CHOP_BEAT_SECONDS} s.`);
