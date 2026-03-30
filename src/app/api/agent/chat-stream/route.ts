import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';
import { executeReAct } from '@/lib/agent/react-engine';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, sessionId, systemPromptOverride, provider } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 characters)' }, { status: 400 });
    }

    const agent = await getAgent();
    const config = agent.getConfig();
    const sid = sessionId || crypto.randomUUID();

    // Save user message to DB
    await db.agentSession.upsert({
      where: { id: sid },
      create: { id: sid, platform: 'web' },
      update: { updatedAt: new Date() },
    });

    await db.chatMessage.create({
      data: {
        id: crypto.randomUUID(),
        sessionId: sid,
        role: 'user',
        content: message,
        timestamp: new Date(),
        promptVersionId: agent.getActivePromptVersionId(),
      },
    });

    // Get conversation history from DB
    const existingMessages = await db.chatMessage.findMany({
      where: { sessionId: sid },
      orderBy: { timestamp: 'asc' },
      take: 20,
    });

    const historyMessages = existingMessages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Get memory context
    let memoryContext = '';
    try {
      const stats = await agent.getMemoryStats();
      if (stats && stats.total > 0) {
        memoryContext = await (agent as unknown as { memory: { getContextForPrompt: (q: string) => Promise<string> } }).memory.getContextForPrompt(message);
      }
    } catch {
      // Memory not available
    }

    // Run ReAct engine
    const result = await executeReAct(
      message,
      historyMessages,
      memoryContext,
      config,
      provider
    );

    // Save assistant response to DB
    const assistantId = crypto.randomUUID();
    await db.chatMessage.create({
      data: {
        id: assistantId,
        sessionId: sid,
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
        promptVersionId: agent.getActivePromptVersionId(),
      },
    });

    // Stream the ReAct steps as SSE
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        // Send meta first
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'meta',
          sessionId: sid,
          totalTokens: result.totalTokens,
          provider: result.provider,
          model: result.model,
          skillResults: result.skillResults?.map(r => ({
            skill: r.skill,
            success: r.success,
            preview: r.output.substring(0, 200),
          })),
          stepCount: result.steps.length,
        })}\n\n`));

        // Stream each step
        for (const step of result.steps) {
          const event = {
            type: step.type,
            content: step.content,
            tool: step.tool,
            toolInput: step.toolInput,
            duration: step.duration,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
