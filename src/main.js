// War Wagon: the composition root. Wires the simulation, the tilt input, the
// renderer, the HUD and the UI together. Nothing here changes the simulation
// except the yoke and throttle values passed into step(). Rage's main.js,
// without its places, terrain, look-around and plume.

import * as THREE from 'three';
import { Simulation, stepsFor, DT } from './sim/simulation.js';
import { IX, quaternionOf, crashed } from './sim/dynamics.js';
import { positionToWorld, attitudeToWorld, vectorToWorld } from './render/frames.js';
import * as Quat from './sim/quaternion.js';
import { createWorld, FAR } from './render/world.js';
import { createAircraft } from './render/kc135.js';
import { createChaseCamera } from './render/camera.js';
import { createHud } from './hud/hud.js';
import { createThrottle } from './ui/throttle.js';
import { createStickIndicator } from './ui/stick.js';
import { createScreens } from './ui/screens.js';
import { upInScreen, tiltOf, stickFrom, smooth, MAPPING } from './input/tilt.js';
import { createLook, attachLook } from './input/look.js';
import { SURFACES } from './sim/data/aircraft.js';
import { APP_VERSION } from './version.js';

const AIR_START = { h: 10000, kcas: 280 };   // 10,000 ft, 280 KIAS, wings level, trimmed (CLAUDE.md)
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

// ---- renderer, world, jet, camera, HUD ----
const view = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 2, FAR);
const world = createWorld(scene);
const jet = createAircraft();
scene.add(jet);
const chase = createChaseCamera(camera);
const look = createLook();                  // look-around by dragging the view
attachLook(view, look, () => mode === 'flying');
const hud = createHud(document.getElementById('hud'));

let sizedW = 0, sizedH = 0;
let renderPending = true;     // draw the next frame even under an opaque screen: something changed
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  if (!w || !h) return;
  sizedW = w; sizedH = h;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  hud.resize();
  renderPending = true;
}
resize();
// iOS drops a WebGL context under memory pressure. Acknowledged, the loss is
// temporary: three.js rebuilds everything when the context comes back.
view.addEventListener('webglcontextlost', (e) => { e.preventDefault(); pause(); });
view.addEventListener('webglcontextrestored', () => { renderPending = true; });
// iOS can fire resize before the layout has settled; every frame also checks the canvas's real size.
function resizeIfChanged() {
  if (view.clientWidth !== sizedW || view.clientHeight !== sizedH) resize();
}

// ---- simulation and flight state ----
let sim = null;               // made by airStart()
let mode = 'start';           // start | flying | paused | crashed
let carry = 0;
let prevPose = null, pose = null;
let throttleValue = 0;        // the trim setting, from airStart()
const yoke = { pitch: 0, roll: 0 };
const portrait = matchMedia('(orientation: portrait)');
const isPortrait = () => innerHeight > innerWidth;
let wasPortrait = isPortrait();
const screens = createScreens({
  version: APP_VERSION,
  onFly: fly, onResume: resume, onRecenter: recenter, onFlyAgain: flyAgain, onUpdate: applyUpdate,
  locked: () => (isPortrait() ? 'rotate' : null),
});
const throttle = createThrottle(document.getElementById('throttle'), throttleValue, (v) => { throttleValue = v; });
const stickIndicator = createStickIndicator(document.getElementById('stick'));
const controls = document.getElementById('controls');
document.getElementById('pause').addEventListener('click', pause);

function poseOf(state) {
  const p = positionToWorld(state[IX.NORTH], state[IX.EAST], state[IX.H]);
  const q = attitudeToWorld(quaternionOf(state));
  return { position: new THREE.Vector3(p[0], p[1], p[2]), quaternion: new THREE.Quaternion(q[0], q[1], q[2], q[3]) };
}

function airStart() {
  sim = new Simulation(AIR_START);
  carry = 0;
  prevPose = pose = poseOf(sim.state);
  throttleValue = sim.trimThrottle;
  throttle.set(throttleValue);
  chase.reset();
  renderPending = true;
}
airStart();

// ---- tilt input ----
const tilt = { pitch: 0, roll: 0, confidence: 0, beta: 0, gamma: 0, alpha: 0, seen: false, at: 0 };
let neutral = null;
let wantRecenter = true;
const smoothed = { pitch: 0, roll: 0 };

function screenAngle() {
  const a = screen.orientation?.angle ?? window.orientation ?? 0;
  return ((a % 360) + 360) % 360;
}

function onOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  const u = upInScreen(e.beta, e.gamma, screenAngle());
  const t = tiltOf(u);
  const now = performance.now();
  const dt = tilt.seen ? (now - tilt.at) / 1000 : 0;
  Object.assign(tilt, t, { beta: e.beta, gamma: e.gamma, alpha: e.alpha ?? 0, seen: true, at: now });
  if (wantRecenter && t.confidence > 0.3) {
    neutral = { pitch: t.pitch, roll: t.roll }; wantRecenter = false;
    screens.recentered(); stickIndicator.pulse();   // the tap did something: say so
  }
  if (!neutral) return;
  const s = stickFrom(t, neutral, MAPPING);
  smoothed.pitch = smooth(smoothed.pitch, s.pitch, dt);
  smoothed.roll = smooth(smoothed.roll, s.roll, dt);
  yoke.pitch = smoothed.pitch;
  yoke.roll = smoothed.roll;
}
window.addEventListener('deviceorientation', onOrientation);

function recenter() {
  wantRecenter = true;
  neutral = null;
  yoke.pitch = yoke.roll = smoothed.pitch = smoothed.roll = 0;
}

// The screen that belongs to the current mode (the rotate screen wins in portrait).
function showForMode() {
  if (mode === 'flying') screens.hide();
  else if (mode === 'paused') screens.show('pause');
  else if (mode === 'crashed') screens.show('crashed');
  else screens.show('start');
}

// ---- screens and modes ----
let wakeLock = null;
function keepAwake() {
  if (!navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
}

function fly() {
  // The motion permission request must be the first statement in the tap
  // handler, synchronously, or iOS refuses it.
  const permission = (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function')
    ? DeviceOrientationEvent.requestPermission()
    : Promise.resolve('granted');
  keepAwake();
  permission.then((state) => state === 'granted', () => false).then((granted) => {
    if (!granted) { screens.show('denied'); return; }
    recenter();
    startFlight();
  });
}

function startFlight() {
  if (isPortrait()) { screens.show('rotate'); return; }   // no flying in portrait
  mode = 'flying';
  controls.hidden = false;
  screens.hide();
  carry = 0;
}

function pause() {
  if (mode !== 'flying') return;
  mode = 'paused';
  look.reset();                               // resume from the plain chase view
  screens.show('pause');
  checkForUpdate();
}

function resume() {
  if (mode !== 'paused' || isPortrait()) return;
  mode = 'flying';
  screens.hide();
  carry = 0;
  keepAwake();
}

// Fly again returns to the start screen at the air start.
function flyAgain() {
  if (isPortrait()) return;
  airStart();
  look.reset();
  mode = 'start';
  controls.hidden = true;
  screens.show('start');
}

function crash() {
  mode = 'crashed';
  controls.hidden = true;
  screens.show('crashed');
  checkForUpdate();
}

// Pause when the app is hidden; resume only from the pause screen.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); } else { keepAwake(); checkForUpdate(); }
});

// Portrait: show the rotate screen; on any rotation during flight, pause and recenter.
function onRotate() {
  const p = isPortrait();
  if (p !== wasPortrait) {
    wasPortrait = p;
    if (p && mode === 'flying') pause();
    if (!p && mode === 'paused') recenter();
  }
  showForMode();
  resize();
}
portrait.addEventListener('change', onRotate);
window.addEventListener('resize', onRotate);
if (isPortrait()) screens.show('rotate');
// A flip between the two landscapes never changes the portrait query, but it
// turns the tilt frame by 180°: pause and recenter on any orientation change.
let lastAngle = screenAngle();
function onScreenAngle() {
  const a = screenAngle();
  if (a === lastAngle) return;
  lastAngle = a;
  if (mode === 'flying') pause();
  if (mode === 'paused') recenter();
  showForMode();
}
if (screen.orientation) screen.orientation.addEventListener('change', onScreenAngle);
window.addEventListener('orientationchange', onScreenAngle);

// ---- service worker and updates ----
let waiting = null, registration = null;
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    registration = reg;
    const watch = (w) => {
      if (!w) return;
      if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; screens.offerUpdate(true); }
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) { waiting = w; screens.offerUpdate(true); }
      });
    };
    watch(reg.waiting);
    reg.addEventListener('updatefound', () => watch(reg.installing));
  }).catch(() => {});
  // Reload only for an update the pilot accepted: the first install also
  // takes control (clients.claim) and must not interrupt a flight.
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateAccepted) location.reload(); });
}
// The browser looks for a new sw.js only on a navigation, and a home-screen
// app resumed from the background makes none; so ask whenever the app comes
// back to the screen and whenever flying stops.
function checkForUpdate() {
  if (registration) registration.update().catch(() => {});
}
let updateAccepted = false;
function applyUpdate() {
  if (!waiting) return;
  updateAccepted = true;
  waiting.postMessage('skip-waiting');
}

