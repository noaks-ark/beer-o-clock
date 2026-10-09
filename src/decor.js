import {
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BAVARIA_BLUE, GOLD, WARM_LIGHT } from './palette.js';
import { COUNTDOWN } from './state.js';
import { clamp01, elasticOut, pick, rand } from './easing.js';

const blueMat = new MeshStandardMaterial({ color: BAVARIA_BLUE, roughness: 0.9, side: DoubleSide });
const whiteMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: DoubleSide });
const ropeMat = new MeshStandardMaterial({ color: 0x3a3a3a, roughness: 1 });
const bulbMat = new MeshStandardMaterial({ color: 0xfff1c0, emissive: WARM_LIGHT, emissiveIntensity: 1.2 });
const balloonMats = [BAVARIA_BLUE, 0xffffff, GOLD, 0xd62839].map((c) => new MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.1 }));

function flagGeometry() {
  const s = new Shape();
  s.moveTo(-0.2, 0);
  s.lineTo(0.2, 0);
  s.lineTo(0, -0.5);
  s.closePath();
  return new ShapeGeometry(s);
}
const flagGeo = flagGeometry();
const bulbGeo = new SphereGeometry(0.09, 8, 6);

function bannerTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 1024, 160);
  x.fillStyle = '#1f4e9e';
  const d = 40;
  for (let row = -1; row < 6; row++) {
    for (let col = -1; col < 28; col++) {
      const cx = col * d + (row % 2 ? d / 2 : 0);
      const cy = row * d;
      x.beginPath();
      x.moveTo(cx, cy - d / 2);
      x.lineTo(cx + d / 2, cy);
      x.lineTo(cx, cy + d / 2);
      x.lineTo(cx - d / 2, cy);
      x.closePath();
      x.fill();
    }
  }
  x.fillStyle = 'rgba(255,255,255,0.93)';
  x.fillRect(90, 26, 844, 108);
  x.strokeStyle = '#1f4e9e';
  x.lineWidth = 6;
  x.strokeRect(90, 26, 844, 108);
  x.fillStyle = '#1f4e9e';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = '900 82px "Arial Black", "Helvetica Neue", Arial, sans-serif';
  x.fillText('OKTOBERFEST', 512, 82);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Bunting strung between the house fronts, festoon bulbs, a banner across the
 * front of the square and drifting balloons. Hidden until 15:00.
 */
export function createDecor(scene, ridges) {
  const root = new Group();
  root.visible = false;
  scene.add(root);

  // Side rows: ridges 0-3 are the left row, 4-7 the right row (same z order).
  const pairs = [];
  for (let i = 0; i < 4; i++) pairs.push([ridges[i], ridges[i + 4], 0]);
  for (let i = 0; i < 3; i++) {
    pairs.push([ridges[i], ridges[i + 1], Math.PI / 2]);
    pairs.push([ridges[i + 4], ridges[i + 5], Math.PI / 2]);
  }
  const blueFlags = [];
  const whiteFlags = [];
  const bulbs = [];
  for (const [a, b, yaw] of pairs) {
    const start = new Vector3(a.x, a.y, a.z);
    const end = new Vector3(b.x, b.y, b.z);
    const mid = start.clone().lerp(end, 0.5);
    mid.y = Math.min(a.y, b.y) - start.distanceTo(end) * 0.07;
    const curve = new CatmullRomCurve3([start, mid, end]);
    const rope = new Mesh(new TubeGeometry(curve, 24, 0.025, 4), ropeMat);
    root.add(rope);
    const len = curve.getLength();
    const n = Math.floor(len / 0.65);
    for (let i = 1; i < n; i++) {
      const p = curve.getPointAt(i / n);
      if (i % 3 === 0) {
        const g = bulbGeo.clone().translate(p.x, p.y - 0.12, p.z);
        bulbs.push(g);
      } else {
        const g = flagGeo.clone().rotateY(yaw).translate(p.x, p.y, p.z);
        (i % 2 ? blueFlags : whiteFlags).push(g);
      }
    }
  }
  root.add(new Mesh(mergeGeometries(blueFlags), blueMat));
  root.add(new Mesh(mergeGeometries(whiteFlags), whiteMat));
  root.add(new Mesh(mergeGeometries(bulbs), bulbMat));

  // Banner hung under the front-most line.
  const front = pairs[0]; // the line nearest the church
  const banner = new Mesh(new PlaneGeometry(12, 1.9), new MeshStandardMaterial({ map: bannerTexture(), roughness: 0.9, side: DoubleSide }));
  banner.position.set(0, Math.min(front[0].y, front[1].y) - 2.6, front[0].z);
  root.add(banner);
  for (const s of [-1, 1]) {
    const tie = new Mesh(new CylinderGeometry(0.02, 0.02, 1.2, 4), ropeMat);
    tie.position.set(s * 5.9, banner.position.y + 1.5, banner.position.z);
    root.add(tie);
  }

  // Balloons drifting up from the square.
  const balloons = [];
  const balloonGeo = new SphereGeometry(0.35, 10, 8);
  const stringGeo = new CylinderGeometry(0.01, 0.01, 1.2, 3);
  for (let i = 0; i < 18; i++) {
    const g = new Group();
    const b = new Mesh(balloonGeo, pick(balloonMats));
    b.scale.y = 1.2;
    const s = new Mesh(stringGeo, ropeMat);
    s.position.y = -1;
    g.add(b, s);
    g.position.set(rand(-10, 10), rand(1, 14), rand(-9, 9));
    g.userData.speed = rand(0.6, 1.4);
    g.userData.phase = rand(0, 6.28);
    root.add(g);
    balloons.push(g);
  }

  let shownAt = -1;
  function show(t) {
    shownAt = t;
    root.visible = true;
  }

  function update(ctx) {
    const { dt, t, state, beat, reduced } = ctx;
    if (state === COUNTDOWN) {
      root.visible = false;
      return;
    }
    root.visible = true;
    const tIn = shownAt < 0 ? 1 : t - shownAt;
    const pop = reduced ? clamp01(tIn / 0.6) : elasticOut(clamp01(tIn / 1.1));
    root.scale.set(1, Math.max(0.0001, pop), 1);
    bulbMat.emissiveIntensity = 1.0 + (reduced ? 0 : beat.pulse * 0.8);
    for (const b of balloons) {
      if (!reduced) {
        b.position.y += b.userData.speed * dt;
        b.position.x += Math.sin(t * 0.8 + b.userData.phase) * dt * 0.4;
        b.rotation.z = Math.sin(t * 1.2 + b.userData.phase) * 0.15;
      }
      if (b.position.y > 18) {
        b.position.set(rand(-10, 10), 0.5, rand(-9, 9));
      }
    }
  }

  return { show, update };
}
