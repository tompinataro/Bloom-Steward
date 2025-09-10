import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import healthRouter from './routes/health';
import metricsRouter, { requestMetrics } from './routes/metrics';
import { getTodayRoutes, getVisit, saveVisit } from './data';
import { dbQuery, hasDb } from './db';

// In-memory visit state (Sprint 5 Phase A)
// Keyed by day + visit id + user id. Example: 2025-09-09:101:1
type VisitState = { completed?: boolean; inProgress?: boolean; updatedAt: string };
const stateMap = new Map<string, VisitState>();
function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function keyFor(visitId: number, userId?: number, d = new Date()) {
  return `${dayKey(d)}:${visitId}:${userId ?? 'anon'}`;
}
function markInProgress(visitId: number, userId?: number) {
  const k = keyFor(visitId, userId);
  const cur = stateMap.get(k) || { updatedAt: new Date().toISOString() } as VisitState;
  cur.inProgress = true;
  cur.updatedAt = new Date().toISOString();
  stateMap.set(k, cur);
  // DB Phase B: upsert state when DB is configured
  if (hasDb()) {
    dbQuery(
      `insert into visit_state (visit_id, date, user_id, status)
       values ($1, $2, $3, 'in_progress')
       on conflict (visit_id, date, user_id) do update set status = excluded.status, created_at = now()`,
      [visitId, dayKey(), userId || 0]
    ).catch(() => {});
  }
}
function markCompleted(visitId: number, userId?: number) {
  const k = keyFor(visitId, userId);
  const cur = stateMap.get(k) || { updatedAt: new Date().toISOString() } as VisitState;
  cur.completed = true;
  cur.inProgress = false;
  cur.updatedAt = new Date().toISOString();
  stateMap.set(k, cur);
  if (hasDb()) {
    dbQuery(
      `insert into visit_state (visit_id, date, user_id, status)
       values ($1, $2, $3, 'completed')
       on conflict (visit_id, date, user_id) do update set status = excluded.status, created_at = now()`,
      [visitId, dayKey(), userId || 0]
    ).catch(() => {});
  }
}
function isCompleted(visitId: number, userId?: number) {
  const k = keyFor(visitId, userId);
  return !!stateMap.get(k)?.completed;
}
function getFlags(visitId: number, userId?: number) {
  const k = keyFor(visitId, userId);
  const cur = stateMap.get(k);
  return { completedToday: !!cur?.completed, inProgress: !!cur?.inProgress };
}

const app = express();
app.use(cors());
app.use(express.json());
// Request metrics (counts + duration)
app.use(requestMetrics);

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
// Sprint 8 controls: visit state read strategy
type ReadMode = 'db' | 'memory' | 'shadow';
const defaultReadMode: ReadMode = hasDb()
  ? ((process.env.STAGING === '1' || /(staging)/i.test(process.env.NODE_ENV || '')) ? 'shadow' : 'db')
  : 'memory';
const READ_MODE: ReadMode = ((process.env.VISIT_STATE_READ_MODE || defaultReadMode) as ReadMode);
const shadowLogOncePerDay = new Set<string>();
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

app.get('/api/routes/today', requireAuth, async (req, res) => {
  try {
    const routes = await getTodayRoutes(1);
    const userId = req.user?.id;
    let withFlags = routes.map(r => ({ ...r, completedToday: false, inProgress: false }));
    const day = dayKey();
    const wantDb = READ_MODE === 'db' || READ_MODE === 'shadow';
    if (wantDb && hasDb() && userId) {
      try {
        const rows = await dbQuery<{ visit_id: number; status: string }>(
          `select visit_id, status from visit_state where date = $1 and user_id = $2`,
          [day, userId]
        );
        const map = new Map<number, string>();
        (rows?.rows || []).forEach(r => map.set(r.visit_id, r.status));
        const dbFlags = routes.map(r => {
          const st = map.get(r.id);
          return { ...r, completedToday: st === 'completed', inProgress: st === 'in_progress' };
        });
        if (READ_MODE === 'shadow' && !shadowLogOncePerDay.has(day)) {
          // Compare with in-memory once per day and log mismatches
          const memFlags = routes.map(r => ({ id: r.id, ...getFlags(r.id, userId) }));
          const mismatches = dbFlags.filter(df => {
            const m = memFlags.find(mf => mf.id === df.id)!;
            return (df.completedToday !== m.completedToday) || (df.inProgress !== m.inProgress);
          });
          if (mismatches.length > 0) {
            console.warn(`[visit-state shadow] ${mismatches.length} mismatch(es) for ${day}`, mismatches.map(m => ({ id: m.id, db: { c: m.completedToday, p: m.inProgress } })));
          } else {
            console.log(`[visit-state shadow] parity OK for ${day}`);
          }
          shadowLogOncePerDay.add(day);
        }
        withFlags = dbFlags;
      } catch {
        // Fallback to in-memory if DB read fails
        withFlags = routes.map(r => ({ ...r, ...getFlags(r.id, userId) }));
      }
    } else {
      // Attach server-truth flags (Phase A: in-memory)
      withFlags = routes.map(r => ({ ...r, ...getFlags(r.id, userId) }));
    }
    res.json({ ok: true, routes: withFlags });
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

// Mark a visit as in-progress (opened by tech). Idempotent.
app.post('/api/visits/:id/in-progress', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    markInProgress(id, req.user?.id);
    res.json({ ok: true, id });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'in-progress error' });
  }
});

app.post('/api/visits/:id/submit', requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body ?? {};
    const userId = req.user?.id;
    // Idempotency: if already completed for today, return success (idempotent)
    if (isCompleted(id, userId)) {
      return res.json({ ok: true, id, idempotent: true });
    }
    const result = await saveVisit(id, data);
    // Phase A: mark completed in memory for today
    markCompleted(id, userId);
    res.json({ ok: true, id, idempotent: false, result });
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

// Admin utility — reset today's visit state for demos/QA
// POST /api/admin/visit-state/reset?date=YYYY-MM-DD
// If DB is configured, delete rows from visit_state for that date; always clear in-memory cache for that date.
app.post('/api/admin/visit-state/reset', requireAuth, requireAdmin, async (req, res) => {
  const d = (req.query.date as string) || dayKey();
  try {
    // Clear in-memory state for the day
    const toDel: string[] = [];
    stateMap.forEach((_v, k) => { if (k.startsWith(`${d}:`)) toDel.push(k); });
    toDel.forEach(k => stateMap.delete(k));

    // If DB available, clear visit_state rows for that date
    if (hasDb()) {
      await dbQuery('delete from visit_state where date = $1', [d]);
    }
    res.json({ ok: true, date: d, clearedKeys: toDel.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'reset error' });
  }
});

const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
