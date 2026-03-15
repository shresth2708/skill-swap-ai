const prisma = require('../config/db.config');
const logger = require('../utils/logger');

class InAppObserver {
  /** @type {import('socket.io').Server|null} */
  #io;

  /**
   * @param {import('socket.io').Server} io
   */
  constructor(io) {
    this.#io = io;
  }

  getChannel() {
    return 'inapp';
  }

  /**
   * @param {import('../interfaces/observer.interface').SwapEvent} event
   */
  async update(event) {
    const { userId, type, title, body, payload, createdAt } = event;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        payload: payload || undefined,
        channel: this.getChannel(),
        createdAt,
      },
    });

    if (this.#io) {
      const room = `user:${userId}`;
      this.#io.to(room).emit('notification:new', notification);
    } else {
      logger.warn('InAppObserver: socket.io not configured, persisted only', { userId });
    }
  }
}

module.exports = InAppObserver;

