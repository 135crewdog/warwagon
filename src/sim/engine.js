// Four F108s, docs/flight-model.md section 6: the maximum available at the
// present altitude and Mach (the certified rating lapsed by the Bartel and
// Young equations as printed in OpenAP, the stand-in for the PMC), the
// throttle with its MCT detent, the spool lag, and the N1 shown.

import { atmosphere, P0 } from './atmosphere.js';
import {
  T0, MCT_FRACTION, IDLE_FRACTION, BYPASS, T_CRUISE, M_CRUISE, H_CRUISE, H_LOW, H_HIGH,
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

// The maximum thrust available from one engine, lbf, at altitude h (ft) and
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
export function idleThrust(h, mach) { return IDLE_FRACTION * maxThrust(h, mach); }

// The throttle s (0..1) to the commanded thrust per engine: idle to MCT below
// the detent, MCT to take-off above it.
export function commandedThrust(s, h, mach) {
  const tmax = maxThrust(h, mach);
  const idle = IDLE_FRACTION * tmax, mct = MCT_FRACTION * tmax;
  const t = s < 0 ? 0 : s > 1 ? 1 : s;
  if (t <= DETENT) return idle + (mct - idle) * t / DETENT;
  return mct + (tmax - mct) * (t - DETENT) / (1 - DETENT);
}

// The throttle position that commands a given thrust per engine (for the air
// start): the inverse of commandedThrust.
export function throttleFor(thrust, h, mach) {
  const tmax = maxThrust(h, mach);
  const idle = IDLE_FRACTION * tmax, mct = MCT_FRACTION * tmax;
  if (thrust <= mct) return Math.max(0, (thrust - idle) / (mct - idle) * DETENT);
  return Math.min(1, DETENT + (thrust - mct) / (tmax - mct) * (1 - DETENT));
}

// The spool lag's time constant at the present thrust (lbf).
export function spoolTau(thrust) {
  const f = thrust / T0;
  if (f >= FAST_FRACTION) return TAU_FAST;
  if (f <= IDLE_FRACTION) return TAU_IDLE;
  return TAU_IDLE + (TAU_FAST - TAU_IDLE) * (f - IDLE_FRACTION) / (FAST_FRACTION - IDLE_FRACTION);
}

// Rate of change of one engine's thrust toward its command, lbf/s.
export function thrustRate(command, thrust) {
  return (command - thrust) / spoolTau(thrust);
}

// The maximum N1 shown, per cent (flight model 6): the PMC caps the fan's
// corrected speed, so the physical speed at the cap falls with the square root
// of the temperature ratio: 102 % at sea level, 91 % at FL300, 88 % above the
// tropopause. A cue, not data.
export function maxN1(h) {
  return N1_MAX * Math.sqrt(atmosphere(0, h).theta);
}

// The N1 shown for a thrust: the square law against the local maximum.
export function n1(thrust, h, mach) {
  const t = Math.max(0, thrust);
  return maxN1(h) * Math.sqrt(t / maxThrust(h, mach));
}

export { DETENT };
