// Trim solver: steady flight states found by a damped Newton iteration on the
// equations of motion. Used by the tests (docs/flight-model.md 12.1 and 12.3)
// and by the air start. Degrees in and out for the angles the caller sets;
// the state itself is in radians. The unknowns of a KC-135 trim are α, the
// stabiliser i_s and the thrust per engine, with the elevator centred.

import { makeState, derivative, IX, N, D2R } from './dynamics.js';
import { atmosphere } from './atmosphere.js';
import { throttleFor } from './engine.js';
import { MASS, G } from './data/aircraft.js';

// A steady flight condition: zero sideslip, flight-path angle gamma (rad,
// wings level only), or a level turn at psidot (rad/s) at bank phi (rad).
// thrust is per engine. Surfaces are set directly in the state; the
// actuators are not in the loop. Returns the state, the controls, the
// derivative and the aux values.
export function steadyFlight({ vt, h, alpha, is = 0, de = 0, da = 0, dr = 0, phi = 0, psidot = 0, gamma = 0, thrust = 0, mass = MASS }) {
  const a = alpha * D2R;
  const theta = gamma !== 0 ? a + gamma : Math.atan(Math.cos(phi) * Math.tan(a));
  const x = makeState({
    vt, alpha: a, phi, theta, h,
    p: -psidot * Math.sin(theta),
    q: psidot * Math.cos(theta) * Math.sin(phi),
    r: psidot * Math.cos(theta) * Math.cos(phi),
    thrust, de, da, dr, is,
  });
  const mach = atmosphere(vt, h).mach;
  const controls = { throttle: throttleFor(thrust, h, mach), de, da, dr, isRate: 0 };
  const xdot = new Float64Array(N);
  const aux = derivative(x, controls, xdot, mass);
  return { x, controls, xdot, aux };
}

// Damped Newton with finite-difference Jacobian. f maps an array of unknowns
// to an array of residuals of the same length. Returns { x, residual, ok }.
export function newton(f, x0, { tol = 1e-9, maxIter = 60, fdStep = 1e-6 } = {}) {
  let x = x0.slice();
  let r = f(x);
  const n = x.length;
  const norm = (v) => Math.max(...v.map(Math.abs));
  let rn = norm(r);
  for (let iter = 0; iter < maxIter && rn > tol; iter++) {
    const J = [];
    for (let j = 0; j < n; j++) {
      const xp = x.slice();
      const hj = fdStep * Math.max(1, Math.abs(x[j]));
      xp[j] += hj;
      const rp = f(xp);
      J.push(rp.map((v, i) => (v - r[i]) / hj));
    }
    const dx = solveLinear(J, r.map((v) => -v), n);
    if (!dx) break;
    let lambda = 1;
    let accepted = false;
    for (let k = 0; k < 12; k++) {
      const xn = x.map((v, i) => v + lambda * dx[i]);
      const rNew = f(xn);
      const rnNew = norm(rNew);
      if (Number.isFinite(rnNew) && rnNew < rn) {
        x = xn; r = rNew; rn = rnNew; accepted = true;
        break;
      }
      lambda *= 0.5;
    }
    if (!accepted) break;
  }
  return { x, residual: r, ok: rn <= tol };
}

// Solve A·dx = b where A is given by columns. Gaussian elimination with pivoting.
function solveLinear(cols, b, n) {
  const A = [];
  for (let i = 0; i < n; i++) {
    A.push([]);
    for (let j = 0; j < n; j++) A[i].push(cols[j][i]);
    A[i].push(b[i]);
  }
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let i = c + 1; i < n; i++) if (Math.abs(A[i][c]) > Math.abs(A[piv][c])) piv = i;
    if (Math.abs(A[piv][c]) < 1e-14) return null;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const m = A[i][c] / A[c][c];
      for (let j = c; j <= n; j++) A[i][j] -= m * A[c][j];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

// Generic steady-flight trim. `fixed` holds the known quantities (vt, h,
// thrust, alpha, is, de, da, dr, phi, psidot, gamma, nz, mass); `free` names
// the unknowns with starting guesses; `zero` lists the residuals to drive to
// zero, from: udot vdot wdot pdot qdot rdot, nz (n_z − fixed.nz), and normal
// (the acceleration normal to the flight path in the plane of symmetry).
// Residuals are scaled so the Newton tolerance means the same for each.
export function trim(fixed, free, zero) {
  const names = Object.keys(free);
  const key = { udot: IX.U, vdot: IX.V, wdot: IX.W, pdot: IX.P, qdot: IX.Q, rdot: IX.R };
  const scale = { udot: 1, vdot: 1, wdot: 1, pdot: 1e3, qdot: 1e3, rdot: 1e3, nz: G, normal: 1 };
  const build = (vals) => {
    const c = { ...fixed };
    names.forEach((k, i) => { c[k] = vals[i]; });
    return steadyFlight(c);
  };
  const f = (vals) => {
    const { xdot, aux } = build(vals);
    return zero.map((z) => {
      if (z === 'nz') return (aux.nz - fixed.nz) * scale.nz;
      if (z === 'normal') return xdot[IX.W] * Math.cos(aux.alpha) - xdot[IX.U] * Math.sin(aux.alpha);
      return xdot[key[z]] * scale[z];
    });
  };
  const sol = newton(f, names.map((k) => free[k]), { tol: 1e-7 });
  const out = { ...fixed };
  names.forEach((k, i) => { out[k] = sol.x[i]; });
  const flight = build(sol.x);
  return { ...out, ok: sol.ok, residual: sol.residual, state: flight.x, controls: flight.controls, aux: flight.aux };
}

// Steady wings-level flight at a given speed, height and flight-path angle
// (deg, default level) with the elevator centred: α (deg), i_s (deg) and
// thrust per engine (lbf). mass (slug) defaults to the jet's.
export function trimLevel(vt, h, { gamma = 0, mass = MASS, guess = {} } = {}) {
  const alpha0 = guess.alpha ?? Math.min(12, Math.max(-2, 2.4e5 / (vt * vt)));
  return trim(
    { vt, h, gamma: gamma * D2R, mass },
    { alpha: alpha0, is: guess.is ?? -1, thrust: guess.thrust ?? 4000 },
    ['udot', 'wdot', 'qdot'],
  );
}

// A level turn at a given load factor with speed free to bleed: α, i_s, φ,
// δa, δr and ψ̇ for n_z at the given thrust per engine.
export function trimTurnAtLoad(vt, h, nz, { thrust = 4000, mass = MASS, guess = {} } = {}) {
  const phi0 = Math.acos(Math.min(1, 1 / Math.max(nz, 1)));
  return trim(
    { vt, h, thrust, nz, mass },
    { alpha: guess.alpha ?? 3, is: guess.is ?? -2, phi: guess.phi ?? phi0, da: 0, dr: 0, psidot: guess.psidot ?? 0.05 },
    ['vdot', 'normal', 'pdot', 'qdot', 'rdot', 'nz'],
  );
}