// ---- HUD projection: a direction in NED → where it falls on the screen ----
const projected = new THREE.Vector3();
function projectDirection([n, e, d]) {
  const w = vectorToWorld([n, e, d]);
  projected.set(camera.position.x + w[0] * 10000, camera.position.y + w[1] * 10000, camera.position.z + w[2] * 10000).project(camera);
  const behind = projected.z > 1;
  return { x: (projected.x + 1) / 2 * view.clientWidth, y: (1 - projected.y) / 2 * view.clientHeight, visible: !behind };
}
function velocityNed(state) {
  const v = Quat.bodyToNed(quaternionOf(state), [state[IX.U], state[IX.V], state[IX.W]]);
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}
function noseNed(state) {
  return Quat.bodyToNed(quaternionOf(state), [1, 0, 0]);
}

// ---- the loop ----
const debug = document.getElementById('debug');
debug.hidden = !DEBUG;
let last = performance.now();
let frames = 0, fpsAt = last, fps = 0;
const lerped = { position: new THREE.Vector3(), quaternion: new THREE.Quaternion() };

function frame(now) {
  requestAnimationFrame(frame);
  resizeIfChanged();
  const elapsed = Math.min(0.25, (now - last) / 1000);
  last = now;

  let fraction = 1;
  if (mode === 'flying') {
    const clock = stepsFor(carry, elapsed);
    carry = clock.carry;
    fraction = clock.fraction;
    for (let i = 0; i < clock.steps; i++) {
      prevPose = pose;
      sim.step(yoke, throttleValue, DT);
      pose = poseOf(sim.state);
      if (sim.crashed || crashed(sim.state)) { crash(); break; }
    }
  }

  // Under an opaque screen (start, settings, credits, rotate, denied) none
  // of the view shows: draw once after a change, then rest. The pause and
  // crash screens are translucent, so the view keeps drawing under them.
  const opaque = screens.current !== null && screens.current !== 'pause' && screens.current !== 'crashed';
  if (opaque && !renderPending) return;
  renderPending = false;

  // render between the last two physics states
  lerped.position.lerpVectors(prevPose.position, pose.position, fraction);
  lerped.quaternion.slerpQuaternions(prevPose.quaternion, pose.quaternion, fraction);
  jet.position.copy(lerped.position);
  jet.quaternion.copy(lerped.quaternion);
  const aux = sim.aux;
  const sfc = sim.surfaces;
  jet.surfaces.set(sfc.de, sfc.da, sfc.dr, sfc.is);
  look.update(elapsed);
  chase.update(elapsed, lerped.position, lerped.quaternion, { nz: aux.nz, buffet: sim.buffetFraction, qbar: aux.qbar }, look);
  world.update(camera.position);
  renderer.render(scene, camera);

  const air = sim.airdata;
  hud.draw(air, sim.engines, projectDirection, velocityNed(sim.state), noseNed(sim.state), look.active);
  if (mode === 'flying') stickIndicator.update(yoke, Math.abs(sfc.de) >= SURFACES.de.limit - 0.01, !neutral || tilt.confidence < 0.3);

  frames++;
  if (now - fpsAt > 500) { fps = frames * 1000 / (now - fpsAt); frames = 0; fpsAt = now; }
  if (DEBUG) {
    debug.textContent = [
      `β ${tilt.beta.toFixed(1)}  γ ${tilt.gamma.toFixed(1)}  α ${tilt.alpha.toFixed(0)}  screen ${screenAngle()}°`,
      `pitch ${tilt.pitch.toFixed(1)}  roll ${tilt.roll.toFixed(1)}  conf ${tilt.confidence.toFixed(2)}  neutral ${neutral ? `${neutral.pitch.toFixed(1)}/${neutral.roll.toFixed(1)}` : '—'}`,
      `yoke ${yoke.pitch.toFixed(2)} / ${yoke.roll.toFixed(2)}  throttle ${throttleValue.toFixed(2)}`,
      `n_z ${air.nz.toFixed(2)}  α ${air.alpha.toFixed(1)}°  β ${air.beta.toFixed(1)}°  de ${sfc.de.toFixed(1)}  i_s ${sfc.is.toFixed(2)}  dr ${sfc.dr.toFixed(1)}  N1 ${sim.engines.n1.toFixed(0)}${sim.outOfEnvelope ? '  OUT' : ''}`,
      `${fps.toFixed(0)} fps  ${renderer.info.render.calls} draws  ${mode}`,
    ].join('\n');
  }
}
requestAnimationFrame(frame);

// A read-only hook for the browser smoke test and the debug overlay.
window.warwagon = {
  version: APP_VERSION,
  get mode() { return mode; },
  get sim() { return sim; },
  get yoke() { return yoke; },
  get look() { return look; },
  get surfaces() { return jet.surfaces; },
  set throttle(v) { throttleValue = v; throttle.set(v); },
  get neutral() { return neutral; },
  get draws() { return renderer.info.render.calls; },
};
