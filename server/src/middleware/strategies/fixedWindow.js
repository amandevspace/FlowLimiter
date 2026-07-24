// server/src/middleware/strategies/fixedWindow.js
import redisClient from '../../config/redis.js';

const fixedWindowStrategy = async ({ apiKey, limit, windowSizeInSeconds }) => {
  const currentWindow = Math.floor(Date.now() / 1000 / windowSizeInSeconds);
  const redisKey = `rate:${apiKey}:fixed:${currentWindow}`;

  const currentCount = await redisClient.incr(redisKey);

  if (currentCount === 1) {
    await redisClient.expire(redisKey, windowSizeInSeconds);
  }

  const remaining = Math.max(limit - currentCount, 0);
  const resetInSeconds =
    (currentWindow + 1) * windowSizeInSeconds - Math.floor(Date.now() / 1000);

  return {
    allowed: currentCount <= limit,
    remaining,
    resetInSeconds,
  };
};

export default fixedWindowStrategy;