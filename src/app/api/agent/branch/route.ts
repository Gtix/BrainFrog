import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, messageId } = body;

    if (!sessionId || !messageId) {
      return NextResponse.json(
        { error: 'sessionId and messageId are required' },
        { status: 400 }
      );
    }

    // Get all messages from the source session, ordered by timestamp
    const sourceMessages = await db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
    });

    // Find the target message index
    const targetIndex = sourceMessages.findIndex(m => m.id === messageId);
    if (targetIndex === -1) {
      return NextResponse.json({ error: 'Message not found in session' }, { status: 404 });
    }

    // Create new session
    const newSessionId = crypto.randomUUID();
    await db.agentSession.create({
      data: {
        id: newSessionId,
        title: `Branch (from ${new Date().toLocaleString()})`,
        platform: 'web',
      },
    });

    // Copy messages up to and including the target message
    const messagesToCopy = sourceMessages.slice(0, targetIndex + 1);
    if (messagesToCopy.length > 0) {
      await db.chatMessage.createMany({
        data: messagesToCopy.map(m => ({
          id: crypto.randomUUID(), // New IDs for the branch
          sessionId: newSessionId,
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
          rating: m.rating,
          ratedAt: m.ratedAt,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      newSessionId,
      messageCount: messagesToCopy.length,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to create branch';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
