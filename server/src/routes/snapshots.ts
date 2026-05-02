import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const snapshots = new Hono();

// GET all (optionally filtered by bookId)
snapshots.get('/', async (c) => {
  const bookId = c.req.query('bookId');
  const items = await prisma.bookSnapshot.findMany({
    where: bookId ? { bookId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  return c.json(serialize(items));
});

snapshots.get('/:id', async (c) => {
  const item = await prisma.bookSnapshot.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

snapshots.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...data } = body;
  const item = await prisma.bookSnapshot.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });
  return c.json(serialize(item));
});

snapshots.delete('/:id', async (c) => {
  try { await prisma.bookSnapshot.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

snapshots.delete('/', async (c) => {
  await prisma.bookSnapshot.deleteMany();
  return c.json({ ok: true });
});

export default snapshots;
