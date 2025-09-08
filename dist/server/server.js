"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const data_1 = require("./data");
const db_1 = require("./db");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health and metrics
app.use(health_1.default);
app.use(metrics_1.default);
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
// API routes (DB-backed when configured; demo otherwise)
app.post('/api/auth/login', (req, res) => {
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
app.get('/api/auth/me', requireAuth, (req, res) => {
    return res.json({ ok: true, user: req.user });
});
app.get('/api/routes/today', requireAuth, async (_req, res) => {
    try {
        const routes = await (0, data_1.getTodayRoutes)(1);
        res.json({ ok: true, routes });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'routes error' });
    }
});
app.get('/api/visits/:id', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const visit = await (0, data_1.getVisit)(id);
        res.json({ ok: true, visit });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'visit error' });
    }
});
app.post('/api/visits/:id/submit', requireAuth, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { notes, checklist } = req.body ?? {};
        const result = await (0, data_1.saveVisit)(id, notes, checklist);
        res.json({ ok: true, id, result });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'submit error' });
    }
});
// Admin endpoints (MVP)
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const q = await (0, db_1.dbQuery)('select id, email, name from users order by id asc');
        res.json({ ok: true, users: q?.rows ?? [] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'users error' });
    }
});
app.get('/api/admin/clients', requireAuth, requireAdmin, async (_req, res) => {
    try {
        const q = await (0, db_1.dbQuery)('select id, name, address from clients order by id asc');
        res.json({ ok: true, clients: q?.rows ?? [] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
    }
});
// Reassign a client's routes to a field tech (user)
app.put('/api/visits/field-tech', requireAuth, requireAdmin, async (req, res) => {
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
const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});
