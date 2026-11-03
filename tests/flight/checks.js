// The closed-loop checks of docs/flight-model.md 12.2 (tests 7 to 13 and
// 16), as measurements. Each flies a manoeuvre and returns { name, pass,
// text } with the numbers it measured; manoeuvres.test.js asserts on them.

import { flyManoeuvre, CRUISE, AIR_START } from './manoeuvres.js';
import { rudderLimit } from '../../src/sim/data/aircraft.js';

const inBand = (v, lo, hi) => v >= lo && v <= hi;
const f = (v, d = 2) => Number(v).toFixed(d);
const after = (rows, t0) => rows.filter((r) => r.t >= t0);

export function check7(cond = CRUISE, label = 'cruise') {
  const { rows, summary } = flyManoeuvre('roll', cond);
  const t30 = rows.find((r) => r.bank >= 30)?.t;
  const toBank = t30 === undefined ? Infinity : t30 - 0.5;
  const steady = Math.abs(summary.pMax);
  const pass = toBank <= 2.0 && inBand(steady, 25, 45) && summary.betaMax <= 2.0;
  return { name: `7 full wheel at ${label}: 60° and back`, pass,
    text: `30° of bank in ${f(toBank)} s, peak roll rate ${f(steady, 0)}°/s, |β| ≤ ${f(summary.betaMax)}°, n_z ${f(summary.nzMin)}–${f(summary.nzMax)}` };
}

function handsOff(name, label, climbing) {
  const { rows, summary } = flyManoeuvre(name);
  const dev = Math.max(...rows.map((r) => Math.abs(r.nz - 1)));
  const late = after(rows, 20);
  const devLate = Math.max(...late.map((r) => Math.abs(r.nz - 1)));
  const last = rows[rows.length - 1];
  const speedOk = climbing ? last.kcas > rows[0].kcas + 10 : last.kcas < rows[0].kcas - 10;
  const altOk = climbing ? last.alt > rows[0].alt + 500 : true;
  const qEnd = Math.max(...after(rows, 50).map((r) => Math.abs(r.q)));
  const pass = dev <= 0.15 && devLate <= 0.05 && summary.isRateMax <= 0.5 + 1e-6 && speedOk && altOk && qEnd < 0.5;
  return { name: label, pass,
    text: `n_z within 1 ± ${f(dev, 3)} throughout, ± ${f(devLate, 3)} after 20 s; stabiliser ${f(rows[0].is)} → ${f(last.is)}° at up to ${f(summary.isRateMax)}°/s; KIAS ${f(rows[0].kcas, 0)} → ${f(last.kcas, 0)}; altitude ${f(rows[0].alt, 0)} → ${f(last.alt, 0)} ft; |q| ${f(qEnd, 2)}°/s at the end` };
}
export const check8 = () => handsOff('idle', '8 throttle to idle from cruise, yoke released, 60 s', false);
export const check9 = () => handsOff('full', '9 throttle to full from the air start, yoke released, 60 s', true);

export function check10() {
  const { rows, summary } = flyManoeuvre('pull');
  const within4 = rows.filter((r) => r.t <= 4.5);
  const peak = Math.max(...within4.map((r) => r.nz));
  const pass = inBand(peak, 2.2, 2.8) && summary.nzMax <= 3.0 && !summary.nan;
  return { name: '10 full pull at cruise, 5 s', pass,
    text: `n_z peaks at ${f(peak)} within 4 s (${f(summary.nzMax)} overall), α to ${f(summary.alphaMax, 1)}°, elevator ${f(Math.min(...rows.map((r) => r.de)), 1)}°` };
}

export function check11() {
  const { rows } = flyManoeuvre('bank');
  const released = after(rows, 4);
  const bank0 = released[0].bank;
  const drift = Math.max(...released.map((r) => Math.abs(r.bank - bank0)));
  const last = rows[rows.length - 1];
  const pass = drift <= 10 && last.alt < released[0].alt - 200 && bank0 > 25;
  return { name: '11 yoke released in a 30° bank at cruise, 20 s', pass,
    text: `bank ${f(bank0, 0)}° at release, drifts ${f(drift, 1)}°; altitude ${f(released[0].alt, 0)} → ${f(last.alt, 0)} ft; n_z ${f(last.nz)} at the end` };
}

