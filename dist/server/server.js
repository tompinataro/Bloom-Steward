"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importStar(require("./routes/metrics"));
const data_1 = require("./data");
const db_1 = require("./db");
const stateMap = new Map();
function dayKey(d = new Date()) {
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function keyFor(visitId, userId, d = new Date()) {
    return `${dayKey(d)}:${visitId}:${userId ?? 'anon'}`;
}
function markInProgress(visitId, userId) {
    const k = keyFor(visitId, userId);
    const cur = stateMap.get(k) || { updatedAt: new Date().toISOString() };
    cur.inProgress = true;
    cur.updatedAt = new Date().toISOString();
    stateMap.set(k, cur);
    // DB Phase B: upsert state when DB is configured
    if ((0, db_1.hasDb)()) {
        (0, db_1.dbQuery)(`insert into visit_state (visit_id, date, user_id, status)
       values ($1, $2, $3, 'in_progress')
       on conflict (visit_id, date, user_id) do update set status = excluded.status, created_at = now()`, [visitId, dayKey(), userId || 0]).catch(() => { });
    }
}
function markCompleted(visitId, userId) {
    const k = keyFor(visitId, userId);
    const cur = stateMap.get(k) || { updatedAt: new Date().toISOString() };
    cur.completed = true;
    cur.inProgress = false;
    cur.updatedAt = new Date().toISOString();
    stateMap.set(k, cur);
    if ((0, db_1.hasDb)()) {
        (0, db_1.dbQuery)(`insert into visit_state (visit_id, date, user_id, status)
       values ($1, $2, $3, 'completed')
       on conflict (visit_id, date, user_id) do update set status = excluded.status, created_at = now()`, [visitId, dayKey(), userId || 0]).catch(() => { });
    }
}
async function isCompletedToday(visitId, userId) {
    try {
        if ((0, db_1.hasDb)() && userId) {
            const rows = await (0, db_1.dbQuery)(`select status from visit_state where visit_id = $1 and date = $2 and user_id = $3 limit 1`, [visitId, dayKey(), userId]);
            const st = rows?.rows?.[0]?.status;
            if (st)
                return st === 'completed';
        }
    }
    catch { }
    const k = keyFor(visitId, userId);
    return !!stateMap.get(k)?.completed;
}
function getFlags(visitId, userId) {
    const k = keyFor(visitId, userId);
    const cur = stateMap.get(k);
    return { completedToday: !!cur?.completed, inProgress: !!cur?.inProgress };
}
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json());
// Request metrics (counts + duration)
exports.app.use(metrics_1.requestMetrics);
// Health and metrics
exports.app.use(health_1.default);
exports.app.use(metrics_1.default);
// JWT auth
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
function signToken(user) {
    return jsonwebtoken_1.default.sign({ sub: user.id, email: user.email, name: user.name, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '12h' });
}
function requireAuth(req, res, next) {
    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ ok: false, error: 'missing token' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { id: Number(payload.sub), email: payload.email, name: payload.name, role: payload.role };
        return next();
    }
    catch (err) {
        return res.status(401).json({ ok: false, error: 'invalid token' });
    }
}
function requireAdmin(req, res, next) {
    if (!req.user)
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    if (req.user.role !== 'admin')
        return res.status(403).json({ ok: false, error: 'forbidden' });
    return next();
}
const defaultReadMode = (0, db_1.hasDb)()
    ? (process.env.VISIT_STATE_READ_MODE || ((process.env.STAGING === '1' || /(staging)/i.test(process.env.NODE_ENV || '')) ? 'shadow' : 'db'))
    : 'memory';
