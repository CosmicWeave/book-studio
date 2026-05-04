import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const series = new Hono();

series.get('/', async (c) => {
  const items = await prisma.bookSeries.findMany();
  return c.json(serialize(items));
});

series.get('/:id', async (c) => {
  const item = await prisma.bookSeries.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

series.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...raw } = body;
  const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  const item = await prisma.bookSeries.upsert({
    where: { id },
    update: data,
    create: { title: '', ...data, id },
  });
  return c.json(serialize(item));
});

series.delete('/:id', async (c) => {
  try { await prisma.bookSeries.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

series.delete('/', async (c) => {
  await prisma.bookSeries.deleteMany();
  return c.json({ ok: true });
});

export default series;
