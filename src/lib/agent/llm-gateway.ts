/**
 * Multi-LLM Gateway
 *
 * Supports multiple LLM providers with automatic failover.
 * Users configure providers via environment variables.
 * The gateway tries each provider in priority order until one succeeds.
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface LLMProvider {
  name: string;
  model: string;
  isConfigured: () => boolean;
  chat: (messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }) => Promise<LLMResponse>;
  chatStream?: (messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }) => AsyncGenerator<string, void, unknown>;
}

// --- Z-AI Provider (default, always available) ---

class ZAIProvider implements LLMProvider {
  name = 'z-ai-web-dev-sdk';
  model = 'default';

  private zai: InstanceType<typeof import('z-ai-web-dev-sdk').default> | null = null;

  isConfigured() {
    return true; // Always available in this environment
  }

  private async getClient() {
    if (!this.zai) {
      const { default: ZAI } = await import('z-ai-web-dev-sdk');
      this.zai = await ZAI.create();
    }
    return this.zai;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const client = await this.getClient();
    const completion = await client.chat.completions.create({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    });

    return {
      content: completion.choices[0]?.message?.content || 'No response generated.',
      provider: this.name,
      model: this.model,
      usage: completion.usage ? {
        promptTokens: completion.usage.prompt_tokens ?? 0,
        completionTokens: completion.usage.completion_tokens ?? 0,
      } : undefined,
    };
  }

  async *chatStream(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void, unknown> {
    // z-ai-web-dev-sdk doesn't have a documented streaming API, so fall back to regular chat
    const result = await this.chat(messages, options);
    // Simulate streaming by yielding word chunks
    const words = result.content.split(' ');
    for (const word of words) {
      yield word + ' ';
    }
  }
}

// --- OpenAI Provider ---

class OpenAIProvider implements LLMProvider {
  name = 'openai';
  model: string;

  constructor() {
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  isConfigured() {
    return !!process.env.OPENAI_API_KEY;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY!;
    const baseUrl = process.env.OPENAI_BASE_URL; // Allow custom endpoints (e.g., Azure, local proxies)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
    };

    const url = baseUrl
      ? `${baseUrl}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || 'No response generated.',
      provider: this.name,
      model: this.model,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
      } : undefined,
    };
  }

  async *chatStream(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.OPENAI_API_KEY!;
    const baseUrl = process.env.OPENAI_BASE_URL;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
    };

    const url = baseUrl
      ? `${baseUrl}/v1/chat/completions`
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI streaming error (${response.status}): ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch { /* skip malformed chunks */ }
      }
    }
  }
}

// --- Anthropic Provider ---

class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  model: string;

  constructor() {
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  }

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

    // Anthropic separates system from messages
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        system: systemMessage,
        messages: nonSystemMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text || 'No response generated.',
      provider: this.name,
      model: this.model,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
      } : undefined,
    };
  }

  async *chatStream(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const baseUrl = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 0.7,
        system: systemMessage,
        messages: nonSystemMessages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic streaming error (${response.status}): ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield event.delta.text;
          }
        } catch { /* skip */ }
      }
    }
  }
}

// --- Google Gemini Provider ---

class GoogleProvider implements LLMProvider {
  name = 'google';
  model: string;

  constructor() {
    this.model = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';
  }

  isConfigured() {
    return !!process.env.GOOGLE_API_KEY;
  }

