// Latitude and longitude to the British National Grid, the projection the
// ground is in (terrain/region.json, EPSG:27700): the OS Helmert
// transformation from WGS 84 (ETRS89) to the OSGB36 datum, good to about
// 5 m, then the transverse Mercator projection, from Ordnance Survey's
// "A guide to coordinate systems in Great Britain". Pure maths, no browser
// APIs; the same formulas as terrain/make-heightmap.py. Degrees in, metres out.

const D2R = Math.PI / 180;

// OSGB36 latitude and longitude (degrees) to easting and northing.
export function osgb36ToGrid(latDeg, lonDeg) {
  const a = 6377563.396, b = 6356256.909;                 // Airy 1830
  const F0 = 0.9996012717, phi0 = 49 * D2R, lam0 = -2 * D2R, E0 = 400000, N0 = -100000;
  const phi = latDeg * D2R, lam = lonDeg * D2R;
  const e2 = 1 - (b / a) ** 2, n = (a - b) / (a + b);
  const s = Math.sin(phi), c = Math.cos(phi), t = Math.tan(phi);
  const nu = a * F0 / Math.sqrt(1 - e2 * s * s), rho = a * F0 * (1 - e2) / (1 - e2 * s * s) ** 1.5, eta2 = nu / rho - 1;
  const M = b * F0 * ((1 + n + 1.25 * n * n + 1.25 * n ** 3) * (phi - phi0)
    - (3 * n + 3 * n * n + 2.625 * n ** 3) * Math.sin(phi - phi0) * Math.cos(phi + phi0)
    + (1.875 * n * n + 1.875 * n ** 3) * Math.sin(2 * (phi - phi0)) * Math.cos(2 * (phi + phi0))
    - 35 / 24 * n ** 3 * Math.sin(3 * (phi - phi0)) * Math.cos(3 * (phi + phi0)));
  const I = M + N0, II = nu / 2 * s * c, III = nu / 24 * s * c ** 3 * (5 - t * t + 9 * eta2), IIIA = nu / 720 * s * c ** 5 * (61 - 58 * t * t + t ** 4);
  const IV = nu * c, V = nu / 6 * c ** 3 * (nu / rho - t * t), VI = nu / 120 * c ** 5 * (5 - 18 * t * t + t ** 4 + 14 * eta2 - 58 * t * t * eta2);
  const dl = lam - lam0;
  return { east: E0 + IV * dl + V * dl ** 3 + VI * dl ** 5, north: I + II * dl ** 2 + III * dl ** 4 + IIIA * dl ** 6 };
}

// WGS 84 latitude and longitude (degrees), as a phone or a map gives them,
// to easting and northing: the datum shift, then the projection.
export function latLonToGrid(latDeg, lonDeg) {
  const ecef = (lat, lon, a, b) => {
    const e2 = 1 - (b / a) ** 2, s = Math.sin(lat), c = Math.cos(lat);
    const nu = a / Math.sqrt(1 - e2 * s * s);
    return [nu * c * Math.cos(lon), nu * c * Math.sin(lon), (1 - e2) * nu * s];
  };
  const [x, y, z] = ecef(latDeg * D2R, lonDeg * D2R, 6378137.0, 6356752.314245);
  // the OS Helmert transformation, ETRS89 to OSGB36
  const tx = -446.448, ty = 125.157, tz = -542.060, sc = 20.4894e-6;
  const [rx, ry, rz] = [-0.1502, -0.2470, -0.8421].map((v) => v / 3600 * D2R);
  const x2 = tx + (1 + sc) * x - rz * y + ry * z;
  const y2 = ty + rz * x + (1 + sc) * y - rx * z;
  const z2 = tz - ry * x + rx * y + (1 + sc) * z;
  const a = 6377563.396, b = 6356256.909, e2 = 1 - (b / a) ** 2;
  const p = Math.hypot(x2, y2);
  let lat = Math.atan2(z2, p * (1 - e2));
  for (let i = 0; i < 8; i++) {
    const nu = a / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
    lat = Math.atan2(z2 + e2 * nu * Math.sin(lat), p);
  }
  return osgb36ToGrid(lat / D2R, Math.atan2(y2, x2) / D2R);
}
