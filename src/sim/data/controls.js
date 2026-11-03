// The flight controls' gains, docs/flight-model.md section 8. The structure
// is the aircraft's; these numbers are tuning values with no public source,
// recorded here as data. Degrees, g, psf, seconds.

export const PITCH = {
  // The yoke is a force: δe = −x·K_E/q̄, clamped to the travel (8.2).
  kE: 1500,            // deg·psf: full tilt at cruise (q̄ 268) gives 5.6° of elevator, a 2.7 g peak
  released: 0.05,      // |x_pitch| below this is a released yoke
};

export const TRIM = {
  // The stabiliser runs toward 1 g when the yoke is released (8.3).
  kq: 0.15,            // g per deg/s of pitch rate: the lead
  qWashoutTau: 5,      // s: only changes of pitch rate count, so a steady turn's rate does not bias the trim
  kt: 2.0,             // deg/s per g of error, before the motor's rate limit
  deadband: 0.005,     // g: small, so a slow flight-path drift inside it stays small
};

export const ROLL = {
  // The wheel is a position: δa = −x·gearing (8.4).
  gearing: 20,         // deg of roll control at full wheel
};

export const YAW = {
  // The yaw damper and the coordination (8.5).
  kyd: 0.7,            // deg of rudder per deg/s of washed-out stability-axis yaw rate
  washoutTau: 4,       // s
  kny: 70,             // deg of rudder per g of lateral acceleration
};
