import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { getProvider, getAIStatus, invalidateProviderCache } from '../ai/manager.js';
import { generateSpeech } from '../ai/tts/kokoro.js';
import { GenerateRequest } from '../ai/interface.js';
import { prisma } from '../lib/prisma.js';

const ai = new Hono();

type AIQuotaStatus = 'ok' | 'exhausted' | 'unknown';

type AIQuotaState = {
  status: AIQuotaStatus;
  provider: string;
  updatedAt: number;
  retryUntil: number | null;
  message: string | null;
};

let aiQuotaState: AIQuotaState = {
  status: 'unknown',
  provider: 'unknown',
  updatedAt: Date.now(),
  retryUntil: null,
  message: null,
};

function parseRetrySecondsFromMessage(message: string): number | null {
  const secMatch = message.match(/retry in\s+(\d+)s/i);
  if (secMatch?.[1]) return Math.max(0, Number(secMatch[1]));

  const minuteMatch = message.match(/retry in\s+(\d+)m/i);
  if (minuteMatch?.[1]) return Math.max(0, Number(minuteMatch[1]) * 60);

  const wordsMatch = message.match(/retry in\s+(\d+)\s*(seconds?|minutes?)/i);
  if (wordsMatch?.[1] && wordsMatch?.[2]) {
    const value = Math.max(0, Number(wordsMatch[1]));
    return wordsMatch[2].toLowerCase().startsWith('minute') ? value * 60 : value;
  }

  return null;
}

function isQuotaErrorMessage(message: string): boolean {
  const msg = message.toLowerCase();
  return msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit') || msg.includes('429');
}

function inferHttpStatusFromErrorMessage(message: string): number {
  const msg = message.toLowerCase();
  if (isQuotaErrorMessage(message)) return 429;
  if (msg.includes('permission denied') || msg.includes('forbidden') || msg.includes('403')) return 403;
  if (msg.includes('unauthenticated') || msg.includes('invalid api key') || msg.includes('missing api key') || msg.includes('401')) return 401;
  if (msg.includes('not found') || msg.includes('404')) return 404;
  return 503;
}

function updateQuotaStateFromSuccess(providerName: string): void {
  aiQuotaState = {
    status: 'ok',
    provider: providerName,
    updatedAt: Date.now(),
    retryUntil: null,
    message: null,
  };
}

function updateQuotaStateFromError(providerName: string, message: string): void {
  if (isQuotaErrorMessage(message)) {
    const retrySeconds = parseRetrySecondsFromMessage(message);
    aiQuotaState = {
      status: 'exhausted',
      provider: providerName,
      updatedAt: Date.now(),
      retryUntil: retrySeconds !== null ? Date.now() + (retrySeconds * 1000) : null,
      message,
    };
    return;
  }

  aiQuotaState = {
    status: 'unknown',
    provider: providerName,
    updatedAt: Date.now(),
    retryUntil: null,
    message,
  };
}

function getQuotaSnapshot(): {
  status: AIQuotaStatus;
  provider: string;
  updatedAt: number;
  retryInSec: number | null;
  message: string | null;
} {
  const retryInSec = aiQuotaState.retryUntil
    ? Math.max(0, Math.ceil((aiQuotaState.retryUntil - Date.now()) / 1000))
    : null;

  const status: AIQuotaStatus = retryInSec === 0 && aiQuotaState.status === 'exhausted'
    ? 'unknown'
    : aiQuotaState.status;

  return {
    status,
    provider: aiQuotaState.provider,
    updatedAt: aiQuotaState.updatedAt,
    retryInSec,
    message: aiQuotaState.message,
  };
}

// ─── Health / status ──────────────────────────────────────────────────────────

ai.get('/health', async (c) => {
  const status = await getAIStatus();
  return c.json(status);
});

ai.get('/models', async (c) => {
  const status = await getAIStatus();
  return c.json({ models: status.models ?? [], provider: status.provider });
});

