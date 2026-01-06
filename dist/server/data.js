"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayRoutes = getTodayRoutes;
exports.getVisit = getVisit;
exports.saveVisit = saveVisit;
exports.buildReportRows = buildReportRows;
const db_1 = require("./db");
const FALLBACK_ROUTES = [
    { id: 104, clientName: 'Club 9625', address: '1919 CR Blvd NW, Coon Rapids, MN 55433', scheduledTime: '12:30' },
    { id: 105, clientName: 'Palm Vista', address: '1000 Nicollet Mall', scheduledTime: '14:00' },
    { id: 106, clientName: 'Riverwalk Lofts', address: '225 3rd Ave S', scheduledTime: '15:15' },
    { id: 101, clientName: 'Acme HQ', address: '761 58th Ave NE, Fridley, MN 55432', scheduledTime: '08:30' },
    { id: 102, clientName: 'Marco Polo, LLC', address: '2017 103rd Lane NW, Coon Rapids, MN 55433', scheduledTime: '09:45' },
    { id: 103, clientName: 'Sunset Mall', address: '789 University Ave NE, Minneapolis, MN 55413', scheduledTime: '11:15' }
];
const DEFAULT_TIME_SLOTS = ['08:00', '09:15', '10:30', '11:45', '13:00', '14:15', '15:30'];
function fallbackTimeFor(order) {
    const idx = Math.max(order - 1, 0) % DEFAULT_TIME_SLOTS.length;
    return DEFAULT_TIME_SLOTS[idx];
}
async function ensureVisitForClient(clientId, scheduledTime) {
    const existing = await (0, db_1.dbQuery)(`select id, scheduled_time from visits where client_id = $1 order by id desc limit 1`, [clientId]);
    if (existing?.rows?.[0]) {
        return existing.rows[0];
    }
    const created = await (0, db_1.dbQuery)(`insert into visits (client_id, scheduled_time) values ($1, $2) returning id, scheduled_time`, [clientId, scheduledTime]);
    return created?.rows?.[0] || { id: clientId, scheduled_time: scheduledTime };
}
function normalizeKey(route) {
    const name = (route.clientName || '').trim().toLowerCase();
    const address = (route.address || '').trim().toLowerCase();
    const time = route.scheduledTime || '';
    return `${name}__${address}__${time}`;
}
function dedupeById(routes) {
    const map = new Map();
    for (const route of routes) {
        if (!map.has(route.id))
            map.set(route.id, route);
    }
    return Array.from(map.values());
}
function dedupeByKey(routes) {
    const seen = new Set();
    const result = [];
    for (const route of routes) {
        const key = normalizeKey(route);
        if (seen.has(key))
            continue;
        seen.add(key);
        result.push(route);
    }
    return result;
}
function ensureMinimumRoutes(routes, min = 6) {
    if (routes.length >= min)
        return routes;
    const existing = new Set(routes.map(normalizeKey));
    const next = routes.slice();
    for (const fallback of FALLBACK_ROUTES) {
        const key = normalizeKey(fallback);
        if (existing.has(key))
            continue;
        next.push(fallback);
        existing.add(key);
        if (next.length >= min)
            break;
    }
    return next;
}
async function routesFromServiceAssignments(userId) {
    const res = await (0, db_1.dbQuery)(`select
       c.id as client_id,
       c.name as client_name,
       c.address,
       c.created_at,
       row_number() over (order by c.created_at asc, c.id asc) as row_order
     from service_routes sr
     join clients c on c.service_route_id = sr.id
     where sr.user_id = $1
     order by c.created_at asc, c.id asc`, [userId]);
    const rows = res?.rows ?? [];
    if (!rows.length)
        return [];
    return rows.map(row => ({
        id: row.client_id,
        clientName: row.client_name,
        address: row.address,
        scheduledTime: fallbackTimeFor(row.row_order),
    }));
}
async function getTodayRoutes(userId) {
    if ((0, db_1.hasDb)()) {
        const res = await (0, db_1.dbQuery)(`select v.id as visit_id, c.name as client_name, c.address, rt.scheduled_time
       from routes_today rt
       join clients c on c.id = rt.client_id
       join lateral (
         select id, scheduled_time
         from visits
         where client_id = c.id and scheduled_time = rt.scheduled_time
         order by id desc
         limit 1
       ) v on true
       where rt.user_id = $1
       order by rt.scheduled_time asc`, [userId]);
        const rows = res?.rows ?? [];
        if (rows.length > 0) {
            const mapped = rows.map(r => ({ id: r.visit_id, clientName: r.client_name, address: r.address, scheduledTime: r.scheduled_time }));
            const deduped = dedupeByKey(dedupeById(mapped));
            try {
                console.log(`[getTodayRoutes] routes_today for user ${userId}: ${deduped.length}`);
            }
            catch { }
            return ensureMinimumRoutes(deduped);
        }
        // No routes_today entries; do not fall back to service_routes ownership.
        // Return empty to reflect "unassigned" state accurately.
        try {
            console.log(`[getTodayRoutes] no routes_today entries for user ${userId} -> empty`);
        }
        catch { }
        return [];
    }
    return FALLBACK_ROUTES;
}
async function getVisit(id) {
    if ((0, db_1.hasDb)()) {
        const visit = await (0, db_1.dbQuery)(`select
         v.id,
         c.name as client_name,
         c.address,
         tn.note as timely_note
       from visits v
       join clients c on c.id = v.client_id
       left join lateral (
         select note
         from timely_notes t
         where t.client_id = c.id and t.active
         order by t.created_at desc
         limit 1
       ) tn on true
       where v.id = $1`, [id]);
        const items = await (0, db_1.dbQuery)(`select key, label, done
       from visit_checklist
       where visit_id = $1
       order by array_position(array['watered','pruned','replaced'], key), key asc`, [id]);
        if (visit && visit.rows[0]) {
            return {
                id,
                clientName: visit.rows[0].client_name,
                checklist: items?.rows ?? [],
                timelyNote: visit.rows[0].timely_note,
                address: visit.rows[0].address,
                checkInTs: null,
            };
        }
    }
    const clientName = id === 101 ? 'Acme HQ' :
        id === 102 ? 'Marco Polo, LLC' :
            id === 103 ? 'Sunset Mall' :
                id === 104 ? 'Club 9625' :
                    id === 105 ? 'Palm Vista Resort' :
                        id === 106 ? 'Riverwalk Lofts' : 'Client';
    return {
        id,
        clientName,
        checklist: [
            { key: 'watered', label: 'Watered Plants', done: false },
            { key: 'pruned', label: 'Pruned and cleaned', done: false },
            { key: 'replaced', label: 'Replaced unhealthy plants', done: false }
        ],
        timelyNote: null,
        checkInTs: null
    };
}
async function saveVisit(id, data) {
    if ((0, db_1.hasDb)()) {
        await (0, db_1.dbQuery)(`insert into visit_submissions (visit_id, notes, payload, created_at) values ($1, $2, $3, now())`, [id, data?.notes ?? null, JSON.stringify(data)]);
        return { ok: true };
    }
    return { ok: true };
}
async function buildReportRows(startDate, endDate) {
    if (!(0, db_1.hasDb)())
        return [];
    // Fetch submissions within date range
    const submissionsRes = await (0, db_1.dbQuery)(`select
       vs.id as submission_id,
       vs.created_at,
       v.id as visit_id,
       c.name as client_name,
       c.address,
       c.latitude,
       c.longitude,
       sr.name as route_name,
       u.id as tech_id,
       u.name as tech_name,
       vs.payload
     from visit_submissions vs
     join visits v on v.id = vs.visit_id
     join clients c on c.id = v.client_id
     left join service_routes sr on sr.id = c.service_route_id
     left join users u on u.id = sr.user_id
     where vs.created_at between $1 and $2
     order by u.id nulls last, vs.created_at asc`, [startDate.toISOString(), endDate.toISOString()]);
    // Fetch unassigned clients (no service route assigned)
    const unassignedRes = await (0, db_1.dbQuery)(`select
       null as submission_id,
       null as created_at,
       null as visit_id,
       c.name as client_name,
       c.address,
       c.latitude,
       c.longitude,
       null as route_name,
       null as tech_id,
       null as tech_name,
       '{}'::jsonb as payload
     from clients c
     where c.service_route_id is null
     order by c.name asc`);
    // Combine: unassigned first, then submissions
    const unassignedRows = unassignedRes?.rows ?? [];
    const submissionRows = submissionsRes?.rows ?? [];
    return [...unassignedRows, ...submissionRows];
}
