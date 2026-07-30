# Host Bridge — embedding TheMotoHub RUSH in a host app

The contract for embedding the game in TheMotoHub (or any host) with single
sign-on, so riders never create a second account. Everything here is
game-side complete; a host only needs to (1) mint a token and (2) listen for
events.

## Embed URLs

| URL | Behavior |
| --- | --- |
| `/?embed=1&hostToken=<jwt>` | **Recommended.** Silent SSO login, straight to menu |
| `/?embed=1&sso=1` | Game waits up to 4s for a `host-auth` postMessage, then falls back to guest |
| `/?embed=1&guest=1` | Guest mode, no accounts |
| `/?embed=1` | Normal login/register screen inside the embed |

`embed=1` hides the Socia site chrome and enables host messaging. If SSO
fails for any reason the game still starts (guest), so the arcade never
hard-blocks on auth.

## SSO token

A standard **HS256 JWT** signed with the shared secret (`HOST_SSO_SECRET`
env var on the game's Vercel project — the host signs with the same value).

Payload claims:

| Claim | Type | Required | Notes |
| --- | --- | --- | --- |
| `sub` | string | ✅ | Host's stable user id. Prefix it, e.g. `tmh:<supabase-uuid>` |
| `exp` | number | ✅ | Unix seconds. Keep short (60s is plenty — it's only used once per launch) |
| `name` | string | — | Display name; used to mint the game username on first launch |
| `num` | number | — | Racer number 1–999 (kept in sync on every launch) |
| `country` | string | — | Kept in sync on every launch |

First launch with a new `sub` auto-provisions a game account (no password —
the account is SSO-only). Later launches update racer number / country from
the claims; the game username stays stable.

Mint example (Node, host side):

```js
import crypto from 'crypto';

function mintGameToken(user, secret) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    sub: `tmh:${user.id}`,
    name: user.displayName,
    num: user.racerNumber,
    country: user.country,
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const sig = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
```

Endpoint used by the game: `POST /api/auth/host-login` `{ token }` → same
response shape as `/api/auth/login`.

## Messages: game → host

`window.postMessage` to the parent, always `{ source: 'socia-mx', ... }`:

| `type` | Payload | When |
| --- | --- | --- |
| `ready` | — | Game booted |
| `sso-waiting` | — | Game is waiting for a `host-auth` message (`sso=1` mode) |
| `authed` | `user: { username, racerNumber, country }` | SSO login succeeded |
| `auth-failed` | `error` | SSO login failed (game continues as guest/login screen) |
| `race-complete` | `track`, `lapTime`, `bestLap`, `newBest` | Rider finishes a race |

## Messages: host → game

Post to the iframe/WebView `contentWindow`, always `{ target: 'socia-mx', ... }`:

| `type` | Payload | Notes |
| --- | --- | --- |
| `host-auth` | `token` | SSO token via postMessage (for hosts that can't set the URL). Send after `sso-waiting` (or `ready`). Only honored before the game starts |

## Mobile notes

- Landscape is the intended racing orientation. In portrait on touch devices
  the game shows a non-blocking "rotate your device" hint for 3s when racing
  starts; it never blocks play.
- Touch controls (hold-throttle, slide-steer, wheelie button) are built in.
- In a Capacitor/WKWebView host, allow rotation on the arcade screen if the
  rest of the app is portrait-locked.

## Local testing

`host-sim.html` (dev only, served by `npm run dev`, not part of the build)
simulates a host: it embeds the game, mints real HS256 tokens in-browser from
a secret you paste, and logs every bridge message. API routes require
`vercel dev` (see README) with `HOST_SSO_SECRET` set.
