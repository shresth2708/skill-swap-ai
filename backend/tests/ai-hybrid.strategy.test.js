const AIHybridStrategy = require('../strategies/ai-hybrid.strategy');
const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const LocationBasedStrategy = require('../strategies/location-based.strategy');

// Mocking dependencies to isolate the AIHybridStrategy logic
jest.mock('../strategies/skill-based.strategy');
jest.mock('../strategies/location-based.strategy');

describe('AIHybridStrategy Unit Tests', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Default mock implementations to return a base score
    SkillBasedStrategy.prototype.calculateScore.mockReturnValue(0.8);
    LocationBasedStrategy.prototype.calculateScore.mockReturnValue(0.5);
  });

  describe('Constructor Initializations', () => {
    it('should initialize with default weights of 0.6 and 0.4', () => {
      const strategy = new AIHybridStrategy();
      expect(strategy._skillWeight).toBeCloseTo(0.6);
      expect(strategy._locationWeight).toBeCloseTo(0.4);
    });

    it('should allow custom weights as long as they sum to 1.0', () => {
      const strategy = new AIHybridStrategy({ skillWeight: 0.7, locationWeight: 0.3 });
      expect(strategy._skillWeight).toBeCloseTo(0.7);
      expect(strategy._locationWeight).toBeCloseTo(0.3);
    });

    it('should throw an error if weights do not sum to 1.0', () => {
      expect(() => {
        new AIHybridStrategy({ skillWeight: 0.5, locationWeight: 0.3 });
      }).toThrow('Strategy weights must sum to 1.0');
    });
  });

  describe('calculateScore()', () => {
    it('should blend skill and location scores using the provided weights', () => {
      const strategy = new AIHybridStrategy({ skillWeight: 0.8, locationWeight: 0.2 });
      
      const user1 = { id: 1 };
      const user2 = { id: 2 };

      const score = strategy.calculateScore(user1, user2);

      // (0.8 skill_score * 0.8 weight) + (0.5 location_score * 0.2 weight)
      // 0.64 + 0.10 = 0.74
      expect(score).toBeCloseTo(0.74);
      expect(SkillBasedStrategy.prototype.calculateScore).toHaveBeenCalledWith(user1, user2);
      expect(LocationBasedStrategy.prototype.calculateScore).toHaveBeenCalledWith(user1, user2);
    });
  });

  describe('findCandidates()', () => {
    it('should delegate to the skill-based strategy pre-filtering', () => {
      const strategy = new AIHybridStrategy();
      const mockCandidates = [{ id: 2 }, { id: 3 }];
      SkillBasedStrategy.prototype.findCandidates.mockReturnValue(mockCandidates);

      const result = strategy.findCandidates(1, [{ id: 2 }, { id: 3 }, { id: 4 }]);
      
      expect(SkillBasedStrategy.prototype.findCandidates).toHaveBeenCalled();
      expect(result).toEqual(mockCandidates);
    });
  });

  describe('rankMatches()', () => {
    it('should rank matches in descending order based on score', () => {
      const strategy = new AIHybridStrategy();
      const unranked = [
        { id: 2, score: 0.5 },
        { id: 3, score: 0.9 },
        { id: 4, score: 0.7 }
      ];

      const ranked = strategy.rankMatches(unranked);

      expect(ranked[0].id).toBe(3); // 0.9
      expect(ranked[1].id).toBe(4); // 0.7
      expect(ranked[2].id).toBe(2); // 0.5
    });
  });

  describe('scoreWithML()', () => {
    it('should currently delegate to the skill-based strategy (stub)', async () => {
      const strategy = new AIHybridStrategy();
      
      const user1 = { id: 1 };
      const user2 = { id: 2 };

      const score = await strategy.scoreWithML(user1, user2);
      expect(score).toBe(0.8); // 0.8 is the mock return value we set in beforeEach
    });
  });
});
