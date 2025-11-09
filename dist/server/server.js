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
const crypto_1 = require("crypto");
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importStar(require("./routes/metrics"));
const data_1 = require("./data");
const db_1 = require("./db");
const encryptLib = require('./modules/encryption');
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
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'tech',
        mustChangePassword: user.mustChangePassword || false,
    }, JWT_SECRET, { expiresIn: '12h' });
}
function requireAuth(req, res, next) {
    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ ok: false, error: 'missing token' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = { id: Number(payload.sub), email: payload.email, name: payload.name, role: payload.role, mustChangePassword: !!payload.mustChangePassword };
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
function ensureDatabase(res) {
    if (!(0, db_1.hasDb)()) {
        res.status(503).json({ ok: false, error: 'database not configured' });
        return false;
    }
    return true;
}
const defaultReadMode = (0, db_1.hasDb)()
    ? (process.env.VISIT_STATE_READ_MODE || ((process.env.STAGING === '1' || /(staging)/i.test(process.env.NODE_ENV || '')) ? 'shadow' : 'db'))
    : 'memory';
let readMode = defaultReadMode;
const shadowLogOncePerDay = new Set();
exports.app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).json({ ok: false, error: 'missing credentials' });
    }
    if ((0, db_1.hasDb)()) {
        try {
            const result = await (0, db_1.dbQuery)(`select id, email, name, password_hash, coalesce(role, 'tech') as role, must_change_password
         from users
         where lower(email) = lower($1)
         limit 1`, [email]);
            const record = result?.rows?.[0];
            if (record && record.password_hash && encryptLib.comparePassword(password, record.password_hash)) {
                const role = record.role === 'admin' ? 'admin' : 'tech';
                const user = { id: record.id, name: record.name, email: record.email, role, mustChangePassword: !!record.must_change_password };
                const token = signToken(user);
                return res.json({ ok: true, token, user });
            }
        }
        catch (err) {
            console.error('[auth/login] database error', err);
            return res.status(500).json({ ok: false, error: 'login error' });
        }
    }
    const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@example.com').toLowerCase();
    const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password';
    if (String(email).toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
        const isAdmin = (process.env.ADMIN_EMAIL || DEMO_EMAIL).toLowerCase() === String(email).toLowerCase();
        const user = { id: isAdmin ? 9991 : 9990, name: isAdmin ? 'Admin User' : 'Demo User', email, role: isAdmin ? 'admin' : 'tech', mustChangePassword: false };
        const token = signToken(user);
        return res.json({ ok: true, token, user });
    }
    return res.status(401).json({ ok: false, error: 'invalid credentials' });
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
exports.app.post('/api/auth/password', requireAuth, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';
        if (newPassword.length < 8) {
            return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
        }
        const hash = encryptLib.encryptPassword(newPassword);
        await (0, db_1.dbQuery)('update users set password_hash = $1, must_change_password = false where id = $2', [hash, userId]);
        const updatedUser = {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name,
            role: req.user.role,
            mustChangePassword: false,
        };
        const token = signToken(updatedUser);
        return res.json({ ok: true, user: updatedUser, token });
    }
    catch (err) {
        console.error('[auth/password] failed to update password', err);
        return res.status(500).json({ ok: false, error: 'password update failed' });
    }
});
exports.app.delete('/api/auth/account', requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        const reasonInput = req.body?.reason;
        const reason = typeof reasonInput === 'string' ? reasonInput.slice(0, 500) : undefined;
        // Clear any in-memory visit state owned by this user
        for (const key of Array.from(stateMap.keys())) {
            const parts = key.split(':');
            if (parts.length >= 3 && Number(parts[2]) === Number(userId)) {
                stateMap.delete(key);
            }
        }
        let deleted = false;
        if ((0, db_1.hasDb)()) {
            try {
                const result = await (0, db_1.dbQuery)('delete from users where id = $1 returning id', [userId]);
                deleted = !!result?.rows?.length;
            }
            catch (err) {
                console.error('[account/delete] failed to delete user from database', err);
                return res.status(500).json({ ok: false, error: 'failed to delete account' });
            }
        }
        else {
            deleted = true;
        }
        try {
            const msg = `[account/delete] user ${userId} requested deletion${reason ? ` (reason: ${reason})` : ''}${(0, db_1.hasDb)() ? '' : ' (no database configured; treated as stateless deletion)'}`;
            console.log(msg);
        }
        catch { }
        return res.json({
            ok: true,
            deleted,
            requiresManualCleanup: !(0, db_1.hasDb)(),
        });
    }
    catch (err) {
        console.error('[account/delete] unexpected error', err);
        return res.status(500).json({ ok: false, error: 'account deletion error' });
    }
});
exports.app.get('/api/routes/today', requireAuth, async (req, res) => {
    try {
        const userId = req.user?.id;
        const routes = await (0, data_1.getTodayRoutes)(userId || 0);
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
    if (!ensureDatabase(res))
        return;
    try {
        const q = await (0, db_1.dbQuery)('select id, email, name, coalesce(role, \'tech\') as role from users order by id asc');
        const users = (q?.rows ?? []).map((u) => ({ ...u, role: u.role === 'admin' ? 'admin' : 'tech' }));
        res.json({ ok: true, users });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'users error' });
    }
});
exports.app.get('/api/admin/clients', requireAuth, requireAdmin, async (_req, res) => {
    if (!ensureDatabase(res))
        return;
    try {
        const q = await (0, db_1.dbQuery)(`select
         c.id,
         c.name,
         c.address,
         c.contact_name,
         c.contact_phone,
         sr.id as service_route_id,
         sr.name as service_route_name
       from clients c
       left join service_routes sr on sr.id = c.service_route_id
       order by c.name asc`);
        res.json({ ok: true, clients: q?.rows ?? [] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
    }
});
exports.app.get('/api/admin/service-routes', requireAuth, requireAdmin, async (_req, res) => {
    if (!ensureDatabase(res))
        return;
    try {
        const q = await (0, db_1.dbQuery)(`select sr.id, sr.name, sr.user_id, u.name as user_name, u.email as user_email
       from service_routes sr
       left join users u on u.id = sr.user_id
       order by sr.name asc`);
        res.json({ ok: true, routes: q?.rows ?? [] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'service routes error' });
    }
});
function generatePassword() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    const bytes = (0, crypto_1.randomBytes)(6);
    let out = '';
    for (let i = 0; i < 3; i += 1) {
        out += letters[bytes[i] % letters.length];
    }
    for (let i = 3; i < 6; i += 1) {
        out += digits[bytes[i] % digits.length];
    }
    return out;
}
exports.app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    const { name, email, role } = req.body ?? {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    if (!trimmedName || !trimmedEmail) {
        return res.status(400).json({ ok: false, error: 'name and email required' });
    }
    const normalizedEmail = trimmedEmail.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
        return res.status(400).json({ ok: false, error: 'invalid email address' });
    }
    const normalizedRole = role === 'admin' ? 'admin' : 'tech';
    const tempPassword = generatePassword();
    const passwordHash = encryptLib.encryptPassword(tempPassword);
    try {
        const result = await (0, db_1.dbQuery)(`insert into users (name, email, password_hash, role, must_change_password)
       values ($1, $2, $3, $4, true)
       returning id, name, email, coalesce(role, 'tech') as role, must_change_password`, [trimmedName, normalizedEmail, passwordHash, normalizedRole]);
        const user = result?.rows?.[0];
        return res.json({
            ok: true,
            user: user ? { ...user, role: user.role === 'admin' ? 'admin' : 'tech', mustChangePassword: !!user.must_change_password } : null,
            tempPassword
        });
    }
    catch (e) {
        const message = String(e?.message ?? '');
        if (/duplicate key value violates unique constraint/i.test(message)) {
            return res.status(409).json({ ok: false, error: 'email already exists' });
        }
        console.error('[admin/users] create error', e);
        return res.status(500).json({ ok: false, error: 'failed to create user' });
    }
});
exports.app.post('/api/admin/clients', requireAuth, requireAdmin, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    const { name, address, contactName, contactPhone } = req.body ?? {};
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedAddress = typeof address === 'string' ? address.trim() : '';
    if (!trimmedName || !trimmedAddress) {
        return res.status(400).json({ ok: false, error: 'name and address required' });
    }
    const result = await (0, db_1.dbQuery)(`insert into clients (name, address, contact_name, contact_phone)
     values ($1, $2, nullif($3, ''), nullif($4, ''))
     returning id, name, address, contact_name, contact_phone`, [trimmedName, trimmedAddress, contactName || null, contactPhone || null]).catch((e) => {
        const message = String(e?.message ?? '');
        if (/duplicate key value violates unique constraint/i.test(message)) {
            return { error: 'duplicate' };
        }
        console.error('[admin/clients] create error', e);
        return { error: 'unknown' };
    });
    if (result?.error === 'duplicate') {
        return res.status(409).json({ ok: false, error: 'client already exists' });
    }
    if (result?.error) {
        return res.status(500).json({ ok: false, error: 'failed to create client' });
    }
    const client = result?.rows?.[0];
    return res.json({ ok: true, client });
});
exports.app.post('/api/admin/routes/assign', requireAuth, requireAdmin, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    const { clientId, userId, scheduledTime } = req.body ?? {};
    const cid = Number(clientId);
    if (!cid || Number.isNaN(cid)) {
        return res.status(400).json({ ok: false, error: 'invalid client' });
    }
    const clientCheck = await (0, db_1.dbQuery)('select id from clients where id = $1', [cid]);
    if (!clientCheck?.rows?.length) {
        return res.status(404).json({ ok: false, error: 'client not found' });
    }
    if (userId === null || userId === undefined || userId === '') {
        try {
            await (0, db_1.dbQuery)('delete from routes_today where client_id = $1', [cid]);
            return res.json({ ok: true, removed: true });
        }
        catch (e) {
            console.error('[admin/routes] delete error', e);
            return res.status(500).json({ ok: false, error: 'failed to remove assignment' });
        }
    }
    const uid = Number(userId);
    if (!uid || Number.isNaN(uid)) {
        return res.status(400).json({ ok: false, error: 'invalid user' });
    }
    const userCheck = await (0, db_1.dbQuery)('select coalesce(role, \'tech\') as role from users where id = $1', [uid]);
    if (!userCheck?.rows?.length) {
        return res.status(404).json({ ok: false, error: 'user not found' });
    }
    const userRole = userCheck.rows[0].role;
    if (userRole !== 'tech') {
        return res.status(400).json({ ok: false, error: 'assignment requires a field tech account' });
    }
    const time = typeof scheduledTime === 'string' && scheduledTime.trim()
        ? scheduledTime.trim()
        : '08:30';
    try {
        await (0, db_1.dbQuery)(`insert into routes_today (user_id, client_id, scheduled_time)
       values ($1, $2, $3)
       on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time`, [uid, cid, time]);
        return res.json({ ok: true });
    }
    catch (e) {
        console.error('[admin/routes] assign error', e);
        return res.status(500).json({ ok: false, error: 'failed to assign client' });
    }
});
exports.app.post('/api/admin/clients/:id/service-route', requireAuth, requireAdmin, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    const clientId = Number(req.params.id);
    if (!clientId || Number.isNaN(clientId)) {
        return res.status(400).json({ ok: false, error: 'invalid client id' });
    }
    const routeInput = req.body?.serviceRouteId;
    const routeId = routeInput === null || routeInput === undefined ? null : Number(routeInput);
    if (routeId !== null && Number.isNaN(routeId)) {
        return res.status(400).json({ ok: false, error: 'invalid route id' });
    }
    try {
        await (0, db_1.dbQuery)('update clients set service_route_id = $1 where id = $2', [routeId, clientId]);
        res.json({ ok: true });
    }
    catch (e) {
        console.error('[clients/service-route] update error', e);
        res.status(500).json({ ok: false, error: 'failed to update client route' });
    }
});
exports.app.post('/api/admin/service-routes/:id/tech', requireAuth, requireAdmin, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    const routeId = Number(req.params.id);
    if (!routeId || Number.isNaN(routeId)) {
        return res.status(400).json({ ok: false, error: 'invalid route id' });
    }
    const userInput = req.body?.userId;
    const userId = userInput === null || userInput === undefined ? null : Number(userInput);
    if (userId !== null && Number.isNaN(userId)) {
        return res.status(400).json({ ok: false, error: 'invalid user id' });
    }
    try {
        await (0, db_1.dbQuery)('update service_routes set user_id = $1 where id = $2', [userId, routeId]);
        res.json({ ok: true });
    }
    catch (e) {
        console.error('[service-routes/tech] update error', e);
        res.status(500).json({ ok: false, error: 'failed to assign tech' });
    }
});
exports.app.get('/api/admin/routes/overview', requireAuth, requireAdmin, async (_req, res) => {
    if (!ensureDatabase(res))
        return;
    try {
        const result = await (0, db_1.dbQuery)(`select
         rt.user_id,
         u.name as user_name,
         u.email as user_email,
         rt.client_id,
         c.name as client_name,
         c.address,
         rt.scheduled_time
       from routes_today rt
       join users u on u.id = rt.user_id
       join clients c on c.id = rt.client_id
       order by u.name asc, rt.scheduled_time asc, c.name asc`);
        res.json({ ok: true, assignments: result?.rows ?? [] });
    }
    catch (e) {
        console.error('[admin/routes] overview error', e);
        res.status(500).json({ ok: false, error: e?.message ?? 'routes overview error' });
    }
});
exports.app.post('/api/admin/timely-notes', requireAuth, requireAdmin, async (req, res) => {
    if (!ensureDatabase(res))
        return;
    const { clientId, note, active } = req.body ?? {};
    const cid = Number(clientId);
    if (!cid || Number.isNaN(cid)) {
        return res.status(400).json({ ok: false, error: 'invalid client' });
    }
    const shouldActivate = active !== false;
    const trimmedNote = typeof note === 'string' ? note.trim() : '';
    if (!trimmedNote) {
        try {
            await (0, db_1.dbQuery)('update timely_notes set active = false where client_id = $1 and active', [cid]);
            return res.json({ ok: true, note: null });
        }
        catch (e) {
            console.error('[admin/timely-notes] clear error', e);
            return res.status(500).json({ ok: false, error: 'failed to clear note' });
        }
    }
    try {
        await (0, db_1.dbQuery)('update timely_notes set active = false where client_id = $1 and active', [cid]);
        const result = await (0, db_1.dbQuery)(`insert into timely_notes (client_id, note, created_by, active)
       values ($1, $2, $3, $4)
       returning id, note, created_at`, [cid, trimmedNote, req.user?.id ?? null, shouldActivate]);
        return res.json({ ok: true, note: result?.rows?.[0] ?? null });
    }
    catch (e) {
        console.error('[admin/timely-notes] create error', e);
        return res.status(500).json({ ok: false, error: 'failed to save note' });
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
