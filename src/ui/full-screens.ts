import { T, rgba } from '../game/themes';
import { isLoggedIn, getUser } from '../game/auth';
import { achState, ACH_DEFS, getDiffColor } from '../game/achievements';
import { upgrades, BIKE_COLORS, buyUpgrade, buyColor, checkAchievementFunds, ACHIEVEMENT_REWARD } from '../game/shop';
import { MX_TRACKS } from '../game/tracks';
import { fmtMXTime } from '../game/stats';
import { initBikePreview, destroyBikePreview, highlightPart, previewBikeColor, refreshPreviewBike } from './bike-preview';

const COIN = '⛃';

let backCallback: (() => void) | null = null;

export function showFullShop(onBack: () => void): void {
  backCallback = onBack;
  const el = document.getElementById('fullShop')!;
  renderFullShop(el);
  el.style.display = 'flex';
  el.style.opacity = '0';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

export function showFullProfile(onBack: () => void): void {
  backCallback = onBack;
  const el = document.getElementById('fullProfile')!;
  renderFullProfile(el);
  el.style.display = 'flex';
  el.style.opacity = '0';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

export function showFullAchievements(onBack: () => void): void {
  backCallback = onBack;
  const el = document.getElementById('fullAchievements')!;
  renderFullAchievements(el);
  el.style.display = 'flex';
  el.style.opacity = '0';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

export function hideFullScreen(id: string): void {
  const el = document.getElementById(id)!;
  el.style.opacity = '0';
  if (id === 'fullShop') destroyBikePreview();
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function goBack(): void {
  destroyBikePreview();
  hideFullScreen('fullShop');
  hideFullScreen('fullProfile');
  hideFullScreen('fullAchievements');
  if (backCallback) backCallback();
}

function renderFullShop(el: HTMLElement): void {
  checkAchievementFunds();
  const t = T();
  const UPGRADE_COSTS = [100, 300, 600];
  const COLOR_COSTS = [0, 150, 150, 200, 200, 250, 250, 300];
  const categories = [
    { key: 'tires' as const, name: 'TIRES', desc: ['Stock tires', 'Grip compound', 'Racing slicks', 'Pro grip'], stat: 'Better grip & handling', icon: '◎' },
    { key: 'engine' as const, name: 'ENGINE', desc: ['Stock engine', '250cc bore', '350cc bore', '450cc race'], stat: 'More top speed', icon: '⚙' },
    { key: 'gearbox' as const, name: 'GEARBOX', desc: ['Stock gears', 'Close ratio', 'Racing gears', 'Pro shift'], stat: 'Better acceleration', icon: '⟐' },
    { key: 'suspension' as const, name: 'SUSPENSION', desc: ['Stock forks', 'Sport dampers', 'Pro shocks', 'Factory race'], stat: 'Better on jumps & bumps', icon: '↕' },
  ];

  let html = `<div class="fp-content fp-shop-layout">`;
  html += `<div class="fp-header">
    <div class="fp-back" id="shopBack" style="color:${rgba(t.primary, 0.8)}">← BACK</div>
    <div class="fp-title" style="color:${rgba(t.primary, 1)}">GARAGE</div>
    <div class="fp-funds" style="color:${rgba(t.primary, 1)}">${COIN} ${upgrades.funds}</div>
  </div>`;

  // 3D bike preview container
  html += `<div class="shop-bike-preview" id="shopBikePreview"></div>`;

  // Upgrades
  for (const cat of categories) {
    const lvl = upgrades[cat.key];
    const nextCost = lvl < 3 ? UPGRADE_COSTS[lvl] : 0;
    const canBuy = lvl < 3 && upgrades.funds >= nextCost;

    html += `<div class="shop-upgrade-card" data-part="${cat.key}">
      <div class="shop-upgrade-header">
        <span class="shop-upgrade-icon">${cat.icon}</span>
        <span class="shop-upgrade-name">${cat.name}</span>
        <span class="shop-upgrade-stat">${cat.stat}</span>
      </div>
      <div class="shop-upgrade-body">
        <div class="shop-upgrade-info">
          <div class="shop-upgrade-current" style="color:rgba(255,255,255,0.9)">${cat.desc[lvl]}</div>
          <div class="shop-upgrade-next">${lvl < 3 ? 'Next: ' + cat.desc[lvl + 1] : 'MAXED OUT'}</div>
          <div class="shop-upgrade-pips">`;
    for (let i = 0; i < 3; i++) {
      html += `<div class="shop-pip${i < lvl ? ' filled' : ''}" style="${i < lvl ? 'background:' + rgba(t.primary, 1) + ';box-shadow:0 0 6px ' + rgba(t.primary, 0.4) : ''}"></div>`;
    }
    html += `</div></div>`;
    if (lvl < 3) {
      html += `<button class="shop-upgrade-btn${canBuy ? '' : ' disabled'}" data-upgrade="${cat.key}" style="border-color:${rgba(t.primary, canBuy ? 0.6 : 0.15)};color:${rgba(t.primary, canBuy ? 1 : 0.3)}">${COIN} ${nextCost}</button>`;
    } else {
      html += `<div class="shop-upgrade-maxed" style="color:${rgba(t.primary, 0.4)}">MAX</div>`;
    }
    html += `</div></div>`;
  }

  // Bike colors
  html += `<div class="shop-colors-section">
    <div class="shop-section-title" style="color:${rgba(t.primary, 0.7)}">BIKE COLOR</div>
    <div class="shop-color-grid">`;
  for (let i = 0; i < BIKE_COLORS.length; i++) {
    const c = BIKE_COLORS[i];
    const owned = upgrades.ownedColors.has(i);
    const active = upgrades.bikeColor === i;
    const cost = COLOR_COSTS[i];
    html += `<div class="shop-color-item${owned ? ' owned' : ''}${active ? ' active' : ''}" data-color="${i}" data-r="${c.color[0]}" data-g="${c.color[1]}" data-b="${c.color[2]}">
      <div class="shop-color-swatch" style="background:rgb(${c.color.join(',')});${active ? 'box-shadow:0 0 12px rgb(' + c.color.join(',') + ')' : ''}"></div>
      <div class="shop-color-name">${c.name}</div>
      ${!owned ? `<div class="shop-color-cost">${COIN} ${cost}</div>` : active ? '<div class="shop-color-equipped">EQUIPPED</div>' : '<div class="shop-color-owned">OWNED</div>'}
    </div>`;
  }
  html += `</div></div></div>`;
  el.innerHTML = html;

  // Init 3D bike preview
  const previewEl = document.getElementById('shopBikePreview');
  if (previewEl) {
    setTimeout(() => initBikePreview(previewEl), 50);
  }

  // Event listeners
  el.querySelector('#shopBack')?.addEventListener('click', goBack);

  // Upgrade hover → highlight part on bike
  el.querySelectorAll('.shop-upgrade-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const part = (card as HTMLElement).dataset.part || null;
      highlightPart(part);
    });
    card.addEventListener('mouseleave', () => {
      highlightPart(null);
    });
  });

  // Buy upgrade
  el.querySelectorAll('.shop-upgrade-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = (e.target as HTMLElement).dataset.upgrade as 'tires' | 'engine' | 'gearbox' | 'suspension';
      if (key && buyUpgrade(key)) {
        refreshPreviewBike();
        renderFullShop(el);
      }
    });
  });

  // Color hover → preview on bike
  el.querySelectorAll('.shop-color-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      const r = +(item as HTMLElement).dataset.r!;
      const g = +(item as HTMLElement).dataset.g!;
      const b = +(item as HTMLElement).dataset.b!;
      previewBikeColor([r, g, b]);
    });
    item.addEventListener('mouseleave', () => {
      previewBikeColor(null);
    });
    item.addEventListener('click', () => {
      const idx = +(item as HTMLElement).dataset.color!;
      if (buyColor(idx)) {
        refreshPreviewBike();
        renderFullShop(el);
      }
    });
  });
}

