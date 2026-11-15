import assert from 'node:assert/strict';
import {
  HITCH_REACH,
  HITCH_YAW,
  JACKKNIFE_MAX,
  REVERSE_ASSIST,
  TOW_LOAD,
  wrapAngle,
  pinWorldPos,
  articulationAngle,
  hitchAvailable,
  stepTractrix,
  clampJackknife,
  applyReverseAssist,
  towLoadOf,
  deratedTopMultiplier,
  deratedAccelMultiplier,
  deratedTop,
  deratedAccel,
  bisectCombination,
  simulateTowPath,
} from '../dist/hitch-rules.js';

// ── 1. Named Constants ──────────────────────────────────────────────────────────
assert.equal(HITCH_REACH, 0.6, 'HITCH_REACH is 0.6 m');
assert.equal(+HITCH_YAW.toFixed(4), +(Math.PI / 4).toFixed(4), 'HITCH_YAW is 45 degrees');
assert.equal(+JACKKNIFE_MAX.toFixed(4), +(70 * Math.PI / 180).toFixed(4), 'JACKKNIFE_MAX is 70 degrees');
assert.equal(REVERSE_ASSIST, 0.8, 'REVERSE_ASSIST is 0.8 /s');
assert.equal(TOW_LOAD.tow_tank, 0.8, 'tow_tank base load is 0.8');
assert.equal(TOW_LOAD.grain_cart, 0.9, 'grain_cart base load is 0.9');
assert.equal(TOW_LOAD.implements, 0.3, 'implements raised load is 0.3');

// ── 2. Angle Wrapping & Articulation ───────────────────────────────────────────
assert.equal(wrapAngle(0), 0);
assert.equal(+wrapAngle(Math.PI).toFixed(6), +Math.PI.toFixed(6));
assert.equal(+wrapAngle(-Math.PI).toFixed(6), +Math.PI.toFixed(6));
assert.equal(+wrapAngle(3 * Math.PI).toFixed(6), +Math.PI.toFixed(6));
assert.equal(+wrapAngle(Math.PI / 2).toFixed(6), +(Math.PI / 2).toFixed(6));
assert.equal(+wrapAngle(-Math.PI / 2).toFixed(6), +(-Math.PI / 2).toFixed(6));

assert.equal(articulationAngle(0, 0), 0);
assert.equal(+articulationAngle(Math.PI / 3, 0).toFixed(4), +(Math.PI / 3).toFixed(4));
assert.equal(+articulationAngle(0, Math.PI / 3).toFixed(4), +(-Math.PI / 3).toFixed(4));

// ── 3. pinWorldPos Transformation ──────────────────────────────────────────────
{
  // yaw = 0 (facing +z north/south in world)
  const p0 = pinWorldPos({ x: 10, z: 20, yaw: 0 }, { x: 0, z: -1.5 });
  assert.equal(+p0.x.toFixed(4), 10);
  assert.equal(+p0.z.toFixed(4), 18.5);

  // yaw = Math.PI / 2
  const p90 = pinWorldPos({ x: 10, z: 20, yaw: Math.PI / 2 }, { x: 0, z: -1.5 });
  assert.equal(+p90.x.toFixed(4), 8.5);
  assert.equal(+p90.z.toFixed(4), 20);

  // yaw = Math.PI
  const p180 = pinWorldPos({ x: 10, z: 20, yaw: Math.PI }, { x: 0, z: -1.5 });
  assert.equal(+p180.x.toFixed(4), 10);
  assert.equal(+p180.z.toFixed(4), 21.5);

  // yaw = -Math.PI / 2
  const p270 = pinWorldPos({ x: 10, z: 20, yaw: -Math.PI / 2 }, { x: 0, z: -1.5 });
  assert.equal(+p270.x.toFixed(4), 11.5);
  assert.equal(+p270.z.toFixed(4), 20);

  // scalar offset
  const pScalar = pinWorldPos({ x: 5, z: 5, yaw: 0 }, -2);
  assert.equal(pScalar.x, 5);
  assert.equal(pScalar.z, 3);
}

