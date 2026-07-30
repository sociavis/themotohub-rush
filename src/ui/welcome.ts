import { T, rgba } from '../game/themes';
import { login, register, checkSession, getUser, isLoggedIn, getUserBestTimes, logout } from '../game/auth';
import { getUrlHostToken, tryHostLogin, setPreStartAuthHandler, postToHost } from '../game/host-bridge';
import { fmtMXTime } from '../game/stats';
import { MX_TRACKS } from '../game/tracks';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria','Azerbaijan',
  'Bahrain','Bangladesh','Belarus','Belgium','Bolivia','Bosnia','Brazil','Bulgaria',
  'Cambodia','Cameroon','Canada','Chile','China','Colombia','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic',
  'Denmark','Dominican Republic','Ecuador','Egypt','El Salvador','Estonia','Ethiopia',
  'Finland','France','Georgia','Germany','Ghana','Greece','Guatemala',
  'Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy',
  'Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Kyrgyzstan',
  'Latvia','Lebanon','Libya','Lithuania','Luxembourg',
  'Malaysia','Mexico','Moldova','Mongolia','Montenegro','Morocco','Mozambique','Myanmar',
  'Nepal','Netherlands','New Zealand','Nicaragua','Nigeria','North Macedonia','Norway',
  'Oman','Pakistan','Panama','Paraguay','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Rwanda',
  'Saudi Arabia','Senegal','Serbia','Singapore','Slovakia','Slovenia','South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland','Syria',
  'Taiwan','Tanzania','Thailand','Tunisia','Turkey','Turkmenistan',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

let onReady: (() => void) | null = null;

export async function showWelcomeScreen(startGame: () => void): Promise<void> {
  onReady = startGame;
  const ws = document.getElementById('welcomeScreen')!;

  // Host SSO (e.g. TheMotoHub): a signed token in the URL logs the rider in
  // silently. On failure fall through to guest (embed) or the login screen.
  const qp = new URLSearchParams(location.search);
  const hostToken = getUrlHostToken();
  if (hostToken) {
    if (await tryHostLogin(hostToken)) {
      startGame();
      return;
    }
  }

  // Hosts that deliver the token via postMessage (`?embed=1&sso=1`): wait
  // briefly for a `host-auth` message, then fall back to guest.
  if (qp.has('sso')) {
    const started = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => { setPreStartAuthHandler(null); resolve(false); }, 4000);
      setPreStartAuthHandler((token) => {
        tryHostLogin(token).then((ok) => {
          if (ok) { clearTimeout(timer); setPreStartAuthHandler(null); resolve(true); }
        });
      });
      postToHost({ type: 'sso-waiting' });
    });
    if (!started) console.warn('[socia-mx] host SSO timed out, starting as guest');
    startGame();
    return;
  }

  const hasSession = await checkSession();

  // Embedded hosts can skip the login screen entirely. Also: if host SSO
  // failed and there's no session to fall back on, never strand an embedded
  // rider on a login form — start as guest.
  if (qp.has('guest') || (!hasSession && hostToken && qp.has('embed'))) {
    startGame();
    return;
  }

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
    <div class="ws-title">Welcome back, <span style="color:${rgba(t.secondary, 1)}">${user.username}</span></div>
    <div class="ws-subtitle">#${user.racerNumber} · ${user.country} · Races: ${user.totalRaces || 0}</div>
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
  const countryOptions = COUNTRIES.map(c => `<option value="${c}">${c}</option>`).join('');

  ws.querySelector('.ws-content')!.innerHTML = `
    <div class="ws-title">Welcome, Rider</div>
    <div class="ws-subtitle">TheMotoHub RUSH</div>
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
      <input type="email" placeholder="Email" id="wsRegEmail" autocomplete="email" required>
      <input type="number" placeholder="Racer Number (1-999)" id="wsRegRacer" min="1" max="999" required>
      <select id="wsRegCountry" required>
        <option value="" disabled selected>Country</option>
        ${countryOptions}
      </select>
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
    const email = (document.getElementById('wsRegEmail') as HTMLInputElement).value;
    const racer = parseInt((document.getElementById('wsRegRacer') as HTMLInputElement).value, 10);
    const country = (document.getElementById('wsRegCountry') as HTMLSelectElement).value;
    const pass = (document.getElementById('wsRegPass') as HTMLInputElement).value;
    const confirm = (document.getElementById('wsRegConfirm') as HTMLInputElement).value;
    const err = document.getElementById('wsRegError')!;
    err.textContent = '';
    if (pass !== confirm) { err.textContent = 'Passwords do not match'; return; }
    if (!racer || racer < 1 || racer > 999) { err.textContent = 'Racer number must be 1-999'; return; }
    if (!country) { err.textContent = 'Please select a country'; return; }
    const result = await register(user, pass, email, racer, country);
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
  if (!ws.querySelector('.ws-content')) {
    const content = document.createElement('div');
    content.className = 'ws-content';
    ws.appendChild(content);
  }
}
