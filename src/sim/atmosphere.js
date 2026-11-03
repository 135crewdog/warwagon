// The 1976 standard atmosphere, docs/flight-model.md section 3: the
// troposphere's lapse to 36,089 ft, then the isothermal stratosphere to
// 65,617 ft. Inputs: true airspeed VT in ft/s, altitude in ft. Imperial out.

const T0 = 518.67;              // °R, sea-level temperature
export const P0 = 2116.22;      // psf, sea-level pressure
const LAPSE = 0.0035662;        // °R per ft
const H_TROP = 36089;           // ft, the tropopause
const T_TROP = 389.97;          // °R, above it
const P_TROP = 472.68;          // psf, at the tropopause
const H_SCALE = 20806;          // ft, the stratosphere's pressure scale height
const R_AIR = 1716.56;          // ft·lbf/(slug·°R)
const GAMMA = 1.4;

export function atmosphere(vt, alt) {
  const h = alt < 0 ? 0 : alt;
  let temp, pressure;
  if (h < H_TROP) {
    temp = T0 - LAPSE * h;
    pressure = P0 * Math.pow(temp / T0, 5.2559);
  } else {
    temp = T_TROP;
    pressure = P_TROP * Math.exp(-(h - H_TROP) / H_SCALE);
  }
  const rho = pressure / (R_AIR * temp);
  const a = Math.sqrt(GAMMA * R_AIR * temp);
  return {
    temp,
    pressure,
    rho,
    a,
    theta: temp / T0,           // temperature ratio
    delta: pressure / P0,       // pressure ratio
    mach: vt / a,
    qbar: 0.5 * rho * vt * vt,
  };
}

const sl = atmosphere(0, 0);
export const A0 = sl.a;
export const RHO0 = sl.rho;
