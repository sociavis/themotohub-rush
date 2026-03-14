import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  await initDB();

  const trackName = decodeURIComponent(req.query.trackName as string);

  const { rows } = await sql`
    SELECT lr.lap_time, lr.recorded_at, lr.was_clean, u.username, u.racer_number, u.country, u.id as user_id
    FROM lap_records lr
    JOIN users u ON lr.user_id = u.id
    WHERE lr.track_name = ${trackName}
    ORDER BY lr.lap_time ASC
    LIMIT 20
  `;

  // Deduplicate: keep only best time per user
  const seen = new Set<number>();
  const entries = rows.filter(r => {
    if (seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });

  const wr = entries[0] || null;
  return res.json({
    trackName,
    entries: entries.map((e, i) => ({
      rank: i + 1,
      username: e.username,
      displayName: e.username,
      lapTime: e.lap_time,
      wasClean: !!e.was_clean,
      userId: e.user_id,
    })),
    worldRecord: wr ? { lapTime: wr.lap_time, username: wr.username, displayName: wr.username } : null,
  });
}
