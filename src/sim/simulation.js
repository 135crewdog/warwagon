// The simulation as the app drives it: an air start, then fixed steps with
// the commands of the moment. In milestone 1a the commands are the surfaces
// and the throttle directly ({ throttle, de, da, dr, isRate }); milestone 1b
// adds controls.js, which makes them from the yoke (the elevator and roll
// control), the automatic trim (isRate) and the yaw damper (dr).

import { DT, IX, N, step as dynamicsStep, derivative, crashed, D2R } from './dynamics.js';
import { fromEuler } from './quaternion.js';
import { trimLevel } from './trim.js';
import { airdata, trueAirspeedFromKcas } from './airdata.js';
import { n1 } from './engine.js';
import { SURFACES } from './data/aircraft.js';

export const VSI_TAU = 4;   // s, the VSI's lag (flight model 9)

export class Simulation {
  // An air start: wings level, trimmed for 1 g at h (ft) and kcas, heading
  // psi (rad, 0 north) at north and east (ft) from the origin.
  constructor({ h = 10000, kcas = 280, psi = 0, north = 0, east = 0 } = {}) {
    this.airStart(h, kcas, psi, north, east);
  }

  airStart(h, kcas, psi = 0, north = 0, east = 0) {
    const vt = trueAirspeedFromKcas(kcas, h);
    const t = trimLevel(vt, h);
    if (!t.ok) throw new Error(`air start trim did not converge at ${kcas} KCAS, ${h} ft`);
    if (t.is < SURFACES.is.min || t.is > SURFACES.is.max || t.controls.throttle <= 0 || t.controls.throttle >= 1) {
      throw new Error(`no level 1 g flight at ${kcas} KCAS, ${h} ft: trim needs stabiliser ${t.is.toFixed(2)}°, throttle ${t.controls.throttle.toFixed(2)}`);
    }
    this.state = t.state;
    const q = fromEuler(0, t.alpha * D2R, psi);
    this.state[IX.Q0] = q[0]; this.state[IX.Q1] = q[1]; this.state[IX.Q2] = q[2]; this.state[IX.Q3] = q[3];
    this.state[IX.NORTH] = north; this.state[IX.EAST] = east;
    this.controls = { ...t.controls };
    this.trimThrottle = t.controls.throttle;
    this.time = 0;
    this.aux = t.aux;
    this.vsi = 0;
    this.crashed = false;
    return this;
  }

  // One fixed physics step with the commands { throttle, de, da, dr, isRate }.
  step(commands, dt = DT) {
    if (this.crashed) return;
    this.controls = { throttle: this.controls.throttle, de: 0, da: 0, dr: 0, isRate: 0, ...commands };
    const r = dynamicsStep(this.state, this.controls, dt);
    this.state = r.state;
    this.time += dt;
    const xdot = new Float64Array(N);
    this.aux = derivative(this.state, this.controls, xdot);
    this.vsi += (xdot[IX.H] * 60 - this.vsi) * dt / VSI_TAU;
    if (crashed(this.state)) this.crashed = true;
  }

  // The auxiliary quantities (n_z, α, q̄ ...) for a state and controls.
  auxFor(state, controls) {
    const xdot = new Float64Array(N);
    return derivative(state, controls, xdot);
  }

  get airdata() {
    return { ...airdata(this.state, this.aux), vsi: this.vsi };
  }

  get outOfEnvelope() {
    return this.aux.outOfEnvelope;
  }

  // The control surfaces' positions in degrees, for the renderer, with the
  // signs of docs/flight-model.md 2.3.
  get surfaces() {
    const x = this.state;
    return { de: x[IX.DE], da: x[IX.DA], dr: x[IX.DR], is: x[IX.IS] };
  }

  // The engines for the HUD: N1 per cent from the thrust, not the slider.
  get engines() {
    const x = this.state;
    const thrust = (x[IX.T1] + x[IX.T2] + x[IX.T3] + x[IX.T4]) / 4;
    return { thrust, n1: n1(thrust, x[IX.H], this.aux.mach) };
  }

  // CL as a fraction of the buffet boundary (section 10's cue).
  get buffetFraction() {
    return this.aux.coefficients.buffetFraction;
  }
}

// The fixed-step clock of docs/flight-model.md 2.4, as Rage's.
export function stepsFor(carry, elapsed, maxSteps = 8, dt = DT) {
  let acc = carry + Math.max(0, elapsed);
  let steps = Math.floor(acc / dt + 1e-9);
  if (steps > maxSteps) { steps = maxSteps; acc = maxSteps * dt; }
  acc -= steps * dt;
  return { steps, carry: acc, fraction: acc / dt };
}

export { DT };
