const { SwapEvents, SwapEventEmitter, swapEventEmitter } = require('../events/swap.events');

describe('SwapEvents', () => {
  describe('Event Constants', () => {
    it('should have all required event types', () => {
      expect(SwapEvents.SWAP_CREATED).toBe('swap:created');
      expect(SwapEvents.SWAP_ACCEPTED).toBe('swap:accepted');
      expect(SwapEvents.SWAP_DECLINED).toBe('swap:declined');
      expect(SwapEvents.SWAP_IN_PROGRESS).toBe('swap:in_progress');
      expect(SwapEvents.SWAP_COMPLETED).toBe('swap:completed');
      expect(SwapEvents.SWAP_CANCELLED).toBe('swap:cancelled');
      expect(SwapEvents.SWAP_EXPIRED).toBe('swap:expired');
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(SwapEvents)).toBe(true);
    });
  });

  describe('SwapEventEmitter', () => {
    let emitter;
    let mockSwap;
    let mockInitiator;
    let mockReceiver;

    beforeEach(() => {
      emitter = new SwapEventEmitter();
      mockSwap = { id: 'swap-123', status: 'PENDING' };
      mockInitiator = { 
        id: 'user-1', 
        email: 'initiator@test.com',
        profile: { displayName: 'Alice' }
      };
      mockReceiver = { 
        id: 'user-2', 
        email: 'receiver@test.com',
        profile: { displayName: 'Bob' }
      };
    });

    describe('emitSwapCreated', () => {
      it('should emit SWAP_CREATED event with correct payload', (done) => {
        emitter.on(SwapEvents.SWAP_CREATED, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_CREATED);
          expect(payload.swap).toBe(mockSwap);
          expect(payload.initiator).toBe(mockInitiator);
          expect(payload.receiver).toBe(mockReceiver);
          expect(payload.notifyUserId).toBe(mockReceiver.id);
          expect(payload.message).toContain('Alice');
          expect(payload.timestamp).toBeInstanceOf(Date);
          done();
        });

        emitter.emitSwapCreated(mockSwap, mockInitiator, mockReceiver);
      });

      it('should fallback to email when displayName is not available', (done) => {
        mockInitiator.profile = null;
        
        emitter.on(SwapEvents.SWAP_CREATED, (payload) => {
          expect(payload.message).toContain('initiator@test.com');
          done();
        });

        emitter.emitSwapCreated(mockSwap, mockInitiator, mockReceiver);
      });
    });

    describe('emitSwapAccepted', () => {
      it('should emit SWAP_ACCEPTED event notifying initiator', (done) => {
        emitter.on(SwapEvents.SWAP_ACCEPTED, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_ACCEPTED);
          expect(payload.notifyUserId).toBe(mockInitiator.id);
          expect(payload.message).toContain('accepted');
          expect(payload.message).toContain('Bob');
          done();
        });

        emitter.emitSwapAccepted(mockSwap, mockInitiator, mockReceiver);
      });
    });

    describe('emitSwapDeclined', () => {
      it('should emit SWAP_DECLINED event with reason', (done) => {
        const reason = 'Schedule conflict';
        
        emitter.on(SwapEvents.SWAP_DECLINED, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_DECLINED);
          expect(payload.reason).toBe(reason);
          expect(payload.notifyUserId).toBe(mockInitiator.id);
          done();
        });

        emitter.emitSwapDeclined(mockSwap, mockInitiator, mockReceiver, reason);
      });
    });

    describe('emitSwapInProgress', () => {
      it('should emit SWAP_IN_PROGRESS event notifying both users', (done) => {
        emitter.on(SwapEvents.SWAP_IN_PROGRESS, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_IN_PROGRESS);
          expect(payload.notifyUserIds).toContain(mockInitiator.id);
          expect(payload.notifyUserIds).toContain(mockReceiver.id);
          expect(payload.message).toContain('started');
          done();
        });

        emitter.emitSwapInProgress(mockSwap, mockInitiator, mockReceiver);
      });
    });

    describe('emitSwapCompleted', () => {
      it('should emit SWAP_COMPLETED event notifying both users', (done) => {
        emitter.on(SwapEvents.SWAP_COMPLETED, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_COMPLETED);
          expect(payload.notifyUserIds).toContain(mockInitiator.id);
          expect(payload.notifyUserIds).toContain(mockReceiver.id);
          expect(payload.message).toContain('review');
          done();
        });

        emitter.emitSwapCompleted(mockSwap, mockInitiator, mockReceiver);
      });
    });

    describe('emitSwapCancelled', () => {
      it('should notify the other party when initiator cancels', (done) => {
        emitter.on(SwapEvents.SWAP_CANCELLED, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_CANCELLED);
          expect(payload.cancelledBy).toBe(mockInitiator);
          expect(payload.notifyUserId).toBe(mockReceiver.id);
          expect(payload.message).toContain('Alice');
          done();
        });

        emitter.emitSwapCancelled(mockSwap, mockInitiator, mockReceiver, mockInitiator.id, 'No time');
      });

      it('should notify the other party when receiver cancels', (done) => {
        emitter.on(SwapEvents.SWAP_CANCELLED, (payload) => {
          expect(payload.cancelledBy).toBe(mockReceiver);
          expect(payload.notifyUserId).toBe(mockInitiator.id);
          expect(payload.message).toContain('Bob');
          done();
        });

        emitter.emitSwapCancelled(mockSwap, mockInitiator, mockReceiver, mockReceiver.id, 'Changed mind');
      });
    });

    describe('emitSwapExpired', () => {
      it('should emit SWAP_EXPIRED event notifying both users', (done) => {
        emitter.on(SwapEvents.SWAP_EXPIRED, (payload) => {
          expect(payload.event).toBe(SwapEvents.SWAP_EXPIRED);
          expect(payload.notifyUserIds).toContain(mockInitiator.id);
          expect(payload.notifyUserIds).toContain(mockReceiver.id);
          expect(payload.message).toContain('expired');
          done();
        });

        emitter.emitSwapExpired(mockSwap, mockInitiator, mockReceiver);
      });
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton swapEventEmitter', () => {
      expect(swapEventEmitter).toBeInstanceOf(SwapEventEmitter);
    });

    it('should maintain event listeners across uses', (done) => {
      const handler = jest.fn(() => done());
      
      swapEventEmitter.on(SwapEvents.SWAP_CREATED, handler);
      swapEventEmitter.emitSwapCreated(
        { id: 'test' },
        { id: 'u1', email: 'a@b.com' },
        { id: 'u2', email: 'b@c.com' }
      );
      
      // Cleanup
      swapEventEmitter.removeListener(SwapEvents.SWAP_CREATED, handler);
    });
  });
});
