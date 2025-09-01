"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayRoutes = getTodayRoutes;
exports.getVisit = getVisit;
exports.saveVisit = saveVisit;
const db_1 = require("./db");
async function getTodayRoutes(_userId) {
    if ((0, db_1.hasDb)()) {
        const res = await (0, db_1.dbQuery)(`select id, client_name, address, scheduled_time from routes_today order by scheduled_time asc`);
        if (res)
            return res.rows.map(r => ({ id: r.id, clientName: r.client_name, address: r.address, scheduledTime: r.scheduled_time }));
    }
    return [
        { id: 101, clientName: 'Acme HQ', address: '123 Main St', scheduledTime: '09:00' },
        { id: 102, clientName: 'Blue Sky Co', address: '456 Oak Ave', scheduledTime: '10:30' },
        { id: 103, clientName: 'Sunset Mall', address: '789 Pine Rd', scheduledTime: '13:15' }
    ];
}
async function getVisit(id) {
    if ((0, db_1.hasDb)()) {
        const visit = await (0, db_1.dbQuery)(`select id, client_name from visits where id = $1`, [id]);
        const items = await (0, db_1.dbQuery)(`select key, label, done from visit_checklist where visit_id = $1 order by key asc`, [id]);
        if (visit && visit.rows[0]) {
            return { id, clientName: visit.rows[0].client_name, checklist: items?.rows ?? [] };
        }
    }
    const clientName = id === 101 ? 'Acme HQ' : id === 102 ? 'Blue Sky Co' : 'Sunset Mall';
    return {
        id,
        clientName,
        checklist: [
            { key: 'watered', label: 'Watered plants', done: false },
            { key: 'pruned', label: 'Pruned and cleaned', done: false },
            { key: 'replaced', label: 'Replaced unhealthy plants', done: false }
        ]
    };
}
async function saveVisit(id, notes, checklist) {
    if ((0, db_1.hasDb)()) {
        await (0, db_1.dbQuery)(`insert into visit_submissions (visit_id, notes, payload, created_at) values ($1, $2, $3, now())`, [id, notes ?? null, JSON.stringify(checklist)]);
        return { ok: true };
    }
    return { ok: true };
}
