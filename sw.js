// War Wagon's service worker: caches the whole app so it flies offline.
// Every app on this origin shares storage, so every cache here starts with
// "warwagon-" and only caches that start with "warwagon-" are ever deleted.
// It never calls skipWaiting() on its own; the app offers the update on the
// start or pause screen and posts "skip-waiting" when the pilot accepts.

const VERSION = '0.2.2';   // the same value as APP_VERSION in src/version.js
const CACHE = `warwagon-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './vendor/three/build/three.module.js',
  './vendor/three/build/three.core.js',
  './src/main.js',
  './src/version.js',
  './src/sim/data/aircraft.js',
  './src/sim/data/aero.js',
  './src/sim/data/engine.js',
  './src/sim/data/controls.js',
  './src/sim/table.js',
  './src/sim/atmosphere.js',
  './src/sim/aero.js',
  './src/sim/engine.js',
  './src/sim/actuators.js',
  './src/sim/quaternion.js',
  './src/sim/dynamics.js',
  './src/sim/trim.js',
  './src/sim/airdata.js',
  './src/sim/controls.js',
  './src/sim/simulation.js',
  './src/input/tilt.js',
  './src/input/look.js',
  './src/osgb.js',
  './src/places.js',
  './src/render/frames.js',
  './src/render/world.js',
  './src/render/terrain.js',
  './src/render/heightmap.js',
  './terrain/region.json',
  './terrain/base.png',
  './terrain/places.png',
  './terrain/base-colour.jpg',
  './terrain/places-colour.jpg',
  './src/render/kc135.js',
  './src/render/camera.js',
  './src/hud/hud.js',
  './src/ui/throttle.js',
  './src/ui/stick.js',
  './src/ui/screens.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k.startsWith('warwagon-') && k !== CACHE).map((k) => caches.delete(k)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

// Cache first, network as the fallback; the app is static and versioned.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then((cache) => cache.match(event.request, { ignoreSearch: true })).then((hit) => hit || fetch(event.request)),
  );
});
