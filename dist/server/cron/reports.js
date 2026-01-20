"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReportCron = startReportCron;
const node_cron_1 = __importDefault(require("node-cron"));
const range_1 = require("../reports/range");
const summary_1 = require("../reports/summary");
const config_1 = require("../config");
function startReportCron() {
    node_cron_1.default.schedule('0 5 * * 1', async () => {
        console.log('[CRON] Sending weekly report to Tom');
        try {
            const { startDate, endDate } = (0, range_1.resolveRange)('weekly');
            const rows = await (0, summary_1.buildSummary)(startDate, endDate);
            const csv = (0, summary_1.buildCsv)(rows);
            const html = (0, summary_1.buildHtml)(rows, startDate, endDate);
            await (0, summary_1.sendReportEmail)(['tom@pinataro.com'], 'Field Work Summary Report (Weekly)', html, csv);
            console.log('[CRON] Weekly report sent to Tom');
        }
        catch (err) {
            console.error('[CRON] Failed to send weekly report:', err?.message);
        }
    }, { timezone: config_1.REPORT_TIMEZONE });
    node_cron_1.default.schedule('0 5 * * *', async () => {
        console.log('[CRON] Sending daily report to Tom');
        try {
            const { startDate, endDate } = (0, range_1.resolveRange)('daily');
            const rows = await (0, summary_1.buildSummary)(startDate, endDate);
            const csv = (0, summary_1.buildCsv)(rows);
            const html = (0, summary_1.buildHtml)(rows, startDate, endDate);
            await (0, summary_1.sendReportEmail)(['tom@pinataro.com'], 'Field Work Summary Report (Daily)', html, csv);
            console.log('[CRON] Daily report sent to Tom');
        }
        catch (err) {
            console.error('[CRON] Failed to send daily report:', err?.message);
        }
    }, { timezone: config_1.REPORT_TIMEZONE });
}
