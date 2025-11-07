import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import healthRouter from './routes/health';
import metricsRouter, { requestMetrics } from './routes/metrics';
import { getTodayRoutes, getVisit, saveVisit } from './data';
import { dbQuery, hasDb } from './db';
const encryptLib = require('./modules/encryption') as {
  encryptPassword: (password: string) => string;
  comparePassword: (candidate: string, stored: string) => boolean;
};

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
async function isCompletedToday(visitId: number, userId?: number): Promise<boolean> {
  try {
    if (hasDb() && userId) {
      const rows = await dbQuery<{ status: string }>(
        `select status from visit_state where visit_id = $1 and date = $2 and user_id = $3 limit 1`,
        [visitId, dayKey(), userId]
      );
      const st = rows?.rows?.[0]?.status;
      if (st) return st === 'completed';
    }
  } catch {}
  const k = keyFor(visitId, userId);
  return !!stateMap.get(k)?.completed;
}
function getFlags(visitId: number, userId?: number) {
  const k = keyFor(visitId, userId);
  const cur = stateMap.get(k);
  return { completedToday: !!cur?.completed, inProgress: !!cur?.inProgress };
}

export const app = express();
app.use(cors());
app.use(express.json());
// Request metrics (counts + duration)
app.use(requestMetrics);

// Health and metrics
app.use(healthRouter);
app.use(metricsRouter);

// JWT auth
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

type UserRole = 'admin' | 'tech';
type JwtUser = { id: number; email: string; name: string; role?: UserRole };

function signToken(user: JwtUser) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, role: user.role || 'tech' }, JWT_SECRET, { expiresIn: '12h' });
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

function ensureDatabase(res: express.Response): boolean {
  if (!hasDb()) {
    res.status(503).json({ ok: false, error: 'database not configured' });
    return false;
  }
  return true;
}

// API routes (DB-backed when configured; demo otherwise)
// Sprint 8 controls: visit state read strategy
type ReadMode = 'db' | 'memory' | 'shadow';
const defaultReadMode: ReadMode = hasDb()
  ? ((process.env.VISIT_STATE_READ_MODE as ReadMode) || ((process.env.STAGING === '1' || /(staging)/i.test(process.env.NODE_ENV || '')) ? 'shadow' : 'db'))
  : 'memory';
let readMode: ReadMode = defaultReadMode;
const shadowLogOncePerDay = new Set<string>();
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, error: 'missing credentials' });
  }
  if (hasDb()) {
    try {
      const result = await dbQuery<{ id: number; email: string; name: string; password_hash: string; role: string }>(
        `select id, email, name, password_hash, coalesce(role, 'tech') as role
         from users
         where lower(email) = lower($1)
         limit 1`,
        [email]
      );
      const record = result?.rows?.[0];
      if (record && record.password_hash && encryptLib.comparePassword(password, record.password_hash)) {
        const role: UserRole = record.role === 'admin' ? 'admin' : 'tech';
        const user: JwtUser = { id: record.id, name: record.name, email: record.email, role };
        const token = signToken(user);
        return res.json({ ok: true, token, user });
      }
    } catch (err) {
      console.error('[auth/login] database error', err);
      return res.status(500).json({ ok: false, error: 'login error' });
    }
  }
  const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@example.com').toLowerCase();
  const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'password';
  if (String(email).toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD) {
    const isAdmin = (process.env.ADMIN_EMAIL || DEMO_EMAIL).toLowerCase() === String(email).toLowerCase();
    const user: JwtUser = { id: isAdmin ? 9991 : 9990, name: isAdmin ? 'Admin User' : 'Demo User', email, role: isAdmin ? 'admin' : 'tech' };
    const token = signToken(user);
    return res.json({ ok: true, token, user });
  }
  return res.status(401).json({ ok: false, error: 'invalid credentials' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({ ok: true, user: req.user });
});

// Issue a fresh token if the current one is valid
app.post('/api/auth/refresh', requireAuth, (req, res) => {
  if (!req.user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const token = signToken(req.user);
  return res.json({ ok: true, token, user: req.user });
});

app.delete('/api/auth/account', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const reasonInput = (req.body as any)?.reason;
    const reason = typeof reasonInput === 'string' ? reasonInput.slice(0, 500) : undefined;

    // Clear any in-memory visit state owned by this user
    for (const key of Array.from(stateMap.keys())) {
      const parts = key.split(':');
      if (parts.length >= 3 && Number(parts[2]) === Number(userId)) {
        stateMap.delete(key);
      }
    }

    let deleted = false;
    if (hasDb()) {
      try {
        const result = await dbQuery<{ id: number }>('delete from users where id = $1 returning id', [userId]);
        deleted = !!result?.rows?.length;
      } catch (err) {
        console.error('[account/delete] failed to delete user from database', err);
        return res.status(500).json({ ok: false, error: 'failed to delete account' });
      }
    } else {
      deleted = true;
    }

    try {
      const msg = `[account/delete] user ${userId} requested deletion${reason ? ` (reason: ${reason})` : ''}${hasDb() ? '' : ' (no database configured; treated as stateless deletion)'}`;
      console.log(msg);
    } catch {}

    return res.json({
      ok: true,
      deleted,
      requiresManualCleanup: !hasDb(),
    });
  } catch (err) {
    console.error('[account/delete] unexpected error', err);
    return res.status(500).json({ ok: false, error: 'account deletion error' });
  }
});

