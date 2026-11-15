import assert from 'node:assert/strict';
import { seamPath, tipMotion, weldSampler, TUNING } from '../dist/weld-core.js';

const path = seamPath([[0,0,0],[.25,0,0]]);
function replay(speed, offset = 0, stop = 0, portion = 1) {
  const s = weldSampler(path);
  const segments = [];
  const step = (p,t) => s.update(p,t,true,0,(x) => segments.push(x));
  step([0,0,offset],0);
  const pivot = 25;
  for (let i = 1; i <= 50*portion; i++) {
    const point = [i*.005,0,offset];
    const time = i*.005/speed + (i > pivot ? stop : 0);
    step(point,time);
    if (stop && i === pivot) {
      for (let j = 1; j <= 10; j++) step(point,time+stop*j/10);
    }
  }
  return { ...s.finish(), segments };
}
const clean = replay(TUNING.idealSpeed);
assert.ok(clean.score >= 95);
assert.ok(replay(.16).score < 45);
assert.ok(replay(.055,.012).score < 20);
const stopped = replay(.055,0,4);
assert.ok(stopped.score < 55);
assert.ok(stopped.sound === undefined && stopped.worst.some(x=>x.defect === 'burn-through'));
assert.ok(replay(.055,0,0,.2).score <= 20);
assert.equal(weldSampler(path).finish().score,0);
const origin = [0,0,0], target = [.10,0,0];
const amplitude = braced => Math.max(...Array.from({length:100},(_,i) =>
  Math.hypot(...tipMotion(origin,i/60,34,braced ? origin : null))));
assert.ok(amplitude(true) < amplitude(false)/2);
assert.ok(Math.hypot(...tipMotion(target,.1,34,origin)) <= TUNING.braceReach + 1e-9);
assert.deepEqual(tipMotion(target,.2,34),tipMotion(target,.2,34));
assert.notDeepEqual(tipMotion(target,.2,34),tipMotion(target,.2,35));
const corner = seamPath([[0,0,0],[1,0,0],[1,0,1]]);
assert.deepEqual(corner.pointAt(1.5),[1,0,.5]);
assert.equal(corner.nearest([1,0,.5]).at,1.5);
assert.ok(clean.segments.every((x,i,a)=>i===0 || x.from === a[i-1].point));
const lift = weldSampler(path);
lift.update([0,0,0],0,true);
lift.update([0,.03,0],.1,true,.03);
lift.update([.01,0,0],.2,true);
lift.update([.02,0,0],.3,true);
assert.ok(lift.finish().worst.some(x=>x.defect==='porosity'));
console.log('Weld score, coverage, dwell, speed, drift, seeded shake, brace reach, lift and path tests passed.');
