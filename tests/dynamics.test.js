import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeState, derivative, step, IX, N, crashed, keasOf } from '../src/sim/dynamics.js';
import { inertiaConstants, C1, C7, IXX, IYY, IZZ, IXZ, Z_THRUST, rudderLimit } from '../src/sim/data/aircraft.js';
import { trimLevel } from '../src/sim/trim.js';
import { atmosphere } from '../src/sim/atmosphere.js';

const D2R = Math.PI / 180;

test('the inertia constants are the standard formulas of the data\'s inertias', () => {
  // worked by hand for Ixx 2.76, Iyy 4.11, Izz 6.74, Ixz 0.25 (×10⁶ slug·ft²)
  const g = IXX * IZZ - IXZ * IXZ;                 // 1.85374e13 − 6.25e10 = 1.84749e13
  const c = inertiaConstants();
  assert.ok(Math.abs(c.c1 - ((IYY - IZZ) * IZZ - IXZ * IXZ) / g) < 1e-15);
  // (−17.7262 − 0.0625) / (18.6024 − 0.0625) = −17.7887 / 18.5399
  assert.ok(Math.abs(C1 - (-0.95948)) < 1e-4, `c1 ${C1}`);
  assert.ok(Math.abs(c.c5 - (6.74 - 2.76) / 4.11) < 1e-9);
  assert.ok(Math.abs(C7 - 1 / 4.11e6) < 1e-18);
  assert.ok(Math.abs(c.c9 - 2.76e6 / g) < 1e-20);
  // with no cross product the constants collapse to the diagonal case
  const d = inertiaConstants(1, 2, 3, 0);
  assert.equal(d.c2, 0); assert.equal(d.c4, 0); assert.equal(d.c6, 0);
  assert.ok(Math.abs(d.c1 - (2 - 3) / 1) < 1e-12 && Math.abs(d.c3 - 1) < 1e-12 && Math.abs(d.c8 - (1 - 2) / 3) < 1e-12);
});

// A trimmed air start, with the surfaces then set directly in the state.
function trimmed() {
  const t = trimLevel(550, 10000);
  assert.ok(t.ok);
  return t;
}

function rates(x, controls) {
  const xd = new Float64Array(N);
  const aux = derivative(x, controls, xd);
  return { xd, aux };
}

test('each control and the thrust line move the jet the way docs/flight-model.md 2.3 says', () => {
  const t = trimmed();
  const base = rates(t.state, t.controls);
  assert.ok(Math.abs(base.xd[IX.Q]) < 1e-6 && Math.abs(base.xd[IX.U]) < 1e-5 && Math.abs(base.xd[IX.W]) < 1e-5, 'trimmed');

  const withDe = Float64Array.from(t.state); withDe[IX.DE] = 5;
  assert.ok(rates(withDe, t.controls).xd[IX.Q] < -0.01, 'elevator trailing edge down pitches nose-down');
  const withIs = Float64Array.from(t.state); withIs[IX.IS] = t.is + 1;
  assert.ok(rates(withIs, t.controls).xd[IX.Q] < -0.01, 'stabiliser leading edge up pitches nose-down');
  const withDa = Float64Array.from(t.state); withDa[IX.DA] = 10;
  assert.ok(rates(withDa, t.controls).xd[IX.P] < -0.01, 'positive roll control rolls left');
  const withDr = Float64Array.from(t.state); withDr[IX.DR] = 5;
  const r = rates(withDr, t.controls);
  assert.ok(r.xd[IX.R] < -0.005, 'positive rudder yaws the nose left');
  assert.ok(r.aux.ny > 0.005, 'and pushes the jet right');
  const withBeta = makeState({ vt: 550, alpha: t.alpha * D2R, beta: 5 * D2R, theta: t.alpha * D2R, h: 10000, thrust: t.thrust, is: t.is });
  const b = rates(withBeta, t.controls);
  assert.ok(b.xd[IX.R] > 0.005, 'sideslip from the right yaws the nose right (weathercock)');
  assert.ok(b.xd[IX.P] < -0.005, 'and rolls the jet left (dihedral)');
  const moreThrust = Float64Array.from(t.state); for (const i of [IX.T1, IX.T2, IX.T3, IX.T4]) moreThrust[i] += 2000;
  const m = rates(moreThrust, t.controls);
  assert.ok(m.xd[IX.Q] > 0, 'the thrust line below the CG pitches the nose up');
  assert.ok(Math.abs(m.xd[IX.Q] - C7 * 8000 * Z_THRUST) < 1e-9);
  assert.ok(m.xd[IX.U] > base.xd[IX.U], 'and accelerates');
});

