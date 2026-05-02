/**
 * AnythingLLM provider – uses the OpenAI-compatible /v1/chat/completions endpoint
 * that AnythingLLM exposes on its built-in LLM (or any connected model).
 */
import {
  AIProvider,
  GenerateRequest,
  GenerateResponse,
  StreamChunk,
  normaliseContents,
  contentsToMessages,
} from '../interface.js';

interface OAIResponse {
  choices: { message: { role: string; content: string }; finish_reason: string }[];
}
interface OAIStreamChunk {
  choices: { delta: { content?: string }; finish_reason: string | null }[];
}

export class AnythingLLMProvider implements AIProvider {
  readonly name = 'anythingllm';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly defaultModel: string = 'default',
  ) {}

  private get chatUrl() {
    return `${this.baseUrl}/v1/chat/completions`;
  }

  private get headers() {
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  async generate(req: GenerateRequest): Promise<GenerateResponse> {
    const model = req.model ?? this.defaultModel;
    const messages = this.buildMessages(req);

    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ model, messages, stream: false }),
    });
    if (!res.ok) throw new Error(`AnythingLLM error ${res.status}: ${await res.text()}`);

    const data = (await res.json()) as OAIResponse;
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

    const res = await fetch(this.chatUrl, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`AnythingLLM stream error ${res.status}`);

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
          const chunk = JSON.parse(raw) as OAIStreamChunk;
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield { text };
        } catch { /* skip */ }
      }
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { headers: this.headers });
      if (!res.ok) return [];
      const data = (await res.json()) as { data: { id: string }[] };
      return data.data.map((m) => m.id);
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
