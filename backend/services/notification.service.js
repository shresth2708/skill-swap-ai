const prisma = require('../config/db.config');
const logger = require('../utils/logger');
const { SwapEvents, swapEventEmitter } = require('../events/swap.events');
const { SessionEvents, sessionEventEmitter } = require('../events/session.events');
const { ReviewEvents, reviewEventEmitter } = require('../events/review.events');

/**
 * NotificationService — textbook Observer Pattern Subject.
 *
 * - Observers implement a channel (email/push/inapp)
 * - Service checks user preferences before dispatching per channel
 * - Errors are isolated per observer (one channel failing doesn't break others)
 *
 * @implements {import('../interfaces/observer.interface').ISubject}
 */
class NotificationService {
  /** @type {Array<import('../interfaces/observer.interface').IObserver>} */
  #observers = [];

  /** @type {import('../events/swap.events').SwapEventEmitter} */
  #swapEmitter;

  /** @type {import('../events/session.events').SessionEventEmitter} */
  #sessionEmitter;

  /** @type {import('../events/review.events').ReviewEventEmitter} */
  #reviewEmitter;

  constructor(
    swapEmitter = swapEventEmitter,
    sessionEmitter = sessionEventEmitter,
    reviewEmitter = reviewEventEmitter,
  ) {
    this.#swapEmitter = swapEmitter;
    this.#sessionEmitter = sessionEmitter;
    this.#reviewEmitter = reviewEmitter;
  }

  addObserver(obs) {
    this.#observers.push(obs);
  }

  removeObserver(obs) {
    this.#observers = this.#observers.filter((o) => o !== obs);
  }

  /**
   * Backwards-compatible bootstrap entrypoint (existing `server.js` calls this).
   * Registers listeners on swap/session/review event buses.
   */
  registerListeners() {
    // Swap lifecycle
    this.#swapEmitter.on(SwapEvents.SWAP_CREATED, (p) => this.handleSwapEvent(SwapEvents.SWAP_CREATED, p));
    this.#swapEmitter.on(SwapEvents.SWAP_ACCEPTED, (p) => this.handleSwapEvent(SwapEvents.SWAP_ACCEPTED, p));
    this.#swapEmitter.on(SwapEvents.SWAP_DECLINED, (p) => this.handleSwapEvent(SwapEvents.SWAP_DECLINED, p));
    this.#swapEmitter.on(SwapEvents.SWAP_IN_PROGRESS, (p) => this.handleSwapEvent(SwapEvents.SWAP_IN_PROGRESS, p));
    this.#swapEmitter.on(SwapEvents.SWAP_COMPLETED, (p) => this.handleSwapEvent(SwapEvents.SWAP_COMPLETED, p));
    this.#swapEmitter.on(SwapEvents.SWAP_CANCELLED, (p) => this.handleSwapEvent(SwapEvents.SWAP_CANCELLED, p));
    this.#swapEmitter.on(SwapEvents.SWAP_EXPIRED, (p) => this.handleSwapEvent(SwapEvents.SWAP_EXPIRED, p));

    // Session lifecycle
    this.#sessionEmitter.on(SessionEvents.SESSION_SCHEDULED, (p) => this.#onSessionEvent('SESSION_SCHEDULED', p));

    // Review lifecycle
    this.#reviewEmitter.on(ReviewEvents.REVIEW_RECEIVED, (p) => this.#onReviewEvent('REVIEW_RECEIVED', p));

    logger.info('NotificationService: listeners registered (swap/session/review)');
  }

  /**
   * Back-compat for existing tests and emitters.
   * @param {string} event SwapEvents.*
   * @param {any} payload
   */
  async handleSwapEvent(event, payload) {
    const map = {
      [SwapEvents.SWAP_CREATED]: 'SWAP_CREATED',
      [SwapEvents.SWAP_ACCEPTED]: 'SWAP_ACCEPTED',
      [SwapEvents.SWAP_DECLINED]: 'SWAP_DECLINED',
      [SwapEvents.SWAP_IN_PROGRESS]: 'SWAP_IN_PROGRESS',
      [SwapEvents.SWAP_COMPLETED]: 'SWAP_COMPLETED',
      [SwapEvents.SWAP_CANCELLED]: 'SWAP_CANCELLED',
      [SwapEvents.SWAP_EXPIRED]: 'SWAP_EXPIRED',
    };

    const type = map[event] || String(event);
    await this.#onSwapEvent(type, payload);
  }

  /**
   * @param {import('../interfaces/observer.interface').SwapEvent} event
   */
  async notifyAll(event) {
    for (const observer of this.#observers) {
      try {
        const channel = observer.getChannel();
        const enabled = await this.#isChannelEnabled(event.userId, channel);
        if (!enabled) continue;
        await observer.update(event);
      } catch (error) {
        logger.error('NotificationService: observer failed', {
          channel: observer?.getChannel?.(),
          userId: event.userId,
          type: event.type,
          error: error?.message,
        });
      }
    }
  }

