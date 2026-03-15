process.env.JWT_SECRET = 'test-secret-that-is-at-least-10-chars';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-10-chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.LOG_LEVEL = 'error'; // Keep test output clean
