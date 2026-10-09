import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FACADES, ROOFS, WOOD, WARM_LIGHT } from './palette.js';
import { lerp, pick, rand } from './easing.js';
import { createClock } from './clock.js';

const FLOOR_H = 2.5;

// ---------- shared materials ----------
const beamMat = new MeshStandardMaterial({ color: WOOD, roughness: 0.95 });
const frameMat = new MeshStandardMaterial({ color: 0x2a2420, roughness: 0.9 });
const doorMat = new MeshStandardMaterial({ color: 0x3a2314, roughness: 0.9 });
const windowMat = new MeshStandardMaterial({ color: 0x8aa0b8, emissive: WARM_LIGHT, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.2 });
const lanternMat = new MeshStandardMaterial({ color: 0xffe9c0, emissive: WARM_LIGHT, emissiveIntensity: 1.4, roughness: 0.6 });
const stoneMat = new MeshStandardMaterial({ color: 0x9a948c, roughness: 0.95 });
const copperMat = new MeshStandardMaterial({ color: 0x3f7a6a, roughness: 0.8 });
const trunkMat = new MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
const leafMat = new MeshStandardMaterial({ color: 0x2f6b3a, roughness: 1, flatShading: true });
const flowerBoxMat = new MeshStandardMaterial({ color: 0x5a3a22, roughness: 1 });
const flowerMats = [0xd62839, 0xff6fa1, 0xff9f1c, 0xffffff].map((c) => new MeshStandardMaterial({ color: c, roughness: 1 }));
const roofMats = ROOFS.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.95, flatShading: true }));
const facadeMats = FACADES.map((c) => new MeshStandardMaterial({ color: c, roughness: 0.95 }));

const unitBox = new BoxGeometry(1, 1, 1);

