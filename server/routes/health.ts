import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();
const accessLogPath = path.join(process.cwd(), 'logs', 'server.log');

// Ensure logs directory exists
try {
  fs.mkdirSync(path.dirname(accessLogPath), { recursive: true });
} catch {}

router.get('/health', (_req: Request, res: Response) => {
  const ts = new Date().toISOString();
  const payload = { ok: true, ts };
  res.json(payload);

  // Append to server.log
  try {
    fs.appendFileSync(accessLogPath, `[${ts}] HEALTH endpoint called\n`);
  } catch {}
});

export default router;