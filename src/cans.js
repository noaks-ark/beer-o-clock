import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NEON } from './palette.js';
import { COUNTDOWN } from './state.js';
import { clamp01, pick, rand } from './easing.js';
import { TEXT_Y } from './text.js';

const MAX = 320;
const IDLE_COUNT = 20;
const RAIN_PER_SEC = 40;
const GRAVITY = 20;
const FLOOR_Y = 0.45; // approximate contact height for a tumbling can
const RADIUS = 0.33;
const HEIGHT = 1.15;

function buildGeometry() {
  const side = new CylinderGeometry(RADIUS, RADIUS, HEIGHT - 0.1, 28, 1, true);
  const top = new CylinderGeometry(RADIUS * 0.88, RADIUS, 0.08, 28);
  top.translate(0, HEIGHT / 2 - 0.05, 0);
  const bottom = new CylinderGeometry(RADIUS, RADIUS * 0.88, 0.08, 28);
  bottom.translate(0, -(HEIGHT / 2 - 0.05), 0);
  const rim = new TorusGeometry(RADIUS * 0.9, 0.025, 8, 28);
  rim.rotateX(Math.PI / 2);
  rim.translate(0, HEIGHT / 2 - 0.01, 0);
  const tab = new BoxGeometry(0.14, 0.015, 0.07);
  tab.translate(0.03, HEIGHT / 2 + 0.005, 0);
  // Groups map to the material array: [label, silver, silver, silver, silver]
  return mergeGeometries([side, top, bottom, rim, tab], true);
}

function buildLabelTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffd166';
  ctx.fillRect(0, 0, 1024, 512);

  // Brown bands top and bottom, a thin liquid stripe under each.
  ctx.fillStyle = '#7a3b00';
  ctx.fillRect(0, 0, 1024, 44);
  ctx.fillRect(0, 468, 1024, 44);
  ctx.fillStyle = '#f7931e';
  ctx.fillRect(0, 44, 1024, 10);
  ctx.fillRect(0, 458, 1024, 10);

  // Bubbles.
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(rand(0, 1024), rand(70, 440), rand(4, 14), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#7a3b00';
  ctx.font = '900 250px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('ÖL', 512, 250);

  ctx.font = '900 64px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText("BEER O'CLOCK", 512, 405);
  ctx.font = '700 46px "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('15:00', 512, 118);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

export function createCans(renderer) {
  const geometry = buildGeometry();
  const labelMat = new MeshStandardMaterial({
    map: buildLabelTexture(renderer),
    metalness: 0.2,
    roughness: 0.55,
  });
  const silverMat = new MeshStandardMaterial({ color: 0xd9d9e3, metalness: 0.9, roughness: 0.5 });
  const mesh = new InstancedMesh(geometry, [labelMat, silverMat, silverMat, silverMat, silverMat], MAX);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  mesh.frustumCulled = false;

  const white = new Color(0xffffff);
  for (let i = 0; i < MAX; i++) mesh.setColorAt(i, white);
  mesh.instanceColor.needsUpdate = true;

  const dummy = new Object3D();
  const scratch = new Vector3();
  const tint = new Color();

  const cans = [];
  for (let i = 0; i < MAX; i++) {
    cans.push({
      index: i,
      mode: 'dead',
      p: new Vector3(),
      v: new Vector3(),
      rot: new Vector3(rand(0, Math.PI * 2), rand(0, Math.PI * 2), rand(0, Math.PI * 2)),
      w: new Vector3(),
      scale: 1,
      bounces: 0,
      life: 0,
      // idle ring parameters
      angle: 0,
      rx: 0,
      rz: 0,
      phase: 0,
    });
  }

  // Idle ring: an ellipse around the text, behind and below the numerals so
  // cans never hide them from the camera.
  function placeIdle(c, t, spinning) {
    const a = c.angle + (spinning ? (t * 2 * Math.PI) / 60 : 0);
    c.p.set(Math.cos(a) * c.rx, 1.1 + Math.sin(t * 0.6 + c.phase) * 0.45, Math.sin(a) * c.rz - 3.5);
  }
  for (let i = 0; i < IDLE_COUNT; i++) {
    const c = cans[i];
    c.mode = 'idle';
    c.angle = (i / IDLE_COUNT) * Math.PI * 2;
    c.rx = rand(7.5, 10.5);
    c.rz = rand(2, 3);
    c.phase = rand(0, Math.PI * 2);
    c.w.set(rand(-0.6, 0.6), rand(0.3, 1.2), rand(-0.4, 0.4));
    placeIdle(c, 0, false); // explode() may run before the first frame (?party=1)
  }

  let raining = false;
  let spawnAcc = 0;

  function findDead() {
    for (let i = 0; i < MAX; i++) if (cans[i].mode === 'dead') return cans[i];
    return null;
  }

  function neonTint(index) {
    tint.set(pick(NEON));
    mesh.setColorAt(index, tint);
    mesh.instanceColor.needsUpdate = true;
  }

  function launch(c, x, y, z, vx, vy, vz) {
    c.mode = 'fall';
    c.p.set(x, y, z);
    c.v.set(vx, vy, vz);
    c.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    c.bounces = 0;
    c.scale = 1;
    c.life = 0;
    neonTint(c.index);
  }

  /** The moment of 15:00: idle cans fly outward, a burst erupts from the text. */
  function explode(reduced) {
    for (const c of cans) {
      if (c.mode !== 'idle') continue;
      scratch.copy(c.p).setY(0).normalize();
      launch(c, c.p.x, c.p.y, c.p.z, scratch.x * rand(6, 12), rand(6, 12), scratch.z * rand(6, 12));
    }
    if (reduced) return;
    for (let i = 0; i < 120; i++) {
      const c = findDead();
      if (!c) break;
      scratch.set(rand(-1, 1), rand(-0.2, 1), rand(-1, 1)).normalize().multiplyScalar(rand(8, 16));
      launch(c, rand(-0.5, 0.5), TEXT_Y + rand(-0.5, 0.5), 0, scratch.x, scratch.y + 5, scratch.z);
    }
  }

  function setRaining(on) {
    raining = on;
  }

  function update(ctx) {
    const { dt, t, state, reduced } = ctx;

    if (raining) {
      spawnAcc += (reduced ? RAIN_PER_SEC / 3 : RAIN_PER_SEC) * dt;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const c = findDead();
        if (!c) break;
        launch(c, rand(-12, 12), rand(12, 15), rand(-6, 4), rand(-1, 1), rand(-3, -1), rand(-0.5, 0.5));
      }
    }

    for (let i = 0; i < MAX; i++) {
      const c = cans[i];
      if (c.mode === 'dead') {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.0001);
        dummy.rotation.set(0, 0, 0);
      } else if (c.mode === 'idle') {
        placeIdle(c, t, state === COUNTDOWN && !reduced);
        if (!reduced) c.rot.addScaledVector(c.w, dt);
        dummy.position.copy(c.p);
        dummy.rotation.set(c.rot.x, c.rot.y, c.rot.z);
        dummy.scale.setScalar(1);
      } else {
        // falling / bouncing
        c.v.y -= GRAVITY * dt;
        c.p.addScaledVector(c.v, dt);
        c.rot.addScaledVector(c.w, dt);
        if (c.p.y < FLOOR_Y && c.v.y < 0) {
          c.p.y = FLOOR_Y;
          c.v.y *= -0.45;
          c.v.x *= 0.8;
          c.v.z *= 0.8;
          c.w.multiplyScalar(0.7);
          c.bounces++;
        }
        const speed = c.v.length();
        if ((c.bounces > 3 && speed < 0.8) || Math.abs(c.p.x) > 18 || c.p.z > 13 || c.p.z < -20) {
          c.mode = 'fade';
          c.life = 0;
        }
        dummy.position.copy(c.p);
        dummy.rotation.set(c.rot.x, c.rot.y, c.rot.z);
        dummy.scale.setScalar(c.scale);
      }

      if (c.mode === 'fade') {
        c.life += dt;
        c.scale = 1 - clamp01(c.life / 0.4);
        if (c.scale <= 0) {
          c.mode = 'dead';
          c.scale = 0.0001;
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

  return { mesh, update, explode, setRaining };
}
