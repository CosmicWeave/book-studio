import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const settings = new Hono();

settings.get('/', async (c) => {
  const items = await prisma.setting.findMany();
  return c.json(serialize(items));
});

settings.get('/:id', async (c) => {
  const item = await prisma.setting.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

settings.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...data } = body;
  const item = await prisma.setting.upsert({
    where: { id },
    update: data,
    create: { id, ...data },
  });
  return c.json(serialize(item));
});

settings.delete('/:id', async (c) => {
  try { await prisma.setting.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

settings.delete('/', async (c) => {
  await prisma.setting.deleteMany();
  return c.json({ ok: true });
});

export default settings;
