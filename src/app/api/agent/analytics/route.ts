import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getPromptVersioning } from '@/lib/analytics/prompt-versioning';

/**
 * Analytics endpoint: GET /api/agent/analytics
 *
 * Returns performance data for all prompt versions, ratings breakdown,
 * and usage statistics. This is the data that would inform prompt optimization.
 */
export async function GET() {
  try {
    // Quick connectivity check
    await db.agentSession.count();
    const pv = getPromptVersioning();
    const analytics = await pv.getAnalytics();
    return NextResponse.json(analytics);
  } catch (error) {
    const errMsg = error instanceof Error ? `${error.message} (stack: ${error.stack?.slice(0, 200)})` : 'Internal error';
    console.error('[Analytics]', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
