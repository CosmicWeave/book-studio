import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const documents = new Hono();

documents.get('/', async (c) => {
  const items = await prisma.generalDoc.findMany({ orderBy: { updatedAt: 'desc' } });
  return c.json(serialize(items));
});

documents.get('/:id', async (c) => {
  const item = await prisma.generalDoc.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

documents.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...raw } = body;
  const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  const now = Date.now();
  const item = await prisma.generalDoc.upsert({
    where: { id },
    update: data,
    create: { title: '', content: '', createdAt: now, updatedAt: now, ...data, id },
  });
  return c.json(serialize(item));
});

documents.delete('/:id', async (c) => {
  try { await prisma.generalDoc.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

documents.delete('/', async (c) => {
  await prisma.generalDoc.deleteMany();
  return c.json({ ok: true });
});

export default documents;
