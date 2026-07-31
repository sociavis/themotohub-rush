import { T, rgba } from '../game/themes';
import { isLoggedIn, getUser } from '../game/auth';
import { upgrades } from '../game/shop';
import { url as gameUrl } from '../game/base-url';

const COIN = '◉';

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

  const logoSvg = `<img src="${gameUrl('brand/tmh-logo.svg')}" alt="TheMotoHub" style="width:clamp(130px,26vw,210px);height:auto;display:block;margin:0 auto 10px;filter:drop-shadow(0 4px 18px rgba(0,0,0,0.5))">`;

  el.innerHTML = `
    <div class="mm-content">
      <div class="mm-logo">
        ${logoSvg}
        <div class="mm-subtitle" style="color:${p};opacity:0.95;font-family:'Bring Race','Archivo Black',sans-serif;letter-spacing:0.45em;text-indent:0.45em;font-size:clamp(20px,4vw,30px)">RUSH</div>
      </div>
      <div class="mm-rider-info">
        <div class="mm-rider-row"><span class="mm-label" style="color:${rgba(t.primary, 0.35)}">RIDER</span> <span style="color:${s}">${greeting}</span></div>
        <div class="mm-rider-row"><span class="mm-label" style="color:${rgba(t.primary, 0.35)}">FUNDS</span> <span style="color:${rgba(t.primary, 0.6)}">${COIN} ${upgrades.funds}</span></div>
      </div>
      <div class="mm-buttons">
        <button class="mm-btn mm-btn-race" data-action="race" style="border-color:${rgba(t.primary, 0.5)};color:${p}">
          <span class="mm-btn-icon">⚑</span>
          <span class="mm-btn-label" style="font-family:'Bring Race','Archivo Black',sans-serif;letter-spacing:0.12em">RACE</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.3)}">→</span>
        </button>
        <button class="mm-btn" data-action="shop" style="border-color:${rgba(t.primary, 0.2)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">◆</span>
          <span class="mm-btn-label" style="font-family:'Bring Race','Archivo Black',sans-serif;letter-spacing:0.12em">GARAGE</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.2)}">→</span>
        </button>
        <button class="mm-btn" data-action="profile" style="border-color:${rgba(t.primary, 0.2)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">◉</span>
          <span class="mm-btn-label" style="font-family:'Bring Race','Archivo Black',sans-serif;letter-spacing:0.12em">PROFILE</span>
          <span class="mm-btn-arrow" style="color:${rgba(t.primary, 0.2)}">→</span>
        </button>
        <button class="mm-btn" data-action="achievements" style="border-color:${rgba(t.primary, 0.2)};color:${rgba(t.primary, 0.8)}">
          <span class="mm-btn-icon">★</span>
          <span class="mm-btn-label" style="font-family:'Bring Race','Archivo Black',sans-serif;letter-spacing:0.12em">ACHIEVEMENTS</span>
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
