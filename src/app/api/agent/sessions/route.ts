import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const sessions = await db.agentSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    return NextResponse.json({
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        platform: s.platform,
        messageCount: s._count.messages,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to list sessions';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    await db.chatMessage.deleteMany({ where: { sessionId } });
    await db.memoryEntry.deleteMany({ where: { sessionId } });
    await db.agentSession.delete({ where: { id: sessionId } }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to delete session';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
