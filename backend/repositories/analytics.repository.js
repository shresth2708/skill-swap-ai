const prisma = require('../config/db.config');

class AnalyticsRepository {
  async getAverageMatchScore() {
    const result = await prisma.match.aggregate({
      _avg: { compatibilityScore: true },
    });
    return result._avg.compatibilityScore || 0;
  }

  async getAcceptanceRate() {
    const total = await prisma.match.count();
    if (total === 0) return 0;
    const accepted = await prisma.match.count({
      where: { status: 'accepted' },
    });
    return accepted / total;
  }

  async getTopMatchedSkills(limit = 5) {
    const matches = await prisma.match.findMany({
      select: { sharedInterests: true },
      where: { sharedInterests: { not: null } },
    });

    const frequency = {};
    matches.forEach(m => {
      const skills = m.sharedInterests || [];
      skills.forEach(s => {
        frequency[s] = (frequency[s] || 0) + 1;
      });
    });

    return Object.entries(frequency)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async getMatchesByDay(daysBack = 7) {
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    const matches = await prisma.match.findMany({
      where: { matchedAt: { gte: since } },
      select: { matchedAt: true },
    });

    const grouped = {};
    matches.forEach(m => {
      const d = new Date(m.matchedAt).toISOString().split('T')[0];
      grouped[d] = (grouped[d] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}

module.exports = new AnalyticsRepository();