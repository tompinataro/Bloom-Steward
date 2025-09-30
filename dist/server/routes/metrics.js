"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestMetrics = requestMetrics;
// server/routes/metrics.ts
const express_1 = require("express");
const prom_client_1 = __importDefault(require("prom-client"));
const router = (0, express_1.Router)();
// Guard against multiple registrations in dev/hot-reload
const g = global;
if (!g.__PROM_DEFAULT_METRICS__) {
    prom_client_1.default.collectDefaultMetrics();
    g.__PROM_DEFAULT_METRICS__ = true;
}
// HTTP metrics
const httpRequestsTotal = new prom_client_1.default.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status'],
});
const httpRequestDurationSeconds = new prom_client_1.default.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status'],
    buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
function requestMetrics(req, res, next) {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
        try {
            const durationNs = Number(process.hrtime.bigint() - start);
            const durationSec = durationNs / 1e9;
            const status = String(res.statusCode);
            const path = req.route?.path || req.path || 'unknown';
            const labels = { method: req.method, path, status };
            httpRequestsTotal.inc(labels);
            httpRequestDurationSeconds.observe(labels, durationSec);
        }
        catch { }
    });
    next();
}
router.get('/metrics', async (_req, res) => {
    try {
        res.set('Content-Type', prom_client_1.default.register.contentType);
        const metrics = await prom_client_1.default.register.metrics();
        res.end(metrics);
    }
    catch (err) {
        const message = err?.message ?? 'metrics error';
        res.status(500).end(message);
    }
});
exports.default = router;
