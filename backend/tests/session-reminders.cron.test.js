const cron = require('node-cron');
const CronJobManager = require('../cron/session-reminders.cron');
const logger = require('../utils/logger');

jest.mock('node-cron', () => ({
  schedule: jest.fn((pattern, fn) => ({
    stop: jest.fn(),
    start: jest.fn(), // In case it's used
    pattern,
    fn
  }))
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('CronJobManager', () => {
  let cronManager;
  let mockSwapService;
  let mockSessionService;
  let mockSessionRepository;
  let mockEventEmitter;

  beforeEach(() => {
    mockSwapService = { expirePendingSwaps: jest.fn() };
    mockSessionService = {};
    mockSessionRepository = {
      findSessionsForReminder24h: jest.fn().mockResolvedValue([]),
      findSessionsForReminder1h: jest.fn().mockResolvedValue([]),
      findMissedSessions: jest.fn().mockResolvedValue([]),
      markSessionsMissed: jest.fn().mockResolvedValue({}),
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
    
    jest.clearAllMocks();
  });

  describe('startAll', () => {
    it('should register all cron jobs', () => {
      cronManager.startAll();
      expect(cron.schedule).toHaveBeenCalledTimes(3);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('All cron jobs started'));
    });
  });

  describe('stopAll', () => {
    it('should stop all registered jobs', () => {
      cronManager.startAll();
      const mockJobs = cron.schedule.mock.results.map(r => r.value);
      cronManager.stopAll();
      mockJobs.forEach(job => expect(job.stop).toHaveBeenCalled());
    });
  });

  describe('Session Reminders Job', () => {
    it('should send 24h and 1h reminders', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '0 * * * *')[1];
      
      const session24 = { id: 's24', swap: { id: 'swap-1' } };
      const session1 = { id: 's1', swap: { id: 'swap-2' } };
      
      mockSessionRepository.findSessionsForReminder24h.mockResolvedValue([session24]);
      mockSessionRepository.findSessionsForReminder1h.mockResolvedValue([session1]);
      
      await jobFn();
      
      expect(mockEventEmitter.emitSessionReminder24h).toHaveBeenCalledWith(session24, session24.swap);
      expect(mockEventEmitter.emitSessionReminder1h).toHaveBeenCalledWith(session1, session1.swap);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Sent 1 24h reminders'));
    });

    it('should log error if job fails', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '0 * * * *')[1];
      
      mockSessionRepository.findSessionsForReminder24h.mockRejectedValue(new Error('DB Fail'));
      
      await jobFn();
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Session reminder job failed'), { error: 'DB Fail' });
    });
  });

  describe('Swap Expiration Job', () => {
    it('should call expirePendingSwaps', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '*/30 * * * *')[1];
      
      mockSwapService.expirePendingSwaps.mockResolvedValue(5);
      
      await jobFn();
      
      expect(mockSwapService.expirePendingSwaps).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Expired 5 pending swaps'));
    });

    it('should log error if expiration fails', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '*/30 * * * *')[1];
      
      mockSwapService.expirePendingSwaps.mockRejectedValue(new Error('Svc Fail'));
      
      await jobFn();
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Swap expiration job failed'), { error: 'Svc Fail' });
    });
  });

  describe('Missed Session Check Job', () => {
    it('should mark missed sessions', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '0 0 * * *')[1];
      
      const session = { id: 's-miss', swap: { id: 'swap-3' } };
      mockSessionRepository.findMissedSessions.mockResolvedValue([session]);
      
      await jobFn();
      
      expect(mockSessionRepository.markSessionsMissed).toHaveBeenCalledWith(['s-miss']);
      expect(mockEventEmitter.emitSessionMissed).toHaveBeenCalledWith(session, session.swap);
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Marked 1 sessions as missed'));
    });

    it('should log when no missed sessions found', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '0 0 * * *')[1];
      
      mockSessionRepository.findMissedSessions.mockResolvedValue([]);
      
      await jobFn();
      
      expect(logger.info).toHaveBeenCalledWith('Cron: No missed sessions found');
    });

    it('should log error if check fails', async () => {
      cronManager.startAll();
      const jobFn = cron.schedule.mock.calls.find(c => c[0] === '0 0 * * *')[1];
      
      mockSessionRepository.findMissedSessions.mockRejectedValue(new Error('Repo Fail'));
      
      await jobFn();
      
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Missed session check failed'), { error: 'Repo Fail' });
    });
  });
});
