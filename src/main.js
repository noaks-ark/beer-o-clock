import { ACESFilmicToneMapping, PCFShadowMap, Raycaster, Scene, Timer, Vector2, WebGLRenderer } from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';
import { formatRemaining, getConfig, isUrgent } from './time.js';
import { BLAST, COUNTDOWN, PARTY, bootState, createState } from './state.js';
import { createBeat } from './beat.js';
import { createCameraRig } from './camera.js';
import { createSky } from './sky.js';
import { createLights } from './lights.js';
import { createTown } from './town.js';
import { createRain } from './rain.js';
import { createPeople } from './people.js';
import { createSteins } from './steins.js';
import { createText, loadFont } from './text.js';
import { createDecor } from './decor.js';
import { createPost } from './post.js';
import { SPEECH, createOverlay, showFallback } from './overlay.js';
import { damp, pick } from './easing.js';

const config = getConfig();
const remainingNow = () => config.targetMs - Date.now();

if (!WebGL.isWebGL2Available()) {
  showFallback(() => (remainingNow() <= 0 ? "O'ZAPFT IS!" : formatRemaining(remainingNow())));
} else {
  boot().catch((err) => {
    console.error(err);
    showFallback(() => (remainingNow() <= 0 ? "O'ZAPFT IS!" : formatRemaining(remainingNow())));
  });
}

async function boot() {
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reducedQuery.matches;
  reducedQuery.addEventListener('change', (e) => (reduced = e.matches));

  const canvas = document.getElementById('scene');
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !config.off.has('shadows');
  renderer.shadowMap.type = PCFShadowMap;
  const pixelRatio = () => Math.min(devicePixelRatio, innerWidth < 600 ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);

  const overlay = createOverlay();
  const scene = new Scene();
  const beat = createBeat(116); // oompah tempo
  const rig = createCameraRig(innerWidth / innerHeight);
  const sky = createSky(scene);
  const town = createTown(scene);
  const lights = createLights(scene, town.lampPositions);
  const rain = createRain(scene, reduced || config.off.has('rain') ? 500 : 1300);
  rain.mesh.visible = !config.off.has('rain');
  const people = createPeople(scene, reduced ? 20 : 30);
  const steins = createSteins(scene);
  const decor = createDecor(scene, town.ridges);
  const post = createPost(renderer, scene, rig.camera);

  const font = await loadFont();
  const text = createText(font);
  scene.add(text.root);
  overlay.setLoading(false);

  // ---------- State wiring ----------
  const state = createState();
  state.on(BLAST, (t) => {
    overlay.doFlash();
    overlay.setState(BLAST);
    steins.explode(reduced || config.off.has('explode'));
    people.startParty(t);
    decor.show(t);
    text.show(t);
  });
  state.on(PARTY, () => {
    steins.setRaining(!config.off.has('steins'));
  });

  const initial = bootState(remainingNow(), config.forceParty);
  overlay.setState(COUNTDOWN);
  let weather = 0;
  if (initial === BLAST) state.set(BLAST, 0);
  if (initial === PARTY) {
    state.set(BLAST, 0);
    state.set(PARTY, 0);
    weather = 1;
  }

  // ---------- Resize ----------
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    const dpr = pixelRatio();
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    rig.fit(w / h);
    text.layout(w / h);
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

  // ---------- Clicks: townsfolk talk, the ground foams ----------
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  canvas.addEventListener('pointerdown', (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(pointer, rig.camera);
    const hits = raycaster.intersectObjects(people.pickables, true);
    const fig = hits.length ? people.figureOf(hits[0].object) : null;
    if (fig) {
      fig.hop();
      overlay.speak(fig.root, pick(state.is(COUNTDOWN) ? SPEECH.rain : SPEECH.party));
    } else if (!state.is(COUNTDOWN)) {
      const ground = raycaster.ray.intersectPlane(people.groundPlane, people.scratch);
      if (ground) steins.burst(ground, 8);
    }
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
    weather,
    remaining: 0,
    urgent: false,
    off: config.off,
    camera: rig.camera,
  };

  renderer.setAnimationLoop((timestamp) => {
    timer.update(timestamp);
    // Clamp so a sleeping tab doesn't launch the physics into orbit.
    const dt = Math.min(0.05, timer.getDelta());
    const t = timer.getElapsed();

    const remaining = remainingNow();
    if (state.is(COUNTDOWN)) {
      if (remaining <= 0) {
        state.set(BLAST, t);
      } else {
        const str = formatRemaining(remaining);
        const urgent = isUrgent(remaining);
        const final = remaining < 10000;
        town.clock.set(str, urgent, final);
        overlay.setClock(str, urgent, final);
      }
    } else {
      town.clock.set('PROST!');
    }
    state.update(t);
    beat.update(t);

    weather = damp(weather, state.is(COUNTDOWN) ? 0 : 1, 0.9, dt);

    ctx.dt = dt;
    ctx.t = t;
    ctx.state = state.current;
    ctx.since = state.since(t);
    ctx.reduced = reduced;
    ctx.weather = weather;
    ctx.remaining = remaining;
    ctx.urgent = isUrgent(remaining);

    rig.update(ctx);
    sky.update(ctx);
    lights.update(ctx);
    town.update(ctx);
    rain.update(ctx);
    people.update(ctx);
    steins.update(ctx);
    text.update(ctx);
    decor.update(ctx);
    post.update(ctx);
    overlay.update(t, rig.camera);

    post.composer.render(dt);
  });
}