function renderFullProfile(el: HTMLElement): void {
  const t = T();
  const user = getUser();
  const loggedIn = isLoggedIn();
  const p = rgba(t.primary, 1);
  const s = rgba(t.secondary, 1);

  let html = `<div class="fp-content">`;
  html += `<div class="fp-header">
    <div class="fp-back" id="profileBack" style="color:${rgba(t.primary, 0.8)}">← BACK</div>
    <div class="fp-title" style="color:${p}">PROFILE</div>
  </div>`;

  // Rider card
  if (loggedIn && user) {
    html += `<div class="profile-card">
      <div class="profile-avatar" style="border-color:${rgba(t.primary, 0.4)}">
        <span style="color:${p};font-size:24px">◉</span>
      </div>
      <div class="profile-name" style="color:${p}">${user.username}</div>
      <div class="profile-number" style="color:${s}">#${user.racerNumber}</div>
      <div class="profile-country">${user.country || '--'}</div>
    </div>`;
  } else {
    html += `<div class="profile-card">
      <div class="profile-avatar" style="border-color:rgba(255,255,255,0.15)">
        <span style="color:rgba(255,255,255,0.3);font-size:24px">◉</span>
      </div>
      <div class="profile-name" style="color:rgba(255,255,255,0.5)">GUEST RIDER</div>
    </div>`;
  }

  // Stats grid
  html += `<div class="profile-stats-grid">
    <div class="profile-stat-card">
      <div class="profile-stat-val" style="color:${p}">${achState.mxRacesCompleted}</div>
      <div class="profile-stat-label">RACES</div>
    </div>
    <div class="profile-stat-card">
      <div class="profile-stat-val" style="color:${p}">${achState.unlocked.size}/${ACH_DEFS.length}</div>
      <div class="profile-stat-label">ACHIEVEMENTS</div>
    </div>
    <div class="profile-stat-card">
      <div class="profile-stat-val" style="color:${p}">${COIN} ${upgrades.funds}</div>
      <div class="profile-stat-label">FUNDS</div>
    </div>
    <div class="profile-stat-card">
      <div class="profile-stat-val" style="color:${p}">${achState.mxLaps || 0}</div>
      <div class="profile-stat-label">LAPS</div>
    </div>
  </div>`;

  // Upgrades
  html += `<div class="profile-section">
    <div class="profile-section-title" style="color:${rgba(t.primary, 0.6)}">BIKE UPGRADES</div>`;
  const upgradeNames = [
    { key: 'tires', icon: '◎' },
    { key: 'engine', icon: '⚙' },
    { key: 'gearbox', icon: '⟐' },
    { key: 'suspension', icon: '↕' },
  ] as const;
  for (const u of upgradeNames) {
    const lvl = upgrades[u.key];
    html += `<div class="profile-upgrade-row">
      <span class="profile-upgrade-icon">${u.icon}</span>
      <span class="profile-upgrade-name">${u.key.toUpperCase()}</span>
      <span class="profile-upgrade-pips">`;
    for (let i = 0; i < 3; i++) {
      html += `<span class="profile-pip${i < lvl ? ' filled' : ''}" style="${i < lvl ? 'background:' + p + ';box-shadow:0 0 4px ' + rgba(t.primary, 0.3) : ''}"></span>`;
    }
    html += `</span>
      <span class="profile-upgrade-lvl" style="color:${rgba(t.primary, 0.8)}">LVL ${lvl}</span>
    </div>`;
  }
  html += `</div>`;

  // Bike color
  const bikeCol = BIKE_COLORS[upgrades.bikeColor];
  html += `<div class="profile-section">
    <div class="profile-section-title" style="color:${rgba(t.primary, 0.6)}">BIKE COLOR</div>
    <div class="profile-bike-color">
      <div class="profile-color-swatch" style="background:rgb(${bikeCol.color.join(',')});box-shadow:0 0 8px rgb(${bikeCol.color.join(',')})"></div>
      <span style="color:rgba(255,255,255,0.7)">${bikeCol.name}</span>
    </div>
  </div>`;

  html += `</div>`;
  el.innerHTML = html;
  el.querySelector('#profileBack')?.addEventListener('click', goBack);
}

