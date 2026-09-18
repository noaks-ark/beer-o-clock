export const COUNTDOWN = 'countdown';
export const BLAST = 'blast';
export const PARTY = 'party';

export const BLAST_MS = 1500;

/**
 * Tiny state machine: COUNTDOWN -> BLAST -> PARTY.
 * BLAST advances to PARTY on its own after BLAST_MS, driven from the
 * animation loop so it stays in step with the scene clock.
 */
export function createState() {
  const listeners = { [COUNTDOWN]: [], [BLAST]: [], [PARTY]: [] };
  let current = COUNTDOWN;
  let enteredAt = 0;

  const api = {
    get current() {
      return current;
    },
    /** Seconds spent in the current state. */
    since(t) {
      return t - enteredAt;
    },
    is(name) {
      return current === name;
    },
    on(name, cb) {
      listeners[name].push(cb);
    },
    set(name, t) {
      if (name === current) return;
      current = name;
      enteredAt = t;
      for (const cb of listeners[name]) cb(t);
    },
    update(t) {
      if (current === BLAST && api.since(t) >= BLAST_MS / 1000) api.set(PARTY, t);
    },
  };
  return api;
}

/**
 * Where to start. Opening the page after 15:00 goes straight to the party,
 * like the original. A recent expiry (or ?party=1) shows the blast so demos
 * still get the pop.
 */
export function bootState(remainingMs, forceParty) {
  if (remainingMs > 0) return COUNTDOWN;
  if (forceParty || remainingMs > -5000) return BLAST;
  return PARTY;
}
