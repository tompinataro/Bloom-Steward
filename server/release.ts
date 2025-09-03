import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('No DATABASE_URL set; skipping DB setup.');
    return;
  }
  const pool = new Pool({
    connectionString: url,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
  });
  try {
    const sqlDir = join(__dirname, 'sql');
    const schemaPath = join(sqlDir, 'schema.sql');
    const seedPath = join(sqlDir, 'seed.sql');
    if (!existsSync(schemaPath) || !existsSync(seedPath)) {
      console.log('SQL files not found in dist; skipping DB setup.');
      return;
    }
    const schema = readFileSync(schemaPath, 'utf8');
    const seed = readFileSync(seedPath, 'utf8');
    await pool.query(schema);
    await pool.query(seed);
    console.log('DB schema + seed applied');
  } finally {
    await pool.end();
  }
}

run().catch((e) => {
  console.error('Release script failed:', e);
  process.exit(1);
});
