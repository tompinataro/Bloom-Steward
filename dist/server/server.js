"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const health_1 = __importDefault(require("./routes/health"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const data_1 = require("./data");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health and metrics
app.use(health_1.default);
app.use(metrics_1.default);
// Simple in-memory auth stub
const DEMO_TOKEN = 'demo-token';
function requireAuth(req, res, next) {
    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ ok: false, error: 'missing token' });
    // Accept any token for MVP; optionally enforce DEMO_TOKEN
    return next();
}
// API routes (DB-backed when configured; demo otherwise)
app.post('/api/auth/login', (req, res) => {
    const { email } = req.body ?? {};
    // Always succeeds for MVP
    res.json({
        ok: true,
        token: DEMO_TOKEN,
        user: { id: 1, name: 'Demo User', email: email || 'demo@example.com' }
    });
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
const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
});
