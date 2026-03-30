import { NextResponse } from 'next/server';
import { getAgent } from '@/lib/agent';

export async function GET() {
  try {
    const agent = await getAgent();
    const logs = agent.getSecurityLogs(100);
    return NextResponse.json({ logs, total: logs.length });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Failed to fetch security logs';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
