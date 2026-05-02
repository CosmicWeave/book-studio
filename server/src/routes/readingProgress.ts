import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const readingProgress = new Hono();

// GET all reading progress records
readingProgress.get('/', async (c) => {
  const items = await prisma.readingProgress.findMany();
  return c.json(serialize(items));
});

// GET by bookId (key field)
readingProgress.get('/:bookId', async (c) => {
  const item = await prisma.readingProgress.findUnique({ where: { bookId: c.req.param('bookId') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

// PUT (upsert) – the body's id field is bookId
readingProgress.put('/:bookId', async (c) => {
  const body = await c.req.json();
  const bookId = c.req.param('bookId');
  const { bookId: _bid, ...data } = body;
  const item = await prisma.readingProgress.upsert({
    where: { bookId },
    update: data,
    create: { bookId, ...data },
  });
  return c.json(serialize(item));
});

readingProgress.delete('/:bookId', async (c) => {
  try { await prisma.readingProgress.delete({ where: { bookId: c.req.param('bookId') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

readingProgress.delete('/', async (c) => {
  await prisma.readingProgress.deleteMany();
  return c.json({ ok: true });
});

export default readingProgress;
