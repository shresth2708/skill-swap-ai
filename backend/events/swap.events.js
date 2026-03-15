const EventEmitter = require('events');

/**
 * Swap event types emitted throughout the swap lifecycle.
 * Used by NotificationService and other observers.
 */
const SwapEvents = Object.freeze({
  SWAP_CREATED: 'swap:created',
  SWAP_ACCEPTED: 'swap:accepted',
  SWAP_DECLINED: 'swap:declined',
  SWAP_IN_PROGRESS: 'swap:in_progress',
  SWAP_COMPLETED: 'swap:completed',
  SWAP_CANCELLED: 'swap:cancelled',
  SWAP_EXPIRED: 'swap:expired',
});

/**
 * SwapEventEmitter — Observer pattern implementation for swap lifecycle events.
 * 
 * Design:
 *   - Singleton pattern: ensures single event bus across the application
 *   - Observer pattern: decouples SwapService from NotificationService
 *   - DIP: consumers depend on event abstraction, not concrete implementations
 * 
 * Usage:
 *   // Emitting events (from SwapService):
 *   swapEventEmitter.emitSwapCreated(swap, initiator, receiver);
 * 
 *   // Subscribing to events (from NotificationService):
 *   swapEventEmitter.on(SwapEvents.SWAP_CREATED, (payload) => { ... });
 */
class SwapEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20); // Allow multiple listeners for different services
  }

  /**
   * Emit SWAP_CREATED event when a new swap request is made.
   * @param {Object} swap - The created swap object
   * @param {Object} initiator - User who initiated the swap
   * @param {Object} receiver - User who will receive the swap request
   */
  emitSwapCreated(swap, initiator, receiver) {
    this.emit(SwapEvents.SWAP_CREATED, {
      event: SwapEvents.SWAP_CREATED,
      swap,
      initiator,
      receiver,
      message: `New swap request from ${initiator.profile?.displayName || initiator.email}`,
      notifyUserId: receiver.id,
      timestamp: new Date(),
    });
  }

  /**
   * Emit SWAP_ACCEPTED event when receiver accepts the swap.
   * @param {Object} swap - The accepted swap object
   * @param {Object} initiator - User who initiated the swap
   * @param {Object} receiver - User who accepted the swap
   */
  emitSwapAccepted(swap, initiator, receiver) {
    this.emit(SwapEvents.SWAP_ACCEPTED, {
      event: SwapEvents.SWAP_ACCEPTED,
      swap,
      initiator,
      receiver,
      message: `Your swap was accepted by ${receiver.profile?.displayName || receiver.email}!`,
      notifyUserId: initiator.id,
      timestamp: new Date(),
    });
  }

  /**
   * Emit SWAP_DECLINED event when receiver declines the swap.
   * @param {Object} swap - The declined swap object
   * @param {Object} initiator - User who initiated the swap
   * @param {Object} receiver - User who declined
   * @param {string} reason - Optional decline reason
   */
  emitSwapDeclined(swap, initiator, receiver, reason) {
    this.emit(SwapEvents.SWAP_DECLINED, {
      event: SwapEvents.SWAP_DECLINED,
      swap,
      initiator,
      receiver,
      reason,
      message: `Your swap request was declined`,
      notifyUserId: initiator.id,
      timestamp: new Date(),
    });
  }

  /**
   * Emit SWAP_IN_PROGRESS event when session starts.
   * @param {Object} swap - The swap object
   * @param {Object} initiator - Initiator user
   * @param {Object} receiver - Receiver user
   */
  emitSwapInProgress(swap, initiator, receiver) {
    this.emit(SwapEvents.SWAP_IN_PROGRESS, {
      event: SwapEvents.SWAP_IN_PROGRESS,
      swap,
      initiator,
      receiver,
      message: 'Your swap session has started!',
      notifyUserIds: [initiator.id, receiver.id],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SWAP_COMPLETED event when both parties confirm completion.
   * @param {Object} swap - The completed swap object
   * @param {Object} initiator - Initiator user
   * @param {Object} receiver - Receiver user
   */
  emitSwapCompleted(swap, initiator, receiver) {
    this.emit(SwapEvents.SWAP_COMPLETED, {
      event: SwapEvents.SWAP_COMPLETED,
      swap,
      initiator,
      receiver,
      message: 'Swap complete! Leave a review.',
      notifyUserIds: [initiator.id, receiver.id],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SWAP_CANCELLED event when either party cancels.
   * @param {Object} swap - The cancelled swap object
   * @param {Object} initiator - Initiator user
   * @param {Object} receiver - Receiver user
   * @param {string} cancelledByUserId - ID of user who cancelled
   * @param {string} reason - Cancellation reason
   */
  emitSwapCancelled(swap, initiator, receiver, cancelledByUserId, reason) {
    const cancelledBy = cancelledByUserId === initiator.id ? initiator : receiver;
    const notifyUser = cancelledByUserId === initiator.id ? receiver : initiator;

    this.emit(SwapEvents.SWAP_CANCELLED, {
      event: SwapEvents.SWAP_CANCELLED,
      swap,
      initiator,
      receiver,
      cancelledBy,
      reason,
      message: `Swap was cancelled by ${cancelledBy.profile?.displayName || cancelledBy.email}`,
      notifyUserId: notifyUser.id,
      timestamp: new Date(),
    });
  }

  /**
   * Emit SWAP_EXPIRED event when swap expires (cron job).
   * @param {Object} swap - The expired swap object
   * @param {Object} initiator - Initiator user
   * @param {Object} receiver - Receiver user
   */
  emitSwapExpired(swap, initiator, receiver) {
    this.emit(SwapEvents.SWAP_EXPIRED, {
      event: SwapEvents.SWAP_EXPIRED,
      swap,
      initiator,
      receiver,
      message: 'Your swap request has expired',
      notifyUserIds: [initiator.id, receiver.id],
      timestamp: new Date(),
    });
  }
}

// Singleton instance
const swapEventEmitter = new SwapEventEmitter();

module.exports = {
  SwapEvents,
  SwapEventEmitter,
  swapEventEmitter,
};
