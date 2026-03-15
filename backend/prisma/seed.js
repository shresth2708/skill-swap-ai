/**
 * Mock / dev seed data for SkillSwap.
 * Run: cd backend && npx prisma db seed
 *
 * Idempotent: if alice@seed.skillswap.local already exists, skips (use migrate reset to re-seed).
 * Login for all seed users: Password123!
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { PrismaClient, SwapStatus, SessionStatus } = require('@prisma/client');
const { hashString } = require('../utils/hash.util');

const prisma = new PrismaClient();
const SEED_PASSWORD = 'Password123!';

const USERS = [
  {
    email: 'alice@seed.skillswap.local',
    displayName: 'Alice (seed)',
    bio: 'Loves full-stack; mock account for local dev.',
    location: 'Austin, TX',
    availability: [
      { dayOfWeek: 1, slotStart: '15:00', slotEnd: '18:00' },
    ],
  },
  {
    email: 'bob@seed.skillswap.local',
    displayName: 'Bob (seed)',
    bio: 'Data + backend; mock account.',
    location: 'Denver, CO',
    availability: [
      { dayOfWeek: 2, slotStart: '14:00', slotEnd: '17:00' },
    ],
  },
  {
    email: 'carol@seed.skillswap.local',
    displayName: 'Carol (seed)',
    bio: 'Design + product; mock account.',
    location: 'Seattle, WA',
  },
  {
    email: 'dan@seed.skillswap.local',
    displayName: 'Dan (seed)',
    bio: 'Product + analytics; mock account.',
    location: 'Chicago, IL',
  },
];

function parseTimeToDate(hhmm) {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

async function ensureCategory(name) {
  return prisma.skillCategory.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

async function ensureSkill(name, categoryId) {
  const existing = await prisma.skill.findFirst({ where: { name, categoryId } });
  if (existing) return existing;
  return prisma.skill.create({
    data: { name, description: `Seed: ${name}`, categoryId },
  });
}

/**
 * @param {typeof USERS[0]} entry
 * @param {Array<{ skillId: string, type: 'offer'|'want', proficiencyLevel: string, description?: string }>} userSkills
 */
async function ensureUserWithSkills(entry, userSkills) {
  const found = await prisma.user.findUnique({
    where: { email: entry.email },
    include: { skills: { include: { skill: true } } },
  });
  if (found) {
    return found;
  }

  const passwordHash = await hashString(SEED_PASSWORD);
  const user = await prisma.user.create({
    data: {
      email: entry.email,
      passwordHash,
      isActive: true,
      isVerified: true,
      trustScore: 0.5,
      profile: {
        create: {
          displayName: entry.displayName,
          bio: entry.bio,
          location: entry.location,
        },
      },
    },
    include: { profile: true },
  });

  for (const us of userSkills) {
    await prisma.userSkill.create({
      data: {
        userId: user.id,
        skillId: us.skillId,
        type: us.type,
        proficiencyLevel: us.proficiencyLevel,
        description: us.description,
      },
    });
  }

  for (const slot of entry.availability || []) {
    await prisma.availabilitySlot.create({
      data: {
        userId: user.id,
        dayOfWeek: slot.dayOfWeek,
        slotStart: parseTimeToDate(slot.slotStart),
        slotEnd: parseTimeToDate(slot.slotEnd),
        isRecurring: true,
      },
    });
  }

  return prisma.user.findUnique({
    where: { id: user.id },
    include: { skills: { include: { skill: true } } },
  });
}

function bySkillName(user, name) {
  const s = user.skills.find((us) => us.skill.name === name);
  if (!s) throw new Error(`User ${user.email} missing skill ${name}`);
  return s;
}

