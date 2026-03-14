import { T, rgba } from '../game/themes';
import { MX_TRACKS } from '../game/tracks';
import { fetchLeaderboard, getCachedLeaderboard } from '../game/leaderboard';
import { fmtMXTime } from '../game/stats';
import { mxTrackIdx } from '../game/track-builder';

let lbOpen = false;
let lbTrackIdx = 0;

export function initLeaderboardUI(): void {
  const btn = document.getElementById('leaderboardBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggleLeaderboard(); });
  btn.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); toggleLeaderboard(); }, { passive: false });
}

function toggleLeaderboard(): void {
  lbOpen = !lbOpen;
  const panel = document.getElementById('leaderboardPanel')!;
  if (lbOpen) {
    lbTrackIdx = mxTrackIdx;
    renderLeaderboard();
    panel.classList.add('open');
    // Close other panels
    document.getElementById('profilePanel')?.classList.remove('open');
    document.getElementById('shopPanel')?.classList.remove('open');
    document.getElementById('statsPanel')?.classList.remove('open');
    // Fetch fresh data
    fetchLeaderboard(MX_TRACKS[lbTrackIdx].name).then(() => renderLeaderboard());
  } else {
    panel.classList.remove('open');
  }
}

function renderLeaderboard(): void {
  const panel = document.getElementById('leaderboardPanel')!;
  const t = T();
  const trk = MX_TRACKS[lbTrackIdx];
  const lb = getCachedLeaderboard(trk.name);

  let html = `<div class="panel-title" style="color:${rgba(t.primary, 0.8)}">LEADERBOARDS</div>`;
  html += `<div class="panel-close" id="lbClose" style="color:${rgba(t.primary, 0.6)}">×</div>`;

  // Track tabs
  html += `<div class="lb-track-tabs">`;
  for (let i = 0; i < MX_TRACKS.length; i++) {
    const shortName = MX_TRACKS[i].name.split(' ')[0];
    html += `<div class="lb-track-tab${i === lbTrackIdx ? ' active' : ''}" data-track="${i}" style="color:${rgba(t.primary, 1)}">${shortName}</div>`;
  }
  html += `</div>`;

  // World record banner
  if (lb?.worldRecord) {
    html += `<div class="lb-wr-banner">`;
    html += `<div class="lb-wr-label">WORLD RECORD</div>`;
    html += `<div class="lb-wr-time">${fmtMXTime(lb.worldRecord.lapTime)}</div>`;
    html += `<div class="lb-wr-holder">${lb.worldRecord.displayName || lb.worldRecord.username}</div>`;
    html += `</div>`;
  }

  // Entries
  if (lb && lb.entries.length > 0) {
    for (const entry of lb.entries) {
      const rankClass = entry.rank === 1 ? ' gold' : entry.rank === 2 ? ' silver' : entry.rank === 3 ? ' bronze' : '';
      html += `<div class="lb-entry">`;
      html += `<div class="lb-rank${rankClass}">#${entry.rank}</div>`;
      html += `<div class="lb-name">${entry.displayName || entry.username}</div>`;
      html += `<div class="lb-time" style="color:${rgba(t.primary, 1)}">${fmtMXTime(entry.lapTime)}</div>`;
      html += `</div>`;
    }
  } else {
    html += `<div style="text-align:center;padding:16px;font-size:9px;letter-spacing:0.12em;opacity:0.4">NO TIMES RECORDED</div>`;
  }

  panel.innerHTML = html;
  panel.style.borderColor = rgba(t.primary, 0.3);
  panel.style.color = rgba(t.secondary, 0.8);

  // Event listeners
  panel.querySelector('#lbClose')?.addEventListener('click', () => toggleLeaderboard());

  panel.querySelectorAll('.lb-track-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const idx = +(e.target as HTMLElement).dataset.track!;
      lbTrackIdx = idx;
      fetchLeaderboard(MX_TRACKS[idx].name).then(() => renderLeaderboard());
      renderLeaderboard();
    });
  });
}
