import { ACESFilmicToneMapping, PMREMGenerator, Scene, Timer, WebGLRenderer } from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { fillFraction, formatRemaining, getConfig, isUrgent } from './time.js';
import { BLAST, COUNTDOWN, PARTY, bootState, createState } from './state.js';
import { createBeat } from './beat.js';
import { createCameraRig } from './camera.js';
import { createFloor } from './floor.js';
import { createLights } from './lights.js';
import { createCans } from './cans.js';
import { createPost } from './post.js';
import { createText, loadFont } from './text.js';
import { createOverlay, showFallback } from './overlay.js';

const config = getConfig();
const remainingNow = () => config.targetMs - Date.now();

if (!WebGL.isWebGL2Available()) {
  showFallback(() => (remainingNow() <= 0 ? 'BEER TIME' : formatRemaining(remainingNow())));
} else {
  boot().catch((err) => {
    console.error(err);
    showFallback(() => (remainingNow() <= 0 ? 'BEER TIME' : formatRemaining(remainingNow())));
  });
}

async function boot() {
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;
  reducedQuery.addEventListener('change', (e) => (reduced = e.matches));

  const canvas = document.getElementById('scene');
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const pixelRatio = () => Math.min(devicePixelRatio, innerWidth < 600 ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);

  const overlay = createOverlay();
  const scene = new Scene();

  // A faint room environment gives the metallic cans and text something to
  // reflect. Kept dim so the neon lights stay in charge.
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = config.off.has('env') ? 0 : 0.25;
  pmrem.dispose();
  const beat = createBeat(128);
  const rig = createCameraRig(innerWidth / innerHeight);
  const floor = createFloor(scene, beat);
  floor.mesh.visible = !config.off.has('floor');
  const lights = createLights(scene, beat);
  const cans = createCans(renderer);
  if (!config.off.has('cans')) scene.add(cans.mesh);
  const post = createPost(renderer, scene, rig.camera);

  const font = await loadFont();
  const text = createText(font);
  scene.add(text.timerRoot, text.beerRoot);
  overlay.setLoading(false);

  // ---------- State wiring ----------
  const state = createState();
  state.on(BLAST, () => {
    cans.explode(reduced || config.off.has('explode'));
    overlay.setState(BLAST);
  });
  state.on(PARTY, () => {
    cans.setRaining(!config.off.has('rain'));
    overlay.setState(PARTY);
  });

  const initial = bootState(remainingNow(), config.forceParty);
  overlay.setState(COUNTDOWN);
  if (initial === BLAST) state.set(BLAST, 0);
  if (initial === PARTY) {
    state.set(BLAST, 0);
    state.set(PARTY, 0);
  }

  // ---------- Resize ----------
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    const aspect = w / h;
    const dpr = pixelRatio();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    text.layout(aspect);
    rig.fit(aspect, Math.max(text.maxTimerWidth, text.beerWidth), Math.max(text.digitHeight, text.beerHeight));
    post.resize(w, h, dpr);
  }
  resize();
  let resizeQueued = false;
  addEventListener('resize', () => {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      resize();
    });
  });

  // ---------- Frame loop ----------
  const timer = new Timer();
  const ctx = {
    dt: 0,
    t: 0,
    state: state.current,
    since: 0,
    beat,
    reduced,
    hue: 0,
    fill: 0,
    urgent: false,
    off: config.off,
  };

  renderer.setAnimationLoop((timestamp) => {
    timer.update(timestamp);
    // Clamp so a sleeping tab doesn't launch the can physics into orbit.
    const dt = Math.min(0.05, timer.getDelta());
    const t = timer.getElapsed();

    const remaining = remainingNow();
    if (state.is(COUNTDOWN)) {
      if (remaining <= 0) {
        state.set(BLAST, t);
      } else {
        text.setText(formatRemaining(remaining), t);
      }
    }
    state.update(t);
    beat.update(t);

    ctx.dt = dt;
    ctx.t = t;
    ctx.state = state.current;
    ctx.since = state.since(t);
    ctx.reduced = reduced;
    ctx.hue = (t / 5) % 1;
    ctx.fill = fillFraction(remaining, config.fillWindowMs);
    ctx.urgent = isUrgent(remaining);

    rig.update(ctx);
    text.update(ctx);
    cans.update(ctx);
    lights.update(ctx);
    floor.update(ctx);
    post.update(ctx);
    overlay.update(t);

    post.composer.render(dt);
  });
}
