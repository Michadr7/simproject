// All distances are metres and all times are seconds unless stated otherwise.
export const TUNING = Object.freeze({
  spacing: .005,         // Distance between scored bead samples.
  toleranceMm: 8,       // Lateral error at which accuracy falls to zero.
  idealSpeed: .055,     // Replay reference speed.
  minSpeed: .035,       // Lower end of the clean travel-speed band.
  maxSpeed: .080,       // Upper end of the clean travel-speed band.
  stopSpeed: .012,      // Below this speed, accumulate dwell time.
  dwellGrace: .18,      // Time allowed before a stationary spot loses quality.
  dwellLimit: .65,      // Time at which dwell quality reaches zero.
  maxLift: .015,        // Use for samples above the intended nozzle height.
  shake: .0024,        // Unbraced displacement amplitude.
  braceShake: .00065,  // Braced displacement amplitude.
  shakeHz: 11,          // Seeded noise lattice frequency.
  braceReach: .075,     // Maximum displacement from the brace point.
  forgivingPower: .65,  // Curves completed-segment quality upward.
  worstCount: 5,       // Maximum number of result ticks.
  gradeA: 90, gradeB: 75, gradeC: 55,
});
const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, value));
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((n, v, i) => n + v*b[i], 0);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v)*t);

export function seamPath(points) {
  let length = 0;
  const edges = [];
  for (let i = 1; i < points.length; i++) {
    const start = points[i-1], delta = subtract(points[i], start), span = Math.hypot(...delta);
    if (!span) continue;
    edges.push({ start, delta, span, at: length });
    length += span;
  }
  function nearest(point) {
    let best = { error: Infinity, at: 0 };
    for (const e of edges) {
      const offset = subtract(point, e.start);
      const t = clamp(dot(offset, e.delta)/(e.span**2));
      const error = Math.hypot(...offset.map((v,i) => v - t*e.delta[i]));
      if (error < best.error) best = { error, at: e.at + t*e.span };
    }
    return best;
  }
  function pointAt(meters) {
    if (!edges.length) return points[0] ?? [0,0,0];
    const at = clamp(meters, 0, length);
    const e = edges.find(edge => at <= edge.at + edge.span) ?? edges.at(-1);
    return e.start.map((v,i) => v + e.delta[i]*(at-e.at)/e.span);
  }
  return { length, nearest, pointAt, edgeCount: edges.length };
}

function noise(seed, i) {
  let n = Math.imul((seed ^ i) >>> 0, 0x45d9f3b);
  n = Math.imul(n ^ n >>> 16, 0x45d9f3b);
  return ((n ^ n >>> 16) >>> 0)/0xffffffff*2-1;
}

export function braceTarget(target, bracePoint) {
  if (!bracePoint) return target;
  const d = subtract(target, bracePoint), distance = Math.hypot(...d);
  return distance > TUNING.braceReach ? lerp(bracePoint,target,TUNING.braceReach/distance) : target;
}
export function tipMotion(target, time, seed, bracePoint) {
  const base = braceTarget(target, bracePoint);
  const tick = time*TUNING.shakeHz, i = Math.floor(tick), f = tick-i, mix = f*f*(3-2*f);
  const amp = bracePoint ? TUNING.braceShake : TUNING.shake;
  const jitter = base.map((v, axis) => {
    const s = seed + axis*9173;
    return axis === 1 ? v : v + amp*(noise(s,i)*(1-mix) + noise(s,i+1)*mix);
  });
  return braceTarget(jitter,bracePoint);
}

