/**
 * AIManager – reads the active provider config from the DB at runtime
 * and returns the appropriate AIProvider instance.
 *
 * Config is cached for 30 s to avoid hitting the DB on every request.
 */
import { prisma } from '../lib/prisma.js';
import { AIProvider } from './interface.js';
import { OllamaProvider } from './providers/ollama.js';
import { GeminiProvider } from './providers/gemini.js';
import { AnythingLLMProvider } from './providers/anythingllm.js';

interface AIConfig {
  provider: 'ollama' | 'gemini' | 'anythingllm';
  model?: string;
  ollamaUrl?: string;
  geminiApiKey?: string;
  anythingllmUrl?: string;
  anythingllmApiKey?: string;
}

let cachedProvider: AIProvider | null = null;
let cacheExpiry = 0;

async function loadConfig(): Promise<AIConfig> {
  try {
    const row = await prisma.setting.findUnique({ where: { id: 'aiConfig' } });
    if (row) return row.value as unknown as AIConfig;
  } catch {
    // DB may not be ready yet; fall through to env defaults
  }

  return {
    provider: (process.env.AI_PROVIDER as AIConfig['provider']) ?? 'ollama',
    model: process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
    ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    geminiApiKey: process.env.GEMINI_API_KEY,
    anythingllmUrl: process.env.ANYTHINGLLM_URL ?? 'http://localhost:3001',
    anythingllmApiKey: process.env.ANYTHINGLLM_API_KEY,
  };
}

export async function getProvider(): Promise<AIProvider> {
  if (cachedProvider && Date.now() < cacheExpiry) return cachedProvider;

  const config = await loadConfig();

  switch (config.provider) {
    case 'gemini': {
      const key = config.geminiApiKey ?? process.env.GEMINI_API_KEY ?? '';
      if (!key) throw new Error('Gemini API key not configured. Set it in Settings → AI Configuration.');
      cachedProvider = new GeminiProvider(key, config.model);
      break;
    }
    case 'anythingllm':
      cachedProvider = new AnythingLLMProvider(
        config.anythingllmUrl ?? process.env.ANYTHINGLLM_URL ?? 'http://localhost:3001',
        config.anythingllmApiKey ?? process.env.ANYTHINGLLM_API_KEY ?? '',
        config.model,
      );
      break;
    case 'ollama':
    default:
      cachedProvider = new OllamaProvider(
        config.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434',
        config.model ?? process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
      );
  }

  cacheExpiry = Date.now() + 30_000;
  return cachedProvider;
}

/** Invalidate the cache (call after saving a new AI config) */
export function invalidateProviderCache(): void {
  cachedProvider = null;
  cacheExpiry = 0;
}

export async function getAIStatus(): Promise<{
  available: boolean;
  provider: string;
  model?: string;
  models?: string[];
}> {
  try {
    const provider = await getProvider();
    const models = await provider.listModels();
    const config = await loadConfig();
    return {
      available: true,
      provider: provider.name,
      model: config.model,
      models,
    };
  } catch (e) {
    return { available: false, provider: 'none' };
  }
}
