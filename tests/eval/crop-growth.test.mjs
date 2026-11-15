import assert from 'node:assert/strict';
import { stageOf, SEASON_RATES } from '../../notes/eval/crop-growth.mjs';

// Tests for crop-growth pure module
// Rule verification: 48h/stage, stage 3 at 144h, fertilised 1.25x, season multipliers

// 1. Fresh planting at t = 0
{
  const r = stageOf(0, 0, { season: 'spring' });
  assert.equal(r.stage, 0, 'newly planted is stage 0');
  assert.equal(r.ripe, false, 'newly planted is not ripe');
  assert.equal(r.hoursToNext, 48, '48h to stage 1');
}

// 2. Negative elapsed time (plant scheduled in future / negative delta)
{
  const r = stageOf(100, 80, { season: 'spring' });
  assert.equal(r.stage, 0, 'future planting is stage 0');
  assert.equal(r.ripe, false, 'future planting is not ripe');
  assert.equal(r.hoursToNext, 68, 'wait 20h until planting + 48h to stage 1 = 68h');
}

// 3. Mid stage 0
{
  const r = stageOf(0, 24, { season: 'spring' });
  assert.equal(r.stage, 0);
  assert.equal(r.ripe, false);
  assert.equal(r.hoursToNext, 24, '24h remaining in stage 0');
}

// 4. Exact stage boundary: 0 -> 1 (48h)
{
  const r = stageOf(0, 48, { season: 'spring' });
  assert.equal(r.stage, 1, 'at 48h transitions to stage 1');
  assert.equal(r.ripe, false);
  assert.equal(r.hoursToNext, 48, '48h to stage 2');
}

// 5. Exact stage boundary: 1 -> 2 (96h)
{
  const r = stageOf(0, 96, { season: 'spring' });
  assert.equal(r.stage, 2, 'at 96h transitions to stage 2');
  assert.equal(r.ripe, false);
  assert.equal(r.hoursToNext, 48, '48h to stage 3');
}

// 6. Exact stage boundary: 2 -> 3 (144h, ripe)
{
  const r = stageOf(0, 144, { season: 'spring' });
  assert.equal(r.stage, 3, 'at 144h transitions to stage 3');
  assert.equal(r.ripe, true, 'stage 3 is ripe');
  assert.equal(r.hoursToNext, 0, 'no next stage once ripe');
}

// 7. Huge value (well past ripe)
{
  const r = stageOf(10, 100000, { season: 'spring' });
  assert.equal(r.stage, 3, 'well past ripe stays stage 3');
  assert.equal(r.ripe, true);
  assert.equal(r.hoursToNext, 0, 'hoursToNext stays 0');
}

// 8. Fertilised growth in spring (rate = 1.25, stage duration = 38.4h)
{
  const r0 = stageOf(0, 0, { fertilised: true, season: 'spring' });
  assert.equal(r0.stage, 0);
  assert.equal(r0.hoursToNext, 38.4, '48 / 1.25 = 38.4h to stage 1');

  const r1 = stageOf(0, 38.4, { fertilised: true, season: 'spring' });
  assert.equal(r1.stage, 1, 'transitions to stage 1 at 38.4h');
  assert.equal(r1.hoursToNext, 38.4);

  const r3 = stageOf(0, 115.2, { fertilised: true, season: 'spring' });
  assert.equal(r3.stage, 3, 'ripe at 144 / 1.25 = 115.2h');
  assert.equal(r3.ripe, true);
  assert.equal(r3.hoursToNext, 0);
}

// 9. Summer season multiplier (1.0)
{
  const r = stageOf(50, 74, { season: 'summer' });
  assert.equal(r.stage, 0);
  assert.equal(r.hoursToNext, 24);
}

// 10. Autumn season multiplier (0.75, stage duration = 64h)
{
  const r0 = stageOf(0, 0, { season: 'autumn' });
  assert.equal(r0.hoursToNext, 64, '48 / 0.75 = 64h to stage 1');

  const r1 = stageOf(0, 64, { season: 'autumn' });
  assert.equal(r1.stage, 1);
  assert.equal(r1.hoursToNext, 64);

  const r3 = stageOf(0, 192, { season: 'autumn' });
  assert.equal(r3.stage, 3, '144 / 0.75 = 192h to stage 3');
  assert.equal(r3.ripe, true);
}

// 11. Winter season multiplier (0.5, stage duration = 96h)
{
  const r0 = stageOf(0, 0, { season: 'winter' });
  assert.equal(r0.hoursToNext, 96, '48 / 0.5 = 96h to stage 1');

  const r1 = stageOf(0, 96, { season: 'winter' });
  assert.equal(r1.stage, 1);
  assert.equal(r1.hoursToNext, 96);

  const r2 = stageOf(0, 192, { season: 'winter' });
  assert.equal(r2.stage, 2);
  assert.equal(r2.hoursToNext, 96);

  const r3 = stageOf(0, 288, { season: 'winter' });
  assert.equal(r3.stage, 3, '144 / 0.5 = 288h to ripe');
  assert.equal(r3.ripe, true);
  assert.equal(r3.hoursToNext, 0);
}

// 12. Winter + Fertilised (rate = 0.5 * 1.25 = 0.625, stage duration = 76.8h)
{
  const r0 = stageOf(0, 0, { fertilised: true, season: 'winter' });
  assert.equal(r0.hoursToNext, 76.8, '48 / 0.625 = 76.8h');

  const r1 = stageOf(0, 76.8, { fertilised: true, season: 'winter' });
  assert.equal(r1.stage, 1);

  const r3 = stageOf(0, 230.4, { fertilised: true, season: 'winter' });
  assert.equal(r3.stage, 3, '144 / 0.625 = 230.4h to ripe');
  assert.equal(r3.ripe, true);
  assert.equal(r3.hoursToNext, 0);
}

// 13. High baseline time offset (e.g. day 100)
{
  const base = 2400; // 100 days in
  const r = stageOf(base, base + 48, { season: 'spring' });
  assert.equal(r.stage, 1);
  assert.equal(r.hoursToNext, 48);
}

// 14. Negative absolute timestamps
{
  const r = stageOf(-100, -52, { season: 'spring' });
  assert.equal(r.stage, 1, 'elapsed is 48h regardless of negative timestamp base');
  assert.equal(r.hoursToNext, 48);
}

console.log('PASS crop-growth.test.mjs: 14 test cases covering stages 0..3, ripeness, hoursToNext, negative elapsed time, exact boundaries, huge values, fertilised rate, and all season multipliers.');
