import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getProvider, getAIStatus, invalidateProviderCache } from '../ai/manager.js';
import { generateSpeech } from '../ai/tts/kokoro.js';
import { prisma } from '../lib/prisma.js';

const ai = new Hono();

// ─── Health / status ──────────────────────────────────────────────────────────

ai.get('/health', async (c) => {
  const status = await getAIStatus();
  return c.json(status);
});

ai.get('/models', async (c) => {
  const status = await getAIStatus();
  return c.json({ models: status.models ?? [], provider: status.provider });
});

// ─── Config ──────────────────────────────────────────────────────────────────

const aiConfigSchema = z.object({
  provider: z.enum(['ollama', 'gemini', 'anythingllm']),
  model: z.string().optional(),
  ollamaUrl: z.string().url().optional(),
  geminiApiKey: z.string().optional(),
  anythingllmUrl: z.string().url().optional(),
  anythingllmApiKey: z.string().optional(),
});

ai.get('/config', async (c) => {
  const row = await prisma.setting.findUnique({ where: { id: 'aiConfig' } });
  const config = (row?.value ?? {
    provider: process.env.AI_PROVIDER ?? 'ollama',
    model: process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  }) as Record<string, unknown>;
  // Never expose keys in the GET response
  const { geminiApiKey: _, anythingllmApiKey: __, ...safe } = config as {
    geminiApiKey?: string;
    anythingllmApiKey?: string;
    [k: string]: unknown;
  };
  return c.json({
    ...safe,
    hasGeminiKey: !!config.geminiApiKey,
    hasAnythingllmKey: !!config.anythingllmApiKey,
  });
});

ai.put('/config', zValidator('json', aiConfigSchema), async (c) => {
  const body = c.req.valid('json');

  // Merge with existing config so partial updates don't wipe keys
  const existing = await prisma.setting.findUnique({ where: { id: 'aiConfig' } });
  const merged = { ...(existing?.value as object ?? {}), ...body };

  await prisma.setting.upsert({
    where: { id: 'aiConfig' },
    update: { value: merged },
    create: { id: 'aiConfig', value: merged },
  });

  invalidateProviderCache();
  return c.json({ ok: true });
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

const generateSchema = z.object({
  model: z.string().optional(),
  contents: z.union([z.string(), z.array(z.any())]),
  config: z.record(z.any()).optional(),
});

// ─── Non-streaming generation ─────────────────────────────────────────────────

ai.post('/generate', zValidator('json', generateSchema), async (c) => {
  const body = c.req.valid('json');
  try {
    const provider = await getProvider();
    const result = await provider.generate({
      model: body.model,
      contents: body.contents,
      config: body.config,
    });
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI generation failed';
    return c.json({ error: msg }, 503);
  }
});

// ─── Streaming generation (SSE) ───────────────────────────────────────────────

ai.post('/stream', zValidator('json', generateSchema), async (c) => {
  const body = c.req.valid('json');

  return c.newResponse(
    new ReadableStream({
      async start(controller) {
        const enc = (s: string) => new TextEncoder().encode(s);
        try {
          const provider = await getProvider();
          for await (const chunk of provider.stream({
            model: body.model,
            contents: body.contents,
            config: body.config,
          })) {
            controller.enqueue(enc(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          controller.enqueue(enc('data: [DONE]\n\n'));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Stream error';
          controller.enqueue(enc(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          controller.close();
        }
      },
    }),
    200,
    {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  );
});

// ─── Text-to-speech ───────────────────────────────────────────────────────────

const ttsSchema = z.object({
  text: z.string().min(1),
  voice: z.string().optional(),
  voiceInstructions: z.string().optional(),
  speed: z.number().optional(),
});

ai.post('/tts', zValidator('json', ttsSchema), async (c) => {
  const { text, voice, voiceInstructions, speed } = c.req.valid('json');

  let promptText = text;
  if (voiceInstructions?.trim()) {
    promptText = `(Perform with the following style: ${voiceInstructions}) ${text}`;
  }

  try {
    const audioBuffer = await generateSpeech({
      text: promptText,
      voice: voice ?? 'af_heart',
      speed: speed ?? 1.0,
    });
    return c.newResponse(audioBuffer as unknown as ReadableStream, 200, { 'Content-Type': 'audio/wav' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'TTS failed';
    return c.json({ error: msg }, 503);
  }
});

export default ai;
