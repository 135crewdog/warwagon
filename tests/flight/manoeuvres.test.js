// docs/flight-model.md 12.2: the closed-loop checks. Each flies the full
// simulation (controls, actuators, engines) from a trimmed air start with a
// scripted yoke and throttle, and prints what it measured.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKS } from './checks.js';

for (const check of CHECKS) {
  test(check.name ?? 'check', () => {
    const r = check();
    console.log(`  ${r.name}: ${r.text}`);
    assert.ok(r.pass, `${r.name}: ${r.text}`);
  });
}
