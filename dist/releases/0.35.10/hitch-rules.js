// Hitch and tow rules (pure): tractrix follow, jackknife, reverse assist, combination bisection (notes/farm-vehicles-design.md section 2).

export const HITCH_REACH = 0.6; // metres (ground distance to attach)
export const HITCH_YAW = Math.PI / 4; // 45 degrees maximum yaw difference to hitch
export const JACKKNIFE_MAX = 70 * Math.PI / 180; // 70 degrees maximum articulation angle
export const REVERSE_ASSIST = 0.8; // per second exponential decay of articulation in reverse
export const TOW_LOAD = Object.freeze({
  tow_tank: 0.8,
  grain_cart: 0.9,
  implements: 0.3,
  implement: 0.3,
  implements_raised: 0.3,
  implement_raised: 0.3,
});

// Wraps an angle in radians to (-pi, pi]
export function wrapAngle(rad) {
  let a = (rad + Math.PI) % (2 * Math.PI);
  if (a <= 0) a += 2 * Math.PI;
  return a - Math.PI;
}

// World position of a hitch pin or anchor point given tractor pose and local offset
export function pinWorldPos(tractorPose, hitchOffset = 0) {
  const lx = typeof hitchOffset === 'object' ? (hitchOffset?.x || 0) : 0;
  const lz = typeof hitchOffset === 'object' ? (hitchOffset?.z ?? 0) : hitchOffset;
  const c = Math.cos(tractorPose.yaw), s = Math.sin(tractorPose.yaw);
  return {
    x: tractorPose.x + lx * c + lz * s,
    z: tractorPose.z - lx * s + lz * c,
  };
}

// Articulation angle phi = wrap(trailerYaw - tractorYaw)
export function articulationAngle(trailerYaw, tractorYaw) {
  const yt = typeof trailerYaw === 'object' ? (trailerYaw?.yaw ?? 0) : trailerYaw;
  const yTrac = typeof tractorYaw === 'object' ? (tractorYaw?.yaw ?? 0) : tractorYaw;
  return wrapAngle(yt - yTrac);
}

// Can the tractor hitch the trailer right now?
// Rules: speed < 0.5 m/s, ground distance between pin and eye <= HITCH_REACH (0.6 m), |yaw diff| <= HITCH_YAW (45 deg)
export function hitchAvailable(tractor, trailer, optsOrSpeed) {
  let opts = {};
  if (typeof optsOrSpeed === 'number') {
    opts = { speed: optsOrSpeed };
  } else if (optsOrSpeed && typeof optsOrSpeed === 'object') {
    opts = optsOrSpeed;
  }
  const speed = opts.speed ?? tractor?.speed ?? 0;
  if (Math.abs(speed) >= 0.5) return false;

  const tractorPin = opts.pinPos || (opts.tractorHitch !== undefined ? pinWorldPos(tractor, opts.tractorHitch) : (tractor?.pin ? tractor.pin : tractor));
  const trailerEye = opts.eyePos || (opts.trailerEye !== undefined ? pinWorldPos(trailer, opts.trailerEye) : (trailer?.eye ? trailer.eye : trailer));

  const dx = tractorPin.x - trailerEye.x;
  const dz = tractorPin.z - trailerEye.z;
  const dist = Math.hypot(dx, dz);
  const reach = opts.reach ?? HITCH_REACH;
  if (dist > reach + 1e-6) return false;

  const tYaw = tractor?.yaw ?? 0;
  const trYaw = trailer?.yaw ?? 0;
  const angleDiff = Math.abs(wrapAngle(tYaw - trYaw));
  const maxYaw = opts.maxYaw ?? HITCH_YAW;
  if (angleDiff > maxYaw + 1e-6) return false;

  return true;
}

