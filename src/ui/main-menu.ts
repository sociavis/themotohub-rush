import { T, rgba } from '../game/themes';
import { isLoggedIn, getUser } from '../game/auth';
import { upgrades } from '../game/shop';

const COIN = '⛃';

export type MenuAction = 'race' | 'shop' | 'profile' | 'achievements';

let menuCallback: ((action: MenuAction) => void) | null = null;

export function showMainMenu(onAction: (action: MenuAction) => void): void {
  menuCallback = onAction;
  const el = document.getElementById('mainMenu')!;
  renderMenu();
  el.style.display = 'flex';
  el.style.opacity = '0';
  requestAnimationFrame(() => { el.style.opacity = '1'; });
}

export function hideMainMenu(): void {
  const el = document.getElementById('mainMenu')!;
  el.style.opacity = '0';
  setTimeout(() => { el.style.display = 'none'; }, 400);
}

function renderMenu(): void {
  const el = document.getElementById('mainMenu')!;
  const t = T();
  const user = getUser();
  const loggedIn = isLoggedIn();
  const p = rgba(t.primary, 1);
  const s = rgba(t.secondary, 0.7);

  const greeting = loggedIn && user ? `${user.username} #${user.racerNumber}` : 'GUEST RIDER';

  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1899 262.95" style="width:clamp(120px,28vw,220px);height:auto;display:block;margin:0 auto 12px;opacity:0.7"><g fill="${p}" stroke="none"><polygon points="467.19 167.92 533.4 95.7 247.13 95.7 267.59 73.38 799.36 73.38 713.9 166.6 807.53 166.6 892.99 73.38 959.2 1.16 510.75 1.16 510.46 .49 240.78 .49 87.79 167.92 373.56 167.92 353.1 190.24 67.33 190.24 1.12 262.46 380.52 262.46 446.73 190.24 467.19 167.92"/><polygon points="635.86 190.25 635.86 190.24 565.56 190.24 652.24 95.7 558.6 95.7 405.72 262.46 1024.51 262.46 1090.71 190.25 635.86 190.25"/><polygon points="1462.18 262.46 1897.89 262.46 1658.33 1.16 1581.55 1.16 1408.21 190.25 1273.11 190.25 1379.06 74.68 1380.26 73.37 1492.63 73.37 1558.84 1.16 984.48 1.16 832.81 166.6 926.44 166.6 1011.91 73.37 1286.63 73.37 1179.49 190.25 1113.17 190.25 1046.97 262.46 1435.63 262.46 1607.77 74.68 1632.12 74.68 1738.06 190.25 1528.38 190.25 1462.18 262.46"/></g></svg>`;

  el.innerHTML = `
    <div class="mm-content">
      <div class="mm-logo">
        ${logoSvg}
        <div class="mm-title" style="color:${p}">SOCIA MX</div>
        <div class="mm-subtitle" style="color:${rgba(t.primary, 0.25)}">MOTOCROSS</div>
      </div>
      <div class="mm-rider-info">
        <div class="mm-rider" style="color:${s}">${greeting}</div>
        <div class="mm-funds" style="color:${rgba(t.primary, 0.6)}">${COIN} ${upgrades.funds}</div>
      </div>
      <div class="mm-buttons">
        <button class="mm-btn mm-btn-race" data-action="race" style="border-color:${rgba(t.primary, 0.5)};color:${p}">
          <span class="mm-btn-icon">⚑</span>
          <span class="mm-btn-label">RACE</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.3)}">→</span>
        </button>
        <button class="mm-btn" data-action="shop" style="border-color:${rgba(t.primary, 0.2)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">◆</span>
          <span class="mm-btn-label">GARAGE</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.2)}">→</span>
        </button>
        <button class="mm-btn" data-action="profile" style="border-color:${rgba(t.primary, 0.2)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">◉</span>
          <span class="mm-btn-label">PROFILE</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.2)}">→</span>
        </button>
        <button class="mm-btn" data-action="achievements" style="border-color:${rgba(t.primary, 0.2)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">★</span>
          <span class="mm-btn-label">ACHIEVEMENTS</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.2)}">→</span>
        </button>
      </div>
    </div>
  `;

  el.querySelectorAll('.mm-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = (btn as HTMLElement).dataset.action as MenuAction;
      if (menuCallback) menuCallback(action);
    });
  });
}
