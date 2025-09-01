"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
