/**
 * Skill Executor
 *
 * Provides actual execution for built-in skills.
 * Uses z-ai-web-dev-sdk for web-search and image generation.
 * LLM-powered skills (summarizer, translator) use the LLM gateway.
 */

import { getLLMGateway } from './llm-gateway';
import type { LLMMessage } from './llm-gateway';

export interface SkillExecutionResult {
  success: boolean;
  output: string;
  skill: string;
  metadata?: Record<string, unknown>;
}

type SkillHandler = (input: string, context?: string) => Promise<SkillExecutionResult>;

class SkillExecutor {
  private handlers: Map<string, SkillHandler> = new Map();

  constructor() {
    this.registerBuiltinHandlers();
  }

  private registerBuiltinHandlers() {
    // Web Search — uses z-ai-web-dev-sdk's web_search function
    this.handlers.set('builtin:web-search', async (query: string): Promise<SkillExecutionResult> => {
      try {
        const { default: ZAI } = await import('z-ai-web-dev-sdk');
        const zai = await ZAI.create();
        const result = await zai.functions.invoke('web_search', {
          query,
          num: 5,
        });
        const results = Array.isArray(result) ? result : [];
        if (results.length === 0) {
          return { success: true, output: 'No results found for that query.', skill: 'web-search' };
        }
        const formatted = results
          .slice(0, 5)
          .map((r: { name?: string; snippet?: string; url?: string; rank?: number }, i: number) => {
            const name = r.name || `Result ${i + 1}`;
            const snippet = r.snippet || 'No description available.';
            const url = r.url || '';
            return `${i + 1}. **${name}**\n   ${snippet}\n   ${url}`;
          })
          .join('\n\n');
        return { success: true, output: formatted, skill: 'web-search', metadata: { resultCount: results.length } };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, output: `Web search failed: ${errMsg}`, skill: 'web-search' };
      }
    });

    // Image Generator — uses z-ai-web-dev-sdk's image generation
    this.handlers.set('builtin:image-generator', async (prompt: string): Promise<SkillExecutionResult> => {
      try {
        const { default: ZAI } = await import('z-ai-web-dev-sdk');
        const zai = await ZAI.create();
        const result = await zai.images.generations.create({
          prompt,
          size: '1024x1024',
        });
        const imageData = result.data?.[0]?.base64 || result.data?.[0]?.url || '';
        return {
          success: !!imageData,
          output: imageData.startsWith('http') ? imageData : `[Image generated successfully. Base64 data available in API response.]`,
          skill: 'image-generator',
          metadata: imageData.startsWith('data:') ? { format: 'base64', prefix: imageData.substring(0, 30) } : { format: 'url' },
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, output: `Image generation failed: ${errMsg}`, skill: 'image-generator' };
      }
    });

    // Summarizer — uses LLM to summarize text
    this.handlers.set('builtin:summarizer', async (text: string, context?: string): Promise<SkillExecutionResult> => {
      try {
        const gateway = getLLMGateway();
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: 'You are a summarization assistant. Provide a clear, concise summary of the text provided. Use bullet points for key takeaways. Keep the summary under 200 words unless otherwise specified.',
          },
          { role: 'user', content: text },
        ];
        if (context) {
          messages.push({ role: 'user', content: `Context: ${context}` });
        }
        const result = await gateway.chat(messages, { temperature: 0.3 });
        return { success: true, output: result.content, skill: 'summarizer', metadata: { provider: result.provider } };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, output: `Summarization failed: ${errMsg}`, skill: 'summarizer' };
      }
    });

    // Translator — uses LLM to translate text
    this.handlers.set('builtin:translator', async (text: string, context?: string): Promise<SkillExecutionResult> => {
      try {
        const gateway = getLLMGateway();
        const messages: LLMMessage[] = [
          {
            role: 'system',
            content: 'You are a translation assistant. Translate the provided text accurately while preserving tone, formatting, and nuance. If the user specifies a target language, translate to that language. Otherwise, detect the source language and translate to English.',
          },
          { role: 'user', content: text },
        ];
        if (context) {
          messages.push({ role: 'user', content: `Target context: ${context}` });
        }
        const result = await gateway.chat(messages, { temperature: 0.2 });
        return { success: true, output: result.content, skill: 'translator', metadata: { provider: result.provider } };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, output: `Translation failed: ${errMsg}`, skill: 'translator' };
      }
    });

    // File Reader — extracts and formats text from attachments
    this.handlers.set('builtin:file-reader', async (input: string): Promise<SkillExecutionResult> => {
      try {
        // Input should be a base64-encoded file or raw text
        let content = input;
        if (input.startsWith('data:')) {
          // Extract base64 content from data URI
          const base64Match = input.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            content = Buffer.from(base64Match[1], 'base64').toString('utf-8');
          }
        }
        // Limit output size
        const truncated = content.length > 5000 ? content.substring(0, 5000) + '\n\n[... truncated at 5000 characters]' : content;
        return {
          success: true,
          output: truncated,
          skill: 'file-reader',
          metadata: { chars: content.length, truncated: content.length > 5000 },
        };
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, output: `File reading failed: ${errMsg}`, skill: 'file-reader' };
      }
    });

    // Code Executor — evaluates simple expressions safely
    this.handlers.set('builtin:code-executor', async (code: string): Promise<SkillExecutionResult> => {
      return {
        success: false,
        output: 'Code execution is not available in this environment. This skill requires a sandboxed runtime (e.g., Deno or WebAssembly).',
        skill: 'code-executor',
        metadata: { planned: true },
      };
    });
  }

  async execute(handler: string, input: string, context?: string): Promise<SkillExecutionResult> {
    const skillHandler = this.handlers.get(handler);
    if (!skillHandler) {
      return { success: false, output: `Unknown skill handler: ${handler}`, skill: handler };
    }
    return skillHandler(input, context);
  }

  hasHandler(handler: string): boolean {
    return this.handlers.has(handler);
  }
}

// Singleton
let executorInstance: SkillExecutor | null = null;

export function getSkillExecutor(): SkillExecutor {
  if (!executorInstance) {
    executorInstance = new SkillExecutor();
  }
  return executorInstance;
}
