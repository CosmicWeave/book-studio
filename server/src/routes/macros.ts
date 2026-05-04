import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const macros = new Hono();

macros.get('/', async (c) => {
  const items = await prisma.macro.findMany();
  return c.json(serialize(items));
});

macros.get('/:id', async (c) => {
  const item = await prisma.macro.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

macros.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...raw } = body;
  const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  const item = await prisma.macro.upsert({
    where: { id },
    update: data,
    create: { name: '', ...data, id },
  });
  return c.json(serialize(item));
});

macros.delete('/:id', async (c) => {
  try { await prisma.macro.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

macros.delete('/', async (c) => {
  await prisma.macro.deleteMany();
  return c.json({ ok: true });
});

export default macros;
