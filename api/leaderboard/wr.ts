import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const trackName = req.query.track as string;
  if (!trackName) return res.status(400).json({ error: 'Missing track name' });

  const { rows } = await sql`
    SELECT lr.lap_time, u.username
    FROM lap_records lr JOIN users u ON lr.user_id = u.id
    WHERE lr.track_name = ${trackName}
    ORDER BY lr.lap_time ASC LIMIT 1
  `;

  const wr = rows[0] || null;
  return res.json({
    worldRecord: wr ? { lapTime: wr.lap_time, username: wr.username, displayName: wr.username } : null,
  });
}
