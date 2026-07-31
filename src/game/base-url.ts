// ── Base-relative URLs ──
// The game runs at two mount points: standalone at the root of its own
// deployment, and same-origin under TheMotoHub at /rush-app/ (a Next.js
// rewrite proxies that prefix to this deployment). Absolute "/models/…" and
// "/api/…" paths break under the prefix, so everything resolves against
// document.baseURI, which is the page's own URL in both cases.
//
// Same-origin matters: in a cross-origin frame browsers partition or block
// storage, which took the boot down inside the app.

export function url(path: string): string {
  return new URL(path.replace(/^\//, ''), document.baseURI).toString();
}

export function apiBase(): string {
  return url('api');
}
