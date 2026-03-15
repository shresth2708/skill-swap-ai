const cron = require('node-cron');
const SwapService = require('../services/swap.service');
const SessionService = require('../services/session.service');
const { sessionEventEmitter } = require('../events/session.events');
const defaultSessionRepository = require('../repositories/session.repository');
const logger = require('../utils/logger');

/**
 * CronJobManager — Manages all scheduled cron jobs for session/swap lifecycle.
 *
 * Design:
 *   - All jobs are idempotent (safe to run multiple times)
 *   - Jobs use narrow time windows to avoid duplicate notifications
 *   - Status-based filtering ensures already-processed records are skipped
 *
 * Jobs:
 *   1. Every hour — Session reminders (24h and 1h before)
 *   2. Every 30 min — Expire pending swaps past expiresAt
 *   3. Every day at midnight — Mark missed sessions
 */
class CronJobManager {
  #swapService;
  #sessionService;
  #sessionRepository;
  #eventEmitter;
  #jobs = [];

  /**
   * @param {Object} [swapService]
   * @param {Object} [sessionService]
   * @param {Object} [sessionRepository]
   * @param {Object} [eventEmitter]
   */
  constructor(
    swapService = null,
    sessionService = null,
    sessionRepository = defaultSessionRepository,
    eventEmitter = sessionEventEmitter,
  ) {
    this.#swapService = swapService || new SwapService();
    this.#sessionService = sessionService || new SessionService();
    this.#sessionRepository = sessionRepository;
    this.#eventEmitter = eventEmitter;
  }

  /**
   * Start all cron jobs.
   */
  startAll() {
    this.#startSessionReminders();
    this.#startSwapExpiration();
    this.#startMissedSessionCheck();
    logger.info('CronJobManager: All cron jobs started');
  }

  /**
   * Stop all cron jobs.
   */
  stopAll() {
    for (const job of this.#jobs) {
      job.stop();
    }
    this.#jobs = [];
    logger.info('CronJobManager: All cron jobs stopped');
  }

  /**
   * Job 1: Session Reminders — runs every hour.
   *
   * Idempotent: Uses narrow time windows (±1h for 24h reminders,
   * ±30min for 1h reminders) so duplicate runs won't re-notify.
   * @private
   */
  #startSessionReminders() {
    const job = cron.schedule('0 * * * *', async () => {
      logger.info('Cron: Running session reminder job');

      try {
        // 24h reminders
        const sessions24h = await this.#sessionRepository.findSessionsForReminder24h();
        for (const session of sessions24h) {
          this.#eventEmitter.emitSessionReminder24h(session, session.swap);
        }
        if (sessions24h.length > 0) {
          logger.info(`Cron: Sent ${sessions24h.length} 24h reminders`);
        }

        // 1h reminders
        const sessions1h = await this.#sessionRepository.findSessionsForReminder1h();
        for (const session of sessions1h) {
          this.#eventEmitter.emitSessionReminder1h(session, session.swap);
        }
        if (sessions1h.length > 0) {
          logger.info(`Cron: Sent ${sessions1h.length} 1h reminders`);
        }
      } catch (error) {
        logger.error('Cron: Session reminder job failed', { error: error.message });
      }
    });

    this.#jobs.push(job);
    logger.info('Cron: Session reminder job registered (every hour)');
  }

  /**
   * Job 2: Expire Pending Swaps — runs every 30 minutes.
   *
   * Idempotent: Only updates swaps with status=PENDING and expiresAt < now.
   * Already-expired swaps have status=EXPIRED and won't match the query.
   * @private
   */
  #startSwapExpiration() {
    const job = cron.schedule('*/30 * * * *', async () => {
      logger.info('Cron: Running swap expiration job');

      try {
        const count = await this.#swapService.expirePendingSwaps();
        if (count > 0) {
          logger.info(`Cron: Expired ${count} pending swaps`);
        }
      } catch (error) {
        logger.error('Cron: Swap expiration job failed', { error: error.message });
      }
    });

    this.#jobs.push(job);
    logger.info('Cron: Swap expiration job registered (every 30 min)');
  }

  /**
   * Job 3: Mark Missed Sessions — runs every day at midnight.
   *
   * Idempotent: Only updates sessions with status=SCHEDULED and
   * scheduledAt < (now - 30min). Already-MISSED sessions won't match.
   * @private
   */
  #startMissedSessionCheck() {
    const job = cron.schedule('0 0 * * *', async () => {
      logger.info('Cron: Running missed session check');

      try {
        const missedSessions = await this.#sessionRepository.findMissedSessions();

        if (missedSessions.length === 0) {
          logger.info('Cron: No missed sessions found');
          return;
        }

        const sessionIds = missedSessions.map((s) => s.id);
        await this.#sessionRepository.markSessionsMissed(sessionIds);

        // Emit events for each missed session
        for (const session of missedSessions) {
          this.#eventEmitter.emitSessionMissed(session, session.swap);
        }

        logger.info(`Cron: Marked ${missedSessions.length} sessions as missed`);
      } catch (error) {
        logger.error('Cron: Missed session check failed', { error: error.message });
      }
    });

    this.#jobs.push(job);
    logger.info('Cron: Missed session check registered (daily at midnight)');
  }
}

module.exports = CronJobManager;
