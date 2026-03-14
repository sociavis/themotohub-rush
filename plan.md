# MX Game Expansion — Implementation Plan

## Overview
7 major features across 7 phases, building on the existing TypeScript + Three.js + Vite + Express codebase.

---

## Phase 1: Server, Database, Auth & Welcome Screen

### Database (SQLite via better-sqlite3)
```
users: id, username (unique), password_hash (bcrypt), display_name, created_at, last_login, total_races, total_laps, achievements (JSON)
lap_records: id, user_id, track_name, lap_time, recorded_at, was_clean, max_air_time
sessions: id, user_id, token (UUID), created_at, expires_at (+7 days)
```

### Server API
- `POST /api/auth/register` — {username, displayName, password}
- `POST /api/auth/login` — {username, password}
- `POST /api/auth/logout` — Bearer token
- `GET /api/auth/me` — returns user profile

### Client Auth Flow
- New `src/game/auth.ts` — token in localStorage, login/register/logout/checkSession
- New `src/ui/welcome.ts` — welcome screen overlay after loading completes

### Welcome Screen
- Shows after loading screen instead of jumping straight to game
- Logged out: "WELCOME, RIDER" + Login/Register forms + "Play as Guest" link
- Logged in: "WELCOME BACK, {name}" + personal bests + global rank + [RACE] button
- Styled with existing HUD aesthetic (Share Tech Mono, theme colors)

### Files
- New: `src/server/db.ts`, `src/server/auth.ts`, `src/game/auth.ts`, `src/ui/welcome.ts`
- Modify: `src/server/index.ts`, `src/ui/loading.ts`, `src/main.ts`, `index.html`
- New deps: `better-sqlite3`, `bcrypt`

---

## Phase 2: Leaderboard System

### Server
- `GET /api/leaderboard/:trackName` — top 20 times with usernames
- `GET /api/leaderboard/:trackName/rank/:userId` — user's rank
- `POST /api/leaderboard/submit` — {trackName, lapTime, wasClean, maxAirTime}

### Client
- New `src/game/leaderboard.ts` — fetch/cache leaderboard data
- Stats panel gains "Leaderboard" tab (alongside Session/Global)
- HUD shows `WR: {time} by {username}` and `YOUR RANK: #N`
- WR toast shows username attribution
- Guest users see "Login to save your records"

### Files
- New: `src/game/leaderboard.ts`
- Modify: `src/server/index.ts`, `src/game/stats.ts`, `src/game/hud.ts`, `src/game/achievements.ts`

---

## Phase 3: Three New Tracks (6 total)

### Track 4: "VOLCANIC RIDGE" (envType: 'volcanic')
- Color: [255, 60, 20] — deep red-orange
- Atmosphere: dark crimson fog, harsh lighting from below
- Environment: basalt columns, lava pools (glowing planes), volcanic rocks, rising ember particles
- Shape: tight switchbacks, 12 points, 6 obstacles (two large tabletops, two berms, two rhythm hills)

### Track 5: "RAINFOREST CIRCUIT" (envType: 'jungle')
- Color: [30, 200, 80] — rich green
- Atmosphere: humid green fog, dappled light
- Environment: tree trunks with canopy discs, hanging vines, ferns, moss rocks, firefly particles
- Shape: long flowing sweeps, 14 points, 7 obstacles (rhythm section of 3 hills, two berms, two jumps)

### Track 6: "MIDNIGHT STADIUM" (envType: 'stadium')
- Color: [180, 140, 255] — purple-violet
- Atmosphere: very dark with bright floodlights, high contrast
- Environment: stadium stands (stepped boxes), floodlight towers, advertising hoardings, crowd-like particles
- Shape: tight supercross-style, 11 points, 8 obstacles (whoops section, triple jump, two berms, tabletop)

### Files
- Modify: `src/game/types.ts` (extend envType union), `src/game/tracks.ts`, `src/game/track-builder.ts` (3 new buildEnvironment + setAtmosphere branches), `src/game/hud.ts` (dynamic track count), `src/game/achievements.ts`

---

## Phase 4: Wheelie Physics

### New BikeState fields
- `wheelie: boolean`, `wheelieAngle: number` (0–0.7 rad), `wheelieTimer: number`, `wheelieBalance: number` (-1 to 1)