export function weldSampler(path, tuning = TUNING) {
  const coverage = new Map();
  const worst = [];
  let previous, previousTime, previousAim, carry = 0, dwell = 0, last, lastPoint, standoffLift = false;
  let deposited = 0, penalty = 0, operations = 0;
  let status = { speed: 0, errorMm: 0, dwell: 0, defect: null };
  const tolerance = tuning.toleranceMm/1000;
  const bins = Math.max(1, Math.ceil(path.length/tuning.spacing));
  function read(point) {
    operations += path.edgeCount;
    return path.nearest(point);
  }
  function record(segment) {
    const old = worst.findIndex(item => item === segment || item.id === segment.id);
    if (old >= 0) worst.splice(old,1);
    worst.push(segment);
    worst.sort((a,b) => a.quality-b.quality);
    if (worst.length > tuning.worstCount) worst.pop();
  }
  function update(point, time, arc, lift = 0, onSample = () => {}, aim = point) {
    const where = read(point);
    const dt = previousTime === undefined ? 0 : Math.max(0,time-previousTime);
    // Hand shake contributes to accuracy, but cannot produce travel while aim is held still.
    const distance = previousAim ? Math.hypot(...subtract(aim,previousAim)) : 0;
    const from = previous;
    previousTime = time;
    status = { speed: arc && from && dt ? distance/dt : 0, errorMm: where.error*1000, dwell: 0, defect: null };
    if (!arc || lift > tuning.maxLift) {
      if (lift > tuning.maxLift && arc) {
        penalty += dt;
        standoffLift = true;
        status.defect = 'porosity';
      } else standoffLift = false;
      previous = previousAim = undefined; carry = 0; dwell = 0; last = undefined; lastPoint = undefined;
      return status;
    }
    previous = [...point];
    previousAim = [...aim];
    if (!from || !dt) {
      lastPoint ??= previous;
      return status;
    }
    const speed = status.speed;
    dwell = speed < tuning.stopSpeed ? dwell+dt : 0;
    status.dwell = dwell;
    if (dwell > tuning.dwellGrace) {
      const loss = clamp((dwell-tuning.dwellGrace)/(tuning.dwellLimit-tuning.dwellGrace));
      status.defect = 'burn-through';
      penalty += loss*dt;
      if (!last) {
        last = { id: deposited++, from, point, speed, time, quality: 1, defect: null, puddle: true };
      }
      last.quality = Math.min(last.quality,1-loss);
      last.defect = 'burn-through';
      last.time = time;
      record(last);
      onSample(last, true);
    }
    for (let step = tuning.spacing-carry; step <= distance + 1e-10; step += tuning.spacing) {
      const p = lerp(from, point, clamp(step/distance));
      const at = read(p);
      const accuracy = clamp(1 - (at.error/tolerance)**2);
      const rate = speed < tuning.minSpeed ? clamp(speed/tuning.minSpeed) :
        speed > tuning.maxSpeed ? clamp(2-speed/tuning.maxSpeed) : 1;
      const defect = standoffLift ? 'porosity' : accuracy < rate ? 'wander' :
        speed > tuning.maxSpeed ? 'cold lap' : speed < tuning.minSpeed ? 'sag' : null;
      const quality = accuracy*rate*(standoffLift ? .4 : 1);
      last = { id: deposited++, from: lastPoint, point: p,
        speed, time, quality, defect, puddle: false };
      if (accuracy > 0) {
        const bin = Math.min(bins-1,Math.max(0,Math.ceil(at.at/tuning.spacing - 1e-7)-1));
        coverage.set(bin, Math.max(coverage.get(bin) ?? 0, quality));
      }
      standoffLift = false;
      lastPoint = p;
      record(last);
      onSample(last, false);
    }
    carry = ((carry+distance)%tuning.spacing + tuning.spacing)%tuning.spacing;
    if (carry > tuning.spacing - 1e-9) carry = 0;
    status.defect ??= last?.defect ?? null;
    return status;
  }
  function finish() {
    const quality = [...coverage.values()].reduce((sum,q) => sum+q**tuning.forgivingPower,0)/bins;
    const expectedTime = path.length/tuning.idealSpeed;
    const score = Math.round(100*clamp(quality - penalty/Math.max(expectedTime,.1)));
    const grade = score >= tuning.gradeA ? 'A' : score >= tuning.gradeB ? 'B' : score >= tuning.gradeC ? 'C' : 'D';
    return { score, grade, worst: worst.filter(s => s.defect), coverage: coverage.size/bins };
  }
  return { update, finish, get operations() { return operations; } };
}
