import { readFileSync } from 'fs';
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
    const schema = readFileSync(join(__dirname, 'sql', 'schema.sql'), 'utf8');
    const seed = readFileSync(join(__dirname, 'sql', 'seed.sql'), 'utf8');
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

