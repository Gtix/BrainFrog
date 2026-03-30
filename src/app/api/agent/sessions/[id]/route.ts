import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.agentSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { timestamp: 'asc' },
          take: 100,
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: session.id,
      title: session.title,
      platform: session.platform,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        rating: m.rating,
      })),
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to load session';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
