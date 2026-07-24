// server/src/middleware/strategies/slidingWindowCounter.js
import redisClient from '../../config/redis.js';

const slidingWindowStrategy = async ({ apiKey, limit, windowSizeInSeconds }) => {
  const now = Date.now() / 1000;
  const currentWindow = Math.floor(now / windowSizeInSeconds);
  const previousWindow = currentWindow - 1;

  const currentKey = `rate:${apiKey}:sw:${currentWindow}`;
  const previousKey = `rate:${apiKey}:sw:${previousWindow}`;

  // Increment current window count atomically
  const currentCount = await redisClient.incr(currentKey);
  if (currentCount === 1) {
    await redisClient.expire(currentKey, windowSizeInSeconds * 2);
  }

  const previousCountRaw = await redisClient.get(previousKey);
  const previousCount = previousCountRaw ? parseInt(previousCountRaw, 10) : 0;

  // How far are we into the current window? (0 = just started, 1 = about to end)
  const elapsedInCurrentWindow =
    (now % windowSizeInSeconds) / windowSizeInSeconds;
  const overlapWithPrevious = 1 - elapsedInCurrentWindow;

  const estimatedCount =
    previousCount * overlapWithPrevious + currentCount;

  const remaining = Math.max(limit - Math.ceil(estimatedCount), 0);
  const resetInSeconds =
    (currentWindow + 1) * windowSizeInSeconds - Math.floor(now);

  return {
    allowed: estimatedCount <= limit,
    remaining,
    resetInSeconds,
  };
};

export default slidingWindowStrategy;