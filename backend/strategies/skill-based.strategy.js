const MatchingStrategy = require('./matching.strategy.interface');

/**
 * Proficiency level → numeric score mapping.
 * Used for calculating proficiency bonus in the scoring formula.
 */
const PROFICIENCY_SCORES = {
  EXPERT: 1.0,
  ADVANCED: 0.75,
  INTERMEDIATE: 0.5,
  BEGINNER: 0.25,
};

/**
 * Concrete strategy: Skill-Based Matching
 * 
 * Scores users based on skill overlap, proficiency levels,
 * schedule availability, and community rating.
 * 
 * FINAL = (skillOverlapScore × 0.35) + (reverseScore × 0.35)
 *       + (proficiencyBonus × 0.10)  + (availabilityScore × 0.10)
 *       + (ratingWeight × 0.10)
 */
class SkillBasedStrategy extends MatchingStrategy {
  /**
   * Calculate compatibility score between two users.
   * @param {Object} user1 - User seeking matches (includes skills, availabilitySlots, avgRating)
   * @param {Object} user2 - Candidate user
   * @returns {number} Score between 0.0 and 1.0
   */
  calculateScore(user1, user2) {
    const skillOverlapScore = this._calculateSkillOverlap(user1, user2);
    const reverseScore = this._calculateSkillOverlap(user2, user1);
    const proficiencyBonus = this._calculateProficiencyBonus(user1, user2);
    const availabilityScore = this._calculateAvailabilityOverlap(
      user1.availabilitySlots || [],
      user2.availabilitySlots || []
    );
    const ratingWeight = this._calculateRatingWeight(user2);

    const finalScore =
      skillOverlapScore * 0.35 +
      reverseScore * 0.35 +
      proficiencyBonus * 0.10 +
      availabilityScore * 0.10 +
      ratingWeight * 0.10;

    return Math.min(Math.max(finalScore, 0), 1); // Clamp to [0, 1]
  }

  /**
   * Pre-filter: prefer complementary barter (you want what they offer, or they want what you offer).
   * If that would return nobody, fall back to any candidate with at least one offer or want
   * so small pools and early profiles still get suggestions.
   * @param {string} userId
   * @param {Array} pool
   * @param {Object} [seeker] - User row with .skills (from findWithSkillsAndAvailability)
   * @returns {Array}
   */
  findCandidates(userId, pool, seeker = null) {
    const withSkillsOnly = (list) => list.filter((candidate) => {
      if (candidate.id === userId) return false;
      const o = this._getSkillIds(candidate, 'offer');
      const w = this._getSkillIds(candidate, 'want');
      return o.size > 0 || w.size > 0;
    });

    if (!seeker) {
      return withSkillsOnly(pool);
    }

    const complementary = pool.filter((candidate) => {
      if (candidate.id === userId) return false;
      const sw = this._getSkillIds(seeker, 'want');
      const so = this._getSkillIds(seeker, 'offer');
      const cOffers = this._getSkillIds(candidate, 'offer');
      const cWants = this._getSkillIds(candidate, 'want');
      const a = this._intersect(sw, cOffers);
      const b = this._intersect(so, cWants);
      return a.size > 0 || b.size > 0;
    });

    if (complementary.length > 0) {
      return complementary;
    }
    return withSkillsOnly(pool);
  }

  /**
   * Explains the calculation between user1 and user2.
   * @param {Object} user1
   * @param {Object} user2
   */
  calculateScoreBreakdown(user1, user2) {
    const skillOverlapScore = this._calculateSkillOverlap(user1, user2);
    const reverseScore = this._calculateSkillOverlap(user2, user1);
    const proficiencyBonus = this._calculateProficiencyBonus(user1, user2);
    const availabilityScore = this._calculateAvailabilityOverlap(
      user1.availabilitySlots || [],
      user2.availabilitySlots || []
    );
    const ratingWeight = this._calculateRatingWeight(user2);

    const finalScore = Math.min(Math.max(
      skillOverlapScore * 0.35 +
      reverseScore * 0.35 +
      proficiencyBonus * 0.10 +
      availabilityScore * 0.10 +
      ratingWeight * 0.10, 0), 1);

    const user1WantsIds = this._getSkillIds(user1, 'want');
    const user2OffersIds = this._getSkillIds(user2, 'offer');
    
    // Create lookups to names for the result
    // Assuming user skills contain the populated skill object, or we return ID if unavailable.
    // E.g., user1.skills = [{skill: {name: 'React'}, skillId: 'uuid', type:'want'}]
    const getSkillName = (skills, id) => {
      const match = skills.find(s => s.skillId === id);
      return match && match.skill ? match.skill.name : id;
    };
    
    const sharedIds = this._intersect(user1WantsIds, user2OffersIds);
    const missingIds = new Set([...user1WantsIds].filter(x => !sharedIds.has(x)));
    
    const skills1 = user1.skills || [];
    const sharedSkills = Array.from(sharedIds).map(id => getSkillName(skills1, id));
    const missingSkills = Array.from(missingIds).map(id => getSkillName(skills1, id));

    const commonSlots = this._findCommonSlots(user1.availabilitySlots || [], user2.availabilitySlots || []);

    return {
      skillOverlapScore: parseFloat(skillOverlapScore.toFixed(4)),
      reverseScore: parseFloat(reverseScore.toFixed(4)),
      proficiencyBonus: parseFloat(proficiencyBonus.toFixed(4)),
      availabilityScore: parseFloat(availabilityScore.toFixed(4)),
      ratingWeight: parseFloat(ratingWeight.toFixed(4)),
      finalScore: parseFloat(finalScore.toFixed(4)),
      sharedSkills,
      missingSkills,
      commonSlots
    };
  }

