// What the HUD shows, docs/flight-model.md section 9, computed from the state
// and the atmosphere. Knots, feet, feet per minute, degrees and Mach. The
// VSI's lag lives in the Simulation, which has memory; this module is pure.

import { atmosphere, P0, A0, RHO0 } from './atmosphere.js';
import { airOf, quaternionOf, IX, R2D } from './dynamics.js';
import * as Quat from './quaternion.js';

export const FT_PER_S_PER_KNOT = 1.68781;

// Calibrated airspeed in ft/s from true airspeed (ft/s) and altitude (ft),
// subsonic: Vc = a0·√(5·((qc/p0 + 1)^(2/7) − 1)), qc = p·((1 + 0.2·M²)^3.5 − 1).
export function calibratedAirspeed(vt, h) {
  const { pressure, mach } = atmosphere(vt, h);
  const ratio = (Math.pow(1 + 0.2 * mach * mach, 3.5) - 1) * pressure / P0;   // qc / p0
  return A0 * Math.sqrt(5 * (Math.pow(ratio + 1, 2 / 7) - 1));
}

// True airspeed (ft/s) that reads as the given calibrated airspeed (knots) at
// altitude h: the inverse of calibratedAirspeed, by bisection.
export function trueAirspeedFromKcas(kcas, h) {
  const target = kcas * FT_PER_S_PER_KNOT;
  let lo = 0, hi = 2000;
  for (let i = 0; i < 60; i++) {
    const mid = 0.5 * (lo + hi);
    if (calibratedAirspeed(mid, h) < target) lo = mid; else hi = mid;
  }
  return 0.5 * (lo + hi);
}

// aux is the auxiliary output of the last derivative evaluation (for n_z, n_y).
export function airdata(x, aux) {
  const { vt, alpha, beta } = airOf(x);
  const h = x[IX.H];
  const atm = atmosphere(vt, h);
  const Q = quaternionOf(x);
  const e = Quat.toEuler(Q);
  const vned = Quat.bodyToNed(Q, [x[IX.U], x[IX.V], x[IX.W]]);
  let heading = e.psi * R2D;
  if (heading < 0) heading += 360;
  if (heading >= 360) heading -= 360;
  return {
    kcas: calibratedAirspeed(vt, h) / FT_PER_S_PER_KNOT,   // shown as KIAS: no position error is public
    keas: Math.sqrt(2 * atm.qbar / RHO0) / FT_PER_S_PER_KNOT,
    ktas: vt / FT_PER_S_PER_KNOT,
    mach: atm.mach,
    altitude: h,
    heading,
    pitch: e.theta * R2D,
    roll: e.phi * R2D,
    alpha: alpha * R2D,
    beta: beta * R2D,
    gamma: Math.asin(Math.max(-1, Math.min(1, -vned[2] / vt))) * R2D,   // flight-path angle
    verticalSpeed: -vned[2] * 60,                                       // ft/min, unlagged
    nz: aux ? aux.nz : 1,
    ny: aux ? aux.ny : 0,
    qbar: atm.qbar,
  };
}
