import assert from 'node:assert/strict';
import {resolveObjective} from '../dist/objective.js';

const world={marketDoor:{x:19,z:-8.3},counter:{local:{x:-2,z:-1},world:{x:17,y:.165,z:-14.5}},cafeDoor:{x:36,z:-6.3}};
const delivery={x:40,z:12,name:'Cafe Box'};
const streetGig={id:'g1',stage:'travel',location:{x:-20,z:30,room:'street'}},cafeGig={id:'g2',stage:'travel',location:{x:2,z:-3,room:'cafe'}};
const gigTarget=job=>job.location;
const solve=(progress,place={},room='street')=>resolveObjective({progress,place,room,gigTarget,delivery,world});
const idle={phase:'available',activeJob:null},carrying={phase:'carrying',activeJob:null};

// No gig, nothing carried: the market. From the street, its doorway; inside, the counter (in the shop's own coordinates).
let r=solve(idle);assert.equal(r.kind,'door');assert.deepEqual(r.aim,{x:19,z:-8.3});assert.deepEqual(r.beacon,{x:19,z:-8.3,y:0,lift:.7,hideWithin:2.4});
r=solve(idle,{shop:'market'},'market');assert.equal(r.kind,'counter');assert.deepEqual(r.aim,{x:-2,z:-1},'the arrow aims in shop-local space');assert.deepEqual(r.beacon,{x:17,z:-14.5,y:.165,lift:0,hideWithin:1.8,local:{x:-2,z:-1}},'the beacon is drawn in world space');
// Elsewhere there is nothing to point at.
for(const place of [{shop:'cafe'},{inside:true}]){r=solve(idle,place);assert.equal(r.kind,'none');assert.equal(r.aim,null);assert.equal(r.beacon,null)}
// Carrying an order: the drop-off, but only outdoors.
r=solve(carrying);assert.equal(r.kind,'delivery');assert.deepEqual(r.aim,{x:40,z:12});assert.deepEqual(r.beacon,{x:40,z:12,y:0,lift:0,hideWithin:0});
for(const place of [{shop:'market'},{shop:'cafe'},{inside:true}])assert.equal(solve(carrying,place).kind,'none');

// A gig outranks everything (the bug: the market beacon overwrote the gig arrow, and kept showing during a gig).
for(const base of [idle,carrying]){
 r=solve({...base,activeJob:streetGig});assert.equal(r.kind,'gig');assert.deepEqual(r.aim,streetGig.location,'the arrow points at the gig');assert.equal(r.beacon,null,'no market beacon during a gig');
 r=solve({...base,activeJob:streetGig},{shop:'market'},'market');assert.equal(r.kind,'gig');assert.equal(r.aim,null,'inside a shop, a street gig has no arrow');assert.equal(r.beacon,null);
}
// A cafe gig: from the street it points at the cafe's door; inside the cafe, at the task itself.
r=solve({...idle,activeJob:cafeGig});assert.equal(r.kind,'gig');assert.deepEqual(r.aim,{x:36,z:-6.3});assert.deepEqual(r.gig.display,{x:36,z:-6.3});
r=solve({...idle,activeJob:cafeGig},{shop:'cafe'},'cafe');assert.deepEqual(r.aim,cafeGig.location);assert.deepEqual(r.gig.display,cafeGig.location);
// The street gig, standing in the street: arrow and marker agree.
r=solve({...idle,activeJob:streetGig});assert.equal(r.gig.here,true);assert.deepEqual(r.gig.display,streetGig.location);
// One call, one answer: nothing is shared between calls.
assert.notEqual(solve(idle),solve(idle));
console.log('Objective resolver (gig outranks delivery outranks the market; shop-local versus world space; no stray beacon) passed.');
