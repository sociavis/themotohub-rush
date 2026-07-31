import { storeGet, storeSet, storeRemove } from './safe-storage';
export interface UserProfile {
  id: number;
  username: string;
  racerNumber: number;
  country: string;
  totalRaces?: number;
  displayName?: string;
  avatarUrl?: string;
}

let currentUser: UserProfile | null = null;
let authToken: string | null = null;
let userBestTimes: Record<string, number> = {};
let serverAchievements: string = '';
let serverUpgrades: string = '';

export function getUser(): UserProfile | null { return currentUser; }
export function getToken(): string | null { return authToken; }
export function isLoggedIn(): boolean { return currentUser !== null; }
export function getUserBestTimes(): Record<string, number> { return userBestTimes; }
export function getServerAchievements(): string { return serverAchievements; }
export function getServerUpgrades(): string { return serverUpgrades; }

function getApiBase(): string {
  return '/api';
}

async function apiFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(opts.headers as Record<string, string> || {}) };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(getApiBase() + url, { ...opts, headers });
}

export async function register(username: string, password: string, email: string, racerNumber: number, country: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email, racerNumber, country }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Registration failed' };
    authToken = data.token;
    currentUser = data.user;
    userBestTimes = data.bestTimes || {};
    serverAchievements = data.achievementsData || '';
    serverUpgrades = data.upgradesData || '';
    storeSet('mx_token', data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function login(username: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Login failed' };
    authToken = data.token;
    currentUser = data.user;
    userBestTimes = data.bestTimes || {};
    serverAchievements = data.achievementsData || '';
    serverUpgrades = data.upgradesData || '';
    storeSet('mx_token', data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

// SSO login with a token minted by a host app (e.g. TheMotoHub). See BRIDGE.md.
export async function hostLogin(hostToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await apiFetch('/auth/host-login', {
      method: 'POST',
      body: JSON.stringify({ token: hostToken }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Host login failed' };
    authToken = data.token;
    currentUser = data.user;
    userBestTimes = data.bestTimes || {};
    serverAchievements = data.achievementsData || '';
    serverUpgrades = data.upgradesData || '';
    storeSet('mx_token', data.token);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error' };
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch { /* ignore */ }
  currentUser = null;
  authToken = null;
  userBestTimes = {};
  storeRemove('mx_token');
}

export async function checkSession(): Promise<boolean> {
  const token = storeGet('mx_token');
  if (!token) return false;
  authToken = token;
  try {
    const res = await apiFetch('/auth/me');
    if (!res.ok) {
      authToken = null;
      storeRemove('mx_token');
      return false;
    }
    const data = await res.json();
    currentUser = data.user;
    userBestTimes = data.bestTimes || {};
    serverAchievements = data.achievementsData || '';
    serverUpgrades = data.upgradesData || '';
    return true;
  } catch {
    authToken = null;
    storeRemove('mx_token');
    return false;
  }
}

export function updateBestTime(trackName: string, lapTime: number): void {
  if (!userBestTimes[trackName] || lapTime < userBestTimes[trackName]) {
    userBestTimes[trackName] = lapTime;
  }
}

export async function saveProgressToServer(achievements: object, upgrades: object): Promise<void> {
  if (!authToken) return;
  try {
    await apiFetch('/user/save-progress', {
      method: 'POST',
      body: JSON.stringify({ achievements, upgrades }),
    });
  } catch { /* ignore network errors */ }
}
