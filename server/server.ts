import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import nodemailer from 'nodemailer';
import healthRouter from './routes/health';
import metricsRouter, { requestMetrics } from './routes/metrics';
import { getTodayRoutes, getVisit, saveVisit, buildReportRows } from './data';
import { dbQuery, hasDb } from './db';
const encryptLib = require('./modules/encryption') as {
  encryptPassword: (password: string) => string;
  comparePassword: (candidate: string, stored: string) => boolean;
};

const SMTP_URL = process.env.SMTP_URL || '';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || (SMTP_PORT === 465);

type MailTransport = ReturnType<typeof nodemailer.createTransport>;
let mailTransport: MailTransport | null = null;
if (SMTP_URL) {
  mailTransport = nodemailer.createTransport(SMTP_URL);
} else if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  mailTransport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT || 587,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

type ReportRow = {
  techId: number;
  techName: string;
  routeName: string | null;
  clientName: string;
  address: string;
  checkInTs: string | null;
  checkOutTs: string | null;
  durationMinutes: number;
  durationFormatted: string;
  onSiteContact?: string | null;
  odometerReading?: number | null;
  mileageDelta: number;
  distanceFromClientFeet?: number | null;
  geoValidated?: boolean;
  managedPassword?: string | null;
};

function haversineMiles(lat1?: number | null, lon1?: number | null, lat2?: number | null, lon2?: number | null) {
  if (
    lat1 === undefined ||
    lon1 === undefined ||
    lat2 === undefined ||
    lon2 === undefined ||
    lat1 === null ||
    lon1 === null ||
    lat2 === null ||
    lon2 === null
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatDuration(minutes: number) {
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function resolveRange(frequency: string, explicitStart?: string, explicitEnd?: string) {
  let end = explicitEnd ? new Date(explicitEnd) : new Date();
  let start = explicitStart ? new Date(explicitStart) : new Date();
  const now = new Date();
  if (!explicitStart || !explicitEnd) {
    end = now;
    start = new Date(now);
    switch (frequency) {
      case 'daily':
        start.setDate(now.getDate() - 1);
        break;
      case 'weekly':
        start.setDate(now.getDate() - 7);
        break;
      case 'payperiod':
        start.setDate(now.getDate() - 14);
        break;
      case 'monthly':
        start.setDate(now.getDate() - 30);
        break;
      default:
        start.setDate(now.getDate() - 7);
        break;
    }
  }
  return { startDate: start, endDate: end };
}

async function buildSummary(startDate: Date, endDate: Date): Promise<ReportRow[]> {
  const rawRows = await buildReportRows(startDate, endDate);
  // Keep only the latest submission per visit to avoid duplicate summary rows.
  // Use multiple dedup keys: visit_id first, then fallback to tech+client+address+timestamp.
  const latestByVisit = new Map<number, typeof rawRows[number]>();
  const latestByComposite = new Map<string, typeof rawRows[number]>();
  
  for (let i = rawRows.length - 1; i >= 0; i--) {
    const row = rawRows[i];
    
    // Primary dedup by visit_id (most reliable)
    if (row.visit_id) {
      if (!latestByVisit.has(row.visit_id)) {
        latestByVisit.set(row.visit_id, row);
      }
      continue;
    }
    
    // Secondary dedup by tech+client+address+timestamp (for rows without visit_id)
    const ts = (row.payload && (row.payload.checkOutTs || row.payload.checkInTs)) || row.created_at || '';
    const compositeKey = `${row.tech_id || 'tech'}|${(row.client_name || '').trim().toLowerCase()}|${(row.address || '').trim().toLowerCase()}|${ts}`;
    if (!latestByComposite.has(compositeKey)) {
      latestByComposite.set(compositeKey, row);
    }
  }
  
  // Merge both maps, preferring visit-based entries
  const allDeduped = new Map<string, typeof rawRows[number]>();
  latestByVisit.forEach((row, visitId) => allDeduped.set(`visit:${visitId}`, row));
  latestByComposite.forEach((row, key) => allDeduped.set(`composite:${key}`, row));
  
  const dedupedRows = Array.from(allDeduped.values()).sort((a, b) => {
    const aTech = (a.tech_name || '').toLowerCase();
    const bTech = (b.tech_name || '').toLowerCase();
    if (aTech !== bTech) return aTech < bTech ? -1 : 1;
    const aTs = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bTs = b.created_at ? new Date(b.created_at).getTime() : 0;
    return aTs - bTs;
  });
  
  // Get all unique tech IDs from deduped rows
  const uniqueTechIds = Array.from(new Set(dedupedRows.map(r => r.tech_id).filter(Boolean))) as number[];
  
  // Fetch managed passwords for each tech
  const techPasswords = new Map<number, string | null>(); // key: tech_id
  if (uniqueTechIds.length > 0 && hasDb()) {
    const pwResult = await dbQuery<{ id: number; managed_password: string | null }>(
      `select id, managed_password from users where id = any($1)`,
      [uniqueTechIds]
    );
    (pwResult?.rows || []).forEach(row => {
      techPasswords.set(row.id, row.managed_password);
    });
  }
  
  // Fetch daily_start_odometer for each tech and each day in the range
  const dailyStartOdometers = new Map<string, number>(); // key: "tech_id|date"
  if (uniqueTechIds.length > 0 && hasDb()) {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    const result = await dbQuery<{ user_id: number; date: string; odometer_reading: number }>(
      `select user_id, date, odometer_reading from daily_start_odometer
       where user_id = any($1) and date >= $2 and date <= $3
       order by user_id, date`,
      [uniqueTechIds, startDateStr, endDateStr]
    );
    (result?.rows || []).forEach(row => {
      // Ensure we store a numeric value (db driver may return numeric as string)
      const val = typeof row.odometer_reading === 'number' ? row.odometer_reading : Number(row.odometer_reading);
      if (!Number.isNaN(val)) {
        // Normalize the date portion to YYYY-MM-DD in case the driver returned a Date object
        const rowDateStr = typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().split('T')[0];
        dailyStartOdometers.set(`${row.user_id}|${rowDateStr}`, val);
      }
    });
  }
  
  const rows: ReportRow[] = [];
  const seenTechClient = new Set<string>(); // Track tech+client combinations to prevent dupes
  
  for (const row of dedupedRows) {
    if (!row.tech_id || !row.tech_name) continue;
    const techName = row.tech_name.trim();
    // Skip demo or test users
    if (/^demo\b/i.test(techName)) continue;
    
    // Skip duplicate tech+client combinations (only show first/latest per pair)
    const techClientKey = `${row.tech_id}|${(row.client_name || '').trim().toLowerCase()}`;
    if (seenTechClient.has(techClientKey)) continue;
    seenTechClient.add(techClientKey);
    const payload = row.payload || {};
    // Normalize timestamps to ISO (T) format for client-side parsing
    let checkInTs: string | null = null;
    let checkOutTs: string | null = null;
    try {
      if (typeof payload.checkInTs === 'string') {
        const d = new Date(payload.checkInTs);
        if (!Number.isNaN(d.getTime())) checkInTs = d.toISOString();
      }
    } catch {}
    try {
      if (typeof payload.checkOutTs === 'string') {
        const d = new Date(payload.checkOutTs);
        if (!Number.isNaN(d.getTime())) checkOutTs = d.toISOString();
      }
    } catch {}
    const inDate = checkInTs ? new Date(checkInTs) : null;
    const outDate = checkOutTs ? new Date(checkOutTs) : null;
    const durationMinutes = inDate && outDate ? Math.max(0, (outDate.getTime() - inDate.getTime()) / 60000) : 0;
    const durationFormatted = formatDuration(durationMinutes);
    const onSiteContact = payload.onSiteContact || null;
    const odometerReading = payload.odometerReading ? Number(payload.odometerReading) : null;
    
    // Calculate mileage delta from start-of-day odometer (fetched from daily_start_odometer table)
    let mileageDelta = 0;
    if (odometerReading !== null && Number.isFinite(odometerReading) && row.tech_id && checkOutTs) {
      // Normalize checkOutTs to an ISO date string then extract YYYY-MM-DD.
      // Some stored timestamps come as space-separated ("YYYY-MM-DD HH:MM:SS"),
      // so replace the first space with 'T' before parsing to avoid mismatched keys.
      let dateStr = '';
      try {
        const normalized = (checkOutTs || '').replace(' ', 'T');
        const parsed = new Date(normalized);
        if (!Number.isNaN(parsed.getTime())) {
          dateStr = parsed.toISOString().split('T')[0];
        } else {
          // Fallback: if parsing fails, try splitting on 'T' or space and take first segment
          dateStr = (checkOutTs.indexOf('T') >= 0 ? checkOutTs.split('T')[0] : checkOutTs.split(' ')[0]) || '';
        }
      } catch (err) {
        dateStr = (checkOutTs.indexOf('T') >= 0 ? checkOutTs.split('T')[0] : checkOutTs.split(' ')[0]) || '';
      }

      if (dateStr) {
        const dailyStartKey = `${row.tech_id}|${dateStr}`;
        const dailyStartOdom = dailyStartOdometers.get(dailyStartKey);
        if (typeof dailyStartOdom === 'number' && odometerReading >= dailyStartOdom) {
          mileageDelta = odometerReading - dailyStartOdom;
        }
      }
    }
    const rawLoc = payload.checkOutLoc || payload.checkInLoc;
    let geoValidated: boolean | undefined = undefined;
    if (rawLoc && typeof rawLoc.lat === 'number' && typeof rawLoc.lng === 'number') {
      const distMiles = haversineMiles(row.latitude, row.longitude, rawLoc.lat, rawLoc.lng);
      if (distMiles !== null) {
        // keep only boolean validation (within 100 feet)
        geoValidated = (distMiles * 5280) <= 100;
      }
    }
    rows.push({
      techId: row.tech_id,
      techName: row.tech_name,
      routeName: row.route_name,
      clientName: row.client_name,
      address: row.address,
      checkInTs,
      checkOutTs,
      durationMinutes,
      durationFormatted,
      onSiteContact,
      odometerReading,
      mileageDelta,
      geoValidated,
      managedPassword: row.tech_id ? techPasswords.get(row.tech_id) || null : null,
    });
  }
  if (!rows.length && hasDb()) {
    const fallback = await dbQuery<{
      tech_id: number | null;
      tech_name: string | null;
      route_name: string | null;
      client_name: string;
      address: string;
    }>(
      `select distinct on (sr.id, c.id)
         u.id as tech_id,
         u.name as tech_name,
         sr.name as route_name,
         c.name as client_name,
         c.address
       from clients c
       join service_routes sr on sr.id = c.service_route_id
       left join users u on u.id = sr.user_id
       order by sr.id, c.id, c.name asc`
    );
    const seenTechClient = new Set<string>();
    (fallback?.rows || []).forEach(row => {
      const techClientKey = `${row.tech_id || 0}|${(row.client_name || '').trim().toLowerCase()}`;
      if (seenTechClient.has(techClientKey)) return;
      seenTechClient.add(techClientKey);
      rows.push({
        techId: row.tech_id || 0,
        techName: row.tech_name || 'Unassigned',
        routeName: row.route_name,
        clientName: row.client_name,
        address: row.address,
        checkInTs: null,
        checkOutTs: null,
        durationMinutes: 0,
        durationFormatted: '00:00',
        onSiteContact: null,
        odometerReading: null,
        mileageDelta: 0,
        geoValidated: false,
      });
    });
  }
  return rows;
}

function buildCsv(rows: ReportRow[]) {
  const header = [
    'Technician',
    'Password',
    'Route',
    'Client Location',
    'Address',
    'Check-In',
    'Check-Out',
    'Duration',
    'Mileage Delta',
    'On-site Contact',
    'Geo Distance (ft)',
    'Geo Validated',
  ];
  const lines = [header.join(',')];
  rows.forEach(row => {
    lines.push([
      row.techName,
      row.managedPassword || '',
      row.routeName || '',
      row.clientName,
      row.address.replace(/,/g, ' '),
      row.checkInTs || '',
      row.checkOutTs || '',
      row.durationFormatted,
      row.mileageDelta.toFixed(2),
      row.onSiteContact || '',
      row.geoValidated ? 'Yes' : 'No',
    ].join(','));
  });
  return lines.join('\n');
}

function buildHtml(rows: ReportRow[], start: Date, end: Date) {
  const rowsHtml = rows.map(row => `
    <tr>
      <td>${row.techName}</td>
      <td>${row.routeName || ''}</td>
      <td>${row.clientName}</td>
      <td>${row.address}</td>
      <td>${row.checkInTs || ''}</td>
      <td>${row.checkOutTs || ''}</td>
      <td>${row.durationFormatted}</td>
      <td>${row.mileageDelta.toFixed(2)}</td>
      <td>${row.onSiteContact || ''}</td>
      <td>${row.geoValidated ? 'Yes' : 'No'}</td>
    </tr>
  `).join('');
  return `
    <h2>Field Tech Summary</h2>
    <p>Period: ${start.toISOString()} - ${end.toISOString()}</p>
    <table border="1" cellpadding="6" cellspacing="0">
      <thead>
        <tr>
          <th>Technician</th>
          <th>Route</th>
          <th>Client</th>
          <th>Address</th>
          <th>Check-In</th>
          <th>Check-Out</th>
          <th>Duration</th>
          <th>Mileage Delta</th>
          <th>On-site Contact</th>
          <th>Geo Valid</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
  `;
}

async function sendReportEmail(to: string[], subject: string, html: string, csv: string) {
  if (!mailTransport) {
    throw new Error('SMTP_URL not configured for report emails.');
  }
  await mailTransport.sendMail({
    from: SMTP_USER || undefined,
    to,
    subject,
    html,
    text: 'Attached is your Field Technician summary report.',
    attachments: [
      {
        filename: 'field-tech-summary.csv',
        content: csv,
      },
    ],
  });
}

// In-memory visit state (Sprint 5 Phase A)
// Keyed by day + visit id + user id. Example: 2025-09-09:101:1
type VisitState = { completed?: boolean; inProgress?: boolean; updatedAt: string };
const stateMap = new Map<string, VisitState>();

if (hasDb()) {
  dbQuery('alter table users add column if not exists managed_password text').catch(() => {});
}
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
type JwtUser = { id: number; email: string; name: string; role?: UserRole; mustChangePassword?: boolean };

function signToken(user: JwtUser) {
  return jwt.sign({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role || 'tech',
    mustChangePassword: user.mustChangePassword || false,
  }, JWT_SECRET, { expiresIn: '12h' });
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
    req.user = { id: Number(payload.sub), email: payload.email, name: payload.name, role: payload.role, mustChangePassword: !!payload.mustChangePassword };
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
      const result = await dbQuery<{ id: number; email: string; name: string; password_hash: string | null; role: string; must_change_password: boolean; managed_password: string | null }>(
        `select id, email, name, password_hash, coalesce(role, 'tech') as role, must_change_password, managed_password
         from users
         where lower(email) = lower($1)
         limit 1`,
        [email]
      );
      const record = result?.rows?.[0];
      if (record) {
        const passwordMatches = !!(record.password_hash && encryptLib.comparePassword(password, record.password_hash));
        const managedMatches = !!(record.managed_password && password === record.managed_password);
        if (managedMatches && !passwordMatches) {
          try {
            const newHash = encryptLib.encryptPassword(password);
            await dbQuery('update users set password_hash = $1 where id = $2', [newHash, record.id]);
          } catch (rehashErr) {
            console.warn('[auth/login] failed to rehash managed password', rehashErr);
          }
        }
        if (passwordMatches || managedMatches) {
          const role: UserRole = record.role === 'admin' ? 'admin' : 'tech';
          const user: JwtUser = { id: record.id, name: record.name, email: record.email, role, mustChangePassword: !!record.must_change_password };
          const token = signToken(user);
          return res.json({ ok: true, token, user });
        }
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
    const user: JwtUser = { id: isAdmin ? 9991 : 9990, name: isAdmin ? 'Admin User' : 'Demo User', email, role: isAdmin ? 'admin' : 'tech', mustChangePassword: false };
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

app.post('/api/auth/password', requireAuth, async (req, res) => {
  if (!ensureDatabase(res)) return;
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';
    if (newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
    }
    const hash = encryptLib.encryptPassword(newPassword);
    await dbQuery('update users set password_hash = $1, must_change_password = false where id = $2', [hash, userId]);
    const updatedUser: JwtUser = {
      id: req.user!.id,
      email: req.user!.email,
      name: req.user!.name,
      role: req.user!.role,
      mustChangePassword: false,
    };
    const token = signToken(updatedUser);
    return res.json({ ok: true, user: updatedUser, token });
  } catch (err) {
    console.error('[auth/password] failed to update password', err);
    return res.status(500).json({ ok: false, error: 'password update failed' });
  }
});

// Store daily start odometer for mileage tracking
app.post('/api/auth/start-odometer', requireAuth, async (req, res) => {
  if (!ensureDatabase(res)) return;
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const odometerReading = typeof req.body?.odometerReading === 'string' ? parseFloat(req.body.odometerReading) : null;
    if (odometerReading === null || Number.isNaN(odometerReading)) {
      return res.status(400).json({ ok: false, error: 'invalid odometer reading' });
    }
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const result = await dbQuery<{ id: number; odometer_reading: number }>(
      `insert into daily_start_odometer (user_id, date, odometer_reading)
       values ($1, $2, $3)
       on conflict (user_id, date) do update set odometer_reading = $3
       returning id, odometer_reading`,
      [userId, today, odometerReading]
    );
    return res.json({ ok: true, odometerReading: result?.rows?.[0]?.odometer_reading });
  } catch (err: any) {
    console.error('[auth/start-odometer] failed to save', err);
    return res.status(500).json({ ok: false, error: 'failed to save odometer' });
  }
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
    const q = await dbQuery<{ id: number; email: string; name: string; role: string; managed_password: string | null }>(
      'select id, email, name, coalesce(role, \'tech\') as role, managed_password from users order by id asc'
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
    const columns = await dbQuery<{ column_name: string }>(
      `select column_name
         from information_schema.columns
        where table_name = 'clients'
          and column_name in ('latitude','longitude')`
    );
    const hasLatitude = (columns?.rows || []).some(col => col.column_name === 'latitude');
    const hasLongitude = (columns?.rows || []).some(col => col.column_name === 'longitude');
    const select = `
       select
         c.id,
         c.name,
         c.address,
         c.contact_name,
         c.contact_phone,
         sr.id as service_route_id,
         sr.name as service_route_name,
         ${hasLatitude ? 'c.latitude' : 'null as latitude'},
         ${hasLongitude ? 'c.longitude' : 'null as longitude'},
         rt.scheduled_time
       from clients c
       left join service_routes sr on sr.id = c.service_route_id
       left join routes_today rt on rt.client_id = c.id
       order by c.service_route_id asc nulls last, rt.scheduled_time asc nulls last, c.name asc`;
    const q = await dbQuery<{
      id: number;
      name: string;
      address: string;
      contact_name: string | null;
      contact_phone: string | null;
      service_route_id: number | null;
      service_route_name: string | null;
      latitude: number | null;
      longitude: number | null;
      scheduled_time: string | null;
    }>(select);
    res.json({ ok: true, clients: q?.rows ?? [] });
  } catch (e: any) {
    console.error('[admin/clients] error', e);
    res.status(500).json({ ok: false, error: e?.message ?? 'clients error' });
  }
});

app.get('/api/admin/service-routes', requireAuth, requireAdmin, async (_req, res) => {
  if (!ensureDatabase(res)) return;
  try {
    const q = await dbQuery<{
      id: number;
      name: string;
      user_id: number | null;
      user_name: string | null;
      user_email: string | null;
    }>(
      `select sr.id, sr.name, sr.user_id, u.name as user_name, u.email as user_email
       from service_routes sr
       left join users u on u.id = sr.user_id
       order by sr.name asc`
    );
    res.json({ ok: true, routes: q?.rows ?? [] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'service routes error' });
  }
});

app.post('/api/admin/service-routes', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const rawName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!rawName) {
    return res.status(400).json({ ok: false, error: 'route name required' });
  }
  try {
    const insert = await dbQuery<{ id: number; name: string }>(
      `insert into service_routes (name) values ($1) returning id, name`,
      [rawName]
    );
    const route = insert?.rows?.[0];
    return res.json({ ok: true, route });
  } catch (e: any) {
    const message = String(e?.message ?? '');
    if (/duplicate key value violates unique constraint/i.test(message)) {
      return res.status(409).json({ ok: false, error: 'route name already exists' });
    }
    console.error('[service-routes] create error', e);
    return res.status(500).json({ ok: false, error: 'failed to create route' });
  }
});

function generatePassword(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 3; i += 1) {
    out += letters[bytes[i] % letters.length];
  }
  for (let i = 3; i < 6; i += 1) {
    out += digits[bytes[i] % digits.length];
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
    const result = await dbQuery<{ id: number; name: string; email: string; role: string; must_change_password: boolean; managed_password: string | null }>(
      `insert into users (name, email, password_hash, role, must_change_password, managed_password)
       values ($1, $2, $3, $4, true, $5)
       returning id, name, email, coalesce(role, 'tech') as role, must_change_password, managed_password`,
      [trimmedName, normalizedEmail, passwordHash, normalizedRole, tempPassword]
    );
    const user = result?.rows?.[0];
    return res.json({
      ok: true,
      user: user ? { ...user, role: user.role === 'admin' ? 'admin' : 'tech', mustChangePassword: !!user.must_change_password } : null,
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

app.post('/api/admin/users/:id/password', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const userId = Number(req.params.id);
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ ok: false, error: 'invalid user id' });
  }
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword.trim() : '';
  if (newPassword.length < 8) {
    return res.status(400).json({ ok: false, error: 'password must be at least 8 characters' });
  }
  try {
    const hash = encryptLib.encryptPassword(newPassword);
    await dbQuery('update users set password_hash = $1, managed_password = $2, must_change_password = false where id = $3', [hash, newPassword, userId]);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[admin/users/password] update error', err);
    res.status(500).json({ ok: false, error: 'failed to update password' });
  }
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const userId = Number(req.params.id);
  if (!userId || Number.isNaN(userId)) {
    return res.status(400).json({ ok: false, error: 'invalid user id' });
  }
  const { name, email, phone, managed_password } = req.body ?? {};
  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (typeof name === 'string' && name.trim()) {
    updates.push(`name = $${idx++}`);
    values.push(name.trim());
  }
  if (typeof email === 'string' && email.trim()) {
    updates.push(`email = $${idx++}`);
    values.push(email.trim());
  }
  if (typeof phone === 'string') {
    updates.push(`phone = $${idx++}`);
    values.push(phone.trim() || null);
  }
  if (typeof managed_password === 'string' && managed_password.trim()) {
    const hash = encryptLib.encryptPassword(managed_password.trim());
    updates.push(`password_hash = $${idx++}`);
    values.push(hash);
    updates.push(`managed_password = $${idx++}`);
    values.push(managed_password.trim());
    updates.push(`must_change_password = false`);
  }

  if (!updates.length) {
    return res.status(400).json({ ok: false, error: 'no fields to update' });
  }

  values.push(userId);
  try {
    const result = await dbQuery<{ id: number; name: string; email: string; role: string; managed_password: string | null; phone: string | null }>(
      `update users set ${updates.join(', ')} where id = $${idx} returning id, name, email, role, managed_password, phone`,
      values
    );
    if (!result?.rows?.length) {
      return res.status(404).json({ ok: false, error: 'user not found' });
    }
    res.json({ ok: true, user: result.rows[0] });
  } catch (err: any) {
    console.error('[admin/users/update] error', err);
    res.status(500).json({ ok: false, error: 'failed to update user' });
  }
});

