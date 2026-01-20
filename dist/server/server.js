"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const app_1 = require("./app");
const reports_1 = require("./cron/reports");
const ensure_1 = require("./db/ensure");
const config_1 = require("./config");
(0, ensure_1.ensureManagedPasswordColumn)().catch(() => { });
exports.app = (0, app_1.createApp)();
if (!config_1.IS_TEST) {
    (0, reports_1.startReportCron)();
}
const port = config_1.PORT;
const host = config_1.HOST;
if (!config_1.IS_TEST) {
    exports.app.listen(port, host, () => {
        console.log(`Listening on ${host}:${port}`);
    });
}
