import * as THREE from 'three';

// ── Theme ──
export interface Theme {
  name: string;
  primary: RGB;
  secondary: RGB;
  accent: RGB;
  bg: RGB;
  grid: RGB;
}

export type RGB = [number, number, number];

// ── Track ──
// Obstacle vocabulary (all `at`/`len` in 0..1 spline space):
//   hill     — smooth roller, cosine profile
//   berm     — banked turn assist (side: -1 left / 1 right)
//   tabletop — ramp up, flat top, ramp down (safe jump)
//   double   — takeoff + gap + landing ramp; clearing it is faster, casing costs speed
//   whoops   — `count` small evenly-spaced bumps over `len` (skim at speed)
//   rhythm   — alternating small/medium rollers over `len` (flow section)
export interface TrackObstacle {
  type: 'hill' | 'berm' | 'tabletop' | 'double' | 'whoops' | 'rhythm';
  at: number;
  h?: number;
  len?: number;
  side?: number;
  count?: number;
}

export interface TrackDef {
  name: string;
  envColor: RGB;
  envType: 'desert' | 'ice' | 'neon' | 'volcanic' | 'jungle' | 'stadium';
  pts: [number, number][];
  obs: TrackObstacle[];
}

// ── Bike State ──
export interface BikeState {
  t: number;
  lat: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  brake: number;
  turnSpeed: number;
  angle: number;
  airborne: boolean;
  jumpVel: number;
  hOff: number;
  lean: number;
  driftFactor: number;
  pos: THREE.Vector3;
  suspBob: number;
  wheelie: boolean;
  wheelieBalance: number; // -1 to 1, 0 = perfect balance
  wheelieTime: number;
  vy: number;             // vertical velocity while terrain-following (m/s)
  pitch: number;          // smoothed chassis pitch (rad, negative = nose up)
}

// ── Timer / Race State ──
export interface MXTimer {
  running: boolean;
  start: number;
  lapStart: number;
  lapTime: number;
  bestLapTimes: Record<string, number>;
  curTrack: number;
  lap: number;
  laps: number;
  lastCP: number;
  cpsHit: Set<number>;
  clean: boolean;
  totalRaces: number;
  airTime: number;
  maxAir: number;
}

// ── Achievement ──
export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  desc: string;
  diff: 'easy' | 'medium' | 'hard' | 'epic';
  check: () => boolean;
  sec?: string;
}

// ── Achievement State ──
export interface AchievementState {
  unlocked: Set<string>;
  visited: Set<number>;
  maxHold: number;
  maxVel: number;
  themesUsed: Set<number>;
  elapsed: number;
  totalDist: number;
  clicksPerSec: number[];
  mxBermHits: number;
  mxRacesCompleted: number;
  mxLaps: number;
  mxMaxAir: number;
  mxBestTime: number;
  mxCleanLaps: number;
  mxTracksCompleted: number;
}

// ── Input State ──
export interface InputState {
  x: number;
  y: number;
  tx: number;
  ty: number;
  rx: number;
  ry: number;
  down: boolean;
  holdTime: number;
  clicks: number;
  vel: number;
  px: number;
  py: number;
  mx: number;
  mz: number;
  crx: number;
  cry: number;
  space: boolean;
}

// ── Global Stats ──
export interface GlobalStats {
  visits: number;
  time: number;
  achievements: number;
  sessions: number;
  mxRaces: number;
  mxBestTime: number;
  [key: string]: number; // for wr_DUST BOWL etc.
}

// ── Camera State ──
export interface CameraState {
  px: number;
  py: number;
  pz: number;
  lx: number;
  ly: number;
  lz: number;
}

export interface CameraTarget {
  px: number;
  py: number;
  pz: number;
  lx: number;
  ly: number;
  lz: number;
}

// ── Section ──
export interface Section {
  enter: () => void;
  exit: () => void;
  click: () => void;
  release?: () => void;
  update: (t: number) => void;
  hud: (t: number) => void;
}

// ── Particle ──
export interface ParticleData {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  c: RGB;
  life: number;
  ml: number;
  sz: number;
}
