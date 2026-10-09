import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Plane, Vector3 } from 'three';
import { APRONS, COATS, DIRNDL, HATS, LEDER, PANTS, SHIRTS, SKIN, UMBRELLAS } from './palette.js';
import { clamp01, damp, lerp, pick, rand } from './easing.js';

const unit = new BoxGeometry(1, 1, 1);
const cone = new ConeGeometry(1, 1, 10);
const cyl = new CylinderGeometry(1, 1, 1, 10);
const mats = new Map();
const mat = (color) => {
  if (!mats.has(color)) mats.set(color, new MeshStandardMaterial({ color, roughness: 0.9 }));
  return mats.get(color);
};
const HAIR = [0x2a1a10, 0x5a3a1a, 0xc9a24a, 0x1a1a1a, 0x8a4a2a, 0xd9d9d9];
const SOCK = 0xf1f1f1;
const FELT = 0x3a5a2a;

function part(geo, material, sx, sy, sz, x, y, z) {
  const m = new Mesh(geo, material);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Lanes people walk along. [axis, fixed coordinate, min, max]
const LANES = [
  ['x', -10.5, -10.5, 10.5],
  ['x', -4.5, -10.5, 10.5],
  ['x', 1.5, -10.5, 10.5],
  ['x', 8, -10.5, 10.5],
  ['z', -9.5, -10, 10],
  ['z', 9.5, -10, 10],
  ['z', 0, -10, 10],
];
const STANDERS = [
  [-10.6, -2, Math.PI / 2],
  [10.6, 2, -Math.PI / 2],
  [-3.5, -11.3, 0],
  [3.5, -11.3, 0],
];

/** One blocky townsperson, with both outfits built in and toggled by dress(). */
function createFigure(female) {
  const root = new Group();
  const skin = mat(pick(SKIN));
  const coat = mat(pick(COATS));
  const pants = mat(pick(PANTS));
  const hair = mat(pick(HAIR));
  const beanie = mat(pick(HATS));
  const dirndl = mat(pick(DIRNDL));
  const apron = mat(pick(APRONS));
  const leder = mat(pick(LEDER));
  const shirt = mat(pick(SHIRTS));
  const sock = mat(SOCK);
  const felt = mat(FELT);
  const white = mat(0xffffff);

  const scale = rand(0.9, 1.1);
  root.scale.setScalar(scale);

  // Legs hang from the hips; each is an upper and a lower block.
  const hips = new Group();
  hips.position.y = 0.78;
  root.add(hips);
  const legs = [-1, 1].map((side) => {
    const g = new Group();
    g.position.x = side * 0.15;
    const upper = part(unit, pants, 0.23, 0.4, 0.25, 0, -0.2, 0);
    const lower = part(unit, pants, 0.2, 0.38, 0.22, 0, -0.59, 0);
    g.add(upper, lower);
    hips.add(g);
    return { g, upper, lower };
  });
  // Skirt for the dirndl, covers the upper legs.
  const skirt = part(unit, dirndl, 0.8, 0.5, 0.52, 0, 0.5, 0);
  root.add(skirt);

  const torso = part(unit, coat, 0.62, 0.72, 0.36, 0, 1.14, 0);
  root.add(torso);
  const apronMesh = part(unit, apron, 0.5, 0.72, 0.04, 0, 0.72, 0.26);
  root.add(apronMesh);
  const suspenders = [-1, 1].map((s) => part(unit, felt, 0.09, 0.66, 0.02, s * 0.17, 1.16, 0.19));
  root.add(...suspenders);

  const head = part(unit, skin, 0.44, 0.44, 0.44, 0, 1.72, 0);
  root.add(head);
  const hairTop = part(unit, hair, 0.47, 0.14, 0.47, 0, 1.98, 0);
  root.add(hairTop);
  const braids = [-1, 1].map((s) => part(unit, hair, 0.1, 0.5, 0.1, s * 0.27, 1.62, -0.08));
  root.add(...braids);
  const beanieMesh = part(unit, beanie, 0.49, 0.2, 0.49, 0, 2.02, 0);
  root.add(beanieMesh);
  // Alpine hat: brim, crown, feather.
  const hat = new Group();
  hat.position.y = 1.96;
  hat.add(part(cyl, felt, 0.38, 0.05, 0.38, 0, 0, 0));
  hat.add(part(unit, felt, 0.42, 0.26, 0.42, 0, 0.15, 0));
  hat.add(part(unit, mat(0xd62839), 0.04, 0.34, 0.04, 0.2, 0.3, 0.1));
  root.add(hat);

  const arms = [-1, 1].map((side) => {
    const g = new Group();
    g.position.set(side * 0.41, 1.44, 0);
    const sleeve = part(unit, coat, 0.18, 0.66, 0.2, 0, -0.33, 0);
    const hand = part(unit, skin, 0.16, 0.16, 0.16, 0, -0.72, 0);
    g.add(sleeve, hand);
    root.add(g);
    return { g, sleeve, hand };
  });

  // Umbrella, held up in the right hand.
  const umbrella = new Group();
  umbrella.position.set(0.41, 1.44, 0.1);
  umbrella.add(part(cyl, mat(0x2a2a2a), 0.025, 1.2, 0.025, 0, 0.5, 0));
  const canopy = part(cone, mat(pick(UMBRELLAS)), 1.0, 0.36, 1.0, 0, 1.08, 0);
  umbrella.add(canopy);
  umbrella.add(part(cyl, mat(0x2a2a2a), 0.02, 0.15, 0.02, 0, 1.3, 0));
  root.add(umbrella);
  const hasUmbrella = Math.random() < 0.75;

  // Beer mug in the right hand for the party.
  const mug = new Group();
  mug.position.set(0, -0.8, 0.1);
  mug.add(part(cyl, mat(0xf2a71b), 0.14, 0.3, 0.14, 0, 0, 0));
  mug.add(part(cyl, white, 0.16, 0.08, 0.16, 0, 0.17, 0));
  mug.add(part(unit, mat(0xe8eef5), 0.05, 0.2, 0.05, 0.17, 0, 0));
  arms[1].g.add(mug);

  function dress(party) {
    const l = female ? dirndl : leder;
    for (const leg of legs) {
      leg.upper.material = party ? l : pants;
      leg.lower.material = party ? sock : pants;
    }
    torso.material = party ? (female ? dirndl : shirt) : coat;
    for (const a of arms) a.sleeve.material = party ? (female ? white : shirt) : coat;
    skirt.visible = party && female;
    apronMesh.visible = party && female;
    for (const s of suspenders) s.visible = party && !female;
    for (const b of braids) b.visible = party && female;
    beanieMesh.visible = !party;
    hat.visible = party && !female;
    umbrella.visible = !party && hasUmbrella;
    mug.visible = party;
  }
  dress(false);

  const fig = {
    root,
    female,
    legs,
    arms,
    hips,
    umbrella,
    hasUmbrella,
    mode: 'walk',
    lane: null,
    dir: 1,
    speed: rand(0.9, 1.6),
    phase: rand(0, 6.28),
    pause: 0,
    yaw: 0,
    yawTarget: 0,
    target: new Vector3(),
    jumpOffset: Math.random(),
    jumpH: rand(0.45, 0.95),
    spin: Math.random() < 0.25 ? rand(-3, 3) : 0,
    hopT: 1,
    hop() {
      fig.hopT = 0;
    },
    dress,
  };
  root.userData.figure = fig;
  return fig;
}

export function createPeople(scene, count) {
  const group = new Group();
  scene.add(group);
  const figures = [];
  const pickables = [];
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const scratch = new Vector3();
  let party = false;

  function placeOnLane(fig) {
    const lane = pick(LANES);
    fig.lane = lane;
    fig.dir = Math.random() < 0.5 ? -1 : 1;
    const along = rand(lane[2], lane[3]);
    if (lane[0] === 'x') fig.root.position.set(along, 0, lane[1] + rand(-0.4, 0.4));
    else fig.root.position.set(lane[1] + rand(-0.4, 0.4), 0, along);
    fig.yaw = fig.yawTarget = lane[0] === 'x' ? (fig.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : fig.dir > 0 ? 0 : Math.PI;
    fig.root.rotation.y = fig.yaw;
  }

  function add(fig) {
    figures.push(fig);
    pickables.push(fig.root);
    group.add(fig.root);
    return fig;
  }

  for (let i = 0; i < count; i++) {
    const fig = add(createFigure(Math.random() < 0.5));
    if (i < STANDERS.length) {
      const [x, z, yaw] = STANDERS[i];
      fig.mode = 'stand';
      fig.root.position.set(x, 0, z);
      fig.yaw = fig.yawTarget = yaw;
      fig.root.rotation.y = yaw;
    } else {
      placeOnLane(fig);
    }
  }

  function squareTarget(v) {
    return v.set(rand(-8, 8), 0, rand(-8, 7));
  }

  /** 15:00: umbrellas down, outfits on, everyone rushes to the square and jumps. */
  function startParty(t) {
    party = true;
    for (const fig of figures) {
      fig.dress(true);
      fig.mode = 'rush';
      squareTarget(fig.target);
      fig.speed = rand(2.6, 3.6);
    }
    // Reinforcements stream in from the edges.
    for (let i = 0; i < 12; i++) {
      const fig = add(createFigure(Math.random() < 0.5));
      fig.dress(true);
      fig.mode = 'rush';
      fig.speed = rand(2.6, 3.6);
      const edge = Math.random();
      if (edge < 0.4) fig.root.position.set(-13, 0, rand(-9, 9));
      else if (edge < 0.8) fig.root.position.set(13, 0, rand(-9, 9));
      else fig.root.position.set(rand(-9, 9), 0, 15);
      squareTarget(fig.target);
    }
  }

  function figureOf(object) {
    let o = object;
    while (o) {
      if (o.userData.figure) return o.userData.figure;
      o = o.parent;
    }
    return null;
  }

  const dir = new Vector3();
  function update(ctx) {
    const { dt, t, beat, reduced } = ctx;
    for (const fig of figures) {
      const r = fig.root;
      const [legL, legR] = fig.legs;
      const [armL, armR] = fig.arms;
      let y = 0;

      if (fig.mode === 'walk' || fig.mode === 'rush') {
        let moving = true;
        if (fig.mode === 'walk') {
          if (fig.pause > 0) {
            fig.pause -= dt;
            moving = false;
          } else {
            const lane = fig.lane;
            const axis = lane[0] === 'x' ? 'x' : 'z';
            r.position[axis] += fig.dir * fig.speed * dt * (reduced ? 0.6 : 1);
            if (r.position[axis] > lane[3] || r.position[axis] < lane[2]) {
              r.position[axis] = Math.min(lane[3], Math.max(lane[2], r.position[axis]));
              fig.dir *= -1;
              fig.pause = rand(0.4, 1.6);
              fig.yawTarget = lane[0] === 'x' ? (fig.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : fig.dir > 0 ? 0 : Math.PI;
            }
          }
        } else {
          dir.subVectors(fig.target, r.position);
          dir.y = 0;
          const d = dir.length();
          if (d < 0.3) {
            fig.mode = 'jump';
            fig.yawTarget = rand(-0.6, 0.6); // roughly face the camera
          } else {
            dir.normalize();
            r.position.addScaledVector(dir, Math.min(d, fig.speed * dt));
            fig.yawTarget = Math.atan2(dir.x, dir.z);
          }
        }
        if (moving) fig.phase += dt * fig.speed * 5.5;
        const s = moving ? Math.sin(fig.phase) : 0;
        legL.g.rotation.x = s * 0.55;
        legR.g.rotation.x = -s * 0.55;
        armL.g.rotation.x = -s * 0.45;
        armL.g.rotation.z = 0.1;
        armR.g.rotation.z = -0.1;
        armR.g.rotation.x = !party && fig.hasUmbrella ? -2.7 : s * 0.45;
        y = moving ? Math.abs(s) * 0.05 : 0;
      } else if (fig.mode === 'stand') {
        const sway = Math.sin(t * 0.7 + fig.phase) * 0.12;
        fig.yawTarget = fig.yaw + sway;
        legL.g.rotation.x = legR.g.rotation.x = 0;
        armL.g.rotation.x = Math.sin(t * 1.3 + fig.phase) * 0.15;
        armL.g.rotation.z = 0.15;
        armR.g.rotation.z = -0.1;
        armR.g.rotation.x = fig.hasUmbrella ? -2.7 : Math.sin(t * 1.1 + fig.phase) * 0.15;
      } else {
        // jump: one hop per beat, offset per person so the crowd ripples.
        const p = (beat.phase + fig.jumpOffset) % 1;
        const air = reduced ? 0 : Math.max(0, Math.sin(p * Math.PI * 2));
        y = air * fig.jumpH;
        const k = air;
        legL.g.rotation.x = -0.7 * k;
        legR.g.rotation.x = -0.7 * k + 0.2 * Math.sin(t * 9 + fig.phase);
        armL.g.rotation.z = 2.4 + Math.sin(t * 6 + fig.phase) * 0.3;
        armL.g.rotation.x = 0;
        armR.g.rotation.x = -2.3 + Math.sin(t * 7 + fig.phase) * 0.25;
        armR.g.rotation.z = -0.5;
        if (fig.spin && !reduced) fig.yawTarget += fig.spin * dt;
        else fig.yawTarget += Math.sin(t * 2 + fig.phase) * 0.01;
        if (reduced) y = Math.abs(Math.sin(t * 3 + fig.phase)) * 0.08;
      }

      // One-off hop when clicked.
      if (fig.hopT < 1) {
        fig.hopT = Math.min(1, fig.hopT + dt / 0.45);
        y += Math.sin(fig.hopT * Math.PI) * 0.7;
      }

      fig.yaw = damp(fig.yaw, fig.yawTarget, 8, dt);
      r.rotation.y = fig.yaw;
      r.position.y = y;
    }
  }

  return { update, startParty, pickables, figureOf, groundPlane, scratch };
}
