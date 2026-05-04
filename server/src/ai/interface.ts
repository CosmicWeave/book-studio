// Shared types for AI provider abstraction.
// We use a format inspired by the Gemini SDK so the frontend can translate with minimal changes.

export interface ContentPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

export interface Content {
  role: string;
  parts: ContentPart[];
}

export interface Tool {
  functionDeclarations?: FunctionDeclaration[];
}

export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface GenerateOptions {
  systemInstruction?: string;
  temperature?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  imageConfig?: Record<string, unknown>;
  tools?: Tool[];
  toolConfig?: Record<string, unknown>;
  /** For audio generation – ignored by non-Gemini providers */
  responseModalities?: string[];
  speechConfig?: Record<string, unknown>;
}

export interface GenerateRequest {
  model?: string;
  contents: Content[] | Content | string;
  config?: GenerateOptions;
}

export interface GenerateResponse {
  text: string;
  candidates: {
    content: Content;
    finishReason: string;
  }[];
  /** Base64-encoded PCM audio, only present when audio is requested */
  audioData?: string;
}

export interface StreamChunk {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
}

export interface AIProvider {
  readonly name: string;
  generate(req: GenerateRequest): Promise<GenerateResponse>;
  stream(req: GenerateRequest): AsyncGenerator<StreamChunk>;
  listModels(): Promise<string[]>;
}

/** Normalise contents to Content[]: allows callers to pass a plain string */
export function normaliseContents(contents: Content[] | Content | string): Content[] {
  if (typeof contents === 'string') {
    return [{ role: 'user', parts: [{ text: contents }] }];
  }
  if (!Array.isArray(contents)) {
    return [{ role: contents.role ?? 'user', parts: contents.parts ?? [] }];
  }
  return contents;
}

/** Extract plain text from Content[] (for providers that only support text) */
export function contentsToMessages(contents: Content[]): { role: string; content: string }[] {
  return contents.map((c) => ({
    role: c.role === 'model' ? 'assistant' : c.role,
    content: c.parts
      .map((p) => p.text ?? (p.functionCall ? JSON.stringify(p.functionCall) : ''))
      .join(''),
  }));
}
