"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbQuery = dbQuery;
exports.hasDb = hasDb;
const pg_1 = require("pg");
let pool = null;
const connStr = process.env.DATABASE_URL;
if (connStr) {
    const useSSL = (() => {
        try {
            const u = new URL(connStr);
            return process.env.PGSSLMODE === 'require' || process.env.NODE_ENV === 'production' || /amazonaws\.com$/.test(u.hostname);
        }
        catch {
            return true;
        }
    })();
    pool = new pg_1.Pool({ connectionString: connStr, ssl: useSSL ? { rejectUnauthorized: false } : undefined });
}
async function dbQuery(text, params) {
    if (!pool)
        return null;
    const res = await pool.query(text, params);
    return { rows: res.rows };
}
function hasDb() {
    return !!pool;
}
