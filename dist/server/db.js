"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbQuery = dbQuery;
exports.hasDb = hasDb;
const pg_1 = require("pg");
const config_1 = require("./config");
let pool = null;
const connStr = config_1.DATABASE_URL;
if (connStr && config_1.NODE_ENV !== 'test') {
    const useSSL = (() => {
        try {
            const u = new URL(connStr);
            return config_1.PGSSLMODE === 'require' || config_1.NODE_ENV === 'production' || /amazonaws\.com$/.test(u.hostname);
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
