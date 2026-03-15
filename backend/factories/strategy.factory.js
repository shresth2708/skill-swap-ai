const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const LocationBasedStrategy = require('../strategies/location-based.strategy');
const AIHybridStrategy = require('../strategies/ai-hybrid.strategy');

/**
 * Strategy name → constructor mapping.
 * Adding a new strategy only requires a new entry here (OCP).
 * @type {Record<string, () => import('../strategies/matching.strategy.interface')>}
 */
const STRATEGY_REGISTRY = {
  skill: () => new SkillBasedStrategy(),
  location: () => new LocationBasedStrategy(),
  hybrid: () => new AIHybridStrategy(),
};

/**
 * StrategyFactory — centralised creation of MatchingStrategy instances.
 *
 * Usage:
 *   const strategy = StrategyFactory.create('skill');
 *   matchingService.setStrategy(strategy);
 */
class StrategyFactory {
  /**
   * Create a MatchingStrategy instance by name.
   * @param {string} strategyName - One of: 'skill', 'location', 'hybrid'
   * @returns {import('../strategies/matching.strategy.interface')} Strategy instance
   * @throws {Error} 400 INVALID_STRATEGY if name is unknown
   */
  static create(strategyName) {
    const factory = STRATEGY_REGISTRY[strategyName];

    if (!factory) {
      const logger = require('../utils/logger');
      const supported = Object.keys(STRATEGY_REGISTRY).join(', ');
      logger.warn(`Unknown strategy "${strategyName}". Supported: ${supported}. Defaulting to "skill".`);
      return STRATEGY_REGISTRY['skill']();
    }

    return factory();
  }

  /**
   * List all registered strategy names.
   * @returns {string[]}
   */
  static getAvailableStrategies() {
    return Object.keys(STRATEGY_REGISTRY);
  }
}

module.exports = StrategyFactory;
