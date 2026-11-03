// The flight controls, docs/flight-model.md section 8: the yoke to the
// elevator and the roll control, the automatic stabiliser trim, and the yaw
// damper with coordination. Pure functions over a small memory object so the
// closed loop stays deterministic. Gains live in data/controls.js.

import { PITCH, TRIM, ROLL, YAW } from './data/controls.js';
import { SURFACES, rudderLimit } from './data/aircraft.js';

const R2D = 180 / Math.PI;
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);

export function createMemory() {
  return {
    rWash: 0,          // low-pass state of the stability-axis yaw rate (rad/s); washout = r_s − rWash
    qWash: 0,          // low-pass state of the pitch rate (deg/s) for the trim's lead
  };
}

// 8.2: the elevator the yoke's force can hold against the air at this q̄.
export function elevatorFor(xPitch, qbar) {
  const q = Math.max(qbar, 1);
  return -clamp(xPitch * PITCH.kE / q, -SURFACES.de.limit, SURFACES.de.limit);
}

// 8.4: the wheel's angle sets the surfaces' angle.
export function rollControlFor(xRoll) {
  return -clamp(xRoll, -1, 1) * ROLL.gearing;
}

// 8.3: the stabiliser's commanded rate (deg/s) with the yoke released. The
// pitch rate arrives washed out: a steady turn's rate is not a change coming.
export function trimRate(xPitch, nz, qWashedDegPerS) {
  if (Math.abs(xPitch) >= PITCH.released) return 0;
  const e = (1 - nz) - TRIM.kq * qWashedDegPerS;
  if (Math.abs(e) <= TRIM.deadband) return 0;
  return -clamp(TRIM.kt * e, -SURFACES.is.rate, SURFACES.is.rate);
}

// One controls step. yoke = { pitch, roll } in −1..+1; meas from the
// simulation: qbar (psf), nz, ny (g), p, q, r (rad/s), alpha (rad), keas
// (kt). automatics = { trim, damper, coordination } booleans. Returns the
// commands for the dynamics: { de, da, dr, isRate } in degrees and deg/s.
export function controlsStep(mem, yoke, meas, dt, automatics = { trim: true, damper: true, coordination: true }) {
  const de = elevatorFor(yoke.pitch, meas.qbar);
  const da = rollControlFor(yoke.roll);
  const qDeg = meas.q * R2D;
  mem.qWash += (qDeg - mem.qWash) * Math.min(1, dt / TRIM.qWashoutTau);
  const isRate = automatics.trim ? trimRate(yoke.pitch, meas.nz, qDeg - mem.qWash) : 0;

  // 8.5: the yaw damper on the washed-out stability-axis yaw rate, plus the coordination
  const rs = meas.r * Math.cos(meas.alpha) - meas.p * Math.sin(meas.alpha);
  mem.rWash += (rs - mem.rWash) * Math.min(1, dt / YAW.washoutTau);
  let dr = 0;
  if (automatics.damper) dr += YAW.kyd * (rs - mem.rWash) * R2D;
  if (automatics.coordination) dr += YAW.kny * meas.ny;
  const lim = rudderLimit(meas.keas);
  dr = clamp(dr, -lim, lim);

  return { de, da, dr, isRate };
}
