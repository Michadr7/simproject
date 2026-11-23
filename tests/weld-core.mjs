import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  seamPath, tipMotion, weldSampler, TUNING,
  EDEN_HOURS, WELD_JOBS, SHIPPING_TASKS, normalizeEdenWork,
  startWeldJob, scoreWeldPass, completeShippingTask,
} from '../dist/weld-core.js';
import { freshProgress } from '../dist/jobs.js';
import { addXp, levelOf } from '../dist/skills.js';

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

// E-I3 & WJ: Eden welding & shipping dock shift rules.
assert.deepEqual(EDEN_HOURS, [360, 1080]);
assert.equal(WELD_JOBS.length, 5);
assert.deepEqual(WELD_JOBS.map(j => j.id), ['bracket-t1', 'gusset-t2', 'hitch-t3', 'rail-t4', 'atv-frame-t5']);
assert.deepEqual(WELD_JOBS.map(j => j.tier), [1, 2, 3, 4, 5]);
for (const job of WELD_JOBS) {
  assert.ok(job.name && job.minLevel >= 1 && job.basePayCents > 0 && job.xp > 0);
  const p = seamPath(job.points);
  assert.ok(p.length > 0.15 && p.edgeCount >= 1, `valid 3D seam path for ${job.id}`);
}

const edenProg = (minutes = 540, weldingXp = 0, extra = {}) => ({
  ...freshProgress(),
  routine: { ...freshProgress().routine, minutes },
  skills: { ...freshProgress().skills, ...(weldingXp ? { welding: { xp: weldingXp } } : {}) },
  ...extra,
});

// 1. Hours & level gates on startWeldJob
assert.ok(startWeldJob(edenProg(359), 'bracket-t1').error, 'closed before 6 AM');
assert.ok(startWeldJob(edenProg(1080), 'bracket-t1').error, 'closed at 6 PM');
assert.ok(startWeldJob(edenProg(540), 'unknown-part').error, 'unknown job rejected');
assert.ok(startWeldJob(edenProg(540, 0), 'gusset-t2').error, 'tier 2 blocked at welding level 1');
assert.ok(startWeldJob(edenProg(540, 0), 'atv-frame-t5').error, 'tier 5 blocked at welding level 1');
assert.ok(!startWeldJob(edenProg(360), 'bracket-t1').error, 'open at 6:00 AM');
assert.ok(!startWeldJob(edenProg(1079), 'bracket-t1').error, 'open at 5:59 PM');

// Level 5 unlocks all tiers; input progress is not mutated
const baseP = edenProg(540, 0);
const lv5 = addXp(baseP, 'welding', 280).state;
assert.ok(levelOf(lv5.skills.welding.xp).level >= 5);
const startedT1 = startWeldJob(baseP, 'bracket-t1');
assert.equal(startedT1.state.edenWork.active, 'bracket-t1');
assert.equal(baseP.edenWork, undefined, 'startWeldJob does not mutate input');
assert.equal(startWeldJob(lv5, 'atv-frame-t5').state.edenWork.active, 'atv-frame-t5');

// 2. scoreWeldPass: requires active job, real weldSampler A vs poor D payout, XP, standing, time, bestGrade
assert.ok(scoreWeldPass(baseP).error, 'cannot score without an active job');
for (const job of WELD_JOBS) {
  const s = startWeldJob(lv5, job.id);
  assert.ok(!s.error);
  const res = scoreWeldPass(s.state);
  assert.ok(!res.error, res.error);
  assert.equal(res.grade, 'A', `${job.id} default pass scores A (got ${res.score})`);
  assert.ok(res.score >= 90);
  assert.equal(res.paid, Math.round(job.basePayCents * 1.3));
}

const gradeA = scoreWeldPass(startedT1.state);
assert.equal(gradeA.grade, 'A');
assert.equal(gradeA.paid, 2340);
assert.equal(gradeA.state.cash, 2340);
assert.equal(gradeA.state.routine.earned, 2340);
assert.equal(gradeA.state.routine.minutes, 560);
assert.equal(gradeA.state.skills.welding.xp, 16);
assert.equal(gradeA.state.standing.town, 1);
assert.deepEqual(gradeA.state.edenWork, { active: null, jobsDone: 1, lastDay: 1, bestGrade: 'A' });

// Deterministic seeded pass & poor Grade D payout (no town standing on C/D)
const unbraced = scoreWeldPass(startedT1.state, { braced: false, errorMm: 3.5, seed: 1 });
const bracedPass = scoreWeldPass(startedT1.state, { braced: true, errorMm: 3.5, seed: 1 });
assert.ok(unbraced.score < bracedPass.score, 'unbraced pass scores lower than braced pass');
const slowD = scoreWeldPass(startedT1.state, { speed: 0.005 });
assert.equal(slowD.grade, 'D');
assert.equal(slowD.score, 0);

