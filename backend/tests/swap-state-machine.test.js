const {
  SwapStatus,
  SwapStateError,
  isValidTransition,
  validateTransition,
  getValidTransitions,
  isTerminalState,
  isActiveState,
} = require('../utils/swap-state-machine');

describe('SwapStateMachine', () => {
  describe('SwapStatus', () => {
    it('should have all required status values', () => {
      expect(SwapStatus.PENDING).toBe('PENDING');
      expect(SwapStatus.ACCEPTED).toBe('ACCEPTED');
      expect(SwapStatus.IN_PROGRESS).toBe('IN_PROGRESS');
      expect(SwapStatus.COMPLETED).toBe('COMPLETED');
      expect(SwapStatus.CANCELLED).toBe('CANCELLED');
      expect(SwapStatus.EXPIRED).toBe('EXPIRED');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(SwapStatus)).toBe(true);
    });
  });

  describe('isValidTransition', () => {
    // Valid transitions from PENDING
    it('should allow PENDING -> ACCEPTED', () => {
      expect(isValidTransition(SwapStatus.PENDING, SwapStatus.ACCEPTED)).toBe(true);
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(isValidTransition(SwapStatus.PENDING, SwapStatus.CANCELLED)).toBe(true);
    });

    it('should allow PENDING -> EXPIRED', () => {
      expect(isValidTransition(SwapStatus.PENDING, SwapStatus.EXPIRED)).toBe(true);
    });

    // Valid transitions from ACCEPTED
    it('should allow ACCEPTED -> IN_PROGRESS', () => {
      expect(isValidTransition(SwapStatus.ACCEPTED, SwapStatus.IN_PROGRESS)).toBe(true);
    });

    it('should allow ACCEPTED -> CANCELLED', () => {
      expect(isValidTransition(SwapStatus.ACCEPTED, SwapStatus.CANCELLED)).toBe(true);
    });

    // Valid transitions from IN_PROGRESS
    it('should allow IN_PROGRESS -> COMPLETED', () => {
      expect(isValidTransition(SwapStatus.IN_PROGRESS, SwapStatus.COMPLETED)).toBe(true);
    });

    it('should NOT allow IN_PROGRESS -> CANCELLED (strict spec)', () => {
      expect(isValidTransition(SwapStatus.IN_PROGRESS, SwapStatus.CANCELLED)).toBe(false);
    });

    // Invalid transitions
    it('should NOT allow PENDING -> COMPLETED (skipping states)', () => {
      expect(isValidTransition(SwapStatus.PENDING, SwapStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow PENDING -> IN_PROGRESS (must accept first)', () => {
      expect(isValidTransition(SwapStatus.PENDING, SwapStatus.IN_PROGRESS)).toBe(false);
    });

    it('should NOT allow ACCEPTED -> COMPLETED (must be in progress)', () => {
      expect(isValidTransition(SwapStatus.ACCEPTED, SwapStatus.COMPLETED)).toBe(false);
    });

    it('should NOT allow COMPLETED -> any state (terminal)', () => {
      expect(isValidTransition(SwapStatus.COMPLETED, SwapStatus.PENDING)).toBe(false);
      expect(isValidTransition(SwapStatus.COMPLETED, SwapStatus.CANCELLED)).toBe(false);
    });

    it('should NOT allow CANCELLED -> any state (terminal)', () => {
      expect(isValidTransition(SwapStatus.CANCELLED, SwapStatus.PENDING)).toBe(false);
      expect(isValidTransition(SwapStatus.CANCELLED, SwapStatus.ACCEPTED)).toBe(false);
    });

    it('should NOT allow EXPIRED -> any state (terminal)', () => {
      expect(isValidTransition(SwapStatus.EXPIRED, SwapStatus.PENDING)).toBe(false);
      expect(isValidTransition(SwapStatus.EXPIRED, SwapStatus.ACCEPTED)).toBe(false);
    });

    it('should return false for unknown states', () => {
      expect(isValidTransition('UNKNOWN', SwapStatus.ACCEPTED)).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() => validateTransition(SwapStatus.PENDING, SwapStatus.ACCEPTED)).not.toThrow();
      expect(() => validateTransition(SwapStatus.ACCEPTED, SwapStatus.IN_PROGRESS)).not.toThrow();
      expect(() => validateTransition(SwapStatus.IN_PROGRESS, SwapStatus.COMPLETED)).not.toThrow();
    });

    it('should throw SwapStateError for invalid transitions', () => {
      expect(() => validateTransition(SwapStatus.PENDING, SwapStatus.COMPLETED))
        .toThrow(SwapStateError);
    });

    it('should include current and target state in error', () => {
      try {
        validateTransition(SwapStatus.PENDING, SwapStatus.COMPLETED);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SwapStateError);
        expect(error.currentState).toBe(SwapStatus.PENDING);
        expect(error.targetState).toBe(SwapStatus.COMPLETED);
      }
    });

    it('should include valid transitions in error', () => {
      try {
        validateTransition(SwapStatus.PENDING, SwapStatus.COMPLETED);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error.validTransitions).toContain(SwapStatus.ACCEPTED);
        expect(error.validTransitions).toContain(SwapStatus.CANCELLED);
        expect(error.validTransitions).toContain(SwapStatus.EXPIRED);
      }
    });
  });

  describe('SwapStateError', () => {
    it('should have correct name and status code', () => {
      const error = new SwapStateError(SwapStatus.PENDING, SwapStatus.COMPLETED);
      expect(error.name).toBe('SwapStateError');
      expect(error.statusCode).toBe(400);
    });

    it('should serialize to JSON correctly', () => {
      const error = new SwapStateError(SwapStatus.PENDING, SwapStatus.COMPLETED);
      const json = error.toJSON();
      
      expect(json).toEqual({
        error: 'SwapStateError',
        message: expect.stringContaining('PENDING'),
        currentState: SwapStatus.PENDING,
        targetState: SwapStatus.COMPLETED,
        validTransitions: expect.arrayContaining([SwapStatus.ACCEPTED]),
      });
    });
  });

  describe('getValidTransitions', () => {
    it('should return valid transitions for PENDING', () => {
      const transitions = getValidTransitions(SwapStatus.PENDING);
      expect(transitions).toContain(SwapStatus.ACCEPTED);
      expect(transitions).toContain(SwapStatus.CANCELLED);
      expect(transitions).toContain(SwapStatus.EXPIRED);
    });

    it('should return empty array for terminal states', () => {
      expect(getValidTransitions(SwapStatus.COMPLETED)).toEqual([]);
      expect(getValidTransitions(SwapStatus.CANCELLED)).toEqual([]);
      expect(getValidTransitions(SwapStatus.EXPIRED)).toEqual([]);
    });

    it('should return empty array for unknown states', () => {
      expect(getValidTransitions('UNKNOWN')).toEqual([]);
    });
  });

  describe('isTerminalState', () => {
    it('should return true for terminal states', () => {
      expect(isTerminalState(SwapStatus.COMPLETED)).toBe(true);
      expect(isTerminalState(SwapStatus.CANCELLED)).toBe(true);
      expect(isTerminalState(SwapStatus.EXPIRED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isTerminalState(SwapStatus.PENDING)).toBe(false);
      expect(isTerminalState(SwapStatus.ACCEPTED)).toBe(false);
      expect(isTerminalState(SwapStatus.IN_PROGRESS)).toBe(false);
    });
  });

  describe('isActiveState', () => {
    it('should return true for active states (ACCEPTED, IN_PROGRESS)', () => {
      expect(isActiveState(SwapStatus.ACCEPTED)).toBe(true);
      expect(isActiveState(SwapStatus.IN_PROGRESS)).toBe(true);
    });

    it('should return false for non-active states', () => {
      expect(isActiveState(SwapStatus.PENDING)).toBe(false);
      expect(isActiveState(SwapStatus.COMPLETED)).toBe(false);
      expect(isActiveState(SwapStatus.CANCELLED)).toBe(false);
      expect(isActiveState(SwapStatus.EXPIRED)).toBe(false);
    });
  });
});
