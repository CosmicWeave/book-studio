import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const instructions = new Hono();

instructions.get('/', async (c) => {
  const items = await prisma.instructionTemplate.findMany();
  return c.json(serialize(items));
});

instructions.get('/:id', async (c) => {
  const item = await prisma.instructionTemplate.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

instructions.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const { id: _id, ...raw } = body;
  const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
  const item = await prisma.instructionTemplate.upsert({
    where: { id },
    update: data,
    create: { name: '', prompt: '', ...data, id },
  });
  return c.json(serialize(item));
});

instructions.delete('/:id', async (c) => {
  try { await prisma.instructionTemplate.delete({ where: { id: c.req.param('id') } }); } catch { /* ignore */ }
  return c.json({ ok: true });
});

instructions.delete('/', async (c) => {
  await prisma.instructionTemplate.deleteMany();
  return c.json({ ok: true });
});

export default instructions;
