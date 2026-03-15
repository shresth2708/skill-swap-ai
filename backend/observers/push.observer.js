const prisma = require('../config/db.config');
const logger = require('../utils/logger');

class PushObserver {
  getChannel() {
    return 'push';
  }

  /**
   * @param {import('../interfaces/observer.interface').SwapEvent} event
   */
  async update(event) {
    const { userId } = event;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    const token = user?.profile?.pushToken;
    if (!token) {
      // Dev-friendly behavior: don't error, just no-op
      logger.info('PushObserver: no push token, skipping', { userId });
      return;
    }

    const payload = this.buildPushPayload(event);
    await this.#sendPushStub(token, payload);
  }

  /**
   * @param {import('../interfaces/observer.interface').SwapEvent} event
   */
  buildPushPayload(event) {
    const referenceId = event.payload?.referenceId || event.payload?.swapId || event.payload?.sessionId || event.payload?.reviewId;
    return {
      title: event.title,
      body: event.body,
      data: {
        type: event.type,
        referenceId: referenceId || null,
      },
    };
  }

  async #sendPushStub(token, payload) {
    // Stub for Firebase FCM in dev
    logger.info('PushObserver: sending push (stub)', { token, payload });
  }
}

module.exports = PushObserver;