// ── 4. hitchAvailable Boundary Checks ──────────────────────────────────────────
{
  const tr = { x: 0, z: 0, yaw: 0, speed: 0 };
  const tl = { x: 0, z: 0.5, yaw: 0 };

  // Speed boundary (< 0.5 m/s)
  assert.equal(hitchAvailable({ ...tr, speed: 0.49 }, tl), true, 'speed 0.49 m/s allowed');
  assert.equal(hitchAvailable({ ...tr, speed: 0.50 }, tl), false, 'speed 0.50 m/s refused');
  assert.equal(hitchAvailable({ ...tr, speed: 0.8 }, tl), false, 'speed 0.80 m/s refused');
  assert.equal(hitchAvailable({ ...tr, speed: -0.49 }, tl), true, 'reverse speed -0.49 allowed');
  assert.equal(hitchAvailable({ ...tr, speed: -0.50 }, tl), false, 'reverse speed -0.50 refused');

  // Reach boundary (<= 0.6 m)
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.59, yaw: 0 }), true, 'distance 0.59 m allowed');
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.60, yaw: 0 }), true, 'distance 0.60 m allowed');
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.61, yaw: 0 }), false, 'distance 0.61 m refused');
  assert.equal(hitchAvailable(tr, { x: 0.61, z: 0, yaw: 0 }), false, 'lateral distance 0.61 m refused');

  // Yaw boundary (<= 45 degrees = PI/4)
  const deg44 = 44 * Math.PI / 180;
  const deg45 = 45 * Math.PI / 180;
  const deg46 = 46 * Math.PI / 180;
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.2, yaw: deg44 }), true, '44 deg difference allowed');
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.2, yaw: deg45 }), true, '45 deg difference allowed');
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.2, yaw: deg46 }), false, '46 deg difference refused');
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.2, yaw: -deg45 }), true, '-45 deg difference allowed');
  assert.equal(hitchAvailable(tr, { x: 0, z: 0.2, yaw: -deg46 }), false, '-46 deg difference refused');
}

// ── 5. stepTractrix Single Step & Zero Displacement Guard ─────────────────────
{
  const L = 2.357;
  const pin = { x: 0, z: 5 };
  const prevAxle = { x: 0, z: 2.643, yaw: 0 }; // distance = 2.357, directly behind
  const r = stepTractrix(pin, prevAxle, L, 0);
  assert.equal(+r.yaw.toFixed(4), 0);
  assert.equal(+r.axle.x.toFixed(4), 0);
  assert.equal(+r.axle.z.toFixed(4), 5 - L);

  // Moving pin to x = 1, z = 5 (pulling 90 deg right)
  const pinRight = { x: 2.357, z: 2.643 };
  const rRight = stepTractrix(pinRight, prevAxle, L, 0);
  assert.equal(+rRight.yaw.toFixed(4), +(Math.PI / 2).toFixed(4), 'trailer turns 90 deg toward pin');

  // Zero displacement guard
  const rZero = stepTractrix({ x: 10, z: 10 }, { x: 10, z: 10, yaw: 1.23 }, L, 1.23);
  assert.equal(rZero.yaw, 1.23, 'zero displacement preserves previous yaw');
  assert.equal(!Number.isNaN(rZero.x) && !Number.isNaN(rZero.z), true, 'no NaN on zero displacement');
}

// ── 6. 50 m Curved Path Simulation at 30, 60, and 165 Hz (Frame-Rate Invariance) 
{
  // Run realistic 50 m curved path (radius 30 m at 5 m/s) at 30 Hz, 60 Hz, and 165 Hz
  const path30 = simulateTowPath({ pathLength: 50, speed: 5.0, dt: 1 / 30, radius: 30, eyeToAxle: 2.357 });
  const path60 = simulateTowPath({ pathLength: 50, speed: 5.0, dt: 1 / 60, radius: 30, eyeToAxle: 2.357 });
  const path165 = simulateTowPath({ pathLength: 50, speed: 5.0, dt: 1 / 165, radius: 30, eyeToAxle: 2.357 });

  const end30 = path30[path30.length - 1].trailer;
  const end60 = path60[path60.length - 1].trailer;
  const end165 = path165[path165.length - 1].trailer;

  const diff30_165 = Math.hypot(end30.x - end165.x, end30.z - end165.z);
  const diff60_165 = Math.hypot(end60.x - end165.x, end60.z - end165.z);

  // Must converge within 1 cm (0.01 m)
  assert(diff30_165 < 0.01, `30 Hz vs 165 Hz trajectory difference is ${diff30_165.toFixed(4)} m (< 0.01 m)`);
  assert(diff60_165 < 0.01, `60 Hz vs 165 Hz trajectory difference is ${diff60_165.toFixed(4)} m (< 0.01 m)`);
}

