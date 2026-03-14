import { T, rgba } from '../game/themes';
import { login, register, checkSession, getUser, isLoggedIn, getUserBestTimes, logout } from '../game/auth';
import { fmtMXTime } from '../game/stats';
import { MX_TRACKS } from '../game/tracks';

let onReady: (() => void) | null = null;

export async function showWelcomeScreen(startGame: () => void): Promise<void> {
  onReady = startGame;
  const ws = document.getElementById('welcomeScreen')!;

  // Check existing session
  const hasSession = await checkSession();
  if (hasSession) {
    renderLoggedIn(ws);
  } else {
    renderLoggedOut(ws);
  }

  ws.classList.add('visible');
  applyWelcomeTheme();
}

function applyWelcomeTheme(): void {
  const t = T();
  const ws = document.getElementById('welcomeScreen')!;
  ws.style.setProperty('--ws-primary', rgba(t.primary, 1));
  ws.style.setProperty('--ws-secondary', rgba(t.secondary, 1));
  ws.style.setProperty('--ws-bg', rgba(t.bg, 0.97));
  ws.style.setProperty('--ws-accent', rgba(t.accent, 1));
}

function renderLoggedIn(ws: HTMLElement): void {
  const user = getUser()!;
  const bests = getUserBestTimes();
  const t = T();

  ws.querySelector('.ws-content')!.innerHTML = `
    <div class="ws-title">Welcome back, <span style="color:${rgba(t.secondary, 1)}">${user.displayName}</span></div>
    <div class="ws-subtitle">Races completed: ${user.totalRaces || 0}</div>
    <div class="ws-records">
      <div class="ws-records-title">Personal bests</div>
      ${MX_TRACKS.map(tr => `
        <div class="ws-record-row">
          <span class="ws-track-name">${tr.name}</span>
          <span class="ws-track-time">${bests[tr.name] ? fmtMXTime(bests[tr.name]) : '—'}</span>
        </div>
      `).join('')}
    </div>
    <button class="ws-btn ws-race-btn" id="wsRaceBtn">Race</button>
    <div class="ws-logout" id="wsLogout">Logout</div>
  `;

  document.getElementById('wsRaceBtn')!.addEventListener('click', enterGame);
  document.getElementById('wsLogout')!.addEventListener('click', async () => {
    await logout();
    renderLoggedOut(ws);
  });
}

function renderLoggedOut(ws: HTMLElement): void {
  ws.querySelector('.ws-content')!.innerHTML = `
    <div class="ws-title">Welcome, Rider</div>
    <div class="ws-subtitle">Socia Visual MX</div>
    <div class="ws-form-tabs">
      <button class="ws-tab active" id="wsTabLogin">Login</button>
      <button class="ws-tab" id="wsTabRegister">Register</button>
    </div>
    <form class="ws-form" id="wsLoginForm">
      <input type="text" placeholder="Username" id="wsLoginUser" autocomplete="username" required>
      <input type="password" placeholder="Password" id="wsLoginPass" autocomplete="current-password" required>
      <button type="submit" class="ws-btn">Login</button>
      <div class="ws-error" id="wsLoginError"></div>
    </form>
    <form class="ws-form ws-hidden" id="wsRegisterForm">
      <input type="text" placeholder="Username" id="wsRegUser" autocomplete="username" required>
      <input type="text" placeholder="Display Name" id="wsRegDisplay" autocomplete="name" required>
      <input type="password" placeholder="Password" id="wsRegPass" autocomplete="new-password" required>
      <input type="password" placeholder="Confirm Password" id="wsRegConfirm" autocomplete="new-password" required>
      <button type="submit" class="ws-btn">Register</button>
      <div class="ws-error" id="wsRegError"></div>
    </form>
    <div class="ws-guest" id="wsGuest">Play as Guest</div>
  `;

  // Tab switching
  const tabLogin = document.getElementById('wsTabLogin')!;
  const tabReg = document.getElementById('wsTabRegister')!;
  const loginForm = document.getElementById('wsLoginForm')!;
  const regForm = document.getElementById('wsRegisterForm')!;

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active'); tabReg.classList.remove('active');
    loginForm.classList.remove('ws-hidden'); regForm.classList.add('ws-hidden');
  });
  tabReg.addEventListener('click', () => {
    tabReg.classList.add('active'); tabLogin.classList.remove('active');
    regForm.classList.remove('ws-hidden'); loginForm.classList.add('ws-hidden');
  });

  // Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = (document.getElementById('wsLoginUser') as HTMLInputElement).value;
    const pass = (document.getElementById('wsLoginPass') as HTMLInputElement).value;
    const err = document.getElementById('wsLoginError')!;
    err.textContent = '';
    const result = await login(user, pass);
    if (result.ok) {
      renderLoggedIn(ws);
    } else {
      err.textContent = result.error || 'Login failed';
    }
  });

  // Register
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = (document.getElementById('wsRegUser') as HTMLInputElement).value;
    const display = (document.getElementById('wsRegDisplay') as HTMLInputElement).value;
    const pass = (document.getElementById('wsRegPass') as HTMLInputElement).value;
    const confirm = (document.getElementById('wsRegConfirm') as HTMLInputElement).value;
    const err = document.getElementById('wsRegError')!;
    err.textContent = '';
    if (pass !== confirm) { err.textContent = 'Passwords do not match'; return; }
    const result = await register(user, display, pass);
    if (result.ok) {
      renderLoggedIn(ws);
    } else {
      err.textContent = result.error || 'Registration failed';
    }
  });

  // Guest
  document.getElementById('wsGuest')!.addEventListener('click', enterGame);
}

function enterGame(): void {
  const ws = document.getElementById('welcomeScreen')!;
  ws.classList.add('fade-out');
  setTimeout(() => {
    ws.classList.remove('visible', 'fade-out');
    if (onReady) onReady();
  }, 600);
}

const ws = document.getElementById('welcomeScreen');
if (ws) {
  // Ensure welcome screen content container exists
  if (!ws.querySelector('.ws-content')) {
    const content = document.createElement('div');
    content.className = 'ws-content';
    ws.appendChild(content);
  }
}
