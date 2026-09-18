import { HalfFloatType, Vector2, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BLAST, COUNTDOWN } from './state.js';
import { clamp01, damp, lerp } from './easing.js';

const TARGETS = {
  countdown: { strength: 0.5, radius: 0.25, threshold: 0.9, film: 0.12 },
  party: { strength: 0.8, radius: 0.3, threshold: 0.8, film: 0.2 },
};

/**
 * One composer, every pass built once. States only flip `.enabled` and lerp
 * uniforms, so nothing recompiles mid-transition. OutputPass must stay last:
 * it applies tone mapping and the sRGB conversion for the whole chain.
 */
export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new Vector2());
  const dpr = renderer.getPixelRatio();

  // The default framebuffer's MSAA is lost once we render to a target, so ask
  // for a multisampled half-float target explicitly.
  const target = new WebGLRenderTarget(size.x * dpr, size.y * dpr, { type: HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.setSize(size.x, size.y);

  const bloom = new UnrealBloomPass(new Vector2(size.x, size.y), TARGETS.countdown.strength, TARGETS.countdown.radius, TARGETS.countdown.threshold);
  const afterimage = new AfterimagePass(0.8);
  // The trail buffer is half-float, so a single blinding frame (a can grazing
  // a light) would linger for dozens of frames and bloom into a disc. Clamp
  // what enters the trail.
  afterimage.compFsMaterial.fragmentShader = afterimage.compFsMaterial.fragmentShader.replace(
    'gl_FragColor = max(texelNew, texelOld);',
    'gl_FragColor = max(min(texelNew, vec4(1.5)), texelOld);',
  );
  const rgbShift = new ShaderPass(RGBShiftShader);
  const glitch = new GlitchPass();
  const film = new FilmPass(TARGETS.countdown.film, false);
  const output = new OutputPass();

  afterimage.enabled = false;
  rgbShift.enabled = false;
  glitch.enabled = false;

  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(afterimage);
  composer.addPass(bloom);
  composer.addPass(rgbShift);
  composer.addPass(glitch);
  composer.addPass(film);
  composer.addPass(output);

  let nextLightning = 8;

  function update(ctx) {
    const { dt, state, since, beat, reduced, off } = ctx;

    bloom.enabled = !off.has('bloom');
    if (state === COUNTDOWN) {
      const tg = TARGETS.countdown;
      bloom.strength = damp(bloom.strength, tg.strength, 4, dt);
      bloom.radius = damp(bloom.radius, tg.radius, 4, dt);
      bloom.threshold = damp(bloom.threshold, tg.threshold, 4, dt);
      film.uniforms.intensity.value = damp(film.uniforms.intensity.value, tg.film, 4, dt);
      afterimage.enabled = false;
      rgbShift.enabled = false;
      glitch.enabled = false;
      return;
    }

    if (state === BLAST) {
      const k = clamp01(since / 1.5);
      const tg = TARGETS.party;
      // Spike then settle toward the party level.
      bloom.strength = lerp(1.8, tg.strength, k);
      bloom.radius = damp(bloom.radius, tg.radius, 6, dt);
      bloom.threshold = damp(bloom.threshold, tg.threshold, 6, dt);
      film.uniforms.intensity.value = damp(film.uniforms.intensity.value, tg.film, 6, dt);
      if (!reduced) {
        glitch.enabled = true;
        glitch.goWild = since < 0.6;
        rgbShift.enabled = true;
        rgbShift.uniforms.amount.value = lerp(0.02, 0.006, k);
        rgbShift.uniforms.angle.value = since * 3;
      }
      return;
    }

    // PARTY
    const tg = TARGETS.party;
    const pulse = reduced || off.has('pulse') ? 0 : beat.pulse;
    bloom.strength = damp(bloom.strength, tg.strength + 0.3 * pulse, 12, dt);
    bloom.radius = damp(bloom.radius, tg.radius, 4, dt);
    bloom.threshold = damp(bloom.threshold, tg.threshold, 4, dt);
    film.uniforms.intensity.value = damp(film.uniforms.intensity.value, tg.film, 4, dt);

    if (reduced) {
      afterimage.enabled = false;
      rgbShift.enabled = false;
      glitch.enabled = false;
      return;
    }

    afterimage.enabled = !off.has('after');
    afterimage.damp = 0.8;
    rgbShift.enabled = !off.has('rgb');
    rgbShift.uniforms.amount.value = 0.0025 + 0.003 * pulse;
    rgbShift.uniforms.angle.value += dt * 0.8;

    // Occasional lightning: a short glitch burst every 8-14 seconds.
    if (since > nextLightning && !off.has('glitch')) {
      glitch.enabled = true;
      glitch.goWild = false;
      if (since > nextLightning + 0.3) {
        glitch.enabled = false;
        nextLightning = since + 8 + Math.random() * 6;
      }
    } else {
      glitch.enabled = false;
    }
  }

  function resize(width, height, pixelRatio) {
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
  }

  return { composer, update, resize };
}
