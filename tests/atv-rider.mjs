import assert from 'node:assert/strict';
import {CLASSES} from '../dist/vehicle.js';
import {PROPS} from '../dist/props-assets.js';
import {RIDER_GRIPS,riderSeats,riderHand,riderJiggle,STEER_ANGLE} from '../dist/driving.js';

// A5 (notes/atv-handling-design.md, stage A5): the ATV rider. Seat from the model's anchor, hands on the handlebar anchors turned with the steering, steer cap, jiggle, one seat.
const A=CLASSES.atv,R=PROPS.atv,G=RIDER_GRIPS[A.group];
assert(G,'the atv group has a rider grip');
const seats=riderSeats(R.anchors,G);assert(seats&&seats.driver&&!seats.passenger,'one seat, no passenger seat');assert.equal(A.seats,1);
assert.equal(seats.driver[0],0);assert.equal(seats.driver[2],A.seat.z,'seat z = the class seat z (-.30)');assert(Math.abs(seats.driver[1]-(R.anchors.anchor_driver_seat[1]-G.sit))<1e-9&&seats.driver[1]<R.anchors.anchor_driver_seat[1]);
assert.equal(riderSeats(undefined,G),null);assert.equal(riderSeats(R.anchors,undefined),null,'a vehicle with no grip entry (an unknown group) gets no seat');
assert.equal(G.hips,0);
// steer cap
assert.equal(A.steerMax,.52);assert(A.steerMax>STEER_ANGLE&&A.steerMax<=.5236,'about 30 degrees');assert.equal(R.wheels.filter(w=>w.front).length,2,'two front wheel pivots');
// hands: straight ahead they sit on the anchors (relative to the seat), turning moves them about the handlebar pivot
const pv=R.nodes[G.pivot],hipsH=.95,L=R.anchors.anchor_hands_L,sd=seats.driver;
const h0=riderHand(L,pv,0,G,sd,hipsH);assert(Math.abs(h0.x-(L[0]-sd[0]))<1e-9&&Math.abs(h0.z-(L[2]-sd[2]))<1e-9&&Math.abs(h0.y-(L[1]-sd[1]+hipsH))<1e-9);
const hl=riderHand(L,pv,1,G,sd,hipsH),hr=riderHand(L,pv,-1,G,sd,hipsH);
assert(Math.abs(Math.hypot(hl.x+sd[0]-pv[0],hl.z+sd[2]-pv[2])-Math.hypot(L[0]-pv[0],L[2]-pv[2]))<1e-9,'a turn keeps the hand at the same distance from the pivot');
assert(Math.abs(hl.z-h0.z)>.01&&hl.z!==hr.z&&hl.y===h0.y,'a turn moves the hand forward/back, not up');
const hands=Math.hypot(h0.x,h0.y-1.45,h0.z);assert(hands<.75,'hand within an arm of the shoulder ('+hands.toFixed(2)+' m)');
// jiggle: zero at rest, bounded, a function of the clock only
assert.equal(Math.abs(riderJiggle(0,A.top,1.3,G)),0);for(let t=0;t<5;t+=.013)assert(Math.abs(riderJiggle(A.top,A.top,t,G))<=G.jiggle+1e-12);
assert.equal(riderJiggle(A.top,A.top,.5,G),riderJiggle(A.top,A.top,.5,G));
console.log('ATV rider: PASS (seat anchor from anchor_driver_seat, no passenger seat, steer cap .52 rad, hands turn about the handlebar pivot and stay in reach, jiggle bounded)');