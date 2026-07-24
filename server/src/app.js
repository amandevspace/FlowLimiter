// server/src/app.js
import './env.js';
import mongoose from 'mongoose';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import connectDB from './config/db.js';
import redisClient from './config/redis.js';
import rateLimiter from './middleware/rateLimiter.js';
import adminRoutes from './routes/admin.js';
import { startLogFlusher } from './utils/logQueue.js';
import statsRoutes from './routes/stats.js';
import simulateRoutes from './routes/simulate.js';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

connectDB();
startLogFlusher();

// Health check route
app.get('/health', async (req, res) => {
  const health = {
    server: 'ok',
    redis: 'unknown',
    mongo: 'unknown',
  };

  try {
    const pong = await redisClient.ping();
    health.redis = pong === 'PONG' ? 'ok' : 'unreachable';
  } catch (err) {
    health.redis = 'unreachable';
  }

  health.mongo = mongoose.connection.readyState === 1 ? 'ok' : 'unreachable';

  const allHealthy = health.redis === 'ok' && health.mongo === 'ok';
  res.status(allHealthy ? 200 : 503).json(health);
});

// --- Auth API (dashboard login) ---
app.use('/auth', authRoutes);

// --- Admin API (key management) ---
app.use('/admin', adminRoutes);
app.use('/stats', statsRoutes);
app.use('/simulate', simulateRoutes);

// --- Phase 2 demo/test routes (static config, used by concurrency.test.js) ---
app.get('/api/demo-fixed', rateLimiter({ algorithm: 'fixed_window', limit: 5, windowSizeInSeconds: 30 }), (req, res) => {
  res.json({ message: 'Fixed window OK' });
});

app.get('/api/demo-bucket', rateLimiter({ algorithm: 'token_bucket', capacity: 5, refillRatePerSec: 0.5 }), (req, res) => {
  res.json({ message: 'Token bucket OK' });
});

app.get('/api/demo-sliding', rateLimiter({ algorithm: 'sliding_window_counter', limit: 5, windowSizeInSeconds: 30 }), (req, res) => {
  res.json({ message: 'Sliding window OK' });
});

// --- Phase 3: real route using per-key config from Mongo/Redis ---
app.get('/api/protected', rateLimiter({ dynamic: true }), (req, res) => {
  res.json({ message: 'Request successful!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));