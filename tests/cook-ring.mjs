// Pure unit tests for dist/cook-ring.js (notes/cooking-design.md section 3 & 8, L-PURE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 RING_CENTER,BURN_AT,QUALITY_MULT,ringProgress,sweetSpot,ringResult
} from '../dist/cook-ring.js';

// 1. Frame-rate independent progress helper.
assert.equal(ringProgress(0,4),0);
assert.equal(ringProgress(2,4),0.5);
assert.equal(ringProgress(6,4),1,'clamped at 1');
assert.equal(ringProgress(-1,4),0,'clamped at 0');
assert.equal(ringProgress(2,0),0,'safe on 0 totalSec');
assert.equal(ringProgress(NaN,4),0,'safe on NaN');

// 2. Sweet spot widens with hospitalityLevel and stays inside bounds.
{
 const s1=sweetSpot(1),s10=sweetSpot(10),s20=sweetSpot(20);
 assert(s1.goodStart<s1.perfectStart&&s1.perfectStart<RING_CENTER&&RING_CENTER<s1.perfectEnd&&s1.perfectEnd<s1.goodEnd&&s1.goodEnd<s1.burnAt);
 assert(s10.goodEnd-s10.goodStart>s1.goodEnd-s1.goodStart,'level 10 widens good window');
 assert(s10.perfectEnd-s10.perfectStart>s1.perfectEnd-s1.perfectStart,'level 10 widens perfect window');
 assert(s20.goodEnd<BURN_AT,'never overlaps burnAt');
}

// 3. ringResult returns exact quality bands and multipliers.
{
 const s=sweetSpot(1);
 assert.deepEqual(ringResult(0.1,1),{quality:'ok',mult:QUALITY_MULT.ok});
 assert.deepEqual(ringResult(s.goodStart,1),{quality:'good',mult:QUALITY_MULT.good});
 assert.deepEqual(ringResult(RING_CENTER,1),{quality:'perfect',mult:QUALITY_MULT.perfect});
 assert.deepEqual(ringResult(s.goodEnd,1),{quality:'good',mult:QUALITY_MULT.good});
 assert.deepEqual(ringResult(s.goodEnd+0.01,1),{quality:'ok',mult:QUALITY_MULT.ok});
 assert.deepEqual(ringResult(BURN_AT,1),{quality:'burnt',mult:QUALITY_MULT.burnt});
 assert.deepEqual(ringResult(1.0,20),{quality:'burnt',mult:QUALITY_MULT.burnt});
 assert.deepEqual(ringResult(NaN,1),{quality:'ok',mult:QUALITY_MULT.ok});
}

// 4. Purity: no DOM, no clock, no random, no three.js.
{
 const src=fs.readFileSync(new URL('../dist/cook-ring.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'cook-ring.js must not use '+bad);
 assert(!/from '\.\/(game|driving|phone)/.test(src));
}

console.log('PASS Cook-ring: frame-rate independent progress, hospitality-widened sweet spot, burnt/ok/good/perfect scoring, and purity.');
