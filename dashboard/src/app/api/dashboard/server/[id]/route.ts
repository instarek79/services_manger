import { NextRequest, NextResponse } from 'next/server';
import {
  getServer,
  updateServer,
  deleteServer,
  getLatestMetrics,
  getMetricsHistory,
  getLatestProcesses,
  getLatestServices,
  getActiveAlerts,
} from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const server = getServer(id) as Record<string, unknown> | undefined;
    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24');

    const metrics = getLatestMetrics(id) as Record<string, unknown> | undefined;
    const history = getMetricsHistory(id, hours) as Record<string, unknown>[];
    const processes = getLatestProcesses(id, 15);
    const services = getLatestServices(id);
    const alerts = getActiveAlerts(id);

    let diskInfo: unknown[] = [];
    if (metrics?.disk_info) {
      try { diskInfo = JSON.parse(metrics.disk_info as string); } catch { /* ignore */ }
    }

    let networkInfo = {};
    if (metrics?.network_info) {
      try { networkInfo = JSON.parse(metrics.network_info as string); } catch { /* ignore */ }
    }

    const historyParsed = history.map(h => ({
      timestamp: h.timestamp,
      cpu_percent: h.cpu_percent,
      memory_percent: h.memory_percent,
      memory_used: h.memory_used,
      memory_free: h.memory_free,
    }));

    return NextResponse.json({
      server,
      metrics: metrics ? {
        ...metrics,
        disks: diskInfo,
        network: networkInfo,
      } : null,
      history: historyParsed,
      processes,
      services,
      alerts,
    });
  } catch (error) {
    console.error('Server detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    updateServer(id, body);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Server update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    deleteServer(id);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Server delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
