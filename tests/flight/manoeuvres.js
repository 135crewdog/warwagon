// Scripted manoeuvres flown with the full simulation, docs/flight-model.md
// 12.2. Shared by the headless flight script and the tests. Each manoeuvre
// is a function of time (and the sim) returning the yoke and throttle for
// that step.

import { Simulation, DT } from '../../src/sim/simulation.js';
import { IX } from '../../src/sim/dynamics.js';
import { atmosphere } from '../../src/sim/atmosphere.js';
import { calibratedAirspeed, FT_PER_S_PER_KNOT } from '../../src/sim/airdata.js';

const R2D = 180 / Math.PI;

// The KCAS that is a given Mach at a height.
export function kcasForMach(mach, h) {
  return calibratedAirspeed(mach * atmosphere(0, h).a, h) / FT_PER_S_PER_KNOT;
}

// The three tuning conditions of flight model 8.7.
export const AIR_START = { h: 10000, kcas: 280 };
export const CRUISE = { h: 30000, kcas: kcasForMach(0.78, 30000) };
export const HIGH = { h: 35000, kcas: kcasForMach(0.80, 35000) };

// A deterministic random generator so the random flights are repeatable.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A scripted pilot who holds altitude with the yoke (test 12).
export function altitudeHold(h0) {
  let integ = 0;
  return (sim, dt) => {
    const a = sim.airdata;
    const err = h0 - a.altitude;
    integ += err * dt;
    integ = Math.max(-3000, Math.min(3000, integ));
    const x = 0.002 * err - 0.0004 * a.verticalSpeed + 0.0001 * integ;
    return Math.max(-1, Math.min(1, x));
  };
}

const centred = { pitch: 0, roll: 0 };

export const MANOEUVRES = {
  // hands off at the trim
  level: { ...AIR_START, t: 30, script: () => centred },
  // 8: throttle to idle from cruise, yoke released
  idle: { ...CRUISE, t: 60, throttle: 0, script: () => centred },
  // 9: throttle to full from the air start, yoke released
  full: { ...AIR_START, t: 60, throttle: 1, script: () => centred },
  // 10: full pull at cruise from t = 0.5 s
  pull: { ...CRUISE, t: 5.5, script: (t) => (t >= 0.5 ? { pitch: 1, roll: 0 } : centred) },
  // 11: roll to a 30° bank with a quarter wheel, then release everything
  bank: {
    ...CRUISE, t: 24,
    script: (t, sim) => (t < 4 ? { pitch: 0, roll: sim.airdata.roll < 30 ? 0.25 : 0 } : centred),
  },
  // 7: full right wheel to 60° of bank, then full left back through level to −60°, then centre
  roll: {
    ...CRUISE, t: 12,
    make: () => {
      let phase = 0;
      return (t, sim) => {
        if (t < 0.5) return centred;
        const bank = sim.airdata.roll;
        if (phase === 0 && bank >= 60) phase = 1;
        if (phase === 1 && bank <= -60) phase = 2;
        return { pitch: 0, roll: phase === 0 ? 1 : phase === 1 ? -1 : 0 };
      };
    },
  },
  // 4: a 5° sideslip released
  sideslip: {
    ...CRUISE, t: 30,
    setup: (sim) => { sim.state[IX.V] = sim.aux.vt * Math.sin(5 / R2D); sim.aux = sim.auxFor(sim.state, sim.controls); },
    script: () => centred,
  },
  // 12: idle, a scripted pilot holds altitude until α reaches 15°, then releases the yoke
  stall: {
    ...AIR_START, t: 240, throttle: 0,
    make: (sim) => {
      const hold = altitudeHold(sim.airdata.altitude);
      let released = null;
      return (t, s, dt) => {
        if (released === null && s.airdata.alpha >= 15) released = t;
        s.releasedAt = released;
        return released === null ? { pitch: hold(s, dt), roll: 0 } : centred;
      };
    },
    stop: (sim) => (sim.releasedAt !== null && sim.releasedAt !== undefined && sim.time > sim.releasedAt + 15) || sim.airdata.altitude < 6000,
  },
  // 13: full throttle from cruise, yoke released: the drag rise and the tuck
  tuck: { ...CRUISE, t: 180, throttle: 1, script: () => centred },
  // 16: random yoke and throttle
  random: {
    ...AIR_START, t: 60,
    make: (sim, args) => {
      const rnd = mulberry32(args.seed ?? 1);
      let hold = 0, yoke = centred, throttle = sim.trimThrottle;
      return (t, s) => {
        if (t >= hold) {
          hold = t + 0.5 + 4 * rnd();
          yoke = { pitch: 2 * rnd() - 1, roll: 2 * rnd() - 1 };
          throttle = rnd();
        }
        s.scriptThrottle = throttle;
        return yoke;
      };
    },
  },
};

