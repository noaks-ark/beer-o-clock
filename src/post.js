import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { COUNTDOWN } from './state.js';
import { damp } from './easing.js';

// Bloom stays dim: anything lit that crosses the threshold smears into haze.
const PARTY_STRENGTH = 0.35;

/** RenderPass → (bloom, party only) → OutputPass. Nothing recompiles mid-flip. */
export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new Vector2());
  const dpr = renderer.getPixelRatio();
  const target = new WebGLRenderTarget(size.x * dpr, size.y * dpr, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(size.x, size.y);

  const bloom = new UnrealBloomPass(new Vector2(size.x, size.y), 0, 0.3, 0.9);
  bloom.enabled = false;
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function update(ctx) {
    const { dt, state, beat, reduced, off } = ctx;
    const wanted = state === COUNTDOWN || off.has('bloom') ? 0 : PARTY_STRENGTH + (reduced ? 0 : 0.15 * beat.pulse);
    bloom.strength = damp(bloom.strength, wanted, 4, dt);
    bloom.enabled = bloom.strength > 0.01;
  }

  function resize(width, height, pixelRatio) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
  }

  return { composer, update, resize };
}
