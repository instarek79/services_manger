import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getPendingConfig, markConfigApplied } from '@/lib/database';

export const dynamic = 'force-dynamic';

// Agent polls this endpoint to check for pending config changes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;

    // Agent can only fetch its own config
    if (auth.serverId !== serverId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const pending = getPendingConfig(serverId);
    if (!pending) {
      return NextResponse.json({ has_update: false, config: null });
    }

    return NextResponse.json({ has_update: true, config: pending });
  } catch (error) {
    console.error('Config fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Agent confirms it applied the config
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> }
) {
  try {
    const auth = authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serverId } = await params;

    if (auth.serverId !== serverId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    markConfigApplied(serverId);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Config confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
