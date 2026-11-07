// The chase camera: behind and above the jet, following its attitude
// smoothly enough not to jitter and close enough that the jet's own motion
// reads. The cues of docs/flight-model.md section 10 (buffet shake, load)
// are applied here, driven by the model and never by a timer. Rage's
// camera, with its distances scaled to a 42 m jet and the buffet taken from
// the buffet boundary rather than an angle of attack.

import * as THREE from 'three';

const BEHIND = 44;        // m along the jet's +z (behind the tail)
const ABOVE = 10;         // m
const LOAD_PER_G = 1.0;   // m the camera rises per g above 1 (and drops per g below), so the load reads as pushing the jet down
const BUFFET_ONSET = 0.9; // fraction of the buffet boundary's CL where the shake starts
const BUFFET_FULL = 1.05; // and where it is full

export function createChaseCamera(camera) {
  const q = new THREE.Quaternion();          // the camera's own smoothed attitude
  const pos = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const up = new THREE.Vector3();
  const shake = new THREE.Vector3();
  let first = true;
  let t = 0;

  return {
    // position, quaternion: the jet's world transform (interpolated).
    // aux: { nz, buffet, qbar } from the simulation, buffet being CL as a
    // fraction of the buffet boundary.
    update(dt, position, quaternion, aux) {
      t += dt;
      // follow attitude with a short time constant; snap on the first frame
      const k = first ? 1 : 1 - Math.exp(-dt / 0.15);
      q.slerp(quaternion, k);
      first = false;

      // load: positive g pushes the jet toward its belly, so the camera looks
      // down on it from higher; negative g the other way
      const load = LOAD_PER_G * (Math.max(-1, Math.min(3, aux.nz)) - 1);
      offset.set(0, ABOVE + load, BEHIND).applyQuaternion(q);
      pos.copy(position).add(offset);

      // buffet: a small, high-frequency shake that starts at 90 % of the
      // buffet boundary and is full on it, stronger at higher dynamic pressure
      const a = Math.max(0, Math.min(1, (aux.buffet - BUFFET_ONSET) / (BUFFET_FULL - BUFFET_ONSET)));
      const amp = 0.12 * a * a * Math.min(1.5, aux.qbar / 250);   // a third of the first value: the owner's first flights found it violent
      shake.set(
        Math.sin(t * 61.3) + 0.5 * Math.sin(t * 97.1),
        Math.sin(t * 73.7 + 1.3) + 0.5 * Math.sin(t * 113.9),
        Math.sin(t * 53.1 + 2.1),
      ).multiplyScalar(amp).applyQuaternion(q);
      pos.add(shake);

      camera.position.copy(pos);
      // aim a little above the jet so it sits in the lower third of the frame and the HUD's centre is clear sky
      aim.set(0, 7.5, -34).applyQuaternion(q).add(position);
      up.set(0, 1, 0).applyQuaternion(q);
      camera.up.copy(up);
      camera.lookAt(aim);
    },
    reset() { first = true; },
  };
}
