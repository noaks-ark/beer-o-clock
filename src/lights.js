import { Color, HemisphereLight, PointLight, SpotLight } from 'three';
import { CYAN, GOLD, MAGENTA, NEON, PURPLE } from './palette.js';
import { COUNTDOWN } from './state.js';
import { damp } from './easing.js';
import { TEXT_Y } from './text.js';

// Physically based units (r155+): PointLight intensity is candela, so the
// numbers are large and `decay` is 2.
// Kept modest on purpose: only the emissive text should cross the bloom
// threshold. Lit surfaces that do so smear into a screen-wide haze.
const ORBIT_INTENSITY = 55;
// The key light's specular lobe on the letters is the easiest thing in the
// scene to over-bloom, hence the tiny number.
const SPOT_INTENSITY = 22;
const PARTY_INTENSITY = 12;

export function createLights(scene, beat) {
  const hemi = new HemisphereLight(PURPLE, 0x000000, 0.35);
  scene.add(hemi);

  const orbitA = new PointLight(MAGENTA, ORBIT_INTENSITY, 45, 2);
  const orbitB = new PointLight(CYAN, ORBIT_INTENSITY, 45, 2);
  scene.add(orbitA, orbitB);

  const spot = new SpotLight(GOLD, SPOT_INTENSITY, 40, Math.PI / 6, 0.6, 2);
  spot.position.set(0, 9, 7);
  spot.target.position.set(0, TEXT_Y, 0);
  scene.add(spot, spot.target);

  // Party rig, off during countdown. Physical falloff makes anything within a
  // unit of a point light white-hot, so these sit where cans never go: two
  // uplights under the (unlit, shadowless) floor and two behind the camera.
  const party = [
    [-6, -2.5, -2],
    [6, -2.5, -2],
    [-9, 8, 17],
    [9, 8, 17],
  ].map(([x, y, z]) => {
    const l = new PointLight(0xffffff, 0, 40, 2);
    l.position.set(x, y, z);
    l.color.set(NEON[Math.floor(Math.random() * NEON.length)]);
    scene.add(l);
    return l;
  });

  beat.onBeat((index) => {
    // Hop colours on every beat, alternating pairs.
    const pair = index % 2;
    for (let i = 0; i < party.length; i++) {
      if (i % 2 === pair) party[i].color.set(NEON[(index + i) % NEON.length]);
    }
  });

  const hueColor = new Color();
  const magenta = new Color(MAGENTA);

  function update(ctx) {
    const { dt, t, state, reduced, hue, off } = ctx;
    const countdown = state === COUNTDOWN;

    // Orbiting pair, opposite directions, high and wide enough to stay a few
    // units clear of the text and the can ring.
    const a = (t * 2 * Math.PI) / 9;
    const r = 9.5;
    orbitA.position.set(Math.cos(a) * r, 5.5 + Math.sin(t * 0.7) * 0.6, Math.sin(a) * r * 0.5);
    orbitB.position.set(Math.cos(-a + Math.PI) * r, 5.5 + Math.cos(t * 0.5) * 0.6, Math.sin(-a + Math.PI) * r * 0.5);

    const orbitOn = off.has('orbit') ? 0 : 1;
    const spotOn = off.has('spot') ? 0 : 1;
    if (countdown) {
      orbitA.color.lerp(magenta, 1 - Math.exp(-3 * dt));
      orbitA.intensity = damp(orbitA.intensity, ORBIT_INTENSITY * orbitOn, 3, dt);
      orbitB.intensity = damp(orbitB.intensity, ORBIT_INTENSITY * orbitOn, 3, dt);
      spot.intensity = damp(spot.intensity, SPOT_INTENSITY * spotOn, 3, dt);
      hemi.intensity = damp(hemi.intensity, 0.35, 3, dt);
      for (const l of party) l.intensity = damp(l.intensity, 0, 3, dt);
    } else {
      // One orbit light follows the BEER TIME hue cycle, the other stays cyan.
      hueColor.setHSL(hue, 1, 0.55);
      orbitA.color.copy(hueColor);
      orbitA.intensity = damp(orbitA.intensity, ORBIT_INTENSITY * orbitOn, 3, dt);
      orbitB.intensity = damp(orbitB.intensity, ORBIT_INTENSITY * orbitOn, 3, dt);
      spot.intensity = damp(spot.intensity, SPOT_INTENSITY * 0.3 * spotOn, 3, dt);
      hemi.intensity = damp(hemi.intensity, 0.2, 3, dt);

      const strobe = reduced || off.has('strobe') ? 1 : beat.phase < 0.12 ? 2 : 1;
      for (let i = 0; i < party.length; i++) {
        const target = PARTY_INTENSITY * strobe * (i % 2 === 0 ? 1 : 0.7);
        party[i].intensity = off.has('party') ? 0 : reduced ? damp(party[i].intensity, PARTY_INTENSITY, 3, dt) : target;
      }
    }
  }

  return { update };
}
