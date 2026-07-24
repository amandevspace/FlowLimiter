// server/src/middleware/strategies/tokenBucket.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import redisClient from '../../config/redis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const luaScript = fs.readFileSync(
  path.join(__dirname, 'tokenBucket.lua'),
  'utf8'
);

const tokenBucketStrategy = async ({
  apiKey,
  capacity = 10,
  refillRatePerSec = 1,
}) => {
  const redisKey = `rate:${apiKey}:bucket`;
  const now = Date.now() / 1000;

  const result = await redisClient.eval(
    luaScript,
    1,               // number of KEYS
    redisKey,        // KEYS[1]
    capacity,        // ARGV[1]
    refillRatePerSec,// ARGV[2]
    now,             // ARGV[3]
    1                // ARGV[4] — tokens requested per call
  );

  const [allowed, tokensRemaining] = result;

  return {
    allowed: allowed === 1,
    remaining: Math.floor(tokensRemaining),
    resetInSeconds: Math.ceil((capacity - tokensRemaining) / refillRatePerSec),
  };
};

export default tokenBucketStrategy;