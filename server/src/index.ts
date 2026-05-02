import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';

import booksRoute from './routes/books.js';
import documentsRoute from './routes/documents.js';
import instructionsRoute from './routes/instructions.js';
import stylesRoute from './routes/styles.js';
import snapshotsRoute from './routes/snapshots.js';
import macrosRoute from './routes/macros.js';
import seriesRoute from './routes/series.js';
import readingProgressRoute from './routes/readingProgress.js';
import settingsRoute from './routes/settings.js';
import historyRoute from './routes/history.js';
import filesRoute from './routes/files.js';
import aiRoute from './routes/ai.js';
import migrateRoute from './routes/migrate.js';
import logsRoute from './routes/logs.js';
import { prisma } from './lib/prisma.js';
import { appLog } from './lib/appLog.js';

const app = new Hono();

// ─── Middleware ──────────────────────────────────────────────────────────────

app.use('*', logger());
app.use('*', secureHeaders());

const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(
  '*',
  cors({
    origin: (origin) => (allowedOrigins.includes(origin) ? origin : allowedOrigins[0]),
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ─── Global error handler ─────────────────────────────────────────────────────

app.onError((err, c) => {
  appLog.error('hono', err.message, { stack: err.stack, path: c.req.path });
  const status = (err as { status?: number }).status ?? 500;
  return c.json({ error: err.message ?? 'Internal server error' }, status as 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/health', (c) =>
  c.json({ status: 'ok', timestamp: Date.now() }),
);

app.route('/api/books', booksRoute);
app.route('/api/documents', documentsRoute);
app.route('/api/instructions', instructionsRoute);
app.route('/api/styles', stylesRoute);
app.route('/api/snapshots', snapshotsRoute);
app.route('/api/macros', macrosRoute);
app.route('/api/series', seriesRoute);
app.route('/api/reading-progress', readingProgressRoute);
app.route('/api/settings', settingsRoute);
app.route('/api/history', historyRoute);
app.route('/api/files', filesRoute);
app.route('/api/ai', aiRoute);
app.route('/api/migrate', migrateRoute);
app.route('/api/logs', logsRoute);

// ─── Start ────────────────────────────────────────────────────────────────────

const port = parseInt(process.env.PORT ?? '3001', 10);
const host = process.env.HOST ?? '0.0.0.0';

// Verify DB connection before starting
async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    appLog.info('db', 'Connected to MariaDB');
    console.log('[db] Connected to MariaDB');
  } catch (e) {
    appLog.error('db', 'Cannot connect to database', { error: String(e) });
    console.error('[db] Cannot connect to database:', e);
    console.error('[db] Make sure MariaDB is running and DATABASE_URL is correct.');
    process.exit(1);
  }

  const server = serve({ fetch: app.fetch, port, hostname: host }, () => {
    console.log(`[server] Running at http://${host}:${port}`);
  });

  // ─── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    console.log(`[server] Received ${signal}, shutting down…`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('[server] Shutdown complete.');
      process.exit(0);
    });
    // Force exit after 10 seconds if graceful shutdown stalls
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch any errors that slip past the Hono error handler
  process.on('uncaughtException', (err) => {
    appLog.error('process', 'Uncaught exception', { message: err.message, stack: err.stack });
  });
  process.on('unhandledRejection', (reason) => {
    appLog.error('process', 'Unhandled promise rejection', { reason: String(reason) });
  });
}

start();
