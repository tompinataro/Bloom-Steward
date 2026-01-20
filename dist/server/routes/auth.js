"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthRouter = createAuthRouter;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const config_1 = require("../config");
const auth_1 = require("../auth");
const encryptLib = require('../modules/encryption');
function ensureDatabase(res) {
    if (!(0, db_1.hasDb)()) {
        res.status(503).json({ ok: false, error: 'database not configured' });
        return false;
    }
    return true;
}
function createAuthRouter(requireAuth) {
    const router = express_1.default.Router();
    router.post('/login', async (req, res) => {
        const { email, password } = req.body ?? {};
        if (!email || !password) {
            return res.status(400).json({ ok: false, error: 'missing credentials' });
        }
        if ((0, db_1.hasDb)()) {
            try {
                const result = await (0, db_1.dbQuery)(`select id, email, name, password_hash, coalesce(role, 'tech') as role, must_change_password, managed_password
           from users
           where lower(email) = lower($1)
           limit 1`, [email]);
                const record = result?.rows?.[0];
                if (record) {
                    const passwordMatches = !!(record.password_hash && encryptLib.comparePassword(password, record.password_hash));
                    const managedMatches = !!(record.managed_password && password === record.managed_password);
                    if (managedMatches && !passwordMatches) {
                        try {
                            const newHash = encryptLib.encryptPassword(password);
                            await (0, db_1.dbQuery)('update users set password_hash = $1 where id = $2', [newHash, record.id]);
                        }
                        catch (rehashErr) {
                            console.warn('[auth/login] failed to rehash managed password', rehashErr);
                        }
                    }
                    if (passwordMatches || managedMatches) {
                        const role = record.role === 'admin' ? 'admin' : 'tech';
                        const user = { id: record.id, name: record.name, email: record.email, role, mustChangePassword: !!record.must_change_password };
                        const token = (0, auth_1.signToken)(user);
                        return res.json({ ok: true, token, user });
                    }
                }
            }
            catch (err) {
                console.error('[auth/login] database error', err);
                return res.status(500).json({ ok: false, error: 'login error' });
            }
        }
        const demoEmail = (0, config_1.getDemoEmail)();
        const demoPassword = (0, config_1.getDemoPassword)();
        if (String(email).toLowerCase() === demoEmail && password === demoPassword) {
            const isAdmin = (0, config_1.getAdminEmail)() === String(email).toLowerCase();
            const user = { id: isAdmin ? 9991 : 9990, name: isAdmin ? 'Admin User' : 'Demo User', email, role: isAdmin ? 'admin' : 'tech', mustChangePassword: false };
            const token = (0, auth_1.signToken)(user);
            return res.json({ ok: true, token, user });
        }
        return res.status(401).json({ ok: false, error: 'invalid credentials' });
    });
    router.get('/me', requireAuth, (req, res) => {
        return res.json({ ok: true, user: req.user });
    });
    router.post('/refresh', requireAuth, (req, res) => {
        if (!req.user)
            return res.status(401).json({ ok: false, error: 'unauthorized' });
        const token = (0, auth_1.signToken)(req.user);
        return res.json({ ok: true, token, user: req.user });
    });
    router.post('/password', requireAuth, async (req, res) => {
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
            const token = (0, auth_1.signToken)(updatedUser);
            return res.json({ ok: true, user: updatedUser, token });
        }
        catch (err) {
            console.error('[auth/password] failed to update password', err);
            return res.status(500).json({ ok: false, error: 'password update failed' });
        }
    });
    // Store daily start odometer for mileage tracking
    router.post('/start-odometer', requireAuth, async (req, res) => {
        if (!ensureDatabase(res))
            return;
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ ok: false, error: 'unauthorized' });
            const raw = req.body?.odometerReading;
            const numericReading = Number(String(raw ?? '').replace(/[^0-9.]/g, ''));
            if (!Number.isFinite(numericReading)) {
                console.warn('[auth/start-odometer] invalid reading', { raw, numericReading });
                return res.status(400).json({ ok: false, error: 'invalid odometer reading' });
            }
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const result = await (0, db_1.dbQuery)(`insert into daily_start_odometer (user_id, date, odometer_reading)
         values ($1, $2, $3)
         on conflict (user_id, date) do update set odometer_reading = $3
         returning id, odometer_reading`, [userId, today, numericReading]);
            const stored = result?.rows?.[0]?.odometer_reading;
            const storedNumeric = typeof stored === 'number' ? stored : Number(stored);
            return res.json({ ok: true, odometerReading: storedNumeric });
        }
        catch (err) {
            console.error('[auth/start-odometer] failed to save', err);
            return res.status(500).json({ ok: false, error: 'failed to save odometer' });
        }
    });
    router.delete('/account', requireAuth, async (req, res) => {
        try {
            const userId = req.user?.id;
            if (!userId)
                return res.status(401).json({ ok: false, error: 'unauthorized' });
            const reasonInput = req.body?.reason;
            const reason = typeof reasonInput === 'string' ? reasonInput.slice(0, 500) : undefined;
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
    return router;
}
