import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throttleFromPosition, positionFromThrottle } from '../src/ui/throttle.js';
import { DETENT } from '../src/sim/engine.js';
import { vsiText, bankTickAngle, BANK_TICKS, radarText, RADAR_BELOW_FT } from '../src/hud/hud.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('the throttle snaps to MCT around its detent, with a gap to cross before take-off thrust', () => {
  assert.equal(throttleFromPosition(0), 0);
  near(throttleFromPosition(DETENT - 0.03), DETENT, 1e-12);   // just under the detent: snapped to MCT
  near(throttleFromPosition(DETENT), DETENT, 1e-12);
  near(throttleFromPosition(DETENT + 0.05), DETENT, 1e-12);   // inside the gap: still MCT
  assert.ok(throttleFromPosition(DETENT - 0.06) < DETENT);    // below the snap zone: below MCT
  assert.ok(throttleFromPosition(DETENT + 0.09) > DETENT);    // past the gap: toward take-off
  near(throttleFromPosition(1), 1, 1e-12);
  for (const t of [0, 0.3, 0.8, DETENT, 0.99, 1]) near(throttleFromPosition(positionFromThrottle(t)), t, 1e-12);
  assert.ok(throttleFromPosition(0.5) > 0.5 && throttleFromPosition(0.5) < 0.55, 'the track below the detent is squeezed a little to make room for the snap zone');
});

test('the bank scale has its long ticks at 0, 30 and 45; its arc turns with the horizon under a pointer fixed to the jet, so the bank reads on the banked side', () => {
  for (const t of [0, 30, 45, -30, -45]) assert.ok(BANK_TICKS.includes(t));
  assert.equal(bankTickAngle(0, 0), 0, 'level: the 0 tick under the pointer');
  assert.equal(bankTickAngle(30, -30), 0, 'a 30° right bank turns the horizon, and the arc, 30° anticlockwise: the right-hand 30 stands under the pointer');
  assert.equal(bankTickAngle(0, -30), -30, 'and the 0 tick is 30° to the left of it');
  assert.equal(bankTickAngle(-45, 45), 0, 'a 45° left bank: the left-hand 45 under the pointer');
});

test('the VSI reads signed feet per minute to the nearest 50', () => {
  assert.equal(vsiText(0), '0');
  assert.equal(vsiText(20), '0');
  assert.equal(vsiText(1234), '+1250');
  assert.equal(vsiText(-760), '−750');
  assert.equal(vsiText(-26), '−50');
});

test('the radar altitude shows from 2,500 ft above the ground down, to the nearest 10 ft, and not above', () => {
  assert.equal(RADAR_BELOW_FT, 2500);
  assert.equal(radarText(5000), null);
  assert.equal(radarText(2500), null, 'at 2,500 exactly it is off');
  assert.equal(radarText(2499), 'RA 2500', 'just under: on, and rounded to ten');
  assert.equal(radarText(1234), 'RA 1230');
  assert.equal(radarText(47), 'RA 50');
  assert.equal(radarText(-3), 'RA 0', 'never below zero');
  assert.equal(radarText(NaN), null, 'no ground known: off');
});
