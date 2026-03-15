/**
 * Upstash Redis expects TLS. Plain `redis://` to *.upstash.io often fails (ECONNRESET);
 * `rediss://` matches their docs.
 * @param {string|undefined} url
 * @returns {string|undefined}
 */
function resolveRedisUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }
  const trimmed = url.trim();
  if (!trimmed) return url;
  if (/\.upstash\.io/i.test(trimmed) && /^redis:\/\//i.test(trimmed) && !/^rediss:\/\//i.test(trimmed)) {
    return trimmed.replace(/^redis:\/\//i, 'rediss://');
  }
  return trimmed;
}

/** @see https://github.com/luin/ioredis#special-note-aws-elasticache-and-upstash */
const IOREDIS_OPTIONS = {
  maxRetriesPerRequest: null,
  // Upstash / remote Redis: avoid extra READY round-trips
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 200, 3000);
  },
};

module.exports = { resolveRedisUrl, IOREDIS_OPTIONS };
