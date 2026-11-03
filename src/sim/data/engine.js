// The F108-CF-100 (CFM56-2B-1) of docs/kc135-data.md section 12 and
// docs/flight-model.md section 6. lbf and ft.

export const T0 = 22000;            // lbf, take-off rating, sea-level static (EASA TCDS E.066)
export const MCT_FRACTION = 0.981;  // maximum continuous, 21,579 lbf
export const IDLE_FRACTION = 0.07;  // flight idle, of the local maximum: an assumption
export const BYPASS = 6.0;          // λ, the bypass ratio
export const T_CRUISE = 4600;       // lbf, the reference cruise thrust at M_CRUISE and H_CRUISE (OpenAP's 0.2·T0 + 890 N)
export const M_CRUISE = 0.78;
export const H_CRUISE = 35000;      // ft

// Where the OpenAP segments apply (flight model 6): the take-off equation to
// H_LOW, the en-route equation from H_HIGH, blended in pressure between.
export const H_LOW = 10000;
export const H_HIGH = 30000;

export const N_ENGINES = 4;
export const DETENT = 0.85;         // throttle position of the MCT detent
export const N1_MAX = 102;          // per cent, at take-off power at sea level

// Spool lag: a first-order time constant that depends on the thrust fraction
// (of T0) the engine is at: TAU_FAST at and above FAST_FRACTION, rising
// linearly to TAU_IDLE at IDLE_FRACTION.
export const TAU_FAST = 1.0;        // s
export const TAU_IDLE = 3.0;        // s
export const FAST_FRACTION = 0.20;
