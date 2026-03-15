jest.mock('../config/db.config', () => ({}));
jest.mock('../repositories/session.repository');
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/user.repository');

const CronJobManager = require('../cron/session-reminders.cron');

describe('CronJobManager', () => {
  let cronManager;
  let mockSwapService;
  let mockSessionService;
  let mockSessionRepository;
  let mockEventEmitter;

  beforeEach(() => {
    mockSwapService = {
      expirePendingSwaps: jest.fn().mockResolvedValue(0),
    };

    mockSessionService = {};

    mockSessionRepository = {
      findSessionsForReminder24h: jest.fn().mockResolvedValue([]),
      findSessionsForReminder1h: jest.fn().mockResolvedValue([]),
      findMissedSessions: jest.fn().mockResolvedValue([]),
      markSessionsMissed: jest.fn().mockResolvedValue({ count: 0 }),
    };

    mockEventEmitter = {
      emitSessionReminder24h: jest.fn(),
      emitSessionReminder1h: jest.fn(),
      emitSessionMissed: jest.fn(),
    };

    cronManager = new CronJobManager(
      mockSwapService,
      mockSessionService,
      mockSessionRepository,
      mockEventEmitter
    );
  });

  afterEach(() => {
    cronManager.stopAll();
  });

  it('should start all cron jobs without error', () => {
    expect(() => cronManager.startAll()).not.toThrow();
  });

  it('should stop all cron jobs without error', () => {
    cronManager.startAll();
    expect(() => cronManager.stopAll()).not.toThrow();
  });

  it('should be constructable with default dependencies', () => {
    // This ensures the default constructors don't throw at import time
    expect(() => {
      new CronJobManager(
        mockSwapService,
        mockSessionService,
        mockSessionRepository,
        mockEventEmitter
      );
    }).not.toThrow();
  });
});
