import type { MessagingAdapter, IncomingMessage, OutgoingMessage, PlatformType } from './types';

/**
 * Telegram Bot Adapter
 *
 * Handles Telegram Bot API webhook payloads.
 * Docs: https://core.telegram.org/bots/api
 *
 * Setup:
 * 1. Create a bot via @BotFather on Telegram
 * 2. Set the webhook URL: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/messaging/telegram
 * 3. Set TELEGRAM_BOT_TOKEN in your .env
 */
export class TelegramAdapter implements MessagingAdapter {
  platform: PlatformType = 'telegram';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  getWebhookPath(): string {
    return '/api/messaging/telegram';
  }

  validateWebhook(rawBody: unknown, headers: Record<string, string>): boolean {
    // Telegram doesn't use webhook signatures by default.
    // For production, you should set a secret header in your webhook URL
    // and validate it here. Example:
    // const secretHeader = headers['x-telegram-bot-api-secret-token'];
    // return secretHeader === process.env.TELEGRAM_WEBHOOK_SECRET;
    return true;
  }

  parseIncoming(rawBody: unknown): IncomingMessage | null {
    const body = rawBody as Record<string, unknown>;
    if (!body || typeof body !== 'object') return null;

    const message = body.message as Record<string, unknown> | undefined;
    if (!message) return null;

    // Ignore non-text messages (edits, commands to other bots, etc.)
    if (typeof message.text !== 'string' || !message.text.trim()) return null;

    // Extract user info
    const from = message.from as Record<string, unknown> | undefined;
    const chat = message.chat as Record<string, unknown> | undefined;
    if (!from || !chat) return null;

    const userId = String(from.id);
    const userName = from.username
      ? `@${from.username}`
      : [from.first_name, from.last_name].filter(Boolean).join(' ');

    // Extract attachments (photos, documents)
    const attachments: IncomingMessage['attachments'] = [];
    if (Array.isArray((message as Record<string, unknown>).photo)) {
      const photos = (message as Record<string, unknown>).photo as Array<Record<string, unknown>>;
      const largest = photos[photos.length - 1]; // Telegram sends multiple sizes, last = largest
      if (largest?.file_id) {
        attachments.push({
          type: 'photo',
          url: `https://api.telegram.org/file/bot${this.token}/${largest.file_id}`,
          name: 'photo',
        });
      }
    }

    return {
      platformMessageId: String(message.message_id),
      platformUserId: userId,
      userName,
      content: message.text,
      platform: 'telegram',
      chatId: String(chat.id),
      timestamp: new Date((message.date as number) * 1000),
      attachments,
      replyToMessageId: message.reply_to_message
        ? String((message.reply_to_message as Record<string, unknown>).message_id)
        : undefined,
    };
  }

  async send(message: OutgoingMessage): Promise<string> {
    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;

    const payload: Record<string, unknown> = {
      chat_id: message.chatId,
      text: message.content,
      parse_mode: message.parseMode === 'html' ? 'HTML' : 'Markdown',
    };

    if (message.replyToMessageId) {
      payload.reply_to_message_id = message.replyToMessageId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = (await response.json()) as Record<string, unknown>;
    const sentMsg = result.result as Record<string, unknown>;
    return String(sentMsg?.message_id || '');
  }

  /**
   * Set the webhook URL on Telegram's side.
   * Call this once during setup.
   */
  async setWebhook(webhookUrl: string, secretToken?: string): Promise<boolean> {
    const url = `https://api.telegram.org/bot${this.token}/setWebhook`;
    const payload: Record<string, unknown> = {
      url: webhookUrl + this.getWebhookPath(),
      allowed_updates: ['message'],
    };
    if (secretToken) {
      payload.secret_token = secretToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    return result.description === 'Webhook was set';
  }
}

/**
 * Discord Bot Adapter
 *
 * Handles Discord Interaction API webhooks.
 * Docs: https://discord.com/developers/docs/interactions/receiving-and-responding
 *
 * Setup:
 * 1. Create a Discord Application at https://discord.com/developers/applications
 * 2. Create a bot under the application
 * 3. Enable MESSAGE_CONTENT intent in the bot settings
 * 4. Set DISCORD_BOT_TOKEN in your .env
 * 5. Set the interaction webhook URL to <YOUR_URL>/api/messaging/discord
 */
export class DiscordAdapter implements MessagingAdapter {
  platform: PlatformType = 'discord';
  private token: string;
  private publicKey: string;

  constructor(token: string, publicKey: string) {
    this.token = token;
    this.publicKey = publicKey;
  }

  getWebhookPath(): string {
    return '/api/messaging/discord';
  }

  validateWebhook(rawBody: unknown, headers: Record<string, string>): boolean {
    // Discord uses Ed25519 signature verification.
    // In production, you'd use the @discordjs/ws or similar library.
    // For now, we accept if the signature header is present.
    // TODO: Implement full Ed25519 verification
    return !!headers['x-signature-ed25519'] && !!headers['x-signature-timestamp'];
  }

  parseIncoming(rawBody: unknown): IncomingMessage | null {
    const body = rawBody as Record<string, unknown>;
    if (!body || typeof body !== 'object') return null;

    const type = body.type as number | undefined;

    // Type 1 = PING (verification)
    if (type === 1) return null;

    // Type 0 = Application Command
    // Type 2 = Message Component
    // We handle message content from the data field
    const data = body.data as Record<string, unknown> | undefined;
    const member = body.member as Record<string, unknown> | undefined;
    const user = body.user as Record<string, unknown> | undefined;
    const channel = body.channel_id as string | undefined;

    if (!channel) return null;

    // Extract message content
    let content = '';
    let replyToId: string | undefined;

    // For slash commands
    if (data?.options) {
      const options = data.options as Array<Record<string, unknown>>;
      const msgOption = options.find(o => o.name === 'message');
      if (msgOption?.value) content = String(msgOption.value);
    }

    // For message-based interactions
    if (data?.content) {
      content = String(data.content);
    }

    // For direct messages with content
    if (body.content && typeof body.content === 'string') {
      content = body.content;
    }

    if (!content.trim()) return null;

    const userInfo = member?.user || user || {};
    const userName = (userInfo as Record<string, unknown>).username as string
      || (userInfo as Record<string, unknown>).global_name as string
      || 'Unknown User';
    const userId = String((userInfo as Record<string, unknown>).id || body.member_user_id || 'unknown');

    return {
      platformMessageId: String(body.id || ''),
      platformUserId: userId,
      userName,
      content,
      platform: 'discord',
      chatId: channel,
      timestamp: new Date(),
      replyToMessageId: replyToId,
    };
  }

  async send(message: OutgoingMessage): Promise<string> {
    // Discord uses webhook or channel messages endpoint
    const url = `https://discord.com/api/v10/channels/${message.chatId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${this.token}`,
      },
      body: JSON.stringify({
        content: message.content,
        message_reference: message.replyToMessageId
          ? { message_id: message.replyToMessageId }
          : undefined,
      }),
    });

