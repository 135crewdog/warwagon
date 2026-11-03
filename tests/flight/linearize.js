// Finite-difference linearisation of the simulation about a trimmed flight
// condition, and the eigenvalues of the result, so the short period, phugoid,
// dutch roll, roll and spiral modes can be read off (docs/flight-model.md
// 12.2). With the automatics off the airframe is bare: the surfaces sit at
// their trim positions. Test tooling only; the game never needs it. The
// eigenvalue code is Rage's.

import { Simulation, DT } from '../../src/sim/simulation.js';
import { IX } from '../../src/sim/dynamics.js';

// Longitudinal and lateral subsets of the state. In wings-level flight the
// two decouple, which keeps the spurious quaternion-norm direction and the
// position integrators out of the way.
export const LONGITUDINAL = { dyn: { u: IX.U, w: IX.W, q: IX.Q, q0: IX.Q0, q2: IX.Q2, is: IX.IS }, mem: [] };
export const LATERAL = { dyn: { v: IX.V, p: IX.P, r: IX.R, q1: IX.Q1, q3: IX.Q3, dr: IX.DR }, mem: ['rWash'] };

export const BARE = { trim: false, damper: false, coordination: false };
export const DAMPED = { trim: false, damper: true, coordination: false };
export const ALL = { trim: true, damper: true, coordination: true };

function pack(sim, subset) {
  const z = [];
  for (const k of Object.keys(subset.dyn)) z.push(sim.state[subset.dyn[k]]);
  for (const k of subset.mem) z.push(sim.memory[k]);
  return z;
}

function unpack(sim, subset, z) {
  let i = 0;
  for (const k of Object.keys(subset.dyn)) sim.state[subset.dyn[k]] = z[i++];
  for (const k of subset.mem) sim.memory[k] = z[i++];
}

// One closed-loop step from a perturbed state, returning the packed result.
function stepFrom(trim, subset, z) {
  const sim = new Simulation({ h: trim.h, kcas: trim.kcas, mass: trim.mass });
  sim.automatics = trim.automatics;
  sim.state = Float64Array.from(trim.state);
  Object.assign(sim.memory, trim.memory);
  unpack(sim, subset, z);
  sim.aux = sim.auxFor(sim.state, sim.controls);
  sim.step({ pitch: 0, roll: 0 }, trim.throttle);
  return pack(sim, subset);
}

// Discrete-time Jacobian of the one-step map by central differences; the
// eigenvalues are mapped to continuous time with s = ln(λ)/dt.
export function linearize(h, kcas, subset, automatics = BARE, mass) {
  const sim = new Simulation({ h, kcas, mass });
  sim.automatics = automatics;
  const trim = { h, kcas, mass: sim.mass, automatics, state: Float64Array.from(sim.state), memory: { ...sim.memory }, throttle: sim.trimThrottle };
  const z0 = pack(sim, subset);
  const n = z0.length;
  const names = [...Object.keys(subset.dyn), ...subset.mem];
  const A = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let j = 0; j < n; j++) {
    const eps = 1e-5 * Math.max(1, Math.abs(z0[j]));
    const zp = z0.slice(); zp[j] += eps;
    const zm = z0.slice(); zm[j] -= eps;
    const fp = stepFrom(trim, subset, zp), fm = stepFrom(trim, subset, zm);
    for (let i = 0; i < n; i++) A[i][j] = (fp[i] - fm[i]) / (2 * eps);
  }
  const eig = eigenvalues(A).map(({ re, im }) => {
    const mag = Math.hypot(re, im), ang = Math.atan2(im, re);
    return { re: Math.log(Math.max(mag, 1e-300)) / DT, im: ang / DT };
  });
  return { names, A, eig, vt: sim.aux.vt };
}

