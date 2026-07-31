import type { TrackDef } from './types';

export const MX_TRACKS: TrackDef[] = [
  {
    name: 'DUST BOWL',
    hills: [[2.2, 1, 0.7], [1.0, 2, 2.4]],
    envColor: [255, 145, 40],
    envType: 'desert',
    // Flowing loop inspired by heightmap — wide right sweep, tight left return.
    // Beginner-friendly: tabletops and rollers, one easy double late.
    pts: [
      [-29.1, 14.8], [-44.8, 9.7], [-45.4, -3.4], [-27.9, -12.6], [-14.0, -16.3],
      [-6.2, -26.1], [7.4, -36.0], [19.0, -30.8], [21.3, -19.0], [29.1, -14.8],
      [44.8, -9.7], [45.4, 3.4], [27.9, 12.6], [14.0, 16.3], [6.2, 26.1],
      [-7.4, 36.0], [-19.0, 30.8], [-21.3, 19.0],
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
    hills: [[3.0, 1, 1.6]],
    envColor: [100, 210, 255],
    envType: 'ice',
    // Long flowing sweeps — momentum track, low grip rewards smooth lines.
    pts: [
      [34.7, -16.3], [36.1, -8.0], [45.2, 1.7], [38.8, 15.4], [18.5, 21.2],
      [3.6, 22.2], [-10.2, 31.4], [-30.3, 39.4], [-39.9, 30.9], [-34.7, 16.3],
      [-36.1, 8.0], [-45.2, -1.7], [-38.8, -15.4], [-18.5, -21.2], [-3.6, -22.2],
      [10.2, -31.4], [30.3, -39.4], [39.9, -30.9],
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
    hills: [[0.9, 2, 0.3]],
    envColor: [220, 40, 180],
    envType: 'neon',
    // Folded SX street circuit: parallel lanes, 180 bowl turns, night city.
    pts: [
      [0, 0], [20, -2], [40, 2], [58, 0], [70, 8],
      [72, 20], [60, 28], [38, 24], [16, 28], [0, 26],
      [-12, 34], [-10, 46], [2, 54], [24, 50], [46, 54],
      [64, 50], [78, 42], [86, 26], [84, 6], [72, -8],
      [48, -14], [24, -16], [4, -15], [-10, -12], [-16, -4], [-10, 3],
    ],
    obs: [
      { type: 'rhythm', at: 0.02, h: 1.5, len: 0.09, count: 3 },
      { type: 'berm', at: 0.150, side: 1 },
      { type: 'rhythm', at: 0.24, h: 1.6, len: 0.10, count: 4 },
      { type: 'berm', at: 0.380, side: 1 },
      { type: 'whoops', at: 0.46, h: 0.8, len: 0.09, count: 6 },
      { type: 'berm', at: 0.615, side: -1 },
      { type: 'double', at: 0.72, h: 2.6, len: 0.12 },
      { type: 'tabletop', at: 0.82, h: 2.4, len: 0.10 },
      { type: 'berm', at: 0.925, side: 1 },
    ],
  },
  {
    name: 'VOLCANIC RIDGE',
    hills: [[2.2, 2, 1.0], [0.8, 3, 0.2]],
    envColor: [255, 60, 20],
    envType: 'volcanic',
    // Canyon switchbacks — the technical one. Big commitment doubles.
    pts: [
      [-35.8, -13.8], [-30.5, -24.7], [-14.5, -22.3], [-6.6, -24.8], [2.1, -38.3],
      [14.2, -36.7], [16.8, -20.7], [21.6, -13.9], [37.1, -9.8], [39.2, 2.2],
      [24.8, 9.6], [19.9, 16.2], [20.9, 32.2], [10.1, 37.9], [-1.4, 26.6],
      [-9.3, 24.0], [-24.3, 29.8], [-33.0, 21.3], [-25.7, 6.8], [-25.7, -1.4],
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
    hills: [[2.0, 1, 3.6], [1.2, 3, 1.1]],
    envColor: [30, 200, 80],
    envType: 'jungle',
    // Tight S-curves with switchbacks — rhythm-heavy flow track.
    pts: [
      [-9.5, -26.6], [-1.4, -28.8], [10.4, -37.9], [23.1, -32.2], [23.9, -14.7],
      [22.0, -3.0], [30.5, 8.2], [35.5, 25.3], [23.9, 32.3], [9.5, 26.6],
      [1.4, 28.8], [-10.4, 37.9], [-23.1, 32.2], [-23.9, 14.7], [-22.0, 3.0],
      [-30.5, -8.2], [-35.5, -25.3], [-23.9, -32.3],
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
    hills: [[0.6, 2, 2.6]],
    envColor: [180, 100, 255],
    envType: 'stadium',
    // Folded supercross: lanes + 180 bowls, whoop wall, stadium triple.
    pts: [
      [0, 0], [24, 0], [46, 0], [60, 10], [58, 24],
      [44, 30], [20, 26], [-2, 30], [-16, 38], [-14, 50],
      [0, 56], [22, 52], [40, 56], [56, 50], [68, 36],
      [70, 12], [60, -8], [36, -16], [14, -18], [-6, -16],
      [-16, -8], [-17, 2],
    ],
    obs: [
      { type: 'double', at: 0.03, h: 2.6, len: 0.11 },
      { type: 'berm', at: 0.155, side: 1 },
      { type: 'rhythm', at: 0.21, h: 1.7, len: 0.11, count: 4 },
      { type: 'berm', at: 0.385, side: 1 },
      { type: 'whoops', at: 0.45, h: 0.9, len: 0.09, count: 7 },
      { type: 'berm', at: 0.60, side: -1 },
      { type: 'double', at: 0.70, h: 3.0, len: 0.13 },
      { type: 'tabletop', at: 0.80, h: 2.4, len: 0.10 },
      { type: 'berm', at: 0.925, side: 1 },
    ],
  },
];

export const TRACK_W = 3;
export const MX_CHECKPOINTS = 4;
