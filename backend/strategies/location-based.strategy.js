const MatchingStrategy = require('./matching.strategy.interface');
const SkillBasedStrategy = require('./skill-based.strategy');

/**
 * Maximum distance (km) used for normalization.
 * Distances beyond this are treated as the maximum penalty.
 */
const MAX_DISTANCE_KM = 500;

/**
 * Earth's mean radius in kilometres (for the Haversine formula).
 */
const EARTH_RADIUS_KM = 6371;

/**
 * Concrete strategy: Location-Based Matching
 * 
 * Augments skill-based scoring with geographic proximity.
 * 
 * Score = (1 - normalizedDistance) × 0.20 + skillScore × 0.80
 * 
 * Falls back to pure skill score when either user lacks coordinates.
 */
class LocationBasedStrategy extends MatchingStrategy {
  constructor() {
    super();
    /** @private */
    this._skillStrategy = new SkillBasedStrategy();
  }

  /**
   * Calculate combined skill + location score.
   * @param {Object} user1 - Seeking user (includes profile.latitude/longitude)
   * @param {Object} user2 - Candidate user
   * @returns {number} Score between 0.0 and 1.0
   */
  calculateScore(user1, user2) {
    const skillScore = this._skillStrategy.calculateScore(user1, user2);

    const coords1 = this._getCoordinates(user1);
    const coords2 = this._getCoordinates(user2);

    // If either user is missing geolocation, fall back to skill-only
    if (!coords1 || !coords2) {
      return skillScore;
    }

    const distance = this._haversine(coords1, coords2);
    const normalizedDistance = Math.min(distance / MAX_DISTANCE_KM, 1.0);
    const proximityScore = 1 - normalizedDistance;

    return proximityScore * 0.20 + skillScore * 0.80;
  }

  /**
   * Pre-filter candidates: delegates to SkillBasedStrategy's filter,
   * then optionally removes candidates beyond MAX_DISTANCE_KM.
   */
  findCandidates(userId, pool, seeker = null) {
    return this._skillStrategy.findCandidates(userId, pool, seeker);
  }

  /**
   * Rank matches by score descending.
   */
  rankMatches(matches) {
    return [...matches].sort((a, b) => b.score - a.score);
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Extract lat/lng from a user's profile.
   * @returns {{ lat: number, lng: number } | null}
   */
  _getCoordinates(user) {
    const profile = user.profile;
    if (!profile || profile.latitude == null || profile.longitude == null) {
      return null;
    }
    return {
      lat: parseFloat(profile.latitude),
      lng: parseFloat(profile.longitude),
    };
  }

  /**
   * Haversine formula: calculate great-circle distance between two points.
   * @param {{ lat: number, lng: number }} point1
   * @param {{ lat: number, lng: number }} point2
   * @returns {number} Distance in kilometres
   */
  _haversine(point1, point2) {
    const toRad = (deg) => (deg * Math.PI) / 180;

    const dLat = toRad(point2.lat - point1.lat);
    const dLng = toRad(point2.lng - point1.lng);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(point1.lat)) *
        Math.cos(toRad(point2.lat)) *
        Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }
}

module.exports = LocationBasedStrategy;