  /**
   * Build SwapEvent then notify all observers.
   * @param {string} userId
   * @param {string} type
   * @param {Object<string, any>} payload
   */
  async send(userId, type, payload = {}) {
    const createdAt = new Date();
    const { title, body } = this.#titleBodyForType(type, payload);

    /** @type {import('../interfaces/observer.interface').SwapEvent} */
    const event = {
      userId,
      type,
      title,
      body,
      payload,
      createdAt,
    };

    await this.notifyAll(event);
  }

  async getNotifications(userId, pagination = {}) {
    const page = Number(pagination.page || 1);
    const limit = Math.min(Number(pagination.limit || 20), 50);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      notifications: items,
      // Backward-compatible alias for older consumers.
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      total,
      page,
      limit,
      totalPages,
    };
  }

  async markRead(notificationId, userId) {
    const now = new Date();
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: now },
    });

    if (result.count === 0) {
      const err = new Error('Notification not found');
      err.statusCode = 404;
      throw err;
    }

    return await prisma.notification.findUnique({ where: { id: notificationId } });
  }

  async markAllRead(userId) {
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return { updated: result.count };
  }

  async getUnreadCount(userId) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Event bus adapters (existing emitters -> this service)
  // ─────────────────────────────────────────────────────────────────────────────

  async #onSwapEvent(type, payload) {
    const recipients = payload.notifyUserIds || (payload.notifyUserId ? [payload.notifyUserId] : []);
    for (const userId of recipients) {
      const base = this.#basePayloadFromBus(payload, { referenceId: payload.swap?.id, swapId: payload.swap?.id });
      await this.send(userId, type, base);
    }
  }

  async #onSessionEvent(type, payload) {
    const recipients = payload.notifyUserIds || (payload.notifyUserId ? [payload.notifyUserId] : []);
    const dt = payload.session?.scheduledAt ? new Date(payload.session.scheduledAt) : null;
    const date = dt ? dt.toLocaleDateString() : undefined;
    const time = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined;

    for (const userId of recipients) {
      const base = this.#basePayloadFromBus(payload, {
        referenceId: payload.session?.id,
        sessionId: payload.session?.id,
        swapId: payload.swap?.id,
        date,
        time,
      });
      await this.send(
        userId,
        type,
        base
      );
    }
  }

  async #onReviewEvent(type, payload) {
    const recipients = payload.notifyUserIds || (payload.notifyUserId ? [payload.notifyUserId] : []);
    for (const userId of recipients) {
      const base = this.#basePayloadFromBus(payload, {
        referenceId: payload.review?.id,
        reviewId: payload.review?.id,
        rating: payload.review?.rating,
        swapId: payload.review?.swapId,
      });
      await this.send(
        userId,
        type,
        base
      );
    }
  }

  #basePayloadFromBus(payload, extra = {}) {
    const actorName =
      payload?.initiator?.profile?.displayName ||
      payload?.receiver?.profile?.displayName ||
      payload?.reviewer?.profile?.displayName ||
      payload?.rescheduledBy?.profile?.displayName ||
      payload?.initiator?.email ||
      payload?.receiver?.email ||
      payload?.reviewer?.email ||
      undefined;

    // Best-effort: email observer needs recipient email; if emitter provided full user objects, use them.
    const userEmail =
      payload?.notifyUserId && payload?.receiver?.id && payload?.initiator?.id
        ? (payload.receiver.id === payload.notifyUserId ? payload.receiver.email : payload.initiator.email)
        : undefined;

    return {
      message: payload?.message,
      actorName,
      userEmail,
      ...extra,
    };
  }

  #titleBodyForType(type, payload) {
    const name = payload?.actorName || 'someone';
    switch (type) {
      case 'SWAP_CREATED':
        return { title: 'New swap request', body: `You have a new swap request from ${name}` };
      case 'SWAP_ACCEPTED':
        return { title: 'Swap accepted', body: 'Your swap request was accepted!' };
      case 'SWAP_COMPLETED':
        return { title: 'Swap completed', body: `Great job! Leave a review for ${name}` };
      case 'SESSION_SCHEDULED':
        return { title: 'Session scheduled', body: `Session scheduled for ${payload?.date || ''} at ${payload?.time || ''}`.trim() };
      case 'REVIEW_RECEIVED':
        return { title: 'New review', body: `${name} left you a ${payload?.rating}-star review` };
      default:
        return { title: 'Notification', body: payload?.message || 'You have a new notification' };
    }
  }

  async #isChannelEnabled(userId, channel) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    // Default allow if profile missing (shouldn't happen, but keeps system resilient)
    const prefs = user?.profile || {};
    if (channel === 'email') return prefs.notifyEmail !== false;
    if (channel === 'push') return prefs.notifyPush !== false;
    if (channel === 'inapp') return prefs.notifyInApp !== false;
    return true;
  }
}

module.exports = NotificationService;
