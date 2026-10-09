import { BoxGeometry, Color, DynamicDrawUsage, InstancedMesh, MeshBasicMaterial, Object3D, RingGeometry } from 'three';
import { BEER, FOAM } from './palette.js';
import { lerp, rand } from './easing.js';

const WATER = new Color(0xc5d3e0);
const BEER_C = new Color(0xe08a12);
const SPLASH_WATER = new Color(0xdfe9f2);
const SPLASH_FOAM = new Color(FOAM);
const AREA = { x: 28, zMin: -26, zMax: 10, top: 30 };
const SQUARE = { x: 13, zMin: -12, zMax: 12 };
const SPLASHES = 160;
const SPLASH_LIFE = 0.35;

/**
 * Instanced rain. Thin stretched boxes with a little wind, recycled at the
 * ground; drops that land on the square leave a short-lived splash ring.
 * `ctx.weather` blends the whole thing from water to beer.
 */
export function createRain(scene, count) {
  const dropMat = new MeshBasicMaterial({ color: WATER.clone(), transparent: true, opacity: 0.35, depthWrite: false });
  const mesh = new InstancedMesh(new BoxGeometry(0.03, 0.6, 0.03), dropMat, count);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const splashMat = new MeshBasicMaterial({ color: SPLASH_WATER.clone(), transparent: true, opacity: 0.35, depthWrite: false });
  const splashes = new InstancedMesh(new RingGeometry(0.05, 0.1, 10), splashMat, SPLASHES);
  splashes.instanceMatrix.setUsage(DynamicDrawUsage);
  splashes.frustumCulled = false;
  scene.add(splashes);

  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const vy = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    px[i] = rand(-AREA.x, AREA.x);
    py[i] = rand(0, AREA.top);
    pz[i] = rand(AREA.zMin, AREA.zMax);
    vy[i] = rand(13, 17);
  }
  const sx = new Float32Array(SPLASHES);
  const sz = new Float32Array(SPLASHES);
  const sl = new Float32Array(SPLASHES).fill(-1); // life, <0 = free
  let nextSplash = 0;

  const dummy = new Object3D();
  const tilt = 0.06;

  function update(ctx) {
    const { dt, t, weather, reduced } = ctx;
    const wind = 1.4 + Math.sin(t * 0.3) * 0.6;
    dropMat.color.copy(WATER).lerp(BEER_C, weather);
    dropMat.opacity = lerp(0.35, 0.85, weather);
    splashMat.color.copy(SPLASH_WATER).lerp(SPLASH_FOAM, weather);
    const thick = lerp(1, 2.0, weather);
    const speed = reduced ? 0.5 : 1;

    dummy.rotation.set(0, 0, -tilt * wind);
    dummy.scale.set(thick, lerp(1, 1.3, weather), thick);
    for (let i = 0; i < count; i++) {
      py[i] -= vy[i] * dt * speed;
      px[i] += wind * dt * speed;
      if (py[i] < 0) {
        if (Math.abs(px[i]) < SQUARE.x && pz[i] > SQUARE.zMin && pz[i] < SQUARE.zMax && Math.random() < 0.35) {
          sx[nextSplash] = px[i];
          sz[nextSplash] = pz[i];
          sl[nextSplash] = 0;
          nextSplash = (nextSplash + 1) % SPLASHES;
        }
        py[i] = AREA.top + rand(0, 4);
        px[i] = rand(-AREA.x, AREA.x);
        pz[i] = rand(AREA.zMin, AREA.zMax);
      }
      if (px[i] > AREA.x) px[i] -= AREA.x * 2;
      dummy.position.set(px[i], py[i], pz[i]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    dummy.rotation.set(-Math.PI / 2, 0, 0);
    for (let i = 0; i < SPLASHES; i++) {
      if (sl[i] < 0) {
        dummy.scale.setScalar(0.0001);
        dummy.position.set(0, -5, 0);
      } else {
        sl[i] += dt;
        const k = sl[i] / SPLASH_LIFE;
        if (k >= 1) sl[i] = -1;
        const s = (0.5 + k * 2.2) * lerp(1, 1.5, weather);
        dummy.scale.set(s, s, 1);
        dummy.position.set(sx[i], 0.02, sz[i]);
      }
      dummy.updateMatrix();
      splashes.setMatrixAt(i, dummy.matrix);
    }
    splashes.instanceMatrix.needsUpdate = true;
  }

  return { mesh, update };
}
