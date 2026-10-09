import { BackSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { COUNTDOWN } from './state.js';
import { BAVARIA_BLUE } from './palette.js';
import { clamp01, elasticOut, lerp } from './easing.js';

const FONT_URL = './fonts/helvetiker_bold.typeface.json';
const TEXT_Y = 10.4;
const TEXT_Z = -3;
const DEG = Math.PI / 180;

export function loadFont() {
  return new FontLoader().loadAsync(FONT_URL);
}

function word(font, str, size, depth, face, outline) {
  const geo = new TextGeometry(str, {
    font,
    size,
    depth,
    curveSegments: 6,
    bevelEnabled: true,
    bevelThickness: size * 0.03,
    bevelSize: size * 0.02,
    bevelSegments: 2,
  });
  geo.center();
  const bb = geo.boundingBox;
  const mesh = new Mesh(geo, face);
  mesh.castShadow = true;
  const back = new Mesh(geo, outline);
  back.scale.setScalar(1.05);
  const g = new Group();
  g.add(back, mesh);
  return { g, width: bb.max.x - bb.min.x, height: bb.max.y - bb.min.y };
}

/** "BEER TIME" over "OKTOBERFEST", white with a Bavarian blue outline. */
export function createText(font) {
  const face = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.6, metalness: 0.1 });
  const outline = new MeshBasicMaterial({ color: BAVARIA_BLUE, side: BackSide });
  const top = word(font, 'BEER TIME', 1.9, 0.6, face, outline);
  const bottom = word(font, 'OKTOBERFEST', 1.25, 0.45, face, outline);

  const root = new Group();
  root.position.set(0, TEXT_Y, TEXT_Z);
  root.visible = false;
  const sway = new Group();
  root.add(sway);
  const gap = 0.5;
  top.g.position.y = (bottom.height + gap) / 2 + 0.2;
  bottom.g.position.y = -(top.height + gap) / 2 - 0.2;
  sway.add(top.g, bottom.g);
  const width = Math.max(top.width, bottom.width) * 1.05;

  let fit = 1;
  function layout(aspect) {
    // Rough visible width at the text's depth for the camera rig's framing.
    const z = Math.max(27, 13 / (0.4245 * aspect)) - TEXT_Z;
    const visible = 2 * z * 0.4245 * aspect;
    fit = Math.min(1, Math.max(0.45, (0.9 * visible) / width));
  }
  layout(innerWidth / innerHeight);

  let shownAt = -1;
  function show(t) {
    shownAt = t;
    root.visible = true;
  }

  function update(ctx) {
    const { t, state, beat, reduced } = ctx;
    if (state === COUNTDOWN) {
      root.visible = false;
      return;
    }
    root.visible = true;
    const tIn = shownAt < 0 ? 1 : t - shownAt;
    const pop = reduced ? clamp01(tIn / 0.5) : elasticOut(clamp01(tIn / 0.9));
    const pulse = reduced ? 0 : 0.05 * beat.pulse;
    root.scale.setScalar(Math.max(0.0001, pop * fit * (1 + pulse)));
    root.rotation.y = reduced ? 0 : (1 - clamp01(tIn / 0.9)) * -Math.PI + Math.sin(t * 0.5) * 8 * DEG;
    root.position.y = TEXT_Y + (reduced ? 0 : Math.sin(t * 1.3) * 0.25);
    const s = reduced ? 0 : 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2.4);
    sway.rotation.z = lerp(-4, 4, s) * DEG;
  }

  return { root, layout, show, update };
}
