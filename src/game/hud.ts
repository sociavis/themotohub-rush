import type { BikeState, MXTimer } from './types';
import { MX_TRACKS } from './tracks';
import { fmtMXTime, globalStats } from './stats';
import { getWRForTrack } from './leaderboard';
import { isLoggedIn, getUser } from './auth';

function el(id: string, v: string): void {
  document.getElementById(id)!.textContent = v;
}

let fCount = 0;
let fLast = 0;
export let fps = 60;

export function tickFPS(t: number): void {
  fCount++;
  if (t - fLast >= 1) { fps = fCount; fCount = 0; fLast = t; }
}

export function uptime(t: number): string {
  const s = Math.floor(t);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return `${h.toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}

export function updateHUD(
  mxBike: BikeState,
  mxTimer: MXTimer,
  mxTrackIdx: number,
  mxAccel: boolean,
): void {
  const trk = MX_TRACKS[mxTrackIdx];
  const now = performance.now() / 1000;
  const lapTimeStr = mxTimer.running ? fmtMXTime(now - mxTimer.lapStart) : '--:--.--';
  const totalTimeStr = mxTimer.running ? fmtMXTime(now - mxTimer.start) : '--:--.--';
  const bestKey = trk.name;
  const bestStr = mxTimer.bestLapTimes[bestKey] ? fmtMXTime(mxTimer.bestLapTimes[bestKey]) : '--:--.--';
  const bikeStatus = mxBike.airborne ? 'AIRBORNE' : mxBike.wheelie ? 'WHEELIE' : mxAccel ? 'THROTTLE' : mxBike.speed > 1 ? 'COASTING' : 'IDLE';

  el('hud-l1', 'Race Status');
  el('hud-v1', mxTimer.running ? 'RACING' : 'READY');
  el('hud-d1', fps + ' FPS');
  el('hud-d2', 'LAP ' + (mxTimer.lap + 1) + '/' + mxTimer.laps);

  const serverWR = getWRForTrack(trk.name);
  const globalWR = globalStats['wr_' + trk.name];
  const localBest = mxTimer.bestLapTimes[bestKey];
  const wrTime = serverWR ? serverWR.lapTime : (globalWR && globalWR > 0 ? (localBest && localBest < globalWR ? localBest : globalWR) : (localBest || 0));
  const wrStr = wrTime > 0 ? fmtMXTime(wrTime) : '--:--.--';
  const wrHolder = serverWR ? serverWR.displayName : '';
  el('hud-l2', 'Track');
  el('hud-v2', trk.name + ' ' + (mxTrackIdx + 1) + '/' + MX_TRACKS.length);
  el('hud-d3', 'WR: ' + wrStr + (wrHolder ? ' — ' + wrHolder : ''));

  el('hud-l3', 'Lap');
  el('hud-v3', lapTimeStr);
  el('hud-d4', 'TOTAL: ' + totalTimeStr + '  BEST: ' + bestStr);

  el('hud-l4', 'Bike Status');
  el('hud-v4', bikeStatus);
  el('hud-d5', 'SPD: ' + mxBike.speed.toFixed(1));
}