ai.get('/quota', async (c) => {
  return c.json(getQuotaSnapshot());
});

// ─── Config ──────────────────────────────────────────────────────────────────

const aiConfigSchema = z.object({
  provider: z.enum(['ollama', 'gemini', 'anythingllm', 'openai']),
  model: z.string().optional(),
  ollamaModel: z.string().optional(),
  geminiModel: z.string().optional(),
  anythingllmModel: z.string().optional(),
  openaiModel: z.string().optional(),
  ollamaUrl: z.string().url().optional(),
  geminiApiKey: z.string().optional(), // Deprecated, use geminiApiKeys
  geminiApiKeys: z.array(z.object({
    key: z.string(),
    exhaustedUntil: z.number().optional(),
  })).optional(),
  anythingllmUrl: z.string().url().optional(),
  anythingllmApiKey: z.string().optional(),
  openaiBaseUrl: z.string().url().optional(),
  openaiApiKey: z.string().optional(),
});

ai.get('/config', async (c) => {
  const row = await prisma.setting.findUnique({ where: { id: 'aiConfig' } });
  const config = (row?.value ?? {
    provider: process.env.AI_PROVIDER ?? 'ollama',
    model: process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  }) as Record<string, unknown>;

  // Never expose actual keys in the GET response; mask them
  const { geminiApiKey: _, anythingllmApiKey: __, openaiApiKey: ___, geminiApiKeys, ...safe } = config as {
    geminiApiKey?: string;
    anythingllmApiKey?: string;
    openaiApiKey?: string;
    geminiApiKeys?: Array<{ key: string; exhaustedUntil?: number }>;
    [k: string]: unknown;
  };

  // Mask and return geminiApiKeys with status
  const maskedGeminiKeys = (geminiApiKeys || (config.geminiApiKey ? [{ key: config.geminiApiKey as string }] : [])).map((entry: any) => {
    const key = (entry.key || '').replace(/\s/g, '');
    const masked = key.length > 4 ? '*'.repeat(key.length - 4) + key.slice(-4) : '****';
    const now = Date.now();
    const isExhausted = entry.exhaustedUntil && entry.exhaustedUntil > now;
    return {
      masked,
      exhaustedUntil: entry.exhaustedUntil,
      isExhausted,
    };
  });

  return c.json({
    ...safe,
    geminiApiKeys: maskedGeminiKeys,
    hasGeminiKey: maskedGeminiKeys.length > 0,
    hasAnythingllmKey: !!config.anythingllmApiKey,
    hasOpenaiKey: !!config.openaiApiKey,
  });
});

