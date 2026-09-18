import { Color, FogExp2, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { BG_COUNTDOWN, BG_PARTY, CYAN, GOLD, MAGENTA, PURPLE } from './palette.js';
import { COUNTDOWN } from './state.js';
import { damp } from './easing.js';

const vertexShader = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vWorld;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorld = worldPos.xyz;
    vec4 mvPosition = viewMatrix * worldPos;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime;
  uniform float uSpeed;
  uniform float uPulse;
  uniform vec3 uLine;
  uniform vec3 uBase;
  varying vec3 vWorld;

  void main() {
    vec2 g = vWorld.xz * 0.5;
    g.y += uTime * uSpeed;
    vec2 f = abs(fract(g - 0.5) - 0.5) / fwidth(g);
    float line = 1.0 - min(min(f.x, f.y), 1.0);
    line = pow(line, 1.5);

    float dist = length(vWorld.xz);
    float fade = exp(-dist * 0.05);

    // Soft glow under the centre of the stage.
    float glow = exp(-dist * 0.25) * 0.35;

    vec3 col = uBase + uLine * (line * (1.2 + uPulse * 2.0) * fade + glow);
    gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>
  }
`;

export function createFloor(scene, beat) {
  const uniforms = UniformsUtils.merge([
    UniformsLib.fog,
    {
      uTime: { value: 0 },
      uSpeed: { value: 0.4 },
      uPulse: { value: 0 },
      uLine: { value: new Color(PURPLE) },
      uBase: { value: new Color(BG_COUNTDOWN.bot).multiplyScalar(0.6) },
    },
  ]);
  const material = new ShaderMaterial({ uniforms, vertexShader, fragmentShader, fog: true });
  const mesh = new Mesh(new PlaneGeometry(120, 120), material);
  mesh.rotation.x = -Math.PI / 2;
  scene.add(mesh);

  const bg = new Color(BG_COUNTDOWN.bot);
  scene.background = bg;
  scene.fog = new FogExp2(bg.getHex(), 0.035);

  const bgCountdown = new Color(BG_COUNTDOWN.bot);
  const bgParty = new Color(BG_PARTY.bot);
  const purple = new Color(PURPLE);
  const gold = new Color(GOLD);
  const partyLine = new Color(MAGENTA);
  const lineTarget = new Color();
  const baseTarget = new Color();

  beat.onBeat((index) => {
    partyLine.set(index % 4 < 2 ? MAGENTA : CYAN);
  });

  function update(ctx) {
    const { dt, t, state, fill, reduced } = ctx;
    const countdown = state === COUNTDOWN;
    uniforms.uTime.value = t;

    if (countdown) {
      // The old page filled a beer mug over the day; here the grid warms from
      // purple to gold as 15:00 approaches.
      lineTarget.copy(purple).lerp(gold, fill);
      baseTarget.copy(bgCountdown).multiplyScalar(0.6);
      uniforms.uSpeed.value = damp(uniforms.uSpeed.value, reduced ? 0.15 : 0.4, 2, dt);
      uniforms.uPulse.value = damp(uniforms.uPulse.value, 0, 4, dt);
      scene.fog.density = damp(scene.fog.density, 0.035, 2, dt);
      bg.lerp(bgCountdown, 1 - Math.exp(-2 * dt));
    } else {
      lineTarget.copy(partyLine);
      baseTarget.copy(bgParty).multiplyScalar(0.6);
      uniforms.uSpeed.value = damp(uniforms.uSpeed.value, reduced ? 0.5 : 2.5, 2, dt);
      uniforms.uPulse.value = reduced ? 0.15 : beat.pulse * 0.6;
      scene.fog.density = damp(scene.fog.density, 0.045, 2, dt);
      bg.lerp(bgParty, 1 - Math.exp(-2 * dt));
    }

    uniforms.uLine.value.lerp(lineTarget, 1 - Math.exp(-4 * dt));
    uniforms.uBase.value.lerp(baseTarget, 1 - Math.exp(-2 * dt));
    scene.fog.color.copy(bg);
  }

  return { mesh, update };
}
