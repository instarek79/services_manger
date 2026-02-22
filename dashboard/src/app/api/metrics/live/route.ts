import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  insertLiveMetrics,
  updateLastSeen,
  cleanupLiveMetrics,
} from '@/lib/database';

// Cleanup counter — run cleanup every ~100 requests to avoid doing it every time
let cleanupCounter = 0;

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { allowed } = checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, {
        status: 429,
        headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': '0' },
      });
    }

    const auth = authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    insertLiveMetrics(auth.serverId, {
      cpu_percent: body.cpu_percent ?? 0,
      cpu_per_core: JSON.stringify(body.cpu_per_core ?? []),
      cpu_freq_mhz: body.cpu_freq_mhz ?? 0,
      memory_percent: body.memory_percent ?? 0,
      memory_used: body.memory_used ?? 0,
      memory_available: body.memory_available ?? 0,
      swap_percent: body.swap_percent ?? 0,
      swap_used: body.swap_used ?? 0,
      network_rate: JSON.stringify(body.network_rate ?? {}),
      disk_io_rate: JSON.stringify(body.disk_io_rate ?? {}),
      process_count: body.process_count ?? 0,
      thread_count: body.thread_count ?? 0,
      handle_count: body.handle_count ?? 0,
    });

    updateLastSeen(auth.serverId);

    // Periodic cleanup of old live metrics
    cleanupCounter++;
    if (cleanupCounter >= 100) {
      cleanupCounter = 0;
      cleanupLiveMetrics(60);
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Live metrics ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
