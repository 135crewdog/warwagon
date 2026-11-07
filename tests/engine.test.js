import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxThrust, mctThrust, idleThrust, netThrust, commandedPower, throttleFor, spoolTau, powerRate, n1, maxN1, DETENT } from '../src/sim/engine.js';
import { T0, N1_MAX, MCT_FRACTION } from '../src/sim/data/engine.js';
import { trueAirspeedFromKcas } from '../src/sim/airdata.js';

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
  assert.ok(Math.abs(maxThrust(9999, 0.5) - maxThrust(10001, 0.5)) < 5);
  assert.ok(Math.abs(maxThrust(29999, 0.5) - maxThrust(30001, 0.5)) < 5);
  for (const m of [0.3, 0.5, 0.8]) for (let h = 0; h < 50000; h += 5000) assert.ok(maxThrust(h + 5000, m) < maxThrust(h, m));
});

test('flight idle: a small gross thrust less the ram drag of the idling airflow, negative at speed', () => {
  assert.ok(Math.abs(idleThrust(0, 0) - 1540) < 1, 'at rest, 7 % of the take-off rating');
  const v280 = trueAirspeedFromKcas(280, 10000), v150 = trueAirspeedFromKcas(150, 0);
  console.log(`  idle net thrust per engine: ${idleThrust(0, 0).toFixed(0)} lbf at rest; ${idleThrust(0, v150).toFixed(0)} at 150 KIAS at sea level; ${idleThrust(10000, v280).toFixed(0)} at 280 KIAS at 10,000 ft; ${idleThrust(30000, trueAirspeedFromKcas(296, 30000)).toFixed(0)} at cruise`);
  assert.ok(idleThrust(0, v150) > 0 && idleThrust(0, v150) < 500);
  assert.ok(idleThrust(10000, v280) < -600 && idleThrust(10000, v280) > -1100, `${idleThrust(10000, v280)}`);
  // the throttle interpolates between the idle's net thrust and the rating
  assert.ok(Math.abs(netThrust(0, 10000, 0.5, v280) - idleThrust(10000, v280)) < 1e-9);
  assert.ok(Math.abs(netThrust(1, 10000, 0.5, v280) - maxThrust(10000, 0.5)) < 1e-9);
  assert.ok(Math.abs(netThrust(0.5, 10000, 0.5, v280) - 0.5 * (idleThrust(10000, v280) + maxThrust(10000, 0.5))) < 1e-9);
});

test('MCT is 98.1 % of take-off, and the throttle has its detent at MCT', () => {
  assert.ok(Math.abs(mctThrust(0, 0) - 21579) < 5);
  assert.equal(commandedPower(0), 0);
  assert.ok(Math.abs(commandedPower(DETENT) - MCT_FRACTION) < 1e-9);
  assert.equal(commandedPower(1), 1);
  for (const f of [0.1, 0.5, MCT_FRACTION, 0.99]) assert.ok(Math.abs(commandedPower(throttleFor(f)) - f) < 1e-9);
});

test('the spool from flight idle to 95 % takes between 3 and 5 s', () => {
  assert.equal(spoolTau(0.5), 1.0);
  assert.equal(spoolTau(0), 3.0);
  let f = 0, time = 0;
  const dt = 1 / 120;
  while (f < 0.95 && time < 10) { f += powerRate(1, f) * dt; time += dt; }
  console.log(`  flight idle to 95 %: ${time.toFixed(2)} s`);
  assert.ok(time > 3 && time < 5, `${time} s`);
});

test('the N1 shown is 102 % at take-off power at sea level and its maximum falls with altitude', () => {
  assert.ok(Math.abs(n1(1, 0) - N1_MAX) < 1e-9);
  const fl200 = maxN1(20000), fl300 = maxN1(30000), fl350 = maxN1(35000), idle = n1(0, 0);
  console.log(`  max N1: sea level ${N1_MAX}, FL200 ${fl200.toFixed(1)}, FL300 ${fl300.toFixed(1)}, FL350 ${fl350.toFixed(1)}; MCT at sea level ${n1(MCT_FRACTION, 0).toFixed(1)}; flight idle at sea level ${idle.toFixed(1)}`);
  assert.ok(fl200 < N1_MAX && fl300 < fl200 && fl350 < fl300);
  assert.ok(fl350 > 85 && fl350 < 98, `FL350 ${fl350}`);
  assert.ok(idle > 20 && idle < 35);
  assert.ok(n1(0.5, 30000) < fl300);
});
