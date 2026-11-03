import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throttleFromPosition, positionFromThrottle } from '../src/ui/throttle.js';
import { DETENT } from '../src/sim/engine.js';
import { vsiText } from '../src/hud/hud.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('the throttle has a detent at MCT: a gap to cross before take-off thrust', () => {
  assert.equal(throttleFromPosition(0), 0);
  near(throttleFromPosition(0.5), 0.5, 1e-12);
  near(throttleFromPosition(DETENT), DETENT, 1e-12);
  near(throttleFromPosition(DETENT + 0.05), DETENT, 1e-12);   // inside the gap: still MCT
  assert.ok(throttleFromPosition(DETENT + 0.09) > DETENT);   // past it: toward take-off
  near(throttleFromPosition(1), 1, 1e-12);
  for (const t of [0, 0.3, DETENT, 0.9, 0.95, 1]) near(throttleFromPosition(positionFromThrottle(t)), t, 1e-12);
});

test('the VSI reads signed feet per minute to the nearest 50', () => {
  assert.equal(vsiText(0), '0');
  assert.equal(vsiText(20), '0');
  assert.equal(vsiText(1234), '+1250');
  assert.equal(vsiText(-760), '−750');
  assert.equal(vsiText(-26), '−50');
});
