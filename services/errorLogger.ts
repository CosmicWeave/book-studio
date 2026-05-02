/**
 * errorLogger.ts
 *
 * Lightweight frontend error logging service.
 *
 * - Stores up to 200 entries in localStorage so they survive page reloads.
 * - Forwards each entry to POST /api/logs/client so the server persists them
 *   in logs/app.log alongside server-side errors.
 * - Provides `initGlobalErrorHandlers()` to capture window.onerror and
 *   unhandledrejection automatically.
 * - Exposes `logError()` for explicit logging at call sites (API failures,
 *   React boundaries, etc.).
 *
 * Uses raw fetch / navigator.sendBeacon directly — NOT the apiClient — to
 * avoid any circular dependency.
 */

export type ErrorSource =
  | 'window'
  | 'unhandledrejection'
  | 'api'
  | 'react'
  | 'manual';

export interface ErrorEntry {
  ts: string;
  source: ErrorSource;
  message: string;
  stack?: string;
  url?: string;
  context?: unknown;
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'app:error-log';
const MAX_LOCAL = 200;

export function getLocalErrors(): ErrorEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function clearLocalErrors(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}

function storeLocal(entry: ErrorEntry): void {
  try {
    const existing = getLocalErrors();
    existing.push(entry);
    if (existing.length > MAX_LOCAL) existing.splice(0, existing.length - MAX_LOCAL);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch { /* storage full or private mode */ }
}

// ─── Server forwarding ────────────────────────────────────────────────────────

function sendToServer(entry: ErrorEntry): void {
  const body = JSON.stringify(entry);
  // sendBeacon works even during page unload; fall back to fetch if unavailable
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const sent = navigator.sendBeacon('/api/logs/client', new Blob([body], { type: 'application/json' }));
    if (sent) return;
  }
  fetch('/api/logs/client', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => { /* server unreachable — local storage is the fallback */ });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Log an error. Stores it locally and forwards it to the server.
 *
 * @param error   The caught error or any value
 * @param source  Where in the app the error originated
 * @param context Optional additional data (e.g. the failed API path)
 */
export function logError(
  error: unknown,
  source: ErrorSource = 'manual',
  context?: unknown,
): void {
  const entry: ErrorEntry = {
    ts: new Date().toISOString(),
    source,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    ...(context !== undefined ? { context } : {}),
  };
  storeLocal(entry);
  sendToServer(entry);
}

/**
 * Call once at app startup to capture uncaught JS errors and unhandled
 * promise rejections globally.
 */
export function initGlobalErrorHandlers(): void {
  window.addEventListener('error', (ev) => {
    logError(
      ev.error ?? new Error(ev.message),
      'window',
      { filename: ev.filename, lineno: ev.lineno, colno: ev.colno },
    );
  });

  window.addEventListener('unhandledrejection', (ev) => {
    logError(
      ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason ?? 'Unhandled rejection')),
      'unhandledrejection',
    );
  });
}
