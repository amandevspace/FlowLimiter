// server/src/utils/keyConfigCache.js
import redisClient from '../config/redis.js';
import ApiKey from '../models/ApiKey.js';

const CACHE_TTL_SECONDS = 60;          // how long a found key's config is cached
const NEGATIVE_CACHE_TTL_SECONDS = 10; // how long a "not found" result is cached
                                        // (short, so a newly-created key isn't
                                        // stuck looking invalid for a full minute)

const cacheKeyFor = (apiKey) => `rate:config:${apiKey}`;

/**
 * Returns the rate-limit config for an API key, or null if the key doesn't
 * exist / is inactive. Checks Redis first, falls back to Mongo, then
 * populates Redis either way (including a short-lived negative cache) so a
 * flood of requests with a bad key doesn't hammer Mongo.
 */
export const getKeyConfig = async (apiKey) => {
  const cacheKey = cacheKeyFor(apiKey);

  const cached = await redisClient.get(cacheKey);
  if (cached !== null) {
    return cached === 'null' ? null : JSON.parse(cached);
  }

  const doc = await ApiKey.findOne({ key: apiKey, active: true }).lean();

  if (!doc) {
    await redisClient.set(cacheKey, 'null', 'EX', NEGATIVE_CACHE_TTL_SECONDS);
    return null;
  }

  const config = {
    algorithm: doc.algorithm,
    limit: doc.limit,
    windowSizeInSeconds: doc.windowSizeInSeconds,
    capacity: doc.capacity,
    refillRatePerSec: doc.refillRatePerSec,
  };

  await redisClient.set(cacheKey, JSON.stringify(config), 'EX', CACHE_TTL_SECONDS);
  return config;
};

/**
 * Call this from the admin routes after create/update/delete so a change
 * takes effect immediately instead of waiting out the TTL.
 */
export const invalidateKeyConfig = async (apiKey) => {
  await redisClient.del(cacheKeyFor(apiKey));
};