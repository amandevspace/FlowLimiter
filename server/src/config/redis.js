import Redis from 'ioredis';

const redisClient = new Redis(process.env.REDIS_URL);

redisClient.on('connect', () => console.log('Redis connected'));
redisClient.on('error', (err) => console.error('Redis error full:', err));

export default redisClient;