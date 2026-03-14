import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql, initDB } from '../_db';
import { getUserFromRequest } from '../_auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { trackName, lapTime, wasClean, maxAirTime, laps } = req.body;
  if (!trackName || typeof lapTime !== 'number' || lapTime <= 0) {
    return res.status(400).json({ error: 'Invalid submission' });
  }

  // Check personal best
  const { rows: bestRows } = await sql`
    SELECT MIN(lap_time) as best_time FROM lap_records
    WHERE user_id = ${user.id} AND track_name = ${trackName}
  `;
  const currentBest = bestRows[0]?.best_time;
  const isPersonalBest = !currentBest || lapTime < currentBest;

  const now = Date.now();
  await sql`
    INSERT INTO lap_records (user_id, track_name, lap_time, recorded_at, was_clean, max_air_time)
    VALUES (${user.id}, ${trackName}, ${lapTime}, ${now}, ${wasClean || false}, ${maxAirTime || 0})
  `;

  // Increment race stats
  const lapCount = laps || 3;
  await sql`
    UPDATE users SET total_races = total_races + 1, total_laps = total_laps + ${lapCount}
    WHERE id = ${user.id}
  `;

  // Get WR
  const { rows: wrRows } = await sql`
    SELECT lr.lap_time, u.username
    FROM lap_records lr JOIN users u ON lr.user_id = u.id
    WHERE lr.track_name = ${trackName}
    ORDER BY lr.lap_time ASC LIMIT 1
  `;
  const wr = wrRows[0] || null;
  const isWorldRecord = wr && Math.abs(wr.lap_time - lapTime) < 0.001;

  // Get rank
  const { rows: rankRows } = await sql`
    SELECT COUNT(*) + 1 as rank FROM (
      SELECT user_id, MIN(lap_time) as best
      FROM lap_records WHERE track_name = ${trackName}
      GROUP BY user_id
      HAVING MIN(lap_time) < ${lapTime}
    ) sub
  `;

  return res.json({
    ok: true,
    isPersonalBest,
    isWorldRecord,
    rank: rankRows[0]?.rank || 1,
    worldRecord: wr ? { lapTime: wr.lap_time, username: wr.username, displayName: wr.username } : null,
  });
}
