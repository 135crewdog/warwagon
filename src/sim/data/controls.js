// The flight controls' gains, docs/flight-model.md section 8. The structure
// is the aircraft's; these numbers are tuning values with no public source,
// recorded here as data. Degrees, g, psf, seconds.

export const PITCH = {
  // The yoke is a force: δe = −x·K_E/q̄, clamped to the travel (8.2).
  kE: 1300,            // deg·psf: full tilt at cruise (q̄ 268) gives 4.9° of elevator (1,500 gave 5.6° and 2.7 g and the owner found the pitch too easy to over-control; 1,100 gave 4.1° and was a little too heavy on the second flight)
  released: 0.05,      // |x_pitch| below this is a released yoke
};

export const TRIM = {
  // The stabiliser runs toward 1 g when the yoke is released (8.3).
  kq: 0.15,            // g per deg/s of pitch rate: the lead
  qWashoutTau: 5,      // s: only changes of pitch rate count, so a steady turn's rate does not bias the trim
  kt: 2.0,             // deg/s per g of error, before the motor's rate limit
  deadband: 0.005,     // g: small, so a slow flight-path drift inside it stays small
  // With the yoke held, the stabiliser unloads a sustained force, as the pilot's thumb would (8.3): once
  // the elevator has been steady for holdDelay, it runs at kUnload per degree of elevator, within the motor's rate.
  holdDelay: 3,        // s the elevator must have been held steady
  holdSteady: 0.5,     // deg: steady means within this of its 1 s average
  holdMin: 1.0,        // deg: an elevator inside this is not a force worth trimming out
  kUnload: 0.3,        // deg/s of stabiliser per degree of held elevator
  unloadRatio: 0.53,   // deg of stabiliser that carries a degree of elevator (Cm_δe / Cm_δs): the most it trims out for a held force
};

export const ROLL = {
  // The wheel is a position: δa = −x·gearing (8.4).
  gearing: 20,         // deg of roll control at full wheel
};

export const YAW = {
  // The yaw damper and the coordination (8.5).
  kyd: 0.7,            // deg of rudder per deg/s of washed-out stability-axis yaw rate
  washoutTau: 4,       // s
  kny: 70,             // deg of rudder per g of lateral acceleration, at knyQbar
  knyQbar: 268,        // psf: the gain is scheduled as kny·knyQbar/q̄, because the rudder's own side force feeds n_y and a fixed gain went unstable above 340 KIAS
  knyMax: 2.0,         // the schedule's ceiling, as a multiple of kny, at low q̄
};
