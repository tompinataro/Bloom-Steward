"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const START_TIME = Date.now();
function uptimeSeconds() {
    return Math.floor((Date.now() - START_TIME) / 1000);
}
const VERSION = process.env.APP_VERSION || process.env.npm_package_version || 'dev';
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ ok: true, ts: new Date().toISOString(), version: VERSION, uptime: uptimeSeconds(), message: 'healthy' });
});
exports.default = router;
