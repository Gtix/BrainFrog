import { NextResponse } from 'next/server';
import { getMessagingGateway } from '@/lib/messaging/gateway';

/**
 * Messaging Gateway Status
 *
 * Returns which platforms are configured, active sessions, and rate limit info.
 */
export async function GET() {
  try {
    const gateway = getMessagingGateway();
    return NextResponse.json({
      status: 'ok',
      ...gateway.getStats(),
      configuredPlatforms: {
        telegram: !!process.env.TELEGRAM_BOT_TOKEN,
        discord: !!(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_PUBLIC_KEY),
        whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
      },
      webhookEndpoints: {
        telegram: '/api/messaging/telegram',
        discord: '/api/messaging/discord',
        whatsapp: '/api/messaging/whatsapp',
      },
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed';
    return NextResponse.json({ status: 'error', error: errMsg }, { status: 500 });
  }
}
