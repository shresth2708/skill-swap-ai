/**
 * In-memory cache with a Redis-compatible interface.
 * 
 * Production: swap this out for ioredis when Redis is available.
 * The API surface (get/set/del) is kept intentionally minimal so
 * the MatchingService never knows which backend it's using.
 */
class CacheStore {
  constructor() {
    /** @private */
    this._store = new Map();
    /** @private */
    this._timers = new Map();
  }

  /**
   * Retrieve a cached value.
   * @param {string} key
   * @returns {Promise<string|null>}
   */
  async get(key) {
    const value = this._store.get(key);
    return value !== undefined ? value : null;
  }

  /**
   * Store a value with an optional TTL (in seconds).
   * @param {string} key
   * @param {string} value - Must be a string (JSON.stringify before storing objects)
   * @param {'EX'} [mode] - Only 'EX' (seconds) is supported, matching Redis SET syntax
   * @param {number} [ttlSeconds]
   * @returns {Promise<'OK'>}
   */
  async set(key, value, mode, ttlSeconds) {
    this._store.set(key, value);

    // Clear any existing expiry timer
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
    }

    // Set expiry if TTL provided
    if (mode === 'EX' && ttlSeconds) {
      const timer = setTimeout(() => {
        this._store.delete(key);
        this._timers.delete(key);
      }, ttlSeconds * 1000);

      // Don't block Node's event loop from exiting
      timer.unref();
      this._timers.set(key, timer);
    }

    return 'OK';
  }

  /**
   * Delete a cached key.
   * @param {string} key
   * @returns {Promise<number>} 1 if deleted, 0 if key didn't exist
   */
  async del(key) {
    if (this._timers.has(key)) {
      clearTimeout(this._timers.get(key));
      this._timers.delete(key);
    }
    return this._store.delete(key) ? 1 : 0;
  }

  /**
   * Delete all keys matching a pattern (basic glob: prefix*).
   * @param {string} pattern - Only prefix* patterns are supported
   * @returns {Promise<number>} Number of keys deleted
   */
  async delByPattern(pattern) {
    const prefix = pattern.replace(/\*$/, '');
    let count = 0;
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        await this.del(key);
        count++;
      }
    }
    return count;
  }
}

// Export a singleton — mirrors how ioredis exports a single client
module.exports = new CacheStore();
