import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db.js';

// Beacon endpoint — accepts token in body (sendBeacon can't set headers)
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const { token, achievements, upgrades } = req.body;
  if (!token) return res.status(401).json({ error: 'Missing token' });

  const now = Date.now();
  const { rows: sessions } = await sql`
    SELECT user_id FROM sessions WHERE token = ${token} AND expires_at > ${now}
  `;
  if (sessions.length === 0) return res.status(401).json({ error: 'Invalid token' });

  const userId = sessions[0].user_id;

  if (achievements !== undefined) {
    await sql`UPDATE users SET achievements_data = ${JSON.stringify(achievements)} WHERE id = ${userId}`;
  }
  if (upgrades !== undefined) {
    await sql`UPDATE users SET upgrades_data = ${JSON.stringify(upgrades)} WHERE id = ${userId}`;
  }

  return res.json({ ok: true });
}
