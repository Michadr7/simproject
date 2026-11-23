// All distances are metres and all times are seconds unless stated otherwise.
import { addXp, levelOf } from './skills.js';
import { advanceTime } from './routine.js';
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

// E-I3 & WJ: Eden Industries welding & shipping dock shift rules (notes/map-master.md 5.2, 5.8).
export const EDEN_HOURS = Object.freeze([360, 1080]); // 06:00–18:00
export const WELD_PASS_MINUTES = 20;
export const SHIPPING_TASK_MINUTES = 15;
export const SHIPPING_DRIVING_XP = 10;

const GRADE_MULTIPLIER = Object.freeze({ A: 1.3, B: 1.0, C: 0.7, D: 0.35 });
const GRADE_RANK = Object.freeze({ A: 4, B: 3, C: 2, D: 1 });
const GRADES = Object.freeze(['A', 'B', 'C', 'D']);

const weldJob = (id, name, tier, minLevel, basePayCents, xp, points) => Object.freeze({
  id, name, tier, minLevel, basePayCents, xp,
  points: Object.freeze(points.map(pt => Object.freeze([...pt]))),
});

export const WELD_JOBS = Object.freeze([
  weldJob('bracket-t1', 'Mounting Bracket', 1, 1, 1800, 16, [[0, 0, 0], [.22, 0, 0]]),
  weldJob('gusset-t2', 'Frame Gusset', 2, 2, 2400, 22, [[0, 0, 0], [.14, .04, .05], [.28, .04, .12]]),
  weldJob('hitch-t3', 'Trailer Hitch', 3, 3, 3200, 28, [[0, 0, 0], [.10, .05, .08], [.24, .05, .08], [.34, 0, 0]]),
  weldJob('rail-t4', 'Chassis Rail', 4, 4, 4200, 36, [[0, 0, 0], [.14, .02, .05], [.28, .06, .12], [.44, .06, .18]]),
  weldJob('atv-frame-t5', 'ATV Frame', 5, 5, 5600, 48, [[0, 0, 0], [.12, .05, .06], [.26, .08, .13], [.40, .04, .20], [.52, 0, .26]]),
]);

export const SHIPPING_TASKS = Object.freeze({
  'load-steel': Object.freeze({ id: 'load-steel', name: 'Load steel bundle', payCents: 1600, xp: SHIPPING_DRIVING_XP, minutes: SHIPPING_TASK_MINUTES }),
  'check-manifest': Object.freeze({ id: 'check-manifest', name: 'Check shipping manifest', payCents: 1400, xp: SHIPPING_DRIVING_XP, minutes: SHIPPING_TASK_MINUTES }),
});

const isEdenOpen = progress => {
  const mins = progress?.routine?.minutes;
  return Number.isFinite(mins) && mins >= EDEN_HOURS[0] && mins < EDEN_HOURS[1];
};

const safeInt = (val, max = 1e7) => (Number.isSafeInteger(val) && val >= 0 && val <= max ? val : 0);

export function normalizeEdenWork(val) {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return null;
  const active = typeof val.active === 'string' && WELD_JOBS.some(j => j.id === val.active) ? val.active : null;
  const jobsDone = safeInt(val.jobsDone);
  const lastDay = safeInt(val.lastDay);
  const bestGrade = GRADES.includes(val.bestGrade) ? val.bestGrade : null;
  if (!active && !jobsDone && !lastDay && !bestGrade) return null;
  return { active, jobsDone, lastDay, bestGrade };
}

function applyWorkRewards(progress, { paid, skill, xp, minutes }) {
  const base = {
    ...progress,
    cash: (progress?.cash || 0) + paid,
    skills: progress?.skills || {},
    routine: { ...(progress?.routine || {}), earned: (progress?.routine?.earned || 0) + paid },
  };
  const xpRes = addXp(base, skill, xp);
  const state = advanceTime(xpRes.state, minutes);
  return { state, level: xpRes.level, leveledUp: xpRes.leveledUp };
}

