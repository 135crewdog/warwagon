// The jet: a low-poly placeholder built in code from the fact sheet's
// dimensions (length 136 ft 3 in, span 130 ft 10 in, height 41 ft 8 in) and
// the geometry of docs/kc135-data.md 10.1: a lathed fuselage, wings swept 35°
// with 7° of dihedral, four engine pods on pylons, the fin, the stabiliser
// and the boom. The elevators, ailerons, spoilers, rudder and stabiliser are
// separate named parts that move every frame to the simulation's actuator
// positions. A glTF model with the same part names can replace it later
// without touching anything else.
//
// Mesh-local axes, as Rage's: nose along −z, right wing +x, up +y. Metres.

import * as THREE from 'three';

const D2R = Math.PI / 180;
export const LENGTH = 41.5;            // m, 136 ft 3 in
const HALF_SPAN = 19.95;               // m, 130 ft 10 in over two
const NOSE_Z = -LENGTH / 2;
const SKIN = new THREE.MeshLambertMaterial({ color: 0x9aa1a8 });
const DARK = new THREE.MeshLambertMaterial({ color: 0x5c6268 });

// A thin panel from a polygon in (span u, chord v) coordinates, v positive
// aft, extruded to the given thickness and laid flat: u along +x, v along
// +z, thickness along y and centred. The hinge line of a control surface is
// its v = 0 edge, so a rotation about the part's x axis is its deflection.
function panel(points, thickness, material = SKIN) {
  const shape = new THREE.Shape(points.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  g.rotateX(Math.PI / 2);                 // shape v → +z, extrusion → −y
  g.translate(0, thickness / 2, 0);
  return new THREE.Mesh(g, material);
}

// A half-wing (or half-stabiliser): root leading edge at the part's origin,
// swept and tapered, with a notch along the trailing edge where the control
// surface sits, and the control surface as a child part hinged there.
function halfWing({ halfSpan, rootChord, tipChord, sweepLE, thickness, surface, name, spoiler }) {
  const tanL = Math.tan(sweepLE * D2R);
  const le = (u) => u * tanL;
  const chord = (u) => rootChord - (rootChord - tipChord) * u / halfSpan;
  const te = (u) => le(u) + chord(u);
  const group = new THREE.Group();
  const [u0, u1] = surface.span;                        // the control surface's span, fractions of the half-span
  const a0 = u0 * halfSpan, a1 = u1 * halfSpan;
  const cut = (u) => chord(u) * surface.chord;          // the surface's chord at u
  const wing = panel([
    [0, le(0)], [halfSpan, le(halfSpan)], [halfSpan, te(halfSpan)],
    [a1, te(a1)], [a1, te(a1) - cut(a1)], [a0, te(a0) - cut(a0)], [a0, te(a0)],
    [0, te(0)],
  ], thickness);
  group.add(wing);
  // the control surface: hinge at its leading edge, its own u measured from the hinge's inboard end
  const ctrl = panel([[0, 0], [a1 - a0, 0], [a1 - a0, cut(a1)], [0, cut(a0)]], thickness * 0.6, DARK);
  const part = new THREE.Group();
  part.name = name;
  part.rotation.order = 'YXZ';          // the sweep (y) is applied after the deflection (x), so the deflection is about the swept hinge
  part.add(ctrl);
  // the hinge line is swept with the trailing edge: rotate the part's frame to lie along it
  const hingeAngle = Math.atan2(te(a1) - cut(a1) - (te(a0) - cut(a0)), a1 - a0);
  part.position.set(a0, 0, te(a0) - cut(a0));
  part.rotation.y = -hingeAngle;
  ctrl.position.z = 0;
  group.add(part);
  if (spoiler) {
    // a spoiler panel on the upper surface ahead of the surface, hinged at its front edge, rising on the down-going wing
    const [s0, s1] = spoiler.span.map((f) => f * halfSpan);
    const sp = panel([[0, 0], [s1 - s0, 0], [s1 - s0, spoiler.chord], [0, spoiler.chord]], thickness * 0.3, DARK);
    const spart = new THREE.Group();
    spart.name = spoiler.name;
    spart.rotation.order = 'YXZ';
    spart.add(sp);
    const front = (u) => te(u) - chord(u) * spoiler.at;
    spart.position.set(s0, thickness * 0.55, front(s0));
    spart.rotation.y = -Math.atan2(front(s1) - front(s0), s1 - s0);
    group.add(spart);
  }
  return group;
}

export function createAircraft() {
  const jet = new THREE.Group();
  const parts = {};

  // fuselage: a lathe of radius against station from the nose
  const profile = [[0, 0], [1.5, 0.8], [4, 1.5], [8, 1.88], [30, 1.88], [36, 1.45], [41.5, 0.55], [41.5, 0]];
  const lathe = new THREE.LatheGeometry(profile.map(([s, r]) => new THREE.Vector2(r, NOSE_Z + s)), 20);
  const fuselage = new THREE.Mesh(lathe, SKIN);
  fuselage.rotation.x = Math.PI / 2;     // the lathe's axis (y) onto −z..+z, nose at −z
  jet.add(fuselage);

  // wings: root leading edge 15 m from the nose, low on the fuselage, 7° of dihedral
  const wingSpec = {
    halfSpan: HALF_SPAN, rootChord: 8.58, tipChord: 2.84, sweepLE: 37.7, thickness: 0.7,
    surface: { span: [0.6, 0.95], chord: 0.25 }, spoiler: { span: [0.35, 0.58], chord: 1.2, at: 0.42 },
  };
  const right = halfWing({ ...wingSpec, name: 'aileronR', spoiler: { ...wingSpec.spoiler, name: 'spoilerR' } });
  right.position.set(1.2, -1.4, NOSE_Z + 15);
  right.rotation.z = 7 * D2R;
  const left = halfWing({ ...wingSpec, name: 'aileronL', spoiler: { ...wingSpec.spoiler, name: 'spoilerL' } });
  left.scale.x = -1;
  left.position.set(-1.2, -1.4, NOSE_Z + 15);
  left.rotation.z = -7 * D2R;
  jet.add(right, left);

  // engine pods on pylons, at 33 and 52 ft from the centreline (data 10.3), hung ahead of and below the wing
  for (const [u, sign] of [[10, 1], [16, 1], [10, -1], [16, -1]]) {
    const leZ = NOSE_Z + 15 + u * Math.tan(37.7 * D2R);
    const wingY = -1.4 + u * Math.tan(7 * D2R);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 4.6, 16), DARK);
    pod.rotation.x = Math.PI / 2;
    pod.position.set(sign * (1.2 + u), wingY - 1.9, leZ - 0.8);
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.6, 2.6), SKIN);
    pylon.position.set(sign * (1.2 + u), wingY - 0.9, leZ + 0.6);
    jet.add(pod, pylon);
  }

  // the fin: a panel standing up, root leading edge 31 m from the nose; the rudder its aft 30 %
  const finRootChord = 6.15, finTipChord = 2.2, finHeight = 7.5, finSweep = 40;
  const finLE = (y) => y * Math.tan(finSweep * D2R);
  const finChord = (y) => finRootChord - (finRootChord - finTipChord) * y / finHeight;
  const rudderChord = (y) => finChord(y) * 0.3;
  const finPanel = panel([
    [0, finLE(0)], [finHeight, finLE(finHeight)], [finHeight, finLE(finHeight) + finChord(finHeight) - rudderChord(finHeight)],
    [0, finRootChord - rudderChord(0)],
  ], 0.5);
  const fin = new THREE.Group();
  fin.add(finPanel);
  const rudderPanel = panel([[0, 0], [finHeight, 0], [finHeight, rudderChord(finHeight)], [0, rudderChord(0)]], 0.3, DARK);
  const rudder = new THREE.Group();
  rudder.name = 'rudder';
  rudder.rotation.order = 'YXZ';
  rudder.add(rudderPanel);
  const hingeZ0 = finRootChord - rudderChord(0), hingeZ1 = finLE(finHeight) + finChord(finHeight) - rudderChord(finHeight);
  rudder.position.set(0, 0, hingeZ0);
  rudder.rotation.y = -Math.atan2(hingeZ1 - hingeZ0, finHeight);   // the hinge leans aft with the fin
  fin.add(rudder);
  fin.rotation.z = Math.PI / 2;          // the panel's u (x) stands up as y; its v stays along z
  fin.position.set(0, 1.6, NOSE_Z + 31);
  jet.add(fin);
  parts.rudder = rudder;

  // the stabiliser: both halves on one pivot at its root quarter chord, so the trim moves the whole tail
  const stab = new THREE.Group();
  stab.name = 'stab';
  const stabSpec = { halfSpan: 6.05, rootChord: 5.28, tipChord: 2.41, sweepLE: 38, thickness: 0.4, surface: { span: [0.1, 0.95], chord: 0.3 } };
  const stabR = halfWing({ ...stabSpec, name: 'elevatorR' });
  stabR.position.set(0.9, 0, -1.32);
  stabR.rotation.z = 7 * D2R;
  const stabL = halfWing({ ...stabSpec, name: 'elevatorL' });
  stabL.scale.x = -1;
  stabL.position.set(-0.9, 0, -1.32);
  stabL.rotation.z = -7 * D2R;
  stab.add(stabR, stabL);
  stab.position.set(0, 0.4, NOSE_Z + 35.3);
  jet.add(stab);

  // the boom, stowed: pivoted under the aft fuselage below the fin, ahead of
  // the stabiliser, and trailing aft a little below the tail cone, its tip a
  // couple of metres past the tail (the first placing, from the very end of
  // the tail, looked slid back under the empennage to the owner)
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 11, 10), DARK);
  boom.name = 'boom';
  boom.geometry.translate(0, -5.5, 0);
  boom.rotation.x = -(90 - 8) * D2R;     // the shaft (local −y) swung onto +z, aft, and 8° down: the tip 1.9 m past the tail and 3.1 m below the axis, clear of the tail cone
  boom.position.set(0, -1.6, NOSE_Z + 32.5);
  jet.add(boom);

  for (const name of ['aileronR', 'aileronL', 'spoilerR', 'spoilerL', 'elevatorR', 'elevatorL']) parts[name] = jet.getObjectByName(name);
  parts.stab = stab;

  // Moves the surfaces to the simulation's positions, in degrees with the
  // signs of docs/flight-model.md 2.3: de positive trailing edge down, da
  // positive rolls left (right aileron down, left spoilers up), dr positive
  // trailing edge left, is positive leading edge up. The spoilers rise three
  // times the aileron's angle on the down-going wing only.
  jet.surfaces = {
    de: 0, da: 0, dr: 0, is: 0,
    set(de, da, dr, is) {
      this.de = de; this.da = da; this.dr = dr; this.is = is;
      parts.stab.rotation.x = is * D2R;
      parts.elevatorR.rotation.x = de * D2R;
      parts.elevatorL.rotation.x = de * D2R;
      parts.aileronR.rotation.x = da * D2R;
      parts.aileronL.rotation.x = -da * D2R;
      parts.spoilerL.rotation.x = -Math.max(0, da) * 3 * D2R;
      parts.spoilerR.rotation.x = -Math.max(0, -da) * 3 * D2R;
      parts.rudder.rotation.x = -dr * D2R;   // the fin stands its panel up, so the rudder's hinge is its own x; trailing edge left is local +y
    },
  };
  jet.parts = parts;
  return jet;
}
