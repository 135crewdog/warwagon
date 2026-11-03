// Test layer 1, docs/flight-model.md 12.1: the model is the data. Every table
// in src/sim/data/aero.js is checked against the chart record it was keyed
// from, and the derived constants against the sections that define them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../src/sim/data/aero.js';
import { coefficients } from '../src/sim/aero.js';
import { interp1 } from '../src/sim/table.js';

const record = (name) => JSON.parse(readFileSync(new URL(`../research/charts/${name}.json`, import.meta.url)));

// A curve's value at x, interpolated along the plotted straight segments
// between the recorded points, as research/tables.py makes the data file's
// rows: points within 0.4 of one another in x are averaged first.
function curveAt(points, x) {
  const pts = [...points].sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [px, py] of pts) {
    const last = merged[merged.length - 1];
    if (last && px - last.xs[last.xs.length - 1] < 0.4) { last.xs.push(px); last.ys.push(py); }
    else merged.push({ xs: [px], ys: [py] });
  }
  const xs = merged.map((m) => m.xs.reduce((a, b) => a + b) / m.xs.length);
  const ys = merged.map((m) => m.ys.reduce((a, b) => a + b) / m.ys.length);
  return interp1(xs, ys, x);
}

test('the longitudinal tables are the tail-0° curves of A1 figure 8(a)', () => {
  for (const [name, table, tol] of [['CL', D.CL_TAB, 0.002], ['Cm', D.CM_TAB, 0.002], ['CD', D.CD_TAB, 0.002]]) {
    const rec = record(`A1-fig8-p28-${name}`);
    assert.deepEqual(rec.breakpoints, D.ALPHA);
    let worst = 0;
    D.ALPHA.forEach((a, i) => {
      const v = curveAt(rec.curves.WBNH0V.points, a);
      worst = Math.max(worst, Math.abs(v - table[i]));
      assert.ok(Math.abs(v - table[i]) <= tol, `${name} at α ${a}: table ${table[i]}, record ${v.toFixed(4)}`);
    });
    console.log(`  ${name}(α): 15 breakpoints within ${worst.toFixed(4)} of the record`);
  }
});

test('the lateral tables are the clean β sweep of A1 figure 6, mirrored from its negative side', () => {
  for (const [name, bps, table, odd] of [['CY', D.BETA, D.CY_TAB], ['Cn', D.BETA, D.CN_TAB], ['Cl', D.BETA_CL, D.CLROLL_TAB]]) {
    const rec = record(`A1-fig6-p19-${name}`);
    const pts = rec.curves.WBNH6V.points;
    const zero = curveAt(pts, 0);
    let worst = 0;
    bps.forEach((b, i) => {
      const v = -(curveAt(pts, -b) - zero);   // the negative side, the zero offset removed, mirrored
      worst = Math.max(worst, Math.abs(v - table[i]));
      assert.ok(Math.abs(v - table[i]) <= 0.0015, `${name} at β ${b}: table ${table[i]}, record ${v.toFixed(4)}`);
    });
    console.log(`  ${name}(β): ${bps.length} breakpoints within ${worst.toFixed(4)} of the record; zero offset ${zero.toFixed(4)}`);
  }
});

