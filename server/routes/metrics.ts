import { Router, Request, Response } from 'express';
import client from 'prom-client';

const router = Router();

// Use default interval; newer prom-client types no longer accept { timeout }
client.collectDefaultMetrics();

// GET /metrics -> Prometheus output
router.get('/metrics', async (_req: Request, res: Response) => {
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
