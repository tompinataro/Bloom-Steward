"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
function signToken(user) {
    return jsonwebtoken_1.default.sign({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'tech',
        mustChangePassword: user.mustChangePassword || false,
    }, config_1.JWT_SECRET, { expiresIn: '12h' });
}
function requireAuth(req, res, next) {
    const auth = req.header('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '');
    if (!token)
        return res.status(401).json({ ok: false, error: 'missing token' });
    try {
        const payload = jsonwebtoken_1.default.verify(token, config_1.JWT_SECRET);
        req.user = { id: Number(payload.sub), email: payload.email, name: payload.name, role: payload.role, mustChangePassword: !!payload.mustChangePassword };
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
