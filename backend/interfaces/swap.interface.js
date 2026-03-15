/**
 * ISwapReader — Interface for read-only swap operations.
 * 
 * Design:
 *   - ISP (Interface Segregation Principle): Read-only consumers
 *     should not depend on write operations.
 *   - Used by: Dashboard, Analytics, Reporting services
 * 
 * Methods:
 *   - getSwapById(swapId, requestingUserId): Get swap details (verify participant)
 *   - getSwapHistory(userId, filters): Paginated swap history
 *   - getActiveSwaps(userId): Get ACCEPTED + IN_PROGRESS swaps
 */

/**
 * @typedef {Object} SwapFilters
 * @property {string} [status] - Filter by status
 * @property {Date} [fromDate] - Filter from date
 * @property {Date} [toDate] - Filter to date
 * @property {number} [page] - Page number (1-indexed)
 * @property {number} [limit] - Items per page
 */

/**
 * @typedef {Object} PaginatedResult
 * @property {Array} data - Array of swaps
 * @property {number} total - Total count
 * @property {number} page - Current page
 * @property {number} limit - Items per page
 * @property {number} totalPages - Total number of pages
 */

/**
 * ISwapReader interface definition.
 * This is a documentation interface - JavaScript doesn't have native interfaces.
 * Implementing classes should provide these methods.
 * 
 * @interface ISwapReader
 */
const ISwapReader = {
  /**
   * Get a swap by ID, verifying the requesting user is a participant.
   * @param {string} swapId - UUID of the swap
   * @param {string} requestingUserId - UUID of the requesting user
   * @returns {Promise<Object>} - Swap object with relations
   * @throws {Error} - If swap not found or user is not a participant
   */
  getSwapById: async (swapId, requestingUserId) => {},

  /**
   * Get paginated swap history for a user.
   * @param {string} userId - UUID of the user
   * @param {SwapFilters} filters - Filter and pagination options
   * @returns {Promise<PaginatedResult>} - Paginated swap list
   */
  getSwapHistory: async (userId, filters) => {},

  /**
   * Get active swaps (ACCEPTED + IN_PROGRESS) for a user.
   * @param {string} userId - UUID of the user
   * @returns {Promise<Array>} - Array of active swaps
   */
  getActiveSwaps: async (userId) => {},
};

/**
 * ISwapWriter — Interface for write operations on swaps.
 * 
 * Design:
 *   - ISP (Interface Segregation Principle): Write operations
 *     separated from read operations.
 *   - Used by: SwapService, SwapController
 * 
 * Methods:
 *   - createSwap(matchId, initiatorId, dto): Create new swap
 *   - acceptSwap(swapId, receiverId): Accept a pending swap
 *   - declineSwap(swapId, userId, reason): Decline/cancel with reason
 *   - startSwap(swapId, userId): Start the swap session
 *   - completeSwap(swapId, userId): Mark completion (both must confirm)
 *   - cancelSwap(swapId, userId, reason): Cancel an active swap
 */

/**
 * @typedef {Object} CreateSwapDto
 * @property {string} offeredSkillId - UUID of skill being offered
 * @property {string} requestedSkillId - UUID of skill being requested
 * @property {string} [terms] - Optional terms/notes for the swap
 * @property {Date} [scheduledAt] - Optional scheduled date/time
 */

/**
 * ISwapWriter interface definition.
 * 
 * @interface ISwapWriter
 */
const ISwapWriter = {
  /**
   * Create a new swap request.
   * @param {string} matchId - UUID of the match
   * @param {string} initiatorId - UUID of the user initiating the swap
   * @param {CreateSwapDto} dto - Swap creation data
   * @returns {Promise<Object>} - Created swap object
   * @throws {Error} - If validation fails
   */
  createSwap: async (matchId, initiatorId, dto) => {},

  /**
   * Accept a pending swap request.
   * @param {string} swapId - UUID of the swap
   * @param {string} receiverId - UUID of the receiver accepting
   * @returns {Promise<Object>} - Updated swap object
   * @throws {Error} - If user is not receiver or invalid state
   */
  acceptSwap: async (swapId, receiverId) => {},

  /**
   * Decline a pending swap request.
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user declining
   * @param {string} [reason] - Optional decline reason
   * @returns {Promise<Object>} - Updated swap object
   */
  declineSwap: async (swapId, userId, reason) => {},

  /**
   * Start the swap session (transition to IN_PROGRESS).
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user starting the session
   * @returns {Promise<Object>} - Updated swap object
   */
  startSwap: async (swapId, userId) => {},

  /**
   * Mark swap as complete from one user's perspective.
   * Both users must confirm for swap to transition to COMPLETED.
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user confirming completion
   * @returns {Promise<Object>} - Updated swap object
   */
  completeSwap: async (swapId, userId) => {},

  /**
   * Cancel an active swap.
   * @param {string} swapId - UUID of the swap
   * @param {string} userId - UUID of user cancelling
   * @param {string} [reason] - Optional cancellation reason
   * @returns {Promise<Object>} - Updated swap object
   */
  cancelSwap: async (swapId, userId, reason) => {},

  /**
   * Expire pending swaps that have passed their expiresAt date.
   * Called by cron job.
   * @returns {Promise<number>} - Number of expired swaps
   */
  expirePendingSwaps: async () => {},
};

/**
 * Validate that an object implements ISwapReader interface.
 * @param {Object} obj - Object to validate
 * @returns {boolean} - True if implements all methods
 */
function implementsISwapReader(obj) {
  return (
    typeof obj.getSwapById === 'function' &&
    typeof obj.getSwapHistory === 'function' &&
    typeof obj.getActiveSwaps === 'function'
  );
}

/**
 * Validate that an object implements ISwapWriter interface.
 * @param {Object} obj - Object to validate
 * @returns {boolean} - True if implements all methods
 */
function implementsISwapWriter(obj) {
  return (
    typeof obj.createSwap === 'function' &&
    typeof obj.acceptSwap === 'function' &&
    typeof obj.declineSwap === 'function' &&
    typeof obj.startSwap === 'function' &&
    typeof obj.completeSwap === 'function' &&
    typeof obj.cancelSwap === 'function'
  );
}

module.exports = {
  ISwapReader,
  ISwapWriter,
  implementsISwapReader,
  implementsISwapWriter,
};
