const request = require('supertest');
const app = require('../app');
const { verifyToken } = require('../utils/jwt.util');
const prisma = require('../config/db.config');

require('dotenv').config();

// Mock auth middleware so we don't have to generate real tokens
jest.mock('../utils/jwt.util', () => ({
  verifyToken: jest.fn(),
  generateToken: jest.fn(),
  generateRefreshToken: jest.fn()
}));

// Mock cache to avoid needing real Redis
jest.mock('../cache/redis.client', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  invalidatePattern: jest.fn().mockResolvedValue('OK')
}));

const shouldRunIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';

(shouldRunIntegration ? describe : describe.skip)('AI Hybrid Matching Integration', () => {
  let userA, userB, userC;
  
  beforeAll(async () => {
    // Note: To run this against a real test database, ensure prisma is connected 
    // to a test DB as defined in jest.setup.js. We clean up before we run.
    await prisma.match.deleteMany();
    await prisma.userSkill.deleteMany();
    await prisma.skill.deleteMany();
    await prisma.user.deleteMany();

    // 1. Create common skills
    const reactSkill = await prisma.skill.create({ data: { name: 'React', category: 'Frontend' } });
    const nodeSkill = await prisma.skill.create({ data: { name: 'Node.js', category: 'Backend' } });
    const pythonSkill = await prisma.skill.create({ data: { name: 'Python', category: 'Backend' } });

    // 2. Create User A (Wants to learn React, can teach Node.js)
    userA = await prisma.user.create({
      data: {
        email: 'usera@test.com',
        passwordHash: 'hashed',
        profile: { create: { displayName: 'User A', latitude: 40.7128, longitude: -74.0060 } },
        skills: {
          create: [
            { skillId: reactSkill.id, proficiencyLevel: 'BEGINNER', isTeaching: false, isLearning: true },
            { skillId: nodeSkill.id, proficiencyLevel: 'EXPERT', isTeaching: true, isLearning: false }
          ]
        }
      }
    });

    // 3. Create User B (Perfect Match: Can teach React, wants to learn Node.js, close location)
    userB = await prisma.user.create({
      data: {
        email: 'userb@test.com',
        passwordHash: 'hashed',
        profile: { create: { displayName: 'User B', latitude: 40.7300, longitude: -73.9900 } }, // ~2.5km away
        skills: {
          create: [
            { skillId: reactSkill.id, proficiencyLevel: 'EXPERT', isTeaching: true, isLearning: false },
            { skillId: nodeSkill.id, proficiencyLevel: 'BEGINNER', isTeaching: false, isLearning: true }
          ]
        }
      }
    });

    // 4. Create User C (Poor Match: Unrelated skills, far away)
    userC = await prisma.user.create({
      data: {
        email: 'userc@test.com',
        passwordHash: 'hashed',
        profile: { create: { displayName: 'User C', latitude: 34.0522, longitude: -118.2437 } }, // ~3900km away
        skills: {
          create: [
            { skillId: pythonSkill.id, proficiencyLevel: 'EXPERT', isTeaching: true, isLearning: false }
          ]
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.match.deleteMany();
    await prisma.userSkill.deleteMany();
    await prisma.skill.deleteMany();
    await prisma.user.deleteMany();
    await prisma.$disconnect();
  });

  it('should return User B as a high match for User A using the hybrid strategy', async () => {
    // Authenticate as User A
    verifyToken.mockReturnValue({ id: userA.id });

    // Call matches endpoint with hybrid strategy
    const response = await request(app)
      .get('/api/matches?strategy=hybrid&limit=10')
      .set('Authorization', 'Bearer fake-token');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    const { matches, meta } = response.body.data;
    
    // Ensure we used the requested strategy
    expect(meta.strategy).toBe('hybrid');
    
    // User B should be a match, User C should likely have a very low score or not be matched
    const matchWithUserB = matches.find(m => m.matchedUserId === userB.id);
    const matchWithUserC = matches.find(m => m.matchedUserId === userC.id);

    expect(matchWithUserB).toBeDefined();
    // With AI Hybrid (0.6 skill + 0.4 location), User B score should be high
    expect(matchWithUserB.compatibilityScore).toBeGreaterThan(0.7);

    if (matchWithUserC) {
      expect(matchWithUserB.compatibilityScore).toBeGreaterThan(matchWithUserC.compatibilityScore);
    }
  });
});
