import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import healthRouter from './routes/health';
import metricsRouter, { requestMetrics } from './routes/metrics';
import { createAuthRouter } from './routes/auth';
import { createAdminRouter } from './routes/admin';
import { createReportsRouter } from './routes/reports';
import { createVisitsRouter } from './routes/visits';
import { dbQuery, hasDb } from './db';
import { resolveRange } from './reports/range';
import { buildSummary, buildCsv, buildHtml, sendReportEmail } from './reports/summary';
import {
  HOST,
  IS_TEST,
  PORT,
} from './config';
import { requireAuth, requireAdmin } from './auth';

if (hasDb()) {
  dbQuery('alter table users add column if not exists managed_password text').catch(() => {});
}

export const app = express();
app.use(cors());
app.use(express.json());
// Request metrics (counts + duration)
app.use(requestMetrics);

// Health and metrics
app.use(healthRouter);
app.use(metricsRouter);

app.use('/api', createVisitsRouter(requireAuth, requireAdmin));
app.use('/api/auth', createAuthRouter(requireAuth));
app.use('/api/admin', createAdminRouter(requireAuth, requireAdmin));
app.use('/api/admin/reports', createReportsRouter(requireAuth, requireAdmin));

// Admin endpoints moved to server/routes/admin.ts

// Automated report emails
if (!IS_TEST) {
  // Weekly report to Tom - every Monday at 5am
  cron.schedule('0 5 * * 1', async () => {
    console.log('[CRON] Sending weekly report to Tom');
    try {
      const { startDate, endDate } = resolveRange('weekly');
      const rows = await buildSummary(startDate, endDate);
      const csv = buildCsv(rows);
      const html = buildHtml(rows, startDate, endDate);
      await sendReportEmail(['tom@pinataro.com'], 'Field Work Summary Report (Weekly)', html, csv);
      console.log('[CRON] Weekly report sent to Tom');
    } catch (err: any) {
      console.error('[CRON] Failed to send weekly report:', err?.message);
    }
  }, {
    timezone: 'America/Chicago'
  });

  // Daily report to Tom - every day at 5am
  cron.schedule('0 5 * * *', async () => {
    console.log('[CRON] Sending daily report to Tom');
    try {
      const { startDate, endDate } = resolveRange('daily');
      const rows = await buildSummary(startDate, endDate);
      const csv = buildCsv(rows);
      const html = buildHtml(rows, startDate, endDate);
      await sendReportEmail(['tom@pinataro.com'], 'Field Work Summary Report (Daily)', html, csv);
      console.log('[CRON] Daily report sent to Tom');
    } catch (err: any) {
      console.error('[CRON] Failed to send daily report:', err?.message);
    }
  }, {
    timezone: 'America/Chicago'
  });
}

const port = PORT;
const host = HOST;
if (!IS_TEST) {
  app.listen(port, host, () => {
    console.log(`Listening on ${host}:${port}`);
  });
}