    const result = (await response.json()) as Record<string, unknown>;
    return String(result.id || '');
  }
}

/**
 * WhatsApp Cloud API Adapter
 *
 * Handles WhatsApp Business Cloud API webhooks.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Setup:
 * 1. Create a Meta Developer account at https://developers.facebook.com
 * 2. Create a WhatsApp Business Account
 * 3. Get a Permanent Token and Phone Number ID
 * 4. Set the webhook callback URL to <YOUR_URL>/api/messaging/whatsapp
 * 5. Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your .env
 */
export class WhatsAppAdapter implements MessagingAdapter {
  platform: PlatformType = 'whatsapp';
  private token: string;
  private phoneNumberId: string;
  private verifyToken: string;

  constructor(token: string, phoneNumberId: string, verifyToken: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
    this.verifyToken = verifyToken;
  }

  getWebhookPath(): string {
    return '/api/messaging/whatsapp';
  }

  validateWebhook(rawBody: unknown, headers: Record<string, string>): boolean {
    // Meta/WhatsApp uses a hub.signature header (HMAC-SHA256)
    // In production, verify: HMAC-SHA256(rawBody, appSecret) == headers['x-hub-signature-256']
    return true;
  }

  /**
   * Check if this is a webhook verification GET request (Meta sends this during setup).
   * Returns the challenge string if valid, null otherwise.
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
      return challenge;
    }
    return null;
  }

  parseIncoming(rawBody: unknown): IncomingMessage | null {
    const body = rawBody as Record<string, unknown>;
    if (!body || typeof body !== 'object') return null;

    // WhatsApp webhooks have a nested "entry" -> "changes" -> "value" -> "messages" structure
    const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
    if (!entry) return null;

    const change = (entry.changes as Array<Record<string, unknown>>)?.[0];
    if (!change) return null;

    const value = change.value as Record<string, unknown>;
    if (!value) return null;

    const messages = value.messages as Array<Record<string, unknown>> | undefined;
    if (!messages || messages.length === 0) return null;

    const msg = messages[0];
    const msgType = msg.type as string;

    // Handle text messages
    if (msgType !== 'text') return null;

    const textObj = msg.text as Record<string, unknown> | undefined;
    if (!textObj?.body) return null;

    // Extract contacts for user info
    const contacts = value.contacts as Array<Record<string, unknown>> | undefined;
    const contact = contacts?.[0];
    const waId = contact?.wa_id as string || String(msg.from) || 'unknown';
    const name = (contact?.profile?.name as string) || (contact?.name as string) || 'Unknown';

    return {
      platformMessageId: String(msg.id),
      platformUserId: waId,
      userName: name,
      content: textObj.body as string,
      platform: 'whatsapp',
      chatId: waId, // WhatsApp uses user ID as "chat ID" for 1:1 conversations
      timestamp: new Date(Number(msg.timestamp) * 1000),
    };
  }

  async send(message: OutgoingMessage): Promise<string> {
    const url = `https://graph.facebook.com/v19.0/${this.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: message.chatId,
        type: 'text',
        text: { body: message.content },
      }),
    });

    const result = (await response.json()) as Record<string, unknown>;
    const messages = result.messages as Array<Record<string, unknown>> | undefined;
    return String(messages?.[0]?.id || '');
  }
}