test('the drag-rise table is Lux\'s flight increments to Mach 0.80 and the owner\'s trace of A3 figure 43 above it', () => {
  // to 0.80: Lux's CD at CL 0.40 and 0.50 against his Mach 0.70 polar (data 9.4)
  const lux = { 0.40: [0.0230, 0.0233, 0.0234, 0.0235], 0.50: [0.0272, 0.0279, 0.0284, null] };
  for (const [cl, ci] of [[0.40, 2], [0.50, 3]]) {
    [0.70, 0.75, 0.78, 0.80].forEach((M, ri) => {
      if (lux[cl][ri] === null) return;
      const expect = lux[cl][ri] - lux[cl][0];
      assert.ok(Math.abs(D.DCD[ri][ci] - expect) < 0.00006, `ΔCD at M ${M} CL ${cl}: ${D.DCD[ri][ci]} vs ${expect.toFixed(4)}`);
    });
  }
  for (let ri = 0; ri < 4; ri++) {
    assert.equal(D.DCD[ri][0], D.DCD[ri][2]); assert.equal(D.DCD[ri][1], D.DCD[ri][2]);   // held below CL 0.4
    assert.ok(Math.abs(D.DCD[ri][4] - 2 * D.DCD[ri][3]) < 1e-9);                           // twice the 0.5 column at 0.6
  }
  // above 0.80: the trace's increments relative to its own 0.80 curve, on the 0.80 row
  const rec = record('A3-fig43-CD');
  const at = (M, cl) => rec.curves[`M${M.toFixed(2)}`].points.find(([, c]) => Math.abs(c - cl) < 1e-9)?.[0];
  for (const [ri, M] of [[4, 0.82], [5, 0.85], [6, 0.90]]) {
    D.DCD_CL.forEach((cl, ci) => {
      const trace = at(M, cl), base = at(0.80, cl);
      if (trace === undefined) { assert.equal(M, 0.90); assert.equal(cl, 0.6); return; }   // the trace ends at CL 0.58
      const expect = trace - base + D.DCD[3][ci];
      assert.ok(Math.abs(D.DCD[ri][ci] - expect) < 0.00006, `ΔCD at M ${M} CL ${cl}: ${D.DCD[ri][ci]} vs ${expect.toFixed(5)}`);
    });
  }
});

test('the stabiliser\'s power is the difference of the two tail runs of A1 figure 8(a)', () => {
  const cm = record('A1-fig8-p28-Cm'), cl = record('A1-fig8-p28-CL');
  const alphas = [-8.82, -6.58, -4.27, -2.0, 0.37, 2.62, 4.87, 7.15, 9.38];
  const dCm = alphas.map((a) => curveAt(cm.curves.WBNH6V.points, a) - curveAt(cm.curves.WBNH0V.points, a));
  const dCl = alphas.map((a) => curveAt(cl.curves.WBNH6V.points, a) - curveAt(cl.curves.WBNH0V.points, a));
  const meanCm = dCm.reduce((a, b) => a + b) / dCm.length / 6, meanCl = dCl.reduce((a, b) => a + b) / dCl.length / 6;
  console.log(`  6° of tail: ΔCm ${(meanCm * 6).toFixed(3)} → Cm_δs ${(-meanCm).toFixed(4)}/deg; ΔCL ${(meanCl * 6).toFixed(3)} → CL_δs ${(-meanCl).toFixed(4)}/deg`);
  assert.ok(Math.abs(-meanCm - D.CM_DS) < 0.0005);
  assert.ok(Math.abs(-meanCl - D.CL_DS) < 0.0005);
});

test('the clean polar is Lux\'s flight polar: 0.0155 + 0.047·CL² reproduces his Mach 0.70 points', () => {
  const lux = [[0.40, 0.0230], [0.45, 0.0255], [0.50, 0.0272]];   // data 9.4
  for (const [cl, cd] of lux) {
    const model = D.CD0 + D.K_INDUCED * cl * cl;
    console.log(`  CL ${cl}: polar ${model.toFixed(4)}, Lux ${cd}`);
    assert.ok(Math.abs(model - cd) <= 0.0005);
  }
});

test('at Mach 0.28 the build-up\'s CD(α) is the tunnel\'s table less a near-constant, within the tunnel\'s reading accuracy', () => {
  // q̄ → 0 (no elastic terms), tail at the tunnel's 0°, no controls, no rates
  let worst = 0;
  const diffs = [];
  for (const a of [-4, -2, 0, 2, 4, 6, 8]) {
    const c = coefficients({ alphaDeg: a, betaDeg: 0, de: 0, da: 0, dr: 0, is: -D.STAB_DATUM, p: 0, q: 0, r: 0, vt: 300, qbar: 0, mach: 0.28 });
    const tab = interp1(D.ALPHA, D.CD_TAB, a);
    diffs.push(tab - c.CD);
  }
  const mean = diffs.reduce((x, y) => x + y) / diffs.length;
  for (const d of diffs) worst = Math.max(worst, Math.abs(d - mean));
  console.log(`  tunnel CD − model CD over α −4..8°: mean ${mean.toFixed(4)}, spread ±${worst.toFixed(4)}`);
  assert.ok(mean > 0.003 && mean < 0.005);
  assert.ok(worst <= 0.0025);
});

