/**
 * logs.ts — /api/logs
 *
 * POST /api/logs/client  — receive structured error reports from the browser
 * GET  /api/logs          — return the last N log entries as a JSON array
 */

import { Hono } from 'hono';
import { existsSync, readFileSync } from 'node:fs';
import { appLog, LOG_FILE } from '../lib/appLog.js';

const logsRoute = new Hono();

/** Maximum lines that can be fetched in one request. */
const MAX_TAIL = 500;

// ── POST /api/logs/client ──────────────────────────────────────────────────
// The browser sends this when it catches a JS error, unhandled rejection, or
// React boundary error.
logsRoute.post('/client', async (c) => {
  try {
    const body = await c.req.json();
    appLog.error('client', body.message ?? 'unknown client error', {
      source:  body.source,
      stack:   body.stack,
      url:     body.url,
      context: body.context,
      clientTs: body.ts,
    });
  } catch {
    // Ignore malformed payloads – the browser may retry on the next error.
  }
  return c.json({ ok: true }, 202);
});

// ── GET /api/logs?n=200 ────────────────────────────────────────────────────
// Returns the last `n` log lines (default 200, max 500) parsed as JSON.
logsRoute.get('/', (c) => {
  if (!existsSync(LOG_FILE)) return c.json([]);

  const n = Math.min(
    parseInt(c.req.query('n') ?? '200', 10) || 200,
    MAX_TAIL,
  );

  try {
    const entries = readFileSync(LOG_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .slice(-n)
      .map((line) => {
        try { return JSON.parse(line); }
        catch { return { raw: line }; }
      });
    return c.json(entries);
  } catch {
    return c.json({ error: 'Could not read log file' }, 500);
  }
});

export default logsRoute;
