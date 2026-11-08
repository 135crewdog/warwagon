// The ground: the region's heightmaps drawn as a geometry clipmap, the
// standard way to put a big landscape on a small device. Nested square grids
// of the same vertex count but doubling spacing follow the camera, each
// snapped to its own grid so nothing swims, each with a hole where the finer
// one sits; the vertex shader lifts every vertex to the height read from the
// heightmaps (the same lookup heightmap.js does on the CPU) and drops it by
// the earth's curvature, d²/2R, so the island falls away to a horizon at the
// right distance; the fragment shader colours the ground from the satellite
// imagery, laid over the same base and patches and blended across their
// edges the same way, with a fine grain for close-up detail, paints the
// water the survey found, lights it by the sun and fades it into the fog. The grids are positioned relative to the
// camera, so single-precision positions stay exact 500 km from the origin.
// Rage's terrain.js, with the curvature and the water mask. Metres; world x
// east, z south, y up.

import * as THREE from 'three';
import { NOISE_GLSL } from './world.js';

const LEVELS = 11;     // 0.96 km across doubling to 983 km: the outer edge is 490 km off, past the far plane
const N = 96;          // cells per side of every level
const SPACING = 10;    // m, the finest level's cell
const EARTH_RADIUS = 6371000;

// Both shaders read the heightmaps the same way heightmap.js does: 16-bit
// posts in red and green, bilinear between them; each patch covering the
// point laid over the base in turn, coarsest first, blended in across the
// band inside its edge; and the base eased to the flat sea across the band
// inside its own. The water fraction in blue is read the same way.
function heightGlsl(patches) {
  return `
  uniform sampler2D baseMap, atlasMap;
  uniform vec4 baseGrid;          // x0, z0, post, flat
  uniform vec2 baseSize, atlasSize, baseRange, atlasRange;   // posts; min, max − min
  uniform float blend, fade;
  uniform vec4 patchRect[${patches}];   // x0, z0, side, post; coarsest first
  uniform vec4 patchPix[${patches}];    // px, py, size, blend (the patch's own band)
  // a post's height (x) and water fraction (y)
  vec2 decode(vec4 t, vec2 range) { return vec2(range.x + (t.r * 65280.0 + t.g * 255.0) / 65535.0 * range.y, t.b); }
  vec2 basePost(vec2 ij) { return decode(texture2D(baseMap, (ij + 0.5) / baseSize), baseRange); }
  vec2 atlasPost(vec2 ij) { return decode(texture2D(atlasMap, (ij + 0.5) / atlasSize), atlasRange); }
  vec2 baseAt(vec2 xz) {
    vec2 p = clamp((xz - baseGrid.xy) / baseGrid.z, vec2(0.0), baseSize - 1.0);
    vec2 i = min(floor(p), baseSize - 2.0); vec2 f = p - i;
    return mix(mix(basePost(i), basePost(i + vec2(1.0, 0.0)), f.x), mix(basePost(i + vec2(0.0, 1.0)), basePost(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec2 patchAt(vec2 xz, vec4 rect, vec4 pix) {
    vec2 p = clamp((xz - rect.xy) / rect.w, vec2(0.0), vec2(pix.z - 1.0));
    vec2 i = min(floor(p), vec2(pix.z - 2.0)); vec2 f = p - i;
    i += pix.xy;
    return mix(mix(atlasPost(i), atlasPost(i + vec2(1.0, 0.0)), f.x), mix(atlasPost(i + vec2(0.0, 1.0)), atlasPost(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float inside(vec2 xz, vec2 o, vec2 wh, float band) {
    vec2 d = min(xz - o, o + wh - xz);
    return clamp(min(d.x, d.y) / band, 0.0, 1.0);
  }
  // each patch's weight at xz: how far inside its edge band the point is
  void weigh(vec2 xz, out float w[${patches}]) {
    for (int i = 0; i < ${patches}; i++) w[i] = inside(xz, patchRect[i].xy, patchRect[i].zz, patchPix[i].w);
  }
  // the ground (height, water) at xz with the patches weighed at w (the point's own, or a neighbour's for a slope)
  vec2 groundWith(vec2 xz, float w[${patches}]) {
    vec2 g = baseAt(xz);
    for (int i = 0; i < ${patches}; i++) if (w[i] > 0.0) g += w[i] * (patchAt(xz, patchRect[i], patchPix[i]) - g);
    float outer = inside(xz, baseGrid.xy, (baseSize - 1.0) * baseGrid.z, fade);
    return vec2(baseGrid.w, 1.0) + outer * (g - vec2(baseGrid.w, 1.0));   // beyond the island: the flat sea
  }
  float heightWith(vec2 xz, float w[${patches}]) { return groundWith(xz, w).x; }
  vec2 ground(vec2 xz) { float w[${patches}]; weigh(xz, w); return groundWith(xz, w); }`;
}

