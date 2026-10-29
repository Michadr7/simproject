import assert from 'node:assert/strict';
import {substeps,MAX_STEP,MAX_FRAME} from '../dist/timestep.js';

assert.deepEqual(substeps(0),{count:0,step:0});assert.deepEqual(substeps(-1),{count:0,step:0});assert.deepEqual(substeps(NaN),{count:0,step:0});
assert.deepEqual(substeps(.016),{count:1,step:.016});assert.deepEqual(substeps(1/30),{count:1,step:1/30});
const slow=substeps(.1);assert.equal(slow.count,3);assert(Math.abs(slow.step*slow.count-.1)<1e-12);
const stalled=substeps(5);assert(Math.abs(stalled.count*stalled.step-MAX_FRAME)<1e-12,'a stalled frame is clipped to 0.25 s');assert.equal(stalled.count,8);

// The same ground and the same hunger at any frame rate: 5 seconds of real time, at 10, 30, 60 and 144 FPS (and an uneven 20-90 ms mix).
const run=frames=>{let time=0,distance=0,hunger=0,biggest=0;for(const real of frames){const {count,step}=substeps(real);for(let i=0;i<count;i++){distance+=4.5*step;hunger+=.05*step;time+=step;biggest=Math.max(biggest,step)}}return {time,distance,hunger,biggest}};
const at=fps=>run(Array.from({length:fps*5},()=>1/fps));
const mixed=[];for(let t=0,i=0;t<5-1e-9;i++){const ms=[.02,.09,.04,.06][i%4];mixed.push(Math.min(ms,5-t));t+=ms}
const reference=at(60);
for(const [name,r] of [['10 FPS',at(10)],['30 FPS',at(30)],['60 FPS',reference],['144 FPS',at(144)],['uneven',run(mixed)]]){
 assert(Math.abs(r.time-5)<1e-6,`${name}: simulated time ${r.time}`);assert(Math.abs(r.distance-22.5)<1e-6,`${name}: distance ${r.distance}`);assert(Math.abs(r.hunger-reference.hunger)<1e-9,`${name}: hunger`);assert(r.biggest<=MAX_STEP+1e-12,`${name}: no slice over 1/30 s`);
}
// Movement per slice stays under the collision radius even at sprint speed.
assert(8.2*MAX_STEP<.33);
console.log('Timestep (equal slices up to 1/30 s; the same distance, clock and hunger at 10, 30, 60 and 144 FPS) passed.');