function simulateWeldPass(job, { speed = TUNING.idealSpeed, errorMm = 1.5, braced = true, seed = 1 } = {}) {
  const path = seamPath(job.points);
  const sampler = weldSampler(path);
  const dt = .02;
  const safeSpeed = Number.isFinite(speed) && speed > 0 ? speed : 0;
  const errM = (Number.isFinite(errorMm) ? errorMm : 0) / 1000;
  const safeSeed = Number.isFinite(seed) ? Math.trunc(seed) : 1;
  const totalTime = safeSpeed > 0 ? path.length / safeSpeed : path.length / TUNING.idealSpeed;
  const steps = Math.max(1, Math.ceil(totalTime / dt - 1e-9));
  for (let i = 0; i <= steps; i++) {
    const t = i === steps ? totalTime : i * dt;
    const dist = Math.min(path.length, safeSpeed * t);
    const aim = path.pointAt(dist);
    const a = path.pointAt(Math.max(0, dist - .002));
    const b = path.pointAt(Math.min(path.length, dist + .002));
    const tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    const ux = tx / tl, uy = ty / tl, uz = tz / tl;
    // Project world-up perpendicular to the seam tangent so lateral error stays off the seam even on 3D slopes.
    let ox = -uy * ux, oy = 1 - uy * uy, oz = -uy * uz;
    let ol = Math.hypot(ox, oy, oz);
    if (ol < 1e-6) { ox = 1; oy = 0; oz = 0; ol = 1; }
    const scale = errM / ol;
    const target = [aim[0] + ox * scale, aim[1] + oy * scale, aim[2] + oz * scale];
    const raw = tipMotion(target, t, safeSeed, braced ? target : null);
    // Keep hand shake perpendicular to the seam tangent so tiny axial jitter does not skip 5 mm bins.
    const dx = raw[0] - target[0], dy = raw[1] - target[1], dz = raw[2] - target[2];
    const along = dx * ux + dy * uy + dz * uz;
    const tip = [target[0] + dx - along * ux, target[1] + dy - along * uy, target[2] + dz - along * uz];
    sampler.update(tip, t, true, 0, undefined, aim);
  }
  return sampler.finish();
}

export function startWeldJob(progress, jobId) {
  if (!isEdenOpen(progress)) return { error: 'Eden fabrication shifts run 6:00 AM–6:00 PM.' };
  const job = WELD_JOBS.find(j => j.id === jobId);
  if (!job) return { error: 'Unknown welding job.' };
  const level = levelOf(progress?.skills?.welding?.xp || 0).level;
  if (level < job.minLevel) return { error: `Requires Welding level ${job.minLevel} (currently ${level}).` };
  const prev = normalizeEdenWork(progress?.edenWork) || { active: null, jobsDone: 0, lastDay: 0, bestGrade: null };
  const edenWork = { ...prev, active: job.id };
  return { state: { ...progress, edenWork }, job, message: `Started ${job.name} (Tier ${job.tier}) at Hall A.` };
}

export function scoreWeldPass(progress, { speed = TUNING.idealSpeed, errorMm = 1.5, braced = true, seed = 1, score, grade } = {}) {
  const job = WELD_JOBS.find(j => j.id === progress?.edenWork?.active);
  if (!job) return { error: 'Start a welding job at Hall A first.' };
  const validPrecomputed = Number.isFinite(score) && score >= 0 && score <= 100
    && typeof grade === 'string' && Object.hasOwn(GRADE_MULTIPLIER, grade);
  const result = validPrecomputed
    ? { score: Math.round(score), grade, worst: [], coverage: 1 }
    : simulateWeldPass(job, { speed, errorMm, braced, seed });
  const paid = Math.round(job.basePayCents * GRADE_MULTIPLIER[result.grade]);
  const rewarded = applyWorkRewards(progress, { paid, skill: 'welding', xp: job.xp, minutes: WELD_PASS_MINUTES });
  let next = rewarded.state;
  const standingGain = result.grade === 'A' || result.grade === 'B' ? 1 : 0;
  if (standingGain) {
    next = { ...next, standing: { ...(next.standing || {}), town: (next.standing?.town || 0) + standingGain } };
  }
  const prev = normalizeEdenWork(progress?.edenWork) || { active: null, jobsDone: 0, lastDay: 0, bestGrade: null };
  const bestGrade = GRADE_RANK[result.grade] > (GRADE_RANK[prev.bestGrade] || 0) ? result.grade : prev.bestGrade;
  const lastDay = next.housing?.day || progress?.housing?.day || 1;
  next = { ...next, edenWork: { active: null, jobsDone: prev.jobsDone + 1, lastDay, bestGrade } };
  return {
    state: next,
    job,
    score: result.score,
    grade: result.grade,
    paid,
    xp: job.xp,
    level: rewarded.level,
    leveledUp: rewarded.leveledUp,
    standingGain,
    message: `Welded ${job.name} (Grade ${result.grade}, ${result.score}%) · +$${(paid / 100).toFixed(2)} · +${job.xp} welding XP.`,
  };
}

export function completeShippingTask(progress, taskId = 'load-steel') {
  if (!isEdenOpen(progress)) return { error: 'Eden shipping dock operates 6:00 AM–6:00 PM.' };
  const task = typeof taskId === 'string' && Object.hasOwn(SHIPPING_TASKS, taskId) ? SHIPPING_TASKS[taskId] : null;
  if (!task) return { error: 'Unknown shipping task.' };
  const rewarded = applyWorkRewards(progress, { paid: task.payCents, skill: 'driving', xp: task.xp, minutes: task.minutes });
  return {
    state: rewarded.state,
    task,
    paid: task.payCents,
    xp: task.xp,
    level: rewarded.level,
    leveledUp: rewarded.leveledUp,
    message: `${task.name} complete · +$${(task.payCents / 100).toFixed(2)} · +${task.xp} driving XP.`,
  };
}
