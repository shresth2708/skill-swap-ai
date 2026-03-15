const Redis = require('ioredis');
const logger = require('../utils/logger');
const { resolveRedisUrl, IOREDIS_OPTIONS } = require('../utils/redis-url.util');

/**
 * Key naming convention: skillswap:matches:{userId}:{strategy}
 * All values are JSON-serialized before storage.
 */
const KEY_PREFIX = 'skillswap';

/**
 * RedisClient — production cache layer with ioredis.
 *
 * Singleton pattern: import this module to get the single instance.
 * Falls back to an in-memory Map when REDIS_URL is not configured,
 * so local dev works without a running Redis server.
 */
class RedisClient {
  /** @type {Redis|null} */
  #client = null;

  /** @type {boolean} */
  #usingRedis = false;

  /** @type {Map<string, { value: string, expireAt: number | null }>} */
  #memoryStore = new Map();

  #hits = 0;
  #misses = 0;

  constructor() {
    const redisUrl = resolveRedisUrl(process.env.REDIS_URL);

    if (redisUrl) {
      this.#client = new Redis(redisUrl, {
        ...IOREDIS_OPTIONS,
        lazyConnect: false,
      });

      this.#client.on('connect', () => {
        logger.info('Redis connected', { url: redisUrl.replace(/\/\/.*@/, '//<credentials>@') });
      });

      this.#client.on('error', (err) => {
        logger.error('Redis connection error', { error: err.message });
      });

      this.#usingRedis = true;
    } else {
      logger.warn('REDIS_URL not set — using in-memory cache (not suitable for production)');
      this.#usingRedis = false;
    }
  }

  /**
   * Whether we're connected to a real Redis instance.
   * @returns {boolean}
   */
  get isRedis() {
    return this.#usingRedis;
  }

  /**
   * The underlying ioredis client (for sharing one TCP connection: cache + presence).
   * @returns {import('ioredis').Redis|null}
   */
  getIoredis() {
    return this.#usingRedis ? this.#client : null;
  }

  /**
   * Retrieve a cached value. Returns parsed JSON or null.
   * Logs cache misses with structured context.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      if (this.#usingRedis) {
        const raw = await this.#client.get(key);
        if (raw === null) {
          this.#misses++;
          logger.debug('Cache miss', { key, backend: 'redis' });
          return null;
        }
        this.#hits++;
        return JSON.parse(raw);
      }

      // In-memory fallback
      const entry = this.#memoryStore.get(key);
      if (!entry) {
        this.#misses++;
        logger.debug('Cache miss', { key, backend: 'memory' });
        return null;
      }

      // Check TTL expiration
      if (entry.expireAt !== null && Date.now() > entry.expireAt) {
        this.#memoryStore.delete(key);
        this.#misses++;
        logger.debug('Cache miss (expired)', { key, backend: 'memory' });
        return null;
      }

      this.#hits++;
      return JSON.parse(entry.value);
    } catch (err) {
      logger.error('Cache GET error', { key, error: err.message });
      return null;
    }
  }

  getCacheStats() {
    return {
      hits: this.#hits,
      misses: this.#misses,
      hitRate: this.#hits + this.#misses > 0 ? this.#hits / (this.#hits + this.#misses) : 0
    };
  }

  /**
   * Store a value with an optional TTL.
   * @param {string} key
   * @param {any} value - Will be JSON.stringify'd
   * @param {number} [ttlSeconds] - Time-to-live in seconds (uses SETEX)
   * @returns {Promise<'OK'>}
   */
  async set(key, value, ttlSeconds) {
    try {
      const serialized = JSON.stringify(value);

      if (this.#usingRedis) {
        if (ttlSeconds) {
          await this.#client.setex(key, ttlSeconds, serialized);
        } else {
          await this.#client.set(key, serialized);
        }
        return 'OK';
      }

      // In-memory fallback
      this.#memoryStore.set(key, {
        value: serialized,
        expireAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
      });
      return 'OK';
    } catch (err) {
      logger.error('Cache SET error', { key, error: err.message });
      return 'OK';
    }
  }

  /**
   * Delete a single cached key.
   * @param {string} key
   * @returns {Promise<number>} Number of keys deleted
   */
  async del(key) {
    try {
      if (this.#usingRedis) {
        return await this.#client.del(key);
      }
      return this.#memoryStore.delete(key) ? 1 : 0;
    } catch (err) {
      logger.error('Cache DEL error', { key, error: err.message });
      return 0;
    }
  }

  /**
   * Invalidate all keys matching a glob pattern.
   * Uses SCAN + DEL for production safety (never KEYS).
   * @param {string} pattern - e.g. 'skillswap:matches:userId123:*'
   * @returns {Promise<number>} Total keys deleted
   */
  async invalidatePattern(pattern) {
    try {
      if (this.#usingRedis) {
        let cursor = '0';
        let totalDeleted = 0;

        do {
          const [nextCursor, keys] = await this.#client.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100,
          );
          cursor = nextCursor;

          if (keys.length > 0) {
            const deleted = await this.#client.del(...keys);
            totalDeleted += deleted;
          }
        } while (cursor !== '0');

        logger.info('Cache invalidated', { pattern, keysDeleted: totalDeleted });
        return totalDeleted;
      }

      // In-memory fallback — basic glob prefix match
      const prefix = pattern.replace(/\*$/, '');
      let count = 0;
      for (const key of this.#memoryStore.keys()) {
        if (key.startsWith(prefix)) {
          this.#memoryStore.delete(key);
          count++;
        }
      }
      logger.info('Cache invalidated (memory)', { pattern, keysDeleted: count });
      return count;
    } catch (err) {
      logger.error('Cache invalidatePattern error', { pattern, error: err.message });
      return 0;
    }
  }

  /**
   * Gracefully disconnect from Redis.
   * Call during application shutdown.
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.#usingRedis && this.#client) {
      await this.#client.quit();
      logger.info('Redis disconnected');
    }
  }
}

// Export singleton
module.exports = new RedisClient();
