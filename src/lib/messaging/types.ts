/**
 * Messaging Types
 *
 * Defines the adapter interface and shared types for all messaging platforms.
 * Each platform (Telegram, Discord, WhatsApp) implements the MessagingAdapter interface,
 * translating platform-specific formats into NexusAgent's unified format.
 */

export type PlatformType = 'telegram' | 'discord' | 'whatsapp' | 'web';

/** Unified incoming message format (platform-agnostic) */
export interface IncomingMessage {
  /** Platform-specific message ID */
  platformMessageId: string;
  /** Unique identifier for the user on this platform */
  platformUserId: string;
  /** Display name of the user */
  userName: string;
  /** The actual message text */
  content: string;
  /** Which platform this came from */
  platform: PlatformType;
  /** Platform-specific chat/channel ID for threading */
  chatId: string;
  /** Timestamp from the platform */
  timestamp: Date;
  /** Optional: attach media (images, files) as URLs */
  attachments?: Array<{ type: string; url: string; name: string }>;
  /** Optional: is this a reply to another message? */
  replyToMessageId?: string;
}

/** Unified outgoing message format */
export interface OutgoingMessage {
  /** The text to send */
  content: string;
  /** Which platform to send to */
  platform: PlatformType;
  /** Chat/channel ID on the platform */
  chatId: string;
  /** Optional: reply to a specific message */
  replyToMessageId?: string;
  /** Optional: parse mode (Markdown, HTML) */
  parseMode?: 'markdown' | 'html';
}

/** Configuration for a messaging platform */
export interface PlatformConfig {
  platform: PlatformType;
  enabled: boolean;
  /** Bot/API token or key */
  token: string;
  /** Optional: additional platform-specific settings */
  settings?: Record<string, string>;
}

/**
 * MessagingAdapter interface
 *
 * Every messaging platform must implement this interface.
 * The gateway calls these methods to interact with each platform.
 */
export interface MessagingAdapter {
  /** Platform identifier */
  platform: PlatformType;

  /**
   * Parse a raw webhook payload from the platform into an IncomingMessage.
   * Returns null if the payload should be ignored (e.g., non-text messages).
   */
  parseIncoming(rawBody: unknown): IncomingMessage | null;

  /**
   * Send a response back through the platform.
   * Returns the platform's message ID on success.
   */
  send(message: OutgoingMessage): Promise<string>;

  /**
   * Validate that the incoming webhook is authentic.
   * Checks signature/header/token depending on platform.
   */
  validateWebhook(rawBody: unknown, headers: Record<string, string>): boolean;

  /**
   * Get the webhook URL path for this platform.
   */
  getWebhookPath(): string;
}

/** Mapping of platform user IDs to NexusAgent session IDs */
export interface PlatformSessionMapping {
  id: string;
  platform: PlatformType;
  platformUserId: string;
  sessionId: string;
  createdAt: Date;
  lastUsedAt: Date;
}