### Trigger
- Desktop: hold Space while accelerating at speed > 6
- Mobile: repurpose existing `.mob-boost-btn` as wheelie button

### Physics
- Front wheel lifts, `wheelieAngle` ramps up to ~0.5–0.7 rad
- Balance drifts with random perturbations — player manages by releasing/re-pressing
- Speed bonus +5–10% while in wheelie, turning reduced 60%
- Flip-over crash if angle > 0.85 rad (speed drops to near-zero)
- Ends on: throttle release, jump, off-track, or manual cancel

### Visuals
- `bikeGroup.rotation.x` driven by wheelieAngle
- Extra roost from rear wheel, small sparks
- HUD balance bar indicator

### New achievements
- "Wheelie King" — hold 3+ seconds
- "Stunt Master" — wheelie through a berm

### Files
- Modify: `src/game/types.ts`, `src/game/bike.ts`, `src/game/input.ts` (Space key + mobile button), `src/main.ts` (wheelie logic in updateMX), `src/game/hud.ts`, `src/game/achievements.ts`

---

## Phase 5: Physics Improvements

### Weight Transfer
- New fields: `weightFront`, `weightRear` (0–1, sum to 1)
- Accel shifts weight rear, braking shifts forward
- Ties into wheelie (wheelie = weightRear > 0.95)

### Terrain Friction
- Per-envType coefficients: desert 0.85, ice 0.6, neon 0.95, volcanic 0.8, jungle 0.75, stadium 0.9
- Affects cornering grip, acceleration, braking
- Ice tracks have amplified drift

### Improved Jumps
- Launch velocity based on slope angle (steeper = bigger air)
- Calculate slope from height LUT gradient instead of flat `speed * 0.22`

### Landing Impact
- Impact severity based on fall velocity
- Slope-matched landings: speed preserved
- Flat landings from height: speed penalty + more particles + louder sound

### Cornering Speed Loss
- Speed reduction proportional to `abs(driftFactor) * speed`
- Berms negate this penalty

### Progressive Braking
- Speed-dependent deceleration rate instead of flat lerp

### Files
- Modify: `src/game/types.ts`, `src/game/bike.ts`, `src/game/tracks.ts` (friction per track), `src/main.ts`

---

## Phase 6: Particle Improvements

### Buffer increases
- MAXP: 800 → 1500, MX_ROOST_MAX: 50 → 120, MX_AMB_MAX: 40 → 80

### Environment-specific particles
- Desert: large tan dust clouds, sandy spray
- Ice: sparkling crystals, short life, upward drift
- Neon: color-cycling spark particles
- Volcanic: rising embers, falling ash
- Jungle: leaf particles, water splash, fireflies
- Stadium: confetti on lap completion, pyro sparks at finish

### New effects
- Tire smoke on hard braking/turning (abs(driftFactor) > 0.3 at speed > 8)
- Wheelie intensified roost + axle sparks
- Finish line celebration burst (50+ particles in theme colors)
- Landing impact particle burst scales with impact severity

### Files
- Modify: `src/game/particles.ts`, `src/game/track-builder.ts`

---

## Phase 7: Sound Improvements

### Engine overhaul
- Third harmonic oscillator (one octave up, quieter)
- Frequency range: 45–300Hz (was 55–180Hz)
- RPM-dependent exhaust crackle at high RPM
- Deceleration backfire (noise burst on throttle release at high speed)
- Idle rumble with amplitude modulation (LFO)

### New SFX
- `sndWheelieStart()` — rising pitch sweep 200→600Hz + noise burst
- `sndSkid()` — sustained noise at 2000–4000Hz, volume ∝ driftFactor
- `sndCrash()` — heavy low thud + distorted noise burst
- `sndBackfire()` — sharp pop

### Improved existing SFX
- `sndJump()` — pitch scales with launch speed + wind noise component
- `sndLanding()` — severity scales with landingImpact, suspension compress sweep
- `sndCheckpoint()` — three rapid ascending notes
- `sndSectionChange()` — add crowd cheer noise element

### Environmental ambient audio
- Desert: wind noise (filtered noise, slow modulation)
- Ice: crystalline wind + cracking sounds
- Neon: low hum drone
- Volcanic: deep sub-bass rumble
- Jungle: layered noise + random bird chirps
- Stadium: crowd noise (bandpass 500–2000Hz)

### Files
- Modify: `src/game/audio.ts`, `src/main.ts`