// Single-axle tractrix follow model:
// H = pin in world after tractor step; A = trailer axle point before.
// trailer yaw = atan2(Hx - Ax, Hz - Az); new axle = H - L(sin yt, cos yt).
// Guards zero displacement by preserving the previous yaw.
export function stepTractrix(pinWorld, trailerAxleOrPose, eyeToAxle = 2.357, prevYaw = 0, opts = {}) {
  const axleZ = opts.axleZ ?? trailerAxleOrPose?.axleZ ?? 0;
  const pYaw = prevYaw ?? trailerAxleOrPose?.yaw ?? 0;

  let Ax = trailerAxleOrPose.x;
  let Az = trailerAxleOrPose.z;
  if (axleZ !== 0) {
    Ax += axleZ * Math.sin(pYaw);
    Az += axleZ * Math.cos(pYaw);
  }

  const dx = pinWorld.x - Ax;
  const dz = pinWorld.z - Az;
  const dist = Math.hypot(dx, dz);
  const yt = dist < 1e-5 ? pYaw : Math.atan2(dx, dz);

  const newAxleX = pinWorld.x - eyeToAxle * Math.sin(yt);
  const newAxleZ = pinWorld.z - eyeToAxle * Math.cos(yt);

  let hullX = newAxleX;
  let hullZ = newAxleZ;
  if (axleZ !== 0) {
    hullX -= axleZ * Math.sin(yt);
    hullZ -= axleZ * Math.cos(yt);
  }

  return {
    x: hullX,
    z: hullZ,
    yaw: yt,
    axle: { x: newAxleX, z: newAxleZ },
  };
}

// Jackknife clamping rule:
// Forward: phi clamped to [-JACKKNIFE_MAX, JACKKNIFE_MAX] smoothly without sign flip.
// Reverse: at limit, combination stops (speed = 0) and reports event 'jackknife'.
export function clampJackknife(phi, motion = true, maxAngle = JACKKNIFE_MAX) {
  let isReverse = false;
  let speed = undefined;
  if (typeof motion === 'number') {
    speed = motion;
    isReverse = motion < -1e-4;
  } else if (typeof motion === 'boolean') {
    isReverse = !motion;
  } else if (motion && typeof motion === 'object') {
    if (typeof motion.speed === 'number') speed = motion.speed;
    isReverse = Boolean(motion.reverse ?? motion.isReverse ?? (motion.forward === false) ?? (speed !== undefined && speed < -1e-4));
  } else if (typeof motion === 'string') {
    isReverse = motion === 'reverse';
  }

  const absPhi = Math.abs(phi);
  const over = absPhi >= maxAngle;
  const clampedPhi = over ? (phi < 0 ? -maxAngle : maxAngle) : phi;

  if (isReverse && over) {
    return {
      phi: clampedPhi,
      clamped: true,
      event: 'jackknife',
      stopped: true,
      speed: 0,
    };
  }

  return {
    phi: clampedPhi,
    clamped: over,
    event: null,
    stopped: false,
    speed: speed !== undefined ? speed : null,
  };
}

// Reverse assist: phi <- phi * exp(-REVERSE_ASSIST * dt) (halves in ~0.9 s; off switch returns phi untouched)
export function applyReverseAssist(phi, dt, enabled = true, k = REVERSE_ASSIST) {
  if (!enabled || !(k > 0) || !(dt > 0)) return phi;
  return phi * Math.exp(-k * dt);
}

// Effective load added to tractor: TOW_LOAD * (0.2 + 0.8 * fill)
export function towLoadOf(unit, fill = 0) {
  const base = typeof unit === 'string' ? (TOW_LOAD[unit] ?? 0.8) : (unit?.towLoad ?? unit ?? 0.8);
  const f = Math.max(0, Math.min(1, fill));
  return +(base * (0.2 + 0.8 * f)).toFixed(4);
}

// Multiplier helpers for derating tractor top speed and acceleration
export const deratedTopMultiplier = (load = 0) => Math.max(0, +(1 - 0.2 * Math.max(0, load)).toFixed(4));
export const deratedAccelMultiplier = (load = 0) => Math.max(0, +(1 - 0.35 * Math.max(0, load)).toFixed(4));

