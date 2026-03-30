import { NextRequest } from 'next/server';
import { getMessagingGateway } from '@/lib/messaging/gateway';
import { getAgent } from '@/lib/agent';

/**
 * Discord Webhook Endpoint
 *
 * Discord sends POST requests here for interactions and message events.
 * The bot must be configured with the endpoint URL in the Discord Developer Portal.
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

    return gateway.handleWebhook('discord', rawBody, headers);
  } catch (error) {
    console.error('[Discord Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
