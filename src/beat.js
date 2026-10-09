/**
 * A fake beat clock. There is no audio (autoplay rules), but lights, bloom,
 * floor and camera all lock to this so the party feels like it has a track.
 */
export function createBeat(bpm = 128) {
  const perBeat = 60 / bpm;
  const listeners = [];
  let lastIndex = -1;
  let phase = 0;

  return {
    /** 0..1 within the current beat. */
    get phase() {
      return phase;
    },
    /** 1 exactly on the beat, decaying to 0. */
    get pulse() {
      return Math.pow(1 - phase, 3);
    },
    onBeat(cb) {
      listeners.push(cb);
    },
    update(t) {
      const beats = t / perBeat;
      const index = Math.floor(beats);
      phase = beats - index;
      if (index !== lastIndex) {
        lastIndex = index;
        for (const cb of listeners) cb(index);
      }
    },
  };
}