  async chat(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    const apiKey = process.env.GOOGLE_API_KEY!;
    const baseUrl = process.env.GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com';

    // Gemini format: system instruction + contents
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    const contents = nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const url = `${baseUrl}/v1beta/models/${this.model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API error (${response.status}): ${err}`);
    }

    const data = await response.json();
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.',
      provider: this.name,
      model: this.model,
      usage: data.usageMetadata ? {
        promptTokens: data.usageMetadata.promptTokenCount ?? 0,
        completionTokens: data.usageMetadata.candidatesTokenCount ?? 0,
      } : undefined,
    };
  }

  async *chatStream(messages: LLMMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string, void, unknown> {
    const apiKey = process.env.GOOGLE_API_KEY!;
    const baseUrl = process.env.GOOGLE_BASE_URL || 'https://generativelanguage.googleapis.com';
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const nonSystemMessages = messages.filter(m => m.role !== 'system');
    const contents = nonSystemMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const response = await fetch(`${baseUrl}/v1beta/models/${this.model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemMessage ? { parts: [{ text: systemMessage }] } : undefined,
        contents,
        generationConfig: {
          temperature: options?.temperature ?? 0.7,
          maxOutputTokens: options?.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google streaming error (${response.status}): ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      for (const line of text.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6));
          const part = event.candidates?.[0]?.content?.parts?.[0]?.text;
          if (part) yield part;
        } catch { /* skip */ }
      }
    }
  }
}

// --- Gateway ---

export class LLMGateway {
  private providers: LLMProvider[] = [];
  private priority: string[] = [];

  constructor() {
    // Register all providers
    const zai = new ZAIProvider();
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();
    const google = new GoogleProvider();

    this.providers = [zai, openai, anthropic, google];

    // Priority order from env (comma-separated), default: z-ai first, then user-configured ones
    const envPriority = process.env.LLM_PRIORITY || '';
    if (envPriority) {
      this.priority = envPriority.split(',').map(p => p.trim().toLowerCase());
    }

    // If no priority set, put z-ai last (use user's own provider first if configured)
    if (this.priority.length === 0) {
      // Configured external providers first, then z-ai as fallback
      const configured = this.providers.filter(p => p.isConfigured() && p.name !== 'z-ai-web-dev-sdk');
      const fallback = this.providers.filter(p => p.name === 'z-ai-web-dev-sdk');
      this.priority = [...configured.map(p => p.name), ...fallback.map(p => p.name)];
    }
  }

  getConfiguredProviders(): Array<{ name: string; model: string; priority: number }> {
    return this.priority
      .map((name, index) => {
        const provider = this.providers.find(p => p.name === name);
        return provider && provider.isConfigured()
          ? { name: provider.name, model: provider.model, priority: index + 1 }
          : null;
      })
      .filter(Boolean) as Array<{ name: string; model: string; priority: number }>;
  }

  async chat(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number; preferProvider?: string }
  ): Promise<LLMResponse> {
    // If a specific provider is requested, try it first
    let orderedProviders: LLMProvider[];

    if (options?.preferProvider) {
      const preferred = this.providers.find(
        p => p.name === options.preferProvider && p.isConfigured()
      );
      if (preferred) {
        const others = this.priority
          .map(name => this.providers.find(p => p.name === name && p.isConfigured()))
          .filter(p => p && p.name !== options.preferProvider) as LLMProvider[];
        orderedProviders = [preferred, ...others];
      } else {
        orderedProviders = this.getOrderedProviders();
      }
    } else {
      orderedProviders = this.getOrderedProviders();
    }

    if (orderedProviders.length === 0) {
      throw new Error('No LLM providers configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_API_KEY, or use the default z-ai-web-dev-sdk.');
    }

    // Try each provider in order (failover)
    const errors: string[] = [];
    for (const provider of orderedProviders) {
      try {
        const result = await provider.chat(messages, options);
        return result;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        errors.push(`${provider.name}: ${errMsg}`);
        console.warn(`[LLM Gateway] ${provider.name} failed: ${errMsg}. Trying next provider...`);
      }
    }

    throw new Error(`All LLM providers failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }

  async *chatStream(
    messages: LLMMessage[],
    options?: { temperature?: number; maxTokens?: number; preferProvider?: string }
  ): AsyncGenerator<string, void, unknown> {
    const orderedProviders = this.getOrderedProviders();
    // Prefer a provider that supports streaming
    if (options?.preferProvider) {
      const preferred = orderedProviders.find(p => p.name === options.preferProvider && p.chatStream);
      if (preferred) {
        const others = orderedProviders.filter(p => p.name !== options.preferProvider && p.chatStream);
        yield* preferred.chatStream(messages, options);
        return;
      }
    }
    // Find first provider with streaming support
    const streamingProvider = orderedProviders.find(p => p.chatStream);
    if (streamingProvider) {
      yield* streamingProvider.chatStream(messages, options);
    } else {
      // Fallback: non-streaming then chunk the output
      const result = await this.chat(messages, options);
      const words = result.content.split(' ');
      for (const word of words) {
        yield word + ' ';
      }
    }
  }

  private getOrderedProviders(): LLMProvider[] {
    return this.priority
      .map(name => this.providers.find(p => p.name === name))
      .filter((p): p is LLMProvider => !!p && p.isConfigured());
  }
}

// Singleton
let gatewayInstance: LLMGateway | null = null;

export function getLLMGateway(): LLMGateway {
  if (!gatewayInstance) {
    gatewayInstance = new LLMGateway();
  }
  return gatewayInstance;
}
