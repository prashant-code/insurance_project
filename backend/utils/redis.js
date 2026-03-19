import { createClient } from 'redis';
import config from '../config/config.js';
import { logger } from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL || config.redis?.url || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl,
  password: process.env.REDIS_PASSWORD || undefined
});

export const redisPublisher = redisClient.duplicate();
export const redisSubscriber = redisClient.duplicate();

const connectRedis = async () => {
  try {
    await redisClient.connect();
    await redisPublisher.connect();
    await redisSubscriber.connect();
    logger.info('Redis caching and Pub/Sub connections established successfully.');
  } catch (err) {
    logger.error('Redis connection failed:', err);
  }
};

connectRedis();

// Token Bucket LUA Script for Rate Limiting
// KEYS[1] = bucket key (e.g. ratelimit:IP)
// ARGV[1] = capacity
// ARGV[2] = refill rate (tokens per second)
// ARGV[3] = current timestamp (seconds)
// ARGV[4] = requested tokens
const LUA_TOKEN_BUCKET = `
  local key = KEYS[1]
  local capacity = tonumber(ARGV[1])
  local refill_rate = tonumber(ARGV[2])
  local now = tonumber(ARGV[3])
  local requested = tonumber(ARGV[4])

  local bucket = redis.call("HMGET", key, "tokens", "last_refill")
  local tokens = tonumber(bucket[1])
  local last_refill = tonumber(bucket[2])

  if not tokens then
    tokens = capacity
    last_refill = now
  else
    local elapsed = math.max(0, now - last_refill)
    tokens = math.min(capacity, tokens + (elapsed * refill_rate))
    last_refill = now
  end

  if tokens >= requested then
    tokens = tokens - requested
    redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
    redis.call("EXPIRE", key, math.ceil(capacity / refill_rate))
    return {1, tokens} 
  else
    redis.call("HMSET", key, "tokens", tokens, "last_refill", last_refill)
    redis.call("EXPIRE", key, math.ceil(capacity / refill_rate))
    return {0, tokens}
  end
`;

export const rateLimiterMiddleware = async (req, res, next) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
  const key = `ratelimit:${ip}`;
  const capacity = config.redis?.rateLimit?.capacity || 50;
  const refillRate = config.redis?.rateLimit?.refillRate || 5;
  const now = Math.floor(Date.now() / 1000);
  
  try {
    if (!redisClient.isReady) {
      return next(); // Fail open if Redis is down, or can fail closed based on policy
    }

    const result = await redisClient.eval(LUA_TOKEN_BUCKET, {
      keys: [key],
      arguments: [capacity.toString(), refillRate.toString(), now.toString(), '1']
    });

    const allowed = result[0] === 1;
    const remaining = result[1];

    res.setHeader('X-RateLimit-Limit', capacity);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (!allowed) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`);
      return res.status(429).json({ error: 'Too Many Requests (Token Bucket Exhausted)' });
    }
    next();
  } catch (error) {
    logger.error('Rate limit execution error:', error);
    next();
  }
};
