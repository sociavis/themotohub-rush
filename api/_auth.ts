import { sql, initDB } from './_db.js';
import type { VercelRequest } from '@vercel/node';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  racer_number: number;
  country: string;
  total_races: number;
  total_laps: number;
}

export async function getUserFromRequest(req: VercelRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const now = Date.now();

  await initDB();

  const { rows: sessions } = await sql`
    SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > ${now}
  `;
  if (sessions.length === 0) return null;

  const userId = sessions[0].user_id;
  const { rows: users } = await sql`
    SELECT id, username, email, racer_number, country, total_races, total_laps
    FROM users WHERE id = ${userId}
  `;
  if (users.length === 0) return null;

  return users[0] as AuthUser;
}
