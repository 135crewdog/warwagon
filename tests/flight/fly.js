#!/usr/bin/env node
// Headless flight script: flies a manoeuvre with the full simulation and
// prints a time history, so the tuning of the controls is visible.
//
//   node tests/flight/fly.js <manoeuvre> [options]
//
// Manoeuvres: level, idle, full, pull, bank, roll, sideslip, stall, tuck, random
// Options:   --h=10000 --kcas=280 --t=30 --every=1 --throttle=0.5 --seed=1
//            --notrim --nodamper --nocoord   (switch an automatic off)
//
// Modes:     node tests/flight/fly.js modes   prints the linearised modes at the three tuning conditions

import { flyManoeuvre, MANOEUVRES, AIR_START, CRUISE, HIGH } from './manoeuvres.js';
import { modes, BARE, DAMPED } from './linearize.js';

const args = Object.fromEntries(process.argv.slice(3).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v === undefined ? true : Number(v)];
}));
const name = process.argv[2];

if (name === 'modes') {
  for (const [label, c] of [['air start', AIR_START], ['cruise', CRUISE], ['FL350 M0.80', HIGH]]) {
    for (const [auto, autoLabel] of [[BARE, 'bare'], [DAMPED, 'damper on']]) {
      const m = modes(c.h, c.kcas, auto);
      const sp = m.shortPeriod, ph = m.phugoid, dr = m.dutchRoll;
      // at cruise and above the bare airframe has no phugoid pair: its slow roots are real, one unstable (flight model 8.7)
      let phugoid;
      if (ph) phugoid = `phugoid ${ph.period.toFixed(0)} s ζ ${ph.zeta.toFixed(3)}`;
      else {
        const slow = m.lon.eig.filter((e) => Math.abs(e.im) < 1e-6 && Math.abs(e.re) < 1 && Math.abs(e.re) > 1e-4).map((e) => e.re);
        const div = Math.max(...slow);
        phugoid = `no phugoid: slow roots ${slow.map((r) => r.toFixed(4)).join(', ')} /s` + (div > 0 ? ` (tuck-under, T2 ${(Math.LN2 / div).toFixed(0)} s)` : '');
      }
      console.log(`${label.padEnd(12)} ${autoLabel.padEnd(10)} short period ${sp.wn.toFixed(2)} rad/s ζ ${sp.zeta.toFixed(2)} | ${phugoid} | dutch roll ${dr.period.toFixed(2)} s ζ ${dr.zeta.toFixed(3)} | roll τ ${m.rollTau.toFixed(2)} s | spiral ${m.spiral.re > 0 ? 'T2 ' + m.spiral.doubling.toFixed(0) : 'T½ ' + m.spiral.halving.toFixed(0)} s`);
    }
  }
  process.exit(0);
}

if (!name || !MANOEUVRES[name]) {
  console.log('manoeuvres:', Object.keys(MANOEUVRES).join(', '), '| or: modes');
  process.exit(1);
}

const automatics = {};
if (args.notrim) automatics.trim = false;
if (args.nodamper) automatics.damper = false;
if (args.nocoord) automatics.coordination = false;
const every = args.every ?? 1;
const cols = ['t', 'KIAS', 'Mach', 'alt', 'alpha', 'nz', 'q', 'de', 'i_s', 'bank', 'p', 'beta', 'dr', 'pitch', 'N1', 'yoke'];
const widths = [6, 6, 6, 7, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5, 12];
console.log(cols.map((c, i) => c.padStart(widths[i])).join(''));
let next = 0;
const history = flyManoeuvre(name, { ...args, automatics }, (sim, yoke) => {
  if (sim.time + 1e-9 >= next) {
    next += every;
    const a = sim.airdata, x = sim.state, s = sim.surfaces;
    const row = [
      sim.time.toFixed(1), a.kcas.toFixed(0), a.mach.toFixed(2), a.altitude.toFixed(0), a.alpha.toFixed(1), a.nz.toFixed(2),
      (x[8] * 180 / Math.PI).toFixed(1), s.de.toFixed(1), s.is.toFixed(2), a.roll.toFixed(0), (x[7] * 180 / Math.PI).toFixed(0),
      a.beta.toFixed(1), s.dr.toFixed(1), a.pitch.toFixed(1), sim.engines.n1.toFixed(0),
      `${yoke.pitch.toFixed(2)}/${yoke.roll.toFixed(2)}`,
    ];
    console.log(row.map((c, i) => String(c).padStart(widths[i])).join(''));
  }
});
console.log('\nsummary:', JSON.stringify(history.summary, (k, v) => (typeof v === 'number' ? Number(v.toFixed(3)) : v)));
