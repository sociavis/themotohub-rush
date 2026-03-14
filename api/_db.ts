import { sql } from '@vercel/postgres';

let initialized = false;

export async function initDB(): Promise<void> {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      racer_number INTEGER NOT NULL DEFAULT 0,
      country TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL,
      last_login BIGINT NOT NULL,
      total_races INTEGER DEFAULT 0,
      total_laps INTEGER DEFAULT 0,
      achievements_data TEXT DEFAULT '',
      upgrades_data TEXT DEFAULT ''
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      created_at BIGINT NOT NULL,
      expires_at BIGINT NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS lap_records (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      track_name TEXT NOT NULL,
      lap_time REAL NOT NULL,
      recorded_at BIGINT NOT NULL,
      was_clean BOOLEAN DEFAULT false,
      max_air_time REAL DEFAULT 0
    )
  `;
  // Add columns for progress persistence (safe to run if they already exist)
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS achievements_data TEXT DEFAULT ''`; } catch {}
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS upgrades_data TEXT DEFAULT ''`; } catch {}

  // Create indexes if they don't exist
  await sql`CREATE INDEX IF NOT EXISTS idx_lap_records_track_time ON lap_records(track_name, lap_time ASC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_lap_records_user ON lap_records(user_id, track_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;
  initialized = true;
}

export { sql };