export function check12() {
  const { rows, summary, sim } = flyManoeuvre('stall');
  const buffetAt = rows.find((r) => r.buffet >= 1)?.alpha;
  const rel = sim.releasedAt;
  const afterRelease = rows.filter((r) => r.t > rel);
  const noseDown = afterRelease.find((r) => r.q < -0.5)?.t;
  const alphaBack = afterRelease.find((r) => r.alpha < 12)?.t;
  const pass = rel !== null && buffetAt !== undefined && buffetAt < 14 && noseDown !== undefined && noseDown - rel <= 3
    && alphaBack !== undefined && alphaBack - rel <= 10 && !summary.nan;
  return { name: '12 idle, altitude held to 15° α, then released', pass,
    text: `buffet from α ${f(buffetAt, 1)}°; released at ${f(rel, 0)} s and ${f(rows.find((r) => r.t >= rel)?.kcas, 0)} KIAS with the elevator at ${f(rows.find((r) => r.t >= rel)?.de, 1)}°; nose drops ${f(noseDown - rel, 1)} s after release, α back under 12° after ${f(alphaBack - rel, 1)} s, peak α ${f(summary.alphaMax, 1)}°, n_z min ${f(summary.nzMin)}` };
}

export function check13() {
  const { rows, summary } = flyManoeuvre('tuck');
  const last = rows[rows.length - 1];
  const settled = Math.abs(last.mach - rows.find((r) => r.t >= last.t - 30).mach) < 0.01;
  const pass = summary.machMax < 0.90 && settled && last.mach > 0.82;
  return { name: '13 full throttle from cruise, yoke released: the drag rise', pass,
    text: `Mach ${f(rows[0].mach, 3)} → ${f(last.mach, 3)} (max ${f(summary.machMax, 3)}), settled: ${settled}; stabiliser ${f(rows[0].is)} → ${f(last.is)}°; altitude ${f(rows[0].alt, 0)} → ${f(last.alt, 0)} ft` };
}

export function check4Rudder() {
  const { rows, summary } = flyManoeuvre('sideslip');
  const over = rows.filter((r) => Math.abs(r.dr) > rudderLimit(r.keas) + 0.01);
  const settled = after(rows, 20);
  const betaLate = Math.max(...settled.map((r) => Math.abs(r.beta)));
  const pass = over.length === 0 && betaLate < 0.5;
  return { name: '4 a 5° sideslip released at cruise, damper on', pass,
    text: `rudder to ${f(Math.max(...rows.map((r) => Math.abs(r.dr))), 1)}° (authority ${f(rudderLimit(rows[0].keas), 1)}° at ${f(rows[0].keas, 0)} KEAS), |β| ${f(summary.betaMax, 1)}° → ${f(betaLate, 2)}° after 20 s` };
}

export function check16() {
  let nan = 0, flagged = 0, crashed = 0, nzMax = 0, nzMin = 9;
  const starts = [[160, 5000], [200, 10000], [250, 20000], [280, 35000]];
  for (let k = 0; k < 16; k++) {
    const [kcas, h] = starts[k % 4];
    const { summary } = flyManoeuvre('random', { kcas, h, seed: k + 1, t: 60 });
    if (summary.nan) nan++;
    if (summary.outOfEnvelope) flagged++;
    if (summary.crashed) crashed++;
    nzMax = Math.max(nzMax, summary.nzMax); nzMin = Math.min(nzMin, summary.nzMin);
  }
  return { name: '16 sixteen random 60 s flights', pass: nan === 0,
    text: `no NaN in ${16 - nan} of 16; ${flagged} left the data's envelope (flagged), ${crashed} flew into the ground; n_z ${f(nzMin)} to ${f(nzMax)}` };
}

export const CHECKS = [check4Rudder, () => check7(CRUISE, 'cruise'), () => check7(AIR_START, 'the air start'), check8, check9, check10, check11, check12, check13, check16];
