import express from 'express';
import cors from 'cors';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';

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

// API stubs
app.post('/api/auth/login', (req, res) => {
  const { email } = req.body ?? {};
  // Always succeeds for MVP
  res.json({
    ok: true,
    token: DEMO_TOKEN,
    user: { id: 1, name: 'Demo User', email: email || 'demo@example.com' }
  });
});

app.get('/api/routes/today', requireAuth, (_req, res) => {
  res.json({
    ok: true,
    routes: [
      { id: 101, clientName: 'Acme HQ', address: '123 Main St', scheduledTime: '09:00' },
      { id: 102, clientName: 'Blue Sky Co', address: '456 Oak Ave', scheduledTime: '10:30' },
      { id: 103, clientName: 'Sunset Mall', address: '789 Pine Rd', scheduledTime: '13:15' }
    ]
  });
});

app.get('/api/visits/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  res.json({
    ok: true,
    visit: {
      id,
      clientName: id === 101 ? 'Acme HQ' : id === 102 ? 'Blue Sky Co' : 'Sunset Mall',
      checklist: [
        { key: 'watered', label: 'Watered plants', done: false },
        { key: 'pruned', label: 'Pruned and cleaned', done: false },
        { key: 'replaced', label: 'Replaced unhealthy plants', done: false }
      ]
    }
  });
});

app.post('/api/visits/:id/submit', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { notes, checklist } = req.body ?? {};
  // Accept and echo
  res.json({ ok: true, id, received: { notes, checklist } });
});

const port = Number(process.env.PORT) || 5100;
app.listen(port, () => {
  console.log(`Listening on port: ${port}`);
});
