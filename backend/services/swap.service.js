const { SwapStatus, validateTransition, SwapStateError, isActiveState } = require('../utils/swap-state-machine');
const { swapEventEmitter } = require('../events/swap.events');
const { implementsISwapReader, implementsISwapWriter } = require('../interfaces/swap.interface');
const defaultSwapRepository = require('../repositories/swap.repository');
const defaultMatchRepository = require('../repositories/match.repository');
const defaultUserRepository = require('../repositories/user.repository');
const { invalidateMatchesCacheForUsers } = require('./matching.service');
const logger = require('../utils/logger');

/**
 * Default expiration time for pending swaps (48 hours in milliseconds).
 */
const DEFAULT_SWAP_EXPIRY_HOURS = 48;

/**
 * SwapService — Orchestrates swap lifecycle with state machine enforcement.
 * 
 * Design:
 *   - State Machine: Enforces valid transitions only
 *   - Observer Pattern: Emits events for notifications (decouples from NotificationService)
 *   - ISP: Implements ISwapReader and ISwapWriter interfaces
 *   - DIP: Depends on repository abstractions
 *   - SRP: Handles only swap business logic
 */
class SwapService {
  /** @type {import('../repositories/swap.repository')} */
  #swapRepository;

  /** @type {import('../repositories/match.repository')} */
  #matchRepository;

  /** @type {import('../repositories/user.repository')} */
  #userRepository;

  /** @type {import('../events/swap.events').SwapEventEmitter} */
  #eventEmitter;

  /**
   * @param {Object} [swapRepository]
   * @param {Object} [matchRepository]
   * @param {Object} [userRepository]
   * @param {Object} [eventEmitter]
   */
  constructor(
    swapRepository = defaultSwapRepository,
    matchRepository = defaultMatchRepository,
    userRepository = defaultUserRepository,
    eventEmitter = swapEventEmitter,
  ) {
    this.#swapRepository = swapRepository;
    this.#matchRepository = matchRepository;
    this.#userRepository = userRepository;
    this.#eventEmitter = eventEmitter;

    // Validate interface implementation
    if (!implementsISwapReader(this) || !implementsISwapWriter(this)) {
      logger.warn('SwapService does not fully implement ISwapReader or ISwapWriter interfaces');
    }
  }

