// Event windows retain a long frame's trailing gap and include the frame that marks a render.
import assert from 'node:assert/strict';
import {summarize} from '../scripts/hitch-capture.mjs';

const events = [
  {name: 'early-play', atMs: 0},
  {name: 'play-handler-return', atMs: 1, cpuActionMs: 1},
  {name: 'first-play-frame', atMs: 512, frameIndex: 1},
  {name: 'high-to-low', atMs: 3000},
  {name: 'low-to-high', atMs: 7500},
  {name: 'finished', atMs: 9500}
];
const frame = (atMs, gapMs, cpuFrameMs, cpuRenderMs) => ({atMs, gapMs, cpuFrameMs, cpuRenderMs, renders: 1});
const frames = [
  frame(100, null, 10, 5), frame(500, 400, 25, 20), frame(530, 30, 4, 2),
  frame(2995, 5, 4, 2), frame(3005, 10, 2250, 2200), frame(5260, 2255, 5, 3),
  frame(7495, 6, 5, 3), frame(7501, 6, 7, 5), frame(7508, 7, 5, 3)
];
const [play, world, low, high] = summarize({events, frames, firstWorldAt: 512});
assert.equal(play.playToFirstRenderMs, 512);
assert.equal(play.actionCpuMs, 1);
assert.equal(world.maxCpuRenderMs, 20);
assert.equal(low.maxCpuRenderMs, 2200);
assert.equal(low.maxGapMs, 2255);
assert.equal(high.maxGapMs, 7);

console.log('PASS hitch-capture: first render owns its CPU sample and a long quality-switch gap stays with its trigger');
