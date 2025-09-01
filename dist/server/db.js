"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbQuery = dbQuery;
exports.hasDb = hasDb;
const pg_1 = require("pg");
let pool = null;
const connStr = process.env.DATABASE_URL;
if (connStr) {
    pool = new pg_1.Pool({ connectionString: connStr, ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined });
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
