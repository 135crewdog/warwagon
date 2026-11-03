// Test layer 1, docs/flight-model.md 12.1: the trim solver reproduces the
// public flight points, and layer 3's cruise drag.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimLevel, trimTurnAtLoad } from '../src/sim/trim.js';
import { atmosphere } from '../src/sim/atmosphere.js';
import { airdata, trueAirspeedFromKcas } from '../src/sim/airdata.js';
import { maxThrust } from '../src/sim/engine.js';
import { G, WEIGHT } from '../src/sim/data/aircraft.js';
import { step } from '../src/sim/dynamics.js';

const machTo = (m, h) => m * atmosphere(0, h).a;

test('Crenshaw\'s flight conditions and the 1998 trim point (data 8.1, 8.3, 13)', () => {
  const points = [
    // name, weight, h, VT, gamma, [theta, tol], [thrust, tol], [i_s, tol]
    ['cruise 1', 284000, 28500, machTo(0.77, 28500), 0, [2.4, 1.0], [16352, 0.15], [-2.28, 1.5]],
    ['cruise 2', 130000, 45600, machTo(0.77, 45600), 0, [1.63, 1.0], [7510, 0.15], [-1.87, 1.5]],
    // climb 3's stabiliser is not checked: FLEXSTAB's climb model has CD 0.039 against the flight test's
    // 0.025 and its thrust 18 % high (data 8.3), so its trim angle (−3.84°) is not a reference
    ['climb 3', 297000, 0, machTo(0.422, 0), 4.01, [7.0, 1.0], [38800, 0.20], null],
    ['G5 1998', 240000, 21000, 622, 0, [2.5, 1.0], null, null],
  ];
  console.log('  point     theta (flight)   thrust (flight)   i_s (FLEXSTAB)');
  for (const [name, w, h, vt, gamma, th, thr, is] of points) {
    const t = trimLevel(vt, h, { mass: w / G, gamma });
    assert.ok(t.ok, `${name}: residual ${t.residual}`);
    const ad = airdata(t.state, t.aux);
    const total = 4 * t.thrust;
    console.log(`  ${name.padEnd(9)} ${ad.pitch.toFixed(2).padStart(6)} (${th[0]})       ${total.toFixed(0).padStart(6)} (${thr ? thr[0] : '—'})     ${t.is.toFixed(2).padStart(6)} (${is ? is[0] : '—'})`);
    assert.ok(Math.abs(ad.pitch - th[0]) <= th[1], `${name}: theta ${ad.pitch}`);
    if (thr) assert.ok(Math.abs(total / thr[0] - 1) <= thr[1], `${name}: thrust ${total}`);
    if (is) assert.ok(Math.abs(t.is - is[0]) <= is[1], `${name}: i_s ${t.is}`);
    assert.ok(t.thrust <= maxThrust(h, ad.mach), `${name}: needs ${t.thrust} of ${maxThrust(h, ad.mach)} available`);
  }
});

test('Lux\'s flight polar (data 9.4): the trimmed model\'s drag at his points', () => {
  const lux = [[0.70, 0.40, 0.0230], [0.70, 0.45, 0.0255], [0.70, 0.50, 0.0272], [0.75, 0.40, 0.0233], [0.75, 0.45, 0.0254],
    [0.78, 0.40, 0.0234], [0.78, 0.45, 0.0258], [0.78, 0.50, 0.0284], [0.80, 0.40, 0.0235], [0.80, 0.45, 0.0264]];
  console.log('  M     CL     CD (Lux)');
  for (const [m, cl, cd] of lux) {
    // the altitude at which 240,000 lb needs this CL at this Mach
    let lo = 0, hi = 60000;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (0.7 * atmosphere(0, mid).pressure * m * m > WEIGHT / (cl * 2433)) lo = mid; else hi = mid;
    }
    const h = (lo + hi) / 2;
    const t = trimLevel(machTo(m, h), h);
    assert.ok(t.ok);
    const c = t.aux.coefficients;
    console.log(`  ${m.toFixed(2)}  ${c.CL.toFixed(3)}  ${c.CD.toFixed(4)} (${cd})`);
    assert.ok(Math.abs(c.CL - cl) < 0.003);
    // 0.0006: Lux's reading accuracy (0.0004) plus the polar's residual at his CL 0.45 points, which sit 0.0005 off a parabola
    assert.ok(Math.abs(c.CD - cd) <= 0.0006, `M ${m} CL ${cl}: CD ${c.CD}`);
  }
});

