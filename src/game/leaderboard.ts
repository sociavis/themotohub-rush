import { getToken } from './auth';
import { apiBase } from './base-url';

export interface LeaderboardEntry {
  rank: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  racerNumber?: number;
  lapTime: number;
  wasClean: boolean;
  userId: number;
}

export interface WorldRecord {
  lapTime: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

export interface TrackLeaderboard {
  trackName: string;
  entries: LeaderboardEntry[];
  worldRecord: WorldRecord | null;
}

const cache: Record<string, TrackLeaderboard> = {};

function getApiBase(): string { return apiBase(); }

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function fetchLeaderboard(trackName: string): Promise<TrackLeaderboard | null> {
  try {
    const res = await fetch(`${getApiBase()}/leaderboard/${encodeURIComponent(trackName)}`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    cache[trackName] = data;
    return data;
  } catch {
    return cache[trackName] || null;
  }
}

export function getCachedLeaderboard(trackName: string): TrackLeaderboard | null {
  return cache[trackName] || null;
}

export async function submitLapTime(
  trackName: string, lapTime: number, wasClean: boolean, maxAirTime: number, laps: number,
): Promise<{ ok: boolean; isPersonalBest?: boolean; isWorldRecord?: boolean; rank?: number; worldRecord?: WorldRecord | null }> {
  try {
    const res = await fetch(`${getApiBase()}/leaderboard/submit`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ trackName, lapTime, wasClean, maxAirTime, laps }),
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    // Refresh leaderboard cache
    fetchLeaderboard(trackName);
    return data;
  } catch {
    return { ok: false };
  }
}

export async function fetchWorldRecord(trackName: string): Promise<WorldRecord | null> {
  try {
    const res = await fetch(`${getApiBase()}/leaderboard/wr?track=${encodeURIComponent(trackName)}`, { headers: authHeaders() });
    if (!res.ok) return null;
    const data = await res.json();
    return data.worldRecord || null;
  } catch {
    return null;
  }
}

export function getWRForTrack(trackName: string): WorldRecord | null {
  return cache[trackName]?.worldRecord || null;
}
