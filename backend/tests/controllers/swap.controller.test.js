const swapController = require('../../controllers/swap.controller');
const SwapService = require('../../services/swap.service');
const SessionService = require('../../services/session.service');
const sessionRepo = require('../../repositories/session.repository');
const { SwapStateError } = require('../../utils/swap-state-machine');

jest.mock('../../services/swap.service');
jest.mock('../../services/session.service');
jest.mock('../../repositories/session.repository');

describe('SwapController', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      user: { id: 'u1' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('createSwap', () => {
    it('returns 400 if missing fields', async () => {
      await swapController.createSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('success path', async () => {
      req.body = { matchId: 'm1', offeredSkillId: 's1', requestedSkillId: 's2' };
      const mockService = { createSwap: jest.fn().mockResolvedValue({ id: 'sw1' }) };
      SwapService.mockImplementation(() => mockService);
      await swapController.createSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('acceptSwap', () => {
    it('calls service and returns 200', async () => {
      const mockService = { acceptSwap: jest.fn().mockResolvedValue({}) };
      SwapService.mockImplementation(() => mockService);
      await swapController.acceptSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('error handling branches in #handleError', () => {
    it('handles SwapStateError', async () => {
      const err = new SwapStateError('PENDING', 'COMPLETED', 'invalid');
      SwapService.mockImplementation(() => ({
        acceptSwap: jest.fn().mockRejectedValue(err)
      }));
      await swapController.acceptSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('handles "not found" as 404', async () => {
      SwapService.mockImplementation(() => ({
        acceptSwap: jest.fn().mockRejectedValue(new Error('swap not found'))
      }));
      await swapController.acceptSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('handles "not a participant" as 403', async () => {
      SwapService.mockImplementation(() => ({
        acceptSwap: jest.fn().mockRejectedValue(new Error('user is not a participant'))
      }));
      await swapController.acceptSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('handles "already exists" as 400', async () => {
      SwapService.mockImplementation(() => ({
        acceptSwap: jest.fn().mockRejectedValue(new Error('already exists'))
      }));
      await swapController.acceptSwap(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('passes unknown error to next', async () => {
      SwapService.mockImplementation(() => ({
        acceptSwap: jest.fn().mockRejectedValue(new Error('unknown kaboom'))
      }));
      await swapController.acceptSwap(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Session Methods', () => {
    it('scheduleSession success', async () => {
      req.body = { scheduledAt: '2026-05-04T10:00:00Z' };
      SessionService.mockImplementation(() => ({
        scheduleSession: jest.fn().mockResolvedValue({})
      }));
      await swapController.scheduleSession(req, res, next);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('scheduleSession fails if missing date', async () => {
      await swapController.scheduleSession(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('confirmCompletion success', async () => {
      sessionRepo.findBySwapId.mockResolvedValue({ id: 'sess1' });
      SessionService.mockImplementation(() => ({
        completeSession: jest.fn().mockResolvedValue({ bothConfirmed: true })
      }));
      await swapController.confirmCompletion(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('confirmCompletion returns 404 if no session', async () => {
      sessionRepo.findBySwapId.mockResolvedValue(null);
      await swapController.confirmCompletion(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('other methods for coverage', () => {
      it('declineSwap', async () => {
          SwapService.mockImplementation(() => ({ declineSwap: jest.fn().mockResolvedValue({ id: 'sw1' }) }));
          await swapController.declineSwap(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('startSwap', async () => {
          SwapService.mockImplementation(() => ({ startSwap: jest.fn().mockResolvedValue({ id: 'sw1' }) }));
          await swapController.startSwap(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('completeSwap - already completed', async () => {
          SwapService.mockImplementation(() => ({ completeSwap: jest.fn().mockResolvedValue({ status: 'COMPLETED' }) }));
          await swapController.completeSwap(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('completeSwap - waiting', async () => {
          SwapService.mockImplementation(() => ({ completeSwap: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }) }));
          await swapController.completeSwap(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('cancelSwap', async () => {
          SwapService.mockImplementation(() => ({ cancelSwap: jest.fn().mockResolvedValue({ id: 'sw1' }) }));
          await swapController.cancelSwap(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('getSwapById', async () => {
          SwapService.mockImplementation(() => ({ getSwapById: jest.fn().mockResolvedValue({ id: 'sw1' }) }));
          await swapController.getSwapById(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('getActiveSwaps', async () => {
          SwapService.mockImplementation(() => ({ getActiveSwaps: jest.fn().mockResolvedValue([]) }));
          await swapController.getActiveSwaps(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('getSwapHistory', async () => {
          req.query = { page: '1' };
          SwapService.mockImplementation(() => ({ getSwapHistory: jest.fn().mockResolvedValue({ data: [] }) }));
          await swapController.getSwapHistory(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('getSwapStats', async () => {
          SwapService.mockImplementation(() => ({ getSwapStats: jest.fn().mockResolvedValue({}) }));
          await swapController.getSwapStats(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('rescheduleSession', async () => {
          req.body = { scheduledAt: '2026-05-04T10:00:00Z' };
          SessionService.mockImplementation(() => ({ rescheduleSession: jest.fn().mockResolvedValue({}) }));
          await swapController.rescheduleSession(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
      it('rescheduleSession fails if missing date', async () => {
          await swapController.rescheduleSession(req, res, next);
          expect(res.status).toHaveBeenCalledWith(400);
      });
      it('getUpcomingSessions', async () => {
          SessionService.mockImplementation(() => ({ getUpcomingSessions: jest.fn().mockResolvedValue([]) }));
          await swapController.getUpcomingSessions(req, res, next);
          expect(res.status).toHaveBeenCalledWith(200);
      });
  });
});
