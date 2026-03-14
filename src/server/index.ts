import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import authRouter, { authMiddleware } from './auth.js';
import leaderboardRouter from './leaderboard.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Auth middleware on all routes (extracts user if token present)
app.use(authMiddleware);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/leaderboard', leaderboardRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve static files from dist in production
app.use(express.static(path.resolve(__dirname, '../../dist')));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.resolve(__dirname, '../../dist/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