const poorOpts = { speed: 0.16, errorMm: 9, braced: false, seed: 7 };
const gradeD1 = scoreWeldPass(startedT1.state, poorOpts);
const gradeD2 = scoreWeldPass(startedT1.state, poorOpts);
assert.equal(gradeD1.score, gradeD2.score);
assert.equal(gradeD1.grade, 'D');
assert.ok(gradeD1.score < 55);
assert.equal(gradeD1.paid, Math.round(1800 * 0.35));
assert.equal(gradeD1.standingGain, 0);
assert.equal(gradeD1.state.standing.town, undefined);
assert.equal(gradeD1.state.skills.welding.xp, 16);
assert.deepEqual(gradeD1.state.edenWork, { active: null, jobsDone: 1, lastDay: 1, bestGrade: 'D' });

// bestGrade tracks A > B > C > D and precomputed {score, grade} overrides simulation
const s2 = startWeldJob(gradeD1.state, 'bracket-t1').state;
const gradeC = scoreWeldPass(s2, { score: 65, grade: 'C' });
assert.equal(gradeC.paid, Math.round(1800 * 0.7));
assert.equal(gradeC.standingGain, 0);
assert.equal(gradeC.state.edenWork.bestGrade, 'C');
assert.equal(gradeC.state.edenWork.jobsDone, 2);

const s3 = startWeldJob(gradeC.state, 'bracket-t1').state;
const gradeB = scoreWeldPass(s3, { score: 82, grade: 'B' });
assert.equal(gradeB.paid, 1800);
assert.equal(gradeB.standingGain, 1);
assert.equal(gradeB.state.standing.town, 1);
assert.equal(gradeB.state.edenWork.bestGrade, 'B');

const s4 = startWeldJob(gradeB.state, 'bracket-t1').state;
assert.equal(s4.edenWork.jobsDone, 3);
assert.equal(s4.edenWork.bestGrade, 'B');
const afterD = scoreWeldPass(s4, poorOpts);
assert.equal(afterD.grade, 'D');
assert.equal(afterD.state.edenWork.bestGrade, 'B', 'bestGrade never regresses');

// Minimal progress objects work safely without skills/housing/standing pre-populated
const minStart = startWeldJob({ routine: { minutes: 540 } }, 'bracket-t1');
assert.ok(!minStart.error);
const minPass = scoreWeldPass(minStart.state);
assert.equal(minPass.grade, 'A');
assert.equal(minPass.state.edenWork.lastDay, 1);
assert.equal(completeShippingTask({ routine: { minutes: 540 } }).paid, 1600);

// 3. completeShippingTask: hours gate, pay, +10 driving XP, +15 minutes
assert.ok(completeShippingTask(edenProg(359), 'load-steel').error);
assert.ok(completeShippingTask(edenProg(1080), 'check-manifest').error);
assert.ok(completeShippingTask(edenProg(540), 'bad-task').error);
const ship1 = completeShippingTask(baseP);
assert.equal(ship1.paid, SHIPPING_TASKS['load-steel'].payCents);
assert.equal(ship1.paid, 1600);
assert.equal(ship1.state.cash, 1600);
assert.equal(ship1.state.routine.earned, 1600);
assert.equal(ship1.state.routine.minutes, 555);
assert.equal(ship1.state.skills.driving.xp, 10);

const ship2 = completeShippingTask(ship1.state, 'check-manifest');
assert.equal(ship2.paid, 1400);
assert.equal(ship2.state.cash, 3000);
assert.equal(ship2.state.routine.earned, 3000);
assert.equal(ship2.state.routine.minutes, 570);
assert.equal(ship2.state.skills.driving.xp, 20);

// 4. normalizeEdenWork empty omission, junk sanitation & JSON round-trip
for (const empty of [undefined, null, [], 'bad', {}, { active: null, jobsDone: 0, lastDay: 0, bestGrade: null }, { active: 'nope', jobsDone: -1, lastDay: 'x', bestGrade: 'Z' }]) {
  assert.equal(normalizeEdenWork(empty), null);
}
const sampleWork = { active: 'rail-t4', jobsDone: 4, lastDay: 3, bestGrade: 'B' };
assert.deepEqual(normalizeEdenWork(JSON.parse(JSON.stringify(sampleWork))), sampleWork);
assert.deepEqual(normalizeEdenWork({ active: 'missing', jobsDone: 2, lastDay: 5, bestGrade: 'A' }), { active: null, jobsDone: 2, lastDay: 5, bestGrade: 'A' });

// 5. Pure module check (no DOM, clock, Math.random, or three import)
{
  const src = fs.readFileSync(new URL('../dist/weld-core.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const bad of ['document', 'window', 'Date.now', 'Math.random', 'performance.now', 'three']) {
    assert.ok(!src.includes(bad), `weld-core.js must not reference ${bad}`);
  }
}

console.log('PASS weld-core: seam sampler + E-I3/WJ jobs, hours/level gates, A..D payouts, welding/driving XP, shipping tasks, and normalizeEdenWork.');
