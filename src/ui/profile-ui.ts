import { T, rgba } from '../game/themes';
import { isLoggedIn, getUser } from '../game/auth';
import { achState, ACH_DEFS } from '../game/achievements';
import { upgrades } from '../game/shop';
import { MX_TRACKS } from '../game/tracks';
import { fmtMXTime } from '../game/stats';

let profileOpen = false;

export function initProfileUI(): void {
  const btn = document.getElementById('profileBtn');
  if (!btn) return;

  btn.addEventListener('click', (e) => { e.stopPropagation(); toggleProfile(); });
  btn.addEventListener('touchstart', (e) => { e.stopPropagation(); e.preventDefault(); toggleProfile(); }, { passive: false });
}

function toggleProfile(): void {
  profileOpen = !profileOpen;
  const panel = document.getElementById('profilePanel')!;
  if (profileOpen) {
    renderProfile();
    panel.classList.add('open');
    // Close other panels
    document.getElementById('leaderboardPanel')?.classList.remove('open');
    document.getElementById('shopPanel')?.classList.remove('open');
    document.getElementById('statsPanel')?.classList.remove('open');
  } else {
    panel.classList.remove('open');
  }
}

function renderProfile(): void {
  const panel = document.getElementById('profilePanel')!;
  const t = T();
  const user = getUser();
  const loggedIn = isLoggedIn();

  let html = `<div class="panel-title" style="color:${rgba(t.primary, 0.8)}">PROFILE</div>`;
  html += `<div class="panel-close" id="profileClose" style="color:${rgba(t.primary, 0.6)}">×</div>`;

  if (loggedIn && user) {
    html += `<div class="profile-row"><span>RIDER</span><span class="profile-val">${user.username}</span></div>`;
    html += `<div class="profile-row"><span>NUMBER</span><span class="profile-val">#${user.racerNumber}</span></div>`;
    html += `<div class="profile-row"><span>COUNTRY</span><span class="profile-val">${user.country || '--'}</span></div>`;
    html += `<div class="profile-row"><span>RACES</span><span class="profile-val">${achState.mxRacesCompleted}</span></div>`;
  } else {
    html += `<div style="text-align:center;padding:12px;font-size:9px;letter-spacing:0.12em;opacity:0.4">GUEST RIDER</div>`;
    html += `<div class="profile-row"><span>RACES</span><span class="profile-val">${achState.mxRacesCompleted}</span></div>`;
  }

  html += `<div class="profile-row"><span>ACHIEVEMENTS</span><span class="profile-val">${achState.unlocked.size}/${ACH_DEFS.length}</span></div>`;
  html += `<div class="profile-row"><span>FUNDS</span><span class="profile-val">⛃ ${upgrades.funds}</span></div>`;

  // Upgrades summary
  html += `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">`;
  html += `<div class="profile-row"><span>TIRES</span><span class="profile-val">LVL ${upgrades.tires}</span></div>`;
  html += `<div class="profile-row"><span>ENGINE</span><span class="profile-val">LVL ${upgrades.engine}</span></div>`;
  html += `<div class="profile-row"><span>GEARBOX</span><span class="profile-val">LVL ${upgrades.gearbox}</span></div>`;
  html += `<div class="profile-row"><span>SUSPENSION</span><span class="profile-val">LVL ${upgrades.suspension}</span></div>`;
  html += `</div>`;

  panel.innerHTML = html;
  panel.style.borderColor = rgba(t.primary, 0.3);
  panel.style.color = rgba(t.secondary, 0.8);

  panel.querySelector('#profileClose')?.addEventListener('click', () => toggleProfile());
}
