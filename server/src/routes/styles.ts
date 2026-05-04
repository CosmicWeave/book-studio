import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const styles = new Hono();

styles.get('/', async (c) => {
  const items = await prisma.stylePreset.findMany();
  return c.json(serialize(items));
});

styles.get('/:id', async (c) => {
  const item = await prisma.stylePreset.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

styles.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...raw } = body;
  const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  const item = await prisma.stylePreset.upsert({
    where: { id },
    update: data,
    create: { name: '', description: '', ...data, id },
  });
  return c.json(serialize(item));
});

styles.delete('/:id', async (c) => {
  try { await prisma.stylePreset.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

styles.delete('/', async (c) => {
  await prisma.stylePreset.deleteMany();
  return c.json({ ok: true });
});

export default styles;