// The imagery, on the same grids: the base's colour pixels sit on its posts,
// each patch's are colourScale times as many across its square. Linear
// filtering with mipmaps does the smoothing; the patches are weighed as the
// heights are, so colour and ground blend together at every edge.
function colourGlsl(patches) {
  return `
  uniform sampler2D baseColour, atlasColour;
  uniform vec2 atlasColourSize;
  uniform float colourScale;
  vec3 baseColourAt(vec2 xz) {
    vec2 p = clamp((xz - baseGrid.xy) / baseGrid.z, vec2(0.0), baseSize - 1.0);
    return texture2D(baseColour, (p + 0.5) / baseSize).rgb;
  }
  vec3 patchColourAt(vec2 xz, vec4 rect, vec4 pix) {
    float n = pix.z * colourScale;
    vec2 p = clamp((xz - rect.xy) / rect.z * (n - 1.0), vec2(0.0), vec2(n - 1.0));
    return texture2D(atlasColour, (pix.xy * colourScale + p + 0.5) / atlasColourSize).rgb;
  }
  vec3 colourWith(vec2 xz, float w[${patches}]) {
    vec3 c = baseColourAt(xz);
    for (int i = 0; i < ${patches}; i++) if (w[i] > 0.0) c = mix(c, patchColourAt(xz, patchRect[i], patchPix[i]), w[i]);
    return c;
  }`;
}

const vertexShader = (patches) => `${heightGlsl(patches)}
  uniform vec2 rel;       // the level's centre relative to the camera, so positions stay small
  uniform float spacing;
  attribute vec2 edge;    // on a level's outer edge, between two of the coarser level's posts: average them, so levels meet without cracks
  varying vec3 wp;        // world position, on the flat earth the simulation flies over
  varying vec3 rp;        // position relative to the camera, dropped by the earth's curvature
  varying float water;    // the water fraction at the vertex
  void main() {
    vec2 r = rel + position.xz * spacing;
    vec2 xz = cameraPosition.xz + r;
    vec2 g = (edge.x != 0.0 || edge.y != 0.0) ? 0.5 * (ground(xz - edge * spacing) + ground(xz + edge * spacing)) : ground(xz);
    wp = vec3(xz.x, g.x, xz.y);
    water = g.y;
    // the curvature: the ground falls away by d²/2R, 7 km at 300 km, which is what puts the horizon where it is
    rp = vec3(r.x, g.x - cameraPosition.y - dot(r, r) / (2.0 * ${EARTH_RADIUS.toFixed(1)}), r.y);
    gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(rp, 1.0);
  }`;

const fragmentShader = (patches) => `${heightGlsl(patches)}${colourGlsl(patches)}
  uniform vec3 sun, fogColor; uniform float fogNear, fogFar;
  varying vec3 wp, rp;
  varying float water;
  ${NOISE_GLSL}
  void main() {
    // the slope from the heightmaps at a fixed 60 m step, the same at every level; the point's patch weights serve all four reads
    float d = 60.0;
    float w[${patches}]; weigh(wp.xz, w);
    float hx = heightWith(wp.xz + vec2(d, 0.0), w) - heightWith(wp.xz - vec2(d, 0.0), w);
    float hz = heightWith(wp.xz + vec2(0.0, d), w) - heightWith(wp.xz - vec2(0.0, d), w);
    vec3 n = normalize(vec3(-hx, 2.0 * d, -hz));
    // the ground's colour is the imagery's, the patches blended in with the same weights as their heights,
    // with a light grain at two scales so the ground reads as moving at low level, fading before it aliases
    vec2 p = wp.xz;
    vec3 c = colourWith(wp.xz, w);
    float dist = length(rp);
    float grain = 0.6 * noise(p / 50.0) + 0.4 * noise(p / 7.0);
    c *= mix(0.9 + 0.1 * grain, 0.95, smoothstep(1500.0, 6000.0, dist));
    // lit by the sun, gently: the imagery carries the satellite's own shading, so the slopes are not shaded twice over
    float light = max(dot(n, sun), 0.0) * 0.45 + 0.72;
    c *= light;
    // the water the survey found: the sea, the lakes and the reservoirs,
    // read as a fraction of each post, so a shore is a soft line a post wide
    float wet = smoothstep(0.35, 0.65, water);
    if (wet > 0.0) {
      vec2 rip = vec2(noise(p / 9.0 + 3.0), noise(p / 9.0 + 11.0)) - 0.5;   // a faint ripple
      vec3 nw = normalize(vec3(rip.x * 0.06, 1.0, rip.y * 0.06));
      vec3 v = normalize(-rp);
      float grazing = pow(1.0 - max(dot(nw, v), 0.0), 3.0);
      vec3 deep = vec3(0.10, 0.20, 0.27);
      vec3 cw = mix(deep, fogColor, 0.2 + 0.55 * grazing);                                  // the sky in it, more at a low angle
      cw += vec3(1.0, 0.95, 0.85) * 0.7 * pow(max(dot(nw, normalize(v + sun)), 0.0), 90.0);   // the sun's glint
      c = mix(c, cw, wet);
    }
    float f = smoothstep(fogNear, fogFar, dist);
    gl_FragColor = vec4(mix(c, fogColor, f), 1.0);
  }`;

