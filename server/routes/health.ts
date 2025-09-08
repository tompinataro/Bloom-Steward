import { Router } from 'express';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString(), message: 'healthy' });
});

export default router;
