import { Color, DirectionalLight, HemisphereLight, PointLight } from 'three';
import { WARM_LIGHT } from './palette.js';
import { lerp } from './easing.js';

const HEMI_RAIN = { sky: new Color(0x8a94a3), ground: new Color(0x3a3f45), i: 1.1 };
const HEMI_SUN = { sky: new Color(0xbfd9ff), ground: new Color(0x8a6a40), i: 1.4 };
const SUN_RAIN = { color: new Color(0xb4bfcc), i: 0.9 };
const SUN_SUN = { color: new Color(0xffe2a8), i: 3.2 };
const LAMP_RAIN = 9; // candela; physical falloff keeps this local
const LAMP_SUN = 0.5;

/** Hemisphere + one shadow-casting sun, plus the town's street lamps. */
export function createLights(scene, lampPositions) {
  const hemi = new HemisphereLight(HEMI_RAIN.sky, HEMI_RAIN.ground, HEMI_RAIN.i);
  scene.add(hemi);

  const sun = new DirectionalLight(SUN_RAIN.color, SUN_RAIN.i);
  sun.position.set(14, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  const lamps = lampPositions.map(([x, y, z]) => {
    const l = new PointLight(WARM_LIGHT, LAMP_RAIN, 14, 2);
    l.position.set(x, y, z);
    scene.add(l);
    return l;
  });

  function update(ctx) {
    const { weather, beat, state, reduced } = ctx;
    hemi.color.copy(HEMI_RAIN.sky).lerp(HEMI_SUN.sky, weather);
    hemi.groundColor.copy(HEMI_RAIN.ground).lerp(HEMI_SUN.ground, weather);
    hemi.intensity = lerp(HEMI_RAIN.i, HEMI_SUN.i, weather);
    sun.color.copy(SUN_RAIN.color).lerp(SUN_SUN.color, weather);
    sun.intensity = lerp(SUN_RAIN.i, SUN_SUN.i, weather);
    const pulse = state === 'party' && !reduced ? beat.pulse * 3 : 0;
    for (const l of lamps) l.intensity = lerp(LAMP_RAIN, LAMP_SUN, weather) + pulse;
  }

  return { update, sun };
}
