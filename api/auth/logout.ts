import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  }

  return res.json({ ok: true });
}
