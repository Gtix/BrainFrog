import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId, systemPromptOverride } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
    }

    const agent = await getAgent();
    const result = await agent.chat({ message, sessionId, systemPromptOverride });

    return NextResponse.json({
      id: result.message.id,
      role: result.message.role,
      content: result.message.content,
      timestamp: result.message.timestamp,
      sessionId: result.sessionId,
      memoryStats: result.memoryStats,
      securityCheck: result.securityCheck,
      promptVersion: result.promptVersion,
      llmProvider: result.llmProvider,
      llmModel: result.llmModel,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
