import { PerspectiveCamera, Vector3 } from 'three';
import { BLAST, COUNTDOWN } from './state.js';
import { clamp01, damp, easeOutCubic, lerp } from './easing.js';
import { TEXT_Y } from './text.js';

const BASE_FOV = 45;
const MIN_Z = 14;
const DEG = Math.PI / 180;

export function createCameraRig(aspect) {
  const camera = new PerspectiveCamera(BASE_FOV, aspect, 0.1, 200);
  camera.position.set(0, 3.4, MIN_Z);

  const lookAt = new Vector3(0, TEXT_Y, 0);
  const target = new Vector3();
  const shakeVec = new Vector3();
  let baseZ = MIN_Z;
  let fov = BASE_FOV;
  let shake = 0;

  /**
   * Push the camera back until the widest thing on stage fits the viewport,
   * with a margin. Portrait phones need this; landscape rarely does.
   */
  function fit(aspect, width, height) {
    const halfFov = (BASE_FOV / 2) * DEG;
    const margin = 1.25;
    const zW = ((width / 2) * margin) / (Math.tan(halfFov) * aspect);
    const zH = ((height / 2) * margin + 1.5) / Math.tan(halfFov);
    baseZ = Math.max(MIN_Z, zW, zH);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function update(ctx) {
    const { dt, t, state, since, beat, reduced } = ctx;

    let yaw = 0;
    let z = baseZ;
    let targetFov = BASE_FOV;
    let shakeTarget = 0;

    if (state === COUNTDOWN) {
      if (!reduced) {
        yaw = Math.sin((2 * Math.PI * t) / 20) * 6 * DEG;
        z = baseZ + 0.6 * Math.sin(t / 5);
      }
    } else if (state === BLAST) {
      const k = clamp01(since / 1.5);
      if (!reduced) {
        // Dolly in fast, then ease back out.
        const inK = clamp01(since / 0.45);
        const outK = clamp01((since - 0.45) / 1.05);
        z = baseZ - 3 * easeOutCubic(inK) + 3 * easeOutCubic(outK);
        targetFov = since < 0.45 ? lerp(BASE_FOV, 62, inK) : lerp(62, 50, outK);
        shakeTarget = 0.25 * (1 - k);
      }
    } else {
      if (!reduced) {
        targetFov = 50 + 4 * beat.pulse;
        shakeTarget = 0.06;
        yaw = Math.sin((2 * Math.PI * t) / 11) * 4 * DEG;
      }
    }

    shake = damp(shake, shakeTarget, 6, dt);
    fov = damp(fov, targetFov, 10, dt);

    const sx = shake * (Math.sin(t * 13.1) * 0.6 + Math.sin(t * 27.7) * 0.4);
    const sy = shake * (Math.sin(t * 17.3 + 1) * 0.6 + Math.sin(t * 31.1) * 0.4);

    camera.position.set(Math.sin(yaw) * z + sx, 3.4 + sy, Math.cos(yaw) * z);
    target.copy(lookAt).add(shakeVec.set(sx * 0.5, sy * 0.5, 0));
    camera.lookAt(target);

    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  return { camera, fit, update };
}
