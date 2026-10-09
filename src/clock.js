import { CanvasTexture, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';

const SIZE = 512;

/**
 * The tower clock: an analog dial showing real local time, with the countdown
 * printed across the lower half. Redrawn only when the displayed string
 * changes (once a second), so it costs nothing in between.
 */
export function createClock(width = 3) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const material = new MeshStandardMaterial({
    map: texture,
    emissiveMap: texture,
    emissive: 0xffffff,
    emissiveIntensity: 0.55,
    roughness: 0.8,
  });
  const mesh = new Mesh(new PlaneGeometry(width, width), material);

  let last = '';
  let lastMinute = -1;

  function draw(text, urgent, final, now) {
    const c = SIZE / 2;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Dial.
    ctx.beginPath();
    ctx.arc(c, c, c - 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f6efe0';
    ctx.fill();
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#2b2b30';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, c - 28, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8a7a5a';
    ctx.stroke();

    // Ticks and the four numerals.
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      const big = i % 5 === 0;
      const r1 = c - 34;
      const r2 = big ? c - 58 : c - 46;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1);
      ctx.lineTo(c + Math.sin(a) * r2, c - Math.cos(a) * r2);
      ctx.lineWidth = big ? 7 : 3;
      ctx.strokeStyle = '#2b2b30';
      ctx.stroke();
    }
    ctx.fillStyle = '#2b2b30';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 54px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('XII', c, 92);
    ctx.fillText('III', SIZE - 92, c);
    ctx.fillText('VI', c, SIZE - 92);
    ctx.fillText('IX', 92, c);

    // Countdown in the lower half.
    ctx.font = `900 ${text.length > 5 ? 74 : 92}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
    ctx.fillStyle = final ? '#d61f1f' : urgent ? '#c2401c' : '#1f4e9e';
    ctx.fillText(text, c, c + 112);
    ctx.font = '700 26px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = '#5a5a60';
    ctx.fillText('BIS 15:00', c, c + 170);

    // Hands at the real local time.
    const h = now.getHours() % 12;
    const m = now.getMinutes();
    const s = now.getSeconds();
    const hourA = ((h + m / 60) / 12) * Math.PI * 2;
    const minA = ((m + s / 60) / 60) * Math.PI * 2;
    hand(hourA, c * 0.5, 16, '#2b2b30');
    hand(minA, c * 0.74, 10, '#2b2b30');
    hand((s / 60) * Math.PI * 2, c * 0.8, 4, '#c2401c');
    ctx.beginPath();
    ctx.arc(c, c, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#2b2b30';
    ctx.fill();
  }

  function hand(angle, length, width, color) {
    const c = SIZE / 2;
    ctx.beginPath();
    ctx.moveTo(c - Math.sin(angle) * 18, c + Math.cos(angle) * 18);
    ctx.lineTo(c + Math.sin(angle) * length, c - Math.cos(angle) * length);
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  /** @param text countdown string, or e.g. "PROST!" after 15:00 */
  function set(text, urgent = false, final = false) {
    const now = new Date();
    const key = `${text}|${urgent}|${final}|${now.getSeconds()}`;
    if (key === last) return;
    last = key;
    lastMinute = now.getMinutes();
    draw(text, urgent, final, now);
    texture.needsUpdate = true;
  }

  set('--:--');
  return { mesh, material, set };
}
