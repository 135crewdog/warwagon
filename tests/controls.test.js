// The control laws of docs/flight-model.md section 8, unit by unit: the
// signs of 2.3, the force gearing, the trim's rules and the rudder's clamp.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elevatorFor, rollControlFor, trimRate, controlsStep, createMemory } from '../src/sim/controls.js';
import { PITCH, TRIM, YAW } from '../src/sim/data/controls.js';
import { rudderLimit } from '../src/sim/data/aircraft.js';

test('the yoke is a force: the elevator is force over q̄, clamped to the travel', () => {
  assert.ok(elevatorFor(1, 268) < 0, 'a pull is a negative elevator');
  assert.ok(Math.abs(elevatorFor(1, 268) - (-PITCH.kE / 268)) < 1e-12);
  assert.ok(Math.abs(elevatorFor(0.5, 268)) < Math.abs(elevatorFor(1, 268)));
  assert.ok(Math.abs(elevatorFor(1, 536)) < Math.abs(elevatorFor(1, 268)), 'the same force moves it less at higher q̄');
  assert.equal(elevatorFor(1, 50), -20, 'at low q̄ the force reaches the stop');
  assert.equal(elevatorFor(-1, 50), 20);
  assert.ok(elevatorFor(0, 268) === 0);
});

test('the wheel is a position', () => {
  assert.equal(rollControlFor(1), -20, 'right wheel is negative roll control (rolls right)');
  assert.equal(rollControlFor(-0.5), 10);
  assert.equal(rollControlFor(2), -20);
});

test('the trim runs toward 1 g only with the yoke released, at the motor\'s rate, with the pitch-rate lead', () => {
  assert.ok(trimRate(0, 0.9, 0) < 0, 'n_z below 1: leading edge down (nose up)');
  assert.ok(trimRate(0, 1.1, 0) > 0, 'n_z above 1: leading edge up');
  assert.equal(trimRate(0, 0.5, 0), -0.5, 'the motor\'s rate');
  assert.ok(Math.abs(trimRate(0, 0.9, 0) - (-TRIM.kt * 0.1)) < 1e-12, 'proportional inside a quarter g');
  assert.equal(trimRate(0, 1 + TRIM.deadband / 2, 0), 0, 'the deadband');
  assert.equal(trimRate(0.5, 0.5, 0), 0, 'frozen while the yoke is held');
  assert.equal(trimRate(0, 1, 0), 0);
  // a nose already pitching up toward 1 g needs less: the lead
  assert.ok(Math.abs(trimRate(0, 0.9, 0.5)) < Math.abs(trimRate(0, 0.9, 0)));
  assert.equal(trimRate(0, 0.9, 0.1 / TRIM.kq), 0, 'and exactly enough pitch rate cancels the error');
});

test('the yaw damper opposes yaw rate, washes out, and the coordination centres the ball, within the rudder\'s authority', () => {
  const meas = { qbar: 268, nz: 1, ny: 0, p: 0, q: 0, r: 0.02, alpha: 0.03, keas: 277 };
  const mem = createMemory();
  const c = controlsStep(mem, { pitch: 0, roll: 0 }, meas, 1 / 120);
  assert.ok(c.dr > 0, 'nose yawing right: positive rudder, which yaws it left (2.3)');
  assert.ok(Math.abs(c.dr - YAW.kyd * (0.02 * Math.cos(0.03)) * 180 / Math.PI) < 0.01);
  // held long enough the washout takes it away
  for (let i = 0; i < 120 * 40; i++) controlsStep(mem, { pitch: 0, roll: 0 }, meas, 1 / 120);
  assert.ok(Math.abs(controlsStep(mem, { pitch: 0, roll: 0 }, meas, 1 / 120).dr) < 0.01, 'a steady turn is not fought');
  const ball = controlsStep(createMemory(), { pitch: 0, roll: 0 }, { ...meas, r: 0, ny: 0.05 }, 1 / 120);
  assert.ok(Math.abs(ball.dr - YAW.kny * 0.05) < 1e-9, 'pushed right (wind from the left): rudder yaws the nose left, into the wind');
  const big = controlsStep(createMemory(), { pitch: 0, roll: 0 }, { ...meas, r: 0, ny: 1 }, 1 / 120);
  assert.ok(Math.abs(big.dr - rudderLimit(277)) < 1e-9, 'clamped to the authority at this speed');
  const off = controlsStep(createMemory(), { pitch: 0, roll: 0 }, { ...meas, ny: 0.05 }, 1 / 120, { trim: true, damper: false, coordination: false });
  assert.equal(off.dr, 0);
  assert.equal(controlsStep(createMemory(), { pitch: 0, roll: 0 }, { ...meas, nz: 0.8 }, 1 / 120, { trim: false, damper: true, coordination: true }).isRate, 0);
});