ai.put('/config', zValidator('json', aiConfigSchema), async (c) => {
  const body = c.req.valid('json');

  // Merge with existing config so partial updates don't wipe keys
  const existing = await prisma.setting.findUnique({ where: { id: 'aiConfig' } });
  const existingConfig = (existing?.value as Record<string, unknown> ?? {});
  const merged: Record<string, unknown> = { ...existingConfig, ...body };

  // Append incoming Gemini keys to existing keys (do not overwrite), with dedupe.
  const existingGeminiFromArray = Array.isArray(existingConfig.geminiApiKeys)
    ? existingConfig.geminiApiKeys as Array<{ key: string; exhaustedUntil?: number }>
    : [];
  const existingGeminiFromLegacy = typeof existingConfig.geminiApiKey === 'string' && existingConfig.geminiApiKey.trim().length > 0
    ? [{ key: existingConfig.geminiApiKey.trim() }]
    : [];

  const sanitizeKey = (k: string) => k.replace(/\s/g, '');
  const incomingGeminiFromArray = Array.isArray(body.geminiApiKeys)
    ? body.geminiApiKeys
        .map((entry) => ({
          key: sanitizeKey(entry.key),
          ...(entry.exhaustedUntil ? { exhaustedUntil: entry.exhaustedUntil } : {}),
        }))
        .filter((entry) => entry.key.length > 0)
    : [];
  const incomingGeminiFromLegacy = typeof body.geminiApiKey === 'string' && sanitizeKey(body.geminiApiKey).length > 0
    ? [{ key: sanitizeKey(body.geminiApiKey) }]
    : [];

  const incomingGemini = [...incomingGeminiFromArray, ...incomingGeminiFromLegacy];
  if (incomingGemini.length > 0) {
    const combined = [...existingGeminiFromArray, ...existingGeminiFromLegacy, ...incomingGemini];
    const uniqueByKey = new Map<string, { key: string; exhaustedUntil?: number }>();
    for (const entry of combined) {
      if (!entry.key || entry.key.trim().length === 0) continue;
      if (!uniqueByKey.has(entry.key)) {
        uniqueByKey.set(entry.key, entry);
      }
    }
    merged.geminiApiKeys = Array.from(uniqueByKey.values());
    delete merged.geminiApiKey;
  }

  const mergedValue = merged as Prisma.InputJsonValue;

  await prisma.setting.upsert({
    where: { id: 'aiConfig' },
    update: { value: mergedValue },
    create: { id: 'aiConfig', value: mergedValue },
  });

  invalidateProviderCache();
  return c.json({ ok: true });
});

// ─── Shared helpers ───────────────────────────────────────────────────────────

const generateSchema = z.object({
  provider: z.enum(['ollama', 'gemini', 'anythingllm', 'openai']).optional(),
  model: z.string().optional(),
  contents: z.unknown(),
  config: z.record(z.any()).optional(),
});

function normaliseRequestContents(contents: unknown): GenerateRequest['contents'] {
  if (typeof contents === 'string') {
    return contents;
  }

  if (Array.isArray(contents)) {
    return contents as GenerateRequest['contents'];
  }

  if (contents && typeof contents === 'object' && 'parts' in contents) {
    return contents as GenerateRequest['contents'];
  }

  throw new Error('Invalid AI contents payload');
}

// ─── Non-streaming generation ─────────────────────────────────────────────────

ai.post('/generate', zValidator('json', generateSchema), async (c) => {
  const body = c.req.valid('json');
  let providerName = 'unknown';
  try {
    const provider = await getProvider({ provider: body.provider, model: body.model });
    providerName = provider.name;
    const result = await provider.generate({
      model: body.model,
      contents: normaliseRequestContents(body.contents),
      config: body.config,
    });
    updateQuotaStateFromSuccess(provider.name);
    return c.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI generation failed';
    updateQuotaStateFromError(providerName, msg);
    const status = inferHttpStatusFromErrorMessage(msg);
    const retryInSec = parseRetrySecondsFromMessage(msg);
    if (status === 429 && retryInSec !== null) c.header('Retry-After', String(retryInSec));
    if (status === 429) return c.json({ error: msg }, 429);
    if (status === 403) return c.json({ error: msg }, 403);
    if (status === 401) return c.json({ error: msg }, 401);
    if (status === 404) return c.json({ error: msg }, 404);
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
        let providerName = 'unknown';
        let completed = false;
        try {
          const provider = await getProvider({ provider: body.provider, model: body.model });
          providerName = provider.name;
          for await (const chunk of provider.stream({
            model: body.model,
            contents: normaliseRequestContents(body.contents),
            config: body.config,
          })) {
            controller.enqueue(enc(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          completed = true;
          updateQuotaStateFromSuccess(providerName);
          controller.enqueue(enc('data: [DONE]\n\n'));
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Stream error';
          updateQuotaStateFromError(providerName, msg);
          controller.enqueue(enc(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } finally {
          if (!completed && aiQuotaState.status === 'ok') {
            aiQuotaState = {
              ...aiQuotaState,
              status: 'unknown',
              updatedAt: Date.now(),
            };
          }
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
