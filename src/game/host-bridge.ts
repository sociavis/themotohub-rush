// ── Host bridge (TheMotoHub / any iframe or WebView host) ──
// Outbound events + inbound commands between the game and a host app.
// Contract documented in BRIDGE.md.

import { hostLogin, getUser } from './auth';

const QP = new URLSearchParams(location.search);
export const IS_EMBED = QP.has('embed');

export function getUrlHostToken(): string | null {
  return QP.get('hostToken');
}

// When the host navigates to the game as a full page (rather than framing it
// — iOS WebViews kill nested WebGL frames), ?back=<path> asks us to render a
// return control that goes back to the host app.
export function getBackUrl(): string | null {
  const b = QP.get('back');
  if (!b) return null;
  // same-origin paths only — never navigate somewhere a query param names
  return b.startsWith('/') && !b.startsWith('//') ? b : null;
}

// Inside TheMotoHub's native shell the app is portrait-locked; the game
// needs landscape. The Capacitor bridge is available to any page the
// WebView loads, so lock it here rather than adding host-side per-route
// logic. The app re-locks portrait when the rider returns.
interface CapBridge {
  isNativePlatform?: () => boolean;
  Plugins?: { ScreenOrientation?: { lock: (o: { orientation: string }) => Promise<void> } };
}

export function lockLandscapeInApp(): void {
  try {
    const cap = (window as unknown as { Capacitor?: CapBridge }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    cap.Plugins?.ScreenOrientation?.lock({ orientation: 'landscape' })
      .catch(() => { /* best-effort — the rotate gate still guides the rider */ });
  } catch { /* not in a native shell */ }
}

export function installBackButton(): void {
  const back = getBackUrl();
  if (!back) return;
  const el = document.createElement('div');
  el.id = 'hostBack';
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', 'Back to TheMotoHub');
  el.innerHTML = '&#10005;';
  el.addEventListener('click', () => { location.href = back; });
  document.body.appendChild(el);
}

export function postToHost(msg: Record<string, unknown>): void {
  try {
    if (window.parent !== window) {
      window.parent.postMessage({ source: 'socia-mx', ...msg }, '*');
    }
  } catch { /* cross-origin host — ignore */ }
}

// Attempt SSO with a host-minted token; posts the outcome to the host.
export async function tryHostLogin(token: string): Promise<boolean> {
  const result = await hostLogin(token);
  if (result.ok) {
    const u = getUser();
    postToHost({ type: 'authed', user: { username: u?.username, racerNumber: u?.racerNumber, country: u?.country } });
    return true;
  }
  postToHost({ type: 'auth-failed', error: result.error || 'unknown' });
  return false;
}

// Inbound commands from the host. `host-auth` lets hosts that can't control
// the embed URL deliver the SSO token via postMessage instead. Only handled
// before the game has started (mid-session identity switches are not supported).
let preStartAuthHandler: ((token: string) => void) | null = null;

export function setPreStartAuthHandler(fn: ((token: string) => void) | null): void {
  preStartAuthHandler = fn;
}

export function initHostBridge(): void {
  if (!IS_EMBED) return;
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data;
    if (!d || d.target !== 'socia-mx') return;
    if (d.type === 'host-auth' && typeof d.token === 'string' && preStartAuthHandler) {
      preStartAuthHandler(d.token);
    }
  });
}
