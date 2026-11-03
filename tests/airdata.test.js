import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calibratedAirspeed, trueAirspeedFromKcas, airdata, FT_PER_S_PER_KNOT } from '../src/sim/airdata.js';
import { makeState } from '../src/sim/dynamics.js';
import { Simulation, VSI_TAU, stepsFor } from '../src/sim/simulation.js';

test('calibrated airspeed equals true airspeed at sea level and reads low at altitude', () => {
  assert.ok(Math.abs(calibratedAirspeed(500, 0) - 500) < 1e-6);
  const vt = trueAirspeedFromKcas(280, 10000);
  console.log(`  280 KCAS at 10,000 ft is ${(vt / FT_PER_S_PER_KNOT).toFixed(1)} KTAS`);
  assert.ok(vt / FT_PER_S_PER_KNOT > 320 && vt / FT_PER_S_PER_KNOT < 335);
  assert.ok(Math.abs(calibratedAirspeed(vt, 10000) / FT_PER_S_PER_KNOT - 280) < 1e-6);
  // 460 KTAS at 30,000 ft (the fact sheet's 530 mph) is about 296 KCAS, Mach 0.78
  const a = airdata(makeState({ vt: 460 * FT_PER_S_PER_KNOT, h: 30000 }));
  assert.ok(Math.abs(a.kcas - 296) < 2, `kcas ${a.kcas}`);
  assert.ok(Math.abs(a.mach - 0.78) < 0.005);
});

test('heading, pitch, roll, flight-path angle and vertical speed', () => {
  const x = makeState({ vt: 500, theta: 5 * Math.PI / 180, psi: -Math.PI / 2, h: 5000 });
  const a = airdata(x);
  assert.ok(Math.abs(a.heading - 270) < 1e-9);
  assert.ok(Math.abs(a.pitch - 5) < 1e-9);
  assert.ok(Math.abs(a.gamma - 5) < 1e-9, 'α 0, so γ = θ');
  assert.ok(Math.abs(a.verticalSpeed - 500 * Math.sin(5 * Math.PI / 180) * 60) < 1e-6, 'ft/min');
  assert.equal(a.altitude, 5000);
});

test('the VSI lags the vertical speed with a 4 s time constant', () => {
  const sim = new Simulation();
  const a0 = sim.airdata;
  assert.ok(Math.abs(a0.vsi) < 1);
  // step the climb: hold a pull and read the VSI against the true rate
  for (let i = 0; i < 360; i++) sim.stepSurfaces({ throttle: 1, de: -3 });
  const held = sim.airdata.verticalSpeed;
  assert.ok(held > 300, `climbing at ${held} ft/min`);
  // the lag's law: over one step the VSI moves (true − vsi)·dt/τ toward the true rate
  const before = sim.airdata;
  sim.stepSurfaces({ throttle: 1, de: -3 });
  const after = sim.airdata;
  const expected = (after.verticalSpeed - before.vsi) * (1 / 120) / VSI_TAU;
  console.log(`  VSI ${after.vsi.toFixed(0)} against ${after.verticalSpeed.toFixed(0)} ft/min; moved ${(after.vsi - before.vsi).toFixed(2)} in one step, the law says ${expected.toFixed(2)} (τ ${VSI_TAU} s)`);
  assert.ok(Math.abs((after.vsi - before.vsi) - expected) < 0.05);
  assert.ok(after.vsi > 0 && after.vsi < after.verticalSpeed);
});

test('the fixed-step clock takes whole steps and carries the remainder', () => {
  const dt = 1 / 120;
  assert.deepEqual(stepsFor(0, 1 / 60).steps, 2);
  assert.deepEqual(stepsFor(0, 1 / 30).steps, 4);
  const r = stepsFor(0, 1 / 120 * 1.5);
  assert.equal(r.steps, 1);
  assert.ok(Math.abs(r.carry - 0.5 * dt) < 1e-12 && Math.abs(r.fraction - 0.5) < 1e-9);
  assert.equal(stepsFor(0, 1).steps, 8);
  assert.ok(stepsFor(0, 1).carry < 1e-12, 'time beyond 8 steps is dropped');
});
