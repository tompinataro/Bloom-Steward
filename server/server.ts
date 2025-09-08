import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import { getTodayRoutes, getVisit, saveVisit } from './data';
import { dbQuery } from './db';

const app = express();
app.use(cors());
app.use(express.json());

// Health and metrics
app.use(healthRouter);
app.use(metricsRouter);

// JWT auth
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

type JwtUser = { id: number; email: string; name: string; role?: 'admin' | 'user' };

function signToken(user: JwtUser) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '12h' });
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtUser;
    }
  }
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.header('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ ok: false, error: 'missing token' });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    req.user = { id: Number(payload.sub), email: payload.email, name: payload.name, role: payload.role };
    return next();
  } catch (err: any) {
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (req.user.role !== 'admin') return res.status(403).json({ ok: false, error: 'forbidden' });
  return next();
}

// API routes (DB-backed when configured; demo otherwise)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@example.com';
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password';
  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    const isAdmin = (process.env.ADMIN_EMAIL || DEMO_EMAIL) === email;
    const user: JwtUser = { id: 1, name: 'Demo User', email, role: isAdmin ? 'admin' : 'user' };
    const token = signToken(user);
    return res.json({ ok: true, token, user });
  }
  return res.status(401).json({ ok: false, error: 'invalid credentials' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ ok: true, user: req.user });
});

app.get('/api/routes/today', requireAuth, async (_req, res) => {
  try {
    const routes = await getTodayRoutes(1);
    res.json({ ok: true, routes });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'routes error' });
  }
});

app.get('/api/visits/:id', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const visit = await getVisit(id);
    res.json({ ok: true, visit });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'visit error' });
  }
});

app.post('/api/visits/:id/submit', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { notes, checklist } = req.body ?? {};
    const result = await saveVisit(id, notes, checklist);
    res.json({ ok: true, id, result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'submit error' });
  }
});

// Admin endpoints (MVP)
app.get('/api/admin/users', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const q = await dbQuery<{ id: number; email: string; name: string }>('select id, email, name from users order by id asc');
    res.json({ ok: true, users: q?.rows ?? [] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'users error' });
  }
});

app.get('/api/admin/clients', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const q = await dbQuery<{ id: number; name: string; address: string }>('select id, name, address from clients order by id asc');
    res.json({ ok: true, clients: q?.rows ?? [] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
  }
});

// Reassign a client's routes to a field tech (user)
app.put('/api/visits/field-tech', requireAuth, requireAdmin, async (req, res) => {
  const { clientName, fieldTechId } = req.body ?? {};
  if (!clientName || !fieldTechId) return res.status(400).json({ ok: false, error: 'missing clientName or fieldTechId' });
  try {
    // Look up client id
    const clientRes = await dbQuery<{ id: number }>('select id from clients where name = $1', [clientName]);
    const clientId = clientRes?.rows?.[0]?.id;
    if (!clientId) return res.status(404).json({ ok: false, error: 'client not found' });

    // Update routes_today entries for this client
    await dbQuery('update routes_today set user_id = $1 where client_id = $2', [fieldTechId, clientId]);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'update error' });
  }
});

const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
