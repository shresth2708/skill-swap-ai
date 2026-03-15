/**
 * One-off: close match rows that still look "active" but their swap is already terminal.
 * Run: node scripts/backfill-fulfilled-matches.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const prisma = require('../config/db.config');

async function main() {
  const terminals = await prisma.swap.findMany({
    where: { status: { in: ['COMPLETED', 'CANCELLED', 'EXPIRED'] } },
    select: { matchId: true },
  });
  const ids = [...new Set(terminals.map((s) => s.matchId).filter(Boolean))];
  if (ids.length === 0) {
    console.log('No terminal swaps; nothing to do.');
    return;
  }
  const res = await prisma.match.updateMany({
    where: { id: { in: ids }, isActive: true },
    data: { status: 'fulfilled', isActive: false },
  });
  console.log(`Updated ${res.count} match row(s) to fulfilled.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