let readMode = defaultReadMode;
const shadowLogOncePerDay = new Set();
exports.app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
    const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password';
    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
        const isAdmin = (process.env.ADMIN_EMAIL || DEMO_EMAIL) === email;
        const user = { id: 1, name: 'Demo User', email, role: isAdmin ? 'admin' : 'user' };
        const token = signToken(user);
        return res.json({ ok: true, token, user });
    }
    return res.status(401).json({ ok: false, error: 'invalid credentials' });
});
// Minimal Sign in with Apple endpoint for development/internal builds.
// NOTE: For production, verify the identityToken with Apple's public keys
// and map the Apple user to an internal account.
exports.app.post('/api/auth/apple', (req, res) => {
    try {
        const { identityToken, authorizationCode, email, name } = req.body ?? {};
        try {
            console.log('[auth/apple] req', {
                hasIdentityToken: !!identityToken,
                hasAuthorizationCode: !!authorizationCode,
                email: email ? String(email) : null,
            });
        }
        catch { }
        // In this demo server, accept the payload without external verification
        // and synthesize a user. If an email is provided once (first consent), use it;
        // otherwise generate a stable placeholder.
        const userEmail = email || 'apple_user@bloomsteward.local';
        const userName = name || 'Apple User';
        const user = { id: 2, email: userEmail, name: userName, role: 'user' };
        // Basic sanity: require at least one Apple credential field
        if (!identityToken && !authorizationCode) {
            return res.status(400).json({ ok: false, error: 'missing apple credential' });
        }
        const token = signToken(user);
        return res.json({ ok: true, token, user });
    }
    catch (e) {
        return res.status(500).json({ ok: false, error: e?.message ?? 'apple auth error' });
    }
});
exports.app.get('/api/auth/me', requireAuth, (req, res) => {
    return res.json({ ok: true, user: req.user });
});
// Issue a fresh token if the current one is valid
exports.app.post('/api/auth/refresh', requireAuth, (req, res) => {
    if (!req.user)
        return res.status(401).json({ ok: false, error: 'unauthorized' });
    const token = signToken(req.user);
    return res.json({ ok: true, token, user: req.user });
});
exports.app.get('/api/routes/today', requireAuth, async (req, res) => {
    try {
        const routes = await (0, data_1.getTodayRoutes)(1);
        const userId = req.user?.id;
        let withFlags = routes.map(r => ({ ...r, completedToday: false, inProgress: false }));
        const day = dayKey();
        const wantDb = readMode === 'db' || readMode === 'shadow';
        if (wantDb && (0, db_1.hasDb)() && userId) {
            try {
                const rows = await (0, db_1.dbQuery)(`select visit_id, status from visit_state where date = $1 and user_id = $2`, [day, userId]);
                const map = new Map();
                (rows?.rows || []).forEach(r => map.set(r.visit_id, r.status));
                const dbFlags = routes.map(r => {
                    const st = map.get(r.id);
                    return { ...r, completedToday: st === 'completed', inProgress: st === 'in_progress' };
                });
                if (readMode === 'shadow' && !shadowLogOncePerDay.has(day)) {
                    // Compare with in-memory once per day and log mismatches
                    const memFlags = routes.map(r => ({ id: r.id, ...getFlags(r.id, userId) }));
                    const mismatches = dbFlags.filter(df => {
                        const m = memFlags.find(mf => mf.id === df.id);
                        return (df.completedToday !== m.completedToday) || (df.inProgress !== m.inProgress);
                    });
                    if (mismatches.length > 0) {
                        console.warn(`[visit-state shadow] ${mismatches.length} mismatch(es) for ${day}`, mismatches.map(m => ({ id: m.id, db: { c: m.completedToday, p: m.inProgress } })));
                    }
                    else {
                        if (process.env.NODE_ENV !== 'production') {
                            console.log(`[visit-state shadow] parity OK for ${day}`);
                        }
                        // Flip reads to DB for this process after successful parity
                        readMode = 'db';
                        if (process.env.NODE_ENV !== 'production') {
                            console.log('[visit-state] flipping read mode to db for this process');
                        }
                    }
                    shadowLogOncePerDay.add(day);
                }
                withFlags = dbFlags;
            }
            catch {
                // Fallback to in-memory if DB read fails
                withFlags = routes.map(r => ({ ...r, ...getFlags(r.id, userId) }));
            }
        }
        else {
            // Attach server-truth flags (Phase A: in-memory)
            withFlags = routes.map(r => ({ ...r, ...getFlags(r.id, userId) }));
        }
        res.json({ ok: true, routes: withFlags });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'routes error' });
    }
});
exports.app.get('/api/visits/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const visit = await (0, data_1.getVisit)(id);
        res.json({ ok: true, visit });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'visit error' });
    }
});
// Mark a visit as in-progress (opened by tech). Idempotent.
exports.app.post('/api/visits/:id/in-progress', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        markInProgress(id, req.user?.id);
        res.json({ ok: true, id });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'in-progress error' });
    }
});
exports.app.post('/api/visits/:id/submit', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const data = req.body ?? {};
        const userId = req.user?.id;
        // Idempotency: if already completed for today, return success (idempotent)
        if (await isCompletedToday(id, userId))
            return res.json({ ok: true, id, idempotent: true });
        const result = await (0, data_1.saveVisit)(id, data);
        // Phase A: mark completed in memory for today
        markCompleted(id, userId);
        res.json({ ok: true, id, idempotent: false, result });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'submit error' });
    }
});
// Admin endpoints (MVP)
exports.app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const q = await (0, db_1.dbQuery)('select id, email, name from users order by id asc');
        res.json({ ok: true, users: q?.rows ?? [] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'users error' });
    }
});
exports.app.get('/api/admin/clients', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const q = await (0, db_1.dbQuery)('select id, name, address from clients order by id asc');
        res.json({ ok: true, clients: q?.rows ?? [] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
    }
});
// Reassign a client's routes to a field tech (user)
exports.app.put('/api/visits/field-tech', requireAuth, requireAdmin, async (req, res) => {
    const { clientName, fieldTechId } = req.body ?? {};
    if (!clientName || !fieldTechId)
        return res.status(400).json({ ok: false, error: 'missing clientName or fieldTechId' });
    try {
        // Look up client id
        const clientRes = await (0, db_1.dbQuery)('select id from clients where name = $1', [clientName]);
        const clientId = clientRes?.rows?.[0]?.id;
        if (!clientId)
            return res.status(404).json({ ok: false, error: 'client not found' });
        // Update routes_today entries for this client
        await (0, db_1.dbQuery)('update routes_today set user_id = $1 where client_id = $2', [fieldTechId, clientId]);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'update error' });
    }
});
// Admin utility — reset today's visit state for demos/QA
// POST /api/admin/visit-state/reset?date=YYYY-MM-DD
// If DB is configured, delete rows from visit_state for that date; always clear in-memory cache for that date.
exports.app.post('/api/admin/visit-state/reset', requireAuth, requireAdmin, async (req, res) => {
    const d = req.query.date || dayKey();
    try {
        // Clear in-memory state for the day
        const toDel = [];
        stateMap.forEach((_v, k) => { if (k.startsWith(`${d}:`))
            toDel.push(k); });
        toDel.forEach(k => stateMap.delete(k));
        // If DB available, clear visit_state rows for that date
        if ((0, db_1.hasDb)()) {
            await (0, db_1.dbQuery)('delete from visit_state where date = $1', [d]);
        }
        res.json({ ok: true, date: d, clearedKeys: toDel.length });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'reset error' });
    }
});
const port = Number(process.env.PORT) || 5100;
if (process.env.NODE_ENV !== 'test') {
    exports.app.listen(port, () => {
        console.log(`Listening on port: ${port}`);
    });
}