// The classical modes at a flight condition. Longitudinal: the two complex
// pairs are the short period (the faster) and the phugoid. Lateral: the
// complex pair is the dutch roll; of the real roots the most negative is the
// roll mode and the next largest in magnitude the spiral (the quaternion's
// norm direction sits at zero; the rudder actuator and the washout, when in
// the loop, are fast and slow real roots that are named by participation).
export function modes(h, kcas, automatics = BARE, mass) {
  const lon = linearize(h, kcas, LONGITUDINAL, automatics, mass);
  const lat = linearize(h, kcas, LATERAL, automatics, mass);
  // physical pairs only: the renormalised quaternion and the lag-free stabiliser leave numerical roots far out
  const pairs = (lin) => lin.eig.filter((e) => e.im > 1e-6 && Math.hypot(e.re, e.im) < 100).map(describe).sort((a, b) => b.wn - a.wn);
  const lp = pairs(lon);
  const dutch = pairs(lat)[0];
  const reals = lat.eig.filter((e) => Math.abs(e.im) <= 1e-6).map((e) => e.re).sort((a, b) => a - b);
  // the actuator (about −10/s) and the roll mode (about −1/s) are the two most negative; the
  // washout (−1/τ) and the spiral and the norm direction the rest; name by size
  const fast = reals.filter((r) => r < -5), mid = reals.filter((r) => r >= -5 && r < -0.1), slow = reals.filter((r) => r >= -0.1);
  const roll = mid.length ? mid[0] : fast[fast.length - 1];
  const slowSorted = slow.slice().sort((a, b) => Math.abs(b) - Math.abs(a));
  const spiral = slowSorted[0] ?? 0;
  return {
    shortPeriod: lp[0], phugoid: lp[1], dutchRoll: dutch,
    rollTau: -1 / roll, spiral: { re: spiral, doubling: spiral > 0 ? Math.LN2 / spiral : Infinity, halving: spiral < 0 ? -Math.LN2 / spiral : Infinity },
    lon, lat,
  };
}

// Mode descriptors for an eigenvalue: natural frequency, damping, period.
export function describe(e) {
  if (Math.abs(e.im) < 1e-6) return { kind: 'real', tau: -1 / e.re, re: e.re, im: 0 };
  const wn = Math.hypot(e.re, e.im);
  return { kind: 'pair', wn, zeta: -e.re / wn, period: 2 * Math.PI / Math.abs(e.im), re: e.re, im: Math.abs(e.im) };
}
// ---- eigenvalues of a real general matrix: Hessenberg reduction then shifted QR ----

