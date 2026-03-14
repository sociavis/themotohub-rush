import { T, rgba } from '../game/themes';
import { isLoggedIn, getUser } from '../game/auth';
import { achState, ACH_DEFS, getDiffColor } from '../game/achievements';
import { upgrades, BIKE_COLORS, buyUpgrade, buyColor, checkAchievementFunds, renderShop } from '../game/shop';
import { MX_TRACKS } from '../game/tracks';
import { fmtMXTime } from '../game/stats';

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
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function goBack(): void {
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
    { key: 'tires' as const, name: 'Tires', desc: ['Stock tires', 'Grip compound', 'Racing slicks', 'Pro grip'], stat: 'Better grip & handling' },
    { key: 'engine' as const, name: 'Engine', desc: ['Stock engine', '250cc bore', '350cc bore', '450cc race'], stat: 'More top speed' },
    { key: 'gearbox' as const, name: 'Gearbox', desc: ['Stock gears', 'Close ratio', 'Racing gears', 'Pro shift'], stat: 'Better acceleration' },
    { key: 'suspension' as const, name: 'Suspension', desc: ['Stock forks', 'Sport dampers', 'Pro shocks', 'Factory race'], stat: 'Better on jumps & bumps' },
  ];

  let html = `<div class="fp-content">`;
  html += `<div class="fp-header"><div class="fp-back" id="shopBack" style="color:${rgba(t.primary, 0.6)}">← BACK</div><div class="fp-title" style="color:${rgba(t.primary, 1)}">SHOP</div></div>`;
  html += `<div class="shop-funds"><div class="shop-funds-label">AVAILABLE FUNDS</div><div class="shop-funds-val" style="color:${rgba(t.primary, 1)}">${upgrades.funds}</div></div>`;

  for (const cat of categories) {
    const lvl = upgrades[cat.key];
    const nextCost = lvl < 3 ? UPGRADE_COSTS[lvl] : 0;
    const canBuy = lvl < 3 && upgrades.funds >= nextCost;
    html += `<div class="shop-category"><div class="shop-cat-title" style="color:${rgba(t.primary, 0.7)}">${cat.name} — ${cat.stat}</div>`;
    html += `<div class="shop-item"><div class="shop-item-info"><div class="shop-item-name">${cat.desc[lvl]}</div>`;
    html += `<div class="shop-item-desc">${lvl < 3 ? 'Next: ' + cat.desc[lvl + 1] : 'MAX LEVEL'}</div>`;
    html += `<div class="shop-item-lvl">`;
    for (let i = 0; i < 3; i++) html += `<div class="shop-lvl-pip${i < lvl ? ' filled' : ''}" style="${i < lvl ? 'background:' + rgba(t.primary, 1) : ''}"></div>`;
    html += `</div></div>`;
    html += lvl < 3 ? `<div class="shop-buy-btn${canBuy ? '' : ' owned'}" data-upgrade="${cat.key}">${nextCost}</div>` : `<div class="shop-buy-btn owned">MAX</div>`;
    html += `</div></div>`;
  }

  html += `<div class="shop-category"><div class="shop-cat-title" style="color:${rgba(t.primary, 0.7)}">BIKE COLOR</div><div class="shop-color-grid">`;
  for (let i = 0; i < BIKE_COLORS.length; i++) {
    const c = BIKE_COLORS[i];
    const owned = upgrades.ownedColors.has(i);
    const active = upgrades.bikeColor === i;
    html += `<div class="shop-color-swatch${owned ? ' owned' : ''}${active ? ' active' : ''}" data-color="${i}" style="background:rgb(${c.color.join(',')});${active ? 'box-shadow:0 0 10px rgb(' + c.color.join(',') + ')' : ''}" title="${c.name}${owned ? '' : ' — ' + COLOR_COSTS[i]}"></div>`;
  }
  html += `</div></div></div>`;
  el.innerHTML = html;

  el.querySelector('#shopBack')?.addEventListener('click', goBack);
  el.querySelectorAll('.shop-buy-btn:not(.owned)').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = (e.target as HTMLElement).dataset.upgrade as 'tires' | 'engine' | 'gearbox' | 'suspension';
      if (key && buyUpgrade(key)) renderFullShop(el);
    });
  });
  el.querySelectorAll('.shop-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', (e) => {
      const idx = +(e.target as HTMLElement).dataset.color!;
      if (buyColor(idx)) renderFullShop(el);
    });
  });
}

