import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db.js';
import { getUserFromRequest } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { achievements, upgrades } = req.body;

  if (achievements !== undefined) {
    await sql`UPDATE users SET achievements_data = ${JSON.stringify(achievements)} WHERE id = ${user.id}`;
  }
  if (upgrades !== undefined) {
    await sql`UPDATE users SET upgrades_data = ${JSON.stringify(upgrades)} WHERE id = ${user.id}`;
  }

  return res.json({ ok: true });
}
