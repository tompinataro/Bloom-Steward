"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReportsRouter = createReportsRouter;
const express_1 = __importDefault(require("express"));
const summary_1 = require("../reports/summary");
const range_1 = require("../reports/range");
const db_1 = require("../db");
function createReportsRouter(requireAuth, requireAdmin) {
    const router = express_1.default.Router();
    router.post('/summary', requireAuth, requireAdmin, async (req, res) => {
        if (!(0, db_1.hasDb)()) {
            return res.status(503).json({ ok: false, error: 'database not configured' });
        }
        const { frequency, startDate, endDate } = req.body ?? {};
        try {
            const range = (0, range_1.resolveRange)(frequency, startDate, endDate);
            const rows = await (0, summary_1.buildSummary)(range.startDate, range.endDate);
            res.json({
                ok: true,
                rows,
                range: { start: range.startDate.toISOString(), end: range.endDate.toISOString(), frequency },
            });
        }
        catch (err) {
            console.error('[reports/summary] error', err);
            res.status(500).json({ ok: false, error: err?.message ?? 'failed to build summary' });
        }
    });
    router.post('/email', requireAuth, requireAdmin, async (req, res) => {
        if (!(0, db_1.hasDb)()) {
            return res.status(503).json({ ok: false, error: 'database not configured' });
        }
        const { emails, frequency, startDate, endDate } = req.body ?? {};
        let targets = [];
        if (Array.isArray(emails)) {
            targets = emails.filter(Boolean);
        }
        else if (typeof emails === 'string') {
            targets = emails.split(',').map((s) => s.trim()).filter(Boolean);
        }
        if (!targets.length) {
            return res.status(400).json({ ok: false, error: 'recipient emails required' });
        }
        const range = (0, range_1.resolveRange)(frequency, startDate, endDate);
        try {
            const rows = await (0, summary_1.buildSummary)(range.startDate, range.endDate);
            const csv = (0, summary_1.buildCsv)(rows);
            const html = (0, summary_1.buildHtml)(rows, range.startDate, range.endDate);
            await (0, summary_1.sendReportEmail)(targets, `Field Tech Summary (${frequency})`, html, csv);
            res.json({
                ok: true,
                sentTo: targets,
                range: { start: range.startDate.toISOString(), end: range.endDate.toISOString(), frequency },
            });
        }
        catch (err) {
            console.error('[reports/email] error', err);
            res.status(500).json({ ok: false, error: err?.message ?? 'failed to send report' });
        }
    });
    return router;
}
