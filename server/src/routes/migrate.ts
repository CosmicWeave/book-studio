/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * POST /api/migrate
 *
 * Accepts a JSON dump of the browser's IndexedDB (all stores) and imports
 * it into the MariaDB database.  The payload is the object exported by the
 * "Export to Server" function in the frontend.
 *
 * This is a one-shot, additive operation – existing records are upserted
 * so it is safe to run multiple times.
 */
import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';

const migrate = new Hono();

migrate.post('/', async (c) => {
  let payload: Record<string, unknown[]>;
  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const results: Record<string, { imported: number; errors: number }> = {};

  async function importStore<T extends { id?: string; bookId?: string }>(
    storeName: string,
    records: T[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    upsertFn: (record: T) => Promise<any>,
  ) {
    let imported = 0;
    let errors = 0;
    for (const record of records) {
      try {
        await upsertFn(record);
        imported++;
      } catch (e) {
        console.error(`[migrate] ${storeName} – failed to import record:`, e);
        errors++;
      }
    }
    results[storeName] = { imported, errors };
  }

  // ── Books ──
  if (Array.isArray(payload.books)) {
    await importStore('books', payload.books as Parameters<typeof prisma.book.upsert>[0]['create'][], async (b) => {
      const { id, chatHistory, imageStyle, bookChatHistory, ...rest } = b as { id: string; chatHistory?: unknown; imageStyle?: unknown; bookChatHistory?: unknown; [k: string]: unknown };
      const data = {
        ...rest,
        bookChatHistory: bookChatHistory ?? chatHistory ?? undefined,
        // wordCountGoal may arrive as a string from old backups
        wordCountGoal: rest.wordCountGoal != null ? parseInt(String(rest.wordCountGoal), 10) || null : undefined,
      };
      await prisma.book.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Documents ──
  if (Array.isArray(payload.documents)) {
    await importStore('documents', payload.documents as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.generalDoc.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Instructions ──
  if (Array.isArray(payload.instructions)) {
    await importStore('instructions', payload.instructions as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.instructionTemplate.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Styles ──
  if (Array.isArray(payload.styles)) {
    await importStore('styles', payload.styles as { id: string; [k: string]: unknown }[], async (d) => {
      // Strip fields not in the StylePreset schema (e.g. legacy 'prompt')
      const { id, name, description } = d as { id: string; name: unknown; description: unknown; [k: string]: unknown };
      const data = { name, description };
      await prisma.stylePreset.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Snapshots ──
  if (Array.isArray(payload.snapshots)) {
    await importStore('snapshots', payload.snapshots as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.bookSnapshot.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Macros ──
  if (Array.isArray(payload.macros)) {
    await importStore('macros', payload.macros as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.macro.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Series ──
  if (Array.isArray(payload.series)) {
    await importStore('series', payload.series as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.bookSeries.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── Reading progress ──
  if (Array.isArray(payload.readingProgress)) {
    await importStore('readingProgress', payload.readingProgress as { bookId: string; [k: string]: unknown }[], async (d) => {
      const { bookId, ...data } = d;
      await prisma.readingProgress.upsert({ where: { bookId }, update: data as any, create: { bookId, ...data } as any });
    });
  }

  // ── Settings ──
  if (Array.isArray(payload.settings)) {
    await importStore('settings', payload.settings as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.setting.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  // ── History ──
  if (Array.isArray(payload.history)) {
    await importStore('history', payload.history as { id: string; [k: string]: unknown }[], async (d) => {
      const { id, ...data } = d;
      await prisma.history.upsert({ where: { id }, update: data as any, create: { id, ...data } as any });
    });
  }

  return c.json({ ok: true, results });
});

export default migrate;
