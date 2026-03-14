import { T, rgba } from '../game/themes';
import { MX_TRACKS } from '../game/tracks';
import { fmtMXTime } from '../game/stats';
import { getCachedLeaderboard } from '../game/leaderboard';

export type PostRaceAction = 'track-select' | 'menu' | 'retry';

let actionCallback: ((action: PostRaceAction) => void) | null = null;

export function showPostRace(
  trackIdx: number,
  bestLapTimes: Record<string, number>,
  lastLapTime: number,
  isNewBest: boolean,
  totalLaps: number,
  onAction: (action: PostRaceAction) => void,
): void {
  actionCallback = onAction;
  const el = document.getElementById('postRace')!;
  renderPostRace(trackIdx, bestLapTimes, lastLapTime, isNewBest, totalLaps);
  el.style.display = 'flex';
  el.style.opacity = '0';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

export function hidePostRace(): void {
  const el = document.getElementById('postRace')!;
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function renderPostRace(
  trackIdx: number,
  bestLapTimes: Record<string, number>,
  lastLapTime: number,
  isNewBest: boolean,
  totalLaps: number,
): void {
  const el = document.getElementById('postRace')!;
  const t = T();
  const trk = MX_TRACKS[trackIdx];
  const best = bestLapTimes[trk.name];
  const lb = getCachedLeaderboard(trk.name);

  let html = `
    <div class="pr-content">
      <div class="pr-title" style="color:${rgba(t.primary, 1)}">RACE COMPLETE</div>
      <div class="pr-track" style="color:rgb(${trk.envColor.join(',')})">${trk.name}</div>
      <div class="pr-time-label">BEST LAP</div>
      <div class="pr-time" style="color:${rgba(t.secondary, 1)}">${fmtMXTime(lastLapTime)}</div>
      ${isNewBest ? `<div class="pr-badge" style="color:rgba(255,215,0,0.9)">NEW PERSONAL BEST</div>` : ''}
      <div class="pr-best" style="color:${rgba(t.primary, 0.6)}">PB: ${best ? fmtMXTime(best) : '—'}</div>
  `;

  // Show leaderboard
  if (lb && lb.entries.length > 0) {
    html += `<div class="pr-lb-title" style="color:${rgba(t.primary, 0.5)}">LEADERBOARD</div>`;
    html += `<div class="pr-lb">`;
    for (const entry of lb.entries.slice(0, 8)) {
      const rankClass = entry.rank === 1 ? ' gold' : entry.rank === 2 ? ' silver' : entry.rank === 3 ? ' bronze' : '';
      html += `
        <div class="pr-lb-entry">
          <span class="pr-lb-rank${rankClass}">#${entry.rank}</span>
          <span class="pr-lb-name">${entry.displayName || entry.username}</span>
          <span class="pr-lb-time" style="color:${rgba(t.primary, 1)}">${fmtMXTime(entry.lapTime)}</span>
        </div>
      `;
    }
    html += `</div>`;
  }

  html += `
      <div class="pr-buttons">
        <button class="pr-btn pr-btn-retry" data-action="retry" style="border-color:rgb(${trk.envColor.join(',')});color:rgb(${trk.envColor.join(',')})">RETRY</button>
        <button class="pr-btn" data-action="track-select" style="border-color:${rgba(t.primary, 0.4)};color:${rgba(t.primary, 0.8)}">TRACKS</button>
        <button class="pr-btn" data-action="menu" style="border-color:${rgba(t.primary, 0.3)};color:${rgba(t.primary, 0.6)}">MENU</button>
      </div>
    </div>
  `;

  el.innerHTML = html;

  el.querySelectorAll('.pr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = (btn as HTMLElement).dataset.action as PostRaceAction;
      if (actionCallback) actionCallback(action);
    });
  });
}
