import {
  BoxGeometry,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BEER, FOAM } from './palette.js';
import { clamp01, rand } from './easing.js';

const GRAVITY = 20;
const TOWER_TOP = new Vector3(0, 15, -13.5);

function mugGeometry() {
  const body = new CylinderGeometry(0.26, 0.22, 0.6, 12);
  const foam = new CylinderGeometry(0.29, 0.27, 0.16, 12);
  foam.translate(0, 0.36, 0);
  const handle = new TorusGeometry(0.17, 0.045, 6, 12, Math.PI);
  handle.rotateZ(-Math.PI / 2);
  handle.translate(0.24, 0.02, 0);
  // Groups map to [beer, foam, glass].
  return mergeGeometries([body, foam, handle], true);
}

function pretzelGeometry() {
  const ring = new TorusGeometry(0.24, 0.07, 6, 14);
  const a = new BoxGeometry(0.44, 0.08, 0.08);
  a.rotateZ(0.7);
  const b = new BoxGeometry(0.44, 0.08, 0.08);
  b.rotateZ(-0.7);
  return mergeGeometries([ring, a, b]);
}

/** A pool of falling, bouncing, fading instances. Ported from the Sept cans. */
function createPool(mesh, max, floorY) {
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  const dummy = new Object3D();
  const items = [];
  for (let i = 0; i < max; i++) {
    items.push({ mode: 'dead', p: new Vector3(), v: new Vector3(), rot: new Vector3(), w: new Vector3(), scale: 1, bounces: 0, life: 0 });
  }

  function findDead() {
    for (const c of items) if (c.mode === 'dead') return c;
    return null;
  }

  function launch(x, y, z, vx, vy, vz) {
    const c = findDead();
    if (!c) return;
    c.mode = 'fall';
    c.p.set(x, y, z);
    c.v.set(vx, vy, vz);
    c.rot.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
    c.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    c.bounces = 0;
    c.scale = 1;
    c.life = 0;
  }

  function update(dt) {
    for (let i = 0; i < max; i++) {
      const c = items[i];
      if (c.mode === 'dead') {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.0001);
      } else {
        if (c.mode === 'fall') {
          c.v.y -= GRAVITY * dt;
          c.p.addScaledVector(c.v, dt);
          c.rot.addScaledVector(c.w, dt);
          if (c.p.y < floorY && c.v.y < 0) {
            c.p.y = floorY;
            c.v.y *= -0.45;
            c.v.x *= 0.8;
            c.v.z *= 0.8;
            c.w.multiplyScalar(0.6);
            c.bounces++;
          }
          if ((c.bounces > 2 && c.v.length() < 0.8) || Math.abs(c.p.x) > 30 || c.p.z > 24 || c.p.z < -30) {
            c.mode = 'fade';
            c.life = 0;
          }
        } else {
          c.life += dt;
          c.scale = 1 - clamp01(c.life / 0.5);
          if (c.scale <= 0) {
            c.mode = 'dead';
            c.scale = 0.0001;
          }
        }
        dummy.position.copy(c.p);
        dummy.rotation.set(c.rot.x, c.rot.y, c.rot.z);
        dummy.scale.setScalar(Math.max(0.0001, c.scale));
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }

  return { launch, update };
}

/** Beer mugs and pretzels: a burst from the tower at 15:00, then a steady shower. */
export function createSteins(scene) {
  const beerMat = new MeshStandardMaterial({ color: BEER, roughness: 0.35, metalness: 0.1, emissive: BEER, emissiveIntensity: 0.15 });
  const foamMat = new MeshStandardMaterial({ color: FOAM, roughness: 0.9 });
  const glassMat = new MeshStandardMaterial({ color: 0xe8eef5, roughness: 0.3, metalness: 0.2 });
  const mugs = new InstancedMesh(mugGeometry(), [beerMat, foamMat, glassMat], 260);
  const pretzels = new InstancedMesh(pretzelGeometry(), new MeshStandardMaterial({ color: 0x9a5a1e, roughness: 0.9 }), 120);
  scene.add(mugs, pretzels);
  const mugPool = createPool(mugs, 260, 0.35);
  const pretzelPool = createPool(pretzels, 120, 0.1);

  let raining = false;
  let acc = 0;
  const RATE = 22;

  function explode(reduced) {
    const n = reduced ? 30 : 110;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(5, 13);
      const pool = i % 3 === 0 ? pretzelPool : mugPool;
      pool.launch(TOWER_TOP.x + rand(-1, 1), TOWER_TOP.y + rand(0, 2), TOWER_TOP.z, Math.cos(a) * s, rand(4, 12), Math.abs(Math.sin(a)) * s + 2);
    }
  }

  function burst(point, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(2, 6);
      mugPool.launch(point.x, 0.5, point.z, Math.cos(a) * s, rand(6, 11), Math.sin(a) * s);
    }
  }

  function setRaining(on) {
    raining = on;
  }

  function update(ctx) {
    const { dt, reduced } = ctx;
    if (raining) {
      acc += (reduced ? RATE / 3 : RATE) * dt;
      while (acc >= 1) {
        acc -= 1;
        const pool = Math.random() < 0.3 ? pretzelPool : mugPool;
        pool.launch(rand(-17, 17), rand(17, 22), rand(-14, 11), rand(-1, 1), rand(-3, -1), rand(-0.5, 0.5));
      }
    }
    mugPool.update(dt);
    pretzelPool.update(dt);
  }

  return { update, explode, burst, setRaining };
}