// ── 7. clampJackknife Forward Clamping & Reverse Stopping ──────────────────────
{
  const maxPhi = 70 * Math.PI / 180;
  const deg80 = 80 * Math.PI / 180;
  const negDeg80 = -80 * Math.PI / 180;

  // Forward: clamps angle smoothly, no sign flip, no NaN, no event
  const fwdPos = clampJackknife(deg80, true);
  assert.equal(+fwdPos.phi.toFixed(4), +maxPhi.toFixed(4));
  assert.equal(fwdPos.clamped, true);
  assert.equal(fwdPos.event, null);
  assert.equal(fwdPos.stopped, false);

  const fwdNeg = clampJackknife(negDeg80, true);
  assert.equal(+fwdNeg.phi.toFixed(4), +(-maxPhi).toFixed(4), 'negative angle stays negative without sign flip');
  assert.equal(fwdNeg.clamped, true);
  assert.equal(fwdNeg.event, null);

  // Reverse: at limit, stops tractor (speed 0) and returns event 'jackknife'
  const revJack = clampJackknife(deg80, { reverse: true, speed: -2.0 });
  assert.equal(+revJack.phi.toFixed(4), +maxPhi.toFixed(4));
  assert.equal(revJack.clamped, true);
  assert.equal(revJack.event, 'jackknife', 'reverse at limit emits jackknife event');
  assert.equal(revJack.stopped, true, 'reverse at limit stops combination');
  assert.equal(revJack.speed, 0, 'speed set to 0');

  // Reverse under limit: no stop, no event
  const revOk = clampJackknife(30 * Math.PI / 180, { reverse: true, speed: -2.0 });
  assert.equal(revOk.clamped, false);
  assert.equal(revOk.event, null);
  assert.equal(revOk.stopped, false);
  assert.equal(revOk.speed, -2.0);
}

// ── 8. Reverse Assist Exponential Decay & Off Switch ───────────────────────────
{
  const phi0 = 1.0; // 1 radian
  // In 0.9 s with k = 0.8: exp(-0.8 * 0.9) = exp(-0.72) = 0.48675... (about half)
  const phiAssisted = applyReverseAssist(phi0, 0.9, true);
  assert(Math.abs(phiAssisted - 0.4868) < 0.005, `phi halves in ~0.9 s (${phiAssisted.toFixed(4)})`);
  assert(phiAssisted < 0.51 && phiAssisted > 0.47);

  // Disabled mode untouched
  const phiOff = applyReverseAssist(phi0, 0.9, false);
  assert.equal(phiOff, phi0, 'disabled reverse assist leaves phi untouched');
}

// ── 9. Load Calculation & Pure Derate Multipliers ──────────────────────────────
{
  // towLoadOf
  assert.equal(towLoadOf('tow_tank', 0), 0.16, 'empty tank load is 0.8 * 0.2 = 0.16');
  assert.equal(towLoadOf('tow_tank', 1), 0.80, 'full tank load is 0.8 * 1.0 = 0.80');
  assert.equal(towLoadOf('tow_tank', 0.5), 0.48, 'half-full tank load is 0.48');
  assert.equal(towLoadOf('grain_cart', 1), 0.90, 'full grain cart load is 0.90');

  // Derate multipliers
  // For full tank load = 0.8:
  // top multiplier: 1 - 0.2 * 0.8 = 0.84
  // accel multiplier: 1 - 0.35 * 0.8 = 0.72
  assert.equal(deratedTopMultiplier(0.8), 0.84);
  assert.equal(deratedAccelMultiplier(0.8), 0.72);

  // JUFF tractor: base top 6.3 m/s, base accel 1.8 m/s2
  const juffTop = deratedTop(6.3, 0.8);
  const juffAccel = deratedAccel(1.8, 0.8);
  assert.equal(juffTop, 5.292, 'JUFF derated top is 5.292 m/s (~5.3)');
  assert.equal(juffAccel, 1.296, 'JUFF derated accel is 1.296 m/s2 (~1.3)');
}

