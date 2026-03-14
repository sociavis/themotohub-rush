import type { GlobalStats, MXTimer } from './types';
import { T, rgba } from './themes';
import { achState, ACH_DEFS } from './achievements';
import { MX_TRACKS } from './tracks';
import { getCachedLeaderboard } from './leaderboard';
import { isLoggedIn, getUser } from './auth';

export const STATS_API = 'https://sociavisual.com/stats.php';

export let globalStats: GlobalStats = {
  visits: 0, time: 0, achievements: 0, sessions: 0, mxRaces: 0, mxBestTime: 0,
};
export let globalFetched = false;
let _statsPushed = false;
export let _mxRacesPushedLive = 0;
export function incrementMxRacesPushedLive(): void { _mxRacesPushedLive++; }

export function fetchGlobalStats(onDone?: () => void): void {
  fetch(STATS_API + '?action=get&_t=' + Date.now(), { cache: 'no-store' })
    .then(r => r.json())
    .then(d => {
      if (d && d.visits !== undefined) { globalStats = d; globalFetched = true; if (onDone) onDone(); }
    })
    .catch(() => {});
}

export function pushSessionStats(mxTimer: MXTimer): void {
  if (_statsPushed) return;
  _statsPushed = true;
  const wrTimes: Record<string, number> = {};
  MX_TRACKS.forEach(tr => {
    if (mxTimer.bestLapTimes[tr.name]) wrTimes['wr_' + tr.name] = Math.round(mxTimer.bestLapTimes[tr.name] * 100) / 100;
  });
  const remainingRaces = Math.max(0, achState.mxRacesCompleted - _mxRacesPushedLive);
  const data = {
    pulses: 0, trail: 0, wins: 0, freqs: 0, distance: 0,
    time: Math.round(achState.elapsed),
    achievements: achState.unlocked.size,
    topSpeed: 0,
    mxRaces: remainingRaces,
    mxBestTime: Math.round((achState.mxBestTime || 0) * 100) / 100,
    ...wrTimes,
  };
  navigator.sendBeacon(STATS_API + '?action=push', JSON.stringify(data));
}

export function reportVisit(): void {
  fetch(STATS_API + '?action=visit', { method: 'POST' }).catch(() => {});
}

// ── Stats Panel ──
let statsOpen = false;
let statsMode = 'local';
let _statsRefreshIv: ReturnType<typeof setInterval> | null = null;
const statsPanel = document.getElementById('statsPanel')!;
const globeBtn = document.getElementById('globeBtn')!;

let _lastBtnTap = 0;
function btnGuard(): boolean { const now = Date.now(); if (now - _lastBtnTap < 350) return false; _lastBtnTap = now; return true; }

export function fmtMXTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 100);
  return m.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0') + '.' + ms.toString().padStart(2, '0');
}

