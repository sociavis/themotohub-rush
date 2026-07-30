// ── Host bridge (TheMotoHub / any iframe or WebView host) ──
// Outbound events + inbound commands between the game and a host app.
// Contract documented in BRIDGE.md.

import { hostLogin, getUser } from './auth';

const QP = new URLSearchParams(location.search);
export const IS_EMBED = QP.has('embed');

export function getUrlHostToken(): string | null {
  return QP.get('hostToken');
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
