// The aerodynamic build-up of docs/flight-model.md section 5: the tables of
// data/aero.js with their Mach and elastic corrections, the control and rate
// terms, then the rotation into body axes. Pure: angles in, coefficients out.

import { interp1, interp2 } from './table.js';
import { B, CBAR, MACH_DATA } from './data/aircraft.js';
import * as D from './data/aero.js';

const D2R = Math.PI / 180;

// inputs: alphaDeg, betaDeg (deg); de, da, dr, is (deg, signs of flight model
// 2.3); p, q, r (rad/s, body); vt (ft/s); qbar (psf); mach.
export function coefficients({ alphaDeg, betaDeg, de, da, dr, is, p, q, r, vt, qbar, mach }) {
  const alpha = alphaDeg * D2R, beta = betaDeg * D2R;
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const cb = Math.cos(beta), sb = Math.sin(beta);
  const m = mach < MACH_DATA ? mach : MACH_DATA;
  const v = vt > 1e-3 ? vt : 1e-3;

  // 5.1: the rate derivatives are stability-axis; rotate the rates first.
  const ps = p * ca + r * sa;
  const rs = r * ca - p * sa;
  const qhat = q * CBAR / (2 * v);
  const phat = ps * B / (2 * v);
  const rhat = rs * B / (2 * v);

  // Mach and elastic factors (5.2, 5.6, 5.7)
  const fm = interp1(D.FM_MACH, D.FM, m);
  const ke = 1 - D.KE_PER_QBAR * qbar;
  const ks = 1 - D.KS_PER_QBAR * qbar;
  const kq = 1 - D.KQ_PER_QBAR * qbar;
  const se = D.SE_PER_QBAR * qbar;

  const it = is + D.STAB_DATUM;      // the tunnel's tail angle (5.3)

  // Longitudinal (5.2–5.4)
  const clTab = interp1(D.ALPHA, D.CL_TAB, alphaDeg);
  const cmTab = interp1(D.ALPHA, D.CM_TAB, alphaDeg);
  const cdTab = interp1(D.ALPHA, D.CD_TAB, alphaDeg);
  const CL = fm * ke * clTab + D.CL_DS * it + D.CL_DE * de + D.CL_Q * qhat;
  const stallDrag = Math.max(0, cdTab - (D.CD0_TUNNEL + D.K_TUNNEL * clTab * clTab));
  const dragRise = interp2(D.DCD_MACH, D.DCD_CL, D.DCD, m, CL);
  const CD = D.CD0 + D.K_INDUCED * CL * CL + stallDrag + dragRise;
  const Cm = fm * ke * cmTab + se * CL + interp1(D.TUCK_MACH, D.TUCK, m)
    + ks * D.CM_DS * it + D.CM_DE * de + kq * D.CM_QSTAR * qhat;

  // Lateral-directional (5.5): tables by |β| with the sign restored
  const ab = Math.abs(betaDeg), sg = betaDeg < 0 ? -1 : 1;
  const CY = sg * interp1(D.BETA, D.CY_TAB, ab) + D.CY_DR * dr + D.CY_P * phat + D.CY_R * rhat;
  const Cl = sg * interp1(D.BETA_CL, D.CLROLL_TAB, ab) + D.CLROLL_DA * da + D.CLROLL_DR * dr
    + D.CLROLL_P * phat + D.CLROLL_R * rhat;
  const Cn = sg * interp1(D.BETA, D.CN_TAB, ab) + D.CN_DA * da + D.CN_DR * dr
    + D.CN_P * phat + D.CN_R * rhat;

  // Into body axes (5.1): forces from the wind axes, moments from stability axes
  const cx = -CD * ca * cb + CL * sa - CY * ca * sb;
  const cy = -CD * sb + CY * cb;
  const cz = -CD * sa * cb - CL * ca - CY * sa * sb;
  const clBody = Cl * ca - Cn * sa;
  const cnBody = Cl * sa + Cn * ca;

  // The buffet boundary (section 10): CL as a fraction of the boundary's
  const buffetFraction = CL / interp1(D.BUFFET_MACH, D.BUFFET_CL, m);

  return { CL, CD, CY, Cm, Cl, Cn, cx, cy, cz, clBody, cnBody, stallDrag, dragRise, buffetFraction };
}