// One level's grid: (N+1)² vertices in cell units, with the edge attribute,
// and four index sets for the four places the finer level's hole can sit.
function levelGeometry(withHole) {
  const positions = [], edges = [];
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      positions.push(i - N / 2, 0, j - N / 2);
      const onX = j === 0 || j === N, onZ = i === 0 || i === N;
      edges.push(onX && i % 2 === 1 ? 1 : 0, onZ && j % 2 === 1 ? 1 : 0);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('edge', new THREE.Float32BufferAttribute(edges, 2));
  const variants = [];
  for (const dy of [0, 1]) {
    for (const dx of [0, 1]) {
      const index = [];
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          if (withHole && i >= N / 4 + dx && i < 3 * N / 4 + dx && j >= N / 4 + dy && j < 3 * N / 4 + dy) continue;
          const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
          index.push(a, c, b, b, c, d);
        }
      }
      variants.push(new THREE.Uint32BufferAttribute(index, 1));
    }
  }
  geo.setIndex(variants[0]);
  return { geo, variants };   // never frustum-culled: the levels always surround the camera
}

// The imagery: filtered, mipmapped and anisotropic, since the ground is seen at a grazing angle.
function colourTexture(image, anisotropy) {
  const texture = new THREE.Texture(image);
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = anisotropy;
  texture.flipY = false;
  texture.colorSpace = THREE.NoColorSpace;   // its values are used as they are
  texture.needsUpdate = true;
  return texture;
}

function heightTexture(image) {
  const texture = new THREE.Texture(image);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.flipY = false;                 // row 0 is the tile's north edge
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

// region: the parsed region.json; images: { base, atlas, colourBase,
// colourAtlas } the two heightmap images and the two imagery images; world:
// the world's fog and sun to match; anisotropy: what the renderer allows.
export function createTerrain(scene, region, images, world, anisotropy = 1) {
  const { base, atlas } = region;
  const patches = [...region.patches].sort((a, b) => b.post - a.post);   // coarsest first, so the finest ends on top
  const shared = {
    baseMap: { value: heightTexture(images.base) }, atlasMap: { value: heightTexture(images.atlas) },
    baseColour: { value: colourTexture(images.colourBase, anisotropy) }, atlasColour: { value: colourTexture(images.colourAtlas, anisotropy) },
    atlasColourSize: { value: new THREE.Vector2(atlas.w * region.colour.scale, atlas.h * region.colour.scale) }, colourScale: { value: region.colour.scale },
    baseGrid: { value: new THREE.Vector4(base.x0, base.z0, base.post, base.flat) },
    baseSize: { value: new THREE.Vector2(base.w, base.h) }, atlasSize: { value: new THREE.Vector2(atlas.w, atlas.h) },
    baseRange: { value: new THREE.Vector2(base.min, base.max - base.min) }, atlasRange: { value: new THREE.Vector2(atlas.min, atlas.max - atlas.min) },
    blend: { value: region.blend }, fade: { value: region.fade },
    patchRect: { value: patches.map((p) => new THREE.Vector4(p.x0, p.z0, (p.size - 1) * p.post, p.post)) },
    patchPix: { value: patches.map((p) => new THREE.Vector4(p.px, p.py, p.size, p.blend ?? region.blend)) },
    sun: { value: world.sun.clone().normalize() }, fogColor: { value: world.fog.color }, fogNear: { value: world.fog.near }, fogFar: { value: world.fog.far },
  };
  const levels = [];
  for (let l = 0; l < LEVELS; l++) {
    const { geo, variants } = levelGeometry(l > 0);
    const material = new THREE.ShaderMaterial({
      uniforms: { ...shared, rel: { value: new THREE.Vector2() }, spacing: { value: SPACING * 2 ** l } },
      vertexShader: vertexShader(patches.length), fragmentShader: fragmentShader(patches.length),
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    levels.push({ mesh, variants, spacing: SPACING * 2 ** l });
  }
  return {
    // place every level under the camera: each snaps to twice its spacing, so
    // the finer level inside it lands on its grid, one cell over or not
    update(cameraPosition) {
      let finer = null;
      for (const level of levels) {
        const step = 2 * level.spacing;
        const cx = Math.floor(cameraPosition.x / step) * step, cz = Math.floor(cameraPosition.z / step) * step;
        level.mesh.material.uniforms.rel.value.set(cx - cameraPosition.x, cz - cameraPosition.z);
        if (finer) {
          const dx = Math.round((finer.x - cx) / level.spacing), dz = Math.round((finer.z - cz) / level.spacing);
          level.mesh.geometry.setIndex(level.variants[dz * 2 + dx]);
        }
        finer = { x: cx, z: cz };
      }
    },
  };
}
