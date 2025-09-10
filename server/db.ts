import { Pool } from 'pg';

let pool: Pool | null = null;

const connStr = process.env.DATABASE_URL;
if (connStr) {
  const useSSL = (() => {
    try {
      const u = new URL(connStr);
      return process.env.PGSSLMODE === 'require' || process.env.NODE_ENV === 'production' || /amazonaws\.com$/.test(u.hostname);
    } catch {
      return true;
    }
  })();
  pool = new Pool({ connectionString: connStr, ssl: useSSL ? { rejectUnauthorized: false } : undefined });
}

export async function dbQuery<T = any>(text: string, params?: any[]): Promise<{ rows: T[] } | null> {
  if (!pool) return null;
  const res = await pool.query(text, params);
  return { rows: res.rows as T[] };
}

export function hasDb() {
  return !!pool;
}
