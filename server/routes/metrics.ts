// server/routes/metrics.ts
import { Router } from 'express';
import client from 'prom-client';

const router = Router();

// Initialize default metrics once at process start
client.collectDefaultMetrics();

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