const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
(async () => {
  const raw = fs.readFileSync(process.argv[2], 'utf8');
  console.log('Applying:', process.argv[2]);
  // Strip line comments, split on semicolons at end of line, drop empties.
  const cleaned = raw
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
  const stmts = cleaned
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s);
  try {
    for (const stmt of stmts) {
      console.log('  >', stmt.split('\n')[0].slice(0, 80));
      await p.$executeRawUnsafe(stmt);
    }
    console.log('OK (' + stmts.length + ' statements)');
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await p.$disconnect();
  }
})();
