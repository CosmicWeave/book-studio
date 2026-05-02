import { Hono } from 'hono';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { lookup as mimeLookup } from 'mime-types';

const files = new Hono();

function getFilesDir(): string {
  return process.env.FILES_DIR ?? join(process.cwd(), 'data', 'files');
}

async function ensureDir(dir: string) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

// ─── Upload ───────────────────────────────────────────────────────────────────

files.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file uploaded' }, 400);
  }

  const dir = getFilesDir();
  await ensureDir(dir);

  // Sanitise filename – keep extension, generate unique id for the name
  const originalName = (file as File).name ?? 'upload';
  const ext = originalName.includes('.') ? '.' + originalName.split('.').pop() : '';
  const filename = `${randomUUID()}${ext}`;
  const dest = join(dir, filename);

  const arrayBuffer = await (file as File).arrayBuffer();
  await writeFile(dest, Buffer.from(arrayBuffer));

  return c.json({ filename, url: `/api/files/${filename}` });
});

// ─── Serve ────────────────────────────────────────────────────────────────────

files.get('/:filename', async (c) => {
  const filename = basename(c.req.param('filename')); // prevent path traversal
  const dir = getFilesDir();
  const filepath = join(dir, filename);

  try {
    const data = await readFile(filepath);
    const mimeType = (mimeLookup(filename) || 'application/octet-stream') as string;
    return c.newResponse(data, 200, { 'Content-Type': mimeType });
  } catch {
    return c.json({ error: 'File not found' }, 404);
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────────

files.delete('/:filename', async (c) => {
  const filename = basename(c.req.param('filename'));
  const dir = getFilesDir();
  const filepath = join(dir, filename);

  try {
    const { unlink } = await import('node:fs/promises');
    await unlink(filepath);
  } catch {
    // ignore – file may already be gone
  }
  return c.json({ ok: true });
});

export default files;
