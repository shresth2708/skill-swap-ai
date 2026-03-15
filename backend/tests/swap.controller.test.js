const swapController = require('../controllers/swap.controller');
const SwapService = require('../services/swap.service');
const SessionService = require('../services/session.service');
const { sendSuccess, sendError } = require('../utils/response.util');
const { SwapStateError } = require('../utils/swap-state-machine');

jest.mock('../services/swap.service');
jest.mock('../services/session.service');
jest.mock('../repositories/session.repository', () => ({
  findBySwapId: jest.fn(),
}));
jest.mock('../utils/response.util', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
}));

describe('SwapController Expansion', () => {
  let req, res, next;
  let mockSwapService;
  let mockSessionService;

  beforeEach(() => {
    req = { user: { id: 'user-1' }, body: {}, params: {}, query: {} };
    res = {};
    next = jest.fn();

    mockSwapService = {
      createSwap: jest.fn(),
      acceptSwap: jest.fn(),
      declineSwap: jest.fn(),
      startSwap: jest.fn(),
      completeSwap: jest.fn(),
      cancelSwap: jest.fn(),
      getSwapById: jest.fn(),
      getActiveSwaps: jest.fn(),
      getSwapHistory: jest.fn(),
      getSwapStats: jest.fn(),
    };

    mockSessionService = {
      scheduleSession: jest.fn(),
      rescheduleSession: jest.fn(),
      completeSession: jest.fn(),
      getUpcomingSessions: jest.fn(),
    };

    SwapService.mockImplementation(() => mockSwapService);
    SessionService.mockImplementation(() => mockSessionService);

    jest.clearAllMocks();
  });

  it('createSwap: handles service error', async () => {
    req.body = { matchId: 'm1', offeredSkillId: 's1', requestedSkillId: 's2' };
    mockSwapService.createSwap.mockRejectedValueOnce(new Error('service fail'));
    await swapController.createSwap(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('declineSwap: declines successfully', async () => {
    req.params.id = 's1';
    req.body.reason = 'No thanks';
    mockSwapService.declineSwap.mockResolvedValueOnce({ id: 's1' });
    await swapController.declineSwap(req, res, next);
    expect(mockSwapService.declineSwap).toHaveBeenCalledWith('s1', 'user-1', 'No thanks');
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('startSwap: starts successfully', async () => {
    req.params.id = 's1';
    mockSwapService.startSwap.mockResolvedValueOnce({ id: 's1' });
    await swapController.startSwap(req, res, next);
    expect(mockSwapService.startSwap).toHaveBeenCalledWith('s1', 'user-1');
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('completeSwap: completes successfully', async () => {
    req.params.id = 's1';
    mockSwapService.completeSwap.mockResolvedValueOnce({ id: 's1', status: 'COMPLETED' });
    await swapController.completeSwap(req, res, next);
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('cancelSwap: cancels successfully', async () => {
    req.params.id = 's1';
    mockSwapService.cancelSwap.mockResolvedValueOnce({ id: 's1' });
    await swapController.cancelSwap(req, res, next);
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('getSwapById: returns swap', async () => {
    req.params.id = 's1';
    mockSwapService.getSwapById.mockResolvedValueOnce({ id: 's1' });
    await swapController.getSwapById(req, res, next);
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('getActiveSwaps: returns active list', async () => {
    mockSwapService.getActiveSwaps.mockResolvedValueOnce(['s1']);
    await swapController.getActiveSwaps(req, res, next);
    expect(sendSuccess).toHaveBeenCalledWith(res, 200, expect.any(String), { swaps: ['s1'], count: 1 });
  });

  it('getSwapHistory: returns history', async () => {
    req.query = { page: '2', limit: '5' };
    mockSwapService.getSwapHistory.mockResolvedValueOnce({ data: [] });
    await swapController.getSwapHistory(req, res, next);
    expect(mockSwapService.getSwapHistory).toHaveBeenCalledWith('user-1', expect.objectContaining({ page: 2, limit: 5 }));
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('rescheduleSession: reschedules successfully', async () => {
    req.params.id = 'swap-1';
    req.params.sid = 'sess-1';
    req.body = { scheduledAt: '2026-06-01' };
    mockSessionService.rescheduleSession.mockResolvedValueOnce({ id: 'sess-1' });
    await swapController.rescheduleSession(req, res, next);
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('rescheduleSession: 400 if scheduledAt missing', async () => {
    await swapController.rescheduleSession(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 400, 'VALIDATION_ERROR', expect.any(String));
  });

  it('confirmCompletion: handles missing session mapping', async () => {
    req.params.id = 'swap-1';
    const repo = require('../repositories/session.repository');
    repo.findBySwapId.mockResolvedValueOnce(null);
    await swapController.confirmCompletion(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 404, 'NOT_FOUND', expect.any(String));
  });

  it('confirmCompletion: completes via service', async () => {
    req.params.id = 'swap-1';
    const repo = require('../repositories/session.repository');
    repo.findBySwapId.mockResolvedValueOnce({ id: 'sess-1' });
    mockSessionService.completeSession.mockResolvedValueOnce({ bothConfirmed: true });
    await swapController.confirmCompletion(req, res, next);
    expect(sendSuccess).toHaveBeenCalled();
  });

  it('getActiveSwaps: handles service error', async () => {
    mockSwapService.getActiveSwaps.mockRejectedValueOnce(new Error('fail'));
    await swapController.getActiveSwaps(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('getUpcomingSessions: handles service error', async () => {
    mockSessionService.getUpcomingSessions.mockRejectedValueOnce(new Error('fail'));
    await swapController.getUpcomingSessions(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('confirmCompletion: handles service error', async () => {
    req.params.id = 'swap-1';
    const repo = require('../repositories/session.repository');
    repo.findBySwapId.mockResolvedValueOnce({ id: 'sess-1' });
    mockSessionService.completeSession.mockRejectedValueOnce(new Error('fail'));
    await swapController.confirmCompletion(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('#handleError: handles SwapStateError', async () => {
    const error = new SwapStateError('PENDING', 'COMPLETED', 'Bad transition');
    mockSwapService.acceptSwap.mockRejectedValueOnce(error);
    req.params.id = 's1';
    await swapController.acceptSwap(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 400, 'SWAP_STATE_ERROR', expect.any(String), expect.any(Object));
  });

  it('#handleError: handles not found and forbidden messages', async () => {
    mockSwapService.acceptSwap.mockRejectedValueOnce(new Error('swap not found'));
    await swapController.acceptSwap(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 404, 'NOT_FOUND', expect.any(String));

    mockSwapService.acceptSwap.mockRejectedValueOnce(new Error('not a participant'));
    await swapController.acceptSwap(req, res, next);
    expect(sendError).toHaveBeenCalledWith(res, 403, 'FORBIDDEN', expect.any(String));
  });
});