function renderFullAchievements(el: HTMLElement): void {
  const t = T();
  const p = rgba(t.primary, 1);
  const unlockedCount = achState.unlocked.size;
  const totalCount = ACH_DEFS.length;
  const progressPct = Math.round((unlockedCount / totalCount) * 100);

  let html = `<div class="fp-content">`;
  html += `<div class="fp-header">
    <div class="fp-back" id="achBack" style="color:${rgba(t.primary, 0.8)}">← BACK</div>
    <div class="fp-title" style="color:${p}">ACHIEVEMENTS</div>
  </div>`;

  // Progress bar
  html += `<div class="ach-progress-section">
    <div class="ach-progress-text">
      <span style="color:${p}">${unlockedCount}</span><span style="color:rgba(255,255,255,0.3)"> / ${totalCount}</span>
      <span class="ach-progress-pct" style="color:${rgba(t.primary, 0.5)}">${progressPct}%</span>
    </div>
    <div class="ach-progress-bar">
      <div class="ach-progress-fill" style="width:${progressPct}%;background:${p};box-shadow:0 0 8px ${rgba(t.primary, 0.4)}"></div>
    </div>
    <div class="ach-reward-info" style="color:rgba(255,255,255,0.4)">Each achievement earns ${COIN} ${ACHIEVEMENT_REWARD}</div>
  </div>`;

  // Group by difficulty
  const groups = ['easy', 'medium', 'hard', 'epic'];
  const groupLabels: Record<string, string> = { easy: 'BASIC', medium: 'ADVANCED', hard: 'EXPERT', epic: 'LEGENDARY' };

  for (const diff of groups) {
    const achs = ACH_DEFS.filter(a => a.diff === diff);
    if (achs.length === 0) continue;
    const dc = getDiffColor(diff);

    html += `<div class="ach-group">
      <div class="ach-group-title" style="color:${rgba(dc, 0.7)}">${groupLabels[diff]}</div>`;

    for (const a of achs) {
      const unlocked = achState.unlocked.has(a.id);
      const color = unlocked ? rgba(dc, 1) : 'rgba(255,255,255,0.25)';
      const borderColor = unlocked ? rgba(dc, 0.35) : 'rgba(255,255,255,0.06)';
      const bg = unlocked ? rgba(dc, 0.06) : 'rgba(255,255,255,0.015)';

      html += `<div class="ach-card${unlocked ? ' unlocked' : ''}" style="border-color:${borderColor};background:${bg}">
        <div class="ach-card-icon" style="color:${color};${unlocked ? 'text-shadow:0 0 8px ' + rgba(dc, 0.5) : ''}">${a.icon}</div>
        <div class="ach-card-info">
          <div class="ach-card-name" style="color:${color}">${a.name}</div>
          <div class="ach-card-desc">${a.desc}</div>
        </div>
        <div class="ach-card-reward" style="color:${unlocked ? rgba(dc, 0.6) : 'rgba(255,255,255,0.15)'}">
          ${unlocked ? '✓' : COIN + ' ' + ACHIEVEMENT_REWARD}
        </div>
      </div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  el.innerHTML = html;
  el.querySelector('#achBack')?.addEventListener('click', goBack);
}