test('the rudder\'s authority is 7° at 320 kt and the structural 25° when slow', () => {
  assert.ok(Math.abs(rudderLimit(320) - 7) < 1e-9);
  assert.ok(Math.abs(rudderLimit(160) - 25) < 1e-9);
  assert.ok(Math.abs(rudderLimit(226.3) - 14) < 0.05);
  const q = atmosphere(0, 0).qbar;   // 0 at rest
  assert.equal(keasOf(q), 0);
  assert.ok(Math.abs(keasOf(0.5 * 0.0023769 * (320 * 1.68781) ** 2) - 320) < 0.01);
});

test('the actuators lag and rate-limit the surfaces and the trim motor runs at 0.5°/s', () => {
  const t = trimmed();
  let x = t.state;
  const controls = { ...t.controls, de: -10, da: 10, dr: 10, isRate: 5 };
  for (let i = 0; i < 12; i++) x = step(x, controls).state;     // 0.1 s
  assert.ok(x[IX.DE] < -5 && x[IX.DE] > -7, `elevator after one time constant: ${x[IX.DE]}`);
  assert.ok(x[IX.DA] > 3.5 && x[IX.DA] <= 4.0 + 1e-9, `roll control rate-limited to 40°/s: ${x[IX.DA]}`);
  assert.ok(x[IX.DR] <= 5.0 && x[IX.DR] > 3, `rudder rate-limited to 50°/s: ${x[IX.DR]}`);
  assert.ok(Math.abs(x[IX.IS] - (t.is + 0.05)) < 1e-6, `stabiliser 0.05° in 0.1 s: ${x[IX.IS] - t.is}`);
  for (let i = 0; i < 240; i++) x = step(x, controls).state;    // 2 s more
  const now = atmosphere(Math.hypot(x[IX.U], x[IX.V], x[IX.W]), x[IX.H]).qbar;
  assert.ok(Math.abs(x[IX.DR] - rudderLimit(keasOf(now))) < 0.1, `rudder at its authority: ${x[IX.DR]} vs ${rudderLimit(keasOf(now))}`);
  const x2 = step(x, { ...controls, isRate: 5 }).state;
  assert.ok(x2[IX.IS] <= 0.5, 'stabiliser stops at +0.5°');
});

test('crashed below the ground', () => {
  const x = makeState({ vt: 500, h: 100 });
  assert.ok(!crashed(x));
  assert.ok(crashed(x, 100));
  x[IX.H] = -1;
  assert.ok(crashed(x));
});

test('a trimmed jet with the controls held flies straight for 30 s and random inputs never make NaN', () => {
  const t = trimmed();
  let x = t.state;
  for (let i = 0; i < 3600; i++) x = step(x, t.controls).state;
  const dh = x[IX.H] - 10000;
  console.log(`  30 s hands-off from trim: Δh ${dh.toFixed(2)} ft, u ${x[IX.U].toFixed(2)} ft/s (${t.state[IX.U].toFixed(2)} at trim)`);
  assert.ok(Math.abs(dh) < 5 && Math.abs(x[IX.U] - t.state[IX.U]) < 1);
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  for (let f = 0; f < 4; f++) {
    x = Float64Array.from(t.state);
    for (let i = 0; i < 2400; i++) {
      const c = { throttle: rnd(), de: (rnd() - 0.5) * 40, da: (rnd() - 0.5) * 40, dr: (rnd() - 0.5) * 50, isRate: (rnd() - 0.5) };
      x = step(x, c).state;
      for (let k = 0; k < N; k++) assert.ok(Number.isFinite(x[k]), `NaN at flight ${f}, step ${i}, state ${k}`);
    }
  }
});
