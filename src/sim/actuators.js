// Control-surface actuators, docs/flight-model.md section 7: a first-order
// lag with a rate limit and a position limit. Degrees and seconds. The
// stabiliser is a rate-commanded trim motor with asymmetric travel; the
// rudder's position limit depends on speed, so the caller passes it.

import { SURFACES } from './data/aircraft.js';

export function clampSurface(name, pos, limit) {
  const s = SURFACES[name];
  const lo = name === 'is' ? s.min : -(limit ?? s.limit);
  const hi = name === 'is' ? s.max : (limit ?? s.limit);
  return pos < lo ? lo : pos > hi ? hi : pos;
}

// Rate of travel (deg/s) toward a commanded position.
export function surfaceRate(name, command, position, limit) {
  const { tau, rate } = SURFACES[name];
  const target = clampSurface(name, command, limit);
  if (tau <= 0) return 0;
  const v = (target - position) / tau;
  return v < -rate ? -rate : v > rate ? rate : v;
}

// The stabiliser: a commanded rate (deg/s), clamped to the motor's rate, and
// stopped at the travel's ends.
export function stabiliserRate(commandRate, position) {
  const { rate, min, max } = SURFACES.is;
  let v = commandRate < -rate ? -rate : commandRate > rate ? rate : commandRate;
  if (position <= min && v < 0) v = 0;
  if (position >= max && v > 0) v = 0;
  return v;
}
