import { NextRequest, NextResponse } from 'next/server';
import {
  getServer,
  getLiveMetrics,
  getLiveBenchmark,
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
    const minutes = parseInt(searchParams.get('minutes') || '5');
    const benchmarkMinutes = parseInt(searchParams.get('benchmark') || '30');

    const rawMetrics = getLiveMetrics(id, minutes) as Record<string, unknown>[];
    const benchmark = getLiveBenchmark(id, benchmarkMinutes) as Record<string, unknown> | undefined;

    // Parse JSON fields in each metric row
    const metrics = rawMetrics.map(m => {
      let cpuPerCore: number[] = [];
      let networkRate = {};
      let diskIoRate = {};
      try { cpuPerCore = JSON.parse(m.cpu_per_core as string); } catch { /* ignore */ }
      try { networkRate = JSON.parse(m.network_rate as string); } catch { /* ignore */ }
      try { diskIoRate = JSON.parse(m.disk_io_rate as string); } catch { /* ignore */ }

      return {
        timestamp: m.timestamp,
        cpu_percent: m.cpu_percent,
        cpu_per_core: cpuPerCore,
        cpu_freq_mhz: m.cpu_freq_mhz,
        memory_percent: m.memory_percent,
        memory_used: m.memory_used,
        memory_available: m.memory_available,
        swap_percent: m.swap_percent,
        swap_used: m.swap_used,
        network_rate: networkRate,
        disk_io_rate: diskIoRate,
        process_count: m.process_count,
        thread_count: m.thread_count,
        handle_count: m.handle_count,
      };
    });

    return NextResponse.json({
      metrics,
      benchmark: benchmark || null,
      server_id: id,
      minutes,
      benchmark_minutes: benchmarkMinutes,
    });
  } catch (error) {
    console.error('Live metrics fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
