// ── Storage that can't kill the boot ──
// Embedded in a cross-origin iframe (TheMotoHub app, any WebView), browsers
// may block or partition storage: touching localStorage then throws a
// SecurityError. Unguarded access during startup took the whole game down —
// a black screen inside the app while the standalone site worked fine.
// These helpers degrade to an in-memory store instead of throwing.

const mem = new Map<string, string>();
let warned = false;

// Dev/QA: ?noStore=1 simulates a storage-blocked embed (third-party iframe,
// locked-down WebView) so the degraded path can be tested locally.
const FORCE_BLOCKED = typeof location !== 'undefined'
  && new URLSearchParams(location.search).has('noStore');

function unavailable(e: unknown): void {
  if (warned) return;
  warned = true;
  console.warn('[storage] localStorage unavailable — using in-memory session', e);
}

export function storeGet(key: string): string | null {
  try {
    if (FORCE_BLOCKED) throw new Error('storage blocked (noStore)');
    return localStorage.getItem(key);
  } catch (e) {
    unavailable(e);
    return mem.get(key) ?? null;
  }
}

export function storeSet(key: string, value: string): void {
  try {
    if (FORCE_BLOCKED) throw new Error('storage blocked (noStore)');
    localStorage.setItem(key, value);
  } catch (e) {
    unavailable(e);
    mem.set(key, value);
  }
}

export function storeRemove(key: string): void {
  try {
    if (FORCE_BLOCKED) throw new Error('storage blocked (noStore)');
    localStorage.removeItem(key);
  } catch (e) {
    unavailable(e);
    mem.delete(key);
  }
}