test('the elastic correction takes the share of Cmα and of the static margin that FLEXSTAB\'s does at cruise dynamic pressure', () => {
  // Cmα and CLα at Mach 0.77 from the build-up by central differences, rigid (q̄ → 0) and at 280 psf;
  // FLEXSTAB: Cmα −0.0220 → −0.0150 (ratio 0.68), static margin 0.224 → 0.171 c̄ (data 8.6). The
  // model's rigid slopes are the tunnel's scaled with Mach, 12 % below FLEXSTAB's, so the ratio is the check.
  const at = (a, qbar) => coefficients({ alphaDeg: a, betaDeg: 0, de: 0, da: 0, dr: 0, is: -D.STAB_DATUM, p: 0, q: 0, r: 0, vt: 770, qbar, mach: 0.77 });
  const slope = (qbar) => ({ cma: (at(3, qbar).Cm - at(1, qbar).Cm) / 2, cla: (at(3, qbar).CL - at(1, qbar).CL) / 2 });
  const r = slope(0), e = slope(280);
  const smR = -r.cma / r.cla, smE = -e.cma / e.cla;
  console.log(`  Mach 0.77: Cmα rigid ${r.cma.toFixed(4)} → elastic ${e.cma.toFixed(4)} /deg (ratio ${(e.cma / r.cma).toFixed(2)}; FLEXSTAB 0.68); static margin ${smR.toFixed(3)} → ${smE.toFixed(3)} c̄ (FLEXSTAB 0.224 → 0.171); flight test Cmα −0.015`);
  assert.ok(Math.abs(e.cma / r.cma - 0.68) < 0.05, `ratio ${e.cma / r.cma}`);
  assert.ok(Math.abs(smR - smE - 0.053) < 0.006, `shift ${smR - smE}`);
  assert.ok(Math.abs(e.cla / r.cla - 0.888) < 0.01);
});

test('signs of the build-up follow docs/flight-model.md 2.3', () => {
  const base = { alphaDeg: 2, betaDeg: 0, de: 0, da: 0, dr: 0, is: -1, p: 0, q: 0, r: 0, vt: 500, qbar: 200, mach: 0.5 };
  const c0 = coefficients(base);
  assert.ok(coefficients({ ...base, de: 5 }).Cm < c0.Cm, 'elevator trailing edge down is nose-down');
  assert.ok(coefficients({ ...base, de: 5 }).CL > c0.CL, 'and adds lift');
  assert.ok(coefficients({ ...base, is: 1 }).Cm < c0.Cm, 'stabiliser leading edge up is nose-down');
  assert.ok(coefficients({ ...base, da: 5 }).Cl < 0, 'positive roll control rolls left');
  assert.ok(coefficients({ ...base, dr: 5 }).Cn < 0, 'positive rudder yaws the nose left');
  assert.ok(coefficients({ ...base, dr: 5 }).CY > 0, 'and pushes the tail left, the jet right');
  const b = coefficients({ ...base, betaDeg: 5 });
  assert.ok(b.Cn > 0 && b.CY < 0 && b.Cl < 0, 'wind from the right: nose right, force left, roll left');
  const bm = coefficients({ ...base, betaDeg: -5 });
  assert.ok(Math.abs(bm.Cn + b.Cn) < 1e-12 && Math.abs(bm.Cl + b.Cl) < 1e-12, 'odd in β');
  assert.ok(coefficients({ ...base, alphaDeg: 4 }).Cm < c0.Cm, 'statically stable');
  assert.ok(coefficients({ ...base, q: 0.05 }).Cm < c0.Cm, 'pitch damping');
  assert.ok(coefficients({ ...base, p: 0.1 }).Cl < c0.Cl, 'roll damping');
  assert.ok(coefficients({ ...base, r: 0.1 }).Cn < c0.Cn, 'yaw damping');
  assert.ok(coefficients({ ...base, mach: 0.85 }).Cm < c0.Cm, 'Mach tuck');
  assert.ok(coefficients({ ...base, mach: 0.85 }).CD > c0.CD, 'drag rise');
});
