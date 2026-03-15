const LocationBasedStrategy = require('../../strategies/location-based.strategy');
const AIHybridStrategy = require('../../strategies/ai-hybrid.strategy');

describe('Matching Strategies - Final Gaps', () => {
  describe('LocationBasedStrategy', () => {
    let lbStrategy;

    beforeEach(() => {
      lbStrategy = new LocationBasedStrategy();
    });

    it('calculates geographic distance correctly (Haversine)', () => {
      const user1 = {
        id: 'u1',
        profile: { latitude: 40.7128, longitude: -74.0060 }, // NYC
        skills: [
          { type: 'want', skillId: 's1', proficiencyLevel: 'EXPERT', skill: { name: 'Java' } },
          { type: 'offer', skillId: 's2', proficiencyLevel: 'EXPERT' }
        ],
        availabilitySlots: [{ dayOfWeek: 1, slotStart: '1970-01-01T10:00:00Z', slotEnd: '1970-01-01T11:00:00Z' }],
        avgRating: 5
      };
      const user2 = {
        id: 'u2',
        profile: { latitude: 34.0522, longitude: -118.2437 }, // LA
        skills: [
          { type: 'offer', skillId: 's1', proficiencyLevel: 'EXPERT', skill: { name: 'Java' } },
          { type: 'want', skillId: 's2', proficiencyLevel: 'EXPERT' }
        ],
        availabilitySlots: [{ dayOfWeek: 1, slotStart: '1970-01-01T10:00:00Z', slotEnd: '1970-01-01T11:00:00Z' }],
        avgRating: 5
      };

      const score = lbStrategy.calculateScore(user1, user2);
      // Skill score = 0.35 + 0.35 + 0.1 + 0.1 + 0.1*0.15 = 0.915?
      // Wait, skill-based formula:
      // (1*0.35) + (1*0.35) + (1*0.1) + (1*0.1) + (0.15*0.1) = 0.35+0.35+0.1+0.1+0.015 = 0.915
      // distance > 500km, proximity = 0
      // lb final = 0.2*0 + 0.8*0.915 = 0.732
      expect(score).toBeCloseTo(0.732);
    });

    it('handles nearby coordinates', () => {
      const user1 = {
        profile: { latitude: 40, longitude: -70 },
        skills: [{ type: 'offer', skillId: 's1', proficiencyLevel: 'EXPERT' }, { type: 'want', skillId: 's2', proficiencyLevel: 'EXPERT' }],
        availabilitySlots: [{ dayOfWeek: 1, slotStart: '1970-01-01T10:00:00Z', slotEnd: '1970-01-01T11:00:00Z' }],
        avgRating: 5
      };
      const user2 = {
        profile: { latitude: 40, longitude: -70 },
        skills: [{ type: 'want', skillId: 's1', proficiencyLevel: 'EXPERT' }, { type: 'offer', skillId: 's2', proficiencyLevel: 'EXPERT' }],
        availabilitySlots: [{ dayOfWeek: 1, slotStart: '1970-01-01T10:00:00Z', slotEnd: '1970-01-01T11:00:00Z' }],
        avgRating: 5
      };

      const score = lbStrategy.calculateScore(user1, user2);
      expect(score).toBeCloseTo(0.932); // proximity(1)*0.2 + skill(0.915)*0.8 = 0.2 + 0.732 = 0.932
    });

    it('falls back to skill only if coordinates missing', () => {
      const user1 = {
        profile: { latitude: 10, longitude: 10 },
        skills: [{ type: 'offer', skillId: 's1', proficiencyLevel: 'EXPERT' }],
        avgRating: 5
      };
      const user2 = {
        profile: {},
        skills: [{ type: 'want', skillId: 's1', proficiencyLevel: 'EXPERT' }],
        avgRating: 5
      };

      const score = lbStrategy.calculateScore(user1, user2);
      // user1Wants = [], user2Offers = [] -> overlap = 0
      // user2Wants = [s1], user1Offers = [s1] -> reverse = 1
      // proficiency = 0 (no user1Wants)
      // ratingWeight = 0.15
      // Final = 0*0.35 + 1*0.35 + 0.15*0.1 = 0.365
      expect(score).toBeCloseTo(0.365);
    });

    it('rankMatches sorts correctly', () => {
      const matches = [{ score: 0.5 }, { score: 0.9 }];
      const ranked = lbStrategy.rankMatches(matches);
      expect(ranked[0].score).toBe(0.9);
    });
  });

  describe('AIHybridStrategy', () => {
    it('throws if weights do not sum to 1.0', () => {
      expect(() => new AIHybridStrategy({ skillWeight: 0.5, locationWeight: 0.4 })).toThrow('sum to 1.0');
    });

    it('calculates blended score', async () => {
      const hybrid = new AIHybridStrategy({ skillWeight: 0.7, locationWeight: 0.3 });
      const user1 = {
          profile: { latitude: 40, longitude: -70 },
          skills: [{ type: 'offer', skillId: 's1', proficiencyLevel: 'EXPERT' }, { type: 'want', skillId: 's2', proficiencyLevel: 'EXPERT' }],
          availabilitySlots: [{ dayOfWeek: 1, slotStart: '1970-01-01T10:00:00Z', slotEnd: '1970-01-01T11:00:00Z' }],
          avgRating: 5
      };
      const user2 = {
          profile: { latitude: 40, longitude: -70 },
          skills: [{ type: 'want', skillId: 's1', proficiencyLevel: 'EXPERT' }, { type: 'offer', skillId: 's2', proficiencyLevel: 'EXPERT' }],
          availabilitySlots: [{ dayOfWeek: 1, slotStart: '1970-01-01T10:00:00Z', slotEnd: '1970-01-01T11:00:00Z' }],
          avgRating: 5
      };
      // skill = 0.915, lb = 0.932
      // hybrid = 0.915 * 0.7 + 0.932 * 0.3 = 0.6405 + 0.2796 = 0.9201
      expect(hybrid.calculateScore(user1, user2)).toBeCloseTo(0.9201);
      
      // Test scoreWithML stub
      const mlScore = await hybrid.scoreWithML(user1, user2);
      expect(mlScore).toBeCloseTo(0.915);
    });

    it('findCandidates delegates to skill strategy', () => {
        const hybrid = new AIHybridStrategy();
        const pool = [];
        const res = hybrid.findCandidates('u1', pool);
        expect(res).toEqual([]);
    });

    it('rankMatches sorts desc', () => {
        const hybrid = new AIHybridStrategy();
        const matches = [{ score: 0.1 }, { score: 0.2 }];
        expect(hybrid.rankMatches(matches)[0].score).toBe(0.2);
    });
  });
});
