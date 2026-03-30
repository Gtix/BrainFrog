import { NextResponse } from 'next/server';
import { getPromptVersioning } from '@/lib/analytics/prompt-versioning';

/**
 * List prompt versions: GET /api/agent/prompt-versions
 * Create prompt version: POST /api/agent/prompt-versions
 * Activate version: PATCH /api/agent/prompt-versions (body: { versionId, activate: true })
 * Delete version: DELETE /api/agent/prompt-versions (body: { versionId })
 */
export async function GET() {
  try {
    const pv = getPromptVersioning();
    const versions = await pv.listVersions();
    return NextResponse.json({ versions });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { label, content, description } = await request.json();

    if (!label || !content) {
      return NextResponse.json({ error: 'label and content are required' }, { status: 400 });
    }

    if (content.length > 10000) {
      return NextResponse.json({ error: 'Prompt content too long (max 10,000 characters)' }, { status: 400 });
    }

    const pv = getPromptVersioning();
    const version = await pv.createVersion(label, content, description);
    return NextResponse.json({ version }, { status: 201 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { versionId, activate } = await request.json();

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }

    if (activate) {
      const pv = getPromptVersioning();
      const version = await pv.activateVersion(versionId);
      return NextResponse.json({ version });
    }

    return NextResponse.json({ error: 'No action specified. Use { activate: true }' }, { status: 400 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { versionId } = await request.json();

    if (!versionId) {
      return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
    }

    const pv = getPromptVersioning();
    await pv.deleteVersion(versionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
