import { db } from '@/lib/db';
import { DEFAULT_AGENT_CONFIG, type AgentConfig, type AgentMessage, type AgentSession } from './types';
import { PersistentMemorySystem } from './persistent-memory';
import { SkillRegistry, builtinSkills } from './skills';
import { SecurityManager } from '../security/manager';
import { getPromptVersioning } from '../analytics/prompt-versioning';
import { getLLMGateway, type LLMProvider } from './llm-gateway';
import { getSkillExecutor, type SkillExecutionResult } from './skill-executor';

interface ChatOptions {
  message: string;
  sessionId?: string;
  systemPromptOverride?: string;
  platform?: string;
  externalUserId?: string;
  provider?: string;
}

interface ChatResponse {
  message: AgentMessage;
  sessionId: string;
  memoryStats: { working: number; episodic: number; semantic: number; total: number };
  securityCheck: { safe: boolean; risk: number };
  promptVersion?: { id: string; label: string };
  llmProvider?: string;
  llmModel?: string;
  skillResults?: SkillExecutionResult[];
}

export class NexusAgent {
  private config: AgentConfig;
  private memory: PersistentMemorySystem;
  private skills: SkillRegistry;
  private security: SecurityManager;
  private sessionCache: Map<string, AgentSession> = new Map();
  private initialized = false;
  private activePromptVersionId: string | null = null;

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    this.memory = new PersistentMemorySystem();
    this.skills = new SkillRegistry();
    this.security = new SecurityManager();

    for (const skill of builtinSkills) {
      this.skills.register(skill);
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.memory.initialize();

    // Load the active prompt version
    const pv = getPromptVersioning();
    const activePrompt = await pv.getActivePrompt();
    this.activePromptVersionId = activePrompt.id;
    this.config.systemPrompt = activePrompt.content;

    const gateway = getLLMGateway();
    const providers = gateway.getConfiguredProviders();

    this.security.log('AGENT_INITIALIZED', 'info',
      `NexusAgent initialized. Prompt: "${activePrompt.label}" (${activePrompt.id.substring(0, 8)}...). LLM providers: ${providers.map(p => p.name).join(', ') || 'z-ai-web-dev-sdk (default)'}`);
    this.initialized = true;
  }

  getActivePromptVersionId(): string | null {
    return this.activePromptVersionId;
  }

  getConfiguredLLMProviders(): Array<{ name: string; model: string; priority: number }> {
    return getLLMGateway().getConfiguredProviders();
  }

  private async getOrCreateSession(sessionId: string, platform = 'web'): Promise<AgentSession> {
    const cached = this.sessionCache.get(sessionId);
    if (cached) return cached;

    const dbSession = await db.agentSession.findUnique({
      where: { id: sessionId },
      include: { messages: { orderBy: { timestamp: 'asc' } } },
    });

    let session: AgentSession;
    if (dbSession) {
      session = {
        id: dbSession.id,
        createdAt: dbSession.createdAt,
        updatedAt: dbSession.updatedAt,
        messages: dbSession.messages.map(m => ({
          id: m.id,
          role: m.role as AgentMessage['role'],
          content: m.content,
          timestamp: m.timestamp,
        })),
        memory: [],
        skills: this.skills.getAll().map(s => s.name),
        config: { ...this.config },
      };
    } else {
      const sessionData: Record<string, unknown> = { id: sessionId, platform };
      if (this.activePromptVersionId) {
        sessionData.promptVersionId = this.activePromptVersionId;
      }
      await db.agentSession.create({ data: sessionData });
      session = {
        id: sessionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: [],
        memory: [],
        skills: this.skills.getAll().map(s => s.name),
        config: { ...this.config },
      };
    }

    this.sessionCache.set(sessionId, session);
    return session;
  }

