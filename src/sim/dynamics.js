// The equations of motion, docs/flight-model.md section 4: rigid body, six
// degrees of freedom, constant mass, flat non-rotating earth, integrated at a
// fixed 120 Hz with fourth-order Runge-Kutta. Pure functions over a flat
// Float64Array state so every step is deterministic. The shape is Rage's;
// the state carries four engines' power fractions and the stabiliser instead
// of the F-16's power state.

import { atmosphere, RHO0 } from './atmosphere.js';
import { coefficients } from './aero.js';
import { commandedPower, powerRate, netThrust } from './engine.js';
import { surfaceRate, clampSurface, stabiliserRate } from './actuators.js';
import * as Quat from './quaternion.js';
import {
  G, MASS, S, B, CBAR, HX, Z_THRUST, C1, C2, C3, C4, C5, C6, C7, C8, C9, SURFACES, rudderLimit,
  ALPHA_ENVELOPE, BETA_ENVELOPE, MACH_ENVELOPE,
} from './data/aircraft.js';

export const DT = 1 / 120;
const R2D = 180 / Math.PI;
const D2R = Math.PI / 180;
const FT_PER_S_PER_KNOT = 1.68781;

// State layout. Velocities ft/s, rates rad/s, position ft, engine power fractions 0..1, surfaces deg.
export const IX = Object.freeze({
  U: 0, V: 1, W: 2,
  Q0: 3, Q1: 4, Q2: 5, Q3: 6,
  P: 7, Q: 8, R: 9,
  NORTH: 10, EAST: 11, H: 12,
  F1: 13, F2: 14, F3: 15, F4: 16,
  DE: 17, DA: 18, DR: 19, IS: 20,
});
export const N = 21;
export const ENGINES = [IX.F1, IX.F2, IX.F3, IX.F4];

// Build a state from flight-style quantities. vt ft/s; alpha, beta, phi,
// theta, psi in radians; power per engine (fraction); the rest as in the state.
export function makeState({
  vt, alpha = 0, beta = 0, phi = 0, theta = 0, psi = 0,
  p = 0, q = 0, r = 0, north = 0, east = 0, h = 0, power = 0, de = 0, da = 0, dr = 0, is = 0,
}) {
  const x = new Float64Array(N);
  x[IX.U] = vt * Math.cos(alpha) * Math.cos(beta);
  x[IX.V] = vt * Math.sin(beta);
  x[IX.W] = vt * Math.sin(alpha) * Math.cos(beta);
  const Q = Quat.fromEuler(phi, theta, psi);
  x[IX.Q0] = Q[0]; x[IX.Q1] = Q[1]; x[IX.Q2] = Q[2]; x[IX.Q3] = Q[3];
  x[IX.P] = p; x[IX.Q] = q; x[IX.R] = r;
  x[IX.NORTH] = north; x[IX.EAST] = east; x[IX.H] = h;
  for (const i of ENGINES) x[i] = power;
  x[IX.DE] = de; x[IX.DA] = da; x[IX.DR] = dr; x[IX.IS] = is;
  return x;
}

export function quaternionOf(x) {
  return [x[IX.Q0], x[IX.Q1], x[IX.Q2], x[IX.Q3]];
}

// VT (ft/s), α and β (radians) from u, v, w. VT is guarded against zero.
export function airOf(x) {
  const u = x[IX.U], v = x[IX.V], w = x[IX.W];
  const vt = Math.max(Math.hypot(u, v, w), 1e-6);
  let sb = v / vt;
  if (sb > 1) sb = 1; else if (sb < -1) sb = -1;
  return { vt, alpha: Math.atan2(w, u), beta: Math.asin(sb) };
}

// The four engines' net thrust, lbf, at the present altitude, Mach and speed.
export function totalThrust(x, h, mach, vt) {
  let t = 0;
  for (const i of ENGINES) t += netThrust(x[i], h, mach, vt);
  return t;
}

// Equivalent airspeed in knots from dynamic pressure, for the rudder's authority.
export function keasOf(qbar) {
  return Math.sqrt(2 * qbar / RHO0) / FT_PER_S_PER_KNOT;
}

