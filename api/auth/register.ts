import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { sql, initDB } from '../_db';

const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const { username, password, email, racerNumber, country } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const rn = parseInt(racerNumber, 10);
  if (!rn || rn < 1 || rn > 999) {
    return res.status(400).json({ error: 'Racer number must be 1-999' });
  }

  if (!country || country.length < 2) {
    return res.status(400).json({ error: 'Country is required' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }

  const { rows: existing } = await sql`SELECT id FROM users WHERE username = ${username}`;
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = Date.now();

  try {
    const { rows } = await sql`
      INSERT INTO users (username, password_hash, email, racer_number, country, created_at, last_login)
      VALUES (${username}, ${hash}, ${email}, ${rn}, ${country}, ${now}, ${now})
      RETURNING id, username, racer_number, country
    `;
    const user = rows[0];
    const token = crypto.randomUUID();
    await sql`
      INSERT INTO sessions (user_id, token, created_at, expires_at)
      VALUES (${user.id}, ${token}, ${now}, ${now + SESSION_DURATION})
    `;

    return res.json({
      token,
      user: { id: user.id, username: user.username, racerNumber: user.racer_number, country: user.country },
    });
  } catch {
    return res.status(500).json({ error: 'Registration failed' });
  }
}
