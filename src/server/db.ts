import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '../../data/game.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    racer_number INTEGER NOT NULL DEFAULT 0,
    country TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    last_login INTEGER NOT NULL,
    total_races INTEGER DEFAULT 0,
    total_laps INTEGER DEFAULT 0,
    achievements TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lap_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    track_name TEXT NOT NULL,
    lap_time REAL NOT NULL,
    recorded_at INTEGER NOT NULL,
    was_clean INTEGER DEFAULT 0,
    max_air_time REAL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_lap_records_track_time ON lap_records(track_name, lap_time ASC);
  CREATE INDEX IF NOT EXISTS idx_lap_records_user ON lap_records(user_id, track_name);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

export default db;

// ── User Queries ──

export const createUser = db.prepare(`
  INSERT INTO users (username, password_hash, email, racer_number, country, created_at, last_login)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export const findUserByUsername = db.prepare(`
  SELECT * FROM users WHERE username = ?
`);

export const findUserById = db.prepare(`
  SELECT id, username, email, racer_number, country, created_at, last_login, total_races, total_laps, achievements
  FROM users WHERE id = ?
`);

export const updateLastLogin = db.prepare(`
  UPDATE users SET last_login = ? WHERE id = ?
`);

export const incrementUserRaces = db.prepare(`
  UPDATE users SET total_races = total_races + 1, total_laps = total_laps + ? WHERE id = ?
`);

export const updateUserAchievements = db.prepare(`
  UPDATE users SET achievements = ? WHERE id = ?
`);

// ── Session Queries ──

export const createSession = db.prepare(`
  INSERT INTO sessions (user_id, token, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`);

export const findSession = db.prepare(`
  SELECT * FROM sessions WHERE token = ? AND expires_at > ?
`);

export const deleteSession = db.prepare(`
  DELETE FROM sessions WHERE token = ?
`);

export const cleanExpiredSessions = db.prepare(`
  DELETE FROM sessions WHERE expires_at < ?
`);

// ── Leaderboard Queries ──

export const insertLapRecord = db.prepare(`
  INSERT INTO lap_records (user_id, track_name, lap_time, recorded_at, was_clean, max_air_time)
  VALUES (?, ?, ?, ?, ?, ?)
`);

export const getTrackLeaderboard = db.prepare(`
  SELECT lr.lap_time, lr.recorded_at, lr.was_clean, u.username, u.racer_number, u.country, u.id as user_id
  FROM lap_records lr
  JOIN users u ON lr.user_id = u.id
  WHERE lr.track_name = ?
  ORDER BY lr.lap_time ASC
  LIMIT 20
`);

export const getUserBestTime = db.prepare(`
  SELECT MIN(lap_time) as best_time
  FROM lap_records
  WHERE user_id = ? AND track_name = ?
`);

export const getUserRank = db.prepare(`
  SELECT COUNT(*) + 1 as rank
  FROM (
    SELECT user_id, MIN(lap_time) as best
    FROM lap_records
    WHERE track_name = ?
    GROUP BY user_id
    HAVING best < (
      SELECT MIN(lap_time) FROM lap_records WHERE user_id = ? AND track_name = ?
    )
  )
`);

export const getWorldRecord = db.prepare(`
  SELECT lr.lap_time, u.username, u.racer_number, u.country
  FROM lap_records lr
  JOIN users u ON lr.user_id = u.id
  WHERE lr.track_name = ?
  ORDER BY lr.lap_time ASC
  LIMIT 1
`);

export const getUserAllBests = db.prepare(`
  SELECT track_name, MIN(lap_time) as best_time
  FROM lap_records
  WHERE user_id = ?
  GROUP BY track_name
`);
