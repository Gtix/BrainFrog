/**
 * ReAct (Reason + Act) Engine
 *
 * The LLM decides which tools to use based on reasoning, not hardcoded regex.
 * This is what makes Brain Frog genuinely agentic.
 *
 * Loop: Thought → Action → Observation → Thought → ... → Answer
 */

import { getLLMGateway, type LLMMessage } from './llm-gateway';
import { getSkillExecutor, type SkillExecutionResult } from './skill-executor';
import type { AgentConfig } from './types';

export interface ReActStep {
  type: 'thought' | 'action' | 'observation' | 'answer';
  content: string;
  tool?: string;
  toolInput?: string;
  duration?: number;
}

export interface ReActResult {
  answer: string;
  steps: ReActStep[];
  totalTokens: { prompt: number; completion: number };
  provider: string;
  model: string;
  skillResults?: SkillExecutionResult[];
}

const MAX_ITERATIONS = 6;

const TOOL_DEFINITIONS = [
  {
    name: 'web-search',
    description: 'Search the internet for current information, news, facts, or any topic. Use this when the user asks about recent events, current data, or anything that might not be in your training data.',
    inputDescription: 'A search query string',
  },
  {
    name: 'summarizer',
    description: 'Summarize a long text into a concise summary. Use this when the user provides a long text and asks for a summary, tldr, or brief.',
    inputDescription: 'The text to summarize',
  },
  {
    name: 'translator',
    description: 'Translate text between languages. Use this when the user asks to translate something. Detect the target language from context or the user request.',
    inputDescription: 'The text to translate, optionally with target language as context',
  },
  {
    name: 'image-generator',
    description: 'Generate an image from a text description. Use this when the user asks to create, draw, or generate an image.',
    inputDescription: 'A detailed text description of the desired image',
  },
];

const HANDLER_MAP: Record<string, string> = {
  'web-search': 'builtin:web-search',
  'image-generator': 'builtin:image-generator',
  'summarizer': 'builtin:summarizer',
  'translator': 'builtin:translator',
};

function buildToolSchema(): string {
  return TOOL_DEFINITIONS.map(t => 
    `- "${t.name}": ${t.description} Input: ${t.inputDescription}`
  ).join('\n');
}

function buildSystemPrompt(memoryContext: string, config: AgentConfig): string {
  return `You are Brain Frog, an AI agent that reasons through problems step by step. You have access to tools and must decide when to use them.

For each step, output a SINGLE JSON object (no markdown, no code blocks, just raw JSON). Choose one of these formats:

1. To think: {"thought": "Your reasoning about what to do next"}
2. To use a tool: {"action": "tool-name", "input": "the input for the tool", "thought": "why you're using this tool"}
3. To give a final answer: {"answer": "Your complete response to the user"}

IMPORTANT RULES:
- Always start with a {"thought": "..."} step to reason about the user's request
- Only use tools when they genuinely help answer the question
- If the user just wants to chat or ask a general question, go straight to {"answer": "..."}
- After using a tool, always include a {"thought": "..."} step to reason about the results
- Your final step must be {"answer": "..."} with your complete response
- You can use multiple tools in sequence if needed (max ${MAX_ITERATIONS} total steps)
- Output ONLY the JSON object, nothing else before or after

AVAILABLE TOOLS:
${buildToolSchema()}

${memoryContext}

Current settings: temperature=${config.temperature}, maxTokens=${config.maxTokens}`;
}

interface ParsedStep {
  type: 'thought' | 'action' | 'answer';
  thought?: string;
  action?: string;
  input?: string;
  answer?: string;
}

function parseLLMResponse(text: string): ParsedStep | null {
  // Try to parse as JSON
  let clean = text.trim();
  
  // Remove markdown code blocks if present
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  try {
    const parsed = JSON.parse(clean);
    if (parsed.answer !== undefined) {
      return { type: 'answer', answer: String(parsed.answer), thought: parsed.thought };
    }
    if (parsed.action !== undefined) {
      return { type: 'action', action: parsed.action, input: parsed.input, thought: parsed.thought };
    }
    if (parsed.thought !== undefined) {
      return { type: 'thought', thought: parsed.thought };
    }
  } catch {
    // Not valid JSON — treat as a direct answer
    return { type: 'answer', answer: text };
  }

  return null;
}

