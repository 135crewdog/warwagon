// The aerodynamic data of docs/flight-model.md section 5, re-keyed from
// docs/kc135-data.md (the section of each is given) and the chart records in
// research/charts/. tests/aero.test.js checks every table against its record.
// Degrees for the breakpoints and the per-degree derivatives; per radian for
// the rate derivatives.

// Longitudinal tables: tail on, tail at the tunnel's 0°, flaps up, Mach 0.28,
// about 0.25 c̄ (data 2.1, 3.1, 4.1, the breakpoint rows; record
// A1-fig8-p28-{CL,Cm,CD}, curve WBNH0V).
export const ALPHA = [-8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
export const CL_TAB = [-0.430, -0.272, -0.108, 0.057, 0.217, 0.389, 0.558, 0.714, 0.861, 0.988, 1.074, 1.134, 1.135, 1.137, 1.137];
export const CM_TAB = [0.169, 0.122, 0.085, 0.052, 0.023, -0.014, -0.044, -0.071, -0.095, -0.109, -0.110, -0.114, -0.145, -0.193, -0.241];
export const CD_TAB = [0.056, 0.032, 0.021, 0.021, 0.021, 0.026, 0.032, 0.044, 0.064, 0.100, 0.159, 0.224, 0.289, 0.347, 0.396];

// The tunnel polar's own parabola (data 4.1), subtracted from CD_TAB to leave
// the stall's drag rise (flight model 5.4).
export const CD0_TUNNEL = 0.0191;
export const K_TUNNEL = 0.0481;

// The clean polar, flight's (flight model 5.4; data 9.4): CD = CD0 + K·CL².
export const CD0 = 0.0155;
export const K_INDUCED = 0.047;

// Stabiliser, elevator and pitch-rate terms, per degree and per radian
// (flight model 5.2, 5.3; data 2.1, 3.1, 8.3, 8.4, 11.1).
export const CL_DS = 0.0107;        // per deg of stabiliser leading edge up
export const CM_DS = -0.0284;
export const CL_DE = 0.0055;        // per deg of elevator trailing edge down (estimate)
export const CM_DE = -0.015;
export const CL_Q = 11;             // per rad, q·c̄/2V
export const CM_QSTAR = -21;        // per rad: Cmq −14.65 plus Cmα̇ −6.57, flight test
export const STAB_DATUM = 2.4;      // deg: tunnel tail angle = i_s + STAB_DATUM (flight model 5.3), re-derived with the calibrated tuck

// The rise of the lift and moment slopes with Mach (flight model 5.2).
export const FM_MACH = [0.30, 0.50];
export const FM = [1.00, 1.16];

// Mach tuck at constant lift, relative to Mach 0.50 (flight model 5.6).
// TUCK_TUNNEL is the tail-off tunnel's curve (data 9.2). The aircraft's,
// TUCK, is a tenth of it to the drag-divergence Mach, calibrated to the
// flight-test phugoid at Mach 0.77 (data 8.5: 110 s; the tunnel's curve in
// full gives 331 s there and no phugoid at all at 0.78), and the tunnel's
// increments in full above it, where the shocks the drag rise proves are the
// tuck's cause.
export const TUCK_MACH = [0.50, 0.70, 0.75, 0.78, 0.80, 0.82, 0.85, 0.90];
export const TUCK_TUNNEL = [0, -0.011, -0.017, -0.021, -0.028, -0.036, -0.044, -0.044];
export const TUCK_TAIL_FACTOR = 0.1;
export const TUCK_ONSET_MACH = 0.82;
const onset = TUCK_MACH.indexOf(TUCK_ONSET_MACH);
export const TUCK = TUCK_TUNNEL.map((v, i) => (TUCK_MACH[i] <= TUCK_ONSET_MACH
  ? TUCK_TAIL_FACTOR * v
  : TUCK_TAIL_FACTOR * TUCK_TUNNEL[onset] + (v - TUCK_TUNNEL[onset])));

// The drag rise ΔCD(M, CL) (flight model 5.4). To Mach 0.80 the flight data
// (data 9.4): Lux's increments over his Mach 0.70 polar at CL 0.40 and 0.50,
// the 0.40 column held below it, the 0.60 column twice the 0.50 (the tunnel's
// shape), and his unread 0.80 point at CL 0.50 extrapolated. Above 0.80 the
// tunnel's increments relative to its own 0.80 curve (data 9.1), added to the
// 0.80 row.
export const DCD_MACH = [0.70, 0.75, 0.78, 0.80, 0.82, 0.85, 0.90];
export const DCD_CL = [0.2, 0.3, 0.4, 0.5, 0.6];
export const DCD = [
  [0, 0, 0, 0, 0],
  [0.0003, 0.0003, 0.0003, 0.0007, 0.0014],
  [0.0004, 0.0004, 0.0004, 0.0012, 0.0024],
  [0.0005, 0.0005, 0.0005, 0.0017, 0.0034],
  [0.0011, 0.0015, 0.0024, 0.0063, 0.0116],
  [0.0041, 0.0065, 0.0109, 0.0180, 0.0256],
  [0.0188, 0.0244, 0.0311, 0.0408, 0.051],
];

// The elastic wing, straight lines in q̄ (psf) (flight model 5.7; data 8.6).
export const SE_PER_QBAR = 1.9e-4;  // neutral-point shift forward, c̄ per psf, as a Cm increment per unit CL
export const KE_PER_QBAR = 0.0004;  // lift and moment slope factor 1 − KE·q̄
export const KS_PER_QBAR = 0.0003;  // stabiliser factor 1 − KS·q̄
export const KQ_PER_QBAR = 0.0004;  // pitch damping factor 1 − KQ·q̄
export const QBAR_ELASTIC_MAX = 500; // psf: the lines are held beyond this (about 390 KEAS), past FLEXSTAB's points

// Lateral-directional tables against |β| in degrees (data 7.1, record
// A1-fig6-p19-{CY,Cn,Cl}): the negative-β half of the sweep mirrored, the
// zero offset of the Cl run (−0.002 at β 0) removed, and the sign restored
// with sign(β) in the lookup. All three are odd in β. Values for β > 0: wind
// from the right pushes the jet left (CY < 0), yaws the nose right (Cn > 0)
// and rolls it left (Cl < 0).
export const BETA = [0, 2, 4, 6, 8, 10, 12, 14, 16];
export const CY_TAB = [0, -0.021, -0.043, -0.067, -0.094, -0.123, -0.147, -0.173, -0.196];
export const CN_TAB = [0, 0.006, 0.012, 0.019, 0.027, 0.034, 0.039, 0.043, 0.047];
export const BETA_CL = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18];
export const CLROLL_TAB = [0, -0.007, -0.013, -0.019, -0.026, -0.032, -0.037, -0.042, -0.047, -0.050];

// Controls, per degree (flight model 5.5; data 7.2, 8.4, 11.1). Signs per
// flight model 2.3: positive rudder yaws the nose left, positive roll control
// rolls left.
export const CN_DR = -0.0016;
export const CY_DR = 0.0030;
export const CLROLL_DR = 0.0004;
export const CLROLL_DA = -0.00095;  // a tuning value, range −0.0006 to −0.0015: 43°/s at full wheel at cruise, 31°/s at the air start
export const CN_DA = -0.0002;

// Rate derivatives, per radian, stability axes (flight model 5.5; data 8.3, 8.4).
export const CLROLL_P = -0.345;
export const CN_R = -0.194;
export const CLROLL_R = 0.25;
export const CN_P = 0.019;
export const CY_P = -0.185;
export const CY_R = 0.71;

// Buffet onset, CL against Mach (flight model 10; data 9.3).
export const BUFFET_MACH = [0.50, 0.60, 0.70, 0.75, 0.78, 0.80, 0.82];
export const BUFFET_CL = [0.71, 0.75, 0.76, 0.70, 0.63, 0.58, 0.50];
