const request = require('supertest');
const app = require('../app');
const ReviewService = require('../services/review.service');
const MatchingService = require('../services/matching.service');
const NotificationService = require('../services/notification.service');
const { validateTransition } = require('../utils/swap-state-machine');
const logger = require('../utils/logger');
const prisma = require('../config/db.config');
const { reviewEventEmitter } = require('../events/review.events');
const { swapEventEmitter } = require('../events/swap.events');
const { sessionEventEmitter } = require('../events/session.events');

// Mock ioredis to prevent connection hangs
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    quit: jest.fn().mockResolvedValue('OK'),
  }));
});

// Control auth mock state
let mockAuthSuccess = true;
jest.mock('../middlewares/auth.middleware', () => ({
  verifyAccessToken: (req, res, next) => {
    if (!mockAuthSuccess) {
       const err = new Error('Auth Failed');
       err.statusCode = 401;
       return next(err);
    }
    req.user = { id: 'u1' };
    next();
  }
}));

jest.mock('../config/db.config', () => ({
  notification: { updateMany: jest.fn() },
  match: { findUnique: jest.fn() }
}));

describe('Final Coverage Audit', () => {

  describe('App & Routes', () => {
    it('GET / hits root route (app.js 55)', async () => {
      const res = await request(app).get('/');
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('Welcome');
    });

    it('GET /invalid hits 404 handler (app.js 60-63)', async () => {
      const res = await request(app).get('/api/invalid-route-123');
      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('auth.middleware handles missing Bearer (Line 15)', async () => {
        // Since we mocked the whole module, we can't test Line 15 via app request
        // unless we call the real middleware.
        // We'll call the actual middleware function for coverage.
        const auth = jest.requireActual('../middlewares/auth.middleware');
        const req = { headers: { authorization: 'Basic 123' } };
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        const next = jest.fn();
        auth.verifyAccessToken(req, res, next);
        expect(res.status).toHaveBeenCalledWith(401);
    });

    it('user.routes SQL injection logic (Line 23-24)', async () => {
        // auth.middleware is already mocked at top level
        const resFail = await request(app)
            .put('/api/users/me')
            .send({ displayName: 'SELECT * FROM users' });
        
        expect(resFail.statusCode).toBe(400); // Validation error
        expect(resFail.body.success).toBe(false);
    });
  });

  describe('Services Internal Gaps', () => {
    it('ReviewService: submitReview already reviewed (Line 95)', async () => {
        const mockReviewRepo = { findBySwapAndReviewer: jest.fn().mockResolvedValue({ id: 'r1' }) };
        const mockSwapRepo = { findById: jest.fn().mockResolvedValue({ id: 's1', status: 'COMPLETED', initiatorId: 'u1', receiverId: 'u2' }) };
        const svc = new ReviewService(mockReviewRepo, mockSwapRepo, {}, {});
        await expect(svc.submitReview('s1', 'u1', { rating: 5 }))
            .rejects.toThrow('already reviewed');
    });

    it('ReviewService: editReview not found (Line 133)', async () => {
        const mockReviewRepo = { findById: jest.fn().mockResolvedValue(null) };
        const svc = new ReviewService(mockReviewRepo, {}, {}, {});
        await expect(svc.editReview('r1', 'u1', {}))
            .rejects.toThrow('Review not found');
    });

    it('ReviewService: editReview window/rating (Line 146-148, 155)', async () => {
        const oldDate = new Date();
        oldDate.setHours(oldDate.getHours() - 25);
        const mockReviewRepo = { 
            findById: jest.fn()
                .mockResolvedValueOnce({ id: 'r1', reviewerId: 'u1', createdAt: oldDate }) // Window hit
                .mockResolvedValueOnce({ id: 'r1', reviewerId: 'u1', createdAt: new Date() }) // Rating hit
        };
        const svc = new ReviewService(mockReviewRepo, {}, {}, {});
        
        // Window hit
        await expect(svc.editReview('r1', 'u1', {}))
            .rejects.toThrow('within 24 hours');
            
        // Rating hit
        await expect(svc.editReview('r1', 'u1', { rating: 6 }))
            .rejects.toThrow('between 1 and 5');
    });

    it('MatchingService: _validateMatchAction 404 (Line 332)', async () => {
        // Use the real service but mock the repository it would use by default
        // or just ensure we pass a valid object.
        const mockRepo = { findById: jest.fn().mockResolvedValue(null) };
        const svc = new MatchingService(undefined, mockRepo, undefined, { invalidatePattern: jest.fn() });
        await expect(svc.acceptMatch('m1', 'u1')).rejects.toThrow('Match not found');
    });

    it('MatchingService: setStrategy and getMatchById (Line 59, 213-220)', async () => {
        const mockRepo = { findById: jest.fn().mockResolvedValue({ id: 'm1' }) };
        const svc = new MatchingService(null, mockRepo);
        
        // hit setStrategy (Line 59)
        svc.setStrategy(svc['#strategy']); // reusing default or just pass null
        
        // hit getMatchById found (Line 213, 220)
        const match = await svc.getMatchById('m1');
        expect(match.id).toBe('m1');

        // hit getMatchById not found (Line 215-218)
        mockRepo.findById.mockResolvedValue(null);
        await expect(svc.getMatchById('m2')).rejects.toThrow('Match not found');
    });

    it('NotificationService: markRead 404 (Line 160)', async () => {
        prisma.notification.updateMany.mockResolvedValue({ count: 0 });
        const svc = new NotificationService();
        await expect(svc.markRead('n1', 'u1')).rejects.toThrow('Notification not found');
    });

    it('NotificationService: Diverse event payloads (Line 265-267, 288)', async () => {
        const svc = new NotificationService();
        const spy = jest.spyOn(svc, 'send').mockResolvedValue();
        await svc.registerListeners();

        // Emit with REAL payloads to hit non-null branches
        reviewEventEmitter.emit('review:received', { review: { id: 'r1' }, notifyUserId: 'u1' });
        swapEventEmitter.emit('swap:accepted', { swap: { id: 's1' }, notifyUserIds: ['u1'] });
        sessionEventEmitter.emit('session:scheduled', { session: { id: 'sess1' }, notifyUserId: 'u1' });

        await new Promise(r => setTimeout(r, 20));
        expect(spy).toHaveBeenCalled();
    });
  });

  describe('Events Gaps', () => {
      it('ReviewEventEmitter gaps (Line 45-60)', () => {
          const { reviewEventEmitter } = require('../events/review.events');
          const spy = jest.fn();
          reviewEventEmitter.on('review:updated', spy);
          reviewEventEmitter.on('review:flagged', spy);
          
          reviewEventEmitter.emitReviewUpdated({ id: 'r1' }, { id: 'u1' });
          reviewEventEmitter.emitReviewFlagged({ id: 'r1' }, 'admin1');
          expect(spy).toHaveBeenCalledTimes(2);
      });

      it('SessionEventEmitter gaps (Line 57-125)', () => {
          const { sessionEventEmitter } = require('../events/session.events');
          const spy = jest.fn();
          sessionEventEmitter.on('session:rescheduled', spy);
          sessionEventEmitter.on('session:completed', spy);
          sessionEventEmitter.on('session:reminder_24h', spy);
          sessionEventEmitter.on('session:reminder_1h', spy);
          sessionEventEmitter.on('session:missed', spy);
          
          sessionEventEmitter.emitSessionRescheduled({ id: 's1' }, { id: 'sw1' }, { id: 'u1' }, { id: 'u2' }, 'u1');
          sessionEventEmitter.emitSessionCompleted({ id: 's1' }, { initiatorId: 'u1' });
          sessionEventEmitter.emitSessionReminder24h({ id: 's1' }, { initiatorId: 'u1' });
          sessionEventEmitter.emitSessionReminder1h({ id: 's1' }, { initiatorId: 'u1' });
          sessionEventEmitter.emitSessionMissed({ id: 's1' }, { initiatorId: 'u1' });
          expect(spy).toHaveBeenCalledTimes(5);
      });
  });

  describe('RedisClient Gaps', () => {
      it('handles redis errors in get/set/del/invalidatePattern', async () => {
          const redisClient = require('../cache/redis.client');
          const spyError = jest.spyOn(logger, 'error').mockImplementation();
          const spyWarn = jest.spyOn(logger, 'warn').mockImplementation();
          const spyInfo = jest.spyOn(logger, 'info').mockImplementation();

          // Test cache stats (always works)
          const stats = redisClient.getCacheStats();
          expect(stats).toHaveProperty('hits');
          expect(stats).toHaveProperty('misses');
          expect(stats).toHaveProperty('hitRate');

          // The ioredis mock at top of file means the singleton may use
          // either the mock Redis or in-memory fallback depending on env.
          // Either way, these operations should not throw.
          await redisClient.set('test-key', { foo: 'bar' }, 10);
          await redisClient.get('test-key');
          await redisClient.del('test-key');
          await redisClient.invalidatePattern('skillswap:test:*');

          // Disconnect should not throw
          await redisClient.disconnect();

          spyError.mockRestore();
          spyWarn.mockRestore();
          spyInfo.mockRestore();
      });
  });

  describe('Utils Gaps', () => {
    it('SwapStateMachine: invalid transition', () => {
        expect(() => validateTransition('PENDING', 'COMPLETED')).toThrow('Invalid state transition');
    });

    it('Logger: metadata stringify', () => {
        const spy = jest.spyOn(logger, 'log');
        logger.info('msg', { meta: 'data' });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('Error Middleware: defaults', () => {
        const errorHandler = require('../middlewares/error.middleware');
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
        errorHandler(new Error(), {}, res, jest.fn());
        expect(res.status).toHaveBeenCalledWith(500);
    });

    it('Env Config Gaps (Line 16-17)', () => {
        const original = process.env.DATABASE_URL;
        process.env.DATABASE_URL = ''; 
        
        const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        
        jest.isolateModules(() => {
            try {
                require('../config/env.config');
            } catch (e) {
                // It might throw or exit
            }
            expect(exitSpy).toHaveBeenCalledWith(1);
        });
        
        exitSpy.mockRestore();
        consoleSpy.mockRestore();
        process.env.DATABASE_URL = original;
    });
  });

});
