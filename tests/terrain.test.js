import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { decodeHeights, decodeWater, createSampler, createProjection } from '../src/render/heightmap.js';
import { crashed, IX } from '../src/sim/dynamics.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`);

// An RGBA buffer whose 16-bit red-green values are the given heights, with the water fractions in blue.
function rgbaOf(values, water = []) {
  const rgba = new Uint8ClampedArray(values.length * 4);
  values.forEach((v, i) => { rgba[i * 4] = v >> 8; rgba[i * 4 + 1] = v & 255; rgba[i * 4 + 2] = water[i] ?? 0; rgba[i * 4 + 3] = 255; });
  return rgba;
}

// A small region, heights stored raw (min 0, max 65535): a 5 × 4 base of
// 1,000 m posts a kilometre apart, world x −2..2 km and z −1.5..1.5 km, the
// flat sea at 0 m and a 500 m fade; two 3 × 3 patches of 100 m posts in a
// 6 × 3 atlas, A at 2,000 m over −100..100 and B at 3,000 m over 50..250 in
// x, both −100..100 in z, blending over 100 m. The base's east column is water.
function region(baseHeights = new Array(20).fill(1000)) {
  const meta = {
    origin: [569000, 278000], blend: 100, fade: 500,
    base: { w: 5, h: 4, post: 1000, x0: -2000, z0: -1500, min: 0, max: 65535, flat: 0 },
    atlas: { w: 6, h: 3, min: 0, max: 65535 },
    patches: [
      { name: 'A', px: 0, py: 0, size: 3, post: 100, x0: -100, z0: -100 },
      { name: 'B', px: 3, py: 0, size: 3, post: 100, x0: 50, z0: -100 },
    ],
  };
  const atlas = [], atlasWater = [];
  for (let j = 0; j < 3; j++) { atlas.push(2000, 2000, 2000, 3000, 3000, 3000); atlasWater.push(0, 0, 0, 255, 255, 255); }
  const baseWater = baseHeights.map((_, i) => (i % 5 === 4 ? 255 : 0));
  const baseRgba = rgbaOf(baseHeights, baseWater), atlasRgba = rgbaOf(atlas, atlasWater);
  return {
    meta,
    heights: { base: decodeHeights(baseRgba, 20), atlas: decodeHeights(atlasRgba, 18) },
    water: { base: decodeWater(baseRgba, 20), atlas: decodeWater(atlasRgba, 18) },
  };
}

test('heightmap: 16-bit heights decode from red and green, the water from blue', () => {
  const rgba = rgbaOf([0, 258, 65535], [0, 128, 255]);
  assert.deepEqual([...decodeHeights(rgba, 3)], [0, 258, 65535]);
  assert.deepEqual([...decodeWater(rgba, 3)], [0, 128, 255]);
});

test('heightmap: each patch laid over the base in turn, blended in across its edge band', () => {
  const { meta, heights } = region();
  const s = createSampler(meta, heights);
  near(s.heightAt(0, 0), 2000, 0.01, 'deep inside A');
  near(s.heightAt(-100, 0), 1000, 0.01, 'on A\'s edge: the base');
  near(s.heightAt(-50, 0), 1500, 0.01, 'halfway through A\'s band');
  near(s.heightAt(0, 50), 1500, 0.01, 'the band runs round every side');
  near(s.heightAt(150, 0), 3000, 0.01, 'deep inside B');
  near(s.heightAt(80, 0), 1740, 0.01, 'where A and B overlap, A over the base at 0.2, then B over that at 0.3');
  near(s.heightAt(75, 0), 1687.5, 0.01, 'and no step where their weights cross');
  near(s.heightAt(-1000, 1000), 1000, 0.01, 'outside every patch: the base');
  assert.equal(s.post, 100, 'the finest post spacing');
});

test('heightmap: the base is bilinear between its posts and eases to the flat sea at its edge', () => {
  const grad = []; for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) grad.push(1000 + i * 100 + j * 10);
  const s = createSampler(region(grad).meta, region(grad).heights);
  near(s.heightAt(-1500, -1000), 1055, 0.01, 'between four posts');
  near(s.heightAt(-1250, -1000), 1080, 0.01, 'a quarter of the way across a cell');
  const flat = createSampler(region().meta, region().heights);
  near(flat.heightAt(1900, 0), 200, 0.01, 'a fifth of the way into the fade: 0.2 × 1000');
  near(flat.heightAt(0, -1400), 200, 0.01, 'the fade runs round every side');
  near(flat.heightAt(5000, 0), 0, 0.01, 'beyond the edge: the sea');
  near(flat.heightAt(-9000, 9000), 0, 0.01, 'far beyond a corner: the sea');
});

test('heightmap: the water is read the same way as the heights, and beyond the island it is all sea', () => {
  const { meta, heights, water } = region();
  const s = createSampler(meta, heights, water);
  near(s.waterAt(-1000, 0), 0, 1e-9, 'dry land on the base');
  near(s.waterAt(1500, 0), 0.5, 1e-9, 'halfway between a dry post and a wet one');
  near(s.waterAt(150, 0), 1, 1e-9, 'patch B is water');
  near(s.waterAt(0, 0), 0, 1e-9, 'patch A is not');
  near(s.waterAt(9000, 9000), 1, 1e-9, 'beyond the edge: the sea');
  assert.equal(createSampler(meta, heights).waterAt(150, 0), 0, 'with no water channels, nothing is water on the base');
});