// Fly a manoeuvre. args may override h, kcas, t, throttle, seed. onStep is
// called after every physics step with (sim, yoke). Returns the time history
// and a summary of extremes.
export function flyManoeuvre(name, args = {}, onStep) {
  const m = MANOEUVRES[name];
  const h = args.h ?? m.h, kcas = args.kcas ?? m.kcas, T = args.t ?? m.t;
  const sim = new Simulation({ h, kcas });
  if (m.automatics) sim.automatics = { ...m.automatics };
  if (args.automatics) sim.automatics = { ...sim.automatics, ...args.automatics };
  const throttle0 = args.throttle ?? m.throttle ?? sim.trimThrottle;
  if (m.setup) m.setup(sim);
  const script = m.make ? m.make(sim, args) : m.script;
  const rows = [];
  const s = { nzMax: -Infinity, nzMin: Infinity, alphaMax: -Infinity, alphaMin: Infinity, pMax: 0, betaMax: 0,
    isRateMax: 0, machMax: 0, kcasEnd: 0, altEnd: 0, nan: false, outOfEnvelope: false };
  let yoke = centred;
  while (sim.time < T - 1e-9 && !sim.crashed) {
    yoke = script(sim.time, sim, DT);
    const throttle = sim.scriptThrottle ?? throttle0;
    const isBefore = sim.state[IX.IS];
    sim.step(yoke, throttle);
    const a = sim.airdata, x = sim.state;
    const row = { t: sim.time, kcas: a.kcas, keas: a.keas, mach: a.mach, alt: a.altitude, alpha: a.alpha, nz: a.nz, q: x[IX.Q] * R2D,
      de: x[IX.DE], is: x[IX.IS], bank: a.roll, p: x[IX.P] * R2D, beta: a.beta, heading: a.heading, pitch: a.pitch,
      da: x[IX.DA], dr: x[IX.DR], n1: sim.engines.n1, buffet: sim.buffetFraction, yoke, throttle };
    rows.push(row);
    s.nzMax = Math.max(s.nzMax, a.nz); s.nzMin = Math.min(s.nzMin, a.nz);
    s.alphaMax = Math.max(s.alphaMax, a.alpha); s.alphaMin = Math.min(s.alphaMin, a.alpha);
    if (Math.abs(row.p) > Math.abs(s.pMax)) s.pMax = row.p;
    s.betaMax = Math.max(s.betaMax, Math.abs(a.beta));
    s.isRateMax = Math.max(s.isRateMax, Math.abs(x[IX.IS] - isBefore) / DT);
    s.machMax = Math.max(s.machMax, a.mach);
    if (sim.outOfEnvelope) s.outOfEnvelope = true;
    for (let k = 0; k < x.length; k++) if (!Number.isFinite(x[k])) s.nan = true;
    if (onStep) onStep(sim, yoke);
    if (m.stop && m.stop(sim)) break;
  }
  s.kcasEnd = sim.airdata.kcas; s.altEnd = sim.airdata.altitude; s.crashed = sim.crashed; s.tEnd = sim.time;
  return { rows, summary: s, sim };
}