export async function executeReAct(
  userMessage: string,
  conversationHistory: LLMMessage[],
  memoryContext: string,
  config: AgentConfig,
  preferredProvider?: string
): Promise<ReActResult> {
  const gateway = getLLMGateway();
  const executor = getSkillExecutor();
  const steps: ReActStep[] = [];
  let totalTokens = { prompt: 0, completion: 0 };
  let lastProvider = '';
  let lastModel = '';
  const skillResults: SkillExecutionResult[] = [];

  const systemPrompt = buildSystemPrompt(memoryContext, config);

  // Build conversation context (last 10 messages for context)
  const contextMessages: LLMMessage[] = conversationHistory.slice(-10);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const start = Date.now();

    // Build messages for this turn
    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      ...contextMessages,
    ];

    // Add user message if this is the first iteration
    if (iteration === 0) {
      messages.push({ role: 'user', content: userMessage });
    }

    // Add previous steps as context for subsequent iterations
    if (steps.length > 0) {
      // We add a synthetic "assistant" message with the steps so far
      const stepsSummary = steps.map(s => {
        switch (s.type) {
          case 'thought': return `[Thought]: ${s.content}`;
          case 'action': return `[Action]: Called ${s.tool} with input: "${s.toolInput}"`;
          case 'observation': return `[Observation]: ${s.content}`;
          default: return '';
        }
      }).filter(Boolean).join('\n');
      
      messages.push({ role: 'assistant', content: stepsSummary });
    }

    // Call LLM
    const result = await gateway.chat(messages, {
      temperature: config.temperature,
      maxTokens: Math.min(config.maxTokens, 1024), // Keep reasoning steps shorter
      preferProvider: preferredProvider,
    });

    totalTokens.prompt += result.usage?.promptTokens ?? 0;
    totalTokens.completion += result.usage?.completionTokens ?? 0;
    lastProvider = result.provider;
    lastModel = result.model;

    const step = parseLLMResponse(result.content);
    if (!step) {
      // LLM gave unparseable output — treat as answer
      steps.push({
        type: 'answer',
        content: result.content,
        duration: Date.now() - start,
      });
      break;
    }

    if (step.type === 'thought') {
      steps.push({
        type: 'thought',
        content: step.thought || '',
        duration: Date.now() - start,
      });
      // Continue the loop — LLM needs to decide next action
      continue;
    }

    if (step.type === 'action') {
      const toolName = step.action || '';
      const handler = HANDLER_MAP[toolName];

      steps.push({
        type: 'action',
        content: step.thought || `Using ${toolName}`,
        tool: toolName,
        toolInput: step.input || '',
        duration: Date.now() - start,
      });

      // Execute the tool
      if (handler && executor.hasHandler(handler)) {
        const toolStart = Date.now();
        try {
          const execResult = await executor.execute(handler, step.input || '', '');
          skillResults.push(execResult);
          
          const observation = execResult.success
            ? execResult.output
            : `Tool error: ${execResult.output}`;

          steps.push({
            type: 'observation',
            content: observation.substring(0, 2000), // Truncate long observations
            duration: Date.now() - toolStart,
          });
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Tool execution failed';
          steps.push({
            type: 'observation',
            content: `Error executing ${toolName}: ${errMsg}`,
            duration: Date.now() - toolStart,
          });
        }
      } else {
        steps.push({
          type: 'observation',
          content: `Unknown tool: ${toolName}. Available tools: ${Object.keys(HANDLER_MAP).join(', ')}`,
          duration: 0,
        });
      }
      // Continue the loop — LLM should process the observation
      continue;
    }

    if (step.type === 'answer') {
      steps.push({
        type: 'answer',
        content: step.answer || result.content,
        duration: Date.now() - start,
      });
      break;
    }
  }

  // If we hit max iterations without an answer, synthesize one
  const lastStep = steps[steps.length - 1];
  const answer = lastStep?.type === 'answer' 
    ? lastStep.content 
    : 'I wasn\'t able to complete the task within the step limit. Please try rephrasing your request.';

  return {
    answer,
    steps,
    totalTokens,
    provider: lastProvider,
    model: lastModel,
    skillResults: skillResults.length > 0 ? skillResults : undefined,
  };
}
