import { NextRequest } from 'next/server';
import { getMessagingGateway } from '@/lib/messaging/gateway';
import { getAgent } from '@/lib/agent';

/**
 * Telegram Webhook Endpoint
 *
 * Telegram sends POST requests here with message updates.
 * Setup: POST https://api.telegram.org/bot<TOKEN>/setWebhook?url=<YOUR_URL>/api/messaging/telegram
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => { headers[key] = value; });

    const gateway = getMessagingGateway();

    // Connect agent if not already connected
    const agent = await getAgent();
    gateway.setAgent({
      chat: (opts) => agent.chat(opts),
    } as Parameters<typeof gateway.setAgent>[0]);

    return gateway.handleWebhook('telegram', rawBody, headers);
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