function box(mat, sx, sy, sz, x, y, z, shadow = true) {
  const m = new Mesh(unitBox, mat);
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/** Triangular prism roof. Ridge runs along Z (gable faces ±Z). */
function roofGeometry(width, depth, height) {
  const shape = new Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const geo = new ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

// ---------- houses ----------
function createHouse({ w = 5, d = 5, h = 6, gable = true, facade, roof, timbered = true }) {
  const g = new Group();
  const body = box(facadeMats[facade % facadeMats.length], w, h, d, 0, h / 2, 0);
  g.add(body);

  // Roof with overhang.
  const over = 0.4;
  const rh = h * 0.42;
  let roofMesh;
  if (gable) {
    roofMesh = new Mesh(roofGeometry(w + over * 2, d + over * 2, rh), roofMats[roof % roofMats.length]);
  } else {
    roofMesh = new Mesh(roofGeometry(d + over * 2, w + over * 2, rh), roofMats[roof % roofMats.length]);
    roofMesh.rotation.y = Math.PI / 2;
  }
  roofMesh.position.y = h;
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  g.add(roofMesh);

  // Chimney.
  g.add(box(stoneMat, 0.5, rh * 0.8, 0.5, w * 0.28, h + rh * 0.55, 0));

  const front = d / 2;
  const floors = Math.max(1, Math.round(h / FLOOR_H));
  const beams = [];
  const windows = [];
  const frames = [];

  // Half-timbering on the upper floors: horizontals per floor, verticals per
  // bay, a diagonal in every other bay.
  if (timbered) {
    const bays = Math.max(2, Math.round(w / 1.25));
    const bayW = w / bays;
    for (let f = 1; f <= floors; f++) {
      const y = Math.min(h, f * FLOOR_H);
      const hb = new BoxGeometry(w + 0.02, 0.16, 0.1);
      hb.translate(0, y - 0.08, front + 0.05);
      beams.push(hb);
    }
    for (let b = 0; b <= bays; b++) {
      const x = -w / 2 + b * bayW;
      const vb = new BoxGeometry(0.14, h - FLOOR_H, 0.1);
      vb.translate(x, FLOOR_H + (h - FLOOR_H) / 2, front + 0.05);
      beams.push(vb);
    }
    for (let f = 1; f < floors; f++) {
      for (let b = 0; b < bays; b += 2) {
        const x = -w / 2 + (b + 0.5) * bayW;
        const len = Math.hypot(bayW, FLOOR_H);
        const db = new BoxGeometry(0.12, len, 0.08);
        db.rotateZ(Math.atan2(bayW, FLOOR_H) * (b % 4 === 0 ? 1 : -1));
        db.translate(x, f * FLOOR_H + FLOOR_H / 2, front + 0.04);
        beams.push(db);
      }
    }
  }

  // Windows: one row per floor, door in the middle of the ground floor.
  const perFloor = Math.max(1, Math.floor(w / 1.4));
  for (let f = 0; f < floors; f++) {
    const y = f * FLOOR_H + 1.45;
    for (let i = 0; i < perFloor; i++) {
      const x = (i - (perFloor - 1) / 2) * (w / perFloor);
      if (f === 0 && Math.abs(x) < 0.6) continue; // door goes here
      const wg = new PlaneGeometry(0.55, 0.8);
      wg.translate(x, y, front + 0.03);
      windows.push(wg);
      const fg = new PlaneGeometry(0.72, 0.96);
      fg.translate(x, y, front + 0.02);
      frames.push(fg);
      if (f > 0 && Math.random() < 0.55) {
        g.add(box(flowerBoxMat, 0.7, 0.16, 0.22, x, y - 0.5, front + 0.12));
        g.add(box(pick(flowerMats), 0.62, 0.16, 0.18, x, y - 0.36, front + 0.12, false));
      }
    }
  }
  g.add(box(doorMat, 1.0, 2.0, 0.12, 0, 1.0, front + 0.03));
  g.add(box(frameMat, 1.2, 2.15, 0.08, 0, 1.07, front + 0.01));

  if (beams.length) {
    const m = new Mesh(mergeGeometries(beams), beamMat);
    m.castShadow = true;
    g.add(m);
  }
  if (windows.length) {
    g.add(new Mesh(mergeGeometries(frames), frameMat));
    g.add(new Mesh(mergeGeometries(windows), windowMat));
  }

  g.userData.ridge = { y: h + rh, w, d, gable };
  return g;
}

// ---------- church ----------
function createChurch(clock) {
  const g = new Group();
  const plaster = new MeshStandardMaterial({ color: 0xf3efe0, roughness: 0.95 });
  const nave = box(plaster, 8, 8, 11, 0, 4, -5);
  g.add(nave);
  const naveRoof = new Mesh(roofGeometry(8.8, 11.8, 4), roofMats[2]);
  naveRoof.position.set(0, 8, -5);
  naveRoof.castShadow = true;
  g.add(naveRoof);

  // Tower in front of the nave, with the clock on its square-facing side.
  const tower = new Group();
  const shaft = box(plaster, 3.8, 14, 3.8, 0, 7, 0);
  tower.add(shaft);
  const spire = new Mesh(new ConeGeometry(2.9, 4.5, 4), copperMat);
  spire.rotation.y = Math.PI / 4;
  spire.position.y = 14 + 2.25;
  spire.castShadow = true;
  tower.add(spire);
  tower.add(box(copperMat, 0.12, 1.2, 0.12, 0, 19.1, 0, false));
  tower.add(box(copperMat, 0.6, 0.12, 0.12, 0, 19.4, 0, false));
  // Bell window and a ledge under the clock.
  tower.add(box(frameMat, 1.1, 1.8, 0.1, 0, 12.5, 1.92, false));
  tower.add(box(stoneMat, 4.2, 0.25, 0.4, 0, 7.5, 2.0));
  clock.mesh.position.set(0, 9.7, 1.93);
  tower.add(clock.mesh);
  tower.position.set(0, 0, 1.5);
  g.add(tower);

  // Big arched door at the base of the tower.
  g.add(box(doorMat, 1.6, 2.6, 0.12, 0, 1.3, 3.45));

  // Nave windows along both sides.
  const wins = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const wg = new PlaneGeometry(0.7, 2.2);
      wg.rotateY((side * Math.PI) / 2);
      wg.translate(side * 4.03, 4.6, -1.5 - i * 2.4);
      wins.push(wg);
    }
  }
  g.add(new Mesh(mergeGeometries(wins), windowMat));

  g.userData.tower = tower;
  return g;
}

// ---------- ground ----------
function cobbleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#5c5955';
  x.fillRect(0, 0, 512, 512);
  const cols = 10;
  const rows = 12;
  const cw = 512 / cols;
  const rh = 512 / rows;
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < cols; i++) {
      const ox = (r % 2) * cw * 0.5;
      const g = 110 + Math.floor(Math.random() * 50);
      x.fillStyle = `rgb(${g + 6},${g},${g - 6})`;
      const px = ((i * cw + ox) % 512) + 3;
      const py = r * rh + 3;
      roundRect(x, px, py, cw - 6, rh - 6, 8);
      x.fill();
      x.fillStyle = 'rgba(255,255,255,0.08)';
      roundRect(x, px + 3, py + 3, cw - 12, rh * 0.3, 6);
      x.fill();
    }
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

