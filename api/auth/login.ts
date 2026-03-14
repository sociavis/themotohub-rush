import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sql, initDB } from '../_db';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const { rows } = await sql`SELECT * FROM users WHERE username = ${username}`;
  if (rows.length === 0) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const now = Date.now();
  await sql`UPDATE users SET last_login = ${now} WHERE id = ${user.id}`;

  const token = crypto.randomUUID();
  await sql`
    INSERT INTO sessions (user_id, token, created_at, expires_at)
    VALUES (${user.id}, ${token}, ${now}, ${now + SESSION_DURATION})
  `;

  // Clean expired sessions
  await sql`DELETE FROM sessions WHERE expires_at < ${now}`;

  // Get best times
  const { rows: bests } = await sql`
    SELECT track_name, MIN(lap_time) as best_time
    FROM lap_records WHERE user_id = ${user.id}
    GROUP BY track_name
  `;
  const bestTimes: Record<string, number> = {};
  for (const b of bests) bestTimes[b.track_name] = b.best_time;

  return res.json({
    token,
    user: { id: user.id, username: user.username, racerNumber: user.racer_number, country: user.country, totalRaces: user.total_races },
    bestTimes,
  });
}
