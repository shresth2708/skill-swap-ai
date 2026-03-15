const prisma = require('../../config/db.config');
const analyticsRepository = require('../../repositories/analytics.repository');

jest.mock('../../config/db.config', () => ({
  match: {
    aggregate: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
}));

describe('AnalyticsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getAverageMatchScore hits aggregate', async () => {
    prisma.match.aggregate.mockResolvedValue({ _avg: { compatibilityScore: 0.85 } });
    const res = await analyticsRepository.getAverageMatchScore();
    expect(res).toBe(0.85);
  });

  it('getAcceptanceRate handles zero total', async () => {
    prisma.match.count.mockResolvedValue(0);
    const res = await analyticsRepository.getAcceptanceRate();
    expect(res).toBe(0);
  });

  it('getAcceptanceRate calculates ratio', async () => {
    prisma.match.count.mockImplementation((args = {}) => {
      const { where } = args;
      if (where) return 5; // accepted
      return 10; // total
    });
    const res = await analyticsRepository.getAcceptanceRate();
    expect(res).toBe(0.5);
  });

  describe('getTopMatchedSkills', () => {
    it('aggregates sharedInterests frequency', async () => {
      prisma.match.findMany.mockResolvedValue([
        { sharedInterests: ['NodeJS', 'React'] },
        { sharedInterests: ['NodeJS'] }
      ]);
      const res = await analyticsRepository.getTopMatchedSkills();
      expect(res[0].skill).toBe('NodeJS');
      expect(res[0].count).toBe(2);
      expect(res[1].skill).toBe('React');
    });

    it('handles null sharedInterests', async () => {
      prisma.match.findMany.mockResolvedValue([
        { sharedInterests: null }
      ]);
      const res = await analyticsRepository.getTopMatchedSkills();
      expect(res).toHaveLength(0);
    });
  });

  describe('getMatchesByDay', () => {
    it('groups matches by date', async () => {
      prisma.match.findMany.mockResolvedValue([
        { matchedAt: '2026-05-04T10:00:00Z' },
        { matchedAt: '2026-05-04T12:00:00Z' },
        { matchedAt: '2026-05-05T10:00:00Z' }
      ]);
      const res = await analyticsRepository.getMatchesByDay(7);
      expect(res).toHaveLength(2);
      expect(res[0].date).toBe('2026-05-04');
      expect(res[0].count).toBe(2);
      expect(res[1].date).toBe('2026-05-05');
      expect(res[1].count).toBe(1);
    });
  });
});
