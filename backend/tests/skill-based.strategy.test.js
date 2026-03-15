const SkillBasedStrategy = require('../strategies/skill-based.strategy');

describe('SkillBasedStrategy', () => {
  let strategy;

  beforeEach(() => {
    strategy = new SkillBasedStrategy();
  });

  const createUser = (id, skills = [], availabilitySlots = [], avgRating = 0) => ({
    id,
    skills,
    availabilitySlots,
    avgRating
  });

  const createSkill = (type, skillId, proficiencyLevel = 'BEGINNER') => ({
    type,
    skillId,
    proficiencyLevel
  });

  const createSlot = (dayOfWeek, slotStart, slotEnd) => ({
    dayOfWeek,
    slotStart: new Date(`1970-01-01T${slotStart}Z`),
    slotEnd: new Date(`1970-01-01T${slotEnd}Z`)
  });

  describe('calculateScore', () => {
    it('calculates score with known inputs (perfect match)', () => {
      const user1 = createUser('u1', [createSkill('want', 's1')], [createSlot('Monday', '09:00', '11:00')], 5.0);
      const user2 = createUser('u2', [createSkill('offer', 's1', 'EXPERT'), createSkill('want', 's2')], [createSlot('Monday', '10:00', '12:00')], 5.0);
      
      // user1 wants s1, user2 offers s1 (EXPERT)
      // score calculation:
      // skillOverlap (u1 -> u2) = 1.0 (s1)
      // reverseScore (u2 -> u1) = 0.0 (u2 wants s2, u1 doesn't offer)
      // proficiencyBonus = 1.0 (EXPERT)
      // availabilityOverlap = 1.0 (overlapping slots)
      // ratingWeight = 5.0 -> 0.15
      // Final = (1.0 * 0.35) + (0 * 0.35) + (1.0 * 0.1) + (1.0 * 0.1) + (0.15 * 0.1)
      // Final = 0.35 + 0 + 0.1 + 0.1 + 0.015 = 0.565
      
      const score = strategy.calculateScore(user1, user2);
      expect(score).toBeCloseTo(0.565, 3);
    });

    it('returns score = 0 for zero skill overlap (with zero rating)', () => {
      const user1 = createUser('u1', [createSkill('want', 's1')]);
      const user2 = createUser('u2', [createSkill('offer', 's2')]);
      const score = strategy.calculateScore(user1, user2);
      expect(score).toBe(0);
    });

    it('score approaches 1.0 for full overlap (both directions + EXPERT + full availability + max rating)', () => {
      const user1 = createUser('u1', [createSkill('want', 's1'), createSkill('offer', 's2', 'EXPERT')], [createSlot('Monday', '09:00', '11:00')], 5.0);
      const user2 = createUser('u2', [createSkill('want', 's2'), createSkill('offer', 's1', 'EXPERT')], [createSlot('Monday', '09:00', '11:00')], 5.0);

      // skillOverlap = 1.0, reverse = 1.0, prof = 1.0, avail = 1.0, rating = 0.15 -> 0.35 + 0.35 + 0.10 + 0.10 + 0.015 = 0.915
      const score = strategy.calculateScore(user1, user2);
      expect(score).toBeGreaterThan(0.9);
    });

    it('availabilityScore = 0 for no availability overlap', () => {
      const user1 = createUser('u1', [createSkill('want', 's1')], [createSlot('Monday', '09:00', '11:00')]);
      const user2 = createUser('u2', [createSkill('offer', 's1')], [createSlot('Tuesday', '09:00', '11:00')]);
      
      const breakdown = strategy.calculateScoreBreakdown(user1, user2);
      expect(breakdown.availabilityScore).toBe(0);
    });

    it('availabilityScore = 1.0 for full availability overlap', () => {
      const user1 = createUser('u1', [createSkill('want', 's1')], [createSlot('Monday', '09:00', '11:00')]);
      const user2 = createUser('u2', [createSkill('offer', 's1')], [createSlot('Monday', '09:00', '11:00')]);
      
      const breakdown = strategy.calculateScoreBreakdown(user1, user2);
      expect(breakdown.availabilityScore).toBe(1.0);
    });

    it('score = 0 + rating for empty skills array', () => {
      const user1 = createUser('u1', []);
      const user2 = createUser('u2', [createSkill('offer', 's1')], [], 5.0);
      
      const score = strategy.calculateScore(user1, user2);
      expect(score).toBeCloseTo(0.015, 3);
    });
  });
});