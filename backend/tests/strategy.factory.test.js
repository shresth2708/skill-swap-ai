const StrategyFactory = require('../factories/strategy.factory');
const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const LocationBasedStrategy = require('../strategies/location-based.strategy');
const AIHybridStrategy = require('../strategies/ai-hybrid.strategy');

describe('StrategyFactory', () => {
  describe('create', () => {
    it('should create a SkillBasedStrategy for "skill"', () => {
      const strategy = StrategyFactory.create('skill');
      expect(strategy).toBeInstanceOf(SkillBasedStrategy);
    });

    it('should create a LocationBasedStrategy for "location"', () => {
      const strategy = StrategyFactory.create('location');
      expect(strategy).toBeInstanceOf(LocationBasedStrategy);
    });

    it('should create an AIHybridStrategy for "hybrid"', () => {
      const strategy = StrategyFactory.create('hybrid');
      expect(strategy).toBeInstanceOf(AIHybridStrategy);
    });

    it('should default to SkillBasedStrategy and log warning for unknown strategy', () => {
      // Mock logger to verify warning
      const logger = require('../utils/logger');
      const spy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
      
      const strategy = StrategyFactory.create('unknown');
      
      expect(strategy).toBeInstanceOf(SkillBasedStrategy);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Unknown strategy "unknown"'));
      
      spy.mockRestore();
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return all registered strategy names', () => {
      const strategies = StrategyFactory.getAvailableStrategies();
      expect(strategies).toEqual(['skill', 'location', 'hybrid']);
    });
  });
});
