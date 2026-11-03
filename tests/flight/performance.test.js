// Test layer 3, docs/flight-model.md 12.3: it performs like a KC-135R, from
// public figures only. Computed with the trim solver and, for the parabola,
// the full simulation with a scripted pilot on the elevator.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trimLevel } from '../../src/sim/trim.js';
import { atmosphere } from '../../src/sim/atmosphere.js';
import { airdata, trueAirspeedFromKcas, FT_PER_S_PER_KNOT } from '../../src/sim/airdata.js';
import { maxThrust, mctThrust, throttleFor } from '../../src/sim/engine.js';
import { G, WEIGHT } from '../../src/sim/data/aircraft.js';
import { Simulation } from '../../src/sim/simulation.js';

// Rate of climb (ft/min) at a thrust per engine, from the thrust the level
// trim needs: the excess over drag times speed over weight.
function climbRate(weight, h, mach, thrustPerEngine) {
  const vt = mach * atmosphere(0, h).a;
  const t = trimLevel(vt, h, { mass: weight / G });
  assert.ok(t.ok);
  return { roc: vt * 4 * (thrustPerEngine - t.thrust) / weight * 60, trim: t };
}

// The service ceiling: where the rate of climb at MCT, Mach 0.78, falls to 100 ft/min.
function serviceCeiling(weight) {
  let lo = 20000, hi = 70000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (climbRate(weight, mid, 0.78, mctThrust(mid, 0.78)).roc > 100) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

test('cruise: 530 mph (460 KTAS, Mach 0.78) at 30,000 ft within MCT, with climb in hand (the fact sheet)', () => {
  const vt = 460 * FT_PER_S_PER_KNOT;
  const t = trimLevel(vt, 30000);
  assert.ok(t.ok);
  const mach = t.aux.mach;
  const needed = 4 * t.thrust, mct = 4 * mctThrust(30000, mach), max = 4 * maxThrust(30000, mach);
  const roc = vt * (max - needed) / WEIGHT * 60;
  console.log(`  460 KTAS at 30,000 ft (Mach ${mach.toFixed(3)}): needs ${needed.toFixed(0)} lbf of ${mct.toFixed(0)} at MCT; ${roc.toFixed(0)} ft/min in hand at take-off power; throttle ${throttleFor(t.thrust, 30000, mach).toFixed(2)}`);
  assert.ok(needed < mct);
  assert.ok(roc >= 500, `rate of climb ${roc}`);
});

test('ceiling: 47,000–56,000 ft at 130,000 lb below the buffet (the fact sheet\'s 50,000 ft; Crenshaw at 45,600 ft), and 38,000–44,000 ft at 240,000 lb', () => {
  const light = serviceCeiling(130000), heavy = serviceCeiling(WEIGHT);
  const atLight = climbRate(130000, light, 0.78, mctThrust(light, 0.78)).trim;
  console.log(`  service ceiling (100 ft/min at MCT, Mach 0.78): ${light.toFixed(0)} ft at 130,000 lb (CL ${atLight.aux.coefficients.CL.toFixed(2)}, ${(100 * atLight.aux.coefficients.buffetFraction).toFixed(0)} % of the buffet boundary); ${heavy.toFixed(0)} ft at 240,000 lb`);
  assert.ok(light >= 47000 && light <= 56000, `light ceiling ${light}`);
  assert.ok(atLight.aux.coefficients.buffetFraction < 1);
  assert.ok(heavy >= 38000 && heavy <= 44000, `heavy ceiling ${heavy}`);
  const c2 = climbRate(130000, 45600, 0.77, mctThrust(45600, 0.77));
  assert.ok(c2.roc > 500, `Crenshaw's cruise 2 has ${c2.roc} ft/min in hand`);
});

test('the zero-g parabola: from 350 KIAS, a 1.8 g pull-up to 45° then 20 s or more of zero g within the elevator\'s travel (NASA)', () => {
  const sim = new Simulation({ h: 24000, kcas: 350 });
  const dt = 1 / 120;
  // a scripted pilot: g error and pitch rate to the elevator with an integral,
  // the gain scaled like a yoke force (K/q̄); the throttle stays at the trim setting
  let integral = 0;
  const pilot = (target) => {
    const a = sim.airdata;
    const e = target - a.nz;
    integral += e * dt;
    const k = 1200 / Math.max(a.qbar, 50);
    const qDeg = sim.state[8] * 180 / Math.PI;    // pitch rate, deg/s
    return Math.max(-20, Math.min(20, -k * (e + 0.3 * integral) + 0.6 * qDeg));
  };
  let t = 0;
  while (sim.airdata.pitch < 45 && t < 30) { sim.stepSurfaces({ throttle: sim.trimThrottle, de: pilot(1.8) }); t += dt; }
  const pullEnd = t, pullSpeed = sim.airdata.kcas;
  assert.ok(sim.airdata.pitch >= 45, `pitch ${sim.airdata.pitch} after ${t} s of pull`);
  integral = 0;
  // the longest continuous run of |n_z| < 0.1
  let run = 0, held = 0, minSpeed = 1e9, maxDe = 0, apex = 0;
  while (t < pullEnd + 45) {
    const de = pilot(0);
    sim.stepSurfaces({ throttle: sim.trimThrottle, de });
    t += dt;
    const a = sim.airdata;
    maxDe = Math.max(maxDe, Math.abs(sim.surfaces.de));
    apex = Math.max(apex, a.altitude);
    if (Math.abs(a.nz) < 0.1) { run += dt; minSpeed = Math.min(minSpeed, a.kcas); } else run = 0;
    held = Math.max(held, run);
    if (sim.crashed || a.altitude < 5000) break;
  }
  console.log(`  pull-up ${pullEnd.toFixed(1)} s to 45° at ${pullSpeed.toFixed(0)} KIAS; zero g held ${held.toFixed(1)} s, slowest ${minSpeed.toFixed(0)} KIAS, elevator to ${maxDe.toFixed(1)}°, top of the arc ${apex.toFixed(0)} ft`);
  assert.ok(held >= 20, `zero g for ${held} s`);
  assert.ok(minSpeed > 150, `slowest ${minSpeed} KIAS`);
  assert.ok(maxDe < 20, 'within the elevator\'s travel');
});

test('the 1 g clean stall at 240,000 lb is about 160 KEAS (not public; reported, with the 707\'s 1.14 CLmax)', () => {
  const vt = trueAirspeedFromKcas(160, 0);
  const t = trimLevel(vt, 0);
  const a = airdata(t.state, t.aux);
  console.log(`  160 KCAS at sea level trims at α ${t.alpha.toFixed(1)}°, CL ${t.aux.coefficients.CL.toFixed(3)}, i_s ${t.is.toFixed(1)}°, ${(100 * t.aux.coefficients.buffetFraction).toFixed(0)} % of the buffet boundary; KEAS ${a.keas.toFixed(0)}`);
  assert.ok(t.ok && t.aux.coefficients.CL > 1.05);
});
