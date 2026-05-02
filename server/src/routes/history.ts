import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const history = new Hono();

history.get('/', async (c) => {
  const items = await prisma.history.findMany();
  return c.json(serialize(items));
});

history.get('/:id', async (c) => {
  const item = await prisma.history.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

history.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...data } = body;
  const item = await prisma.history.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });
  return c.json(serialize(item));
});

history.delete('/:id', async (c) => {
  try { await prisma.history.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

history.delete('/', async (c) => {
  await prisma.history.deleteMany();
  return c.json({ ok: true });
});

export default history;
