// Four F108s, docs/flight-model.md section 6. An engine's state is its power
// fraction f, 0 at flight idle and 1 at the take-off rating, which follows the
// throttle through the spool lag. Its net thrust is f of the rated thrust at
// the present altitude and Mach (the certified rating lapsed by the Bartel and
// Young equations as printed in OpenAP, the stand-in for the PMC) plus (1 − f)
// of the flight-idle net thrust, which is the idle's small gross thrust less
// the ram drag of the air passing through it, and is negative at speed.

import { atmosphere, P0, RHO0 } from './atmosphere.js';
import {
  T0, MCT_FRACTION, IDLE_FRACTION, MDOT_IDLE, BYPASS, T_CRUISE, M_CRUISE, H_CRUISE, H_LOW, H_HIGH,
  DETENT, N1_MAX, TAU_FAST, TAU_IDLE, FAST_FRACTION,
} from './data/engine.js';

const P_CRUISE = atmosphere(0, H_CRUISE).pressure;
const P_LOW = atmosphere(0, H_LOW).pressure;
const P_HIGH = atmosphere(0, H_HIGH).pressure;

// OpenAP equations 17–21: the take-off rating against pressure ratio and Mach.
function takeoffThrust(delta, mach) {
  const g0 = 0.0606 * BYPASS + 0.6337;
  const a = -0.4327 * delta * delta + 1.3855 * delta + 0.0472;
  const z = 0.9106 * delta ** 3 - 1.7736 * delta * delta + 1.8697 * delta;
  const x = 0.1377 * delta ** 3 - 0.4374 * delta * delta + 1.3003 * delta;
  const ram = 0.377 * (1 + BYPASS) / Math.sqrt((1 + 0.82 * BYPASS) * g0);
  return T0 * (a - ram * z * mach + (0.23 + 0.19 * Math.sqrt(BYPASS)) * x * mach * mach);
}

// OpenAP equations 22–23: the en-route rating against pressure and Mach.
function enrouteThrust(pressure, mach) {
  const m = Math.max(mach, 0.2) / M_CRUISE;
  const c1 = -0.4204 * m + 1.0824;
  const c2 = Math.pow(m, -0.11);
  return T_CRUISE * (c1 * Math.log(pressure / P_CRUISE) + c2);
}

// The rated (maximum) net thrust of one engine, lbf, at altitude h (ft) and
// Mach: take-off rating to H_LOW, en-route rating from H_HIGH, blended in
// pressure between.
export function maxThrust(h, mach) {
  const { pressure } = atmosphere(0, h);
  const m = Math.max(0, mach);
  if (h <= H_LOW) return takeoffThrust(pressure / P0, m);
  if (h >= H_HIGH) return enrouteThrust(pressure, m);
  const low = takeoffThrust(P_LOW / P0, m);
  const high = enrouteThrust(P_HIGH, m);
  const f = (P_LOW - pressure) / (P_LOW - P_HIGH);
  return low + (high - low) * f;
}

export function mctThrust(h, mach) { return MCT_FRACTION * maxThrust(h, mach); }

// Flight idle's net thrust, lbf: a small gross thrust (IDLE_FRACTION of the
// local static maximum) less the ram drag of the idling engine's airflow,
// MDOT_IDLE·σ·V. Positive at rest, negative above about 150 kt.
export function idleThrust(h, vt) {
  const { rho } = atmosphere(vt, h);
  return IDLE_FRACTION * maxThrust(h, 0) - MDOT_IDLE * (rho / RHO0) * vt;
}

// One engine's net thrust at power fraction f (0 idle .. 1 take-off). Not
// clamped here: the state is, and the trim solver needs the slope beyond the
// ends to know a condition is out of reach.
export function netThrust(f, h, mach, vt) {
  return f * maxThrust(h, mach) + (1 - f) * idleThrust(h, vt);
}

// The throttle s (0..1) to the commanded power fraction: idle to MCT below
// the detent, MCT to take-off above it.
export function commandedPower(s) {
  const t = s < 0 ? 0 : s > 1 ? 1 : s;
  if (t <= DETENT) return MCT_FRACTION * t / DETENT;
  return MCT_FRACTION + (1 - MCT_FRACTION) * (t - DETENT) / (1 - DETENT);
}

// The throttle position that commands a given power fraction (for the air
// start): the inverse of commandedPower.
export function throttleFor(f) {
  if (f <= MCT_FRACTION) return Math.max(0, f / MCT_FRACTION * DETENT);
  return Math.min(1, DETENT + (f - MCT_FRACTION) / (1 - MCT_FRACTION) * (1 - DETENT));
}

// The spool lag's time constant at the present power fraction.
export function spoolTau(f) {
  if (f >= FAST_FRACTION) return TAU_FAST;
  if (f <= 0) return TAU_IDLE;
  return TAU_IDLE + (TAU_FAST - TAU_IDLE) * f / FAST_FRACTION;
}

// Rate of change of one engine's power fraction toward its command, per second.
export function powerRate(command, f) {
  return (command - f) / spoolTau(f);
}

// The maximum N1 shown, per cent (flight model 6): the PMC caps the fan's
// corrected speed, so the physical speed at the cap falls with the square root
// of the temperature ratio: 102 % at sea level, 91 % at FL300, 88 % above the
// tropopause. A cue, not data.
export function maxN1(h) {
  return N1_MAX * Math.sqrt(atmosphere(0, h).theta);
}

// The N1 shown for a power fraction: the square law from the idle's share of
// the static thrust to the local maximum. About 27 % at idle at sea level.
export function n1(f, h) {
  const p = f < 0 ? 0 : f > 1 ? 1 : f;
  return maxN1(h) * Math.sqrt(IDLE_FRACTION + (1 - IDLE_FRACTION) * p);
}

export { DETENT };
