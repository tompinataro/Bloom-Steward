"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PGSSLMODE = exports.DATABASE_URL = exports.HOST = exports.PORT = exports.REPORT_TIMEZONE = exports.SMTP_SECURE = exports.SMTP_PASS = exports.SMTP_USER = exports.SMTP_PORT = exports.SMTP_HOST = exports.SMTP_URL = exports.JWT_SECRET = exports.IS_TEST = exports.IS_PROD = exports.NODE_ENV = void 0;
exports.getDemoEmail = getDemoEmail;
exports.getDemoPassword = getDemoPassword;
exports.getAdminEmail = getAdminEmail;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.NODE_ENV = process.env.NODE_ENV || 'development';
exports.IS_PROD = exports.NODE_ENV === 'production';
exports.IS_TEST = exports.NODE_ENV === 'test';
exports.JWT_SECRET = (() => {
    const raw = process.env.JWT_SECRET || '';
    if (!raw && exports.IS_PROD) {
        throw new Error('JWT_SECRET is required in production.');
    }
    return raw || 'dev-secret-change-me';
})();
exports.SMTP_URL = process.env.SMTP_URL || '';
exports.SMTP_HOST = process.env.SMTP_HOST;
exports.SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
exports.SMTP_USER = process.env.SMTP_USER;
exports.SMTP_PASS = process.env.SMTP_PASS;
exports.SMTP_SECURE = process.env.SMTP_SECURE === 'true' || (exports.SMTP_PORT === 465);
exports.REPORT_TIMEZONE = process.env.REPORT_TIMEZONE || 'America/Chicago';
function getDemoEmail() {
    return (process.env.DEMO_EMAIL || 'demo@example.com').toLowerCase();
}
function getDemoPassword() {
    return process.env.DEMO_PASSWORD || 'password';
}
function getAdminEmail() {
    return (process.env.ADMIN_EMAIL || getDemoEmail()).toLowerCase();
}
exports.PORT = Number(process.env.PORT) || 5100;
exports.HOST = process.env.HOST || '0.0.0.0';
exports.DATABASE_URL = process.env.DATABASE_URL || '';
exports.PGSSLMODE = process.env.PGSSLMODE || '';
if (exports.IS_PROD && !exports.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production.');
}
