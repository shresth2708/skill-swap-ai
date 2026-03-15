const EventEmitter = require('events');

/**
 * Session event types emitted throughout the session lifecycle.
 */
const SessionEvents = Object.freeze({
  SESSION_SCHEDULED: 'session:scheduled',
  SESSION_RESCHEDULED: 'session:rescheduled',
  SESSION_REMINDER_24H: 'session:reminder_24h',
  SESSION_REMINDER_1H: 'session:reminder_1h',
  SESSION_COMPLETED: 'session:completed',
  SESSION_MISSED: 'session:missed',
});

/**
 * SessionEventEmitter — Observer pattern for session lifecycle events.
 *
 * Design:
 *   - Singleton pattern
 *   - Decouples SessionService from NotificationService
 */
class SessionEventEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  /**
   * Emit SESSION_SCHEDULED event when a session is created.
   * @param {Object} session - The created session
   * @param {Object} swap - The parent swap
   * @param {Object} initiator - Initiator user
   * @param {Object} receiver - Receiver user
   */
  emitSessionScheduled(session, swap, initiator, receiver) {
    this.emit(SessionEvents.SESSION_SCHEDULED, {
      event: SessionEvents.SESSION_SCHEDULED,
      session,
      swap,
      initiator,
      receiver,
      message: `Session scheduled for ${new Date(session.scheduledAt).toLocaleString()}`,
      notifyUserIds: [initiator.id, receiver.id],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SESSION_RESCHEDULED event.
   * @param {Object} session - The rescheduled session
   * @param {Object} swap - The parent swap
   * @param {Object} initiator - Initiator user
   * @param {Object} receiver - Receiver user
   * @param {string} rescheduledByUserId - Who rescheduled
   */
  emitSessionRescheduled(session, swap, initiator, receiver, rescheduledByUserId) {
    const rescheduledBy = rescheduledByUserId === initiator.id ? initiator : receiver;
    this.emit(SessionEvents.SESSION_RESCHEDULED, {
      event: SessionEvents.SESSION_RESCHEDULED,
      session,
      swap,
      initiator,
      receiver,
      rescheduledBy,
      message: `Session rescheduled to ${new Date(session.scheduledAt).toLocaleString()} by ${rescheduledBy.profile?.displayName || rescheduledBy.email}`,
      notifyUserIds: [initiator.id, receiver.id],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SESSION_REMINDER_24H event.
   * @param {Object} session - The session
   * @param {Object} swap - The parent swap
   */
  emitSessionReminder24h(session, swap) {
    this.emit(SessionEvents.SESSION_REMINDER_24H, {
      event: SessionEvents.SESSION_REMINDER_24H,
      session,
      swap,
      message: `Reminder: You have a session scheduled in 24 hours`,
      notifyUserIds: [swap.initiatorId, swap.receiverId],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SESSION_REMINDER_1H event.
   * @param {Object} session - The session
   * @param {Object} swap - The parent swap
   */
  emitSessionReminder1h(session, swap) {
    this.emit(SessionEvents.SESSION_REMINDER_1H, {
      event: SessionEvents.SESSION_REMINDER_1H,
      session,
      swap,
      message: `Reminder: Your session starts in 1 hour!`,
      notifyUserIds: [swap.initiatorId, swap.receiverId],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SESSION_COMPLETED event.
   * @param {Object} session - The completed session
   * @param {Object} swap - The parent swap
   */
  emitSessionCompleted(session, swap) {
    this.emit(SessionEvents.SESSION_COMPLETED, {
      event: SessionEvents.SESSION_COMPLETED,
      session,
      swap,
      message: 'Session completed!',
      notifyUserIds: [swap.initiatorId, swap.receiverId],
      timestamp: new Date(),
    });
  }

  /**
   * Emit SESSION_MISSED event.
   * @param {Object} session - The missed session
   * @param {Object} swap - The parent swap
   */
  emitSessionMissed(session, swap) {
    this.emit(SessionEvents.SESSION_MISSED, {
      event: SessionEvents.SESSION_MISSED,
      session,
      swap,
      message: 'Your scheduled session was missed',
      notifyUserIds: [swap.initiatorId, swap.receiverId],
      timestamp: new Date(),
    });
  }
}

// Singleton instance
const sessionEventEmitter = new SessionEventEmitter();

module.exports = {
  SessionEvents,
  SessionEventEmitter,
  sessionEventEmitter,
};
