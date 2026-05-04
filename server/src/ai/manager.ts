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
import { OpenAIProvider } from './providers/openai.js';

interface GeminiApiKeyEntry {
  key: string;
  exhaustedUntil?: number; // ISO timestamp; if present and future, this key is temporarily exhausted
}

interface AIConfig {
  provider: 'ollama' | 'gemini' | 'anythingllm' | 'openai';
  model?: string;
  ollamaModel?: string;
  geminiModel?: string;
  anythingllmModel?: string;
  openaiModel?: string;
  ollamaUrl?: string;
  geminiApiKey?: string; // Deprecated: use geminiApiKeys instead; kept for backward compatibility
  geminiApiKeys?: GeminiApiKeyEntry[];
  anythingllmUrl?: string;
  anythingllmApiKey?: string;
  openaiBaseUrl?: string;
  openaiApiKey?: string;
}

type ProviderName = AIConfig['provider'];

function resolveModelForProvider(config: AIConfig, provider: ProviderName): string | undefined {
  switch (provider) {
    case 'gemini':
      return config.geminiModel ?? (config.provider === 'gemini' ? config.model : undefined);
    case 'anythingllm':
      return config.anythingllmModel ?? (config.provider === 'anythingllm' ? config.model : undefined);
    case 'openai':
      return config.openaiModel ?? (config.provider === 'openai' ? config.model : undefined);
    case 'ollama':
    default:
      return config.ollamaModel ?? config.model;
  }
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
    geminiApiKeys: process.env.GEMINI_API_KEY ? [{ key: process.env.GEMINI_API_KEY }] : undefined,
    anythingllmUrl: process.env.ANYTHINGLLM_URL ?? 'http://localhost:3001',
    anythingllmApiKey: process.env.ANYTHINGLLM_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com',
    openaiApiKey: process.env.OPENAI_API_KEY,
  };
}

export async function getProvider(overrides?: { provider?: ProviderName; model?: string }): Promise<AIProvider> {
  if (!overrides?.provider && !overrides?.model && cachedProvider && Date.now() < cacheExpiry) return cachedProvider;

  const baseConfig = await loadConfig();
  const config: AIConfig = {
    ...baseConfig,
    ...(overrides?.provider ? { provider: overrides.provider } : {}),
    ...(overrides?.model ? { model: overrides.model } : {}),
  };
  const resolvedModel = overrides?.model ?? resolveModelForProvider(config, config.provider);

  // Do not cache provider instances for per-request overrides.
  const shouldCache = !overrides?.provider && !overrides?.model;
  let providerInstance: AIProvider;

  switch (config.provider) {
    case 'gemini': {
      const keys = config.geminiApiKeys && config.geminiApiKeys.length > 0
        ? config.geminiApiKeys
        : (config.geminiApiKey ? [{ key: config.geminiApiKey }] : []);
      if (keys.length === 0) throw new Error('Gemini API key not configured. Set it in Settings → AI Configuration.');
      providerInstance = new GeminiProvider(keys, resolvedModel);
      break;
    }
    case 'anythingllm':
      providerInstance = new AnythingLLMProvider(
        config.anythingllmUrl ?? process.env.ANYTHINGLLM_URL ?? 'http://localhost:3001',
        config.anythingllmApiKey ?? process.env.ANYTHINGLLM_API_KEY ?? '',
        resolvedModel,
      );
      break;
    case 'openai': {
      const key = config.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '';
      if (!key) throw new Error('OpenAI API key not configured. Set it in Settings → AI Configuration.');
      providerInstance = new OpenAIProvider(
        config.openaiBaseUrl ?? process.env.OPENAI_BASE_URL ?? 'https://api.openai.com',
        key,
        resolvedModel,
      );
      break;
    }
    case 'ollama':
    default:
      providerInstance = new OllamaProvider(
        config.ollamaUrl ?? process.env.OLLAMA_URL ?? 'http://localhost:11434',
        resolvedModel ?? process.env.OLLAMA_DEFAULT_MODEL ?? 'llama3.2',
      );
  }

  if (shouldCache) {
    cachedProvider = providerInstance;
    cacheExpiry = Date.now() + 30_000;
    return providerInstance;
  }

  // Return uncached instance for request-level provider/model overrides.
  return providerInstance;
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
    const configuredProvider = config.provider ?? 'ollama';
    return {
      available: true,
      provider: provider.name,
      model: resolveModelForProvider(config, configuredProvider),
      models,
    };
  } catch (e) {
    return { available: false, provider: 'none' };
  }
}
