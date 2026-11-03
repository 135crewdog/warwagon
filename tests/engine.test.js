import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxThrust, mctThrust, idleThrust, commandedThrust, throttleFor, spoolTau, thrustRate, n1, DETENT } from '../src/sim/engine.js';
import { T0, N1_MAX } from '../src/sim/data/engine.js';

test('the thrust cap is the certified rating lapsed: spot values (lbf per engine)', () => {
  assert.ok(Math.abs(maxThrust(0, 0) - T0) < 1e-6, 'sea-level static is the take-off rating');
  // the stand-in for the PMC: the values this model gives, recorded here so a change shows
  const spots = [
    [0, 0.25, 16943], [10000, 0.4, 12187], [20000, 0.6, 7765], [30000, 0.78, 5309], [35000, 0.78, 4600], [40000, 0.8, 3867], [45600, 0.77, 3045],
  ];
  console.log('  h       M     T_max');
  for (const [h, m, t] of spots) {
    const v = maxThrust(h, m);
    console.log(`  ${String(h).padEnd(6)} ${m.toFixed(2)}  ${v.toFixed(0)} (${t})`);
    assert.ok(Math.abs(v / t - 1) < 0.01, `T_max at ${h} ft, Mach ${m}: ${v}`);
  }
  assert.ok(Math.abs(maxThrust(35000, 0.78) - 4600) < 1, 'the reference cruise thrust at its reference point');
  // continuous across the blend's ends
  assert.ok(Math.abs(maxThrust(9999, 0.5) - maxThrust(10001, 0.5)) < 5);
  assert.ok(Math.abs(maxThrust(29999, 0.5) - maxThrust(30001, 0.5)) < 5);
  // falls with altitude at every Mach
  for (const m of [0.3, 0.5, 0.8]) for (let h = 0; h < 50000; h += 5000) assert.ok(maxThrust(h + 5000, m) < maxThrust(h, m));
});

test('MCT is 98.1 % of take-off, flight idle 7 %, and the throttle has its detent at MCT', () => {
  assert.ok(Math.abs(mctThrust(0, 0) - 21579) < 5);
  assert.ok(Math.abs(idleThrust(0, 0) - 1540) < 1);
  assert.equal(commandedThrust(0, 0, 0), idleThrust(0, 0));
  assert.ok(Math.abs(commandedThrust(DETENT, 0, 0) - mctThrust(0, 0)) < 1e-9);
  assert.ok(Math.abs(commandedThrust(1, 0, 0) - T0) < 1e-9);
  for (const t of [3000, 12000, 21700]) assert.ok(Math.abs(commandedThrust(throttleFor(t, 0, 0), 0, 0) - t) < 1e-6);
  assert.ok(Math.abs(commandedThrust(0.5, 30000, 0.78) - (idleThrust(30000, 0.78) + (mctThrust(30000, 0.78) - idleThrust(30000, 0.78)) * 0.5 / DETENT)) < 1e-9);
});

test('the spool from flight idle to 95 % takes between 3 and 5 s at sea level', () => {
  assert.equal(spoolTau(0.5 * T0), 1.0);
  assert.equal(spoolTau(0.07 * T0), 3.0);
  let t = idleThrust(0, 0), time = 0;
  const dt = 1 / 120, target = 0.95 * T0;
  while (t < target && time < 10) { t += thrustRate(T0, t) * dt; time += dt; }
  console.log(`  flight idle to 95 %: ${time.toFixed(2)} s`);
  assert.ok(time > 3 && time < 5, `${time} s`);
});

test('the N1 shown is 102 % at take-off power at sea level and falls with altitude at full throttle', () => {
  assert.ok(Math.abs(n1(T0, 0, 0) - N1_MAX) < 1e-9);
  const fl300 = n1(maxThrust(30000, 0.78), 30000, 0.78), fl350 = n1(maxThrust(35000, 0.80), 35000, 0.80), fl200 = n1(maxThrust(20000, 0.6), 20000, 0.6);
  const idle = n1(idleThrust(0, 0), 0, 0);
  console.log(`  max N1: sea level ${N1_MAX}, FL200 ${fl200.toFixed(1)}, FL300 ${fl300.toFixed(1)}, FL350 ${fl350.toFixed(1)}; flight idle at sea level ${idle.toFixed(1)}`);
  assert.ok(fl200 < N1_MAX && fl300 < fl200 && fl350 < fl300);
  assert.ok(fl350 > 85 && fl350 < 98, `FL350 ${fl350}`);
  assert.ok(idle > 20 && idle < 35);
  assert.ok(n1(0.5 * maxThrust(30000, 0.78), 30000, 0.78) < fl300);
});
