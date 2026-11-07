// The throttle: a slim vertical slider on the left edge, driven by pointer
// events with pointer capture, keeping its value when released. The bottom
// is flight idle; a detent at MCT: a zone of the track around it snaps to
// MCT exactly, so the thumb finds it, and has to cross the zone's top to go
// above, up to take-off thrust (docs/flight-model.md sections 6 and 11.3).

import { DETENT } from '../sim/engine.js';

const SNAP = 0.05;  // fraction of the track below MCT that snaps to it
const GAP = 0.08;   // fraction of the track above MCT the thumb must cross to go past it

// Pointer position along the track (0 bottom .. 1 top) → throttle 0..1.
export function throttleFromPosition(pos) {
  const p = Math.max(0, Math.min(1, pos));
  if (p < DETENT - SNAP) return p / (DETENT - SNAP) * DETENT;
  if (p <= DETENT + GAP) return DETENT;
  return DETENT + (p - DETENT - GAP) / (1 - DETENT - GAP) * (1 - DETENT);
}

// The inverse, for drawing the thumb.
export function positionFromThrottle(t) {
  if (t < DETENT) return t / DETENT * (DETENT - SNAP);
  if (t === DETENT) return DETENT;
  return DETENT + GAP + (t - DETENT) / (1 - DETENT) * (1 - DETENT - GAP);
}

export function createThrottle(root, initial, onChange) {
  const track = root.querySelector('.track');
  const thumb = root.querySelector('.thumb');
  const mct = root.querySelector('.mct');
  let value = initial;
  mct.style.top = `${(1 - positionFromThrottle(DETENT)) * 100}%`;

  function render() {
    thumb.style.top = `${(1 - positionFromThrottle(value)) * 100}%`;
    root.classList.toggle('max', value > DETENT + 1e-6);
    root.setAttribute('aria-valuenow', String(Math.round(value * 100)));
  }
  function set(v) {
    value = Math.max(0, Math.min(1, v));
    render();
    onChange(value);
  }
  function fromEvent(e) {
    const r = track.getBoundingClientRect();
    return 1 - (e.clientY - r.top) / r.height;
  }
  let active = null;
  root.addEventListener('pointerdown', (e) => {
    if (active !== null) return;
    active = e.pointerId;
    root.setPointerCapture(e.pointerId);
    set(throttleFromPosition(fromEvent(e)));
    e.preventDefault();
  });
  root.addEventListener('pointermove', (e) => {
    if (e.pointerId !== active) return;
    set(throttleFromPosition(fromEvent(e)));
  });
  const end = (e) => { if (e.pointerId === active) active = null; };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);

  render();
  return { set };
}