export function deratedTop(topOrLoad, maybeLoad) {
  if (maybeLoad !== undefined) {
    return +(topOrLoad * deratedTopMultiplier(maybeLoad)).toFixed(3);
  }
  return deratedTopMultiplier(topOrLoad);
}

export function deratedAccel(accelOrLoad, maybeLoad) {
  if (maybeLoad !== undefined) {
    return +(accelOrLoad * deratedAccelMultiplier(maybeLoad)).toFixed(3);
  }
  return deratedAccelMultiplier(accelOrLoad);
}

// Combination collision bisection: 7 halvings of tractor's translation step
// isBlocked(tractorPose, trailerPose) is an injected callback returning boolean.
export function bisectCombination(tractorPrev, tractorNext, trailerPrev, isBlocked, opts = {}) {
  const eyeToAxle = opts.eyeToAxle ?? 2.357;
  const tractorHitch = opts.tractorHitch ?? 0;
  const axleZ = opts.axleZ ?? 0;
  const iterations = opts.iterations ?? 7;

  const evalAt = (t) => {
    const yawDiff = wrapAngle(tractorNext.yaw - tractorPrev.yaw);
    const tPose = {
      x: tractorPrev.x + t * (tractorNext.x - tractorPrev.x),
      z: tractorPrev.z + t * (tractorNext.z - tractorPrev.z),
      yaw: wrapAngle(tractorPrev.yaw + t * yawDiff),
    };
    const pin = pinWorldPos(tPose, tractorHitch);
    const trPose = stepTractrix(pin, trailerPrev, eyeToAxle, trailerPrev.yaw, { axleZ });
    return { tractor: tPose, trailer: trPose };
  };

  let t0 = 0;
  let t1 = 1;
  let best = evalAt(0);

  for (let i = 0; i < iterations; i++) {
    const tMid = (t0 + t1) / 2;
    const cand = evalAt(tMid);
    if (isBlocked(cand.tractor, cand.trailer)) {
      t1 = tMid;
    } else {
      t0 = tMid;
      best = cand;
    }
  }

  return {
    tractor: best.tractor,
    trailer: best.trailer,
    t: t0,
    speed: 0,
    blocked: true,
  };
}

// Simulates trailer following a defined pin path over pathLength at speed
export function simulateTowPath({
  pathLength = 50,
  speed = 5.0,
  dt = 1 / 60,
  radius = 20,
  eyeToAxle = 2.357,
  tractorHitch = -0.524,
  startPose = { x: 0, z: 0, yaw: 0 },
} = {}) {
  const totalTime = pathLength / speed;
  const steps = Math.round(totalTime / dt);
  const actualDt = totalTime / steps;

  let tractor = { ...startPose };
  const initialPin = pinWorldPos(tractor, tractorHitch);
  let trailer = {
    x: initialPin.x - eyeToAxle * Math.sin(tractor.yaw),
    z: initialPin.z - eyeToAxle * Math.cos(tractor.yaw),
    yaw: tractor.yaw,
  };

  const history = [{ t: 0, s: 0, tractor: { ...tractor }, trailer: { ...trailer } }];
  let s = 0;

  for (let i = 1; i <= steps; i++) {
    s += speed * actualDt;
    // Follow smooth circular arc trajectory for tractor hitch pin:
    // Pin path is defined by radius R and arc length s
    if (radius !== 0) {
      tractor.yaw = wrapAngle(s / radius);
      tractor.x = radius * (1 - Math.cos(s / radius));
      tractor.z = radius * Math.sin(s / radius);
    } else {
      tractor.x = 0;
      tractor.z = s;
      tractor.yaw = 0;
    }

    const pin = pinWorldPos(tractor, tractorHitch);
    trailer = stepTractrix(pin, trailer, eyeToAxle, trailer.yaw);
    history.push({ t: i * actualDt, s, tractor: { ...tractor }, trailer: { ...trailer } });
  }

  return history;
}
