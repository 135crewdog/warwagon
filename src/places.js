// The places to fly. Each has an air start 5,000 ft above the ground,
// pointed at the sight, and names the fine patch in terrain/region.json it
// lies in. Headings are degrees true; positions are latitude and longitude
// (WGS 84), turned into the simulation's north and east feet through the
// National Grid (src/osgb.js) about the region's origin. Milestone 2 starts
// with one place; the owner's low-level routes add the rest, each with a
// patch of its own.

import { METRES_PER_FOOT } from './render/frames.js';

export const START_AGL_FT = 5000;

export const PLACES = [
  { name: 'RAF Mildenhall', patch: 'Mildenhall', start: { lat: 52.245, lon: 0.41, heading: 22 }, where: 'over Newmarket, heading north-east to Mildenhall, Lakenheath beyond' },
];
export const DEFAULT_PLACE = PLACES[0].name;

export function placeNamed(name) {
  return PLACES.find((p) => p.name === name) ?? PLACES[0];
}

// The simulation's air start at a place: north and east in feet from the
// world origin, h in feet above the sea (5,000 ft above the ground that is
// there), psi in radians.
export function airStartFor(place, projection, sampler) {
  const { x, z } = projection.fromLatLon(place.start.lat, place.start.lon);
  const ground = sampler.heightAt(x, z) / METRES_PER_FOOT;
  return { north: -z / METRES_PER_FOOT, east: x / METRES_PER_FOOT, h: ground + START_AGL_FT, psi: place.start.heading * Math.PI / 180 };
}
