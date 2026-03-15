const SkillBasedStrategy = require('../strategies/skill-based.strategy');
const LocationBasedStrategy = require('../strategies/location-based.strategy');

describe('Matching Strategies', () => {
  let skillStrategy;
  let locationStrategy;

  beforeEach(() => {
    skillStrategy = new SkillBasedStrategy();
    locationStrategy = new LocationBasedStrategy();
  });

  const generateMockUser = (id, skills = [], slots = [], profile = {}) => ({
    id,
    avgRating: 4.0,
    skills,
    availabilitySlots: slots,
    profile: {
      latitude: '0',
      longitude: '0',
      ...profile
    }
  });

  describe('SkillBasedStrategy', () => {
    it('should filter candidate pool, keeping users who have any skills listed', () => {
      const validCandidate = generateMockUser('cand1', [
        { skillId: 's1', type: 'offer' }
      ]);
      const invalidCandidate = generateMockUser('cand2', []); // Empty skills

      const pool = [validCandidate, invalidCandidate];

      const filtered = skillStrategy.findCandidates('seeker', pool);
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('cand1');
    });

    it('should prefer complementary want/offer with seeker when provided', () => {
      const seeker = generateMockUser('seeker', [
        { skillId: 'a', type: 'want' },
        { skillId: 'b', type: 'offer' },
      ]);
      const good = generateMockUser('good', [
        { skillId: 'a', type: 'offer' },
      ]);
      const irrelevant = generateMockUser('irrelevant', [
        { skillId: 'x', type: 'offer' },
        { skillId: 'y', type: 'want' },
      ]);
      const pool = [good, irrelevant];
      const filtered = skillStrategy.findCandidates('seeker', pool, seeker);
      expect(filtered.map((c) => c.id)).toContain('good');
    });

    it('should calculate skill overlap and proficiency bonus', () => {
      // Seeker wants s1, offers s2
      const user1 = generateMockUser('u1', [
        { skillId: 's1', type: 'want' },
        { skillId: 's2', type: 'offer', proficiencyLevel: 'EXPERT' }
      ]);
      // Candidate offers s1 (ADVANCED), wants s2
      const user2 = generateMockUser('u2', [
        { skillId: 's1', type: 'offer', proficiencyLevel: 'ADVANCED' },
        { skillId: 's2', type: 'want' }
      ]);

      const score = skillStrategy.calculateScore(user1, user2);
      
      // Expected logic:
      // skillOverlapScore: u1 wants s1, u2 offers s1 -> 1 / 1 = 1.0 (weight 0.35)
      // reverseScore: u2 wants s2, u1 offers s2 -> 1 / 1 = 1.0 (weight 0.35)
      // proficiencyBonus: cand offers s1 at ADVANCED (0.75) -> 0.75 (weight 0.10)
      // availabilityScore: 0 overlap -> 0 (weight 0.10)
      // ratingWeight (u2 rating=4.0): (4.0/5.0)*0.15 = 0.12 (weight 0.10 applied inside? Wait, the formula inside calculates ratingWeight as (rating/5)*0.15 directly, then applied as *0.10)
      // Actually code says: finalScore = overlap*0.35 + reverse*0.35 + prof*0.1 + avail*0.1 + ratingWeight*0.1
      // Overlap: 0.35 + 0.35 = 0.70
      // Prof: 0.75 * 0.10 = 0.075
      // Rating weight: ((4.0 / 5.0) * 0.15) * 0.10 = 0.12 * 0.10 = 0.012
      // Total approx: 0.7 + 0.075 + 0.0 + 0.012 = 0.787
      
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThan(0.8); // 0.787
    });
  });

  describe('LocationBasedStrategy', () => {
    it('should incorporate geographic distance into the combined score', () => {
      const user1 = generateMockUser('u1', [], [], { latitude: '34.0522', longitude: '-118.2437' }); // LA
      const user2 = generateMockUser('u2', [], [], { latitude: '36.1699', longitude: '-115.1398' }); // Vegas (~360km)

      const score = locationStrategy.calculateScore(user1, user2);
      
      // LA to Vegas is ~360km, inside the 500km threshold
      // Score = proximityScore * 0.20 + skillScore * 0.80
      // Proximity = 1 - (360/500) = 1 - 0.72 = 0.28
      // Final proximity impact = 0.28 * 0.20 = 0.056
      // Skill score is basically just rating weight for empty skills ~ 0.012
      // Skill impact = 0.012 * 0.8 = 0.0096
      // Total approx: 0.056 + 0.0096 = 0.065
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.2);
    });

    it('should fallback to purely skill score if coordinates are missing', () => {
      const user1 = generateMockUser('u1');
      const user2 = generateMockUser('u2', [], [], { latitude: null, longitude: null }); // Missing coords
      
      const skillScore = locationStrategy._skillStrategy.calculateScore(user1, user2);
      const locScore = locationStrategy.calculateScore(user1, user2);
      
      expect(locScore).toBe(skillScore);
    });
  });
});
