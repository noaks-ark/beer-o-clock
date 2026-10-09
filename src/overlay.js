import { Vector3 } from 'three';
import { COUNTDOWN } from './state.js';
import { pick } from './easing.js';

const RAIN_LINES = [
  'Grey skies over the Marktplatz ☔',
  'The Wirt is polishing the Maßkrüge 🍺',
  'Umbrellas up, steins down. For now.',
  'Somewhere, a keg is getting nervous 🛢️',
  'The brass band is tuning up in a garage 🎺',
  'The pretzels are in the oven 🥨',
  'Hydrate now, celebrate later 💧',
  'The Maibaum is waiting for a reason to exist',
  'Nobody has said Prost yet. Nobody.',
  'Beer thirty is almost upon us ⏰',
];

const PARTY_LINES = [
  "O'zapft is! 🍻",
  'Ein Prosit der Gemütlichkeit 🎶',
  'The rain is 5.2% now 🍺',
  'Nobody is checking Slack right now 💬',
  'Noch a Maß, bitte!',
  'The sun came out just for this ☀️',
  'Pretzel levels: critical 🥨',
  'Skål! Prost! Cheers! 🍻',
];

export const SPEECH = {
  rain: ['Is it 15:00 yet?', 'Schrecklich, this weather.', 'My socks are wet.', 'I only came for the beer.', 'Where is the Wirt?', 'Moin.', 'Grüß Gott.', 'This umbrella was 3 euros.', 'Bis 15:00 then.', 'Pretzel? Not yet.'],
  party: ['PROST! 🍻', "O'zapft is!", 'Noch a Maß!', 'WOOOO!', 'Ein Prosit!', 'Skål!', 'Zicke zacke zicke zacke!', 'Hoi hoi hoi!', 'Best time of the day!', 'Refill!'],
};

export function createOverlay() {
  const caption = document.getElementById('caption');
  const sub = document.getElementById('sub');
  const clockline = document.getElementById('clockline');
  const bubbles = document.getElementById('bubbles');
  const flash = document.getElementById('flash');

  let lines = RAIN_LINES;
  let index = 0;
  let nextSwap = 5;
  let loading = true;

  function showLine(text) {
    sub.classList.add('swap');
    setTimeout(() => {
      sub.textContent = text;
      sub.classList.remove('swap');
    }, 400);
  }

  function setLoading(on) {
    loading = on;
    if (!on) sub.textContent = lines[0];
  }

  function setState(state) {
    if (state === COUNTDOWN) {
      document.body.classList.remove('party');
      document.title = "☔ BEER O'CLOCK";
      caption.textContent = "Countdown to beer o'clock · Oktoberfest";
      lines = RAIN_LINES;
    } else {
      document.body.classList.add('party');
      document.title = "🍻🍻🍻 O'ZAPFT IS! 🍻🍻🍻";
      caption.textContent = "O'ZAPFT IS! PROST! 🍻";
      lines = PARTY_LINES;
    }
    index = 0;
    if (!loading) sub.textContent = lines[0];
  }

  function setClock(text, urgent, final) {
    if (clockline.textContent !== text) clockline.textContent = text;
    clockline.classList.toggle('urgent', urgent && !final);
    clockline.classList.toggle('final', final);
  }

  function doFlash() {
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
  }

  // Speech bubbles pinned to a 3D point; re-projected every frame.
  const live = [];
  const v = new Vector3();
  function speak(object, text, ms = 2600) {
    for (const b of live) if (b.object === object) b.remove();
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    bubbles.appendChild(el);
    const entry = {
      object,
      el,
      remove() {
        el.remove();
        const i = live.indexOf(entry);
        if (i >= 0) live.splice(i, 1);
      },
    };
    live.push(entry);
    setTimeout(entry.remove, ms);
  }

  function update(t, camera) {
    for (const b of live) {
      b.object.getWorldPosition(v);
      v.y += 2.1;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * innerWidth;
      const y = (-v.y * 0.5 + 0.5) * innerHeight;
      b.el.style.left = x + 'px';
      b.el.style.top = y + 'px';
      b.el.style.visibility = v.z < 1 ? 'visible' : 'hidden';
    }
    if (loading || t < nextSwap) return;
    nextSwap = t + 5;
    index = (index + 1) % lines.length;
    showLine(lines[index]);
  }

  return { setLoading, setState, setClock, doFlash, speak, update, pick };
}

/** Plain DOM fallback when WebGL is unavailable. */
export function showFallback(getText) {
  document.getElementById('overlay').hidden = true;
  document.getElementById('scene').hidden = true;
  const box = document.getElementById('fallback');
  const time = document.getElementById('fallback-time');
  box.hidden = false;
  const tick = () => {
    time.textContent = getText();
  };
  tick();
  setInterval(tick, 250);
}
