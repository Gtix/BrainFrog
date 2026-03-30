import type { IncomingMessage, OutgoingMessage, PlatformType, MessagingAdapter } from './types';
import { TelegramAdapter } from './adapters';
import { DiscordAdapter } from './adapters';
import { WhatsAppAdapter } from './adapters';

/**
 * MessagingGateway
 *
 * Central router for all messaging platforms.
 * Responsibilities:
 * 1. Route incoming messages to the correct adapter
 * 2. Forward messages to NexusAgent for processing
 * 3. Send responses back through the correct platform
 * 4. Maintain session mappings (platform user ID → NexusAgent session ID)
 * 5. Rate limiting per platform/user
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class MessagingGateway {
  private adapters: Map<PlatformType, MessagingAdapter> = new Map();
  private sessionMappings: Map<string, string> = new Map(); // "platform:userId" → "sessionId"
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private maxRequestsPerMinute = 30;
  private agent: { chat: (opts: { message: string; sessionId: string; platform?: string }) => Promise<{ message: { content: string }; sessionId: string }> } | null = null;

  constructor() {}

  /**
   * Register a messaging adapter.
   */
  registerAdapter(adapter: MessagingAdapter): void {
    this.adapters.set(adapter.platform, adapter);
    console.log(`[Messaging] Registered adapter: ${adapter.platform}`);
  }

  /**
   * Set the agent instance (called after agent is initialized).
   */
  setAgent(agent: typeof this.agent): void {
    this.agent = agent;
    console.log('[Messaging] Agent connected to gateway');
  }

  /**
   * Auto-configure adapters from environment variables.
   */
  autoConfigure(): void {
    // Telegram
    if (process.env.TELEGRAM_BOT_TOKEN) {
      this.registerAdapter(new TelegramAdapter(process.env.TELEGRAM_BOT_TOKEN));
    }

    // Discord
    if (process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_PUBLIC_KEY) {
      this.registerAdapter(new DiscordAdapter(process.env.DISCORD_BOT_TOKEN, process.env.DISCORD_PUBLIC_KEY));
    }

    // WhatsApp
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'nexus-agent-verify';
      this.registerAdapter(new WhatsAppAdapter(
        process.env.WHATSAPP_TOKEN,
        process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken,
      ));
    }

    console.log(`[Messaging] Auto-configured ${this.adapters.size} platform(s)`);
  }

  /**
   * Get adapter for a platform.
   */
  getAdapter(platform: PlatformType): MessagingAdapter | undefined {
    return this.adapters.get(platform);
  }

  /**
   * Get or create a session ID for a platform user.
   * Maps "telegram:12345" → a persistent NexusAgent session ID.
   */
  getOrCreateSessionId(platform: PlatformType, platformUserId: string): string {
    const key = `${platform}:${platformUserId}`;
    const existing = this.sessionMappings.get(key);
    if (existing) return existing;

    const newSessionId = crypto.randomUUID();
    this.sessionMappings.set(key, newSessionId);
    return newSessionId;
  }

  /**
   * Handle an incoming message from any platform.
   * This is the main entry point — the webhook routes call this.
   */
  async handleMessage(incoming: IncomingMessage): Promise<{ success: boolean; responseId?: string; error?: string }> {
    if (!this.agent) {
      return { success: false, error: 'Agent not connected' };
    }

    // Rate limiting
    if (!this.checkRateLimit(incoming.platform, incoming.platformUserId)) {
      console.warn(`[Messaging] Rate limited: ${incoming.platform}:${incoming.platformUserId}`);
      return { success: false, error: 'Rate limited. Please slow down.' };
    }

    try {
      // Get or create session for this user
      const sessionId = this.getOrCreateSessionId(incoming.platform, incoming.platformUserId);

      // Build message (include platform context)
      let messageContent = incoming.content;
      if (incoming.replyToMessageId) {
        messageContent = `[reply to ${incoming.replyToMessageId}] ${messageContent}`;
      }

      // Send to agent
      const response = await this.agent.chat({
        message: messageContent,
        sessionId,
        platform: incoming.platform,
      });

      // Send response back through the platform adapter
      const adapter = this.adapters.get(incoming.platform);
      if (adapter) {
        const responseId = await adapter.send({
          content: response.message.content,
          platform: incoming.platform,
          chatId: incoming.chatId,
          replyToMessageId: incoming.platformMessageId,
        });

        return { success: true, responseId };
      }

      return { success: true };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[Messaging] Error handling message: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  /**
   * Handle a raw webhook payload from a platform.
   * Parses, validates, and processes the message.
   */
  async handleWebhook(platform: PlatformType, rawBody: unknown, headers: Record<string, string>): Promise<Response> {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      return new Response(JSON.stringify({ error: 'Platform not configured' }), { status: 400 });
    }

    // Validate webhook authenticity
    if (!adapter.validateWebhook(rawBody, headers)) {
      return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 401 });
    }

    // Parse the incoming message
    const incoming = adapter.parseIncoming(rawBody);

    // Handle Discord PING verification
    if (platform === 'discord') {
      const body = rawBody as Record<string, unknown>;
      if (body?.type === 1) {
        return new Response(JSON.stringify({ type: 1 }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (!incoming) {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Process the message
    const result = await this.handleMessage(incoming);

    return new Response(
      JSON.stringify({ ok: result.success, error: result.error }),
      { status: result.success ? 200 : 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  /**
   * Simple rate limiter: max N requests per user per minute.
   */
  private checkRateLimit(platform: PlatformType, userId: string): boolean {
    const key = `${platform}:${userId}`;
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now > entry.resetAt) {
      this.rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }

    if (entry.count >= this.maxRequestsPerMinute) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get stats about the gateway.
   */
  getStats() {
    return {
      platforms: Array.from(this.adapters.keys()),
      activeSessions: this.sessionMappings.size,
      rateLimitedUsers: Array.from(this.rateLimits.entries())
        .filter(([, entry]) => entry.count >= this.maxRequestsPerMinute)
        .map(([key]) => key),
    };
  }
}

// Singleton
let gatewayInstance: MessagingGateway | null = null;

export function getMessagingGateway(): MessagingGateway {
  if (!gatewayInstance) {
    gatewayInstance = new MessagingGateway();
    gatewayInstance.autoConfigure();
  }
  return gatewayInstance;
}