  private async detectAndExecuteSkills(message: string): Promise<SkillExecutionResult[]> {
    if (!this.config.enableSkills) return [];

    const executor = getSkillExecutor();
    const lower = message.toLowerCase().trim();
    const results: SkillExecutionResult[] = [];

    // Web search detection
    const searchPatterns = [
      /^(?:search|find|look up|google|bing)\s+(?:for\s+)?(.+)/i,
      /^(?:what|who|when|where|how|why)\s+(?:is|are|was|were|did|do|does|will|can)\s+.+\?/i,
      /^(?:latest|current|recent|today'?s?|news)\s+(?:news\s+|update\s+|info\s+)?(.+)/i,
      /^search the web[:\s]+(.+)/i,
    ];

    for (const pattern of searchPatterns) {
      const match = lower.match(pattern);
      if (match) {
        const query = message.substring(match.index!, match[0].length).replace(/^(?:search|find|look up|google|bing|search the web)[:\s]*/i, '').trim() || match[1] || message;
        const result = await executor.execute('builtin:web-search', query);
        results.push(result);
        break;
      }
    }

    // Image generation detection
    const imagePatterns = [
      /^(?:generate|create|draw|make|paint)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork)\s+(?:of\s+|about\s+)?(.+)/i,
      /^(?:image|picture|draw|paint|illustrate|visualize)[:\s]+(.+)/i,
    ];

    for (const pattern of imagePatterns) {
      const match = lower.match(pattern);
      if (match) {
        const prompt = message.substring(match.index!, message.length).replace(/^(?:generate|create|draw|make|paint)\s+(?:an?\s+)?(?:image|picture|photo|illustration|artwork)\s+(?:of\s+|about\s+)?/i, '').trim() || match[1] || message;
        const result = await executor.execute('builtin:image-generator', prompt);
        results.push(result);
        break;
      }
    }

    // Summarize detection
    if (/^(?:summarize|summary|tldr|tl;dr|recap|brief)\b/i.test(lower)) {
      const text = message.replace(/^(?:summarize|summary|tldr|tl;dr|recap|brief)[\s:]*/i, '').trim();
      if (text.length > 20) {
        const result = await executor.execute('builtin:summarizer', text);
        results.push(result);
      }
    }

    // Translate detection
    const translateMatch = lower.match(/^(?:translate|translation)\s+(?:to\s+)?(\w+)?[:\s]+(.+)/i);
    if (translateMatch) {
      const targetLang = translateMatch[1] || '';
      const text = translateMatch[2] || message;
      const result = await executor.execute('builtin:translator', text, targetLang);
      results.push(result);
    }

    return results;
  }

