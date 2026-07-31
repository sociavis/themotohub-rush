# TheMotoHub RUSH

A 3D motocross time-attack game built with Three.js + TypeScript + Vite, with a
Vercel serverless backend (auth, leaderboards, progress sync). Built by Socia
Visual for TheMotoHub's arcade.

Bike model: based on "(FREE) Honda CRF 450" by
[Jacobdesigns](https://sketchfab.com/Jacobdesigns) on Sketchfab, licensed
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) (de-badged and
re-rigged for the game). Rider model: based on
"Low-poly Motocross Character (rigged)" by
[XHeheX](https://sketchfab.com/XHeheX) on Sketchfab, licensed
[CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/) (posed via
runtime IK against the bike's grip/peg attach points). Trackside props: based
on "low poly Motocross Assets" by
[e-restrepo1114](https://sketchfab.com/EmanuelRestrepoVelez) on Sketchfab,
licensed [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/).

**Play:** https://socia-visual-mx.vercel.app

## Features

- Procedural low-poly MX bike with articulated rider (seated / attack / wheelie /
  leg-out cornering poses), working fork + shock suspension travel, and roost
- 6 venues: desert, alpine snow, night city SX, dusk ridge, forest, night stadium —
  each with its own sky, lighting, terrain and trackside props
- Chase camera with speed-based FOV and landing shake
- Rider accounts, per-track leaderboards + world records, achievements,
  upgrade shop (tires / engine / gearbox / suspension) and bike colorways
- Full touch support (hold to throttle, slide to steer, wheelie button)

## Development

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run build      # production build to dist/
```

Deployed on Vercel; API routes live in `api/` (Vercel serverless functions +
Vercel Postgres).

## Embedding in TheMotoHub (or any host app)

The game is built to run inside an iframe or a mobile WebView:

```
https://socia-visual-mx.vercel.app/?embed=1&guest=1
```

- `embed=1` — hides the Socia site chrome (logo, contact, stats buttons) and
  enables host messaging
- `guest=1` — skips the login/welcome screen and drops straight into the menu
  (omit it if you want riders to log in for leaderboards)
- `hostToken=<jwt>` — **single sign-on**: silently logs the rider into a game
  account linked to the host app's user, no second account. Full contract
  (token format, `sso=1` postMessage mode, event list, local host simulator)
  in [BRIDGE.md](BRIDGE.md).

### Web (iframe)

```html
<iframe
  src="https://socia-visual-mx.vercel.app/?embed=1&guest=1"
  style="border:0;width:100%;height:100%"
  allow="fullscreen"
></iframe>
```

### React Native WebView

```jsx
<WebView
  source={{ uri: 'https://socia-visual-mx.vercel.app/?embed=1&guest=1' }}
  allowsFullscreenVideo
  onMessage={onGameMessage}
/>
```

### Host messages

In embed mode the game posts messages to its parent window
(`window.postMessage`, `source: 'socia-mx'`):

| Message | Payload | When |
| --- | --- | --- |
| `{ type: 'ready' }` | — | game booted |
| `{ type: 'sso-waiting' }` | — | waiting for a `host-auth` message (`sso=1`) |
| `{ type: 'authed' }` | `user` | host SSO login succeeded |
| `{ type: 'auth-failed' }` | `error` | host SSO failed (game continues as guest) |
| `{ type: 'race-complete' }` | `track`, `lapTime`, `bestLap`, `newBest` | rider finishes a race |

```js
window.addEventListener('message', (e) => {
  if (e.data?.source !== 'socia-mx') return;
  if (e.data.type === 'race-complete') {
    console.log(`${e.data.track}: ${e.data.lapTime}s (best ${e.data.bestLap}s)`);
  }
});
```

