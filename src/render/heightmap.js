// The ground's heights and water, read from the region's heightmap images: a
// coarse base tile of the island and an atlas of fine patches at the places
// worth flying, each post a 16-bit height split across the red (high byte)
// and green (low byte) channels, scaled between the image's lowest and
// highest points, and in the blue channel how much of the post is water.
// terrain/region.json (written by terrain/make-heightmap.py) says where each
// lies. The same lookup serves the crash check on the CPU, and terrain.js
// does it the same way on the GPU from the same images, so the two can never
// disagree. Rage's heightmap.js, with the water and the National Grid in
// place of its plate carrée. Pure maths, no three.js, so it runs in node for
// the tests. Metres throughout; world x east, z south.

import { latLonToGrid } from '../osgb.js';

// The 16-bit heights of an RGBA pixel buffer of `count` pixels.
export function decodeHeights(rgba, count) {
  const out = new Uint16Array(count);
  for (let i = 0; i < count; i++) out[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1];
  return out;
}

// The water fraction of each pixel, 0..255 from the blue channel.
export function decodeWater(rgba, count) {
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) out[i] = rgba[i * 4 + 2];
  return out;
}

// World metres of a National Grid easting and northing, or of a latitude
// and longitude: the grid about the region's origin, x east, z south.
export function createProjection(region) {
  const [e0, n0] = region.origin;
  const toWorld = (east, north) => ({ x: east - e0, z: -(north - n0) });
  return {
    toWorld,
    fromLatLon: (lat, lon) => { const g = latLonToGrid(lat, lon); return toWorld(g.east, g.north); },
    toGrid: (x, z) => ({ east: x + e0, north: n0 - z }),
  };
}

// region: the parsed region.json; heights: { base, atlas } as decodeHeights
// gives them, and water: { base, atlas } as decodeWater does (optional).
// heightAt(x, z): the ground height in metres at world x (east) and z
// (south, so −north): the base, with each patch that covers the point laid
// over it in turn, coarsest first, blended in across the band inside its
// edge (the region's blend, or the patch's own where it has one: a LiDAR
// patch nested in an OS patch blends over a short band, the two surveys
// agreeing to a metre or two), so where patches overlap the finer one shows
// and every join is smooth; and across the band inside the base's own edge the ground eases
// to the flat sea, which it keeps beyond. waterAt(x, z): the water fraction
// there, 0..1, read the same way.
export function createSampler(region, heights, water = null) {
  const { base, atlas, patches, blend, fade } = region;
  const baseScale = (base.max - base.min) / 65535, atlasScale = (atlas.max - atlas.min) / 65535;
  // bilinear read of a w × h grid of posts at a fractional post position, clamped to the grid
  function bilinear(get, w, h, fx, fz) {
    fx = Math.min(w - 1, Math.max(0, fx)); fz = Math.min(h - 1, Math.max(0, fz));
    const ix = Math.min(w - 2, Math.floor(fx)), iz = Math.min(h - 2, Math.floor(fz));
    const tx = fx - ix, tz = fz - iz;
    const top = get(ix, iz) * (1 - tx) + get(ix + 1, iz) * tx;
    const bottom = get(ix, iz + 1) * (1 - tx) + get(ix + 1, iz + 1) * tx;
    return top * (1 - tz) + bottom * tz;
  }
  const order = [...patches].sort((a, b) => b.post - a.post);   // coarsest first, so the finest ends on top
  // how far inside a rectangle a point is, as a fraction of the band, 0 outside and 1 past the band
  const inside = (x, z, x0, z0, w, h, band) => Math.min(1, Math.max(0, Math.min(x - x0, x0 + w - x, z - z0, z0 + h - z) / band));
  // the base, the patches and the fade, for any pair of per-post readers
  function sample(x, z, baseAt, patchAt, flat) {
    let h = bilinear(baseAt, base.w, base.h, (x - base.x0) / base.post, (z - base.z0) / base.post);
    for (const p of order) {
      const side = (p.size - 1) * p.post;
      const w = inside(x, z, p.x0, p.z0, side, side, p.blend ?? blend);
      if (w > 0) h += w * (bilinear(patchAt(p), p.size, p.size, (x - p.x0) / p.post, (z - p.z0) / p.post) - h);
    }
    const outer = inside(x, z, base.x0, base.z0, (base.w - 1) * base.post, (base.h - 1) * base.post, fade);
    return flat + outer * (h - flat);
  }
  const baseAt = (ix, iz) => base.min + heights.base[iz * base.w + ix] * baseScale;
  const patchAt = (p) => (ix, iz) => atlas.min + heights.atlas[(p.py + iz) * atlas.w + p.px + ix] * atlasScale;
  const baseWaterAt = (ix, iz) => (water ? water.base[iz * base.w + ix] / 255 : 0);
  const patchWaterAt = (p) => (ix, iz) => (water ? water.atlas[(p.py + iz) * atlas.w + p.px + ix] / 255 : 0);
  return {
    heightAt: (x, z) => sample(x, z, baseAt, patchAt, base.flat),
    waterAt: (x, z) => sample(x, z, baseWaterAt, patchWaterAt, 1),   // beyond the base's edge is the sea
    post: Math.min(base.post, ...patches.map((p) => p.post)),
  };
}
