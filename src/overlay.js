import { COUNTDOWN } from './state.js';

const WAITING_LINES = [
  'Hold on... the fridge is doing its best 🧊',
  'Glasses are being polished 🥂',
  'The foam is foaming 🫧',
  'Hydrate now, celebrate later 💧',
  'Somewhere, a keg is getting nervous 🛢️',
  'Beer thirty is almost upon us ⏰',
  'The DJ is warming up the decks 💿',
  'Disco ball: polished and ready 🪩',
];

const PARTY_LINES = [
  'Untz untz untz 🔊',
  'The fridge has been relieved of duty 🧊',
  'Foam levels: optimal 🫧',
  'Nobody is checking Slack right now 💬',
  'Hydration continues, in a different form 🍺',
];

export function createOverlay() {
  const caption = document.getElementById('caption');
  const sub = document.getElementById('sub');
  const dj = document.getElementById('dj');

  let lines = WAITING_LINES;
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
    if (!on) {
      sub.textContent = lines[0];
    }
  }

  function setState(state) {
    if (state === COUNTDOWN) {
      document.body.classList.remove('party');
      document.title = "🍺 BEER O'CLOCK 🍺";
      caption.textContent = 'Countdown to beer time';
      dj.hidden = true;
      lines = WAITING_LINES;
    } else {
      document.body.classList.add('party');
      document.title = '🍻🍻🍻 BEER TIME 🍻🍻🍻';
      caption.textContent = 'SKÅL! CHEERS! PROST! 🎉';
      dj.hidden = false;
      lines = PARTY_LINES;
    }
    index = 0;
    if (!loading) sub.textContent = lines[0];
  }

  function update(t) {
    if (loading || t < nextSwap) return;
    nextSwap = t + 5;
    index = (index + 1) % lines.length;
    showLine(lines[index]);
  }

  return { setLoading, setState, update };
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