test('the cruise point: CD 0.024 at Mach 0.78 and CL 0.42 (data 13)', () => {
  let lo = 0, hi = 60000;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (0.7 * atmosphere(0, mid).pressure * 0.78 * 0.78 > WEIGHT / (0.42 * 2433)) lo = mid; else hi = mid; }
  const t = trimLevel(machTo(0.78, lo), lo);
  console.log(`  Mach 0.78, CL ${t.aux.coefficients.CL.toFixed(3)} at ${lo.toFixed(0)} ft: CD ${t.aux.coefficients.CD.toFixed(4)}`);
  assert.ok(Math.abs(t.aux.coefficients.CD - 0.024) < 0.0005);
});

test('the air start trims inside the stabiliser\'s travel and the throttle\'s range, and a 1 g turn is level flight', () => {
  const vt = trueAirspeedFromKcas(280, 10000);
  const t = trimLevel(vt, 10000);
  assert.ok(t.ok);
  console.log(`  280 KIAS at 10,000 ft: α ${t.alpha.toFixed(2)}°, i_s ${t.is.toFixed(2)}°, thrust ${(4 * t.thrust).toFixed(0)} lbf, throttle ${t.controls.throttle.toFixed(3)}, Mach ${t.aux.mach.toFixed(3)}`);
  assert.ok(t.is > -14 && t.is < 0.5);
  assert.ok(t.controls.throttle > 0.05 && t.controls.throttle < 0.85);
  assert.ok(Math.abs(t.aux.nz - Math.cos(t.alpha * Math.PI / 180)) < 1e-6);
  const turn = trimTurnAtLoad(vt, 10000, t.aux.nz + 1e-6, { thrust: t.thrust });
  assert.ok(turn.ok, `turn residual ${turn.residual}`);
  assert.ok(Math.abs(turn.alpha - t.alpha) < 1e-3 && Math.abs(turn.is - t.is) < 1e-3 && Math.abs(turn.psidot) < 1e-3);
  // a 1.3 g level turn at the same thrust: the speed bleeds, the geometry holds
  const t13 = trimTurnAtLoad(vt, 10000, 1.3, { thrust: t.thrust });
  assert.ok(t13.ok, `1.3 g turn residual ${t13.residual}`);
  assert.ok(Math.abs(t13.phi * 180 / Math.PI - Math.acos(1 / 1.3) * 180 / Math.PI) < 3, `bank ${t13.phi * 180 / Math.PI}`);
  let x = t13.state;
  for (let i = 0; i < 240; i++) x = step(x, t13.controls).state;
  const a0 = airdata(t13.state, t13.aux), a1 = airdata(x, t13.aux);
  console.log(`  1.3 g turn at 280 KIAS: bank ${a0.roll.toFixed(1)}°, α ${t13.alpha.toFixed(2)}°, i_s ${t13.is.toFixed(2)}°, δa ${t13.da.toFixed(2)}°, δr ${t13.dr.toFixed(2)}°, ψ̇ ${(t13.psidot * 180 / Math.PI).toFixed(2)}°/s; after 2 s bank ${a1.roll.toFixed(1)}°, speed ${a0.ktas.toFixed(1)} → ${a1.ktas.toFixed(1)} kt`);
  assert.ok(Math.abs(a1.roll - a0.roll) < 1);
});