test('heightmap: the projection is the National Grid about the origin, x east and z south', () => {
  const p = createProjection(region().meta);
  const o = p.toWorld(569000, 278000); near(o.x, 0, 1e-9); near(o.z, 0, 1e-9);
  const v = p.toWorld(570000, 279000); near(v.x, 1000, 1e-9, 'a kilometre east'); near(v.z, -1000, 1e-9, 'a kilometre north is −z');
  const back = p.toGrid(v.x, v.z); near(back.east, 570000, 1e-9); near(back.north, 279000, 1e-9);
  const ben = p.fromLatLon(56.7969, -5.0036);
  near(ben.x, 216676 - 569000, 12, 'Ben Nevis west of the origin'); near(ben.z, -(771282 - 278000), 12, 'and far north');
});

test('the crash is against the ground that is there', () => {
  const x = new Float64Array(21); x[IX.H] = 500;
  assert.equal(crashed(x, 0), false);
  assert.equal(crashed(x, 499), false);
  assert.equal(crashed(x, 500), true);
  assert.equal(crashed(x, 1200), true);
});

// The PNGs make-heightmap.py writes: 8-bit RGB, each row under one of PNG's
// five filters (none, sub, up, average, Paeth), one IDAT; undone here, so the
// test reads exactly what the browser decodes.
function readHeightPng(path) {
  const png = readFileSync(path);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  assert.deepEqual([png[24], png[25]], [8, 2], '8-bit RGB');
  let pos = 8; const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos), type = png.toString('latin1', pos + 4, pos + 8);
    if (type === 'IDAT') idat.push(png.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 3, bpp = 3;
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
  let prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  const heights = new Uint16Array(w * h), water = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    assert.ok(filter <= 4, `a PNG filter type, row ${y}`);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const guess = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : paeth(a, b, c);
      cur[i] = (line[i] + guess) & 255;
    }
    for (let x = 0; x < w; x++) { heights[y * w + x] = cur[x * 3] * 256 + cur[x * 3 + 1]; water[y * w + x] = cur[x * 3 + 2]; }
    [prev, cur] = [cur, prev];
  }
  return { w, h, heights, water };
}

const regionPath = new URL('../terrain/region.json', import.meta.url);
test('the real region: the island is at its heights and the sea is wet', { skip: !existsSync(regionPath) && 'no terrain built' }, () => {
  const meta = JSON.parse(readFileSync(regionPath));
  const base = readHeightPng(new URL('../terrain/base.png', import.meta.url));
  const atlas = readHeightPng(new URL('../terrain/places.png', import.meta.url));
  assert.deepEqual([base.w, base.h, atlas.w, atlas.h], [meta.base.w, meta.base.h, meta.atlas.w, meta.atlas.h]);
  assert.ok(base.w * base.h <= 16777216, 'the base fits one iOS canvas');
  const s = createSampler(meta, { base: base.heights, atlas: atlas.heights }, { base: base.water, atlas: atlas.water });
  const p = createProjection(meta);
  const at = (lat, lon) => { const { x, z } = p.fromLatLon(lat, lon); return { h: s.heightAt(x, z), w: s.waterAt(x, z) }; };
  const summits = [
    ['Ben Nevis', 56.7969, -5.0036, 1345], ['Yr Wyddfa (Snowdon)', 53.0685, -4.0763, 1085], ['Scafell Pike', 54.4542, -3.2116, 978],
    ['Kinder Scout', 53.3847, -1.8711, 636], ['Cadair Idris', 52.6997, -3.9087, 893],
  ];
  for (const [name, lat, lon, height] of summits) {
    const g = at(lat, lon);
    console.log(`  ${name}: ${g.h.toFixed(0)} m (summit ${height} m), water ${g.w.toFixed(2)}`);
    assert.ok(g.h > height - 200 && g.h <= height + 5, `${name} from 200 m posts: within 200 m below the summit`);
    assert.equal(g.w, 0, `${name} is dry`);
  }
  const sea = [['the North Sea', 54.0, 2.0], ['the Irish Sea', 53.8, -4.0], ['the Channel', 50.3, -1.5], ['the Wash', 52.93, 0.3]];
  for (const [name, lat, lon] of sea) {
    const g = at(lat, lon);
    assert.ok(Math.abs(g.h) < 0.5, `${name} is at sea level: ${g.h}`);
    assert.ok(g.w > 0.99, `${name} is water: ${g.w}`);
  }
  const mild = at(52.3619, 0.4864), ely = at(52.3989, 0.2621), fen = at(52.45, 0.15);
  console.log(`  Mildenhall ${mild.h.toFixed(1)} m, Ely ${ely.h.toFixed(1)} m, the fen north-west of Ely ${fen.h.toFixed(1)} m (water ${fen.w.toFixed(2)})`);
  assert.ok(mild.h > 3 && mild.h < 15, `Mildenhall's airfield is about 10 m up: ${mild.h}`);
  assert.ok(fen.w < 0.2, 'the fens below sea level are land, not sea');
  const patch = meta.patches.find((q) => q.name === 'Mildenhall');
  assert.equal(patch.post, 50, 'the patch is OS Terrain 50 at its own posts');
  const { x, z } = p.fromLatLon(52.3619, 0.4864);
  const side = (patch.size - 1) * patch.post;
  assert.ok(x > patch.x0 + meta.blend && x < patch.x0 + side - meta.blend && z > patch.z0 + meta.blend && z < patch.z0 + side - meta.blend, 'Mildenhall is well inside its patch');
});