app.post('/api/admin/clients', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { name, address, contactName, contactPhone, latitude, longitude } = req.body ?? {};
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedAddress = typeof address === 'string' ? address.trim() : '';
  if (!trimmedName || !trimmedAddress) {
    return res.status(400).json({ ok: false, error: 'name and address required' });
  }
  const latValue = latitude !== undefined && latitude !== null ? Number(latitude) : null;
  const lngValue = longitude !== undefined && longitude !== null ? Number(longitude) : null;
  const result = await dbQuery<{
    id: number;
    name: string;
    address: string;
    contact_name: string | null;
    contact_phone: string | null;
    latitude: number | null;
    longitude: number | null;
  }>(
    `insert into clients (name, address, contact_name, contact_phone, latitude, longitude)
     values ($1, $2, nullif($3, ''), nullif($4, ''), $5, $6)
     returning id, name, address, contact_name, contact_phone, latitude, longitude`,
    [trimmedName, trimmedAddress, contactName || null, contactPhone || null, latValue, lngValue]
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

app.post('/api/admin/clients/:id/service-route', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const clientId = Number(req.params.id);
  if (!clientId || Number.isNaN(clientId)) {
    return res.status(400).json({ ok: false, error: 'invalid client id' });
  }
  const routeInput = req.body?.serviceRouteId;
  const routeId = routeInput === null || routeInput === undefined ? null : Number(routeInput);
  if (routeId !== null && Number.isNaN(routeId)) {
    return res.status(400).json({ ok: false, error: 'invalid route id' });
  }
  try {
    await dbQuery('update clients set service_route_id = $1 where id = $2', [routeId, clientId]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[clients/service-route] update error', e);
    res.status(500).json({ ok: false, error: 'failed to update client route' });
  }
});

app.post('/api/admin/service-routes/:id/tech', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const routeId = Number(req.params.id);
  if (!routeId || Number.isNaN(routeId)) {
    return res.status(400).json({ ok: false, error: 'invalid route id' });
  }
  const userInput = req.body?.userId;
  const userId = userInput === null || userInput === undefined ? null : Number(userInput);
  if (userId !== null && Number.isNaN(userId)) {
    return res.status(400).json({ ok: false, error: 'invalid user id' });
  }
  try {
    await dbQuery('update service_routes set user_id = $1 where id = $2', [userId, routeId]);
    res.json({ ok: true });
  } catch (e: any) {
    console.error('[service-routes/tech] update error', e);
    res.status(500).json({ ok: false, error: 'failed to assign tech' });
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

app.post('/api/admin/reports/summary', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { frequency = 'weekly', startDate, endDate } = req.body ?? {};
  const range = resolveRange(frequency, startDate, endDate);
  try {
    const rows = await buildSummary(range.startDate, range.endDate);
    res.json({
      ok: true,
      range: { start: range.startDate.toISOString(), end: range.endDate.toISOString(), frequency },
      rows,
    });
  } catch (err: any) {
    console.error('[reports/summary] error', err);
    res.status(500).json({ ok: false, error: err?.message ?? 'failed to build summary' });
  }
});

app.post('/api/admin/reports/email', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const { emails, frequency = 'weekly', startDate, endDate } = req.body ?? {};
  let targets: string[] = [];
  if (Array.isArray(emails)) {
    targets = emails.filter(Boolean);
  } else if (typeof emails === 'string') {
    targets = emails.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (!targets.length) {
    return res.status(400).json({ ok: false, error: 'recipient emails required' });
  }
  const range = resolveRange(frequency, startDate, endDate);
  try {
    const rows = await buildSummary(range.startDate, range.endDate);
    const csv = buildCsv(rows);
    const html = buildHtml(rows, range.startDate, range.endDate);
    await sendReportEmail(targets, `Field Tech Summary (${frequency})`, html, csv);
    res.json({
      ok: true,
      sentTo: targets,
      range: { start: range.startDate.toISOString(), end: range.endDate.toISOString(), frequency },
    });
  } catch (err: any) {
    console.error('[reports/email] error', err);
    res.status(500).json({ ok: false, error: err?.message ?? 'failed to send report' });
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

// Admin utility — run the SQL seed file on the configured database.
// POST /api/admin/run-seed
app.post('/api/admin/run-seed', requireAuth, requireAdmin, async (req, res) => {
  if (!ensureDatabase(res)) return;
  const fs = require('fs');
  const path = require('path');
  try {
    const seedPath = path.join(__dirname, 'sql', 'seed.sql');
    const raw = fs.readFileSync(seedPath, 'utf8');
    // Remove SQL comments that start with -- and split on semicolons followed by newline
    const cleaned = raw.replace(/--.*$/gm, '\n');
    const parts = cleaned.split(/;\s*\n/).map((s: string) => s.trim()).filter(Boolean);
    // Run in a transaction
    await dbQuery('BEGIN');
    for (const stmt of parts) {
      // Some parts may still be empty after cleaning
      if (!stmt) continue;
      await dbQuery(stmt);
    }
    await dbQuery('COMMIT');
    res.json({ ok: true, appliedStatements: parts.length });
  } catch (e: any) {
    try { await dbQuery('ROLLBACK'); } catch {}
    console.error('[admin/run-seed] error', e);
    res.status(500).json({ ok: false, error: e?.message ?? 'failed to run seed' });
  }
});

const port = Number(process.env.PORT) || 5100;
const host = process.env.HOST || '0.0.0.0';
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });
}
