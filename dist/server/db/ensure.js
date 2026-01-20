"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureManagedPasswordColumn = ensureManagedPasswordColumn;
const db_1 = require("../db");
async function ensureManagedPasswordColumn() {
    if (!(0, db_1.hasDb)())
        return;
    await (0, db_1.dbQuery)('alter table users add column if not exists managed_password text');
}
