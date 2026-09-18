import { BackSide, Color, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { BLAST, COUNTDOWN, PARTY } from './state.js';
import { BROWN, GOLD, LIQUID, MAGENTA } from './palette.js';
import { clamp01, easeInOutCubic, elasticOut, lerp } from './easing.js';

const FONT_URL = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`;

const DIGIT_SIZE = 1.6;
const BEER_SIZE = 1.5;
const MAX_SLOTS = 8; // "00:00:00"
const DEG = Math.PI / 180;

export const TEXT_Y = 2.4;

export function loadFont() {
  return new FontLoader().loadAsync(FONT_URL);
}

function glyphGeometry(font, text, size, depth, detail) {
  const geo = new TextGeometry(text, {
    font,
    size,
    depth,
    curveSegments: detail.curve,
    bevelEnabled: true,
    bevelThickness: size * 0.03,
    bevelSize: size * 0.02,
    bevelOffset: 0,
    bevelSegments: detail.bevel,
  });
  geo.computeBoundingBox();
  return geo;
}

/**
 * Digits are built once as an atlas of shared geometries. Eight slot meshes
 * swap geometry references when their character changes, so a tick costs no
 * allocations at all.
 */
function buildDigitAtlas(font) {
  const atlas = {};
  let maxWidth = 0;
  for (const ch of '0123456789:') {
    const geo = glyphGeometry(font, ch, DIGIT_SIZE, DIGIT_SIZE * 0.22, { curve: 6, bevel: 2 });
    const bb = geo.boundingBox;
    const w = bb.max.x - bb.min.x;
    // Centre on x and z, keep the shared baseline on y.
    geo.translate(-(bb.min.x + w / 2), 0, -(bb.max.z + bb.min.z) / 2);
    atlas[ch] = { geo, width: w };
    if (ch !== ':') maxWidth = Math.max(maxWidth, w);
  }
  // Vertical centre of a digit, so the whole timer pivots around its middle.
  const zero = atlas['0'].geo.boundingBox;
  const midY = (zero.min.y + zero.max.y) / 2;
  for (const ch in atlas) atlas[ch].geo.translate(0, -midY, 0);

  const digitAdvance = maxWidth * 1.14; // tabular: every digit gets the same cell
  const colonAdvance = atlas[':'].width + DIGIT_SIZE * 0.3;
  return { atlas, digitAdvance, colonAdvance };
}

export function createText(font) {
  // ---------- Countdown timer ----------
  const { atlas, digitAdvance, colonAdvance } = buildDigitAtlas(font);
  const advanceOf = (ch) => (ch === ':' ? colonAdvance : digitAdvance);

  const timerMat = new MeshStandardMaterial({
    color: GOLD,
    emissive: GOLD,
    emissiveIntensity: 0.8,
    metalness: 0.3,
    roughness: 0.65,
  });
  const outlineMat = new MeshBasicMaterial({ color: BROWN, side: BackSide });
  const goldEmissive = new Color(GOLD);
  const liquidEmissive = new Color(LIQUID);

  const timerRoot = new Group();
  timerRoot.position.y = TEXT_Y;
  const timerRow = new Group();
  timerRoot.add(timerRow);

  // Each slot is a gold glyph with a slightly larger brown back-face copy
  // behind it: the 3D version of the old CSS text-stroke.
  const slots = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const m = new Mesh(atlas['0'].geo, timerMat);
    const outline = new Mesh(atlas['0'].geo, outlineMat);
    outline.scale.setScalar(1.06);
    m.add(outline);
    m.userData.ch = '0';
    m.userData.outline = outline;
    m.visible = false;
    timerRow.add(m);
    slots.push(m);
  }

  let currentText = '';
  let lastChangeAt = -1;
  let timerWidth = 0;
  const changed = new Array(MAX_SLOTS).fill(false);

  function setText(str, t = 0) {
    if (str === currentText) return;
    currentText = str;
    lastChangeAt = t;
    let total = 0;
    for (const ch of str) total += advanceOf(ch);
    timerWidth = total;
    let x = -total / 2;
    for (let i = 0; i < MAX_SLOTS; i++) {
      const slot = slots[i];
      const ch = str[i];
      if (ch === undefined) {
        slot.visible = false;
        changed[i] = false;
        continue;
      }
      slot.visible = true;
      const adv = advanceOf(ch);
      slot.position.x = x + adv / 2;
      x += adv;
      changed[i] = slot.userData.ch !== ch;
      if (changed[i]) {
        slot.userData.ch = ch;
        slot.geometry = atlas[ch].geo;
        slot.userData.outline.geometry = atlas[ch].geo;
      }
    }
  }

  /** Width of the widest possible timer, for camera fitting. */
  const maxTimerWidth = 6 * digitAdvance + 2 * colonAdvance;

  // ---------- BEER TIME ----------
  // Mid-grey base so the strobing lights add sheen rather than blowing the
  // letters out; the colour comes from the emissive hue cycle.
  const beerMat = new MeshStandardMaterial({
    color: 0x555555,
    emissive: MAGENTA,
    emissiveIntensity: 1.0,
    metalness: 0.3,
    roughness: 0.65,
  });

  const words = ['BEER', 'TIME'].map((word) => {
    const geo = glyphGeometry(font, word, BEER_SIZE, BEER_SIZE * 0.35, { curve: 8, bevel: 3 });
    geo.center();
    const bb = geo.boundingBox;
    const mesh = new Mesh(geo, beerMat);
    const outline = new Mesh(geo, outlineMat);
    outline.scale.setScalar(1.04);
    const group = new Group();
    group.add(outline, mesh);
    return { group, width: bb.max.x - bb.min.x, height: bb.max.y - bb.min.y };
  });

  const beerRoot = new Group(); // pop-in scale
  const spinGroup = new Group(); // the 1080° whip
  const swayGroup = new Group(); // rock + scale pulse
  beerRoot.add(spinGroup);
  spinGroup.add(swayGroup);
  for (const w of words) swayGroup.add(w.group);
  beerRoot.position.y = TEXT_Y;
  beerRoot.visible = false;

  let beerWidth = 0;
  let beerHeight = 0;

  /** Side by side in landscape, stacked in portrait. */
  function layout(aspect) {
    const [beer, time] = words;
    if (aspect < 1) {
      const gap = BEER_SIZE * 0.35;
      beer.group.position.set(0, (beer.height + gap) / 2, 0);
      time.group.position.set(0, -(time.height + gap) / 2, 0);
      beerWidth = Math.max(beer.width, time.width);
      beerHeight = beer.height + time.height + gap;
    } else {
      const gap = BEER_SIZE * 0.6;
      beer.group.position.set(-(beer.width + gap) / 2, 0, 0);
      time.group.position.set((time.width + gap) / 2, 0, 0);
      beerWidth = beer.width + time.width + gap;
      beerHeight = beer.height;
    }
  }
  layout(innerWidth / innerHeight);

  const emissive = new Color();

  /**
   * HSL with a fixed lightness is not perceptually even: yellow and green
   * come out three times brighter than magenta and blow past the bloom
   * threshold. Scale each hue to the same relative luminance instead.
   */
  function hueEmissive(hue, targetLum) {
    emissive.setHSL(hue, 1, 0.5);
    const lum = 0.2126 * emissive.r + 0.7152 * emissive.g + 0.0722 * emissive.b;
    emissive.multiplyScalar(Math.min(3, targetLum / Math.max(lum, 1e-3)));
    return emissive;
  }

  // ---------- Per-frame motion ----------
  function update(ctx) {
    const { t, state, since, reduced, urgent, hue, off } = ctx;

    // Timer: bob, gentle yaw so the extrusion reads, urgency, second-tick pulse.
    if (state === COUNTDOWN || state === BLAST) {
      timerRoot.visible = true;
      timerRoot.position.y = TEXT_Y + (reduced ? 0 : 0.12 * Math.sin((2 * Math.PI * t) / 3));
      timerRoot.rotation.y = reduced ? 0 : Math.sin(t * 0.45) * 5 * DEG;
      timerRoot.rotation.x = reduced ? 0 : Math.sin(t * 0.3) * 3 * DEG;

      if (urgent && !reduced) {
        timerRow.position.x = (Math.random() - 0.5) * 0.08;
        timerRow.position.y = (Math.random() - 0.5) * 0.08;
        const flicker = 0.75 + 0.25 * Math.sin(t * 40) * Math.sin(t * 7.3);
        emissive.copy(goldEmissive).lerp(liquidEmissive, 0.6);
        timerMat.emissive.copy(emissive);
        timerMat.emissiveIntensity = 0.8 * flicker + 0.4;
      } else {
        timerRow.position.set(0, 0, 0);
        timerMat.emissive.copy(goldEmissive);
        timerMat.emissiveIntensity = urgent ? 1.1 : 0.8;
      }

      // Pulse the slots that just changed.
      const k = lastChangeAt < 0 ? 1 : clamp01((t - lastChangeAt) / 0.18);
      const pulse = reduced ? 1 : 1 + 0.08 * (1 - k);
      for (let i = 0; i < MAX_SLOTS; i++) slots[i].scale.setScalar(changed[i] ? pulse : 1);

      if (state === BLAST) {
        // Timer collapses as the party text arrives.
        const s = 1 - clamp01(since / 0.35);
        timerRoot.scale.setScalar(Math.max(0.0001, s * s));
        timerRoot.position.y = TEXT_Y + (1 - s) * 3;
      } else {
        timerRoot.scale.setScalar(1);
      }
    } else {
      timerRoot.visible = false;
    }

    // BEER TIME: pop-in, hue cycle, whip, sway.
    if (state === BLAST || state === PARTY) {
      beerRoot.visible = true;
      const tIn = state === BLAST ? since : since + 1.5;
      const pop = reduced ? clamp01(tIn / 0.5) : elasticOut(clamp01(tIn / 0.8));
      beerRoot.scale.setScalar(Math.max(0.0001, pop));
      beerRoot.rotation.y = reduced ? 0 : (1 - clamp01(tIn / 0.8)) * -Math.PI;

      beerMat.emissive.copy(hueEmissive(off.has('hue') ? 0.9 : hue, 0.55));

      if (reduced) {
        spinGroup.rotation.set(0, 0, 0);
        swayGroup.rotation.set(0, 0, 0);
        swayGroup.scale.setScalar(1);
      } else {
        // megaSpin: idle for 80% of a 7s loop, then 1080° eased.
        const p = (t % 7) / 7;
        const k = p < 0.8 || off.has('whip') ? 0 : easeInOutCubic((p - 0.8) / 0.2);
        spinGroup.rotation.y = k * 6 * Math.PI;
        spinGroup.rotation.x = Math.sin(k * Math.PI) * 0.18;

        // swayBoom: rock ±5° while pulsing 0.85 -> 1.2, in phase, 2.4s.
        const s = 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 2.4);
        swayGroup.rotation.z = lerp(-5, 5, s) * DEG;
        swayGroup.rotation.y = Math.sin(t * 0.9) * 8 * DEG;
        swayGroup.scale.setScalar(lerp(0.85, 1.2, s));
      }
    } else {
      beerRoot.visible = false;
    }
  }

  return {
    timerRoot,
    beerRoot,
    setText,
    layout,
    update,
    get timerWidth() {
      return timerWidth;
    },
    maxTimerWidth,
    get beerWidth() {
      return beerWidth;
    },
    get beerHeight() {
      return beerHeight;
    },
    digitHeight: DIGIT_SIZE,
  };
}
