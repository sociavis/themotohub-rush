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

  el.innerHTML = `
    <div class="mm-content">
      <div class="mm-logo">
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
