import {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  normaliseContents,
  contentsToMessages,
} from '../interface.js';

interface OllamaCompletionResponse {
  choices: { message: { role: string; content: string }; finish_reason: string }[];
}

interface OllamaStreamChunk {
  choices: { delta: { content?: string }; finish_reason: string | null }[];
}

export class OllamaProvider implements AIProvider {
  readonly name = 'ollama';

  constructor(
    private readonly baseUrl: string,
    private readonly defaultModel: string,
  ) {}

  private get chatUrl() {
    return `${this.baseUrl}/v1/chat/completions`;
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const model = req.model ?? this.defaultModel;
    const messages = this.buildMessages(req);
    const jsonMode = req.config?.responseMimeType === 'application/json';

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: false,
      ...(jsonMode && { format: 'json' }),
    };
    if (req.config?.temperature !== undefined) {
      (body as Record<string, unknown>).options = { temperature: req.config.temperature };
    }

    let res: Response;
    try {
      res = await fetch(this.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown network error';
      throw new Error(`Ollama is unreachable at ${this.chatUrl}. ${msg}`);
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as OllamaCompletionResponse;
    const text = data.choices[0]?.message?.content ?? '';
    return {
      text,
      candidates: [
        {
          content: { role: 'model', parts: [{ text }] },
          finishReason: data.choices[0]?.finish_reason ?? 'STOP',
        },
      ],
    };
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const model = req.model ?? this.defaultModel;
    const messages = this.buildMessages(req);

    let res: Response;
    try {
      res = await fetch(this.chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, stream: true }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown network error';
      throw new Error(`Ollama is unreachable at ${this.chatUrl}. ${msg}`);
    }

    if (!res.ok || !res.body) {
      throw new Error(`Ollama stream error ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') return;
        try {
          const chunk = JSON.parse(raw) as OllamaStreamChunk;
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield { text };
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      if (!res.ok) return [];
      const data = (await res.json()) as { models: { name: string }[] };
      return data.models.map((m) => m.name);
    } catch {
      return [];
    }
  }

  private buildMessages(req: GenerateRequest): { role: string; content: string }[] {
    const contents = normaliseContents(req.contents);
    const messages = contentsToMessages(contents);
    if (req.config?.systemInstruction) {
      messages.unshift({ role: 'system', content: req.config.systemInstruction });
    }
    return messages;
  }
}