function renderFullProfile(el: HTMLElement): void {
  const t = T();
  const user = getUser();
  const loggedIn = isLoggedIn();

  let html = `<div class="fp-content">`;
  html += `<div class="fp-header"><div class="fp-back" id="profileBack" style="color:${rgba(t.primary, 0.6)}">← BACK</div><div class="fp-title" style="color:${rgba(t.primary, 1)}">PROFILE</div></div>`;

  if (loggedIn && user) {
    html += `<div class="profile-row"><span>RIDER</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">${user.username}</span></div>`;
    html += `<div class="profile-row"><span>NUMBER</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">#${user.racerNumber}</span></div>`;
    html += `<div class="profile-row"><span>COUNTRY</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">${user.country || '--'}</span></div>`;
  } else {
    html += `<div style="text-align:center;padding:16px;font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:0.12em;opacity:0.4;text-transform:uppercase">GUEST RIDER</div>`;
  }
  html += `<div class="profile-row"><span>RACES</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">${achState.mxRacesCompleted}</span></div>`;
  html += `<div class="profile-row"><span>ACHIEVEMENTS</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">${achState.unlocked.size}/${ACH_DEFS.length}</span></div>`;
  html += `<div class="profile-row"><span>FUNDS</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">${upgrades.funds}</span></div>`;
  html += `<div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06)">`;
  html += `<div style="font-family:'Share Tech Mono',monospace;font-size:9px;letter-spacing:0.2em;opacity:0.4;margin-bottom:8px;text-transform:uppercase">UPGRADES</div>`;
  html += `<div class="profile-row"><span>TIRES</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">LVL ${upgrades.tires}</span></div>`;
  html += `<div class="profile-row"><span>ENGINE</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">LVL ${upgrades.engine}</span></div>`;
  html += `<div class="profile-row"><span>GEARBOX</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">LVL ${upgrades.gearbox}</span></div>`;
  html += `<div class="profile-row"><span>SUSPENSION</span><span class="profile-val" style="color:${rgba(t.primary, 1)}">LVL ${upgrades.suspension}</span></div>`;
  html += `</div></div>`;
  el.innerHTML = html;
  el.querySelector('#profileBack')?.addEventListener('click', goBack);
}

function renderFullAchievements(el: HTMLElement): void {
  const t = T();
  let html = `<div class="fp-content">`;
  html += `<div class="fp-header"><div class="fp-back" id="achBack" style="color:${rgba(t.primary, 0.6)}">← BACK</div><div class="fp-title" style="color:${rgba(t.primary, 1)}">ACHIEVEMENTS</div></div>`;
  html += `<div style="font-family:'Share Tech Mono',monospace;font-size:10px;letter-spacing:0.1em;margin-bottom:16px;opacity:0.5;text-transform:uppercase">${achState.unlocked.size} / ${ACH_DEFS.length} UNLOCKED</div>`;

  for (const a of ACH_DEFS) {
    const unlocked = achState.unlocked.has(a.id);
    const dc = getDiffColor(a.diff);
    const color = unlocked ? rgba(dc, 1) : 'rgba(255,255,255,0.2)';
    const bg = unlocked ? rgba(dc, 0.08) : 'rgba(255,255,255,0.02)';

    html += `
      <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;margin-bottom:6px;border:1px solid ${unlocked ? rgba(dc, 0.3) : 'rgba(255,255,255,0.05)'};border-radius:2px;background:${bg}">
        <div style="font-size:20px;width:28px;text-align:center;color:${color};opacity:${unlocked ? 1 : 0.3}">${a.icon}</div>
        <div style="flex:1">
          <div style="font-family:'Share Tech Mono',monospace;font-size:11px;letter-spacing:0.1em;color:${color};text-transform:uppercase">${a.name}</div>
          <div style="font-family:'Share Tech Mono',monospace;font-size:8px;letter-spacing:0.08em;opacity:0.5;text-transform:uppercase">${a.desc}</div>
        </div>
        <div style="font-family:'Share Tech Mono',monospace;font-size:7px;letter-spacing:0.15em;color:${color};opacity:0.6;text-transform:uppercase">${a.diff}</div>
      </div>
    `;
  }

  html += `</div>`;
  el.innerHTML = html;
  el.querySelector('#achBack')?.addEventListener('click', goBack);
}
