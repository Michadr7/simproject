import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CLASSES} from '../dist/vehicle.js';
import {PROPS} from '../dist/props-assets.js';
import {RIDER_GRIPS,riderSeats,riderHand,riderJiggle,STEER_ANGLE} from '../dist/driving.js';
import {SILHOUETTES} from '../dist/vehicle-hud.js';

// FV2 (notes/farm-vehicles-design.md section 5): the farm tractors get a seated driver by A5's mechanism. Group entry, seat from anchor_driver_seat, hands on anchor_hands_L/R swung about the steering_wheel node, front wheel steer, silhouettes.
const G=RIDER_GRIPS.tractor;assert(G,'the tractor group has a rider grip');assert.equal(G.pivot,'steering_wheel');assert.equal(G.hips,0);
const hipsH=.95;
for(const id of ['tractor_juff','tractor_kidbi']){
  const C=CLASSES[id],R=PROPS[id];assert.equal(C.group,'tractor');assert.equal(C.seats,1,id+' one seat');
  const seats=riderSeats(R.anchors,G);assert(seats&&seats.driver&&!seats.passenger,id+' driver seat only');
  assert.equal(seats.driver[2],R.anchors.anchor_driver_seat[2]);assert(Math.abs(seats.driver[2]-C.seat.z)<.01,id+' seat z = class seat z');assert(seats.driver[1]<R.anchors.anchor_driver_seat[1]);
  const pv=R.nodes[G.pivot];assert(pv,id+' has the steering_wheel node');assert.equal(R.wheels.filter(w=>w.front).length,2,id+' two front wheel pivots');assert.equal(C.steerMax,undefined,id+' steers by STEER_ANGLE');assert(STEER_ANGLE>0);
  for(const [side,key] of [['L','anchor_hands_L'],['R','anchor_hands_R']]){
    const h=R.anchors[key],sd=seats.driver,h0=riderHand(h,pv,0,G,sd,hipsH);
    assert(Math.abs(h0.x-(h[0]-sd[0]))<1e-9&&Math.abs(h0.z-(h[2]-sd[2]))<1e-9&&Math.abs(h0.y-(h[1]-sd[1]+hipsH))<1e-9,id+' '+side+' on the anchor straight ahead');
    const d=Math.hypot(h[0]-pv[0],h[2]-pv[2]);
    // the R75 wheel is far forward (.67 m from the shoulder straight ahead): the IK clamps, eye-check
    for(const st of [-1,-.5,.5,1]){const p=riderHand(h,pv,st,G,sd,hipsH);assert(Math.abs(Math.hypot(p.x+sd[0]-pv[0],p.z+sd[2]-pv[2])-d)<1e-9,id+' hand stays on the wheel rim');assert.equal(p.y,h0.y);assert(Math.hypot(p.x,p.y-1.45,p.z)<.8,id+' '+side+' within reach at steer '+st)}
    assert(Math.abs(riderHand(h,pv,1,G,sd,hipsH).z-h0.z)>.01||d<.01,id+' a turn moves the hand');
  }
  // jiggle: zero at rest, bounded, a function of the clock only
  assert.equal(riderJiggle(0,C.top,1.7,G),0);for(let t=0;t<5;t+=.011)assert(Math.abs(riderJiggle(C.top,C.top,t,G))<=G.jiggle+1e-12);
  assert(SILHOUETTES.includes(id),id+' has a damage silhouette');
}
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),css=readFileSync(new URL('../dist/style.css',import.meta.url),'utf8');
for(const id of ['tractor_juff','tractor_kidbi']){assert(html.includes(`data-sil="${id}"`),id+' svg in index.html');assert(css.includes(`[data-model=${id}] .vp-sil[data-sil=${id}]`),id+' css rule')}
assert(!('tow_tank' in CLASSES),'the trailer has no class, so no driver and no steering (FV3/FV4)');
console.log('Tractor driver: PASS (seat from anchor_driver_seat, hands swing about the steering_wheel node and stay in reach, two front steer pivots, jiggle bounded, silhouettes drawn)');