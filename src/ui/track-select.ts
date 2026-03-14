import { T, rgba } from '../game/themes';
import { MX_TRACKS } from '../game/tracks';
import { fmtMXTime } from '../game/stats';
import { getCachedLeaderboard, fetchLeaderboard } from '../game/leaderboard';

let selectCallback: ((trackIdx: number) => void) | null = null;
let backCallback: (() => void) | null = null;

export function showTrackSelect(
  bestTimes: Record<string, number>,
  onSelect: (trackIdx: number) => void,
  onBack: () => void,
): void {
  selectCallback = onSelect;
  backCallback = onBack;
  const el = document.getElementById('trackSelect')!;
  renderTrackSelect(bestTimes);
  el.style.display = 'flex';
  el.style.opacity = '0';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  // Prefetch leaderboards
  MX_TRACKS.forEach(tr => fetchLeaderboard(tr.name));
}

export function hideTrackSelect(): void {
  const el = document.getElementById('trackSelect')!;
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function renderTrackSelect(bestTimes: Record<string, number>): void {
  const el = document.getElementById('trackSelect')!;
  const t = T();

  let html = `
    <div class="ts-content">
      <div class="ts-header">
        <div class="ts-back" id="tsBack" style="color:${rgba(t.primary, 0.6)}">← BACK</div>
        <div class="ts-title" style="color:${rgba(t.primary, 1)}">SELECT TRACK</div>
      </div>
      <div class="ts-grid">
  `;

  for (let i = 0; i < MX_TRACKS.length; i++) {
    const tr = MX_TRACKS[i];
    const best = bestTimes[tr.name];
    const lb = getCachedLeaderboard(tr.name);
    const wr = lb?.worldRecord;
    const envColors: Record<string, string> = {
      desert: 'rgba(255,145,40,0.12)',
      ice: 'rgba(100,210,255,0.12)',
      neon: 'rgba(220,40,180,0.12)',
      volcanic: 'rgba(255,60,20,0.12)',
      jungle: 'rgba(30,200,80,0.12)',
      stadium: 'rgba(180,100,255,0.12)',
    };
    const envBorder: Record<string, string> = {
      desert: 'rgba(255,145,40,0.3)',
      ice: 'rgba(100,210,255,0.3)',
      neon: 'rgba(220,40,180,0.3)',
      volcanic: 'rgba(255,60,20,0.3)',
      jungle: 'rgba(30,200,80,0.3)',
      stadium: 'rgba(180,100,255,0.3)',
    };

    html += `
      <div class="ts-card" data-track="${i}" style="background:${envColors[tr.envType]};border-color:${envBorder[tr.envType]}">
        <div class="ts-card-name" style="color:rgb(${tr.envColor.join(',')})">${tr.name}</div>
        <div class="ts-card-env">${tr.envType.toUpperCase()}</div>
        <div class="ts-card-stats">
          <div class="ts-card-row"><span>BEST</span><span style="color:${rgba(t.secondary, 1)}">${best ? fmtMXTime(best) : '—'}</span></div>
          <div class="ts-card-row"><span>WR</span><span style="color:rgba(255,215,0,0.8)">${wr ? fmtMXTime(wr.lapTime) : '—'}</span></div>
        </div>
        <div class="ts-card-race" style="border-color:rgb(${tr.envColor.join(',')});color:rgb(${tr.envColor.join(',')})">RACE</div>
      </div>
    `;
  }

  html += `</div></div>`;
  el.innerHTML = html;

  document.getElementById('tsBack')?.addEventListener('click', () => {
    if (backCallback) backCallback();
  });

  el.querySelectorAll('.ts-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = +(card as HTMLElement).dataset.track!;
      if (selectCallback) selectCallback(idx);
    });
  });
}
