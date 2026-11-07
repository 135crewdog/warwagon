import { test } from 'node:test';
import assert from 'node:assert/strict';
import { osgb36ToGrid, latLonToGrid } from '../src/osgb.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);
const dms = (d, m, s) => d + m / 60 + s / 3600;

test('osgb: the projection reproduces Ordnance Survey\'s worked example to a millimetre', () => {
  // "A guide to coordinate systems in Great Britain", annexe C: OSGB36 52°39′27.2531″ N 1°43′4.5177″ E → E 651409.903 N 313177.270
  const g = osgb36ToGrid(dms(52, 39, 27.2531), dms(1, 43, 4.5177));
  near(g.east, 651409.903, 0.001, 'easting'); near(g.north, 313177.270, 0.001, 'northing');
  const origin = osgb36ToGrid(49, -2);
  near(origin.east, 400000, 1e-6, 'the true origin\'s false easting'); near(origin.north, -100000, 1e-6, 'and false northing');
});

test('osgb: from WGS 84, the datum shift lands the landmarks on their grid references', () => {
  const ben = latLonToGrid(56.7969, -5.0036);           // Ben Nevis, NN 16676 71282
  near(ben.east, 216676, 12, 'Ben Nevis east'); near(ben.north, 771282, 12, 'Ben Nevis north');
  const snowdon = latLonToGrid(53.0685, -4.0763);       // Yr Wyddfa, SH 60980 54370
  near(snowdon.east, 260980, 12, 'Snowdon east'); near(snowdon.north, 354370, 12, 'Snowdon north');
  const shift = osgb36ToGrid(51.4779, -0.0015), real = latLonToGrid(51.4779, -0.0015);
  const moved = Math.hypot(shift.east - real.east, shift.north - real.north);
  assert.ok(moved > 80 && moved < 140, `the datum shift at Greenwich is about 110 m: ${moved}`);
});
