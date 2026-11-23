// Pure fishing rules for notes/map-master.md sections 4.2 and 4.6, stage B4.
import {fishingWeatherMod} from './weather.js';
export const FISHING_SKILL = 'fishing';
export const FISHING_LOG_LIMIT = 30;
export const FISHING_TIMING = Object.freeze({
  biteMinSeconds: 2.5,
  biteMaxSeconds: 7.5,
  peakWaitMultiplier: .65,
  lureWaitMultiplier: .85,
  biteWindowSeconds: 1.2,
  biteWindowPerLevel: .04,
  maxBiteWindowBonus: .6,
  initialTension: .4,
  surgeSeconds: .8,
  reelSeconds: 3.2,
  maxFightSeconds: 18,
});

const species = (name, minGrams, maxGrams, centsPerKg, xp, strength) =>
  Object.freeze({ name, minGrams, maxGrams, centsPerKg, xp, strength });

export const FISHING_SPECIES = Object.freeze({
  bass: species('Bass', 450, 3600, 850, 12, .09),
  perch: species('Perch', 120, 1050, 650, 8, .03),
  trout: species('Trout', 220, 2250, 1050, 14, .11),
  catfish: species('Catfish', 650, 5400, 740, 15, .14),
  mackerel: species('Mackerel', 180, 1250, 790, 10, .07),
  flounder: species('Flounder', 250, 1950, 940, 12, .08),
  seabass: species('Sea bass', 550, 4200, 1200, 16, .15),
});

const pool = weights => Object.freeze(Object.entries(weights).map(
  ([speciesId, weight]) => Object.freeze({ speciesId, weight })));

export const FISHING_CATCH_TABLES = Object.freeze({
  'blackstone-lake': pool({ bass: 55, perch: 45 }),
  'stream-mouth': pool({ trout: 75, perch: 25 }),
  'outflow-weir': pool({ catfish: 70, bass: 30 }),
  'kaspian-bay': pool({ mackerel: 55, flounder: 30, seabass: 15 }),
});

const LAKE_SPOTS = Object.freeze(['dock-end', 'stream-mouth', 'outflow-weir', 'rocky-point', 'p1-shore']);
const BAITS = Object.freeze(['worms', 'lure']);
const TIME_EPSILON = 1e-9;
const minuteOfDay = minutes => ((minutes % 1440) + 1440) % 1440;

export function isFishingPeak(minutes) {
  const minute = minuteOfDay(minutes);
  return (minute >= 300 && minute < 480) || (minute >= 1020 && minute < 1200);
}

// Match a fishingAt() result. Open sea needs a region from the caller.
export function fishingWaterFor(location, region) {
  const { kind, id } = location ?? {};
  if (kind === 'spot' && LAKE_SPOTS.includes(id)) return 'blackstone-lake';
  if (kind === 'basin' && id === 'lake-basin') return 'blackstone-lake';
  if (kind === 'water' && id === 'lake' && region === 'blackstone-lake') return 'blackstone-lake';
  if (kind === 'water' && id === 'sea' && region === 'kaspian-bay') return 'kaspian-bay';
  return null;
}

// Separate seed streams make bite timing, species and weight independent of frame stepping.
function roll(seed, stream) {
  let value = (seed + Math.imul(stream, 0x9e3779b9)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x100000000;
}

function catchFor(waterId, spotId, seed) {
  const table = FISHING_CATCH_TABLES[spotId] ?? FISHING_CATCH_TABLES[waterId];
  const total = table.reduce((sum, entry) => sum + entry.weight, 0);
  let ticket = roll(seed, 2) * total;
  const { speciesId } = table.find(entry => (ticket -= entry.weight) < 0);
  const { minGrams, maxGrams, centsPerKg, xp } = FISHING_SPECIES[speciesId];
  const weightGrams = minGrams + Math.floor(roll(seed, 3) * (maxGrams - minGrams + 1));
  return { waterId, spotId, speciesId, weightGrams, valueCents: Math.round(weightGrams * centsPerKg / 1000), xp };
}

// On success, the caller consumes one worm when requested and owns the transient session.
export function castFishing({ location, region, hasRod, bait, seed, minutes, level = 1, weather = null } = {}) {
  const waterId = fishingWaterFor(location, region);
  if (!waterId) return { error: 'invalid-water' };
  if (hasRod !== true) return { error: 'need-rod' };
  if (!BAITS.includes(bait)) return { error: 'need-bait' };
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) return { error: 'invalid-seed' };

  const timing = FISHING_TIMING;
  const skillLevel = Number.isFinite(level) ? Math.max(1, Math.floor(level)) : 1;
  const wait = timing.biteMinSeconds + roll(seed, 1) * (timing.biteMaxSeconds - timing.biteMinSeconds);
  const wMod = weather ? fishingWeatherMod(weather).waitMult : 1;
  const biteAt = wait * (isFishingPeak(minutes) ? timing.peakWaitMultiplier : 1)
    * (bait === 'lure' ? timing.lureWaitMultiplier : 1) * wMod;
  const biteUntil = biteAt + timing.biteWindowSeconds
    + Math.min(timing.maxBiteWindowBonus, (skillLevel - 1) * timing.biteWindowPerLevel);
  const spotId = location.kind === 'spot' ? location.id : null;
  return {
    consumeBait: bait === 'worms',
    state: { phase: 'waiting', waterId, spotId, seed, biteAt, biteUntil, elapsed: 0 },
  };
}

