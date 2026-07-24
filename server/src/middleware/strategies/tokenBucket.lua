-- server/src/middleware/strategies/tokenBucket.lua
-- KEYS[1] = bucket key
-- ARGV[1] = capacity (max tokens)
-- ARGV[2] = refill rate (tokens per second)
-- ARGV[3] = current timestamp (seconds, float)
-- ARGV[4] = requested tokens (usually 1)

local bucketKey = KEYS[1]
local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call("HMGET", bucketKey, "tokens", "lastRefillTs")
local tokens = tonumber(bucket[1])
local lastRefillTs = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  lastRefillTs = now
end

-- Calculate how many tokens have accumulated since last refill
local elapsed = math.max(0, now - lastRefillTs)
local refillAmount = elapsed * refillRate
tokens = math.min(capacity, tokens + refillAmount)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call("HMSET", bucketKey, "tokens", tokens, "lastRefillTs", now)
redis.call("EXPIRE", bucketKey, math.ceil(capacity / refillRate) * 2)

return { allowed, tokens }