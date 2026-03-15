const logger = require('../../utils/logger');

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
      quit: jest.fn(),
    };
  });
});

describe('RedisClient', () => {
  let RedisClient;
  let redisClient;
  let RedisMock;

  beforeEach(() => {
    jest.resetModules();
    RedisMock = require('ioredis');
    jest.clearAllMocks();
  });

  describe('Memory Fallback (No REDIS_URL)', () => {
    beforeEach(() => {
      delete process.env.REDIS_URL;
      const redisClientModule = require('../../cache/redis.client');
      redisClient = redisClientModule;
    });

    it('uses memory store when URL is missing', async () => {
      expect(redisClient.isRedis).toBe(false);
    });

    it('can set and get values', async () => {
      await redisClient.set('foo', { a: 1 });
      const val = await redisClient.get('foo');
      expect(val).toEqual({ a: 1 });
    });

    it('returns null on miss', async () => {
      const val = await redisClient.get('missing');
      expect(val).toBeNull();
    });

    it('handles TTL expiration', async () => {
      jest.useFakeTimers();
      await redisClient.set('expires', 'bar', 10); // 10 seconds
      
      // Should still be there
      expect(await redisClient.get('expires')).toBe('bar');

      // Fast forward 11 seconds
      jest.advanceTimersByTime(11000);
      
      expect(await redisClient.get('expires')).toBeNull();
      jest.useRealTimers();
    });

    it('can delete values', async () => {
      await redisClient.set('tobedeleted', 123);
      const deleted = await redisClient.del('tobedeleted');
      expect(deleted).toBe(1);
      expect(await redisClient.get('tobedeleted')).toBeNull();
    });

    it('can invalidate by pattern', async () => {
      await redisClient.set('user:1:key1', 1);
      await redisClient.set('user:1:key2', 2);
      await redisClient.set('user:2:key1', 3);

      await redisClient.invalidatePattern('user:1:*');

      expect(await redisClient.get('user:1:key1')).toBeNull();
      expect(await redisClient.get('user:2:key1')).toBe(3);
    });

    it('tracks stats', async () => {
      await redisClient.get('any'); // miss
      await redisClient.set('any', 1);
      await redisClient.get('any'); // hit
      const stats = redisClient.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('Redis Backend (With REDIS_URL)', () => {
    let mockInstance;

    beforeEach(() => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      const redisClientModule = require('../../cache/redis.client');
      redisClient = redisClientModule;
      // The singleton was created, so ioredis constructor was called
      mockInstance = RedisMock.mock.results[0].value;
    });

    it('uses ioredis when URL is set', () => {
      expect(redisClient.isRedis).toBe(true);
      expect(RedisMock).toHaveBeenCalledWith(process.env.REDIS_URL, expect.any(Object));
    });

    it('get returns parsed JSON from Redis', async () => {
      mockInstance.get.mockResolvedValue(JSON.stringify({ x: 1 }));
      const val = await redisClient.get('k');
      expect(val).toEqual({ x: 1 });
    });

    it('get returns null on Redis miss', async () => {
      mockInstance.get.mockResolvedValue(null);
      const val = await redisClient.get('k');
      expect(val).toBeNull();
    });

    it('set uses setex when TTL provided', async () => {
      await redisClient.set('k', 'v', 60);
      expect(mockInstance.setex).toHaveBeenCalledWith('k', 60, JSON.stringify('v'));
    });

    it('set uses set when no TTL', async () => {
        await redisClient.set('k', 'v');
        expect(mockInstance.set).toHaveBeenCalledWith('k', JSON.stringify('v'));
    });

    it('del calls redis del', async () => {
        mockInstance.del.mockResolvedValue(1);
        await redisClient.del('k');
        expect(mockInstance.del).toHaveBeenCalledWith('k');
    });

    it('invalidatePattern uses SCAN and DEL', async () => {
      // Mock scan to return a few keys then end
      mockInstance.scan.mockResolvedValueOnce(['next', ['k1', 'k2']]);
      mockInstance.scan.mockResolvedValueOnce(['0', ['k3']]);
      mockInstance.del.mockResolvedValue(1);

      await redisClient.invalidatePattern('prefix:*');

      expect(mockInstance.scan).toHaveBeenCalledTimes(2);
      expect(mockInstance.del).toHaveBeenCalledTimes(2);
    });

    it('disconnect calls quit', async () => {
        await redisClient.disconnect();
        expect(mockInstance.quit).toHaveBeenCalled();
    });

    it('handles catch blocks (errors)', async () => {
        mockInstance.get.mockRejectedValue(new Error('redis fail'));
        const val = await redisClient.get('k');
        expect(val).toBeNull(); // returns null on error

        mockInstance.set.mockRejectedValue(new Error('redis fail'));
        const res = await redisClient.set('k', 'v');
        expect(res).toBe('OK'); // still returns OK on error (logged)
    });
  });
});
