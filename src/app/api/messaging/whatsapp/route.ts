import { NextRequest } from 'next/server';
import { getMessagingGateway } from '@/lib/messaging/gateway';
import { getAgent } from '@/lib/agent';
import { WhatsAppAdapter } from '@/lib/messaging/adapters';

/**
 * WhatsApp Cloud API Webhook Endpoint
 *
 * Meta sends GET for verification during setup, and POST for message events.
 * Setup:
 * 1. Go to Meta Developer Portal → WhatsApp → Configuration
 * 2. Set Callback URL to <YOUR_URL>/api/messaging/whatsapp
 * 3. Set Verify Token (must match WHATSAPP_VERIFY_TOKEN in .env)
 * 4. Subscribe to "messages" field
 */

// GET: Webhook verification (Meta sends this during setup)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && challenge) {
    const gateway = getMessagingGateway();
    const adapter = gateway.getAdapter('whatsapp');

    if (adapter instanceof WhatsAppAdapter) {
      const result = adapter.verifyWebhook(mode, token, challenge);
      if (result) {
        return new Response(result, {
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }

    // Fallback: check verify token from env
    if (token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return new Response(challenge, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Verification failed' }), { status: 403 });
}

// POST: Message events from WhatsApp
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

    return gateway.handleWebhook('whatsapp', rawBody, headers);
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
