import { T, rgba } from '../game/themes';
import { isLoggedIn, getUser } from '../game/auth';

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

  const greeting = loggedIn && user ? `${user.username} #${user.racerNumber}` : 'GUEST RIDER';

  el.innerHTML = `
    <div class="mm-content">
      <div class="mm-title" style="color:${rgba(t.primary, 1)}">SOCIA MX</div>
      <div class="mm-rider" style="color:${rgba(t.secondary, 0.7)}">${greeting}</div>
      <div class="mm-buttons">
        <button class="mm-btn mm-btn-race" data-action="race" style="border-color:${rgba(t.primary, 0.6)};color:${rgba(t.primary, 1)}">
          <span class="mm-btn-icon">⚑</span>
          <span class="mm-btn-label">RACE</span>
        </button>
        <button class="mm-btn" data-action="shop" style="border-color:${rgba(t.primary, 0.3)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">◆</span>
          <span class="mm-btn-label">SHOP</span>
        </button>
        <button class="mm-btn" data-action="profile" style="border-color:${rgba(t.primary, 0.3)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">◉</span>
          <span class="mm-btn-label">PROFILE</span>
        </button>
        <button class="mm-btn" data-action="achievements" style="border-color:${rgba(t.primary, 0.3)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">★</span>
          <span class="mm-btn-label">ACHIEVEMENTS</span>
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
