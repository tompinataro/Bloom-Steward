import { Pool } from 'pg';

let pool: Pool | null = null;

const connStr = process.env.DATABASE_URL;
if (connStr) {
  pool = new Pool({ connectionString: connStr, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined });
}

export async function dbQuery<T = any>(text: string, params?: any[]): Promise<{ rows: T[] } | null> {
  if (!pool) return null;
  const res = await pool.query(text, params);
  return { rows: res.rows as T[] };
}

export function hasDb() {
  return !!pool;
}

