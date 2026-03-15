const SessionService = require('../services/session.service');
const { SwapStatus, SwapStateError } = require('../utils/swap-state-machine');

// Mock dependencies
jest.mock('../config/db.config', () => ({}));
jest.mock('../repositories/session.repository');
jest.mock('../repositories/swap.repository');
jest.mock('../repositories/user.repository');

describe('SessionService', () => {
  let sessionService, mockSessionRepo, mockSwapRepo, mockUserRepo, mockEventEmitter;

  const mockUser = (id) => ({
    id, 
    availabilitySlots: [{ dayOfWeek: 1, slotStart: '2000-01-01T09:00:00Z', slotEnd: '2000-01-01T17:00:00Z' }] 
  });

  const createMockSwap = (overrides = {}) => ({
    id: 'swap-123',
    initiatorId: 'u1',
    receiverId: 'u2',
    status: SwapStatus.ACCEPTED,
    ...overrides,
  });

  const createMockSession = (overrides = {}) => ({
    id: 'sess-123',
    swapId: 'swap-123',
    status: 'SCHEDULED',
    scheduledAt: new Date('2026-05-04T10:00:00Z'),
    durationMins: 60,
    swap: createMockSwap(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionRepo = require('../repositories/session.repository');
    mockSwapRepo = require('../repositories/swap.repository');
    mockUserRepo = require('../repositories/user.repository');
    mockEventEmitter = {
      emitSessionScheduled: jest.fn(),
      emitSessionRescheduled: jest.fn(),
      emitSessionCompleted: jest.fn(),
    };
    
    sessionService = new SessionService(mockSessionRepo, mockSwapRepo, mockUserRepo, mockEventEmitter);
  });

  describe('scheduleSession', () => {
    it('schedules successfully for valid time/availability', async () => {
      const scheduledAt = new Date('2026-05-04T10:00:00Z'); // Monday
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockImplementation(id => mockUser(id));
      mockSessionRepo.findConflictingSessions.mockResolvedValue([]);
      mockSessionRepo.create.mockResolvedValue(createMockSession({ scheduledAt }));

      const res = await sessionService.scheduleSession('swap-123', 'u1', { scheduledAt, durationMins: 60 });
      expect(res.id).toBe('sess-123');
      expect(mockEventEmitter.emitSessionScheduled).toHaveBeenCalled();
    });

    it('throws 400 if swap not in ACCEPTED state', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap({ status: SwapStatus.PENDING }));
      await expect(sessionService.scheduleSession('s1', 'u1', { scheduledAt: new Date() }))
        .rejects.toThrow(/Swap must be in ACCEPTED state/);
    });

    it('throws 400 if session already exists for swap', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue({ id: 'exist' });
      await expect(sessionService.scheduleSession('swap-123', 'u1', { scheduledAt: new Date() }))
        .rejects.toThrow('A session already exists for this swap');
    });

    it('throws if user not participant in swap', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      await expect(sessionService.scheduleSession('swap-123', 'u3', { scheduledAt: new Date() }))
        .rejects.toThrow('User is not a participant');
    });

    it('throws if time is in the past', async () => {
      const pastDate = new Date(Date.now() - 1000);
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue(null);
      await expect(sessionService.scheduleSession('swap-123', 'u1', { scheduledAt: pastDate }))
        .rejects.toThrow('Scheduled time must be in the future');
    });

    it('throws if outside availability', async () => {
      const sunday = new Date('2026-05-03T10:00:00Z');
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockImplementation(id => mockUser(id));
      await expect(sessionService.scheduleSession('s1', 'u1', { scheduledAt: sunday }))
        .rejects.toThrow(/outside availability/);
    });

    it('throws if user not found for availability check', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue(null);
      await expect(sessionService.scheduleSession('s1', 'u1', { scheduledAt: new Date('2026-05-04T10:00:00Z') }))
        .rejects.toThrow('User not found');
    });

    it('allows any time if user has no slots defined', async () => {
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockResolvedValue({ id: 'u1', availabilitySlots: [] });
      mockSessionRepo.findConflictingSessions.mockResolvedValue([]);
      mockSessionRepo.create.mockResolvedValue(createMockSession());
      
      const res = await sessionService.scheduleSession('s1', 'u1', { scheduledAt: new Date('2026-05-04T10:00:00Z') });
      expect(res.id).toBe('sess-123');
    });

    it('throws if conflict found', async () => {
      const scheduledAt = new Date('2026-05-04T10:00:00Z');
      mockSwapRepo.findById.mockResolvedValue(createMockSwap());
      mockSessionRepo.findBySwapId.mockResolvedValue(null);
      mockUserRepo.findWithSkillsAndAvailability.mockImplementation(id => mockUser(id));
      mockSessionRepo.findConflictingSessions.mockResolvedValue([{ id: 'other' }]);
      await expect(sessionService.scheduleSession('s1', 'u1', { scheduledAt }))
        .rejects.toThrow(/Time conflict/);
    });
  });

  describe('rescheduleSession', () => {
    it('reschedules successfully', async () => {
      const newTime = new Date('2026-05-04T14:00:00Z');
      const session = createMockSession();
      mockSessionRepo.findById.mockResolvedValue(session);
      mockUserRepo.findWithSkillsAndAvailability.mockImplementation(id => mockUser(id));
      mockSessionRepo.findConflictingSessions.mockResolvedValue([]);
      mockSessionRepo.update.mockResolvedValue({ ...session, scheduledAt: newTime });

      const res = await sessionService.rescheduleSession('sess-123', 'u1', newTime);
      expect(res.scheduledAt).toEqual(newTime);
      expect(mockEventEmitter.emitSessionRescheduled).toHaveBeenCalled();
    });

    it('throws if not SCHEDULED', async () => {
      mockSessionRepo.findById.mockResolvedValue(createMockSession({ status: 'COMPLETED' }));
      await expect(sessionService.rescheduleSession('s1', 'u1', new Date())).rejects.toThrow('Only SCHEDULED sessions');
    });
  });

  describe('completeSession', () => {
    it('confirms first side', async () => {
      const session = createMockSession();
      mockSessionRepo.findById.mockResolvedValue(session);
      mockSessionRepo.countCompletionConfirmations.mockResolvedValue(1);
      
      const res = await sessionService.completeSession('sess-123', 'u1');
      expect(res.bothConfirmed).toBe(false);
      expect(mockSessionRepo.createCompletionConfirmation).toHaveBeenCalled();
    });

    it('completes everything when second person confirms', async () => {
      const session = createMockSession();
      const swapInProgress = createMockSwap({ status: SwapStatus.IN_PROGRESS });
      mockSessionRepo.findById.mockResolvedValue({ ...session, swap: swapInProgress });
      mockSessionRepo.countCompletionConfirmations.mockResolvedValue(2);
      mockSessionRepo.update.mockResolvedValue({ ...session, status: 'COMPLETED' });
      mockSwapRepo.findById.mockResolvedValue(swapInProgress);

      const res = await sessionService.completeSession('sess-123', 'u2');
      expect(res.session.status).toBe('COMPLETED');
      expect(mockSwapRepo.update).toHaveBeenCalledWith('swap-123', expect.objectContaining({ status: SwapStatus.COMPLETED }));
      expect(mockEventEmitter.emitSessionCompleted).toHaveBeenCalled();
    });
  });

  describe('getSessionById', () => {
    it('returns session by id', async () => {
      mockSessionRepo.findById.mockResolvedValue(createMockSession());
      const res = await sessionService.getSessionById('s1');
      expect(res.id).toBe('sess-123');
    });

    it('throws if session not found in getSessionById', async () => {
      mockSessionRepo.findById.mockResolvedValue(null);
      await expect(sessionService.getSessionById('s1')).rejects.toThrow('Session not found');
    });
  });

  describe('getUpcomingSessions', () => {
    it('calls repo', async () => {
      mockSessionRepo.findUpcomingSessions.mockResolvedValue([]);
      await sessionService.getUpcomingSessions('u1');
      expect(mockSessionRepo.findUpcomingSessions).toHaveBeenCalled();
    });
  });
});