const finished = (state, reason) => ({ state: { ...state, phase: 'ended', reason } });

// Apply the hook press at the current state time. The bite interval is [biteAt, biteUntil).
export function hookFishing(state) {
  if (state.phase === 'waiting') return finished(state, 'early-hook');
  if (state.phase !== 'bite') return { state };
  const fish = catchFor(state.waterId, state.spotId, state.seed);
  return {
    state: { ...state, phase: 'reeling', elapsed: 0, tension: FISHING_TIMING.initialTension, progress: 0, fish },
  };
}

export function cancelFishing(state) {
  return state.phase === 'ended' ? { state } : finished(state, 'cancelled');
}

// Keep the reel input constant across dt (seconds). Integrate each constant-rate
// segment up to the first terminal event, including when a step spans a surge.
export function stepFishing(state, dt, reeling = false) {
  if (!Number.isFinite(dt) || dt <= 0 || state.phase === 'ended') return { state };
  if (state.phase !== 'reeling') {
    let elapsed = Math.min(state.elapsed + dt, state.biteUntil);
    if (Math.abs(elapsed - state.biteAt) <= TIME_EPSILON) elapsed = state.biteAt;
    if (state.biteUntil - elapsed <= TIME_EPSILON) elapsed = state.biteUntil;
    const next = { ...state, elapsed, phase: elapsed >= state.biteAt ? 'bite' : 'waiting' };
    return elapsed >= state.biteUntil ? finished(next, 'missed-bite') : { state: next };
  }

  const { surgeSeconds, reelSeconds, maxFightSeconds } = FISHING_TIMING;
  const { strength, minGrams, maxGrams } = FISHING_SPECIES[state.fish.speciesId];
  const size = (state.fish.weightGrams - minGrams) / (maxGrams - minGrams);
  const progressRate = reeling ? 1 / (reelSeconds * (1 + strength + size * .3)) : 0;
  const next = { ...state };
  const endTime = Math.min(next.elapsed + dt, maxFightSeconds);
  // Time comparisons use a small tolerance so event priority is stable at exact ties.
  while (next.elapsed < endTime) {
    const segment = Math.floor((next.elapsed + TIME_EPSILON) / surgeSeconds);
    const segmentEnd = (segment + 1) * surgeSeconds;
    const surging = segment % 2 === 1;
    const tensionRate = reeling
      ? .28 + strength + size * .12 + (surging ? .17 : 0)
      : -.47 + (surging ? .16 : 0);
    const lineTime = tensionRate > 0 ? (1 - next.tension) / tensionRate : -next.tension / tensionRate;
    const catchTime = progressRate > 0 ? (1 - next.progress) / progressRate : Infinity;
    const limit = Math.min(segmentEnd, endTime) - next.elapsed;
    const step = Math.min(lineTime, catchTime, limit);
    next.elapsed += step;
    next.tension = Math.max(0, Math.min(1, next.tension + tensionRate * step));
    next.progress = Math.min(1, next.progress + progressRate * step);

    if (lineTime <= step + TIME_EPSILON) {
      next.tension = reeling ? 1 : 0;
      return finished(next, reeling ? 'line-broke' : 'fish-escaped');
    }
    if (catchTime <= step + TIME_EPSILON) {
      next.progress = 1;
      // Award the catch and XP only on this transition. Later steps emit neither.
      return { ...finished(next, 'caught'), catch: next.fish, xp: next.fish.xp };
    }
    next.elapsed = Math.min(segmentEnd, endTime);
  }
  return next.elapsed >= maxFightSeconds ? finished(next, 'fish-escaped') : { state: next };
}

// Pass the emitted catch to keep the most recent entries first.
export function recordFishingCatch(log, fish) {
  return [{ ...fish }, ...(log ?? []).slice(0, FISHING_LOG_LIMIT - 1)];
}
export function normalizeFishingLog(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    if (!e || typeof e !== 'object' || !FISHING_SPECIES[e.speciesId] || typeof e.waterId !== 'string') continue;
    if (![e.weightGrams, e.valueCents, e.xp].every(v => Number.isSafeInteger(v) && v > 0)) continue;
    out.push({ waterId: e.waterId, spotId: typeof e.spotId === 'string' ? e.spotId : null, speciesId: e.speciesId, weightGrams: e.weightGrams, valueCents: e.valueCents, xp: e.xp });
    if (out.length >= FISHING_LOG_LIMIT) break;
  }
  return out;
}
