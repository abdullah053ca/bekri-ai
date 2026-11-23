import 'dotenv/config';

/**
 * BEKRI local model gateway.
 * Default provider is Ollama on loopback. No API key or cloud account is required.
 * The gateway intentionally speaks the OpenAI-compatible chat-completions protocol
 * so local Ollama models can use the same agent/tool pipeline.
 */
export const BASE_URL = (process.env.LLM_BASE_URL || process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').replace(/\/$/, '');
export const API_KEY = process.env.LLM_API_KEY || '';
export const CHAT_MODEL = process.env.OLLAMA_MODEL || process.env.CHAT_MODEL || 'qwen2.5:7b';
export const MOCK = process.env.MOCK === '1';

export class LLMError extends Error {
  constructor(public status: number, public body: string) {
    super(`BEKRI model gateway ${status}: ${body.slice(0, 300)}`);
  }
}
// Transitional export for modules being migrated; this is not a RouteLLM dependency.
export { LLMError as LLMError };

function headers(extra: Record<string, string> = {}) {
  return {
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
    ...extra,
  };
}

export async function llmRequest<T = any>(path: string, body?: unknown, method = body ? 'POST' : 'GET'): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: headers({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new LLMError(res.status, text);
  return text ? JSON.parse(text) as T : ({} as T);
}

export interface StreamResult {
  content: string;
  tool_calls: NonNullable<ChatMessage['tool_calls']>;
  model: string | null;
  firstTokenMs: number | null;
  totalMs: number;
}

/** OpenAI-compatible streaming; Ollama supports this endpoint for local chat models. */
export async function llmStream(body: object, onContent?: (delta: string, full: string) => void): Promise<StreamResult> {
  const t0 = performance.now();
  const res = await fetch(BASE_URL + '/chat/completions', {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.ok || !res.body) throw new LLMError(res.status, await res.text());
  const dec = new TextDecoder();
  let buf = '';
  let content = '';
  let model: string | null = null;
  let firstTokenMs: number | null = null;
  const calls: { id: string; name: string; args: string }[] = [];
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    buf += dec.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      let j: any;
      try { j = JSON.parse(data); } catch { continue; }
      model ??= j.model ?? null;
      const d = j.choices?.[0]?.delta ?? {};
      if ((d.content || d.tool_calls) && firstTokenMs === null) firstTokenMs = Math.round(performance.now() - t0);
      for (const tc of d.tool_calls ?? []) {
        const i = tc.index ?? 0;
        calls[i] ??= { id: '', name: '', args: '' };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function?.name) calls[i].name += tc.function.name;
        if (tc.function?.arguments) calls[i].args += tc.function.arguments;
      }
      if (typeof d.content === 'string' && d.content) {
        content += d.content;
        onContent?.(d.content, content);
      }
    }
  }
  return {
    content,
    tool_calls: calls.filter(Boolean).map((c, i) => ({ id: c.id || `call_${i}`, type: 'function' as const, function: { name: c.name, arguments: c.args } })),
    model,
    firstTokenMs,
    totalMs: Math.round(performance.now() - t0),
  };
}

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'input_audio'; input_audio: { data: string; format: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null | ContentPart[];
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

export interface ChatResponse {
  model?: string;
  choices: {
    message: ChatMessage & {
      audio?: { data: string };
      audios?: { id: string; data: string; expires_at: number; transcript: string }[];
    };
    finish_reason: string;
  }[];
}
