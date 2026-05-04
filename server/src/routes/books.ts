import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
import { serialize } from '../lib/serialize.js';

const books = new Hono();

/** Known Prisma Book fields. Strip anything else so old backup fields don't
 *  cause PrismaClientValidationError. Also remaps legacy field names. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeBook(raw: Record<string, any>) {
  const {
    // fields that exist in the schema
    topic, subtitle, author, description, instructions,
    wordCountGoal, generateImages, imageGenerationInstructions,
    voiceStyleInstructions, aiPersona, status, deletedAt,
    outline, content, createdAt, updatedAt, coverImage,
    seriesId, seriesName, publisher, publicationDate, language,
    creationConfig, knowledgeBase,
    // handle both new and legacy chat history field names
    bookChatHistory,
    chatHistory, // legacy field name → bookChatHistory
    // explicitly discard unknown fields (e.g. imageStyle)
  } = raw;

  const full: Record<string, unknown> = {
    topic, subtitle, author, description, instructions,
    wordCountGoal, generateImages, imageGenerationInstructions,
    voiceStyleInstructions, aiPersona, status, deletedAt,
    outline, content, createdAt, updatedAt, coverImage,
    seriesId, seriesName, publisher, publicationDate, language,
    creationConfig, knowledgeBase,
    bookChatHistory: bookChatHistory ?? chatHistory ?? undefined,
  };
  // Strip undefined so Prisma's update only touches provided fields
  return Object.fromEntries(Object.entries(full).filter(([, v]) => v !== undefined));
}

// GET all books
books.get('/', async (c) => {
  const items = await prisma.book.findMany({ orderBy: { updatedAt: 'desc' } });
  return c.json(serialize(items));
});

// GET one book
books.get('/:id', async (c) => {
  const item = await prisma.book.findUnique({ where: { id: c.req.param('id') } });
  if (!item) return c.json({ error: 'Not found' }, 404);
  return c.json(serialize(item));
});

// PUT (upsert) a book
books.put('/:id', async (c) => {
  const body = await c.req.json();
  const id = c.req.param('id');
  const data = sanitizeBook(body);
  const now = Date.now();
  const item = await prisma.book.upsert({
    where: { id },
    update: data,
    create: {
      // Defaults for required non-nullable fields (backup data should always
      // provide these, but guard against legacy/partial payloads)
      topic: '',
      instructions: '',
      imageGenerationInstructions: '',
      createdAt: now,
      updatedAt: now,
      ...data,
      id,
    },
  });
  return c.json(serialize(item));
});

// DELETE one book
books.delete('/:id', async (c) => {
  try {
    await prisma.book.delete({ where: { id: c.req.param('id') } });
  } catch {
    // ignore not found
  }
  return c.json({ ok: true });
});

// DELETE all books (clear)
books.delete('/', async (c) => {
  await prisma.book.deleteMany();
  return c.json({ ok: true });
});

export default books;
