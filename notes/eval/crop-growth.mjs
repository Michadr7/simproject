// Pure module: crop growth stage calculation
// Rules:
// - 2 game days (48 h) per stage, 6 days seed to ripe is stage 3 at 144 h
// - fertilised grows 25% faster (growth rate * 1.25)
// - season multipliers: spring 1, summer 1, autumn .75, winter .5 (applied to growth rate)
// - returns: {stage 0..3, ripe: bool, hoursToNext}

export const SEASON_RATES = Object.freeze({
  spring: 1.0,
  summer: 1.0,
  autumn: 0.75,
  winter: 0.5,
});

export function stageOf(plantedHours, nowHours, { fertilised = false, season = 'spring' } = {}) {
  const sKey = (season || 'spring').toLowerCase();
  const seasonMult = SEASON_RATES[sKey] ?? 1.0;
  const fertMult = (fertilised || arguments[2]?.fertilized) ? 1.25 : 1.0;
  const rate = seasonMult * fertMult;

  const waitHours = Math.max(0, plantedHours - nowHours);
  const elapsed = Math.max(0, nowHours - plantedHours);
  const effectiveHours = elapsed * rate;

  let stage = 0;
  if (effectiveHours >= 144) {
    stage = 3;
  } else if (effectiveHours >= 96) {
    stage = 2;
  } else if (effectiveHours >= 48) {
    stage = 1;
  } else {
    stage = 0;
  }

  const ripe = stage === 3;
  let hoursToNext = 0;
  if (!ripe) {
    const nextEffective = (stage + 1) * 48;
    const remainingEffective = nextEffective - effectiveHours;
    hoursToNext = waitHours + remainingEffective / rate;
  }

  return {
    stage,
    ripe,
    hoursToNext: +hoursToNext.toFixed(4),
  };
}