async function main() {
  const marker = await prisma.user.findUnique({
    where: { email: 'alice@seed.skillswap.local' },
  });
  if (marker) {
    console.log('Seed already present (alice@seed.skillswap.local). Skip.');
    console.log('To wipe and re-seed: npx prisma migrate reset');
    return;
  }

  console.log('Seeding mock data…');
  const catProg = await ensureCategory('Programming');
  const catDesign = await ensureCategory('Design');
  const catData = await ensureCategory('Data & Analytics');

  const skJs = await ensureSkill('JavaScript', catProg.id);
  const skPython = await ensureSkill('Python', catProg.id);
  const skFigma = await ensureSkill('Figma', catDesign.id);
  const skSql = await ensureSkill('SQL', catData.id);

  const alice = await ensureUserWithSkills(USERS[0], [
    { skillId: skJs.id, type: 'offer', proficiencyLevel: 'ADVANCED', description: 'Ships production React/Node' },
    { skillId: skPython.id, type: 'want', proficiencyLevel: 'INTERMEDIATE', description: 'Wants to improve Python' },
  ]);
  const bob = await ensureUserWithSkills(USERS[1], [
    { skillId: skPython.id, type: 'offer', proficiencyLevel: 'EXPERT', description: 'Data pipelines & APIs' },
    { skillId: skSql.id, type: 'want', proficiencyLevel: 'BEGINNER', description: 'Wants stronger SQL' },
  ]);
  const carol = await ensureUserWithSkills(USERS[2], [
    { skillId: skFigma.id, type: 'offer', proficiencyLevel: 'EXPERT', description: 'Design systems' },
    { skillId: skJs.id, type: 'want', proficiencyLevel: 'BEGINNER', description: 'Wants to learn JS' },
  ]);
  const dan = await ensureUserWithSkills(USERS[3], [
    { skillId: skSql.id, type: 'offer', proficiencyLevel: 'ADVANCED', description: 'Analytics & BI' },
    { skillId: skFigma.id, type: 'want', proficiencyLevel: 'INTERMEDIATE', description: 'Wants UI polish' },
  ]);

  const inWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const matchAb = await prisma.match.create({
    data: {
      userId1: alice.id,
      userId2: bob.id,
      compatibilityScore: 0.85,
      strategyUsed: 'seed',
      sharedInterests: { seed: true, note: 'Alice ↔ Bob' },
      isActive: true,
      status: 'accepted',
      expiresAt: inWeek,
    },
  });

  const matchCd = await prisma.match.create({
    data: {
      userId1: carol.id,
      userId2: dan.id,
      compatibilityScore: 0.78,
      strategyUsed: 'seed',
      sharedInterests: { seed: true, note: 'Carol ↔ Dan' },
      isActive: true,
      status: 'accepted',
      expiresAt: inWeek,
    },
  });

  const pendingSwap = await prisma.swap.create({
    data: {
      matchId: matchAb.id,
      initiatorId: alice.id,
      receiverId: bob.id,
      offeredSkillId: bySkillName(alice, 'JavaScript').id,
      requestedSkillId: bySkillName(bob, 'Python').id,
      status: SwapStatus.PENDING,
      terms: 'One pair-programming session (seed).',
      expiresAt: inWeek,
    },
  });

  const completedAt = new Date();
  const scheduled = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  const completedSwap = await prisma.swap.create({
    data: {
      matchId: matchCd.id,
      initiatorId: carol.id,
      receiverId: dan.id,
      offeredSkillId: bySkillName(carol, 'Figma').id,
      requestedSkillId: bySkillName(dan, 'SQL').id,
      status: SwapStatus.COMPLETED,
      terms: 'Mock completed swap (seed).',
      scheduledAt: scheduled,
      completedAt,
      initiatorConfirmed: true,
      receiverConfirmed: true,
    },
  });

  await prisma.swapSession.create({
    data: {
      swapId: completedSwap.id,
      scheduledAt: scheduled,
      durationMins: 60,
      status: SessionStatus.COMPLETED,
      meetingUrl: 'https://example.com/seed-meeting',
      notes: 'Seed session (completed).',
      completedAt,
    },
  });

  const chat = await prisma.chat.create({
    data: { swapId: completedSwap.id, isActive: true },
  });

  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: carol.id,
      content: 'Thanks for the SQL tips — here is the Figma file link (seed).',
    },
  });
  await prisma.message.create({
    data: {
      chatId: chat.id,
      senderId: dan.id,
      content: 'Appreciate it! Great session.',
    },
  });

  await prisma.review.create({
    data: {
      swapId: completedSwap.id,
      reviewerId: carol.id,
      revieweeId: dan.id,
      rating: 5,
      comment: 'Very clear and practical (seed review).',
      isPublic: true,
    },
  });
  await prisma.review.create({
    data: {
      swapId: completedSwap.id,
      reviewerId: dan.id,
      revieweeId: carol.id,
      rating: 4,
      comment: 'Helpful design feedback (seed).',
      isPublic: true,
    },
  });

  await prisma.notification.create({
    data: {
      userId: alice.id,
      type: 'SWAP_CREATED',
      title: 'New swap request (seed)',
      body: 'Bob has a pending request related to your match.',
      channel: 'inapp',
      isRead: false,
      payload: { swapId: pendingSwap.id },
    },
  });

  await prisma.user.update({
    where: { id: carol.id },
    data: { avgRating: 4.5, totalReviews: 1, totalSwaps: 1 },
  });
  await prisma.user.update({
    where: { id: dan.id },
    data: { avgRating: 4.0, totalReviews: 1, totalSwaps: 1 },
  });

  console.log('Done. Seed users (password for all: Password123!):');
  for (const u of USERS) {
    console.log(`  - ${u.email} — ${u.displayName}`);
  }
  console.log(`  Pending swap: ${pendingSwap.id}`);
  console.log(`  Completed swap (chat+reviews): ${completedSwap.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
