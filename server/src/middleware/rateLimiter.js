// server/src/middleware/rateLimiter.js
import fixedWindowStrategy from './strategies/fixedWindow.js';
import tokenBucketStrategy from './strategies/tokenBucket.js';
import slidingWindowStrategy from './strategies/slidingWindowCounter.js';
import { getKeyConfig } from '../utils/keyConfigCache.js';
import { queueLog } from '../utils/logQueue.js';

const strategies = {
  fixed_window: fixedWindowStrategy,
  token_bucket: tokenBucketStrategy,
  sliding_window_counter: slidingWindowStrategy,
};

// 'open'   — if Redis/Mongo is unreachable, let the request through.
//            Prioritizes availability; a downstream outage doesn't
//            take down the whole API, but limits aren't enforced
//            during the outage window.
// 'closed' — if Redis/Mongo is unreachable, reject the request.
//            Prioritizes strict enforcement; guarantees the limit is
//            never silently bypassed, at the cost of the protected
//            routes going fully down if Redis goes down.
const FAIL_POLICY = process.env.RATE_LIMIT_FAIL_POLICY === 'closed' ? 'closed' : 'open';

/**
 * Two modes:
 *
 * 1. Static (unchanged from Phase 2) — pass algorithm/limit/etc directly.
 *    Still used by the /api/demo-* routes for the concurrency tests.
 *
 * 2. Dynamic — pass { dynamic: true } and nothing else. Config is looked
 *    up per-request from Mongo (via the Redis-cached getKeyConfig), so
 *    each API key can have its own algorithm/limits set through the
 *    admin API without redeploying. Use this on real product routes.
 */
const rateLimiter = (config = {}) => {
  const { dynamic = false } = config;

  return async (req, res, next) => {
    const apiKey = req.header('x-api-key');

    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing API key. Include it in the x-api-key header.',
      });
    }

let resolvedConfig;

    if (dynamic) {
      let keyConfig;
      try {
        keyConfig = await getKeyConfig(apiKey);
      } catch (err) {
        console.error('Rate limiter error (key config lookup):', err.message);

        if (FAIL_POLICY === 'closed') {
          return res.status(503).json({
            error: 'Rate limiting service unavailable. Request rejected (fail-closed policy).',
          });
        }

        // Fail-open: we can't look up this key's config, so we can't
        // enforce a rate limit for it right now — let the request through.
        return next();
      }

      if (!keyConfig) {
        return res.status(403).json({
          error: 'Invalid or inactive API key.',
        });
      }

      resolvedConfig = keyConfig;
    } else {
      const {
        algorithm = 'fixed_window',
        limit = 10,
        windowSizeInSeconds = 60,
        capacity = 10,
        refillRatePerSec = 1,
      } = config;

      resolvedConfig = { algorithm, limit, windowSizeInSeconds, capacity, refillRatePerSec };
    }

    const { algorithm } = resolvedConfig;
    const strategyFn = strategies[algorithm];

    if (!strategyFn) {
      throw new Error(`Unknown rate limit algorithm: ${algorithm}`);
    }

    try {
      const result = await strategyFn({ apiKey, ...resolvedConfig });

      res.set({
        'X-RateLimit-Limit': algorithm === 'token_bucket' ? resolvedConfig.capacity : resolvedConfig.limit,
        'X-RateLimit-Remaining': result.remaining,
        'X-RateLimit-Reset': result.resetInSeconds,
      });

      // Fire-and-forget — never blocks the response.
      queueLog({ apiKey, route: req.originalUrl, algorithm, allowed: result.allowed });

      if (!result.allowed) {
        res.set('Retry-After', result.resetInSeconds);
        return res.status(429).json({
          error: 'Too many requests. Please try again later.',
          retryAfter: `${result.resetInSeconds}s`,
        });
      }

      next();
    } catch (err) {
      console.error('Rate limiter error:', err.message);

      if (FAIL_POLICY === 'closed') {
        return res.status(503).json({
          error: 'Rate limiting service unavailable. Request rejected (fail-closed policy).',
        });
      }

      // Fail-open: let the request through despite the error.
      next();
    }
  };
};

export default rateLimiter;