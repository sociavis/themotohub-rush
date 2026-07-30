import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import { sql, initDB } from '../_db.js';
import { verifyHostToken } from '../_host-token.js';

const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Host users never log in with a password; this sentinel can never match
// bcrypt.compare() in /api/auth/login, so the account is SSO-only.
const HOST_PW_SENTINEL = '!host-sso';

function usernameFromName(name: string | undefined, sub: string): string {
  const cleaned = (name || '').replace(/[^a-zA-Z0-9_ ]/g, '').trim().replace(/ +/g, '_').slice(0, 20);
  if (cleaned.length >= 3) return cleaned;
  return 'rider_' + crypto.createHash('sha256').update(sub).digest('hex').slice(0, 6);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.HOST_SSO_SECRET;
  if (!secret) return res.status(503).json({ error: 'Host SSO not configured' });

  const { token: hostToken } = req.body || {};
  if (typeof hostToken !== 'string' || !hostToken) {
    return res.status(400).json({ error: 'Missing token' });
  }

  const claims = verifyHostToken(hostToken, secret);
  if (!claims) return res.status(401).json({ error: 'Invalid host token' });

  await initDB();
  const now = Date.now();

  let { rows } = await sql`SELECT * FROM users WHERE external_id = ${claims.sub}`;
  let user = rows[0];

  if (!user) {
    // First launch for this host identity — provision a game account.
    const base = usernameFromName(claims.name, claims.sub);
    let username = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { rows: clash } = await sql`SELECT id FROM users WHERE username = ${username}`;
      if (clash.length === 0) break;
      username = (base.slice(0, 15) + '_' + crypto.randomBytes(2).toString('hex')).slice(0, 20);
    }
    const rn = Number.isInteger(claims.num) && claims.num! >= 1 && claims.num! <= 999 ? claims.num! : 0;
    const { rows: created } = await sql`
      INSERT INTO users (username, password_hash, email, racer_number, country, created_at, last_login, external_id)
      VALUES (${username}, ${HOST_PW_SENTINEL}, ${''}, ${rn}, ${claims.country || ''}, ${now}, ${now}, ${claims.sub})
      RETURNING *
    `;
    user = created[0];
  } else {
    // Keep racer number / country in sync with the host profile; username stays stable.
    const rn = Number.isInteger(claims.num) && claims.num! >= 1 && claims.num! <= 999 ? claims.num! : user.racer_number;
    await sql`UPDATE users SET last_login = ${now}, racer_number = ${rn}, country = ${claims.country || user.country} WHERE id = ${user.id}`;
    user.racer_number = rn;
  }

  const token = crypto.randomUUID();
  await sql`
    INSERT INTO sessions (user_id, token, created_at, expires_at)
    VALUES (${user.id}, ${token}, ${now}, ${now + SESSION_DURATION})
  `;
  await sql`DELETE FROM sessions WHERE expires_at < ${now}`;

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
    achievementsData: user.achievements_data || '',
    upgradesData: user.upgrades_data || '',
  });
}