app.get('/api/routes/today', requireAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const routes = await getTodayRoutes(userId || 0);
    let withFlags = routes.map(r => ({ ...r, completedToday: false, inProgress: false }));
    const day = dayKey();
    const wantDb = readMode === 'db' || readMode === 'shadow';
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
        if (readMode === 'shadow' && !shadowLogOncePerDay.has(day)) {
          // Compare with in-memory once per day and log mismatches
          const memFlags = routes.map(r => ({ id: r.id, ...getFlags(r.id, userId) }));
          const mismatches = dbFlags.filter(df => {
            const m = memFlags.find(mf => mf.id === df.id)!;
            return (df.completedToday !== m.completedToday) || (df.inProgress !== m.inProgress);
          });
          if (mismatches.length > 0) {
            console.warn(`[visit-state shadow] ${mismatches.length} mismatch(es) for ${day}`, mismatches.map(m => ({ id: m.id, db: { c: m.completedToday, p: m.inProgress } })));
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[visit-state shadow] parity OK for ${day}`);
            }
            // Flip reads to DB for this process after successful parity
            readMode = 'db';
            if (process.env.NODE_ENV !== 'production') {
              console.log('[visit-state] flipping read mode to db for this process');
            }
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
    if (await isCompletedToday(id, userId)) return res.json({ ok: true, id, idempotent: true });
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
  if (!ensureDatabase(res)) return;
  try {
    const q = await dbQuery<{ id: number; email: string; name: string; role: string }>(
      'select id, email, name, coalesce(role, \'tech\') as role from users order by id asc'
    );
    const users = (q?.rows ?? []).map((u) => ({ ...u, role: u.role === 'admin' ? 'admin' : 'tech' }));
    res.json({ ok: true, users });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'users error' });
  }
});

app.get('/api/admin/clients', requireAuth, requireAdmin, async (_req, res) => {
  if (!ensureDatabase(res)) return;
  try {
    const q = await dbQuery<{
      id: number;
      name: string;
      address: string;
      contact_name: string | null;
      contact_phone: string | null;
      assigned_user_id: number | null;
      assigned_user_name: string | null;
      assigned_user_email: string | null;
      scheduled_time: string | null;
      timely_note: string | null;
    }>(
      `select
         c.id,
         c.name,
         c.address,
         c.contact_name,
         c.contact_phone,
         rt.user_id as assigned_user_id,
         u.name as assigned_user_name,
         u.email as assigned_user_email,
         rt.scheduled_time,
         tn.note as timely_note
       from clients c
       left join routes_today rt on rt.client_id = c.id
       left join users u on u.id = rt.user_id
       left join lateral (
         select note
         from timely_notes t
         where t.client_id = c.id and t.active
         order by t.created_at desc
         limit 1
       ) tn on true
       order by c.name asc`
    );
    res.json({ ok: true, clients: q?.rows ?? [] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
  }
});

function generatePassword(length = 12): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

app.post('/api/admin/users', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { name, email, role } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  if (!trimmedName || !trimmedEmail) {
    return res.status(400).json({ ok: false, error: 'name and email required' });
  }
  const normalizedEmail = trimmedEmail.toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizedEmail)) {
    return res.status(400).json({ ok: false, error: 'invalid email address' });
  }
  const normalizedRole: UserRole = role === 'admin' ? 'admin' : 'tech';
  const tempPassword = generatePassword();
  const passwordHash = encryptLib.encryptPassword(tempPassword);
  try {
    const result = await dbQuery<{ id: number; name: string; email: string; role: string }>(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, $4)
       returning id, name, email, coalesce(role, 'tech') as role`,
      [trimmedName, normalizedEmail, passwordHash, normalizedRole]
    );
    const user = result?.rows?.[0];
    return res.json({
      ok: true,
      user: user ? { ...user, role: user.role === 'admin' ? 'admin' : 'tech' } : null,
      tempPassword
    });
  } catch (e: any) {
    const message = String(e?.message ?? '');
    if (/duplicate key value violates unique constraint/i.test(message)) {
      return res.status(409).json({ ok: false, error: 'email already exists' });
    }
    console.error('[admin/users] create error', e);
    return res.status(500).json({ ok: false, error: 'failed to create user' });
  }
});

