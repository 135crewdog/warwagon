// The sky, the sun and the fog: a dome that fades to the horizon colour with
// an afternoon sun, fair-weather cumulus painted on it (a texture of the sky,
// infinitely far, nothing is flown through), and fog that softens the far
// country. The ground itself is terrain.js, which takes the fog and the sun
// from here. The world is seen from far up: at FL300 the horizon is 200 nm
// away, so the far plane is 450 km and the fog runs from 40 km to 300 km;
// the earth's curvature in terrain.js puts the horizon itself where it
// belongs. Metres; world x east, y up, z south. The sky and the clouds are
// Rage's.

import * as THREE from 'three';

const HORIZON = 0xb9c7d6;
const ZENITH = 0x3f78c8;
export const FAR = 450000;
const FOG_NEAR = 40000, FOG_FAR = 300000;
// The direction to the sun: 45° up, bearing 225° (south-west), mid-afternoon.
export const SUN = new THREE.Vector3(-0.5, 0.7071, 0.5).normalize();

const skyVertex = `
  varying vec3 dir;
  void main() { dir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export const NOISE_GLSL = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) { return 0.5 * noise(p) + 0.25 * noise(p * 2.03 + 7.1) + 0.125 * noise(p * 4.11 + 3.7) + 0.0625 * noise(p * 8.07 + 1.3); }`;

const skyFragment = `
  uniform vec3 horizon, zenith, sun;
  varying vec3 dir;
  ${NOISE_GLSL}
  void main() {
    vec3 d = normalize(dir);
    float t = clamp(d.y * 2.2, 0.0, 1.0); t = t * t * (3.0 - 2.0 * t);
    vec3 sky = mix(horizon, zenith, t);
    float s = max(dot(d, sun), 0.0);
    sky += vec3(1.0, 0.95, 0.85) * (0.35 * pow(s, 24.0) + 0.25 * pow(s, 200.0));
    sky = mix(sky, vec3(1.0, 0.98, 0.92), smoothstep(0.9993, 0.9997, s));
    if (d.y > 0.0) {
      vec2 uv = d.xz / (d.y + 0.06) * 2.4;
      float n = fbm(uv);
      float cover = smoothstep(0.52, 0.68, n);
      float body = smoothstep(0.52, 0.85, n);
      vec3 colour = mix(vec3(1.0, 0.99, 0.97), vec3(0.78, 0.80, 0.84), body);
      colour += vec3(0.08, 0.06, 0.03) * s * s;
      float edge = smoothstep(0.015, 0.10, d.y);
      sky = mix(sky, colour, cover * edge);
    }
    gl_FragColor = vec4(sky, 1.0);
  }`;

export function createWorld(scene) {
  scene.background = new THREE.Color(HORIZON);
  const fog = new THREE.Fog(HORIZON, FOG_NEAR, FOG_FAR);
  scene.fog = fog;

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(FAR * 0.95, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { horizon: { value: new THREE.Color(HORIZON) }, zenith: { value: new THREE.Color(ZENITH) }, sun: { value: SUN } },
      vertexShader: skyVertex, fragmentShader: skyFragment,
    }),
  );
  scene.add(sky);

  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.copy(SUN);
  scene.add(sun, new THREE.HemisphereLight(0xdfe8f5, 0x4c5e3f, 0.9));

  return {
    fog, sun: sun.position,
    // keep the sky centred on the camera
    update(cameraPosition) { sky.position.copy(cameraPosition); },
  };
}