function roundRect(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
}

function stripeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 64, 256);
  x.fillStyle = '#1f4e9e';
  for (let i = -2; i < 6; i++) {
    x.beginPath();
    x.moveTo(0, i * 64);
    x.lineTo(64, i * 64 + 48);
    x.lineTo(64, i * 64 + 80);
    x.lineTo(0, i * 64 + 32);
    x.closePath();
    x.fill();
  }
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(1, 5);
  return tex;
}

// ---------- backdrop ----------
function ridgeGeometry(width, baseY, peaks, maxH, snowFrom) {
  const shape = new Shape();
  const n = 48;
  shape.moveTo(-width / 2, 0);
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = -width / 2 + u * width;
    let h = 0;
    for (const [freq, amp, phase] of peaks) h += Math.sin(u * Math.PI * freq + phase) * amp;
    h = Math.max(0.5, Math.abs(h)) * maxH + rand(-0.6, 0.6);
    shape.lineTo(x, h);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  const geo = new ShapeGeometry(shape);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rock = new Color(0x6f7f97);
  const snow = new Color(0xf4f7fb);
  const tmp = new Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    tmp.copy(rock).lerp(snow, snowFrom == null ? 0 : Math.min(1, Math.max(0, (y - snowFrom) / 6)));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new BufferAttribute(colors, 3));
  geo.translate(0, baseY, 0);
  return geo;
}

function createTree(x, z, s = 1) {
  const g = new Group();
  const trunk = new Mesh(new CylinderGeometry(0.18 * s, 0.24 * s, 1.2 * s, 6), trunkMat);
  trunk.position.y = 0.6 * s;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new Mesh(new ConeGeometry((1.5 - i * 0.35) * s, 1.6 * s, 7), leafMat);
    cone.position.y = (1.6 + i * 0.9) * s;
    cone.castShadow = true;
    g.add(cone);
  }
  g.position.set(x, 0, z);
  return g;
}

function createLamp(x, z) {
  const g = new Group();
  const pole = new Mesh(new CylinderGeometry(0.07, 0.1, 3.2, 8), frameMat);
  pole.position.y = 1.6;
  pole.castShadow = true;
  g.add(pole);
  g.add(box(frameMat, 0.5, 0.06, 0.5, 0, 3.2, 0, false));
  g.add(box(lanternMat, 0.38, 0.5, 0.38, 0, 3.5, 0, false));
  const cap = new Mesh(new ConeGeometry(0.4, 0.3, 4), frameMat);
  cap.rotation.y = Math.PI / 4;
  cap.position.y = 3.9;
  g.add(cap);
  g.position.set(x, 0, z);
  return g;
}

function createMaibaum(x, z) {
  const g = new Group();
  const pole = new Mesh(new CylinderGeometry(0.14, 0.2, 12, 10), new MeshStandardMaterial({ map: stripeTexture(), roughness: 0.8 }));
  pole.position.y = 6;
  pole.castShadow = true;
  g.add(pole);
  const wreath = new Mesh(new TorusGeometry(0.9, 0.14, 8, 20), leafMat);
  wreath.rotation.x = Math.PI / 2;
  wreath.position.y = 9.6;
  g.add(wreath);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(box(i % 2 ? facadeMats[5] : new MeshStandardMaterial({ color: 0x1f4e9e }), 0.14, 1.4, 0.04, Math.cos(a) * 0.9, 8.9, Math.sin(a) * 0.9, false));
  }
  g.add(box(new MeshStandardMaterial({ color: 0x1f4e9e }), 0.9, 0.5, 0.04, 0.5, 11.6, 0, false));
  g.position.set(x, 0, z);
  return g;
}

/**
 * The whole town. Returns anchors other modules need: lamp light positions,
 * roof ridge points (for bunting), the tower (for the bell sway) and the clock.
 */
