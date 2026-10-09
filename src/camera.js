import { PerspectiveCamera, Vector3 } from 'three';
import { BLAST, COUNTDOWN } from './state.js';
import { clamp01, damp, easeOutCubic, lerp } from './easing.js';

const BASE_FOV = 46;
const BASE_Z = 27;
const BASE_Y = 9;
const DEG = Math.PI / 180;
const LOOK = new Vector3(0, 5, -5);
// Width of the square that must stay in frame on narrow screens.
const FIT_WIDTH = 26;

export function createCameraRig(aspect) {
  const camera = new PerspectiveCamera(BASE_FOV, aspect, 0.1, 400);
  camera.position.set(0, BASE_Y, BASE_Z);

  const target = new Vector3();
  let baseZ = BASE_Z;
  let fov = BASE_FOV;
  let shake = 0;
  let creep = 0;

  /** Portrait phones push the camera back so the square still fits. */
  function fit(aspect) {
    const halfFov = (BASE_FOV / 2) * DEG;
    const zW = (FIT_WIDTH / 2) / (Math.tan(halfFov) * aspect);
    baseZ = Math.min(48, Math.max(BASE_Z, zW));
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function update(ctx) {
    const { dt, t, state, since, beat, reduced, remaining } = ctx;

    let yaw = 0;
    let z = baseZ;
    let y = BASE_Y;
    let targetFov = BASE_FOV;
    let shakeTarget = 0;

    if (state === COUNTDOWN) {
      if (!reduced) {
        yaw = Math.sin((2 * Math.PI * t) / 40) * 7 * DEG;
        z = baseZ + 0.6 * Math.sin(t / 7);
      }
      // Creep in over the last ten seconds.
      const creepTarget = remaining < 10000 ? clamp01(1 - remaining / 10000) : 0;
      creep = damp(creep, creepTarget, 2, dt);
      z -= creep * 4;
      y -= creep * 0.8;
    } else if (state === BLAST) {
      const k = clamp01(since / 1.5);
      if (!reduced) {
        const inK = clamp01(since / 0.4);
        const outK = clamp01((since - 0.4) / 1.1);
        z = baseZ - 4 - 3 * easeOutCubic(inK) + 7 * easeOutCubic(outK);
        y = BASE_Y - 0.8 + 0.8 * easeOutCubic(outK);
        targetFov = since < 0.4 ? lerp(BASE_FOV, 60, inK) : lerp(60, BASE_FOV, outK);
        shakeTarget = 0.35 * (1 - k);
      }
    } else {
      if (!reduced) {
        targetFov = BASE_FOV + 2 * beat.pulse;
        yaw = Math.sin((2 * Math.PI * t) / 26) * 9 * DEG;
        z = baseZ + 0.4 * Math.sin(t / 4);
        shakeTarget = 0.03;
      }
    }

    shake = damp(shake, shakeTarget, 6, dt);
    fov = damp(fov, targetFov, 10, dt);
    const sx = shake * (Math.sin(t * 13.1) * 0.6 + Math.sin(t * 27.7) * 0.4);
    const sy = shake * (Math.sin(t * 17.3 + 1) * 0.6 + Math.sin(t * 31.1) * 0.4);

    camera.position.set(Math.sin(yaw) * z + LOOK.x + sx, y + sy, Math.cos(yaw) * z + LOOK.z);
    target.set(LOOK.x + sx * 0.5, LOOK.y + sy * 0.5, LOOK.z);
    camera.lookAt(target);
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  return { camera, fit, update };
}
