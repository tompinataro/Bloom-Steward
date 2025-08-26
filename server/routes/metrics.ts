// server/routes/metrics.ts
import { Router } from 'express';
import client from 'prom-client';

const router = Router();

// Guard against multiple registrations in dev/hot-reload
const g: any = global as any;
if (!g.__PROM_DEFAULT_METRICS__) {
  client.collectDefaultMetrics();
  g.__PROM_DEFAULT_METRICS__ = true;
}

router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    const metrics = await client.register.metrics();
    res.end(metrics);
  } catch (err) {
    const message = (err as Error)?.message ?? 'metrics error';
    res.status(500).end(message);
  }
});

export default router;