export function renderStats(mxTimer: MXTimer): void {
  const t = T();
  const sc = rgba(t.secondary, 1), pc = rgba(t.primary, 1);
  statsPanel.style.borderColor = rgba(t.primary, 0.3);
  statsPanel.style.color = rgba(t.primary, 0.8);
  statsPanel.style.background = rgba(t.bg, 0.92);

  const tabs = `<div class="stats-toggle"><button class="stats-toggle-btn${statsMode === 'local' ? ' active' : ''}" data-mode="local" style="color:${pc}">Session</button><button class="stats-toggle-btn${statsMode === 'global' ? ' active' : ''}" data-mode="global" style="color:${pc}">Global</button><button class="stats-toggle-btn${statsMode === 'leaderboard' ? ' active' : ''}" data-mode="leaderboard" style="color:${pc}">Board</button></div>`;

  if (statsMode === 'local') {
    const timeStr = Math.floor(achState.elapsed / 60) + 'm ' + Math.floor(achState.elapsed % 60) + 's';
    const userInfo = isLoggedIn() ? `<div class="stats-row"><span>Player</span><span class="stats-val" style="color:${sc}">${getUser()!.username} #${getUser()!.racerNumber}</span></div>` : '';
    statsPanel.innerHTML = `<div class="stats-close" id="statsClose">×</div><div class="stats-title">Statistics</div>${tabs}${userInfo}<div class="stats-row"><span>MX Races</span><span class="stats-val" style="color:${sc}">${achState.mxRacesCompleted}</span></div><div class="stats-row"><span>Session Time</span><span class="stats-val" style="color:${sc}">${timeStr}</span></div><div class="stats-row"><span>Achievements</span><span class="stats-val" style="color:${sc}">${achState.unlocked.size}/${ACH_DEFS.length}</span><span class="stats-bar"><span class="stats-bar-fill" style="width:${Math.round(achState.unlocked.size / ACH_DEFS.length * 100)}%;background:${pc}"></span></span></div><div class="stats-row" style="margin-top:6px"><span style="opacity:0.5;font-size:8px">LAP RECORDS</span></div>${MX_TRACKS.map(tr => `<div class="stats-row"><span>${tr.name}</span><span class="stats-val" style="color:${sc}">${mxTimer.bestLapTimes[tr.name] ? fmtMXTime(mxTimer.bestLapTimes[tr.name]) : '—'}</span></div>`).join('')}`;
  } else if (statsMode === 'global') {
    const g = globalStats;
    const gTimeStr = Math.floor((g.time || 0) / 3600) + 'h ' + Math.floor(((g.time || 0) % 3600) / 60) + 'm';
    const loading = !globalFetched ? '<div style="text-align:center;font-size:8px;opacity:0.4;margin:6px 0">[ Loading... ]</div>' : '';
    statsPanel.innerHTML = `<div class="stats-close" id="statsClose">×</div><div class="stats-title">Statistics</div>${tabs}${loading}<div class="stats-row"><span>Total Sessions</span><span class="stats-val" style="color:${sc}">${(g.sessions || 0).toLocaleString()}</span></div><div class="stats-row"><span>MX Races</span><span class="stats-val" style="color:${sc}">${(g.mxRaces || 0).toLocaleString()}</span></div><div class="stats-row"><span>Total Time</span><span class="stats-val" style="color:${sc}">${gTimeStr}</span></div><div class="stats-row"><span>Achievements Earned</span><span class="stats-val" style="color:${sc}">${(g.achievements || 0).toLocaleString()}</span></div><div class="stats-row" style="margin-top:6px"><span style="opacity:0.5;font-size:8px">LAP WORLD RECORDS</span></div>${MX_TRACKS.map(tr => `<div class="stats-row"><span>${tr.name}</span><span class="stats-val" style="color:${sc}">${g['wr_' + tr.name] && g['wr_' + tr.name] > 0 ? fmtMXTime(g['wr_' + tr.name]) : '—'}</span></div>`).join('')}`;
  } else {
    // Leaderboard mode
    let lbHtml = `<div class="stats-close" id="statsClose">×</div><div class="stats-title">Leaderboard</div>${tabs}`;
    for (const tr of MX_TRACKS) {
      const lb = getCachedLeaderboard(tr.name);
      lbHtml += `<div class="stats-row" style="margin-top:6px"><span style="opacity:0.5;font-size:8px">${tr.name.toUpperCase()}</span></div>`;
      if (lb && lb.entries.length > 0) {
        for (const e of lb.entries.slice(0, 5)) {
          lbHtml += `<div class="stats-row"><span style="opacity:0.5;width:16px">${e.rank}.</span><span>${e.displayName}</span><span class="stats-val" style="color:${sc}">${fmtMXTime(e.lapTime)}</span></div>`;
        }
      } else {
        lbHtml += `<div class="stats-row"><span style="opacity:0.4;font-size:9px">No times yet</span></div>`;
      }
    }
    statsPanel.innerHTML = lbHtml;
  }
  document.getElementById('statsClose')!.addEventListener('click', (e) => { e.stopPropagation(); toggleStats(mxTimer); });
  statsPanel.querySelectorAll('.stats-toggle-btn').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      statsMode = (b as HTMLElement).dataset.mode!;
      if (statsMode === 'global' && !globalFetched) fetchGlobalStats();
      renderStats(mxTimer);
    });
  });
}

export function toggleStats(mxTimer: MXTimer): void {
  statsOpen = !statsOpen;
  if (statsOpen) {
    renderStats(mxTimer);
    statsPanel.classList.add('open');
    fetchGlobalStats();
    _statsRefreshIv = setInterval(() => {
      fetchGlobalStats();
      if (statsMode === 'local') renderStats(mxTimer);
    }, 3000);
    setTimeout(() => document.addEventListener('click', function h(e) {
      if (!statsPanel.contains(e.target as Node) && e.target !== globeBtn) {
        toggleStats(mxTimer);
        document.removeEventListener('click', h);
      }
    }), 50);
  } else {
    statsPanel.classList.remove('open');
    if (_statsRefreshIv) { clearInterval(_statsRefreshIv); _statsRefreshIv = null; }
  }
}

export function initStatsListeners(mxTimer: MXTimer): void {
  globeBtn.addEventListener('click', (e) => { e.stopPropagation(); if (btnGuard()) toggleStats(mxTimer); });
  globeBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); if (btnGuard()) toggleStats(mxTimer); }, { passive: true });
}
