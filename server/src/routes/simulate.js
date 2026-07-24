// server/src/routes/simulate.js
import express from 'express';
import fixedWindowStrategy from '../middleware/strategies/fixedWindow.js';
import tokenBucketStrategy from '../middleware/strategies/tokenBucket.js';
import slidingWindowStrategy from '../middleware/strategies/slidingWindowCounter.js';
import { getKeyConfig } from '../utils/keyConfigCache.js';
import { queueLog } from '../utils/logQueue.js';

const router = express.Router();

const strategies = {
  fixed_window: fixedWindowStrategy,
  token_bucket: tokenBucketStrategy,
  sliding_window_counter: slidingWindowStrategy,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_REQUESTS = 60;
const MIN_INTERVAL_MS = 50;

/**
 * Runs `totalRequests` calls against a key's configured strategy, spaced
 * `intervalMs` apart, and returns a timeline of allowed/rejected results.
 * Also logs each call through the normal log queue so it shows up in
 * /stats too, same as real traffic would.
 */
const runBurst = async (apiKey, config, totalRequests, intervalMs) => {
  const strategyFn = strategies[config.algorithm];
  const timeline = [];

  for (let i = 0; i < totalRequests; i++) {
    const result = await strategyFn({ apiKey, ...config });

    timeline.push({
      n: i + 1,
      timestamp: new Date().toISOString(),
      allowed: result.allowed,
    });

    queueLog({
      apiKey,
      route: '/simulate/compare',
      algorithm: config.algorithm,
      allowed: result.allowed,
    });

    if (i < totalRequests - 1) {
      await sleep(intervalMs);
    }
  }

  return timeline;
};

// POST /simulate/compare
// body: { keyA, keyB, totalRequests, intervalMs }
router.post('/compare', async (req, res) => {
  try {
    const {
      keyA,
      keyB,
      totalRequests = 30,
      intervalMs = 200,
    } = req.body;

    if (!keyA || !keyB) {
      return res.status(400).json({ error: 'keyA and keyB are required' });
    }

    const clampedRequests = Math.min(Math.max(Number(totalRequests) || 30, 1), MAX_REQUESTS);
    const clampedInterval = Math.max(Number(intervalMs) || 200, MIN_INTERVAL_MS);

    const [configA, configB] = await Promise.all([
      getKeyConfig(keyA),
      getKeyConfig(keyB),
    ]);

    if (!configA) return res.status(403).json({ error: `keyA is invalid or inactive` });
    if (!configB) return res.status(403).json({ error: `keyB is invalid or inactive` });

    // Run both bursts concurrently so they experience the same wall-clock
    // window — that's what makes fixed_window vs token_bucket vs
    // sliding_window differences actually comparable.
    const [timelineA, timelineB] = await Promise.all([
      runBurst(keyA, configA, clampedRequests, clampedInterval),
      runBurst(keyB, configB, clampedRequests, clampedInterval),
    ]);

    res.json({
      keyA: { key: keyA, algorithm: configA.algorithm, timeline: timelineA },
      keyB: { key: keyB, algorithm: configB.algorithm, timeline: timelineB },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;