import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import { getTodayRoutes, getVisit, saveVisit } from './data';

const app = express();
app.use(cors());
app.use(express.json());

// Health and metrics
app.use(healthRouter);
app.use(metricsRouter);

// Simple in-memory auth stub
const DEMO_TOKEN = 'demo-token';

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.header('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ ok: false, error: 'missing token' });
  // Accept any token for MVP; optionally enforce DEMO_TOKEN
  return next();
}

// API routes (DB-backed when configured; demo otherwise)
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body ?? {};
  // Always succeeds for MVP
  res.json({
    ok: true,
    token: DEMO_TOKEN,
    user: { id: 1, name: 'Demo User', email: email || 'demo@example.com' }
  });
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

const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