export function eigenvalues(matrix) {
  const n = matrix.length;
  // 1-indexed working copy
  const a = Array.from({ length: n + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= n; j++) a[i][j] = matrix[i - 1][j - 1];
  elmhes(a, n);
  const wr = new Array(n + 1).fill(0), wi = new Array(n + 1).fill(0);
  hqr(a, n, wr, wi);
  const out = [];
  for (let i = 1; i <= n; i++) out.push({ re: wr[i], im: wi[i] });
  return out;
}

function elmhes(a, n) {
  for (let m = 2; m < n; m++) {
    let x = 0, i = m;
    for (let j = m; j <= n; j++) {
      if (Math.abs(a[j][m - 1]) > Math.abs(x)) { x = a[j][m - 1]; i = j; }
    }
    if (i !== m) {
      for (let j = m - 1; j <= n; j++) { const t = a[i][j]; a[i][j] = a[m][j]; a[m][j] = t; }
      for (let j = 1; j <= n; j++) { const t = a[j][i]; a[j][i] = a[j][m]; a[j][m] = t; }
    }
    if (x !== 0) {
      for (i = m + 1; i <= n; i++) {
        let y = a[i][m - 1];
        if (y !== 0) {
          y /= x;
          a[i][m - 1] = y;
          for (let j = m; j <= n; j++) a[i][j] -= y * a[m][j];
          for (let j = 1; j <= n; j++) a[j][m] += y * a[j][i];
        }
      }
    }
  }
}

const sign = (a, b) => (b >= 0 ? Math.abs(a) : -Math.abs(a));

function hqr(a, n, wr, wi) {
  let nn, m, l, k, j, its, i, mmin;
  let z = 0, y, x, w, v, u, t, s, r = 0, q = 0, p = 0, anorm = 0;
  for (i = 1; i <= n; i++) for (j = Math.max(i - 1, 1); j <= n; j++) anorm += Math.abs(a[i][j]);
  nn = n;
  t = 0;
  while (nn >= 1) {
    its = 0;
    do {
      for (l = nn; l >= 2; l--) {
        s = Math.abs(a[l - 1][l - 1]) + Math.abs(a[l][l]);
        if (s === 0) s = anorm;
        if (Math.abs(a[l][l - 1]) + s === s) { a[l][l - 1] = 0; break; }
      }
      x = a[nn][nn];
      if (l === nn) {
        wr[nn] = x + t; wi[nn--] = 0;
      } else {
        y = a[nn - 1][nn - 1];
        w = a[nn][nn - 1] * a[nn - 1][nn];
        if (l === nn - 1) {
          p = 0.5 * (y - x);
          q = p * p + w;
          z = Math.sqrt(Math.abs(q));
          x += t;
          if (q >= 0) {
            z = p + sign(z, p);
            wr[nn - 1] = wr[nn] = x + z;
            if (z) wr[nn] = x - w / z;
            wi[nn - 1] = wi[nn] = 0;
          } else {
            wr[nn - 1] = wr[nn] = x + p;
            wi[nn - 1] = -(wi[nn] = z);
          }
          nn -= 2;
        } else {
          if (its === 60) throw new Error('too many iterations in hqr');
          if (its === 10 || its === 20) {
            t += x;
            for (i = 1; i <= nn; i++) a[i][i] -= x;
            s = Math.abs(a[nn][nn - 1]) + Math.abs(a[nn - 1][nn - 2]);
            y = x = 0.75 * s;
            w = -0.4375 * s * s;
          }
          ++its;
          for (m = nn - 2; m >= l; m--) {
            z = a[m][m];
            r = x - z;
            s = y - z;
            p = (r * s - w) / a[m + 1][m] + a[m][m + 1];
            q = a[m + 1][m + 1] - z - r - s;
            r = a[m + 2][m + 1];
            s = Math.abs(p) + Math.abs(q) + Math.abs(r);
            p /= s; q /= s; r /= s;
            if (m === l) break;
            u = Math.abs(a[m][m - 1]) * (Math.abs(q) + Math.abs(r));
            v = Math.abs(p) * (Math.abs(a[m - 1][m - 1]) + Math.abs(z) + Math.abs(a[m + 1][m + 1]));
            if (u + v === v) break;
          }
          for (i = m + 2; i <= nn; i++) {
            a[i][i - 2] = 0;
            if (i !== m + 2) a[i][i - 3] = 0;
          }
          for (k = m; k <= nn - 1; k++) {
            if (k !== m) {
              p = a[k][k - 1];
              q = a[k + 1][k - 1];
              r = 0;
              if (k !== nn - 1) r = a[k + 2][k - 1];
              x = Math.abs(p) + Math.abs(q) + Math.abs(r);
              if (x !== 0) { p /= x; q /= x; r /= x; }
            }
            s = sign(Math.sqrt(p * p + q * q + r * r), p);
            if (s !== 0) {
              if (k === m) {
                if (l !== m) a[k][k - 1] = -a[k][k - 1];
              } else {
                a[k][k - 1] = -s * x;
              }
              p += s;
              x = p / s; y = q / s; z = r / s;
              q /= p; r /= p;
              for (j = k; j <= nn; j++) {
                p = a[k][j] + q * a[k + 1][j];
                if (k !== nn - 1) { p += r * a[k + 2][j]; a[k + 2][j] -= p * z; }
                a[k + 1][j] -= p * y;
                a[k][j] -= p * x;
              }
              mmin = nn < k + 3 ? nn : k + 3;
              for (i = l; i <= mmin; i++) {
                p = x * a[i][k] + y * a[i][k + 1];
                if (k !== nn - 1) { p += z * a[i][k + 2]; a[i][k + 2] -= p * r; }
                a[i][k + 1] -= p * q;
                a[i][k] -= p;
              }
            }
          }
        }
      }
    } while (l < nn - 1);
  }
}
