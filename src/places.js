// The places to fly. Each has an air start at 10,000 ft on the altimeter,
// or 2,000 ft above the ground where the ground is higher than 8,000,
// pointed at the sight, and names the fine patch in terrain/region.json it
// lies in. Headings are degrees true; positions are latitude and longitude
// (WGS 84), turned into the simulation's north and east feet through the
// National Grid (src/osgb.js) about the region's origin. Milestone 2 starts
// with one place; the owner's low-level routes add the rest, each with a
// patch of its own.

import { METRES_PER_FOOT } from './render/frames.js';

export const START_FT = 10000;        // above the sea, as the altimeter reads it; the owner's choice after the first flights over the UK
export const START_MIN_AGL_FT = 2000; // never nearer the ground than this, for a place in the mountains
export const START_KCAS = 250;

export const PLACES = [
  { name: 'RAF Mildenhall', patch: 'Mildenhall', start: { lat: 52.245, lon: 0.41, heading: 22 }, where: 'over Newmarket, heading north-east to Mildenhall, Lakenheath beyond' },
];
export const DEFAULT_PLACE = PLACES[0].name;

export function placeNamed(name) {
  return PLACES.find((p) => p.name === name) ?? PLACES[0];
}

// The simulation's air start at a place: north and east in feet from the
// world origin, h in feet above the sea (10,000 ft, or 2,000 ft above the
// ground that is there if that is higher), psi in radians.
export function airStartFor(place, projection, sampler) {
  const { x, z } = projection.fromLatLon(place.start.lat, place.start.lon);
  const ground = sampler.heightAt(x, z) / METRES_PER_FOOT;
  return { north: -z / METRES_PER_FOOT, east: x / METRES_PER_FOOT, h: Math.max(START_FT, ground + START_MIN_AGL_FT), psi: place.start.heading * Math.PI / 180 };
}
