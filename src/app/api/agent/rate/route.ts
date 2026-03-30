import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * Rate a chat message (thumbs up / thumbs down).
 * POST /api/agent/rate
 * Body: { messageId: string, rating: 1 | 2 | 3 | 4 | 5 }
 */
export async function POST(request: Request) {
  try {
    const { messageId, rating } = await request.json();

    if (!messageId || typeof messageId !== 'string') {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const validRatings = [1, 2, 3, 4, 5];
    if (!validRatings.includes(rating)) {
      return NextResponse.json({ error: 'rating must be 1-5' }, { status: 400 });
    }

    const message = await db.chatMessage.findUnique({ where: { id: messageId } });
    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if (message.role !== 'assistant') {
      return NextResponse.json({ error: 'Only assistant messages can be rated' }, { status: 400 });
    }

    if (message.rating !== null) {
      return NextResponse.json({ error: 'Message already rated' }, { status: 409 });
    }

    await db.chatMessage.update({
      where: { id: messageId },
      data: { rating, ratedAt: new Date() },
    });

    return NextResponse.json({ ok: true, messageId, rating });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
