import type { TrackDef } from './types';

export const MX_TRACKS: TrackDef[] = [
  {
    name: 'DUST BOWL',
    envColor: [255, 145, 40],
    envType: 'desert',
    // Flowing loop inspired by heightmap — wide right sweep, tight left return.
    // Beginner-friendly: tabletops and rollers, one easy double late.
    pts: [
      [0, 0], [6, 6], [16, 12], [28, 14], [40, 10],
      [48, 2], [50, -10], [44, -20], [32, -26],
      [18, -24], [8, -18], [2, -10], [-4, -4],
    ],
    obs: [
      { type: 'hill', at: 0.04, h: 1.4, len: 0.07 },        // roller off the start
      { type: 'tabletop', at: 0.13, h: 2.6, len: 0.15 },    // big tabletop (top-left peak)
      { type: 'berm', at: 0.30, side: 1 },                  // right berm into descent
      { type: 'rhythm', at: 0.34, h: 1.5, len: 0.12, count: 3 }, // rollers through the S
      { type: 'tabletop', at: 0.48, h: 2.2, len: 0.12 },    // second tabletop
      { type: 'berm', at: 0.62, side: -1 },                 // left berm at bottom sweep
      { type: 'double', at: 0.66, h: 2.2, len: 0.13 },      // friendly double on the run home
      { type: 'whoops', at: 0.80, h: 0.7, len: 0.08, count: 5 }, // short whoop set
      { type: 'berm', at: 0.90, side: 1 },                  // berm into finish
    ],
  },
  {
    name: 'GLACIER RUN',
    envColor: [100, 210, 255],
    envType: 'ice',
    // Long flowing sweeps — momentum track, low grip rewards smooth lines.
    pts: [
      [0, 0], [16, 5], [34, 7], [50, 5], [60, -2],
      [58, -14], [46, -22], [30, -24], [14, -20], [2, -14], [-4, -4],
    ],
    obs: [
      { type: 'tabletop', at: 0.08, h: 2.0, len: 0.13 },
      { type: 'berm', at: 0.24, side: 1 },
      { type: 'rhythm', at: 0.28, h: 1.4, len: 0.11, count: 3 },
      { type: 'hill', at: 0.42, h: 2.8, len: 0.14 },        // big crest — natural launch
      { type: 'berm', at: 0.56, side: -1 },
      { type: 'whoops', at: 0.60, h: 0.6, len: 0.09, count: 6 },
      { type: 'tabletop', at: 0.72, h: 1.8, len: 0.11 },
      { type: 'berm', at: 0.84, side: 1 },
    ],
  },
  {
    name: 'NEON CITY',
    envColor: [220, 40, 180],
    envType: 'neon',
    // Street-circuit rhythm: doubles and rhythm lanes between the berms.
    pts: [
      [0, 0], [20, 10], [44, 14], [64, 10], [76, -4],
      [72, -22], [56, -34], [36, -40], [16, -36], [0, -44],
      [-14, -30], [-18, -14], [-12, -4],
    ],
    obs: [
      { type: 'double', at: 0.06, h: 2.4, len: 0.12 },
      { type: 'berm', at: 0.18, side: 1 },
      { type: 'rhythm', at: 0.22, h: 1.6, len: 0.13, count: 4 },
      { type: 'berm', at: 0.42, side: -1 },
      { type: 'tabletop', at: 0.46, h: 2.4, len: 0.12 },
      { type: 'berm', at: 0.66, side: 1 },
      { type: 'double', at: 0.70, h: 2.6, len: 0.13 },
      { type: 'whoops', at: 0.84, h: 0.8, len: 0.09, count: 6 },
      { type: 'berm', at: 0.94, side: -1 },
    ],
  },
  {
    name: 'VOLCANIC RIDGE',
    envColor: [255, 60, 20],
    envType: 'volcanic',
    // Figure-8 crossover — the technical one. Big commitment doubles.
    pts: [
      [0, 0], [16, 8], [32, 4], [40, -8], [32, -20],
      [16, -16], [0, -24], [-16, -20], [-24, -8],
      [-16, 4], [-8, 12], [0, 8],
    ],
    obs: [
      { type: 'hill', at: 0.05, h: 2.8, len: 0.13 },
      { type: 'berm', at: 0.15, side: 1 },
      { type: 'double', at: 0.20, h: 2.8, len: 0.14 },      // big double after berm
      { type: 'berm', at: 0.38, side: -1 },
      { type: 'whoops', at: 0.42, h: 0.9, len: 0.1, count: 7 }, // gnarly whoops
      { type: 'double', at: 0.55, h: 3.0, len: 0.15 },      // the big one
      { type: 'berm', at: 0.72, side: 1 },
      { type: 'rhythm', at: 0.76, h: 1.7, len: 0.12, count: 4 },
      { type: 'berm', at: 0.92, side: -1 },
    ],
  },
  {
    name: 'RAINFOREST',
    envColor: [30, 200, 80],
    envType: 'jungle',
    // Tight S-curves with switchbacks — rhythm-heavy flow track.
    pts: [
      [0, 0], [18, 4], [30, 14], [20, 24], [4, 20],
      [-8, 10], [-4, -4], [12, -12], [28, -8], [36, -20],
      [24, -30], [6, -26], [-6, -14],
    ],
    obs: [
      { type: 'rhythm', at: 0.04, h: 1.5, len: 0.12, count: 3 },
      { type: 'berm', at: 0.18, side: -1 },
      { type: 'tabletop', at: 0.22, h: 2.0, len: 0.12 },
      { type: 'berm', at: 0.36, side: 1 },
      { type: 'whoops', at: 0.40, h: 0.7, len: 0.09, count: 5 },
      { type: 'berm', at: 0.52, side: -1 },
      { type: 'hill', at: 0.56, h: 2.2, len: 0.12 },
      { type: 'berm', at: 0.68, side: 1 },
      { type: 'rhythm', at: 0.72, h: 1.6, len: 0.13, count: 4 },
      { type: 'berm', at: 0.88, side: -1 },
      { type: 'hill', at: 0.92, h: 1.6, len: 0.08 },
    ],
  },
  {
    name: 'MIDNIGHT STADIUM',
    envColor: [180, 100, 255],
    envType: 'stadium',
    // Supercross: everything tight, whoop wall, triple-sized double.
    pts: [
      [0, 0], [24, 2], [40, 10], [44, 24], [32, 30],
      [16, 24], [8, 14], [16, 4], [28, -4], [36, -16],
      [24, -28], [8, -24], [-4, -14], [-8, -4],
    ],
    obs: [
      { type: 'double', at: 0.04, h: 2.6, len: 0.13 },      // launch straight out of the gate
      { type: 'berm', at: 0.17, side: 1 },
      { type: 'rhythm', at: 0.21, h: 1.7, len: 0.13, count: 4 },
      { type: 'berm', at: 0.36, side: -1 },
      { type: 'double', at: 0.40, h: 3.0, len: 0.15 },      // stadium triple
      { type: 'berm', at: 0.56, side: 1 },
      { type: 'whoops', at: 0.60, h: 0.9, len: 0.11, count: 8 }, // SX whoop wall
      { type: 'berm', at: 0.74, side: -1 },
      { type: 'tabletop', at: 0.78, h: 2.4, len: 0.12 },
      { type: 'berm', at: 0.92, side: 1 },
    ],
  },
];

export const TRACK_W = 3;
export const MX_CHECKPOINTS = 4;
