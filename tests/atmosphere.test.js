import { test } from 'node:test';
import assert from 'node:assert/strict';
import { atmosphere, P0, A0, RHO0 } from '../src/sim/atmosphere.js';

// An independent reference: the 1976 standard atmosphere computed in SI from
// its defining constants (288.15 K, 101,325 Pa, 6.5 K/km to 11 km, then
// 216.65 K; g 9.80665, R 287.053), converted to imperial.
function reference(hFt) {
  const h = hFt * 0.3048;
  const g = 9.80665, R = 287.053, L = 0.0065;
  let T, p;
  if (h < 11000) { T = 288.15 - L * h; p = 101325 * Math.pow(T / 288.15, g / (R * L)); }
  else { T = 216.65; p = 101325 * Math.pow(216.65 / 288.15, g / (R * L)) * Math.exp(-g * (h - 11000) / (R * T)); }
  const rho = p / (R * T), a = Math.sqrt(1.4 * R * T);
  return { T: T * 1.8, p: p * 0.0208854, rho: rho * 0.00194032, a: a / 0.3048 };
}

test('matches the standard atmosphere within 0.2 % to 50,000 ft', () => {
  console.log('  h       T (ref)         p (ref)          rho (ref)             a (ref)');
  for (const h of [0, 10000, 20000, 30000, 36089, 40000, 50000]) {
    const s = atmosphere(0, h), r = reference(h);
    console.log(`  ${String(h).padEnd(6)} ${s.temp.toFixed(2)} (${r.T.toFixed(2)})  ${s.pressure.toFixed(1)} (${r.p.toFixed(1)})  ${s.rho.toExponential(4)} (${r.rho.toExponential(4)})  ${s.a.toFixed(1)} (${r.a.toFixed(1)})`);
    assert.ok(Math.abs(s.temp / r.T - 1) < 0.002, `T at ${h}`);
    assert.ok(Math.abs(s.pressure / r.p - 1) < 0.002, `p at ${h}`);
    assert.ok(Math.abs(s.rho / r.rho - 1) < 0.002, `rho at ${h}`);
    assert.ok(Math.abs(s.a / r.a - 1) < 0.002, `a at ${h}`);
  }
});

test('is continuous at the tropopause and gives Mach, q̄ and the ratios', () => {
  const below = atmosphere(800, 36088), above = atmosphere(800, 36090);
  assert.ok(Math.abs(below.pressure - above.pressure) < 0.2);
  assert.ok(Math.abs(below.rho - above.rho) < 1e-6);
  const s = atmosphere(776, 30000);
  assert.ok(Math.abs(s.mach - 0.78) < 0.001, `Mach ${s.mach}`);
  assert.ok(Math.abs(s.qbar - 0.5 * s.rho * 776 * 776) < 1e-9);
  assert.ok(Math.abs(s.theta - s.temp / 518.67) < 1e-12);
  assert.ok(Math.abs(s.delta - s.pressure / P0) < 1e-12);
  assert.equal(atmosphere(0, 0).pressure, P0);
  assert.equal(atmosphere(0, 0).a, A0);
  assert.equal(atmosphere(0, 0).rho, RHO0);
  assert.equal(atmosphere(0, -100).pressure, P0, 'below sea level is clamped');
});
