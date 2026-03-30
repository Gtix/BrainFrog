import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    const where: Record<string, unknown> = {};
    if (search) {
      where.content = { contains: search };
    }
    if (type && ['working', 'episodic', 'semantic'].includes(type)) {
      where.type = type;
    }

    const entries = await db.memoryEntry.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });

    const stats = await db.memoryEntry.groupBy({
      by: ['type'],
      _count: true,
    });

    const typeStats: Record<string, number> = {};
    for (const s of stats) {
      typeStats[s.type] = s._count;
    }

    return NextResponse.json({
      entries: entries.map(e => ({
        id: e.id,
        type: e.type,
        content: e.content,
        accessCount: e.accessCount,
        importance: e.importance,
        sessionId: e.sessionId,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
      stats: {
        working: typeStats['working'] || 0,
        episodic: typeStats['episodic'] || 0,
        semantic: typeStats['semantic'] || 0,
        total: entries.length,
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch memory';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { entryId } = body;

    if (!entryId) {
      return NextResponse.json({ error: 'Entry ID is required' }, { status: 400 });
    }

    await db.memoryEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to delete memory entry';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
