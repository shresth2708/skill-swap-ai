const MatchingService = require('../services/matching.service');
const StrategyFactory = require('../factories/strategy.factory');
const { sendSuccess } = require('../utils/response.util');

/**
 * Controller for the matching engine endpoints.
 * Creates a fresh MatchingService per request with the selected strategy.
 *
 * Strategy selection via query param:
 *   ?strategy=skill     → SkillBasedStrategy (default)
 *   ?strategy=location  → LocationBasedStrategy
 *   ?strategy=hybrid    → AIHybridStrategy
 */
class MatchingController {
  /**
   * GET /api/matches
   * Query params: ?strategy=skill|location|hybrid&page=1&limit=20
   *
   * Response shape:
   * {
   *   success: true,
   *   data: {
   *     matches: [...],
   *     pagination: { page, limit, total },
   *     meta: { strategy, computedAt, cached }
   *   }
   * }
   */
  async findMatches(req, res, next) {
    try {
      const strategyName = req.query.strategy || 'skill';
      const strategy = StrategyFactory.create(strategyName);

      const service = new MatchingService(strategy);

      const results = await service.findMatches(req.user.id, {
        page: req.query.page,
        limit: req.query.limit,
      });

      return sendSuccess(res, 200, 'Matches retrieved successfully', results);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/matches/stats
   * Dashboard match statistics for the authenticated user.
   *
   * Response: { totalMatches, acceptedMatches, declinedMatches }
   */
  async getMatchStats(req, res, next) {
    try {
      const service = new MatchingService();
      const stats = await service.getMatchStats(req.user.id);

      return sendSuccess(res, 200, 'Match stats retrieved successfully', stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/matches/:id
   */
  async getMatchById(req, res, next) {
    try {
      const service = new MatchingService();
      const match = await service.getMatchById(req.params.id);

      // Ensure the requesting user is part of the match
      if (match.userId1 !== req.user.id && match.userId2 !== req.user.id) {
        const error = new Error('Forbidden: you are not part of this match');
        error.statusCode = 403;
        error.errorCode = 'FORBIDDEN';
        throw error;
      }

      return sendSuccess(res, 200, 'Match retrieved successfully', match);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/matches/:matchId/explain
   * Uses the match record's strategy by default so the breakdown matches how the pair was scored.
   */
  async explainMatch(req, res, next) {
    try {
      const baseService = new MatchingService();
      const match = await baseService.getMatchById(req.params.matchId);

      if (match.userId1 !== req.user.id && match.userId2 !== req.user.id) {
        const err = new Error('Forbidden: you are not part of this match');
        err.statusCode = 403;
        err.errorCode = 'FORBIDDEN';
        throw err;
      }

      const classToKey = {
        SkillBasedStrategy: 'skill',
        LocationBasedStrategy: 'location',
        AIHybridStrategy: 'hybrid',
      };
      const strategyKey = req.query.strategy || classToKey[match.strategyUsed] || 'skill';
      const strategy = StrategyFactory.create(strategyKey);
      const service = new MatchingService(strategy);

      const breakdown = await service.explainMatch(req.params.matchId);
      return sendSuccess(res, 200, 'Score breakdown generated', breakdown);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/matches/:id/accept
   */
  async acceptMatch(req, res, next) {
    try {
      const service = new MatchingService();
      const result = await service.acceptMatch(req.params.id, req.user.id);
      return sendSuccess(res, 200, 'Match accepted successfully', result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/matches/:id/decline
   */
  async declineMatch(req, res, next) {
    try {
      const service = new MatchingService();
      const result = await service.declineMatch(req.params.id, req.user.id);
      return sendSuccess(res, 200, 'Match declined successfully', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new MatchingController();
