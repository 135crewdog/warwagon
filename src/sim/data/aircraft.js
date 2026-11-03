// The KC-135R of docs/kc135-data.md sections 1, 10 and 11 and
// docs/flight-model.md sections 2, 4 and 7: geometry, mass, inertia, the
// thrust line and the surfaces. Imperial units: ft, slug, lbf, degrees.

export const G = 32.17;             // ft/s²

// Reference geometry (data 1, 10.1)
export const S = 2433;              // ft², wing area
export const B = 130.83;            // ft, span
export const CBAR = 20.16;          // ft, mean aerodynamic chord (241.88 in)

// Weight and CG, fixed (data 10.2)
export const WEIGHT = 240000;       // lbf
export const MASS = WEIGHT / G;     // slug
export const XCG = 0.25;            // fraction of c̄: the data's reference, so no CG transfer

// Inertias at 240,000 lb (data 10.3), slug·ft²
export const IXX = 2.76e6;
export const IYY = 4.11e6;
export const IZZ = 6.74e6;
export const IXZ = 0.25e6;

// The rotational equations' constants (flight model 4), from the inertias.
export function inertiaConstants(ixx = IXX, iyy = IYY, izz = IZZ, ixz = IXZ) {
  const gamma = ixx * izz - ixz * ixz;
  return {
    c1: ((iyy - izz) * izz - ixz * ixz) / gamma,
    c2: (ixx - iyy + izz) * ixz / gamma,
    c3: izz / gamma,
    c4: ixz / gamma,
    c5: (izz - ixx) / iyy,
    c6: ixz / iyy,
    c7: 1 / iyy,
    c8: (ixx * (ixx - iyy) + ixz * ixz) / gamma,
    c9: ixx / gamma,
  };
}
export const { C1, C2, C3, C4, C5, C6, C7, C8, C9 } = (() => {
  const c = inertiaConstants();
  return { C1: c.c1, C2: c.c2, C3: c.c3, C4: c.c4, C5: c.c5, C6: c.c6, C7: c.c7, C8: c.c8, C9: c.c9 };
})();

// Engine angular momentum: zero (flight model 4).
export const HX = 0;

// Thrust line: along body x, Z_T below the CG, an estimate (flight model 4).
export const Z_THRUST = 7;          // ft

// Control surfaces (flight model 7). Position limit and rate limit in degrees
// and deg/s; tau the first-order lag in s (0 for none). The rudder's limit is
// dynamic (rudderLimit); the stabiliser's travel is not symmetric.
export const SURFACES = {
  de: { limit: 20, rate: Infinity, tau: 0.1 },
  da: { limit: 20, rate: 40, tau: 0.1 },
  dr: { limit: 25, rate: 50, tau: 0.1 },
  is: { min: -14, max: 0.5, rate: 0.5, tau: 0 },
};

// The rudder power unit's authority: 7° at 320 kt, falling as the square of
// the speed, capped by the structural travel (flight model 7). keas in knots.
export function rudderLimit(keas) {
  const v = Math.max(keas, 1);
  const lim = 7 * (320 / v) * (320 / v);
  return lim < SURFACES.dr.limit ? lim : SURFACES.dr.limit;
}

// Data ranges and the envelope flag (flight model 4), degrees.
export const ALPHA_DATA = [-8, 20];
export const BETA_DATA = [-18, 18];
export const MACH_DATA = 0.90;
export const ALPHA_ENVELOPE = [-10, 24];
export const BETA_ENVELOPE = 20;
export const MACH_ENVELOPE = 0.92;