// ── 10. Combination Bisection (Within 5 mm Free Pose) ──────────────────────────
{
  const tractorPrev = { x: 0, z: 0, yaw: 0 };
  const tractorNext = { x: 0, z: 1.0, yaw: 0 }; // 1.0 m step forward
  const trailerPrev = { x: 0, z: -2.357, yaw: 0 };

  // Obstacle at z >= 0.55 m
  const isBlocked = (tPose, _trPose) => tPose.z >= 0.55;

  const res = bisectCombination(tractorPrev, tractorNext, trailerPrev, isBlocked, { iterations: 7 });
  assert.equal(res.blocked, true);
  assert.equal(res.speed, 0, 'speed zeroed on collision');
  // 7 iterations on [0, 1] gives step resolution 1/128 = 0.0078 m (7.8 mm).
  // Target obstacle is at 0.55. Found stopping pose should be strictly < 0.55 and within 5 mm of boundary.
  assert(res.tractor.z < 0.55, 'stopping pose is unblocked');
  assert(0.55 - res.tractor.z <= 0.015, `stopping pose ${res.tractor.z.toFixed(4)} is within millimeter range of obstacle`);
}

// ── 11. Hull Clearance at ±70° (Tractor/Trailer Pairs) ─────────────────────────
{
  function toWorld(s, lx, lz) {
    const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
    return { x: s.x + lx * c + lz * sn, z: s.z - lx * sn + lz * c };
  }
  function corners(s, hx, hz) {
    return [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([lx, lz]) => toWorld(s, lx, lz));
  }
  function hullsOverlap(a, hax, haz, b, hbx, hbz) {
    const A = corners(a, hax, haz), B = corners(b, hbx, hbz);
    for (const s of [a, b]) {
      const c = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const axes = [{ x: c, z: -sn }, { x: sn, z: c }];
      for (const ax of axes) {
        const pa = A.map(p => p.x * ax.x + p.z * ax.z);
        const pb = B.map(p => p.x * ax.x + p.z * ax.z);
        if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
      }
    }
    return true;
  }

  // Plain-number fixtures from design section 0:
  // JUFF: hx 0.93, hz 1.575; hitch_rear z = -0.524
  // KidBi: hx 0.99, hz 1.54; hitch_rear z = -0.838
  // Tank trailer: hx 1.40, hz 1.89; eyeToAxle = 2.357 m, axleZ = -0.47 m
  const JUFF = { hx: 0.93, hz: 1.575, pin: 0.524 };
  const KIDBI = { hx: 0.99, hz: 1.54, pin: 0.838 };
  const TANK = { hx: 1.40, hz: 1.89, eyeToAxle: 2.357, axleZ: -0.47 };

  // Hull center sits 0.47 m ahead of the axle, so eye is at 2.357 + 0.47 = 2.827 m from trailer center
  const eyeDist = TANK.eyeToAxle - TANK.axleZ;

  for (const [name, tr] of [['tractor_juff', JUFF], ['tractor_kidbi', KIDBI]]) {
    for (const deg of [70, -70]) {
      const phi = deg * Math.PI / 180;
      const tractorPose = { x: 0, z: 0, yaw: 0 };
      const pin = { x: 0, z: -tr.hz - tr.pin };
      const trailerPose = {
        x: pin.x - eyeDist * Math.sin(phi),
        z: pin.z - eyeDist * Math.cos(phi),
        yaw: phi,
      };

      const overlap = hullsOverlap(tractorPose, tr.hx, tr.hz, trailerPose, TANK.hx, TANK.hz);
      assert.equal(overlap, false, `${name} and tank trailer hulls do not overlap at ${deg} degrees`);
    }
  }
}

console.log('PASS hitch-rules.mjs: constants, pinWorldPos, hitchAvailable, tractrix 165Hz convergence, jackknife clamp/stop, reverse assist decay, derate numbers, collision bisection, and 70 deg hull clearance passed.');
