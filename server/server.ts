// server/server.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';

// JS-only modules (migrate later to TS; keep require for now)
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sessionMiddleware = require('./modules/session-middleware');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const passport = require('./strategies/user.strategy');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const userRouter = require('./routes/user.router');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const visitsRouter = require('./routes/visits.router');

dotenv.config();

const app = express();
app.set('trust proxy', 1);
const PORT: number = process.env.PORT ? Number(process.env.PORT) : 5001;

// Ensure logs directory exists and set up a write stream for morgan
const logsDir = path.join(process.cwd(), 'logs');
fs.mkdirSync(logsDir, { recursive: true });
const accessLogPath = path.join(logsDir, 'server.log');
const accessLogStream = fs.createWriteStream(accessLogPath, { flags: 'a' });

// Core Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

// Console logger
app.use(morgan(process.env.LOG_FORMAT || 'dev'));
// File logger (Apache combined format)
app.use(morgan('combined', { stream: accessLogStream }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
}));

// Express Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('build'));

// Passport Session Configuration
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// Ops Routes
app.use(healthRouter);
app.use(metricsRouter);

// App Routes
app.use('/api/user', userRouter);
app.use('/api/visits', visitsRouter);

// Simple error logger to file (in addition to morgan)
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const line = `[${new Date().toISOString()}] ERROR ${err?.status || 500} ${err?.message || 'Unknown error'}\n`;
  try { fs.appendFileSync(accessLogPath, line); } catch {}
  res.status(err?.status || 500).json({ error: 'Internal Server Error' });
});

// Listen Server & Port
app.listen(PORT, () => {
  const msg = `Listening on port: ${PORT}`;
  console.log(msg);
  try { fs.appendFileSync(accessLogPath, `[${new Date().toISOString()}] ${msg}\n`); } catch {}
});
