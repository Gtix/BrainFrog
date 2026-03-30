import { NextResponse } from 'next/server';
import { getSkillExecutor } from '@/lib/agent/skill-executor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { skill, input, context } = body;

    if (!skill || typeof skill !== 'string') {
      return NextResponse.json({ error: 'Skill name is required' }, { status: 400 });
    }
    if (!input || typeof input !== 'string') {
      return NextResponse.json({ error: 'Input is required' }, { status: 400 });
    }

    const handlerMap: Record<string, string> = {
      'web-search': 'builtin:web-search',
      'image-generator': 'builtin:image-generator',
      'summarizer': 'builtin:summarizer',
      'translator': 'builtin:translator',
      'file-reader': 'builtin:file-reader',
      'code-executor': 'builtin:code-executor',
    };

    const handler = handlerMap[skill];
    if (!handler) {
      return NextResponse.json({ error: `Unknown skill: ${skill}. Available: ${Object.keys(handlerMap).join(', ')}` }, { status: 400 });
    }

    const executor = getSkillExecutor();
    const result = await executor.execute(handler, input, context);

    return NextResponse.json({
      success: result.success,
      output: result.output,
      skill: result.skill,
      metadata: result.metadata,
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
