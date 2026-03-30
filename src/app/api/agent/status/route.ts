import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function GET() {
  try {
    const agent = await getAgent();
    const memoryStats = await agent.getMemoryStats();
    const promptVersionId = agent.getActivePromptVersionId();
    const llmProviders = agent.getConfiguredLLMProviders();

    return NextResponse.json({
      status: 'healthy',
      config: agent.getConfig(),
      memoryStats,
      skills: agent.getAvailableSkills().map(s => ({ name: s.name, description: s.description, version: s.version })),
      llmProviders,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      promptVersionId,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Health check failed';
    return NextResponse.json({ status: 'unhealthy', error: errMsg }, { status: 503 });
  }
}
