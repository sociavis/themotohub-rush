import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sql } from '../_db.js';
import { getUserFromRequest } from '../_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });

  const { rows: bests } = await sql`
    SELECT track_name, MIN(lap_time) as best_time
    FROM lap_records WHERE user_id = ${user.id}
    GROUP BY track_name
  `;
  const bestTimes: Record<string, number> = {};
  for (const b of bests) bestTimes[b.track_name] = b.best_time;

  return res.json({
    user: { id: user.id, username: user.username, racerNumber: user.racer_number, country: user.country, totalRaces: user.total_races },
    bestTimes,
  });
}
