/**
 * appLog.ts
 *
 * Structured JSON logger. Writes one JSON line per entry to logs/app.log
 * (relative to the server process cwd) and mirrors output to the console.
 *
 * Kept dependency-free so it can be imported anywhere in the server without
 * risk of circular imports.
 */

import { appendFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const LOG_DIR = process.env.LOG_DIR ?? resolve(process.cwd(), 'logs');
export const LOG_FILE = resolve(LOG_DIR, 'app.log');

// Ensure directory exists eagerly so every write succeeds.
try {
  mkdirSync(LOG_DIR, { recursive: true });
} catch {
  /* already exists */
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  ts: string;
  level: LogLevel;
  source: string;
  message: string;
  meta?: unknown;
}

function write(level: LogLevel, source: string, message: string, meta?: unknown): void {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    source,
    message,
    ...(meta !== undefined ? { meta } : {}),
  };

  // Persist to file
  try {
    appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {
    // Never throw from the logger itself
  }

  // Mirror to console
  const label = `[${source}] ${message}`;
  if (level === 'error') console.error(label, meta ?? '');
  else if (level === 'warn') console.warn(label, meta ?? '');
  else console.log(label, meta ?? '');
}

export const appLog = {
  info:  (source: string, message: string, meta?: unknown) => write('info',  source, message, meta),
  warn:  (source: string, message: string, meta?: unknown) => write('warn',  source, message, meta),
  error: (source: string, message: string, meta?: unknown) => write('error', source, message, meta),
};
