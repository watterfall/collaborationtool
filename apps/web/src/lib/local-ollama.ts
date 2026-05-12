// Phase 5 Wave B Spike-1: local Ollama HTTP client (browser/desktop).
// Bypasses server-side ai-runtime/providers/ollama.ts entirely;
// UI fetches localhost:11434 directly.
//
// Why a separate impl? server-side ollama.ts uses node:crypto + tauri
// fetch is the WebView fetch API. Same wire format, different runtime.

const OLLAMA_ENDPOINT = 'http://localhost:11434';

export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
}

export interface OllamaChatResponse {
  message: OllamaMessage;
  done: boolean;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export async function detectOllamaInBrowser(): Promise<boolean> {
  try {
    const resp = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, {
      method: 'GET',
      // 500 ms cap via AbortSignal.timeout (Node 22+ / modern browsers)
      signal: AbortSignal.timeout(500),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function chatCompletion(
  req: OllamaChatRequest,
): Promise<OllamaChatResponse> {
  const resp = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...req, stream: false }),
  });
  if (!resp.ok) {
    throw new Error(`Ollama chat failed: HTTP ${resp.status}`);
  }
  return (await resp.json()) as OllamaChatResponse;
}

export function parseStreamChunk(line: string): StreamChunk | null {
  try {
    const obj = JSON.parse(line) as {
      message?: { content?: string };
      done?: boolean;
    };
    if (!obj.message || typeof obj.message.content !== 'string') {
      return null;
    }
    return {
      content: obj.message.content,
      done: obj.done === true,
    };
  } catch {
    return null;
  }
}
