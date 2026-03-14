import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import {
  createUser, findUserByUsername, findUserById,
  updateLastLogin, createSession, findSession, deleteSession,
  cleanExpiredSessions, getUserAllBests,
} from './db.js';

const router = Router();
const SALT_ROUNDS = 10;
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Middleware: extract user from token ──
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const now = Date.now();
    const session = findSession.get(token, now) as any;
    if (session) {
      const user = findUserById.get(session.user_id) as any;
      if (user) {
        (req as any).user = user;
        (req as any).sessionToken = token;
      }
    }
  }
  next();
}

// ── Require auth helper ──
function requireAuth(req: Request, res: Response): any | null {
  const user = (req as any).user;
  if (!user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return user;
}

// ── POST /api/auth/register ──
router.post('/register', async (req: Request, res: Response) => {
  const { username, displayName, password } = req.body;

  if (!username || !displayName || !password) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  // Validate username
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore)' });
    return;
  }

  if (displayName.length < 1 || displayName.length > 30) {
    res.status(400).json({ error: 'Display name must be 1-30 characters' });
    return;
  }

  if (password.length < 4) {
    res.status(400).json({ error: 'Password must be at least 4 characters' });
    return;
  }

  // Check if username exists
  const existing = findUserByUsername.get(username);
  if (existing) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const now = Date.now();

  try {
    const result = createUser.run(username, hash, displayName, now, now);
    const userId = result.lastInsertRowid as number;
    const token = crypto.randomUUID();
    createSession.run(userId, token, now, now + SESSION_DURATION);

    const user = findUserById.get(userId) as any;
    res.json({ token, user: { id: user.id, username: user.username, displayName: user.display_name } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /api/auth/login ──
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: 'Missing username or password' });
    return;
  }

  const user = findUserByUsername.get(username) as any;
  if (!user) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid username or password' });
    return;
  }

  const now = Date.now();
  updateLastLogin.run(now, user.id);
  const token = crypto.randomUUID();
  createSession.run(user.id, token, now, now + SESSION_DURATION);

  // Clean up expired sessions periodically
  cleanExpiredSessions.run(now);

  // Get user's best times
  const bests = getUserAllBests.all(user.id) as any[];
  const bestTimes: Record<string, number> = {};
  for (const b of bests) bestTimes[b.track_name] = b.best_time;

  res.json({
    token,
    user: { id: user.id, username: user.username, displayName: user.display_name, totalRaces: user.total_races },
    bestTimes,
  });
});

// ── POST /api/auth/logout ──
router.post('/logout', (req: Request, res: Response) => {
  const token = (req as any).sessionToken;
  if (token) deleteSession.run(token);
  res.json({ ok: true });
});

// ── GET /api/auth/me ──
router.get('/me', (req: Request, res: Response) => {
  const user = requireAuth(req, res);
  if (!user) return;

  const bests = getUserAllBests.all(user.id) as any[];
  const bestTimes: Record<string, number> = {};
  for (const b of bests) bestTimes[b.track_name] = b.best_time;

  res.json({
    user: { id: user.id, username: user.username, displayName: user.display_name, totalRaces: user.total_races },
    bestTimes,
  });
});

export default router;
