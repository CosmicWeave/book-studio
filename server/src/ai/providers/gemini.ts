import { GoogleGenAI, Modality } from '@google/genai';
import {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  normaliseContents,
  Content,
} from '../interface.js';

type GeminiContent = { role: string; parts: { text?: string; functionCall?: unknown; functionResponse?: unknown; inlineData?: unknown }[] };

function toGeminiContent(c: Content): GeminiContent {
  return {
    role: c.role,
    parts: c.parts.map((p) => {
      if (p.text !== undefined) return { text: p.text };
      if (p.functionCall) return { functionCall: p.functionCall };
      if (p.functionResponse) return { functionResponse: p.functionResponse };
      if (p.inlineData) return { inlineData: p.inlineData };
      return {};
    }),
  };
}

export interface GeminiApiKeyEntry {
  key: string;
  exhaustedUntil?: number; // milliseconds epoch; if present and > now, key is exhausted
}

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  private apiKeys: GeminiApiKeyEntry[];
  private currentKeyIndex: number = 0;
  private aisCache: Map<string, GoogleGenAI> = new Map();

  constructor(
    apiKeys: GeminiApiKeyEntry[] | string,
    private readonly defaultModel: string = 'gemini-2.5-flash',
  ) {
    // Support backward compatibility: string is converted to single-key array
    this.apiKeys = Array.isArray(apiKeys)
      ? apiKeys
      : [{ key: apiKeys }];
  }

  private getNextAvailableKey(): { key: string; index: number } | null {
    const now = Date.now();
    // Try to find a key that's not exhausted
    for (let i = 0; i < this.apiKeys.length; i++) {
      const entry = this.apiKeys[i];
      if (!entry.exhaustedUntil || entry.exhaustedUntil < now) {
        this.currentKeyIndex = i;
        return { key: entry.key, index: i };
      }
    }
    // If all are exhausted but some may recover soon, return the first one (will fail but user will see error)
    if (this.apiKeys.length > 0) {
      this.currentKeyIndex = 0;
      return { key: this.apiKeys[0].key, index: 0 };
    }
    return null;
  }

  private getAi(apiKey: string): GoogleGenAI {
    if (!this.aisCache.has(apiKey)) {
      this.aisCache.set(apiKey, new GoogleGenAI({ apiKey }));
    }
    return this.aisCache.get(apiKey)!;
  }

  private isQuotaError(error: Error): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes('quota') || msg.includes('resource_exhausted') || msg.includes('rate limit') || msg.includes('429');
  }

  private markKeyExhausted(keyIndex: number, retrySeconds: number | null = null): void {
    if (keyIndex >= 0 && keyIndex < this.apiKeys.length) {
      // Mark as exhausted; if retry info available, use it; otherwise mark for 1 hour
      const exhaustFor = retrySeconds ? retrySeconds * 1000 : 3600 * 1000;
      this.apiKeys[keyIndex].exhaustedUntil = Date.now() + exhaustFor;
    }
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const model = req.model ?? this.defaultModel;
    const contents = normaliseContents(req.contents);
    const geminiContents = contents.map(toGeminiContent);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {};
    if (req.config?.systemInstruction) config.systemInstruction = req.config.systemInstruction;
    if (req.config?.temperature !== undefined) config.temperature = req.config.temperature;
    if (req.config?.responseMimeType) config.responseMimeType = req.config.responseMimeType;
    if (req.config?.responseSchema) config.responseSchema = req.config.responseSchema;
    if (req.config?.imageConfig) config.imageConfig = req.config.imageConfig;
    if (req.config?.tools) config.tools = req.config.tools;
    if (req.config?.toolConfig) config.toolConfig = req.config.toolConfig;
    if (req.config?.responseModalities) config.responseModalities = req.config.responseModalities;
    if (req.config?.speechConfig) config.speechConfig = req.config.speechConfig;

    let lastError: Error | null = null;

    // Try each available key
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const keyEntry = this.getNextAvailableKey();
      if (!keyEntry) {
        throw new Error('No Gemini API keys available. All keys are exhausted.');
      }

      try {
        const ai = this.getAi(keyEntry.key);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await ai.models.generateContent({
          model,
          contents: geminiContents as any,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        const text = response.text ?? '';
        const audioData =
          response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)
            ?.inlineData?.data;

        return {
          text,
          audioData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          candidates: (response.candidates ?? [] as any[]).map((c: { content?: GeminiContent; finishReason?: string }) => ({
            content: {
              role: c.content?.role ?? 'model',
              parts: (c.content?.parts ?? []).map((part: any) => ({
                ...(part.text !== undefined ? { text: part.text as string } : {}),
                ...(part.inlineData ? { inlineData: { mimeType: part.inlineData.mimeType ?? 'image/png', data: part.inlineData.data ?? '' } } : {}),
              })),
            },
            finishReason: c.finishReason ?? 'STOP',
          })),
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (this.isQuotaError(lastError)) {
          // Extract retry seconds if available
          const secMatch = lastError.message.match(/retry in\s+(\d+)s/i);
          const retrySeconds = secMatch ? Number(secMatch[1]) : null;
          this.markKeyExhausted(keyEntry.index, retrySeconds);
          // Try next key
          if (attempt < this.apiKeys.length - 1) {
            // Rotate to next key for next iteration
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
            continue;
          }
        }
        // Non-quota error or last key failed; re-throw
        throw lastError;
      }
    }

    // If we get here, all keys failed
    throw lastError || new Error('All Gemini API keys are exhausted or failed.');
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const model = req.model ?? this.defaultModel;
    const contents = normaliseContents(req.contents);
    const geminiContents = contents.map(toGeminiContent);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: Record<string, any> = {};
    if (req.config?.systemInstruction) config.systemInstruction = req.config.systemInstruction;
    if (req.config?.temperature !== undefined) config.temperature = req.config.temperature;
    if (req.config?.tools) config.tools = req.config.tools;
    if (req.config?.toolConfig) config.toolConfig = req.config.toolConfig;

    let lastError: Error | null = null;

    // Try each available key
    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      const keyEntry = this.getNextAvailableKey();
      if (!keyEntry) {
        throw new Error('No Gemini API keys available. All keys are exhausted.');
      }

      try {
        const ai = this.getAi(keyEntry.key);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stream = await ai.models.generateContentStream({
          model,
          contents: geminiContents as any,
          config: Object.keys(config).length > 0 ? config : undefined,
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) yield { text };
          const fcs = chunk.functionCalls;
          if (fcs && fcs.length > 0) {
            yield {
              functionCall: {
                name: fcs[0].name ?? '',
                args: (fcs[0].args ?? {}) as Record<string, unknown>,
              },
            };
          }
        }
        // Stream completed successfully
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (this.isQuotaError(lastError)) {
          const secMatch = lastError.message.match(/retry in\s+(\d+)s/i);
          const retrySeconds = secMatch ? Number(secMatch[1]) : null;
          this.markKeyExhausted(keyEntry.index, retrySeconds);
          if (attempt < this.apiKeys.length - 1) {
            this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
            continue;
          }
        }
        throw lastError;
      }
    }

    throw lastError || new Error('All Gemini API keys are exhausted or failed.');
  }

  async listModels(): Promise<string[]> {
    return [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];
  }
}
