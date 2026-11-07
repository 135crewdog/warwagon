import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throttleFromPosition, positionFromThrottle } from '../src/ui/throttle.js';
import { DETENT } from '../src/sim/engine.js';
import { vsiText, bankPointerAngle, BANK_TICKS } from '../src/hud/hud.js';

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

test('the bank scale has its long ticks at 0, 30 and 45 and its sky pointer swings left in a right bank, to the scale\'s end', () => {
  for (const t of [0, 30, 45, -30, -45]) assert.ok(BANK_TICKS.includes(t));
  assert.equal(bankPointerAngle(0), 0);
  assert.equal(bankPointerAngle(30), -30, 'a 30° right bank: the pointer 30° left of the 0 tick, as on the attitude indicator');
  assert.equal(bankPointerAngle(-45), 45);
  assert.equal(bankPointerAngle(80), -50, 'held at the scale\'s end');
});

test('the VSI reads signed feet per minute to the nearest 50', () => {
  assert.equal(vsiText(0), '0');
  assert.equal(vsiText(20), '0');
  assert.equal(vsiText(1234), '+1250');
  assert.equal(vsiText(-760), '−750');
  assert.equal(vsiText(-26), '−50');
});
