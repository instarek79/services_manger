import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { updateLastSeen } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    updateLastSeen(auth.serverId);
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Ping error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Server Monitor Dashboard',
    timestamp: new Date().toISOString(),
  });
}
