import { BackSide, Color, Fog, Group, Mesh, MeshStandardMaterial, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { FOG_RAIN, FOG_SUN, SKY_RAIN, SKY_SUN } from './palette.js';
import { rand } from './easing.js';

const CLOUD_RAIN = new Color(0x7d8690);
const CLOUD_SUN = new Color(0xffffff);

/**
 * Sky dome, fog, sun disc and a handful of low-poly clouds. `update(ctx)`
 * blends everything between the rain and sun palettes on ctx.weather (0..1).
 */
export function createSky(scene) {
  const uniforms = {
    top: { value: new Color(SKY_RAIN.top) },
    horizon: { value: new Color(SKY_RAIN.horizon) },
  };
  const dome = new Mesh(
    new SphereGeometry(140, 24, 12),
    new ShaderMaterial({
      uniforms,
      side: BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; varying vec3 vPos;
        void main() {
          float h = clamp(normalize(vPos).y, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizon, top, pow(h, 0.6)), 1.0);
        }`,
    }),
  );
  dome.frustumCulled = false;
  scene.add(dome);

  scene.fog = new Fog(FOG_RAIN, 30, 170);
  const fogRain = new Color(FOG_RAIN);
  const fogSun = new Color(FOG_SUN);
  const skyRainTop = new Color(SKY_RAIN.top);
  const skyRainHor = new Color(SKY_RAIN.horizon);
  const skySunTop = new Color(SKY_SUN.top);
  const skySunHor = new Color(SKY_SUN.horizon);

  // Sun disc, only visible once the clouds clear.
  const sunMat = new MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xfff1c0, emissiveIntensity: 1.6, fog: false });
  const sun = new Mesh(new SphereGeometry(5, 16, 12), sunMat);
  sun.position.set(45, 55, -90);
  sun.visible = false;
  scene.add(sun);

  // Clouds: three squashed spheres per cloud, drifting slowly.
  const cloudMat = new MeshStandardMaterial({ color: CLOUD_RAIN.clone(), roughness: 1, flatShading: true });
  const clouds = new Group();
  const puff = new SphereGeometry(1, 7, 5);
  const list = [];
  for (let i = 0; i < 11; i++) {
    const g = new Group();
    const n = 3 + Math.floor(rand(0, 3));
    for (let j = 0; j < n; j++) {
      const m = new Mesh(puff, cloudMat);
      const s = rand(2.2, 4.2);
      m.scale.set(s * rand(1.2, 1.8), s * 0.7, s);
      m.position.set(j * rand(2, 3.4) - n, rand(-0.4, 0.6), rand(-1, 1));
      g.add(m);
    }
    g.position.set(rand(-70, 70), rand(22, 38), rand(-80, -30));
    g.userData.speed = rand(0.4, 1.1);
    g.userData.baseY = g.position.y;
    clouds.add(g);
    list.push(g);
  }
  scene.add(clouds);

  const tmp = new Color();
  function update(ctx) {
    const { dt, t, weather, reduced } = ctx;
    uniforms.top.value.copy(skyRainTop).lerp(skySunTop, weather);
    uniforms.horizon.value.copy(skyRainHor).lerp(skySunHor, weather);
    scene.fog.color.copy(fogRain).lerp(fogSun, weather);
    scene.fog.near = 30 + weather * 40;
    scene.fog.far = 170 + weather * 120;
    cloudMat.color.copy(CLOUD_RAIN).lerp(CLOUD_SUN, weather);
    sun.visible = weather > 0.2;
    sunMat.emissiveIntensity = 1.6 * weather;
    for (const c of list) {
      if (!reduced) c.position.x += c.userData.speed * dt * (1 + weather * 2);
      if (c.position.x > 90) c.position.x = -90;
      // Clouds lift and spread as the weather clears.
      c.position.y = c.userData.baseY + weather * 12;
    }
  }

  return { update };
}