  /**
   * Create a new swap request.
   * 
   * Validations:
   *   - Match must exist and belong to initiator
   *   - Skills must exist on both users
   *   - No active swap already exists for this match
   * 
   * @param {string} matchId - UUID of the match
   * @param {string} initiatorId - UUID of the user initiating the swap
   * @param {Object} dto - Swap creation data
   * @param {string} dto.offeredSkillId - UUID of skill being offered
   * @param {string} dto.requestedSkillId - UUID of skill being requested
   * @param {string} [dto.terms] - Optional terms/notes
   * @param {Date} [dto.scheduledAt] - Optional scheduled time
   * @returns {Promise<Object>} - Created swap
   * @throws {Error} - If validation fails
   */
  async createSwap(matchId, initiatorId, dto) {
    logger.info(`Creating swap for match ${matchId} by initiator ${initiatorId}`);

    // Validate match exists and belongs to initiator
    const match = await this.#matchRepository.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    const isParticipant = match.userId1 === initiatorId || match.userId2 === initiatorId;
    if (!isParticipant) {
      throw new Error('User is not a participant in this match');
    }

    // Determine receiver (the other party in the match)
    const receiverId = match.userId1 === initiatorId ? match.userId2 : match.userId1;

    // Validate no active swap exists for this match
    const existingSwap = await this.#swapRepository.findExistingSwapForMatch(matchId);
    if (existingSwap) {
      throw new Error('An active swap already exists for this match');
    }

    // Validate skills exist (offeredSkill belongs to initiator, requestedSkill belongs to receiver)
    await this.#validateSkillOwnership(dto.offeredSkillId, initiatorId, 'Offered skill');
    await this.#validateSkillOwnership(dto.requestedSkillId, receiverId, 'Requested skill');

    // Calculate expiration (48 hours from now)
    const expiresAt = new Date(Date.now() + DEFAULT_SWAP_EXPIRY_HOURS * 60 * 60 * 1000);

    // Create swap with PENDING status
    const swap = await this.#swapRepository.create({
      matchId,
      initiatorId,
      receiverId,
      offeredSkillId: dto.offeredSkillId,
      requestedSkillId: dto.requestedSkillId,
      terms: dto.terms,
      scheduledAt: dto.scheduledAt,
      expiresAt,
    });

    // Emit event for notifications
    this.#eventEmitter.emitSwapCreated(swap, swap.initiator, swap.receiver);

    logger.info(`Swap ${swap.id} created successfully`);
    return swap;
  }

  /**
   * Accept a pending swap request.
   * 
   * Validations:
   *   - User must be the receiver
   *   - Swap must be in PENDING state
   * 
   * @param {string} swapId - UUID of the swap
   * @param {string} receiverId - UUID of the receiver accepting
   * @returns {Promise<Object>} - Updated swap
   * @throws {SwapStateError} - If state transition is invalid
   */
  async acceptSwap(swapId, receiverId) {
    logger.info(`Accepting swap ${swapId} by receiver ${receiverId}`);

    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    if (swap.receiverId !== receiverId) {
      throw new Error('Only the receiver can accept this swap');
    }

    // Validate state transition
    validateTransition(swap.status, SwapStatus.ACCEPTED);

    // Update swap status
    const updatedSwap = await this.#swapRepository.update(swapId, {
      status: SwapStatus.ACCEPTED,
    });

    // Increment totalSwaps for both users
    await this.#swapRepository.incrementUserSwapCounts(
      updatedSwap.initiatorId,
      updatedSwap.receiverId
    );

    // Emit event
    this.#eventEmitter.emitSwapAccepted(updatedSwap, updatedSwap.initiator, updatedSwap.receiver);

    logger.info(`Swap ${swapId} accepted`);
    return updatedSwap;
  }

  /**
   * Decline a pending swap request.
   * 
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user declining (must be receiver)
   * @param {string} [reason] - Optional decline reason
   * @returns {Promise<Object>} - Updated swap
   */
  async declineSwap(swapId, userId, reason) {
    logger.info(`Declining swap ${swapId} by user ${userId}`);

    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    // Only receiver can decline a pending swap
    if (swap.receiverId !== userId) {
      throw new Error('Only the receiver can decline this swap');
    }

    // Validate state transition
    validateTransition(swap.status, SwapStatus.CANCELLED);

    const updatedSwap = await this.#swapRepository.update(swapId, {
      status: SwapStatus.CANCELLED,
      cancelReason: reason || 'Declined by receiver',
    });

    // Emit declined event
    this.#eventEmitter.emitSwapDeclined(updatedSwap, updatedSwap.initiator, updatedSwap.receiver, reason);

    logger.info(`Swap ${swapId} declined`);
    return updatedSwap;
  }

  /**
   * Start the swap session (transition to IN_PROGRESS).
   * 
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user starting the session
   * @returns {Promise<Object>} - Updated swap
   */
  async startSwap(swapId, userId) {
    logger.info(`Starting swap ${swapId} by user ${userId}`);

    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    // Either party can start the session
    this.#verifyParticipant(swap, userId);

    // Validate state transition
    validateTransition(swap.status, SwapStatus.IN_PROGRESS);

    const updatedSwap = await this.#swapRepository.update(swapId, {
      status: SwapStatus.IN_PROGRESS,
    });

    // Emit event
    this.#eventEmitter.emitSwapInProgress(updatedSwap, updatedSwap.initiator, updatedSwap.receiver);

    logger.info(`Swap ${swapId} started`);
    return updatedSwap;
  }

  /**
   * Mark swap as complete from one user's perspective.
   * Both users must confirm for swap to transition to COMPLETED.
   * 
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user confirming completion
   * @returns {Promise<Object>} - Updated swap
   */
  async completeSwap(swapId, userId) {
    logger.info(`Completing swap ${swapId} by user ${userId}`);

    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    this.#verifyParticipant(swap, userId);

    // Must be IN_PROGRESS to complete
    if (swap.status !== SwapStatus.IN_PROGRESS) {
      throw new SwapStateError(swap.status, SwapStatus.COMPLETED, 
        'Swap must be in IN_PROGRESS state to complete');
    }

    // Update confirmation flag for the user
    const isInitiator = swap.initiatorId === userId;
    const updateData = isInitiator 
      ? { initiatorConfirmed: true }
      : { receiverConfirmed: true };

    // Check if both will be confirmed after this update
    const bothConfirmed = isInitiator 
      ? (true && swap.receiverConfirmed)
      : (swap.initiatorConfirmed && true);

    if (bothConfirmed) {
      // Both confirmed - transition to COMPLETED
      validateTransition(swap.status, SwapStatus.COMPLETED);
      updateData.status = SwapStatus.COMPLETED;
      updateData.completedAt = new Date();
    }

    const updatedSwap = await this.#swapRepository.update(swapId, updateData);

    // Emit event only when both confirmed
    if (bothConfirmed) {
      this.#eventEmitter.emitSwapCompleted(updatedSwap, updatedSwap.initiator, updatedSwap.receiver);
      logger.info(`Swap ${swapId} completed by both parties`);
      await this._releaseMatchForRematch(updatedSwap);
    } else {
      logger.info(`Swap ${swapId} completion confirmed by ${userId}, waiting for other party`);
    }

    return updatedSwap;
  }

  /**
   * Cancel an active swap.
   * 
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user cancelling
   * @param {string} [reason] - Optional cancellation reason
   * @returns {Promise<Object>} - Updated swap
   */
  async cancelSwap(swapId, userId, reason) {
    logger.info(`Cancelling swap ${swapId} by user ${userId}`);

    const swap = await this.#swapRepository.findById(swapId);
    if (!swap) {
      throw new Error('Swap not found');
    }

    this.#verifyParticipant(swap, userId);

    // Validate state transition
    validateTransition(swap.status, SwapStatus.CANCELLED);

    const updatedSwap = await this.#swapRepository.update(swapId, {
      status: SwapStatus.CANCELLED,
      cancelReason: reason || 'Cancelled by participant',
    });

    // Emit event
    this.#eventEmitter.emitSwapCancelled(
      updatedSwap, 
      updatedSwap.initiator, 
      updatedSwap.receiver, 
      userId, 
      reason
    );

    logger.info(`Swap ${swapId} cancelled`);
    await this._releaseMatchForRematch(updatedSwap);
    return updatedSwap;
  }

  /**
   * When a swap reaches a terminal outcome, close the related match so both users
   * can receive new suggestions (and swap again with each other later).
   * @param {Object} swap
   * @private
   */
  async _releaseMatchForRematch(swap) {
    if (!swap?.matchId) return;
    try {
      await this.#matchRepository.markMatchFulfilled(swap.matchId);
      await invalidateMatchesCacheForUsers(swap.initiatorId, swap.receiverId);
    } catch (err) {
      logger.warn('Could not release match after swap terminal state', {
        matchId: swap.matchId,
        error: err.message,
      });
    }
  }

  /**
   * Expire pending swaps that have passed their expiresAt date.
   * Called by cron job.
   * 
   * @returns {Promise<number>} - Number of expired swaps
   */
  async expirePendingSwaps() {
    logger.info('Running swap expiration job');

    const expiredSwaps = await this.#swapRepository.findExpiredPendingSwaps();
    
    if (expiredSwaps.length === 0) {
      logger.info('No expired swaps found');
      return 0;
    }

    const swapIds = expiredSwaps.map(s => s.id);
    await this.#swapRepository.expireSwaps(swapIds);

    // Emit events for each expired swap
    for (const swap of expiredSwaps) {
      this.#eventEmitter.emitSwapExpired(swap, swap.initiator, swap.receiver);
      const withParties = {
        ...swap,
        initiatorId: swap.initiatorId,
        receiverId: swap.receiverId,
        matchId: swap.matchId,
      };
      await this._releaseMatchForRematch(withParties);
    }

    logger.info(`Expired ${expiredSwaps.length} swaps`);
    return expiredSwaps.length;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ISwapReader Interface Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get a swap by ID, verifying the requesting user is a participant.
   * 
   * @param {string} swapId - UUID of the swap
   * @param {string} requestingUserId - UUID of the requesting user
   * @returns {Promise<Object>} - Swap object with relations
   * @throws {Error} - If swap not found or user is not a participant
   */
  async getSwapById(swapId, requestingUserId) {
    const swap = await this.#swapRepository.findById(swapId);
    
    if (!swap) {
      throw new Error('Swap not found');
    }

    this.#verifyParticipant(swap, requestingUserId);

    return swap;
  }

  /**
   * Get paginated swap history for a user.
   * 
   * @param {string} userId - UUID of the user
   * @param {Object} filters - Filter and pagination options
   * @returns {Promise<Object>} - Paginated swap list
   */
  async getSwapHistory(userId, filters = {}) {
    return await this.#swapRepository.findSwapHistory(userId, filters);
  }

  /**
   * Get active swaps (ACCEPTED + IN_PROGRESS) for a user.
   * 
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>} - Array of active swaps
   */
  async getActiveSwaps(userId) {
    return await this.#swapRepository.findActiveSwaps(userId);
  }

  /**
   * Get swap statistics for a user.
   * 
   * @param {string} userId - UUID of the user
   * @returns {Promise<Object>} - Swap statistics
   */
  async getSwapStats(userId) {
    return await this.#swapRepository.getSwapStats(userId);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private Helper Methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Verify that a user is a participant in the swap.
   * @param {Object} swap - Swap object
   * @param {string} userId - UUID to verify
   * @throws {Error} - If user is not a participant
   */
  #verifyParticipant(swap, userId) {
    if (swap.initiatorId !== userId && swap.receiverId !== userId) {
      throw new Error('User is not a participant in this swap');
    }
  }

  /**
   * Validate that a skill belongs to a specific user.
   * @param {string} skillId - UUID of the UserSkill
   * @param {string} userId - UUID of the expected owner
   * @param {string} label - Label for error message
   * @throws {Error} - If skill doesn't belong to user
   */
  async #validateSkillOwnership(skillId, userId, label) {
    const user = await this.#userRepository.findById(userId);
    if (!user) {
      throw new Error(`User not found for ${label} validation`);
    }

    const hasSkill = user.skills?.some(s => s.id === skillId);
    if (!hasSkill) {
      throw new Error(`${label} does not belong to the expected user`);
    }
  }
}

module.exports = SwapService;
