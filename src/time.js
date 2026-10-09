// Pure time logic, ported from the original page. No three.js here.

export const TARGET_HOUR = 15;
// The "day of waiting" used to ramp the floor colour: 09:00 -> 15:00.
export const FILL_WINDOW_MS = 6 * 3600 * 1000;

/**
 * Reads URL params and computes the target timestamp.
 *  ?test=N   N-second countdown for demos
 *  ?party=1  skip straight to the party
 *  ?off=a,b  disable effects by name (after, rgb, glitch, strobe, explode, rain, pulse, whip, hue), for tuning
 * Otherwise: today at 15:00 in the browser's local time. If that is already in
 * the past the page stays in party mode for the rest of the day (no rollover).
 */
export function getConfig(search = location.search, now = Date.now()) {
  const params = new URLSearchParams(search);
  const testSecs = parseInt(params.get('test') ?? '', 10);
  const forceParty = params.get('party') === '1';
  const off = new Set((params.get('off') ?? '').split(',').filter(Boolean));

  if (forceParty) {
    return { targetMs: now - 1, fillWindowMs: FILL_WINDOW_MS, isTest: true, forceParty, off };
  }
  if (Number.isFinite(testSecs) && testSecs > 0) {
    return { targetMs: now + testSecs * 1000, fillWindowMs: testSecs * 1000, isTest: true, forceParty, off };
  }
  const t = new Date(now);
  t.setHours(TARGET_HOUR, 0, 0, 0);
  return { targetMs: t.getTime(), fillWindowMs: FILL_WINDOW_MS, isTest: false, forceParty, off };
}

const pad = (n) => String(n).padStart(2, '0');

/** HH:MM:SS when more than an hour remains, otherwise MM:SS. */
export function formatRemaining(ms) {
  const diff = Math.max(0, ms);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export const isUrgent = (ms) => ms > 0 && ms < 60000;

/** 0.05 at the start of the waiting window, 1 at beer time. */
export function fillFraction(ms, windowMs) {
  return Math.min(1, Math.max(0.05, 1 - ms / windowMs));
}