  private buildSkillContext(skillResults: SkillExecutionResult[]): string {
    if (skillResults.length === 0) return '';
    let context = '\n\n[Skill Execution Results]\n';
    for (const result of skillResults) {
      context += `\n--- ${result.skill.toUpperCase()} (${result.success ? 'SUCCESS' : 'FAILED'}) ---\n`;
      context += result.output + '\n';
    }
    context += '\n[End Skill Results]\n';
    return context;
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const { message, sessionId, systemPromptOverride, platform, provider: preferredProvider } = options;

    const sanitizedInput = this.security.sanitizeInput(message);
    const injectionCheck = this.security.detectPromptInjection(sanitizedInput);

    const sid = sessionId || crypto.randomUUID();
    const session = await this.getOrCreateSession(sid, platform);

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: sanitizedInput,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    await db.chatMessage.create({
      data: {
        id: userMsg.id,
        sessionId: sid,
        role: userMsg.role,
        content: userMsg.content,
        timestamp: userMsg.timestamp,
        promptVersionId: this.activePromptVersionId,
      },
    });

    await db.agentSession.update({
      where: { id: sid },
      data: { updatedAt: new Date() },
    });

    await this.memory.addWorking(sanitizedInput, 0.5, sid);

    // Execute skills if applicable
    const skillResults = await this.detectAndExecuteSkills(sanitizedInput);
    const skillContext = this.buildSkillContext(skillResults);

    const systemPrompt = systemPromptOverride || this.config.systemPrompt;
    const memoryContext = this.config.enableMemory
      ? await this.memory.getContextForPrompt(sanitizedInput)
      : '';

    let systemContent = systemPrompt + memoryContext;
    if (skillContext) {
      systemContent += '\n\nThe user\'s message triggered one or more skills. The results are included below. Use these results to provide a comprehensive, helpful response. Reference the skill data naturally in your answer.';
      systemContent += skillContext;
    }

    const apiMessages = [
      { role: 'system' as const, content: systemContent },
      ...session.messages.slice(-20).map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    try {
      const gateway = getLLMGateway();
      const result = await gateway.chat(apiMessages, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        preferProvider: preferredProvider,
      });

      const responseContent = result.content || 'I apologize, but I was unable to generate a response. Please try again.';

      const outputCheck = this.security.validateOutput(responseContent);
      const safeContent = outputCheck.safe ? responseContent : '[Response filtered due to security policy]';

      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: safeContent,
        timestamp: new Date(),
      };
      session.messages.push(assistantMsg);

      await db.chatMessage.create({
        data: {
          id: assistantMsg.id,
          sessionId: sid,
          role: assistantMsg.role,
          content: assistantMsg.content,
          timestamp: assistantMsg.timestamp,
          promptVersionId: this.activePromptVersionId,
        },
      });

      await this.memory.compact();

      if (!injectionCheck.safe) {
        await this.persistSecurityLog('PROMPT_INJECTION_BLOCKED', 'warning',
          `Risk: ${(injectionCheck.risk * 100).toFixed(0)}%. Session: ${sid}`);
      }

      this.security.log('CHAT_COMPLETED', 'info',
        `Session ${sid}: ${session.messages.length} messages. Provider: ${result.provider}/${result.model}. Skills: ${skillResults.length > 0 ? skillResults.map(s => s.skill).join(', ') : 'none'}`);

      let promptVersion: { id: string; label: string } | undefined;
      if (this.activePromptVersionId) {
        const pvData = await db.promptVersion.findUnique({
          where: { id: this.activePromptVersionId },
          select: { id: true, label: true },
        });
        if (pvData) promptVersion = { id: pvData.id, label: pvData.label };
      }

      return {
        message: assistantMsg,
        sessionId: sid,
        memoryStats: await this.memory.getStats(),
        securityCheck: { safe: injectionCheck.safe, risk: injectionCheck.risk },
        promptVersion,
        llmProvider: result.provider,
        llmModel: result.model,
        skillResults: skillResults.length > 0 ? skillResults : undefined,
      };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.security.log('CHAT_ERROR', 'critical', errMsg);
      await this.persistSecurityLog('CHAT_ERROR', 'critical', errMsg);
      throw new Error(`Agent error: ${errMsg}`);
    }
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<string> {
    const { message, sessionId, systemPromptOverride, platform, provider: preferredProvider } = options;

    const sanitizedInput = this.security.sanitizeInput(message);
    const injectionCheck = this.security.detectPromptInjection(sanitizedInput);

    const sid = sessionId || crypto.randomUUID();
    const session = await this.getOrCreateSession(sid, platform || 'web');

    const userMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: sanitizedInput,
      timestamp: new Date(),
    };
    session.messages.push(userMsg);

    await db.chatMessage.create({
      data: {
        id: userMsg.id,
        sessionId: sid,
        role: userMsg.role,
        content: userMsg.content,
        timestamp: userMsg.timestamp,
        promptVersionId: this.activePromptVersionId,
      },
    });

    await db.agentSession.update({
      where: { id: sid },
      data: { updatedAt: new Date() },
    });

    await this.memory.addWorking(sanitizedInput, 0.5, sid);

    // Execute skills if applicable
    const skillResults = await this.detectAndExecuteSkills(sanitizedInput);
    const skillContext = this.buildSkillContext(skillResults);

