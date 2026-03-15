const { SwapStatus, validateTransition, SwapStateError } = require('../utils/swap-state-machine');
const { swapEventEmitter } = require('../events/swap.events');
const SwapService = require('../services/swap.service');

// Mock dependencies
jest.mock('../config/db.config', () => ({}));
jest.mock('../cache/redis.client', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(),
  invalidatePattern: jest.fn().mockResolvedValue(),
}));
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/match.repository');
jest.mock('../repositories/user.repository');
jest.mock('../events/swap.events', () => ({
  swapEventEmitter: {
    emitSwapCreated: jest.fn(),
    emitSwapAccepted: jest.fn(),
    emitSwapDeclined: jest.fn(),
    emitSwapInProgress: jest.fn(),
    emitSwapCompleted: jest.fn(),
    emitSwapCancelled: jest.fn(),
    emitSwapExpired: jest.fn(),
  },
}));

describe('SwapService', () => {
  let swapService, mockSwapRepo, mockMatchRepo, mockUserRepo, mockEmitter;

  const mockUserAlice = { id: 'alice-123', email: 'alice@test.com', skills: [{ id: 'skill-node', skill: { name: 'Node.js' } }] };
  const mockUserBob = { id: 'bob-456', email: 'bob@test.com', skills: [{ id: 'skill-react', skill: { name: 'React' } }] };
  const mockMatch = { id: 'match-789', userId1: 'alice-123', userId2: 'bob-456' };

  const createMockSwap = (overrides = {}) => ({
    id: 'swap-999',
    matchId: 'match-789',
    initiatorId: 'alice-123',
    receiverId: 'bob-456',
    status: SwapStatus.PENDING,
    initiator: mockUserAlice,
    receiver: mockUserBob,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSwapRepo = require('../repositories/swap.repository');
    mockMatchRepo = require('../repositories/match.repository');
    mockUserRepo = require('../repositories/user.repository');
    mockEmitter = swapEventEmitter;
    mockMatchRepo.markMatchFulfilled = jest.fn().mockResolvedValue({});

    swapService = new SwapService(mockSwapRepo, mockMatchRepo, mockUserRepo, mockEmitter);
  });

  describe('createSwap', () => {
    it('creates a swap successfully', async () => {
      mockMatchRepo.findById.mockResolvedValue(mockMatch);
      mockSwapRepo.findExistingSwapForMatch.mockResolvedValue(null);
      mockUserRepo.findById.mockImplementation(id => id === 'alice-123' ? mockUserAlice : mockUserBob);
      mockSwapRepo.create.mockResolvedValue(createMockSwap());

      const res = await swapService.createSwap('match-789', 'alice-123', {
        offeredSkillId: 'skill-node',
        requestedSkillId: 'skill-react'
      });

      expect(res.id).toBe('swap-999');
      expect(mockEmitter.emitSwapCreated).toHaveBeenCalled();
    });

    it('throws 404 if match not found', async () => {
      mockMatchRepo.findById.mockResolvedValue(null);
      await expect(swapService.createSwap('m1', 'u1', {})).rejects.toThrow('Match not found');
    });

    it('throws if user is not participant in match', async () => {
      mockMatchRepo.findById.mockResolvedValue(mockMatch);
      await expect(swapService.createSwap('match-789', 'intruder', {})).rejects.toThrow('User is not a participant');
    });

    it('throws if active swap already exists', async () => {
      mockMatchRepo.findById.mockResolvedValue(mockMatch);
      mockSwapRepo.findExistingSwapForMatch.mockResolvedValue({ id: 'existing' });
      await expect(swapService.createSwap('match-789', 'alice-123', {})).rejects.toThrow('already exists');
    });

    it('throws if skill not owned', async () => {
      mockMatchRepo.findById.mockResolvedValue(mockMatch);
      mockSwapRepo.findExistingSwapForMatch.mockResolvedValue(null);
      mockUserRepo.findById.mockImplementation(id => id === 'alice-123' ? { ...mockUserAlice, skills: [] } : mockUserBob);
      await expect(swapService.createSwap('match-789', 'alice-123', { offeredSkillId: 'sX' })).rejects.toThrow('Offered skill does not belong');
    });

    it('throws if user not found for skill validation', async () => {
      mockMatchRepo.findById.mockResolvedValue(mockMatch);
      mockSwapRepo.findExistingSwapForMatch.mockResolvedValue(null);
      mockUserRepo.findById.mockResolvedValue(null);
      await expect(swapService.createSwap('match-789', 'alice-123', { offeredSkillId: 's1' })).rejects.toThrow('User not found');
    });
  });

  describe('acceptSwap', () => {
    it('accepts successfully', async () => {
      const swap = createMockSwap();
      mockSwapRepo.findById.mockResolvedValue(swap);
      mockSwapRepo.update.mockResolvedValue({ ...swap, status: SwapStatus.ACCEPTED });

      const res = await swapService.acceptSwap('swap-999', 'bob-456');
      expect(res.status).toBe(SwapStatus.ACCEPTED);
      expect(mockSwapRepo.incrementUserSwapCounts).toHaveBeenCalled();
      expect(mockEmitter.emitSwapAccepted).toHaveBeenCalled();
    });

    it('throws if user is not receiver', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      await expect(swapService.acceptSwap('swap-999', 'alice-123')).rejects.toThrow('Only the receiver');
    });

    it('throws if swap not found', async () => {
      mockSwapRepo.findById.mockResolvedValue(null);
      await expect(swapService.acceptSwap('s1', 'u1')).rejects.toThrow('Swap not found');
    });
  });

  describe('declineSwap', () => {
    it('declines successfully', async () => {
      const swap = createMockSwap();
      mockSwapRepo.findById.mockResolvedValue(swap);
      mockSwapRepo.update.mockResolvedValue({ ...swap, status: SwapStatus.CANCELLED });

      const res = await swapService.declineSwap('swap-999', 'bob-456', 'Too busy');
      expect(res.status).toBe(SwapStatus.CANCELLED);
      expect(mockEmitter.emitSwapDeclined).toHaveBeenCalled();
    });
  });

  describe('startSwap', () => {
    it('starts successfully', async () => {
      const swap = createMockSwap({ status: SwapStatus.ACCEPTED });
      mockSwapRepo.findById.mockResolvedValue(swap);
      mockSwapRepo.update.mockResolvedValue({ ...swap, status: SwapStatus.IN_PROGRESS });

      const res = await swapService.startSwap('swap-999', 'alice-123');
      expect(res.status).toBe(SwapStatus.IN_PROGRESS);
      expect(mockEmitter.emitSwapInProgress).toHaveBeenCalled();
    });
  });

  describe('completeSwap', () => {
    it('confirms single side', async () => {
      const swap = createMockSwap({ status: SwapStatus.IN_PROGRESS });
      mockSwapRepo.findById.mockResolvedValue(swap);
      mockSwapRepo.update.mockResolvedValue({ ...swap, initiatorConfirmed: true });

      const res = await swapService.completeSwap('swap-999', 'alice-123');
      expect(res.initiatorConfirmed).toBe(true);
      expect(mockEmitter.emitSwapCompleted).not.toHaveBeenCalled();
    });

    it('completes when both confirm', async () => {
      const swap = createMockSwap({ status: SwapStatus.IN_PROGRESS, receiverConfirmed: true });
      mockSwapRepo.findById.mockResolvedValue(swap);
      mockSwapRepo.update.mockResolvedValue({ ...swap, status: SwapStatus.COMPLETED });

      const res = await swapService.completeSwap('swap-999', 'alice-123');
      expect(res.status).toBe(SwapStatus.COMPLETED);
      expect(mockEmitter.emitSwapCompleted).toHaveBeenCalled();
    });

    it('throws if not in progress', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap({ status: SwapStatus.ACCEPTED }));
      await expect(swapService.completeSwap('swap-999', 'alice-123')).rejects.toThrow(SwapStateError);
    });

    it('throws if swap not found in completeSwap', async () => {
      mockSwapRepo.findById.mockResolvedValue(null);
      await expect(swapService.completeSwap('s1', 'u1')).rejects.toThrow('Swap not found');
    });
  });

  describe('cancelSwap', () => {
    it('cancels successfully', async () => {
      const swap = createMockSwap();
      mockSwapRepo.findById.mockResolvedValue(swap);
      mockSwapRepo.update.mockResolvedValue({ ...swap, status: SwapStatus.CANCELLED });

      const res = await swapService.cancelSwap('swap-999', 'alice-123');
      expect(res.status).toBe(SwapStatus.CANCELLED);
      expect(mockEmitter.emitSwapCancelled).toHaveBeenCalled();
    });

    it('throws if swap not found in cancelSwap', async () => {
      mockSwapRepo.findById.mockResolvedValue(null);
      await expect(swapService.cancelSwap('s1', 'u1')).rejects.toThrow('Swap not found');
    });
  });

  describe('expirePendingSwaps', () => {
    it('handles multiple expirations', async () => {
      mockSwapRepo.findExpiredPendingSwaps.mockResolvedValue([{ id: 's1' }, { id: 's2' }]);
      const res = await swapService.expirePendingSwaps();
      expect(res).toBe(2);
      expect(mockEmitter.emitSwapExpired).toHaveBeenCalledTimes(2);
    });

    it('returns 0 if none found', async () => {
      mockSwapRepo.findExpiredPendingSwaps.mockResolvedValue([]);
      const res = await swapService.expirePendingSwaps();
      expect(res).toBe(0);
    });
  });

  describe('ISwapReader methods', () => {
    it('getSwapById works for participant', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      const res = await swapService.getSwapById('s1', 'alice-123');
      expect(res.id).toBe('swap-999');
    });

    it('getSwapById throws for non-participant', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      await expect(swapService.getSwapById('s1', 'u3')).rejects.toThrow('User is not a participant');
    });

    it('getSwapById throws if swap not found', async () => {
      mockSwapRepo.findById.mockResolvedValue(null);
      await expect(swapService.getSwapById('s1', 'u1')).rejects.toThrow('Swap not found');
    });

    it('getSwapHistory calls repo', async () => {
      mockSwapRepo.findSwapHistory.mockResolvedValue([]);
      await swapService.getSwapHistory('u1');
      expect(mockSwapRepo.findSwapHistory).toHaveBeenCalled();
    });

    it('getActiveSwaps calls repo', async () => {
      mockSwapRepo.findActiveSwaps.mockResolvedValue([]);
      await swapService.getActiveSwaps('u1');
      expect(mockSwapRepo.findActiveSwaps).toHaveBeenCalled();
    });

    it('getSwapStats calls repo', async () => {
      mockSwapRepo.getSwapStats.mockResolvedValue({});
      await swapService.getSwapStats('u1');
      expect(mockSwapRepo.getSwapStats).toHaveBeenCalled();
    });
  });
});
