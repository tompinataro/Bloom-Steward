// server/routes/health.ts
import { Router, Request, Response } from 'express';

const router = Router();

// GET /health -> { ok: true, ts: <iso> }
router.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

export default router;

// server/routes/metrics.ts
import { Router } from 'express';
import client from 'prom-client';

const router = Router();

// collect Node.js default metrics every 5 seconds
client.collectDefaultMetrics({ timeout: 5000 });

// GET /metrics -> Prometheus output
router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err: any) {
    res.status(500).end(err?.message ?? 'metrics error');
  }
});

export default router;

// server/routes/health.js
const { Router } = require('express');
const router = Router();

// GET /health -> { ok: true, ts: <iso> }
router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

module.exports = router;

// server/routes/metrics.js
const { Router } = require('express');
const client = require('prom-client');

const router = Router();

// collect Node.js default metrics every 5 seconds
client.collectDefaultMetrics({ timeout: 5000 });

// GET /metrics -> Prometheus output
router.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  } catch (err) {
    res.status(500).end(err?.message || 'metrics error');
  }
});

module.exports = router;

// server/server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const healthRouter = require('./routes/health');
const metricsRouter = require('./routes/metrics');

const app = express();

// Core middleware
app.use(helmet());
app.use(express.json());

// CORS
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// HTTP request logging
app.use(morgan(process.env.LOG_FORMAT || 'dev'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
});
app.use(limiter);

// Ops Pack routes
app.use(healthRouter);
app.use(metricsRouter);