    // Send session ID and skill info as metadata event
    const metaEvent = JSON.stringify({
      type: 'meta',
      sessionId: sid,
      securityCheck: { safe: injectionCheck.safe, risk: injectionCheck.risk },
      skillResults: skillResults.length > 0 ? skillResults.map(r => ({
        skill: r.skill,
        success: r.success,
        preview: r.output.substring(0, 200),
      })) : undefined,
    });
    // Yield meta as a string but the SSE layer wraps it — we'll yield with a prefix
    yield `\x00META:${metaEvent}\x00`;

    const systemPrompt = systemPromptOverride || this.config.systemPrompt;
    const memoryContext = this.config.enableMemory
      ? await this.memory.getContextForPrompt(sanitizedInput)
      : '';

    let systemContent = systemPrompt + memoryContext;
    if (skillContext) {
      systemContent += '\n\nThe user\'s message triggered one or more skills. The results are included below. Use these results to provide a comprehensive, helpful response. Reference the skill data naturally in your answer.';
      systemContent += skillContext;
    }

    const apiMessages = [
      { role: 'system' as const, content: systemContent },
      ...session.messages.slice(-20).map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    ];

    try {
      const gateway = getLLMGateway();
      const stream = gateway.chatStream(apiMessages, {
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        preferProvider: preferredProvider,
      });

      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        yield chunk;
      }

      const outputCheck = this.security.validateOutput(fullContent);
      const safeContent = outputCheck.safe ? fullContent : '[Response filtered due to security policy]';

      const assistantMsg: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: safeContent,
        timestamp: new Date(),
      };
      session.messages.push(assistantMsg);

      await db.chatMessage.create({
        data: {
          id: assistantMsg.id,
          sessionId: sid,
          role: assistantMsg.role,
          content: assistantMsg.content,
          timestamp: assistantMsg.timestamp,
          promptVersionId: this.activePromptVersionId,
        },
      });

      await this.memory.compact();

      if (!injectionCheck.safe) {
        await this.persistSecurityLog('PROMPT_INJECTION_BLOCKED', 'warning',
          `Risk: ${(injectionCheck.risk * 100).toFixed(0)}%. Session: ${sid}`);
      }

      this.security.log('CHAT_STREAM_COMPLETED', 'info', `Session ${sid}: ${session.messages.length} messages. Skills: ${skillResults.length > 0 ? skillResults.map(s => s.skill).join(', ') : 'none'}`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.security.log('CHAT_ERROR', 'critical', errMsg);
      await this.persistSecurityLog('CHAT_ERROR', 'critical', errMsg);
      throw new Error(`Agent error: ${errMsg}`);
    }
  }

  private async persistSecurityLog(event: string, severity: string, details: string): Promise<void> {
    try {
      await db.securityAuditLog.create({ data: { event, severity, details } });
    } catch { /* Don't let logging failures break the agent */ }
  }

  async getSession(sessionId: string): Promise<AgentSession | undefined> {
    return this.sessionCache.get(sessionId);
  }

  async getMemoryStats() {
    return this.memory.getStats();
  }

  getSecurityLogs(limit = 50) {
    return this.security.getAuditLogs(limit);
  }

  async getSecurityLogsFromDB(limit = 50) {
    return db.securityAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  getAvailableSkills() {
    return this.skills.getAll();
  }

  getConfig() {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AgentConfig>) {
    this.config = { ...this.config, ...updates };
    this.security.log('CONFIG_UPDATED', 'info', `Config updated: ${Object.keys(updates).join(', ')}`);
  }

  async clearSession(sessionId: string): Promise<boolean> {
    this.sessionCache.delete(sessionId);
    await db.chatMessage.deleteMany({ where: { sessionId } });
    await db.memoryEntry.deleteMany({ where: { sessionId } });
    await db.agentSession.delete({ where: { id: sessionId } }).catch(() => {});
    return true;
  }
}

// Singleton
let agentInstance: NexusAgent | null = null;

export async function getAgent(config?: Partial<AgentConfig>): Promise<NexusAgent> {
  if (!agentInstance) {
    agentInstance = new NexusAgent(config);
    await agentInstance.initialize();
  }
  return agentInstance;
}
