import type { TrackDef } from './types';

export const MX_TRACKS: TrackDef[] = [
  {
    name: 'DUST BOWL',
    envColor: [255, 145, 40],
    envType: 'desert',
    pts: [
      [0, 0], [12, 5], [26, 7], [38, 4], [42, -4],
      [38, -14], [26, -19], [12, -18], [0, -12], [-4, -5],
    ],
    obs: [
      { type: 'hill', at: 0.10, h: 2.4, len: 0.16 },
      { type: 'berm', at: 0.32, side: 1 },
      { type: 'hill', at: 0.52, h: 2.6, len: 0.16 },
      { type: 'berm', at: 0.74, side: -1 },
    ],
  },
  {
    name: 'GLACIER RUN',
    envColor: [100, 210, 255],
    envType: 'ice',
    pts: [
      [0, 0], [16, 5], [34, 7], [50, 5], [60, -2],
      [58, -14], [46, -22], [30, -24], [14, -20], [2, -14], [-4, -4],
    ],
    obs: [
      { type: 'hill', at: 0.08, h: 2.2, len: 0.14 },
      { type: 'berm', at: 0.24, side: 1 },
      { type: 'hill', at: 0.40, h: 2.8, len: 0.14 },
      { type: 'berm', at: 0.56, side: -1 },
      { type: 'hill', at: 0.70, h: 2.0, len: 0.13 },
      { type: 'berm', at: 0.84, side: 1 },
    ],
  },
  {
    name: 'NEON CITY',
    envColor: [220, 40, 180],
    envType: 'neon',
    pts: [
      [0, 0], [20, 10], [44, 14], [64, 10], [76, -4],
      [72, -22], [56, -34], [36, -40], [16, -36], [0, -44],
      [-14, -30], [-18, -14], [-12, -4],
    ],
    obs: [
      { type: 'hill', at: 0.06, h: 2.0, len: 0.12 },
      { type: 'berm', at: 0.18, side: 1 },
      { type: 'hill', at: 0.30, h: 2.6, len: 0.13 },
      { type: 'berm', at: 0.42, side: -1 },
      { type: 'hill', at: 0.54, h: 2.0, len: 0.12 },
      { type: 'berm', at: 0.66, side: 1 },
      { type: 'hill', at: 0.76, h: 2.8, len: 0.13 },
      { type: 'berm', at: 0.88, side: -1 },
    ],
  },
  {
    name: 'VOLCANIC RIDGE',
    envColor: [255, 60, 20],
    envType: 'volcanic',
    // Figure-8 crossover layout
    pts: [
      [0, 0], [16, 8], [32, 4], [40, -8], [32, -20],
      [16, -16], [0, -24], [-16, -20], [-24, -8],
      [-16, 4], [-8, 12], [0, 8],
    ],
    obs: [
      { type: 'hill', at: 0.05, h: 3.0, len: 0.14 },
      { type: 'berm', at: 0.15, side: 1 },
      { type: 'hill', at: 0.28, h: 2.4, len: 0.13 },
      { type: 'berm', at: 0.38, side: -1 },
      { type: 'hill', at: 0.50, h: 3.2, len: 0.15 },
      { type: 'berm', at: 0.62, side: 1 },
      { type: 'hill', at: 0.75, h: 2.6, len: 0.13 },
      { type: 'berm', at: 0.88, side: -1 },
    ],
  },
  {
    name: 'RAINFOREST',
    envColor: [30, 200, 80],
    envType: 'jungle',
    // Tight S-curves with switchbacks
    pts: [
      [0, 0], [18, 4], [30, 14], [20, 24], [4, 20],
      [-8, 10], [-4, -4], [12, -12], [28, -8], [36, -20],
      [24, -30], [6, -26], [-6, -14],
    ],
    obs: [
      { type: 'hill', at: 0.06, h: 2.2, len: 0.12 },
      { type: 'berm', at: 0.14, side: -1 },
      { type: 'hill', at: 0.24, h: 2.6, len: 0.13 },
      { type: 'berm', at: 0.32, side: 1 },
      { type: 'berm', at: 0.44, side: -1 },
      { type: 'hill', at: 0.52, h: 1.8, len: 0.11 },
      { type: 'berm', at: 0.62, side: 1 },
      { type: 'hill', at: 0.72, h: 2.4, len: 0.13 },
      { type: 'berm', at: 0.82, side: -1 },
      { type: 'hill', at: 0.92, h: 2.0, len: 0.11 },
    ],
  },
  {
    name: 'MIDNIGHT STADIUM',
    envColor: [180, 100, 255],
    envType: 'stadium',
    // Technical layout with tight infield section
    pts: [
      [0, 0], [24, 2], [40, 10], [44, 24], [32, 30],
      [16, 24], [8, 14], [16, 4], [28, -4], [36, -16],
      [24, -28], [8, -24], [-4, -14], [-8, -4],
    ],
    obs: [
      { type: 'hill', at: 0.04, h: 2.8, len: 0.13 },
      { type: 'berm', at: 0.12, side: 1 },
      { type: 'hill', at: 0.22, h: 2.2, len: 0.11 },
      { type: 'berm', at: 0.30, side: -1 },
      { type: 'hill', at: 0.38, h: 3.0, len: 0.14 },
      { type: 'berm', at: 0.48, side: 1 },
      { type: 'hill', at: 0.56, h: 2.4, len: 0.12 },
      { type: 'berm', at: 0.66, side: -1 },
      { type: 'hill', at: 0.76, h: 2.6, len: 0.13 },
      { type: 'berm', at: 0.88, side: 1 },
    ],
  },
];

export const TRACK_W = 3;
export const MX_CHECKPOINTS = 4;
