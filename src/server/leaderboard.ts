import { Router, Request, Response } from 'express';
import {
  insertLapRecord, getTrackLeaderboard, getUserBestTime,
  getUserRank, getWorldRecord, incrementUserRaces,
} from './db.js';

const router = Router();

// ── GET /api/leaderboard/:trackName ──
router.get('/:trackName', (req: Request, res: Response) => {
  const { trackName } = req.params;
  const rows = getTrackLeaderboard.all(trackName) as any[];

  // Deduplicate: keep only best time per user
  const seen = new Set<number>();
  const entries = rows.filter(r => {
    if (seen.has(r.user_id)) return false;
    seen.add(r.user_id);
    return true;
  });

  const wr = entries[0] || null;
  res.json({
    trackName,
    entries: entries.map((e, i) => ({
      rank: i + 1,
      username: e.username,
      displayName: e.display_name,
      lapTime: e.lap_time,
      wasClean: !!e.was_clean,
      userId: e.user_id,
    })),
    worldRecord: wr ? { lapTime: wr.lap_time, username: wr.username, displayName: wr.display_name } : null,
  });
});

// ── POST /api/leaderboard/submit ──
router.post('/submit', (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { trackName, lapTime, wasClean, maxAirTime, laps } = req.body;
  if (!trackName || typeof lapTime !== 'number' || lapTime <= 0) {
    res.status(400).json({ error: 'Invalid submission' });
    return;
  }

  // Check if this is a personal best
  const currentBest = getUserBestTime.get(user.id, trackName) as any;
  const isPersonalBest = !currentBest?.best_time || lapTime < currentBest.best_time;

  // Always record the time
  const now = Date.now();
  insertLapRecord.run(user.id, trackName, lapTime, now, wasClean ? 1 : 0, maxAirTime || 0);

  // Increment race stats
  incrementUserRaces.run(laps || 3, user.id);

  // Get updated rank and WR
  const rank = getUserRank.get(trackName, user.id, trackName) as any;
  const wr = getWorldRecord.get(trackName) as any;
  const isWorldRecord = wr && Math.abs(wr.lap_time - lapTime) < 0.001;

  res.json({
    ok: true,
    isPersonalBest,
    isWorldRecord,
    rank: rank?.rank || 1,
    worldRecord: wr ? { lapTime: wr.lap_time, username: wr.username, displayName: wr.display_name } : null,
  });
});

// ── GET /api/leaderboard/:trackName/wr ──
router.get('/:trackName/wr', (req: Request, res: Response) => {
  const wr = getWorldRecord.get(req.params.trackName) as any;
  res.json({
    worldRecord: wr ? { lapTime: wr.lap_time, username: wr.username, displayName: wr.display_name } : null,
  });
});

export default router;
