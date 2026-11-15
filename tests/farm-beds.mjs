import assert from 'node:assert/strict';
import {
  FARM_BEDS,
  BEDS,
  hasFarmBed,
  bedCapacity,
  loadFraction,
  normalizeFarmCargo,
  LIQUID_KINDS,
  BULK_KINDS,
} from '../dist/farm-beds.js';

// ── 1. Bed Specifications ───────────────────────────────────────────────────────
assert.equal(BEDS, FARM_BEDS, 'BEDS is an alias for FARM_BEDS');

// tow_tank (liquid: true, capacityMgal: 1,000,000, y: 1.82)
assert(FARM_BEDS.tow_tank, 'tow_tank bed exists');
assert.equal(FARM_BEDS.tow_tank.liquid, true);
assert.equal(FARM_BEDS.tow_tank.capacityMgal, 1000000, 'tow_tank holds 1,000 gal (1,000,000 mgal)');
assert.equal(FARM_BEDS.tow_tank.y, 1.82);

// grain_cart (bulk: true, capacityBu10: 4,000 = 400 bushels)
assert(FARM_BEDS.grain_cart, 'grain_cart bed exists');
assert.equal(FARM_BEDS.grain_cart.bulk, true);
assert.equal(FARM_BEDS.grain_cart.capacityBu10, 4000, 'grain_cart holds 4,000 bu10 (400 bu)');

// combine (bulk: true, capacityBu10: 1,500 = 150 bushels)
assert(FARM_BEDS.combine, 'combine bed exists');
assert.equal(FARM_BEDS.combine.bulk, true);
assert.equal(FARM_BEDS.combine.capacityBu10, 1500, 'combine grain tank holds 1,500 bu10 (150 bu)');

// hasFarmBed & bedCapacity
assert.equal(hasFarmBed('tow_tank'), true);
assert.equal(hasFarmBed('grain_cart'), true);
assert.equal(hasFarmBed('combine'), true);
assert.equal(hasFarmBed('worktruck'), false, 'regular trucks are not farm beds');
assert.equal(hasFarmBed('flatbed'), false);
assert.equal(hasFarmBed('unknown'), false);

assert.equal(bedCapacity('tow_tank'), 1000000);
assert.equal(bedCapacity('grain_cart'), 4000);
assert.equal(bedCapacity('combine'), 1500);
assert.equal(bedCapacity('shortbed'), 0);

// ── 2. Cargo Normalization ─────────────────────────────────────────────────────
// Liquids: 'water' and 'fert'
assert.deepEqual(LIQUID_KINDS, ['water', 'fert']);
assert.deepEqual(normalizeFarmCargo({ k: 'water', mgal: 500000 }, 'tow_tank'), { k: 'water', mgal: 500000 });
assert.deepEqual(normalizeFarmCargo({ k: 'fert', mgal: 800000 }, 'tow_tank'), { k: 'fert', mgal: 800000 });
// Capacity clamping
assert.deepEqual(normalizeFarmCargo({ k: 'water', mgal: 1500000 }, 'tow_tank'), { k: 'water', mgal: 1000000 });
// Invalid liquid types or amounts
assert.equal(normalizeFarmCargo({ k: 'diesel', mgal: 500000 }, 'tow_tank'), null, 'diesel is fuel, not tank cargo');
assert.equal(normalizeFarmCargo({ k: 'water', mgal: 0 }, 'tow_tank'), null, 'zero or negative mgal rejected');
assert.equal(normalizeFarmCargo({ k: 'water', mgal: -100 }, 'tow_tank'), null);
assert.equal(normalizeFarmCargo({ k: 'water', mgal: 'five' }, 'tow_tank'), null);

// Bulk grain: 'wheat'
assert.deepEqual(BULK_KINDS, ['wheat']);
assert.deepEqual(normalizeFarmCargo({ k: 'wheat', bu10: 2500 }, 'grain_cart'), { k: 'wheat', bu10: 2500 });
assert.deepEqual(normalizeFarmCargo({ k: 'wheat', bu10: 5000 }, 'grain_cart'), { k: 'wheat', bu10: 4000 }, 'clamped to 4000');
assert.deepEqual(normalizeFarmCargo({ k: 'wheat', bu10: 750 }, 'combine'), { k: 'wheat', bu10: 750 });
assert.deepEqual(normalizeFarmCargo({ k: 'wheat', bu10: 2000 }, 'combine'), { k: 'wheat', bu10: 1500 }, 'clamped to 1500');

// Cross-contamination: liquid in grain cart, or grain in liquid tank
assert.equal(normalizeFarmCargo({ k: 'wheat', bu10: 1000 }, 'tow_tank'), null, 'grain refused in liquid tank');
assert.equal(normalizeFarmCargo({ k: 'water', mgal: 500000 }, 'grain_cart'), null, 'water refused in grain cart');
assert.equal(normalizeFarmCargo({ k: 'fert', mgal: 500000 }, 'combine'), null, 'fert refused in combine');

// Strict rejection of timber items (logs and planks)
assert.equal(normalizeFarmCargo({ k: 'log' }, 'tow_tank'), null, 'log refused on tank');
assert.equal(normalizeFarmCargo({ k: 'planks', n: 4 }, 'tow_tank'), null, 'planks refused on tank');
assert.equal(normalizeFarmCargo([{ k: 'log' }], 'tow_tank'), null, 'timber array refused');
assert.equal(normalizeFarmCargo([{ k: 'planks', n: 2 }], 'grain_cart'), null);
assert.equal(normalizeFarmCargo({ k: 'log' }, 'combine'), null);

// Non-farm vehicle beds
assert.equal(normalizeFarmCargo({ k: 'water', mgal: 500000 }, 'flatbed'), null);

// ── 3. loadFraction (0..1 fill share) ──────────────────────────────────────────
assert.equal(loadFraction('tow_tank', null), 0);
assert.equal(loadFraction('tow_tank', { k: 'water', mgal: 0 }), 0);
assert.equal(loadFraction('tow_tank', { k: 'water', mgal: 250000 }), 0.25);
assert.equal(loadFraction('tow_tank', { k: 'water', mgal: 500000 }), 0.50);
assert.equal(loadFraction('tow_tank', { k: 'fert', mgal: 1000000 }), 1.0);
assert.equal(loadFraction('tow_tank', { k: 'fert', mgal: 1500000 }), 1.0, 'clamped to 1.0');

assert.equal(loadFraction('grain_cart', { k: 'wheat', bu10: 1000 }), 0.25);
assert.equal(loadFraction('grain_cart', { k: 'wheat', bu10: 2000 }), 0.50);
assert.equal(loadFraction('grain_cart', { k: 'wheat', bu10: 4000 }), 1.0);

assert.equal(loadFraction('combine', { k: 'wheat', bu10: 750 }), 0.50);
assert.equal(loadFraction('combine', { k: 'wheat', bu10: 1500 }), 1.0);

assert.equal(loadFraction('worktruck', { k: 'water', mgal: 500000 }), 0, 'non-farm bed returns 0');

console.log('PASS farm-beds.mjs: BEDS entries (tow_tank, grain_cart, combine), liquid/bulk normalization, loadFraction, and timber rejection passed.');