// State derivative. controls = { throttle 0..1, de, da, dr commanded deg,
// isRate commanded stabiliser rate deg/s }. Surfaces act from their positions
// in the state; the commands only drive the actuators and the engines.
// mass (slug) is a parameter so the trim tests can fly other weights.
export function derivative(x, controls, xdot, mass = MASS) {
  const u = x[IX.U], v = x[IX.V], w = x[IX.W];
  const p = x[IX.P], q = x[IX.Q], r = x[IX.R];
  const h = x[IX.H];
  const Q = quaternionOf(x);

  const { vt, alpha, beta } = airOf(x);
  const alphaDeg = alpha * R2D, betaDeg = beta * R2D;
  const atm = atmosphere(vt, h);
  const qbar = atm.qbar, mach = atm.mach;
  const thrust = totalThrust(x, h, mach, vt);

  const c = coefficients({
    alphaDeg, betaDeg, de: x[IX.DE], da: x[IX.DA], dr: x[IX.DR], is: x[IX.IS],
    p, q, r, vt, qbar, mach,
  });

  // Gravity in body axes: the last row of the NED→body rotation times g.
  const gx = G * 2 * (Q[1] * Q[3] - Q[0] * Q[2]);
  const gy = G * 2 * (Q[2] * Q[3] + Q[0] * Q[1]);
  const gz = G * (Q[0] * Q[0] - Q[1] * Q[1] - Q[2] * Q[2] + Q[3] * Q[3]);

  const rm = 1 / mass;
  const qs = qbar * S;
  const ax = rm * (qs * c.cx + thrust);
  const ay = rm * qs * c.cy;
  const az = rm * qs * c.cz;

  xdot[IX.U] = r * v - q * w + gx + ax;
  xdot[IX.V] = p * w - r * u + gy + ay;
  xdot[IX.W] = q * u - p * v + gz + az;

  // Moments: aerodynamic, plus the thrust line Z_THRUST below the CG (nose up).
  const qsb = qs * B;
  const my = qs * CBAR * c.Cm + thrust * Z_THRUST;
  xdot[IX.P] = (C2 * p + C1 * r + C4 * HX) * q + qsb * (C3 * c.clBody + C4 * c.cnBody);
  xdot[IX.Q] = (C5 * p - C7 * HX) * r + C6 * (r * r - p * p) + C7 * my;
  xdot[IX.R] = (C8 * p - C2 * r + C9 * HX) * q + qsb * (C4 * c.clBody + C9 * c.cnBody);

  const qd = Quat.derivative(Q, p, q, r);
  xdot[IX.Q0] = qd[0]; xdot[IX.Q1] = qd[1]; xdot[IX.Q2] = qd[2]; xdot[IX.Q3] = qd[3];

  const vned = Quat.bodyToNed(Q, [u, v, w]);
  xdot[IX.NORTH] = vned[0];
  xdot[IX.EAST] = vned[1];
  xdot[IX.H] = -vned[2];

  const fcmd = commandedPower(controls.throttle);
  for (const i of ENGINES) xdot[i] = powerRate(fcmd, x[i]);
  xdot[IX.DE] = surfaceRate('de', controls.de, x[IX.DE]);
  xdot[IX.DA] = surfaceRate('da', controls.da, x[IX.DA]);
  xdot[IX.DR] = surfaceRate('dr', controls.dr, x[IX.DR], rudderLimit(keasOf(qbar)));
  xdot[IX.IS] = stabiliserRate(controls.isRate ?? 0, x[IX.IS]);

  return {
    vt, alpha, beta, mach, qbar, thrust,
    alphaDeg, betaDeg,
    nz: -qs * c.cz * rm / G,       // accelerometer load factor, +1 in level flight
    ny: qs * c.cy * rm / G,
    ax, ay, az,
    powerCommand: fcmd,
    coefficients: c,
    outOfEnvelope: alphaDeg < ALPHA_ENVELOPE[0] || alphaDeg > ALPHA_ENVELOPE[1]
      || Math.abs(betaDeg) > BETA_ENVELOPE || mach > MACH_ENVELOPE,
  };
}

const k1 = new Float64Array(N), k2 = new Float64Array(N), k3 = new Float64Array(N), k4 = new Float64Array(N);
const xt = new Float64Array(N);

// One RK4 step. Returns the new state (a fresh array) and the auxiliary
// quantities evaluated at the start of the step.
export function step(x, controls, dt = DT, mass = MASS) {
  const aux = derivative(x, controls, k1, mass);
  for (let i = 0; i < N; i++) xt[i] = x[i] + 0.5 * dt * k1[i];
  derivative(xt, controls, k2, mass);
  for (let i = 0; i < N; i++) xt[i] = x[i] + 0.5 * dt * k2[i];
  derivative(xt, controls, k3, mass);
  for (let i = 0; i < N; i++) xt[i] = x[i] + dt * k3[i];
  derivative(xt, controls, k4, mass);
  const y = new Float64Array(N);
  for (let i = 0; i < N; i++) y[i] = x[i] + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);

  const Q = Quat.normalize(quaternionOf(y));
  y[IX.Q0] = Q[0]; y[IX.Q1] = Q[1]; y[IX.Q2] = Q[2]; y[IX.Q3] = Q[3];
  y[IX.DE] = clampSurface('de', y[IX.DE]);
  y[IX.DA] = clampSurface('da', y[IX.DA]);
  y[IX.DR] = clampSurface('dr', y[IX.DR], rudderLimit(keasOf(aux.qbar)));
  y[IX.IS] = clampSurface('is', y[IX.IS]);
  for (const i of ENGINES) { if (y[i] < 0) y[i] = 0; else if (y[i] > 1) y[i] = 1; }
  return { state: y, aux };
}

// Below the ground the flight is over. The model knows only a flat world at
// 0 ft; the app passes the terrain's height under the jet (ft) when there is one.
export function crashed(x, groundFt = 0) {
  return x[IX.H] <= groundFt;
}

export { D2R, R2D, SURFACES };
