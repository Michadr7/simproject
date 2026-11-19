// Farm beds and liquid/bulk cargo (pure): tank, grain cart and combine (notes/farm-vehicles-design.md section 2 and 8 FV3).

export const FARM_BEDS = Object.freeze({
  tow_tank: Object.freeze({ liquid: true, capacityMgal: 1000000, y: 1.82 }),
  grain_cart: Object.freeze({ bulk: true, capacityBu10: 4000 }),
  combine: Object.freeze({ bulk: true, capacityBu10: 1500 }),
});

export const BEDS = FARM_BEDS;

export const hasFarmBed = model => !!FARM_BEDS[model];

export const LIQUID_KINDS = Object.freeze(['water', 'fert']);
export const BULK_KINDS = Object.freeze(['wheat']);

// Returns the bed capacity for a farm model, or 0 if not a farm bed
export function bedCapacity(model) {
  const bed = FARM_BEDS[model];
  if (!bed) return 0;
  return bed.liquid ? bed.capacityMgal : bed.bulk ? bed.capacityBu10 : 0;
}

// How full the bed is, 0..1 (fill share for loadOf calculation)
export function loadFraction(model, cargo) {
  const bed = FARM_BEDS[model];
  if (!bed || !cargo || typeof cargo !== 'object') return 0;
  if (bed.liquid && cargo.mgal !== undefined) {
    return Math.max(0, Math.min(1, +(cargo.mgal / bed.capacityMgal).toFixed(4)));
  }
  if (bed.bulk && cargo.bu10 !== undefined) {
    return Math.max(0, Math.min(1, +(cargo.bu10 / bed.capacityBu10).toFixed(4)));
  }
  return 0;
}

// Normalizes farm cargo: validates {k:'water'|'fert', mgal} or {k:'wheat', bu10}. Logs and planks are strictly refused.
export function normalizeFarmCargo(value, model) {
  const bed = FARM_BEDS[model];
  if (!bed) return null;

  // Timber cargo (logs, plank arrays or objects) is strictly refused on liquid/bulk beds
  if (Array.isArray(value)) return null;
  if (!value || typeof value !== 'object') return null;
  if (value.k === 'log' || value.k === 'planks') return null;

  if (bed.liquid) {
    const k = value.k;
    if (!LIQUID_KINDS.includes(k)) return null;
    const mgal = Math.floor(Number(value.mgal));
    if (!Number.isSafeInteger(mgal) || mgal <= 0) return null;
    const clamped = Math.min(bed.capacityMgal, mgal);
    return { k, mgal: clamped };
  }

  if (bed.bulk) {
    const k = value.k;
    if (!BULK_KINDS.includes(k)) return null;
    const bu10 = Math.floor(Number(value.bu10));
    if (!Number.isSafeInteger(bu10) || bu10 <= 0) return null;
    const clamped = Math.min(bed.capacityBu10, bu10);
    return { k, bu10: clamped };
  }

  return null;
}