export function createTown(scene) {
  const root = new Group();
  scene.add(root);

  // Ground.
  const ground = new Mesh(new PlaneGeometry(120, 120), new MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.6, metalness: 0.05 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // Houses: two side rows facing the square and a back row flanking the church.
  const specs = [
    // left row, facing +x
    { x: -13.5, z: -8, ry: Math.PI / 2, w: 5.5, d: 5, h: 7, gable: true, facade: 0, roof: 0 },
    { x: -13.5, z: -2, ry: Math.PI / 2, w: 5, d: 5, h: 5.5, gable: false, facade: 1, roof: 1 },
    { x: -13.5, z: 4, ry: Math.PI / 2, w: 5.5, d: 5, h: 7.5, gable: true, facade: 2, roof: 2 },
    { x: -13.5, z: 10, ry: Math.PI / 2, w: 5, d: 5, h: 6, gable: true, facade: 3, roof: 0 },
    // right row, facing -x
    { x: 13.5, z: -8, ry: -Math.PI / 2, w: 5.5, d: 5, h: 6.5, gable: true, facade: 4, roof: 3 },
    { x: 13.5, z: -2, ry: -Math.PI / 2, w: 5, d: 5, h: 7.5, gable: true, facade: 5, roof: 0 },
    { x: 13.5, z: 4, ry: -Math.PI / 2, w: 5.5, d: 5, h: 5.5, gable: false, facade: 6, roof: 4 },
    { x: 13.5, z: 10, ry: -Math.PI / 2, w: 5, d: 5, h: 6.5, gable: true, facade: 1, roof: 1 },
    // back row either side of the church, facing +z
    { x: -8.5, z: -15, ry: 0, w: 6, d: 5, h: 7, gable: true, facade: 2, roof: 1 },
    { x: 8.5, z: -15, ry: 0, w: 6, d: 5, h: 6.5, gable: false, facade: 0, roof: 3 },
    { x: -15, z: -15, ry: 0, w: 5.5, d: 5, h: 6, gable: true, facade: 3, roof: 0 },
    { x: 15, z: -15, ry: 0, w: 5.5, d: 5, h: 7, gable: true, facade: 5, roof: 2 },
  ];
  const ridges = [];
  for (const s of specs) {
    const h = createHouse(s);
    h.position.set(s.x, 0, s.z);
    h.rotation.y = s.ry;
    root.add(h);
    // The front-top corner of each house, in world space, for bunting.
    const r = h.userData.ridge;
    ridges.push({ x: s.x + Math.sin(s.ry) * (r.d / 2), y: r.y - 0.6, z: s.z + Math.cos(s.ry) * (r.d / 2) });
  }

  const clock = createClock(3);
  const church = createChurch(clock);
  church.position.set(0, 0, -15);
  root.add(church);
  const tower = church.userData.tower;

  root.add(createMaibaum(-9, -11.8));

  const lampSpots = [
    [-6.5, 0, -8],
    [6.5, 0, -8],
    [-6.5, 0, 5],
    [6.5, 0, 5],
  ];
  for (const [x, , z] of lampSpots) root.add(createLamp(x, z));
  const lampPositions = lampSpots.map(([x, , z]) => [x, 3.5, z]);

  for (const [x, z, s] of [
    [-11, 14, 1.1],
    [11, 14, 1],
    [-12.3, -11.5, 0.9],
    [12.3, -11.5, 1.1],
    [-18, 1, 1.2],
    [18, 1, 1.0],
    [-18, 8, 0.9],
    [18, 8, 1.2],
  ]) {
    root.add(createTree(x, z, s));
  }

  // Backdrop: foothills, then the Alps with snow, both fogged.
  const hills = new Mesh(ridgeGeometry(220, 0, [[3, 0.5, 0.2], [7, 0.3, 1.1], [13, 0.2, 2.3]], 9, null), new MeshStandardMaterial({ color: 0x3e5a3a, roughness: 1, vertexColors: false }));
  hills.position.set(0, 0, -40);
  root.add(hills);
  const alps = new Mesh(ridgeGeometry(300, 0, [[2, 0.7, 0.5], [5, 0.45, 2.0], [11, 0.25, 0.9]], 30, 16), new MeshStandardMaterial({ roughness: 1, vertexColors: true }));
  alps.position.set(0, 0, -75);
  root.add(alps);

  const tmpColor = new Color();
  function update(ctx) {
    const { weather, state, since, reduced } = ctx;
    windowMat.emissiveIntensity = lerp(0.9, 0.12, weather);
    lanternMat.emissiveIntensity = lerp(1.4, 0.2, weather);
    // The bell swings the tower a little at 15:00.
    if (state === 'blast' && !reduced) {
      const k = 1 - Math.min(1, since / 1.5);
      tower.rotation.z = Math.sin(since * 14) * 0.025 * k;
    } else {
      tower.rotation.z *= 0.9;
    }
  }

  return { root, update, clock, tower, ridges, lampPositions };
}
