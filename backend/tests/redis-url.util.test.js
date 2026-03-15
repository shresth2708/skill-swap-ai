const { resolveRedisUrl } = require('../utils/redis-url.util');

describe('resolveRedisUrl', () => {
  it('upgrades redis to rediss for Upstash hosts', () => {
    const u = 'redis://default:xx@proven-parakeet-1.upstash.io:6379';
    expect(resolveRedisUrl(u)).toBe('rediss://default:xx@proven-parakeet-1.upstash.io:6379');
  });
  it('leaves rediss unchanged', () => {
    const u = 'rediss://default:xx@host.upstash.io:6379';
    expect(resolveRedisUrl(u)).toBe(u);
  });
  it('leaves non-Upstash redis URLs unchanged', () => {
    const u = 'redis://127.0.0.1:6379';
    expect(resolveRedisUrl(u)).toBe(u);
  });
});
