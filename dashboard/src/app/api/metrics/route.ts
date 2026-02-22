import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  insertMetrics,
  insertProcesses,
  insertServices,
  updateLastSeen,
  checkThresholds,
} from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const { allowed, remaining } = checkRateLimit(ip);
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
    const { metrics, processes, services } = body;

    if (metrics) {
      insertMetrics(auth.serverId, {
        cpu_percent: metrics.cpu_percent ?? 0,
        memory_total: metrics.memory_total ?? 0,
        memory_used: metrics.memory_used ?? 0,
        memory_free: metrics.memory_free ?? 0,
        memory_percent: metrics.memory_percent ?? 0,
        disk_info: JSON.stringify(metrics.disks ?? []),
        network_info: JSON.stringify(metrics.network ?? {}),
        uptime_seconds: metrics.uptime_seconds ?? 0,
        boot_time: metrics.boot_time ?? '',
      });

      checkThresholds(
        auth.serverId,
        metrics.cpu_percent ?? 0,
        metrics.memory_percent ?? 0,
        JSON.stringify(metrics.disks ?? [])
      );
    }

    if (processes && Array.isArray(processes)) {
      insertProcesses(auth.serverId, processes);
    }

    if (services && Array.isArray(services)) {
      insertServices(auth.serverId, services);
    }

    updateLastSeen(auth.serverId);

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Metrics ingestion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
