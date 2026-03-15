/**
 * SwapStatus — Enum for swap lifecycle states.
 */
const SwapStatus = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

/**
 * Valid state transitions map.
 * Key: current state, Value: array of valid target states
 * 
 * State Machine Rules:
 *   PENDING -> ACCEPTED (receiver accepts)
 *   PENDING -> CANCELLED (either party cancels)
 *   PENDING -> EXPIRED (cron job after expiresAt)
 *   ACCEPTED -> IN_PROGRESS (session starts)
 *   ACCEPTED -> CANCELLED (either party cancels)
 *   IN_PROGRESS -> COMPLETED (both confirm completion)
 */
const STATE_TRANSITIONS = Object.freeze({
  [SwapStatus.PENDING]: [
    SwapStatus.ACCEPTED,
    SwapStatus.CANCELLED,
    SwapStatus.EXPIRED,
  ],
  [SwapStatus.ACCEPTED]: [
    SwapStatus.IN_PROGRESS,
    SwapStatus.CANCELLED,
  ],
  [SwapStatus.IN_PROGRESS]: [
    SwapStatus.COMPLETED,
  ],
  [SwapStatus.COMPLETED]: [],
  [SwapStatus.CANCELLED]: [],
  [SwapStatus.EXPIRED]: [],
});

/**
 * SwapStateError — Custom error for invalid state transitions.
 * 
 * Provides detailed error information including:
 *   - Current state
 *   - Attempted target state
 *   - Valid transitions from current state
 */
class SwapStateError extends Error {
  /**
   * @param {string} currentState - The current swap status
   * @param {string} targetState - The attempted target status
   * @param {string} [message] - Optional custom message
   */
  constructor(currentState, targetState, message) {
    const validTransitions = STATE_TRANSITIONS[currentState] || [];
    const defaultMessage = `Invalid state transition: Cannot transition from ${currentState} to ${targetState}. Valid transitions: [${validTransitions.join(', ') || 'none'}]`;
    
    super(message || defaultMessage);
    
    this.name = 'SwapStateError';
    this.currentState = currentState;
    this.targetState = targetState;
    this.validTransitions = validTransitions;
    this.statusCode = 400; // Bad Request - client error
    
    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialize error for API response.
   * @returns {Object}
   */
  toJSON() {
    return {
      error: this.name,
      message: this.message,
      currentState: this.currentState,
      targetState: this.targetState,
      validTransitions: this.validTransitions,
    };
  }
}

/**
 * Validate if a state transition is allowed.
 * 
 * @param {string} currentState - Current swap status
 * @param {string} targetState - Desired target status
 * @returns {boolean} - True if transition is valid
 */
function isValidTransition(currentState, targetState) {
  const validTargets = STATE_TRANSITIONS[currentState];
  
  if (!validTargets) {
    return false; // Unknown current state
  }
  
  return validTargets.includes(targetState);
}

/**
 * Validate state transition and throw SwapStateError if invalid.
 * 
 * @param {string} currentState - Current swap status
 * @param {string} targetState - Desired target status
 * @throws {SwapStateError} - If transition is not allowed
 */
function validateTransition(currentState, targetState) {
  if (!isValidTransition(currentState, targetState)) {
    throw new SwapStateError(currentState, targetState);
  }
}

/**
 * Get valid transitions from a given state.
 * 
 * @param {string} currentState - Current swap status
 * @returns {string[]} - Array of valid target states
 */
function getValidTransitions(currentState) {
  return STATE_TRANSITIONS[currentState] || [];
}

/**
 * Check if a swap status is terminal (no further transitions).
 * 
 * @param {string} status - Swap status to check
 * @returns {boolean} - True if status is terminal
 */
function isTerminalState(status) {
  const transitions = STATE_TRANSITIONS[status];
  return transitions && transitions.length === 0;
}

/**
 * Check if a swap is in an active (non-terminal) state.
 * 
 * @param {string} status - Swap status to check
 * @returns {boolean} - True if swap is active
 */
function isActiveState(status) {
  return status === SwapStatus.ACCEPTED || status === SwapStatus.IN_PROGRESS;
}

module.exports = {
  SwapStatus,
  STATE_TRANSITIONS,
  SwapStateError,
  isValidTransition,
  validateTransition,
  getValidTransitions,
  isTerminalState,
  isActiveState,
};