app.post('/api/admin/clients', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { name, address, contactName, contactPhone } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedAddress = typeof address === 'string' ? address.trim() : '';
  if (!trimmedName || !trimmedAddress) {
    return res.status(400).json({ ok: false, error: 'name and address required' });
  }
  const result = await dbQuery<{
    id: number;
    name: string;
    address: string;
    contact_name: string | null;
    contact_phone: string | null;
  }>(
    `insert into clients (name, address, contact_name, contact_phone)
     values ($1, $2, nullif($3, ''), nullif($4, ''))
     returning id, name, address, contact_name, contact_phone`,
    [trimmedName, trimmedAddress, contactName || null, contactPhone || null]
  ).catch((e: any) => {
    const message = String(e?.message ?? '');
    if (/duplicate key value violates unique constraint/i.test(message)) {
      return { error: 'duplicate' };
    }
    console.error('[admin/clients] create error', e);
    return { error: 'unknown' };
  });
  if ((result as any)?.error === 'duplicate') {
    return res.status(409).json({ ok: false, error: 'client already exists' });
  }
  if ((result as any)?.error) {
    return res.status(500).json({ ok: false, error: 'failed to create client' });
  }
  const client = (result as any)?.rows?.[0];
  return res.json({ ok: true, client });
});

app.post('/api/admin/routes/assign', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { clientId, userId, scheduledTime } = req.body ?? {};
  const cid = Number(clientId);
  if (!cid || Number.isNaN(cid)) {
    return res.status(400).json({ ok: false, error: 'invalid client' });
  }
  const clientCheck = await dbQuery<{ id: number }>('select id from clients where id = $1', [cid]);
  if (!clientCheck?.rows?.length) {
    return res.status(404).json({ ok: false, error: 'client not found' });
  }
  if (userId === null || userId === undefined || userId === '') {
    try {
      await dbQuery('delete from routes_today where client_id = $1', [cid]);
      return res.json({ ok: true, removed: true });
    } catch (e: any) {
      console.error('[admin/routes] delete error', e);
      return res.status(500).json({ ok: false, error: 'failed to remove assignment' });
    }
  }
  const uid = Number(userId);
  if (!uid || Number.isNaN(uid)) {
    return res.status(400).json({ ok: false, error: 'invalid user' });
  }
  const userCheck = await dbQuery<{ role: string }>('select coalesce(role, \'tech\') as role from users where id = $1', [uid]);
  if (!userCheck?.rows?.length) {
    return res.status(404).json({ ok: false, error: 'user not found' });
  }
  const userRole = userCheck.rows[0].role;
  if (userRole !== 'tech') {
    return res.status(400).json({ ok: false, error: 'assignment requires a field tech account' });
  }
  const time =
    typeof scheduledTime === 'string' && scheduledTime.trim()
      ? scheduledTime.trim()
      : '08:30';
  try {
    await dbQuery(
      `insert into routes_today (user_id, client_id, scheduled_time)
       values ($1, $2, $3)
       on conflict (client_id) do update set user_id = excluded.user_id, scheduled_time = excluded.scheduled_time`,
      [uid, cid, time]
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[admin/routes] assign error', e);
    return res.status(500).json({ ok: false, error: 'failed to assign client' });
  }
});

app.get('/api/admin/routes/overview', requireAuth, requireAdmin, async (_req, res) => {
  if (!ensureDatabase(res)) return;
  try {
    const result = await dbQuery<{
      user_id: number;
      user_name: string;
      user_email: string;
      client_id: number;
      client_name: string;
      address: string;
      scheduled_time: string;
    }>(
      `select
         rt.user_id,
         u.name as user_name,
         u.email as user_email,
         rt.client_id,
         c.name as client_name,
         c.address,
         rt.scheduled_time
       from routes_today rt
       join users u on u.id = rt.user_id
       join clients c on c.id = rt.client_id
       order by u.name asc, rt.scheduled_time asc, c.name asc`
    );
    res.json({ ok: true, assignments: result?.rows ?? [] });
  } catch (e: any) {
    console.error('[admin/routes] overview error', e);
    res.status(500).json({ ok: false, error: e?.message ?? 'routes overview error' });
  }
});

app.post('/api/admin/timely-notes', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { clientId, note, active } = req.body ?? {};
  const cid = Number(clientId);
  if (!cid || Number.isNaN(cid)) {
    return res.status(400).json({ ok: false, error: 'invalid client' });
  }
  const shouldActivate = active !== false;
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  if (!trimmedNote) {
    try {
      await dbQuery('update timely_notes set active = false where client_id = $1 and active', [cid]);
      return res.json({ ok: true, note: null });
    } catch (e: any) {
      console.error('[admin/timely-notes] clear error', e);
      return res.status(500).json({ ok: false, error: 'failed to clear note' });
    }
  }
  try {
    await dbQuery('update timely_notes set active = false where client_id = $1 and active', [cid]);
    const result = await dbQuery<{ id: number; note: string; created_at: string }>(
      `insert into timely_notes (client_id, note, created_by, active)
       values ($1, $2, $3, $4)
       returning id, note, created_at`,
      [cid, trimmedNote, req.user?.id ?? null, shouldActivate]
    );
    return res.json({ ok: true, note: result?.rows?.[0] ?? null });
  } catch (e: any) {
    console.error('[admin/timely-notes] create error', e);
    return res.status(500).json({ ok: false, error: 'failed to save note' });
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
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Listening on port: ${port}`);
  });
}