  /**
   * Find common slots between two users
   */
  _findCommonSlots(slots1, slots2) {
    if (slots1.length === 0 || slots2.length === 0) return [];
    
    const common = [];
    for (const s1 of slots1) {
      for (const s2 of slots2) {
        if (s1.dayOfWeek === s2.dayOfWeek) {
          const s1Start = this._timeToMinutes(s1.slotStart);
          const s1End = this._timeToMinutes(s1.slotEnd);
          const s2Start = this._timeToMinutes(s2.slotStart);
          const s2End = this._timeToMinutes(s2.slotEnd);

          if (s1Start < s2End && s2Start < s1End) {
            // Found overlap
            const startOverlap = Math.max(s1Start, s2Start);
            const endOverlap = Math.min(s1End, s2End);
            
            const formatTime = (mins) => {
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              const ampm = h >= 12 ? 'pm' : 'am';
              const h12 = h % 12 || 12;
              return `${h12}${m > 0 ? ':'+m.toString().padStart(2, '0') : ''}${ampm}`;
            };
            
            common.push({
              day: s1.dayOfWeek,
              time: `${formatTime(startOverlap)}-${formatTime(endOverlap)}`
            });
          }
        }
      }
    }
    return common;
  }

  /**
   * Rank matches by score descending (best first).
   * @param {Array<{user: Object, score: number}>} matches
   * @returns {Array<{user: Object, score: number}>} Sorted matches
   */
  rankMatches(matches) {
    return [...matches].sort((a, b) => b.score - a.score);
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Computes |seekerWants ∩ candidateOffers| / max(|seekerWants|, 1)
   * Direction: what does the seeker want that the candidate offers?
   */
  _calculateSkillOverlap(seeker, candidate) {
    const seekerWants = this._getSkillIds(seeker, 'want');
    const candidateOffers = this._getSkillIds(candidate, 'offer');
    const intersection = this._intersect(seekerWants, candidateOffers);

    return intersection.size / Math.max(seekerWants.size, 1);
  }

  /**
   * Average proficiency score of the overlapping skills between two users.
   * Considers the offered skills' proficiency levels.
   */
  _calculateProficiencyBonus(user1, user2) {
    const user1Wants = this._getSkillIds(user1, 'want');
    const user2Offers = this._getSkillMap(user2, 'offer'); // skillId → proficiency

    let totalScore = 0;
    let matchCount = 0;

    for (const skillId of user1Wants) {
      if (user2Offers.has(skillId)) {
        const level = user2Offers.get(skillId);
        totalScore += PROFICIENCY_SCORES[level] || 0;
        matchCount++;
      }
    }

    return matchCount > 0 ? totalScore / matchCount : 0;
  }

  /**
   * Calculate time-slot overlap between two users.
   * Matches slots that share the same dayOfWeek and have overlapping time ranges.
   * @returns {number} Overlap ratio between 0.0 and 1.0
   */
  _calculateAvailabilityOverlap(slots1, slots2) {
    if (slots1.length === 0 || slots2.length === 0) return 0;

    let overlappingSlots = 0;

    for (const s1 of slots1) {
      for (const s2 of slots2) {
        if (s1.dayOfWeek === s2.dayOfWeek) {
          // Compare time portions — slotStart/slotEnd are stored as DateTime @db.Time
          const s1Start = this._timeToMinutes(s1.slotStart);
          const s1End = this._timeToMinutes(s1.slotEnd);
          const s2Start = this._timeToMinutes(s2.slotStart);
          const s2End = this._timeToMinutes(s2.slotEnd);

          // Check for any overlap
          if (s1Start < s2End && s2Start < s1End) {
            overlappingSlots++;
            break; // Count each of user1's slots at most once
          }
        }
      }
    }

    return overlappingSlots / Math.max(slots1.length, 1);
  }

  /**
   * Rating weight: (avgRating / 5.0) * 0.15
   * The 0.15 multiplier is part of the formula spec; the final weight of 0.10
   * is applied in calculateScore().
   */
  _calculateRatingWeight(user) {
    const rating = parseFloat(user.avgRating) || 0;
    return (rating / 5.0) * 0.15;
  }

  /**
   * Extract skill IDs of a given type ('offer' or 'want') as a Set.
   */
  _getSkillIds(user, type) {
    const skills = (user.skills || []).filter((us) => us.type === type);
    return new Set(skills.map((us) => us.skillId));
  }

  /**
   * Extract skill IDs → proficiency level map for a given type.
   */
  _getSkillMap(user, type) {
    const skills = (user.skills || []).filter((us) => us.type === type);
    const map = new Map();
    for (const us of skills) {
      map.set(us.skillId, us.proficiencyLevel);
    }
    return map;
  }

  /**
   * Set intersection helper.
   */
  _intersect(setA, setB) {
    const result = new Set();
    for (const item of setA) {
      if (setB.has(item)) result.add(item);
    }
    return result;
  }

  /**
   * Convert a DateTime (stored as @db.Time) to minutes since midnight.
   * Handles both Date objects and ISO strings.
   */
  _timeToMinutes(dateTimeOrString) {
    const d = new Date(dateTimeOrString);
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}

module.exports = SkillBasedStrategy;
