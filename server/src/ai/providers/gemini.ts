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

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  private ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly defaultModel: string = 'gemini-2.5-flash',
  ) {
    this.ai = new GoogleGenAI({ apiKey });
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
    if (req.config?.tools) config.tools = req.config.tools;
    if (req.config?.toolConfig) config.toolConfig = req.config.toolConfig;
    if (req.config?.responseModalities) config.responseModalities = req.config.responseModalities;
    if (req.config?.speechConfig) config.speechConfig = req.config.speechConfig;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await this.ai.models.generateContent({
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
          parts: (c.content?.parts ?? []).map((p: { text?: string }) => ({ text: p.text ?? '' })),
        },
        finishReason: c.finishReason ?? 'STOP',
      })),
    };
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await this.ai.models.generateContentStream({
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
