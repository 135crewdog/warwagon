// docs/flight-model.md 12.2, tests 1 to 6: the modes of the bare airframe at
// the three tuning conditions against the flight-test values and
// MIL-F-8785C Class III, and the dutch roll with the yaw damper on. Prints
// every mode; asserts the bands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modes, BARE, DAMPED } from './linearize.js';
import { AIR_START, CRUISE, HIGH, flyManoeuvre } from './manoeuvres.js';

const CONDITIONS = [['air start (10,000 ft, 280 KIAS)', AIR_START], ['cruise (FL300, Mach 0.78)', CRUISE], ['FL350, Mach 0.80', HIGH]];
const inBand = (v, lo, hi) => v >= lo && v <= hi;

const bare = CONDITIONS.map(([label, c]) => [label, c, modes(c.h, c.kcas, BARE)]);

test('1 short period, bare: ωn 1.2–2.2 rad/s, ζ 0.3–0.7 (flight test 1.39–1.67, 0.39–0.68)', () => {
  for (const [label, , m] of bare) {
    const sp = m.shortPeriod;
    console.log(`  ${label}: ${sp.wn.toFixed(2)} rad/s, ζ ${sp.zeta.toFixed(2)}`);
    assert.ok(inBand(sp.wn, 1.2, 2.2) && inBand(sp.zeta, 0.3, 0.7), `${label}: ${sp.wn} rad/s, ζ ${sp.zeta}`);
  }
});

test('2 phugoid, bare at the air start: period 50–130 s, ζ ≥ 0; at cruise and above the bare airframe tucks under, and the trim holds it', () => {
  const [label, , m] = bare[0];
  const ph = m.phugoid;
  console.log(`  ${label}: period ${ph.period.toFixed(0)} s, ζ ${ph.zeta.toFixed(3)} (flight test 40–110 s, 0.03–0.06)`);
  assert.ok(ph && inBand(ph.period, 50, 130) && ph.zeta >= 0, `${label}: ${JSON.stringify(ph)}`);
  for (const [lbl, c, mm] of bare.slice(1)) {
    const reals = mm.lon.eig.filter((e) => Math.abs(e.im) < 1e-6 && Math.abs(e.re) < 1 && Math.abs(e.re) > 1e-4).map((e) => e.re);
    const div = Math.max(...reals);
    console.log(`  ${lbl}: no phugoid pair; the long-period roots are real, ${reals.map((r) => r.toFixed(4)).join(' and ')} /s: a tuck-under doubling in ${(Math.LN2 / div).toFixed(0)} s with the trim frozen (reported, not a band)`);
    assert.ok(mm.phugoid === undefined);
    // with the automatic trim on, 60 s hands-off at the trim stays put
    const { rows } = flyManoeuvre('level', { ...c, t: 60 });
    const last = rows[rows.length - 1];
    const dev = Math.max(...rows.map((r) => Math.abs(r.nz - 1)));
    console.log(`    trim on, 60 s hands-off: n_z within 1 ± ${dev.toFixed(3)}, Mach ${rows[0].mach.toFixed(3)} → ${last.mach.toFixed(3)}, altitude ${rows[0].alt.toFixed(0)} → ${last.alt.toFixed(0)} ft, stabiliser ${rows[0].is.toFixed(2)} → ${last.is.toFixed(2)}°`);
    assert.ok(dev <= 0.05 && Math.abs(last.mach - rows[0].mach) < 0.01 && Math.abs(last.alt - rows[0].alt) < 300, `${lbl} with the trim on`);
  }
});

test('3 dutch roll, bare: period 3.8–5.5 s, ζ 0.03–0.15 (flight test 4.4–4.8 s, 0.056–0.063; the Shell 77 board about 5 s)', () => {
  for (const [label, , m] of bare) {
    const d = m.dutchRoll;
    console.log(`  ${label}: period ${d.period.toFixed(2)} s, ζ ${d.zeta.toFixed(3)}, ωn ${d.wn.toFixed(2)} rad/s`);
    assert.ok(inBand(d.period, 3.8, 5.5) && inBand(d.zeta, 0.03, 0.15), `${label}: ${d.period} s, ζ ${d.zeta}`);
  }
});

test('4 dutch roll, yaw damper on: ζ 0.3–0.5', () => {
  for (const [label, c] of CONDITIONS) {
    const d = modes(c.h, c.kcas, DAMPED).dutchRoll;
    console.log(`  ${label}: period ${d.period.toFixed(2)} s, ζ ${d.zeta.toFixed(3)}`);
    assert.ok(inBand(d.zeta, 0.3, 0.5), `${label}: ζ ${d.zeta}`);
  }
});

test('5 roll mode, bare: τ 0.6–1.4 s (flight test 0.74–1.0 s; 8785C ≤ 1.4 s)', () => {
  for (const [label, , m] of bare) {
    console.log(`  ${label}: τ ${m.rollTau.toFixed(2)} s`);
    assert.ok(inBand(m.rollTau, 0.6, 1.4), `${label}: τ ${m.rollTau}`);
  }
});

test('6 spiral, bare: stable, or doubling time ≥ 20 s (flight test stable, T½ 45–85 s; FLEXSTAB unstable)', () => {
  for (const [label, , m] of bare) {
    const s = m.spiral;
    console.log(`  ${label}: ${s.re > 0 ? `unstable, doubling in ${s.doubling.toFixed(0)} s` : `stable, halving in ${s.halving.toFixed(0)} s`}`);
    assert.ok(s.re <= 0 || s.doubling >= 20, `${label}: ${JSON.stringify(s)}`);
  }
});
