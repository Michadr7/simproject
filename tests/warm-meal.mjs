// Pure unit tests for dist/warm-meal.js (notes/cooking-design.md section 3 & 8, L-PURE).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 WARM_MEAL_CONFIG,freshWarmMeal,normalizeWarmMeal,applyBuff,drainFactor
} from '../dist/warm-meal.js';

// 1. Fresh & normalization of corrupt/old values.
assert.deepEqual(freshWarmMeal(),{untilGameMin:0,drainMult:1});
assert.deepEqual(normalizeWarmMeal(null),{untilGameMin:0,drainMult:1});
assert.deepEqual(normalizeWarmMeal({untilGameMin:-5,drainMult:0.1}),{untilGameMin:0,drainMult:1});
assert.deepEqual(normalizeWarmMeal({untilGameMin:500,drainMult:0.8}),{untilGameMin:500,drainMult:0.8});
assert.deepEqual(normalizeWarmMeal({untilGameMin:500,drainMult:0.1}),{untilGameMin:500,drainMult:1},'clamps invalid mult to 1');

// 2. applyBuff & drainFactor across qualities and expiry.
{
 const s0=freshWarmMeal();
 assert.equal(drainFactor(s0,100),1);

 const burnt=applyBuff(s0,100,'burnt');
 assert.deepEqual(burnt,{untilGameMin:0,drainMult:1},'burnt meal grants no buff');

 const good=applyBuff(s0,100,'good');
 assert.deepEqual(good,{untilGameMin:100+WARM_MEAL_CONFIG.good.durationMin,drainMult:0.8});
 assert.equal(drainFactor(good,100),0.8);
 assert.equal(drainFactor(good,279),0.8);
 assert.equal(drainFactor(good,280),1,'expired at untilGameMin');

 // Applying a weaker/shorter buff while active never shortens or weakens the existing buff.
 const okAfter=applyBuff(good,120,'ok');
 assert.equal(okAfter.untilGameMin,280);
 assert.equal(okAfter.drainMult,0.8);

 // Applying perfect extends and upgrades drainMult.
 const perf=applyBuff(good,150,'perfect');
 assert.equal(perf.untilGameMin,150+WARM_MEAL_CONFIG.perfect.durationMin);
 assert.equal(perf.drainMult,0.75);

 // JSON round-trip is plain & stable.
 assert.deepEqual(normalizeWarmMeal(JSON.parse(JSON.stringify(perf))),perf);
}

// 3. Purity: no DOM, no clock, no random, no three.js.
{
 const src=fs.readFileSync(new URL('../dist/warm-meal.js',import.meta.url),'utf8').replace(/\/\/.*$/gm,'');
 for(const bad of ['document','window','Date.now','Math.random','performance.now','three'])assert(!src.includes(bad),'warm-meal.js must not use '+bad);
 assert(!/from '\.\/(game|driving|phone)/.test(src));
}

console.log('PASS Warm-meal: plain serialisable state, applyBuff by quality without weakening active buffs, drainFactor expiry, and purity.');
